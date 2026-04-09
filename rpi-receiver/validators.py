"""JSON payload validation for ESP32 data."""

from config import MODULE_TOPOLOGY, VALID_MODULE_IDS, VALID_CONTACTOR_STATES, VALID_HEALTH_STATES


def validate_sensing(payload: dict) -> list:
    """Validate a sensing ESP payload. Returns list of error strings (empty = valid)."""
    errors = []

    module_id = payload.get("module_id")
    if module_id not in VALID_MODULE_IDS:
        errors.append(f"Invalid module_id: {module_id}. Expected one of {VALID_MODULE_IDS}")
        return errors

    topo = MODULE_TOPOLOGY[module_id]

    # Validate cells array
    cells = payload.get("cells")
    if not isinstance(cells, list):
        errors.append("'cells' must be an array")
    elif len(cells) != topo["num_cells"]:
        errors.append(f"Expected {topo['num_cells']} cells for {module_id}, got {len(cells)}")
    else:
        for i, v in enumerate(cells):
            if not isinstance(v, (int, float)):
                errors.append(f"cells[{i}] is not a number")
            elif v < 0.0 or v > 10.0:
                errors.append(f"cells[{i}] voltage {v}V out of range [0.0, 10.0]")

    # Validate temps array
    temps = payload.get("temps")
    if not isinstance(temps, list):
        errors.append("'temps' must be an array")
    elif len(temps) != topo["num_temps"]:
        errors.append(f"Expected {topo['num_temps']} temps for {module_id}, got {len(temps)}")
    else:
        for i, t in enumerate(temps):
            if not isinstance(t, (int, float)):
                errors.append(f"temps[{i}] is not a number")
            elif t < -999 or t > 300:
                errors.append(f"temps[{i}] temperature {t}C out of range [-999, 300]")

    # Optional wireless / electrical fields — validate type only if present
    for field, lo, hi in [
        ("current",     -500.0,  500.0),
        ("rssi",        -120.0,    0.0),
        ("packet_loss",    0.0,  100.0),
        ("latency_ms",     0.0, 60000.0),
    ]:
        val = payload.get(field)
        if val is not None:
            if not isinstance(val, (int, float)):
                errors.append(f"'{field}' must be a number")
            elif not (lo <= val <= hi):
                errors.append(f"'{field}' value {val} out of range [{lo}, {hi}]")

    return errors


def validate_master(payload: dict) -> list:
    """Validate a master ESP payload. Returns list of error strings (empty = valid)."""
    errors = []

    # Validate contactors
    contactors = payload.get("contactors")
    if not isinstance(contactors, dict):
        errors.append("'contactors' must be an object")
    else:
        for key in ["positive", "negative", "precharge"]:
            state = contactors.get(key)
            if state not in VALID_CONTACTOR_STATES:
                errors.append(f"contactors.{key} = '{state}' is not valid. Expected {VALID_CONTACTOR_STATES}")

    # Validate module_health — null values are allowed (module not yet seen)
    module_health = payload.get("module_health")
    if not isinstance(module_health, dict):
        errors.append("'module_health' must be an object")
    else:
        for mod_id, status in module_health.items():
            if mod_id not in VALID_MODULE_IDS:
                errors.append(f"module_health key '{mod_id}' is not a valid module ID")
            if status is not None and status not in VALID_HEALTH_STATES:
                errors.append(f"module_health.{mod_id} = '{status}' is not valid. Expected {VALID_HEALTH_STATES} or null")

    return errors
