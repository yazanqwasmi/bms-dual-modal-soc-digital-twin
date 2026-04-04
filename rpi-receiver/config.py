"""Configuration for the RPi Wi-Fi Receiver."""

import os
import sys
from dataclasses import dataclass, field


def _require_env(name, default=None):
    value = os.getenv(name, default)
    if value is None:
        print(f"ERROR: Required environment variable {name} is not set")
        sys.exit(1)
    return value


def _influx_token():
    token = os.getenv("INFLUXDB_TOKEN") or os.getenv("INFLUXDB_ADMIN_TOKEN")
    if token is None:
        print("ERROR: Required environment variable INFLUXDB_TOKEN or INFLUXDB_ADMIN_TOKEN is not set")
        sys.exit(1)
    return token


MODULE_TOPOLOGY = {
    "M01": {"num_cells": 5, "num_temps": 2, "cell_offset": 0},
    "M02": {"num_cells": 5, "num_temps": 2, "cell_offset": 5},
    "M03": {"num_cells": 4, "num_temps": 2, "cell_offset": 10},
}

VALID_MODULE_IDS = set(MODULE_TOPOLOGY.keys())
VALID_CONTACTOR_STATES = {"Open", "Closed"}
VALID_HEALTH_STATES = {"Healthy", "Unhealthy"}


@dataclass
class Config:
    influxdb_url: str = field(default_factory=lambda: _require_env("INFLUXDB_URL", "http://localhost:8086"))
    influxdb_token: str = field(default_factory=_influx_token)
    influxdb_org: str = field(default_factory=lambda: _require_env("INFLUXDB_ORG", "bms-org"))
    influxdb_bucket: str = field(default_factory=lambda: _require_env("INFLUXDB_BUCKET", "bms-telemetry"))
    listen_port: int = field(default_factory=lambda: int(os.getenv("LISTEN_PORT", "5000")))
    pack_id: str = "pack_01"
