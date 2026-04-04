"""
Shared preprocessing pipeline for SOC estimation models.

Handles data loading from LG-E66 Module Data-AVL dataset,
cleaning, normalization, train/val/test splitting, and
sliding window creation for NARX and LSTM models.

Usage:
    python -m soc_estimation.data.preprocess
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Tuple, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = PROJECT_ROOT / "LG-E66 Module Data-AVL"
CACHE_DIR = PROJECT_ROOT / "soc_estimation" / "data" / "cache"
SCALER_PATH = PROJECT_ROOT / "soc_estimation" / "shared" / "scaler_params.json"

# Temperature column resolution per cycle folder
TEMP_COLUMN_MAP = {
    "US06 25C": "High Temperature",
    "HWFET 25C": "High Temperature",
    "HWGRADE 25C": "High Temperature",
    "HWCUST 25C": "High Temperature",
    "HWGRADE 0C": "CP7 (cooling plate)",
    "US06 0C": "CP7",
}

# File naming patterns per cycle
FILE_PREFIX_MAP = {
    "US06 25C": "US06_PerCell{}_withBreak.xlsx",
    "HWFET 25C": "HWFET_PerCell{}_withBreak.xlsx",
    "HWGRADE 25C": "HWGRADE_PerCell{}_withBreak.xlsx",
    "HWCUST 25C": "HWCUST_PerCell{}_withBreak.xlsx",
    "HWGRADE 0C": "0C_HWGRADE_PerCell{}_withBreak.xlsx",
    "US06 0C": "0C_US06_PerCell{}_withBreak.xlsx",
}

# Train/Val/Test split definition (cycle_name, cell_ids)
# Training includes 4 of 6 drive-cycle types at both temperatures for maximum diversity.
# Test holds out HWFET (longest highway profile) as the true out-of-distribution check.
SPLIT_DEF = {
    "train": [
        ("US06 25C",   [1, 2, 3, 4, 5, 6]),  # aggressive urban, 25C
        ("US06 0C",    [1, 2, 3, 4]),          # aggressive urban, 0C
        ("HWGRADE 0C", [1, 2, 3, 4]),          # grade profile, 0C
        ("HWCUST 25C", [1, 2, 3, 4]),          # custom profile, 25C
        ("HWGRADE 25C",[1, 2, 3]),             # grade profile, 25C
    ],
    "val": [
        ("HWGRADE 0C", [5, 6]),                # held-out cells from grade 0C
        ("HWCUST 25C", [5, 6]),                # held-out cells from custom 25C
        ("US06 0C",    [5, 6]),                # held-out cells from US06 0C
        ("HWGRADE 25C",[4, 5]),               # held-out cells from grade 25C
    ],
    "test": [
        ("HWFET 25C",  [1, 2, 3, 4, 5, 6]),   # highway profile — completely unseen drive cycle
        ("HWGRADE 25C",[6]),                   # one held-out cell
    ],
}


def load_cell_file(cycle_name: str, cell_id: int) -> pd.DataFrame:
    """Load a single cell Excel file and return a standardized DataFrame."""
    filename = FILE_PREFIX_MAP[cycle_name].format(cell_id)
    filepath = DATASET_DIR / cycle_name / filename
    temp_col = TEMP_COLUMN_MAP[cycle_name]

    df = pd.read_excel(filepath)

    # SOC and cell-voltage columns are numbered per cell (e.g. Cell_SOC_2_pct for cell 2)
    soc_col = f"Cell_SOC_{cell_id}_pct"

    # Select and rename to uniform schema
    result = pd.DataFrame({
        "time_s": df["RecordingTime"].values,
        "voltage": df["ACT_U"].values.astype(np.float32),
        "current": df["ACT_I"].values.astype(np.float32),
        "temperature": df[temp_col].values.astype(np.float32),
        "soc": df[soc_col].values.astype(np.float32),
    })
    result["cycle"] = cycle_name
    result["cell_id"] = cell_id
    return result


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean voltage anomalies and clamp SOC."""
    n_before = len(df)

    # Filter voltage anomalies
    mask = (df["voltage"] >= 2.0) & (df["voltage"] <= 30.0)
    df = df[mask].copy()

    n_filtered = n_before - len(df)
    if n_filtered > 0:
        logger.info(f"  Filtered {n_filtered} voltage anomaly rows")

    # Clamp SOC to [0, 100]
    n_over = (df["soc"] > 100).sum()
    n_under = (df["soc"] < 0).sum()
    df["soc"] = df["soc"].clip(0, 100)
    if n_over > 0 or n_under > 0:
        logger.info(f"  Clamped SOC: {n_over} over 100%, {n_under} under 0%")

    # Forward-fill any gaps from filtering
    df = df.reset_index(drop=True)
    return df


def load_split(split_name: str, use_cache: bool = True) -> pd.DataFrame:
    """Load all files for a given split (train/val/test)."""
    cache_path = CACHE_DIR / f"{split_name}.parquet"

    if use_cache and cache_path.exists():
        logger.info(f"Loading {split_name} from cache: {cache_path}")
        return pd.read_parquet(cache_path)

    dfs = []
    for cycle_name, cell_ids in SPLIT_DEF[split_name]:
        for cell_id in cell_ids:
            logger.info(f"Loading {split_name}: {cycle_name} cell {cell_id}")
            df = load_cell_file(cycle_name, cell_id)
            df = clean_data(df)
            dfs.append(df)

    result = pd.concat(dfs, ignore_index=True)
    logger.info(f"{split_name}: {len(result)} samples from {len(dfs)} files")

    # Cache as parquet
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    result.to_parquet(cache_path, index=False)
    logger.info(f"Cached to {cache_path}")

    return result


def fit_scaler(train_df: pd.DataFrame) -> Dict:
    """Fit MinMax scaler on training data and return parameters."""
    features = ["voltage", "current", "temperature"]
    scaler_params = {}

    for feat in features:
        scaler_params[feat] = {
            "min": float(train_df[feat].min()),
            "max": float(train_df[feat].max()),
        }

    # SOC normalization: always [0, 100]
    scaler_params["soc"] = {"min": 0.0, "max": 100.0}

    return scaler_params


def save_scaler_params(params: Dict, path: Optional[Path] = None):
    """Save scaler parameters to JSON."""
    path = path or SCALER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(params, f, indent=2)
    logger.info(f"Scaler params saved to {path}")


def load_scaler_params(path: Optional[Path] = None) -> Dict:
    """Load scaler parameters from JSON."""
    path = path or SCALER_PATH
    with open(path) as f:
        return json.load(f)


def normalize(df: pd.DataFrame, scaler_params: Dict) -> pd.DataFrame:
    """Normalize features to [0, 1] using scaler parameters."""
    df = df.copy()
    for feat in ["voltage", "current", "temperature", "soc"]:
        fmin = scaler_params[feat]["min"]
        fmax = scaler_params[feat]["max"]
        df[feat] = (df[feat] - fmin) / (fmax - fmin + 1e-8)
    return df


def create_narx_windows(
    df: pd.DataFrame, N: int = 5, M: int = 3
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create NARX input windows with teacher forcing.

    For each timestep t:
      X = [V(t-N+1)..V(t), I(t-N+1)..I(t), T(t-N+1)..T(t), SOC(t-M)..SOC(t-1)]
      y = SOC(t)

    Windows never span cell/cycle boundaries.
    Input shape: (samples, N*3 + M) = (samples, 18) flattened

    Args:
        df: Normalized DataFrame with columns [voltage, current, temperature, soc, cycle, cell_id]
        N: Number of past timesteps for sensor features
        M: Number of past SOC values for autoregressive feedback
    """
    window_size = max(N, M)
    X_list = []
    y_list = []

    # Process each cell sequence independently
    for (cycle, cell_id), group in df.groupby(["cycle", "cell_id"]):
        v = group["voltage"].values
        i = group["current"].values
        t = group["temperature"].values
        s = group["soc"].values

        for idx in range(window_size, len(group)):
            # Sensor features: last N timesteps
            v_win = v[idx - N + 1: idx + 1]
            i_win = i[idx - N + 1: idx + 1]
            t_win = t[idx - N + 1: idx + 1]
            # SOC feedback: last M ground-truth values (teacher forcing)
            soc_fb = s[idx - M: idx]

            x = np.concatenate([v_win, i_win, t_win, soc_fb])
            X_list.append(x)
            y_list.append(s[idx])

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    logger.info(f"NARX windows: X={X.shape}, y={y.shape}")
    return X, y


def create_lstm_sequences(
    df: pd.DataFrame, T: int = 30
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create LSTM input sequences.

    For each timestep t:
      X = [[V(t-T+1), I(t-T+1), T(t-T+1)], ..., [V(t), I(t), T(t)]]
      y = SOC(t)

    Windows never span cell/cycle boundaries.
    Input shape: (samples, T, 3)

    Args:
        df: Normalized DataFrame with columns [voltage, current, temperature, soc, cycle, cell_id]
        T: Sequence length (number of past timesteps)
    """
    X_list = []
    y_list = []

    for (cycle, cell_id), group in df.groupby(["cycle", "cell_id"]):
        v = group["voltage"].values
        i = group["current"].values
        t = group["temperature"].values
        s = group["soc"].values

        for idx in range(T, len(group)):
            seq = np.stack([
                v[idx - T + 1: idx + 1],
                i[idx - T + 1: idx + 1],
                t[idx - T + 1: idx + 1],
            ], axis=-1)  # shape (T, 3)
            X_list.append(seq)
            y_list.append(s[idx])

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    logger.info(f"LSTM sequences: X={X.shape}, y={y.shape}")
    return X, y


def prepare_all_data(
    narx_N: int = 5, narx_M: int = 3, lstm_T: int = 30
) -> Dict:
    """
    Full preprocessing pipeline: load, clean, normalize, window.

    Returns dict with keys:
        narx_train, narx_val, narx_test: (X, y) tuples
        lstm_train, lstm_val, lstm_test: (X, y) tuples
        scaler_params: dict
    """
    # Load splits
    train_df = load_split("train")
    val_df = load_split("val")
    test_df = load_split("test")

    logger.info(f"Split sizes — train: {len(train_df)}, val: {len(val_df)}, test: {len(test_df)}")

    # Fit scaler on training data only
    scaler_params = fit_scaler(train_df)
    save_scaler_params(scaler_params)
    logger.info(f"Scaler params: {json.dumps(scaler_params, indent=2)}")

    # Normalize all splits
    train_norm = normalize(train_df, scaler_params)
    val_norm = normalize(val_df, scaler_params)
    test_norm = normalize(test_df, scaler_params)

    # Create windows
    logger.info("Creating NARX windows...")
    narx_train = create_narx_windows(train_norm, N=narx_N, M=narx_M)
    narx_val = create_narx_windows(val_norm, N=narx_N, M=narx_M)
    narx_test = create_narx_windows(test_norm, N=narx_N, M=narx_M)

    logger.info("Creating LSTM sequences...")
    lstm_train = create_lstm_sequences(train_norm, T=lstm_T)
    lstm_val = create_lstm_sequences(val_norm, T=lstm_T)
    lstm_test = create_lstm_sequences(test_norm, T=lstm_T)

    return {
        "narx_train": narx_train,
        "narx_val": narx_val,
        "narx_test": narx_test,
        "lstm_train": lstm_train,
        "lstm_val": lstm_val,
        "lstm_test": lstm_test,
        "scaler_params": scaler_params,
        # Keep raw normalized test data for free-running NARX evaluation
        "test_df_norm": test_norm,
    }


if __name__ == "__main__":
    logger.info("=== SOC Estimation Data Preprocessing ===")
    logger.info(f"Dataset directory: {DATASET_DIR}")

    # Log split assignments
    for split_name, assignments in SPLIT_DEF.items():
        cycles = [f"{c} cells {cids}" for c, cids in assignments]
        logger.info(f"{split_name}: {', '.join(cycles)}")

    data = prepare_all_data()

    for key in ["narx_train", "narx_val", "narx_test", "lstm_train", "lstm_val", "lstm_test"]:
        X, y = data[key]
        logger.info(f"{key}: X={X.shape}, y={y.shape}")

    logger.info("Preprocessing complete.")
