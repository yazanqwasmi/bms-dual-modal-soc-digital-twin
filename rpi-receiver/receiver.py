#!/usr/bin/env python3
"""
RPi Wi-Fi Receiver
==================
Flask HTTP server that receives JSON from ESP32 boards over Wi-Fi,
validates payloads, and writes to InfluxDB.

Endpoints:
  POST /api/sensing  — Receive sensing ESP data (cell voltages + temps)
  POST /api/master   — Receive master ESP data (contactors + module health)
  GET  /health       — Service health check
"""

import logging
from flask import Flask, request, jsonify

from config import Config
from validators import validate_sensing, validate_master
from influx_writer import InfluxWriter

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
config = Config()
writer = InfluxWriter(config)


@app.route('/health', methods=['GET'])
def health():
    esp_status = writer.get_esp_status()
    return jsonify({
        "status": "healthy",
        "esp_boards": esp_status,
    })


@app.route('/api/sensing', methods=['POST'])
def receive_sensing():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON"}), 400

    errors = validate_sensing(payload)
    if errors:
        logger.warning(f"Sensing validation failed: {errors}")
        return jsonify({"errors": errors}), 422

    try:
        writer.write_sensing_data(payload)
        logger.info(f"Sensing data written for {payload['module_id']}: {len(payload['cells'])} cells")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Failed to write sensing data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/master', methods=['POST'])
def receive_master():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON"}), 400

    errors = validate_master(payload)
    if errors:
        logger.warning(f"Master validation failed: {errors}")
        return jsonify({"errors": errors}), 422

    try:
        writer.write_master_data(payload)
        contactors = payload["contactors"]
        logger.info(f"Master data written: +{contactors['positive']}/{contactors['negative']}/P{contactors['precharge']}")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Failed to write master data: {e}")
        return jsonify({"error": str(e)}), 500


def main():
    logger.info("Starting RPi Wi-Fi Receiver...")
    logger.info(f"  InfluxDB: {config.influxdb_url}")
    logger.info(f"  Listening on port {config.listen_port}")

    writer.connect()

    app.run(
        host='0.0.0.0',
        port=config.listen_port,
        debug=False,
    )


if __name__ == '__main__':
    main()
