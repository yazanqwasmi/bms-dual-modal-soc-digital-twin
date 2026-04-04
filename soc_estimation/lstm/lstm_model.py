"""
LSTM SOC Estimation Model — Training and Evaluation

Architecture: LSTM(24 units) -> Dense(1, linear)
Total parameters: 2,713 (within 2000-3000 cloud budget)

Usage:
    python -m soc_estimation.lstm.lstm_model
"""

import sys
import logging
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import tensorflow as tf
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from soc_estimation.data.preprocess import prepare_all_data, load_scaler_params

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

LSTM_DIR = Path(__file__).resolve().parent
LSTM_T = 30   # sequence length


def build_lstm_model(seq_len: int = 30, n_features: int = 3) -> tf.keras.Model:
    """Build LSTM model: LSTM(24) -> Dense(1, linear)."""
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(24, input_shape=(seq_len, n_features), name="lstm"),
        tf.keras.layers.Dense(1, activation="linear", name="output"),
    ])
    return model


def plot_results(true_pct, pred_pct, rmse, mae, max_error, save_path):
    """Plot predicted vs actual SOC and absolute error."""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), gridspec_kw={"height_ratios": [3, 1]})

    n = len(true_pct)
    step = max(1, n // 10000)
    idx = np.arange(0, n, step)

    ax1.plot(idx, true_pct[idx], label="True SOC", linewidth=0.8, alpha=0.8)
    ax1.plot(idx, pred_pct[idx], label="Predicted SOC", linewidth=0.8, alpha=0.8)
    ax1.set_ylabel("SOC (%)")
    ax1.set_title(
        f"LSTM SOC Estimation\n"
        f"RMSE={rmse:.2f}%  MAE={mae:.2f}%  MaxErr={max_error:.2f}%"
    )
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    error = np.abs(true_pct[idx] - pred_pct[idx])
    ax2.plot(idx, error, linewidth=0.5, color="red", alpha=0.7)
    ax2.set_ylabel("Absolute Error (%)")
    ax2.set_xlabel("Sample Index")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info(f"Results plot saved to {save_path}")


def main():
    logger.info("=== LSTM SOC Model Training ===")

    # Prepare data
    logger.info("Loading and preprocessing data...")
    data = prepare_all_data(lstm_T=LSTM_T)

    X_train, y_train = data["lstm_train"]
    X_val, y_val = data["lstm_val"]
    X_test, y_test = data["lstm_test"]
    scaler_params = data["scaler_params"]

    logger.info(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    # Build model
    model = build_lstm_model(seq_len=LSTM_T, n_features=3)
    model.summary()

    param_count = model.count_params()
    logger.info(f"Total parameters: {param_count}")
    assert 2000 <= param_count <= 3000, f"Parameter count {param_count} outside [2000, 3000] range!"

    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"],
    )

    # Train
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=15, restore_best_weights=True, verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=7, verbose=1
        ),
    ]

    logger.info("Training LSTM model...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=150,
        batch_size=128,
        callbacks=callbacks,
        verbose=1,
    )

    # Save model
    model_path = LSTM_DIR / "lstm_soc_model.keras"
    model.save(model_path)
    logger.info(f"Model saved to {model_path}")

    # Evaluate on test set
    logger.info("=== Test Set Evaluation ===")
    y_pred = model.predict(X_test, verbose=0).flatten()
    y_pred = np.clip(y_pred, 0.0, 1.0)

    soc_min = scaler_params["soc"]["min"]
    soc_max = scaler_params["soc"]["max"]
    true_pct = y_test * (soc_max - soc_min) + soc_min
    pred_pct = y_pred * (soc_max - soc_min) + soc_min

    rmse = float(np.sqrt(np.mean((true_pct - pred_pct) ** 2)))
    mae = float(np.mean(np.abs(true_pct - pred_pct)))
    max_err = float(np.max(np.abs(true_pct - pred_pct)))

    logger.info(f"RMSE:    {rmse:.3f}%")
    logger.info(f"MAE:     {mae:.3f}%")
    logger.info(f"MaxErr:  {max_err:.3f}%")

    # Plot
    plot_path = LSTM_DIR / "lstm_results.png"
    plot_results(true_pct, pred_pct, rmse, mae, max_err, plot_path)

    logger.info("=== LSTM Training Complete ===")
    logger.info(f"Parameter count: {param_count}")
    logger.info(f"RMSE: {rmse:.3f}%  MAE: {mae:.3f}%  MaxErr: {max_err:.3f}%")


if __name__ == "__main__":
    main()
