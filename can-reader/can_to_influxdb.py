#!/usr/bin/env python3
"""
CAN Bus to InfluxDB Bridge for BMS
==================================
Reads CAN frames from a Raspberry Pi CAN HAT and writes to InfluxDB.

Based on CAN Protocol:
  - 0x500: Pack Summary (Voltage, Current, Avg Temp)
  - 0x510-0x518: Module Voltages (35 modules, 4 per frame)
  - 0x520-0x528: Module Temperatures (35 modules, 4 per frame)

Hardware Setup:
  - Raspberry Pi with CAN HAT (MCP2515-based)
  - CAN bus connected to BMS at 500kbps (adjust as needed)

Usage:
  sudo ip link set can0 up type can bitrate 500000
  python3 can_to_influxdb.py
"""

import os
import sys
import struct
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import logging

try:
    import can
except ImportError:
    print("Error: python-can not installed. Run: pip install python-can")
    exit(1)

try:
    from influxdb_client import InfluxDBClient, Point, WritePrecision
    from influxdb_client.client.write_api import SYNCHRONOUS
except ImportError:
    print("Error: influxdb-client not installed. Run: pip install influxdb-client")
    exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================
def _require_env(name, default=None):
    """Get required environment variable or exit with clear error."""
    value = os.getenv(name, default)
    if value is None:
        print(f"ERROR: Required environment variable {name} is not set")
        sys.exit(1)
    return value


@dataclass
class Config:
    """Configuration from environment variables"""
    influxdb_url: str = field(default_factory=lambda: _require_env("INFLUXDB_URL", "http://localhost:8086"))
    influxdb_token: str = field(default_factory=lambda: _require_env("INFLUXDB_TOKEN"))
    influxdb_org: str = field(default_factory=lambda: _require_env("INFLUXDB_ORG", "bms-org"))
    influxdb_bucket: str = field(default_factory=lambda: _require_env("INFLUXDB_BUCKET", "bms-telemetry"))

    can_interface: str = field(default_factory=lambda: os.getenv("CAN_INTERFACE", "can0"))
    can_bitrate: int = field(default_factory=lambda: int(os.getenv("CAN_BITRATE", "500000")))

    num_modules: int = 35  # Fixed based on CAN protocol
    write_batch_size: int = field(default_factory=lambda: int(os.getenv("WRITE_BATCH_SIZE", "50")))
    write_interval: float = field(default_factory=lambda: float(os.getenv("WRITE_INTERVAL", "1.0")))


# =============================================================================
# CAN Protocol Definition (from CSV specification)
# =============================================================================
"""
CAN Message Structure:
----------------------
0x500 - Pack Summary:
  Bytes 1-2: Pack Voltage (0.1V/bit, big-endian uint16)
  Bytes 3-4: Pack Current (0.1A/bit, big-endian int16, signed)
  Bytes 5-6: Avg Temperature (0.1C/bit or raw C)
  Bytes 7-8: Parity/Reserved

0x510-0x518 - Module Voltages:
  Each frame contains 4 module voltages (2 bytes each, big-endian uint16)
  0x510: Modules 1-4
  0x511: Modules 5-8
  ...
  0x518: Modules 33-35 (+ blank)

0x520-0x528 - Module Temperatures:
  Each frame contains 4 module temperatures (2 bytes each)
  0x520: Modules 1-4
  0x521: Modules 5-8
  ...
  0x528: Modules 33-35 (+ blank)
"""

# CAN ID ranges
CAN_ID_PACK_SUMMARY = 0x500
CAN_ID_VOLTAGE_START = 0x510
CAN_ID_VOLTAGE_END = 0x518
CAN_ID_TEMP_START = 0x520
CAN_ID_TEMP_END = 0x528


# =============================================================================
# Data Parser
# =============================================================================
class BMSDataParser:
    """Parses CAN frames according to the BMS protocol"""

    def __init__(self, config: Config):
        self.config = config
        self.module_voltages: Dict[int, float] = {}
        self.module_temps: Dict[int, float] = {}
        self.pack_voltage: float = 0.0
        self.pack_current: float = 0.0
        self.pack_avg_temp: float = 0.0
        self.pack_soc: float = 0.0  # SOC not available from basic CAN frames; extend with BMS-specific CAN IDs
        self.pack_soh: float = 100.0  # SOH not available from basic CAN frames; default to 100%
        self.last_update = datetime.now(timezone.utc)

    def parse_frame(self, msg: can.Message) -> List[Point]:
        """
        Parse a CAN frame and return InfluxDB points.

        Args:
            msg: CAN message from python-can

        Returns:
            List of InfluxDB Point objects
        """
        points = []
        ts = datetime.now(timezone.utc)
        self.last_update = ts

        can_id = msg.arbitration_id
        data = msg.data

        if can_id == CAN_ID_PACK_SUMMARY:
            points.extend(self._parse_pack_summary(data, ts))

        elif CAN_ID_VOLTAGE_START <= can_id <= CAN_ID_VOLTAGE_END:
            frame_idx = can_id - CAN_ID_VOLTAGE_START  # 0-8
            points.extend(self._parse_module_voltages(data, frame_idx, ts))

        elif CAN_ID_TEMP_START <= can_id <= CAN_ID_TEMP_END:
            frame_idx = can_id - CAN_ID_TEMP_START  # 0-8
            points.extend(self._parse_module_temps(data, frame_idx, ts))

        return points

    def _parse_pack_summary(self, data: bytes, ts: datetime) -> List[Point]:
        """Parse 0x500 Pack Summary frame"""
        points = []

        if len(data) >= 6:
            # Pack Voltage: bytes 0-1, 0.1V/bit
            self.pack_voltage = struct.unpack('>H', data[0:2])[0] * 0.1

            # Pack Current: bytes 2-3, 0.1A/bit (signed for charge/discharge)
            self.pack_current = struct.unpack('>h', data[2:4])[0] * 0.1

            # Avg Temperature: bytes 4-5
            # Adjust scaling based on your BMS (could be 0.1C/bit or raw)
            raw_temp = struct.unpack('>H', data[4:6])[0]
            self.pack_avg_temp = raw_temp * 0.1 if raw_temp > 1000 else raw_temp

            # Calculate derived values
            power_kw = (self.pack_voltage * self.pack_current) / 1000.0

            # Find min/max from stored module data
            voltages = list(self.module_voltages.values())
            temps = list(self.module_temps.values())

            min_v = min(voltages) if voltages else 0
            max_v = max(voltages) if voltages else 0
            delta_v = (max_v - min_v) * 1000  # Convert to mV

            min_temp = min(temps) if temps else self.pack_avg_temp
            max_temp = max(temps) if temps else self.pack_avg_temp

            point = Point("pack_metrics") \
                .tag("pack_id", "pack_01") \
                .field("total_voltage", round(self.pack_voltage, 2)) \
                .field("current", round(self.pack_current, 2)) \
                .field("power_kw", round(power_kw, 3)) \
                .field("soc", self.pack_soc) \
                .field("soh", self.pack_soh) \
                .field("avg_temp", round(self.pack_avg_temp, 1)) \
                .field("min_temp", round(min_temp, 1)) \
                .field("max_temp", round(max_temp, 1)) \
                .field("min_cell_v", round(min_v, 3)) \
                .field("max_cell_v", round(max_v, 3)) \
                .field("delta_v_mv", round(delta_v, 1)) \
                .time(ts, WritePrecision.MS)

            points.append(point)
            logger.debug(f"Pack: {self.pack_voltage:.1f}V, {self.pack_current:.1f}A, {self.pack_avg_temp:.1f}C")

        return points

    def _parse_module_voltages(self, data: bytes, frame_idx: int, ts: datetime) -> List[Point]:
        """Parse 0x510-0x518 Module Voltage frames"""
        points = []
        base_module = frame_idx * 4  # 0, 4, 8, 12, ...

        for i in range(4):
            module_num = base_module + i + 1  # 1-indexed
            if module_num > self.config.num_modules:
                break

            byte_offset = i * 2
            if byte_offset + 1 < len(data):
                # 2 bytes per voltage, big-endian
                raw_voltage = struct.unpack('>H', data[byte_offset:byte_offset+2])[0]

                # Determine scaling (adjust based on your BMS)
                # Common: 0.001V/bit (mV) or 0.01V/bit
                if raw_voltage > 10000:
                    voltage = raw_voltage * 0.001  # mV to V
                elif raw_voltage > 1000:
                    voltage = raw_voltage * 0.01   # 0.01V/bit
                else:
                    voltage = raw_voltage * 0.1    # 0.1V/bit

                self.module_voltages[module_num] = voltage

                module_id = f"M{module_num:02d}"
                point = Point("module_metrics") \
                    .tag("pack_id", "pack_01") \
                    .tag("module_id", module_id) \
                    .field("voltage", round(voltage, 3)) \
                    .field("min_cell_v", round(voltage, 3)) \
                    .field("max_cell_v", round(voltage, 3)) \
                    .field("delta_v_mv", 0.0) \
                    .field("balancing_active", False) \
                    .time(ts, WritePrecision.MS)

                points.append(point)
                logger.debug(f"Module {module_num} Voltage: {voltage:.3f}V")

        return points

    def _parse_module_temps(self, data: bytes, frame_idx: int, ts: datetime) -> List[Point]:
        """Parse 0x520-0x528 Module Temperature frames"""
        points = []
        base_module = frame_idx * 4

        for i in range(4):
            module_num = base_module + i + 1
            if module_num > self.config.num_modules:
                break

            byte_offset = i * 2
            if byte_offset + 1 < len(data):
                raw_temp = struct.unpack('>H', data[byte_offset:byte_offset+2])[0]

                # Temperature scaling (adjust based on your BMS)
                # Could be: raw C, 0.1C/bit, or offset (e.g., -40C offset)
                if raw_temp > 1000:
                    temperature = raw_temp * 0.1  # 0.1C/bit
                elif raw_temp > 200:
                    temperature = raw_temp - 40   # Offset encoding
                else:
                    temperature = raw_temp        # Raw C

                self.module_temps[module_num] = temperature

                module_id = f"M{module_num:02d}"

                # Update module_metrics with temperature
                point = Point("module_metrics") \
                    .tag("pack_id", "pack_01") \
                    .tag("module_id", module_id) \
                    .field("avg_temp", round(temperature, 1)) \
                    .field("max_temp", round(temperature, 1)) \
                    .time(ts, WritePrecision.MS)

                points.append(point)
                logger.debug(f"Module {module_num} Temp: {temperature:.1f}C")

        return points

    def get_summary(self) -> str:
        """Return current state summary for logging"""
        return (
            f"Pack: {self.pack_voltage:.1f}V, {self.pack_current:.1f}A | "
            f"Modules: {len(self.module_voltages)}/35 voltages, "
            f"{len(self.module_temps)}/35 temps"
        )


# =============================================================================
# InfluxDB Writer
# =============================================================================
class InfluxDBWriter:
    """Batched writer for InfluxDB with retry and buffer management"""

    def __init__(self, config: Config):
        self.config = config
        self.client = None
        self.write_api = None
        self.buffer: List[Point] = []
        self.last_write = time.time()
        self._connect()

    def _connect(self):
        """Connect to InfluxDB with retry"""
        for attempt in range(10):
            try:
                self.client = InfluxDBClient(
                    url=self.config.influxdb_url,
                    token=self.config.influxdb_token,
                    org=self.config.influxdb_org
                )
                self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
                self.client.ping()
                logger.info("Connected to InfluxDB")
                return
            except Exception as e:
                delay = min(2.0 * (2 ** attempt), 60.0)
                logger.warning(f"InfluxDB connection attempt {attempt + 1}/10 failed: {e}")
                time.sleep(delay)
        raise ConnectionError("Could not connect to InfluxDB after all retries")

    def add_points(self, points: List[Point]):
        """Add points to buffer"""
        self.buffer.extend(points)

        # Flush if buffer is large enough or enough time has passed
        if (len(self.buffer) >= self.config.write_batch_size or
            time.time() - self.last_write >= self.config.write_interval):
            self.flush()

    def flush(self):
        """Write buffered points to InfluxDB with retry"""
        if not self.buffer:
            return

        for attempt in range(3):
            try:
                self.write_api.write(
                    bucket=self.config.influxdb_bucket,
                    record=self.buffer
                )
                logger.info(f"Wrote {len(self.buffer)} points to InfluxDB")
                self.buffer = []
                self.last_write = time.time()
                return
            except Exception as e:
                delay = min(1.0 * (2 ** attempt), 10.0)
                logger.warning(f"Write attempt {attempt + 1}/3 failed: {e}, retrying in {delay:.1f}s")
                time.sleep(delay)

        # All retries failed -- keep buffer but cap size
        logger.error(f"All write retries failed. Buffered points: {len(self.buffer)}")
        if len(self.buffer) > 5000:
            dropped = len(self.buffer) - 5000
            self.buffer = self.buffer[-5000:]
            logger.warning(f"Buffer overflow, dropped {dropped} oldest points")

    def close(self):
        """Flush remaining data and close connection"""
        self.flush()
        if self.client:
            self.client.close()


# =============================================================================
# CAN Bus Initialization
# =============================================================================
def _init_can_bus(config: Config):
    """Initialize CAN bus with retry"""
    max_retries = 10
    for attempt in range(max_retries):
        try:
            bus = can.interface.Bus(
                channel=config.can_interface,
                interface='socketcan'
            )
            logger.info(f"CAN bus initialized on {config.can_interface}")
            return bus
        except Exception as e:
            delay = min(2.0 * (2 ** attempt), 60.0)
            logger.warning(f"CAN init attempt {attempt + 1}/{max_retries} failed: {e}")
            logger.info(f"  Retrying in {delay:.1f}s...")
            if attempt == 0:
                logger.info(f"  Make sure CAN interface is up:")
                logger.info(f"  sudo ip link set {config.can_interface} up type can bitrate {config.can_bitrate}")
            time.sleep(delay)

    logger.error("Could not initialize CAN bus after all retries")
    return None


# =============================================================================
# Main Application
# =============================================================================
def main():
    config = Config()

    logger.info("=" * 60)
    logger.info("BMS CAN to InfluxDB Bridge")
    logger.info("=" * 60)
    logger.info(f"CAN Interface: {config.can_interface}")
    logger.info(f"InfluxDB URL: {config.influxdb_url}")
    logger.info(f"Bucket: {config.influxdb_bucket}")
    logger.info(f"Modules: {config.num_modules}")
    logger.info("=" * 60)

    # Initialize components
    parser = BMSDataParser(config)
    writer = InfluxDBWriter(config)

    # Initialize CAN bus
    bus = _init_can_bus(config)
    if bus is None:
        return 1

    # Main loop
    frame_count = 0
    last_status = time.time()

    try:
        logger.info("Listening for CAN frames... (Ctrl+C to stop)")

        while True:
            try:
                msg = bus.recv(timeout=5.0)
                if msg is None:
                    continue  # Timeout, no message received

                # Parse frame
                points = parser.parse_frame(msg)

                # Write to InfluxDB
                if points:
                    writer.add_points(points)
                    frame_count += len(points)

                # Periodic status update
                if time.time() - last_status >= 10:
                    logger.info(f"Status: {parser.get_summary()} | Points written: {frame_count}")
                    last_status = time.time()

            except can.CanError as e:
                logger.error(f"CAN bus error: {e}")
                logger.info("Attempting CAN bus reconnection...")
                try:
                    bus.shutdown()
                except Exception:
                    pass
                bus = _init_can_bus(config)
                if bus is None:
                    logger.error("CAN reconnection failed, exiting")
                    return 1

    except KeyboardInterrupt:
        logger.info("\nShutting down...")
    finally:
        writer.close()
        try:
            bus.shutdown()
        except Exception:
            pass
        logger.info("Cleanup complete")

    return 0


if __name__ == "__main__":
    exit(main())
