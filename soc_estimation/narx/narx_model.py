"""
NARX SOC Estimation Model — Training and Evaluation

Architecture: 18 -> 16 (ReLU) -> 8 (ReLU) -> 1 (linear)
Total parameters: 449 (within 200-800 ESP32 budget)

Usage:
    python -m soc_estimation.narx.narx_model
"""

import os
import sys
import logging
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import tensorflow as tf
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from soc_estimation.data.preprocess import prepare_all_data, load_scaler_params

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

NARX_DIR = Path(__file__).resolve().parent
NARX_N = 5   # sensor window size
NARX_M = 3   # SOC feedback length (teacher-forced; reset from cloud LSTM on each RPi update)


def build_narx_model(input_dim: int = 18) -> tf.keras.Model:
    """Build NARX feedforward model: 18 -> 16 -> 8 -> 1."""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(16, activation="relu", name="dense1"),
        tf.keras.layers.Dense(8, activation="relu", name="dense2"),
        tf.keras.layers.Dense(1, activation="linear", name="output"),
    ])
    return model


@tf.function(reduce_retracing=True)
def _model_call(model, x):
    return model(x, training=False)


def free_running_eval(
    model: tf.keras.Model,
    test_df_norm,
    scaler_params: dict,
    N: int = 5,
    M: int = 3,
) -> dict:
    """
    Evaluate NARX in free-running mode on the test set.

    Instead of using ground-truth SOC for the feedback slots,
    uses the model's own previous predictions (autoregressive).
    Returns metrics and predictions for plotting.
    """
    all_true = []
    all_pred = []

    for (cycle, cell_id), group in test_df_norm.groupby(["cycle", "cell_id"]):
        v = group["voltage"].values
        i = group["current"].values
        t = group["temperature"].values
        s = group["soc"].values

        if len(group) <= max(N, M):
            continue

        # Initialize SOC feedback buffer with ground-truth
        soc_buf = list(s[:M])
        preds = list(s[:M])  # first M values are ground-truth

        for idx in range(max(N, M), len(group)):
            v_win = v[idx - N + 1: idx + 1]
            i_win = i[idx - N + 1: idx + 1]
            t_win = t[idx - N + 1: idx + 1]
            soc_fb = np.array(soc_buf[-M:])

            x = tf.constant(
                np.concatenate([v_win, i_win, t_win, soc_fb]).reshape(1, -1),
                dtype=tf.float32,
            )
            pred = float(_model_call(model, x)[0, 0])
            pred = max(0.0, min(1.0, pred))

            soc_buf.append(pred)
            preds.append(pred)

        true_vals = s[:len(preds)]
        all_true.extend(true_vals)
        all_pred.extend(preds)

    all_true = np.array(all_true)
    all_pred = np.array(all_pred)

    # Denormalize to percentage
    soc_min = scaler_params["soc"]["min"]
    soc_max = scaler_params["soc"]["max"]
    true_pct = all_true * (soc_max - soc_min) + soc_min
    pred_pct = all_pred * (soc_max - soc_min) + soc_min

    rmse = np.sqrt(np.mean((true_pct - pred_pct) ** 2))
    mae = np.mean(np.abs(true_pct - pred_pct))
    max_err = np.max(np.abs(true_pct - pred_pct))

    return {
        "true_pct": true_pct,
        "pred_pct": pred_pct,
        "rmse": rmse,
        "mae": mae,
        "max_error": max_err,
    }


def plot_results(true_pct, pred_pct, rmse, mae, max_error, save_path):
    """Plot predicted vs actual SOC and error."""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), gridspec_kw={"height_ratios": [3, 1]})

    # Subsample for plotting if too many points
    n = len(true_pct)
    step = max(1, n // 10000)
    idx = np.arange(0, n, step)

    ax1.plot(idx, true_pct[idx], label="True SOC", linewidth=0.8, alpha=0.8)
    ax1.plot(idx, pred_pct[idx], label="Predicted SOC", linewidth=0.8, alpha=0.8)
    ax1.set_ylabel("SOC (%)")
    ax1.set_title(f"NARX SOC Estimation (Free-Running)\nRMSE={rmse:.2f}%  MAE={mae:.2f}%  MaxErr={max_error:.2f}%")
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
    logger.info("=== NARX SOC Model Training ===")

    # Prepare data
    logger.info("Loading and preprocessing data...")
    data = prepare_all_data(narx_N=NARX_N, narx_M=NARX_M)

    X_train, y_train = data["narx_train"]
    X_val, y_val = data["narx_val"]
    X_test, y_test = data["narx_test"]
    scaler_params = data["scaler_params"]
    test_df_norm = data["test_df_norm"]

    logger.info(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    # Build model
    model = build_narx_model(input_dim=X_train.shape[1])
    model.summary()

    param_count = model.count_params()
    logger.info(f"Total parameters: {param_count}")
    assert param_count <= 800, f"Parameter count {param_count} exceeds 800 limit!"

    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"],
    )

    X_train_noisy = X_train

    # Train with teacher forcing
    logger.info("Training NARX model (teacher forcing; SOC buffer reset from cloud LSTM on each update)...")
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=10, restore_best_weights=True, verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5, verbose=1
        ),
    ]

    history = model.fit(
        X_train_noisy, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=256,
        callbacks=callbacks,
        verbose=1,
    )

    # Save model
    model_path = NARX_DIR / "narx_soc_model.keras"
    model.save(model_path)
    logger.info(f"Model saved to {model_path}")

    # Teacher-forced evaluation on test set
    logger.info("=== Teacher-Forced Evaluation ===")
    y_pred_tf = model.predict(X_test, verbose=0).flatten()
    y_pred_tf = np.clip(y_pred_tf, 0.0, 1.0)

    soc_min = scaler_params["soc"]["min"]
    soc_max = scaler_params["soc"]["max"]
    true_pct = y_test * (soc_max - soc_min) + soc_min
    pred_pct = y_pred_tf * (soc_max - soc_min) + soc_min

    rmse_tf = np.sqrt(np.mean((true_pct - pred_pct) ** 2))
    mae_tf = np.mean(np.abs(true_pct - pred_pct))
    max_err_tf = np.max(np.abs(true_pct - pred_pct))
    logger.info(f"Teacher-Forced — RMSE: {rmse_tf:.3f}%, MAE: {mae_tf:.3f}%, MaxErr: {max_err_tf:.3f}%")

    # Free-running evaluation
    logger.info("=== Free-Running Evaluation ===")
    fr_results = free_running_eval(model, test_df_norm, scaler_params, N=NARX_N, M=NARX_M)
    logger.info(f"Free-Running — RMSE: {fr_results['rmse']:.3f}%, MAE: {fr_results['mae']:.3f}%, MaxErr: {fr_results['max_error']:.3f}%")

    # Plot free-running results
    plot_path = NARX_DIR / "narx_results.png"
    plot_results(
        fr_results["true_pct"],
        fr_results["pred_pct"],
        fr_results["rmse"],
        fr_results["mae"],
        fr_results["max_error"],
        plot_path,
    )

    logger.info("=== NARX Training Complete ===")
    logger.info(f"Parameter count: {param_count} (limit: 800)")
    logger.info(f"Teacher-Forced — RMSE: {rmse_tf:.3f}%, MAE: {mae_tf:.3f}%")
    logger.info(f"Free-Running   — RMSE: {fr_results['rmse']:.3f}%, MAE: {fr_results['mae']:.3f}%")


if __name__ == "__main__":
    main()
