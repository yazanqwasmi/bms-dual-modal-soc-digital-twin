"""InfluxDB write layer for the RPi Wi-Fi Receiver."""

import os
import time
import logging
from collections import deque
from datetime import datetime, timezone

import numpy as np
import requests
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from config import Config, MODULE_TOPOLOGY

LSTM_PREDICT_URL = os.getenv("LSTM_PREDICT_URL", "http://lstm-inference:5001/predict")
LSTM_SEQ_LEN = int(os.getenv("LSTM_SEQ_LEN", "30"))
LSTM_TIMEOUT_S = float(os.getenv("LSTM_TIMEOUT_S", "2.0"))

SOC_CORRECTION_THRESHOLD_PCT = float(os.getenv("SOC_CORRECTION_THRESHOLD_PCT", "2.0"))
SOC_CORRECTION_ALPHA = float(os.getenv("SOC_CORRECTION_ALPHA", "0.35"))

# Pipeline-only mode: ML SOC estimators are intentionally disabled.
PLACEHOLDER_SOC = 50.0

logger = logging.getLogger(__name__)


class InfluxWriter:
    def __init__(self, config: Config):
        self.config = config
        self.client = None
        self.write_api = None
        self._module_data = {}  # Buffer latest data per module for pack aggregation
        self._esp_last_seen = {}  # Track per-ESP connectivity
        # Ring buffers for LSTM SOC estimation (last 30 pack-level readings)
        self._v_history: deque = deque(maxlen=LSTM_SEQ_LEN)
        self._i_history: deque = deque(maxlen=LSTM_SEQ_LEN)
        self._t_history: deque = deque(maxlen=LSTM_SEQ_LEN)

    def connect(self, max_retries=10, base_delay=2.0):
        for attempt in range(max_retries):
            try:
                logger.info(f"Connecting to InfluxDB at {self.config.influxdb_url}...")
                self.client = InfluxDBClient(
                    url=self.config.influxdb_url,
                    token=self.config.influxdb_token,
                    org=self.config.influxdb_org
                )
                self.client.ping()
                self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
                logger.info("Connected to InfluxDB!")
                return
            except Exception as e:
                delay = min(base_delay * (2 ** attempt), 60.0)
                logger.warning(f"Connection attempt {attempt+1}/{max_retries} failed: {e}. Retrying in {delay:.1f}s...")
                time.sleep(delay)
        raise ConnectionError("Could not connect to InfluxDB after all retries")

    def write_sensing_data(self, payload: dict):
        """Write cell_metrics, module_metrics, and wireless_health from a sensing ESP payload."""
        ts = datetime.now(timezone.utc)
        module_id = payload["module_id"]
        topo = MODULE_TOPOLOGY[module_id]
        cells = payload["cells"]
        temp_offset = topo.get("temp_offset", 0.0)
        temps = [t + temp_offset for t in payload["temps"]]
        pack_id = self.config.pack_id

        points = []

        # Cell metrics
        for i, voltage in enumerate(cells):
            global_cell_id = topo["cell_offset"] + i + 1
            cell_temp = temps[i % len(temps)]  # Map temps to cells cyclically
            points.append(
                Point("cell_metrics")
                .tag("pack_id", pack_id)
                .tag("module_id", module_id)
                .tag("cell_id", f"C{global_cell_id:02d}")
                .tag("cell_position", str(i + 1))
                .field("voltage", float(round(voltage, 4)))
                .field("temperature", float(round(cell_temp, 2)))
                .field("balance_current", 0.0)
                .time(ts, WritePrecision.S)
            )

        # Module metrics
        module_voltage = sum(cells)
        avg_temp = float(np.mean(temps))
        current = float(payload.get("current", 0.0))
        points.append(
            Point("module_metrics")
            .tag("pack_id", pack_id)
            .tag("module_id", module_id)
            .field("voltage", float(round(module_voltage, 3)))
            .field("current", round(current, 2))
            .field("num_cells", topo["num_cells"])
            .field("min_cell_v", float(round(min(cells), 4)))
            .field("max_cell_v", float(round(max(cells), 4)))
            .field("delta_v_mv", float(round((max(cells) - min(cells)) * 1000, 2)))
            .field("avg_temp", float(round(avg_temp, 2)))
            .field("temp_1", float(round(temps[0], 2)))
            .field("temp_2", float(round(temps[1], 2)))
            .field("max_temp", float(round(max(temps), 2)))
            .field("balancing_active", False)
            .time(ts, WritePrecision.S)
        )

        # Track wireless health — real values from ESP payload
        rssi        = float(payload.get("rssi",        -99.0))
        packet_loss = float(payload.get("packet_loss",  0.0))
        latency_ms  = float(payload.get("latency_ms",   0.0))
        self._esp_last_seen[module_id] = time.time()
        points.append(
            Point("wireless_health")
            .tag("pack_id", pack_id)
            .tag("module_id", module_id)
            .field("rssi",        rssi)
            .field("packet_loss", packet_loss)
            .field("latency_ms",  latency_ms)
            .field("packets_rx",  1)
            .time(ts, WritePrecision.S)
        )

        self.write_api.write(bucket=self.config.influxdb_bucket, record=points)

        # Buffer for pack aggregation
        self._module_data[module_id] = {
            "cells": cells,
            "temps": temps,
            "voltage": module_voltage,
            "current": current,
            "timestamp": ts,
            "soc_estimate": payload.get("soc_estimate"),
        }

        # Write pack metrics whenever any module reports
        # (previously waited for all 3 — blocks testing with fewer modules)
        self._write_pack_metrics(ts)

    def _get_lstm_soc(self, voltage: float, current: float, temperature: float):
        """
        Append latest readings to ring buffers and call the LSTM inference server.
        Returns SOC percentage [0, 100] or None if the server is unavailable.
        """
        self._v_history.append(voltage)
        self._i_history.append(current)
        self._t_history.append(temperature)

        if len(self._v_history) < LSTM_SEQ_LEN:
            return None  # Not enough history yet

        try:
            resp = requests.post(
                LSTM_PREDICT_URL,
                json={
                    "voltage":     list(self._v_history),
                    "current":     list(self._i_history),
                    "temperature": list(self._t_history),
                },
                timeout=LSTM_TIMEOUT_S,
            )
            if resp.status_code == 200:
                return float(resp.json()["soc"])
        except Exception as e:
            logger.warning(f"LSTM SOC request failed: {e}")
        return None

    def _write_pack_metrics(self, ts):
        """Aggregate all module data into pack-level metrics."""
        all_cells = []
        all_temps = []
        total_voltage = 0.0
        total_current = 0.0

        for mod_data in self._module_data.values():
            all_cells.extend(mod_data["cells"])
            all_temps.extend(mod_data["temps"])
            total_voltage += mod_data["voltage"]
            total_current += mod_data.get("current", 0.0)

        avg_temp = float(np.mean(all_temps))

        # Use NARX edge SOC from sensing ESPs. Average valid estimates across modules.
        # Falls back to placeholder if no module reports a valid SOC.
        narx_socs = []
        for mod_data in self._module_data.values():
            est = mod_data.get("soc_estimate")
            if est is not None and float(est) >= 0:
                narx_socs.append(float(est))

        if narx_socs:
            soc_narx = round(float(np.mean(narx_socs)), 2)
        else:
            soc_narx = PLACEHOLDER_SOC

        lstm_soc = self._get_lstm_soc(total_voltage, total_current, avg_temp)

        soc_delta = 0.0
        soc_corrected = False
        soc_final = soc_narx

        if lstm_soc is not None:
            lstm_soc = float(np.clip(lstm_soc, 0.0, 100.0))
            soc_delta = round(lstm_soc - soc_narx, 2)
            # SOC model correction is intentionally disabled for now.
            # Uncomment this block to re-enable NARX->LSTM blending.
            # if abs(soc_delta) >= SOC_CORRECTION_THRESHOLD_PCT:
            #     soc_corrected = True
            #     soc_final = round(
            #         float(np.clip(soc_narx + (SOC_CORRECTION_ALPHA * soc_delta), 0.0, 100.0)),
            #         2,
            #     )

        if soc_corrected:
            logger.info(
                "SOC corrected by LSTM: narx=%.2f lstm=%.2f final=%.2f delta=%.2f",
                soc_narx,
                lstm_soc,
                soc_final,
                soc_delta,
            )

        power_kw = round((total_voltage * total_current) / 1000.0, 3)
        point = (
            Point("pack_metrics")
            .tag("pack_id", self.config.pack_id)
            .field("total_voltage", float(round(total_voltage, 2)))
            .field("current", round(total_current, 2))
            .field("power_kw", power_kw)
            .field("soc", soc_final)
            .field("soc_final", soc_final)
            .field("soc_narx", soc_narx)
            .field("soc_correction_delta", soc_delta)
            .field("soc_corrected", soc_corrected)
            .field("soh", 98.0)
            .field("min_cell_v", float(round(min(all_cells), 4)))
            .field("max_cell_v", float(round(max(all_cells), 4)))
            .field("delta_v_mv", float(round((max(all_cells) - min(all_cells)) * 1000, 2)))
            .field("min_temp", float(round(min(all_temps), 2)))
            .field("max_temp", float(round(max(all_temps), 2)))
            .field("avg_temp", float(round(float(np.mean(all_temps)), 2)))
            .field("ambient_temp", 22.0)
            .field("cycle_count", 0)
            .time(ts, WritePrecision.S)
        )

        if lstm_soc is not None:
            point = point.field("soc_lstm", round(lstm_soc, 2))

        self.write_api.write(bucket=self.config.influxdb_bucket, record=[point])

    def write_master_data(self, payload: dict):
        """Write contactor_status, module_health, and master_state from a master ESP payload."""
        ts = datetime.now(timezone.utc)
        pack_id = self.config.pack_id
        points = []

        # Contactor status
        contactors = payload["contactors"]
        points.append(
            Point("contactor_status")
            .tag("pack_id", pack_id)
            .field("positive", contactors["positive"])
            .field("negative", contactors["negative"])
            .field("precharge", contactors["precharge"])
            .time(ts, WritePrecision.S)
        )

        # Module health — skip null entries (module not yet seen by master)
        module_health = payload.get("module_health", {}) or {}
        for mod_id, status in module_health.items():
            if status is None:
                continue
            last_seen = self._esp_last_seen.get(mod_id)
            last_seen_ms = int((time.time() - last_seen) * 1000) if last_seen else 99999
            points.append(
                Point("module_health")
                .tag("pack_id", pack_id)
                .tag("module_id", mod_id)
                .field("status", status)
                .field("last_seen_ms", last_seen_ms)
                .time(ts, WritePrecision.S)
            )

        # Master state (FSM state, trip logic)
        state = payload.get("state")
        trip = payload.get("trip_logic") or {}
        if state is not None:
            p = (
                Point("master_state")
                .tag("pack_id", pack_id)
                .field("state", str(state))
                .time(ts, WritePrecision.S)
            )
            if trip.get("temp_min") is not None:
                p = p.field("trip_temp_min", float(trip["temp_min"]))
            if trip.get("temp_max") is not None:
                p = p.field("trip_temp_max", float(trip["temp_max"]))
            if trip.get("bad_poll_trip_threshold") is not None:
                p = p.field("trip_bad_poll_threshold", int(trip["bad_poll_trip_threshold"]))
            if trip.get("last_trip_module") is not None:
                p = p.field("last_trip_module", str(trip["last_trip_module"]))
            points.append(p)

        # Track master ESP connectivity
        self._esp_last_seen["master"] = time.time()

        self.write_api.write(bucket=self.config.influxdb_bucket, record=points)

    def get_esp_status(self) -> dict:
        """Return last-seen timestamps for all ESPs."""
        now = time.time()
        return {
            esp_id: {
                "last_seen_ago_s": round(now - last_seen, 1),
                "healthy": (now - last_seen) < 10,
            }
            for esp_id, last_seen in self._esp_last_seen.items()
        }

    def close(self):
        if self.client:
            self.client.close()
