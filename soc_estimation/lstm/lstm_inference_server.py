"""
LSTM SOC Inference Server

Flask REST API that loads the trained LSTM model once at startup
and serves SOC predictions.

Endpoints:
    POST /predict  {"voltage": [...30], "current": [...30], "temperature": [...30]}
                   -> {"soc": float, "model": "lstm_v1"}
    GET  /health   -> {"status": "healthy", "model_loaded": bool, "param_count": int}

Usage:
    python lstm_inference_server.py
"""

import os
import json
import logging
import numpy as np
from pathlib import Path
from flask import Flask, request, jsonify
import tensorflow as tf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Globals set at startup
_model = None
_scaler_params = None
_param_count = 0

# Paths (overridable via environment variables)
MODEL_PATH = os.environ.get("MODEL_PATH", "/app/model/lstm_soc_model.keras")
SCALER_PATH = os.environ.get("SCALER_PATH", "/app/model/scaler_params.json")
SEQUENCE_LEN = 30


def load_artifacts():
    """Load model and scaler at startup."""
    global _model, _scaler_params, _param_count

    logger.info(f"Loading model from {MODEL_PATH}")
    _model = tf.keras.models.load_model(MODEL_PATH)
    _param_count = _model.count_params()
    logger.info(f"Model loaded. Parameters: {_param_count}")

    logger.info(f"Loading scaler from {SCALER_PATH}")
    with open(SCALER_PATH) as f:
        _scaler_params = json.load(f)
    logger.info("Scaler loaded.")


def normalize_feature(values: list, feature: str) -> np.ndarray:
    """Normalize a list of raw values to [0, 1] using scaler params."""
    arr = np.array(values, dtype=np.float32)
    fmin = _scaler_params[feature]["min"]
    fmax = _scaler_params[feature]["max"]
    return (arr - fmin) / (fmax - fmin + 1e-8)


def denormalize_soc(soc_norm: float) -> float:
    """Convert normalized SOC back to percentage."""
    soc_min = _scaler_params["soc"]["min"]
    soc_max = _scaler_params["soc"]["max"]
    return float(soc_norm * (soc_max - soc_min) + soc_min)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": _model is not None,
        "param_count": _param_count,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if _model is None:
        return jsonify({"error": "Model not loaded"}), 503

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON body"}), 400

    # Validate required fields
    for field in ["voltage", "current", "temperature"]:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400
        if not isinstance(data[field], list):
            return jsonify({"error": f"Field '{field}' must be a list"}), 400
        if len(data[field]) != SEQUENCE_LEN:
            return jsonify({"error": f"Field '{field}' must have {SEQUENCE_LEN} values, got {len(data[field])}"}), 400

    # Normalize inputs
    v_norm = normalize_feature(data["voltage"], "voltage")
    i_norm = normalize_feature(data["current"], "current")
    t_norm = normalize_feature(data["temperature"], "temperature")

    # Build input tensor: shape (1, T, 3)
    seq = np.stack([v_norm, i_norm, t_norm], axis=-1)[np.newaxis, ...]  # (1, 30, 3)

    # Run inference
    pred_norm = float(_model.predict(seq, verbose=0)[0, 0])
    pred_norm = float(np.clip(pred_norm, 0.0, 1.0))
    soc_pct = round(denormalize_soc(pred_norm), 2)
    soc_pct = max(0.0, min(100.0, soc_pct))

    return jsonify({"soc": soc_pct, "model": "lstm_v1"})


if __name__ == "__main__":
    load_artifacts()
    port = int(os.environ.get("PORT", 5001))
    logger.info(f"Starting LSTM SOC inference server on port {port}")
    app.run(host="0.0.0.0", port=port)
