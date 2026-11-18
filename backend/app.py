import atexit
import json
import logging
import math
import os
import random
import threading
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from solvers.distance import build_distance_matrix
from solvers.runner import SOLVERS, timed_run

logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # body request maks. 1 MB

# CORS: default hanya localhost (dev). Untuk produksi set CORS_ORIGINS, mis.
# CORS_ORIGINS="https://vrp.contoh.ac.id,https://www.contoh.ac.id"
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
_cors_origins = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else [r"http://(localhost|127\.0\.0\.1)(:\d+)?"]
)
CORS(app, origins=_cors_origins)

DATASET_PATH = os.path.join(
    os.path.dirname(__file__), "data", "dataset_31_kecamatan_indramayu.json"
)

# ---- Batas keamanan & performa (bisa diubah lewat environment variable) ----
MAX_LOCATIONS = int(os.environ.get("VRP_MAX_LOCATIONS", 100))
MAX_GENERATIONS = int(os.environ.get("VRP_MAX_GENERATIONS", 1000))
MAX_POP_SIZE = int(os.environ.get("VRP_MAX_POP_SIZE", 300))
MAX_EVALUATIONS = int(os.environ.get("VRP_MAX_EVALUATIONS", 60000))  # generasi x populasi
MAX_VEHICLES = 50
MAX_CAPACITY = 1_000_000
ALGORITHMS = ("GA", "ABC", "HYBRID", "BENCHMARK")
POOL_WORKERS = 3


class ValidationError(ValueError):
    """Input dari klien tidak valid (dibalas HTTP 400)."""


# --------------------------------------------------------------------------
# Process pool: komputasi berjalan di proses terpisah sehingga (1) benchmark
# benar-benar paralel (tidak terkena GIL) dan (2) server tetap responsif.
# --------------------------------------------------------------------------
_executor = None
_executor_lock = threading.Lock()


def _get_executor() -> ProcessPoolExecutor:
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ProcessPoolExecutor(max_workers=POOL_WORKERS)
        return _executor


def _reset_executor() -> None:
    global _executor
    with _executor_lock:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
            _executor = None


atexit.register(_reset_executor)


def _run_solvers(algorithms, locations, params, dist_matrix, customer_indices, depot_idx, seed):
    """Jalankan satu/lebih solver. Mengembalikan dict {algoritma: hasil}."""
    args = (locations, params, dist_matrix, customer_indices, depot_idx, seed)
    try:
        executor = _get_executor()
        futures = {alg: executor.submit(timed_run, alg, *args) for alg in algorithms}
        return {alg: fut.result() for alg, fut in futures.items()}
    except (BrokenProcessPool, OSError, RuntimeError):
        # Fallback: lingkungan yang tidak mengizinkan proses anak -> sekuensial.
        logger.exception("Process pool gagal, beralih ke eksekusi sekuensial")
        _reset_executor()
        return {alg: timed_run(alg, *args) for alg in algorithms}


# --------------------------------------------------------------------------
# Validasi input
# --------------------------------------------------------------------------
def _number(value, name, lo, hi, integer=False):
    if isinstance(value, bool) or value is None:
        raise ValidationError(f"{name} harus berupa angka.")
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{name} harus berupa angka.") from None
    if not math.isfinite(num):
        raise ValidationError(f"{name} harus berupa angka yang terbatas (bukan NaN/Infinity).")
    if integer:
        if not num.is_integer():
            raise ValidationError(f"{name} harus berupa bilangan bulat.")
        num = int(num)
    elif num.is_integer():
        num = int(num)
    if num < lo or num > hi:
        raise ValidationError(f"{name} harus berada di antara {lo:g} dan {hi:g}.")
    return num


def _parse_locations(raw):
    if not isinstance(raw, list) or len(raw) < 2:
        raise ValidationError("Minimal 2 lokasi (1 Depot dan 1 Pelanggan) dibutuhkan.")
    if len(raw) > MAX_LOCATIONS:
        raise ValidationError(f"Maksimal {MAX_LOCATIONS} lokasi per perhitungan.")

    cleaned = []
    depot_count = 0
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValidationError(f"Lokasi #{idx + 1} harus berupa objek JSON.")
        label = str(item.get("name") or f"Lokasi {idx + 1}")
        is_depot = item.get("isDepot", False) is True
        depot_count += is_depot
        cleaned.append(
            {
                "name": label,
                "lat": _number(item.get("lat"), f"Latitude '{label}'", -90, 90),
                "lng": _number(item.get("lng"), f"Longitude '{label}'", -180, 180),
                "demand": 0
                if is_depot
                else _number(item.get("demand", 0), f"Demand '{label}'", 0, MAX_CAPACITY),
                "isDepot": is_depot,
            }
        )

    if depot_count > 1:
        raise ValidationError("Hanya boleh ada satu depot.")
    return cleaned


def _parse_params(raw):
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValidationError("params harus berupa objek JSON.")

    params = {
        "capacity": _number(raw.get("capacity", 35), "Kapasitas", 1, MAX_CAPACITY),
        "vehicles": _number(raw.get("vehicles", 3), "Jumlah armada", 1, MAX_VEHICLES, integer=True),
        "generations": _number(raw.get("generations", 100), "Generasi", 1, MAX_GENERATIONS, integer=True),
        "popSize": _number(raw.get("popSize", 40), "Ukuran populasi", 2, MAX_POP_SIZE, integer=True),
    }
    if params["generations"] * params["popSize"] > MAX_EVALUATIONS:
        raise ValidationError(
            f"Generasi x populasi maksimal {MAX_EVALUATIONS} "
            f"(sekarang {params['generations'] * params['popSize']}). "
            "Turunkan salah satunya agar server tetap responsif."
        )
    params["capacity"] = float(params["capacity"])
    return params


def _build_warnings(locations, depot_idx, capacity, vehicles):
    """Peringatan non-fatal agar frontend bisa menjelaskan hasil tidak layak."""
    warnings = []
    customers = [loc for i, loc in enumerate(locations) if i != depot_idx]

    too_big = [loc["name"] for loc in customers if loc["demand"] > capacity]
    if too_big:
        shown = ", ".join(too_big[:3]) + ("..." if len(too_big) > 3 else "")
        warnings.append(
            f"{len(too_big)} pelanggan memiliki demand di atas kapasitas satu kendaraan "
            f"({shown}); solusi tidak mungkin layak."
        )

    total = sum(loc["demand"] for loc in customers)
    if total > capacity * vehicles:
        warnings.append(
            f"Total demand ({total:g}) melebihi total kapasitas armada "
            f"({capacity * vehicles:g}); tambah armada atau kapasitas."
        )
    return warnings


# --------------------------------------------------------------------------
# Dataset (dibaca ulang hanya bila file berubah)
# --------------------------------------------------------------------------
_dataset_cache = {"mtime": None, "data": None}


def _load_dataset():
    mtime = os.path.getmtime(DATASET_PATH)
    if _dataset_cache["mtime"] != mtime:
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            _dataset_cache["data"] = json.load(f)
        _dataset_cache["mtime"] = mtime
    return _dataset_cache["data"]


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "OK", "message": "VRP Hybrid Flask Backend is running"})


@app.route("/api/dataset", methods=["GET"])
def get_dataset():
    if not os.path.exists(DATASET_PATH):
        return jsonify({"status": "ERROR", "message": "Dataset file not found"}), 404
    return jsonify(_load_dataset())


@app.route("/api/solve", methods=["POST"])
def solve_vrp():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ValidationError("Body request harus berupa JSON object yang valid.")

    algorithm = str(payload.get("algorithm", "HYBRID")).upper()
    if algorithm not in ALGORITHMS:
        raise ValidationError(
            f"Algoritma '{algorithm}' tidak dikenal. Pilih salah satu: {', '.join(ALGORITHMS)}."
        )

    locations = _parse_locations(payload.get("locations"))
    params = _parse_params(payload.get("params"))

    seed_raw = payload.get("seed")
    seed = (
        _number(seed_raw, "Seed", 0, 2**31 - 1, integer=True)
        if seed_raw is not None
        else random.randrange(2**31)
    )

    depot_idx = next((i for i, loc in enumerate(locations) if loc["isDepot"]), 0)
    customer_indices = [i for i in range(len(locations)) if i != depot_idx]
    dist_matrix = build_distance_matrix(locations)
    warnings = _build_warnings(locations, depot_idx, params["capacity"], params["vehicles"])

    is_benchmark = algorithm == "BENCHMARK"
    targets = list(SOLVERS) if is_benchmark else [algorithm]
    results = _run_solvers(
        targets, locations, params, dist_matrix, customer_indices, depot_idx, seed
    )

    response = {
        "status": "SUCCESS",
        "isBenchmark": is_benchmark,
        "seed": seed,
        "warnings": warnings,
    }
    if is_benchmark:
        response["data"] = results
    else:
        response["algorithm"] = algorithm
        response["data"] = results[algorithm]
    return jsonify(response)


# --------------------------------------------------------------------------
# Error handling: selalu JSON, tanpa membocorkan detail internal
# --------------------------------------------------------------------------
@app.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify({"status": "ERROR", "message": str(err)}), 400


@app.errorhandler(413)
def handle_too_large(_err):
    return jsonify({"status": "ERROR", "message": "Ukuran data terlalu besar (maks. 1 MB)."}), 413


@app.errorhandler(404)
def handle_not_found(_err):
    return jsonify({"status": "ERROR", "message": "Endpoint tidak ditemukan."}), 404


@app.errorhandler(405)
def handle_method_not_allowed(_err):
    return jsonify({"status": "ERROR", "message": "Metode HTTP tidak diizinkan."}), 405


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    if isinstance(err, HTTPException):  # 400/415/dll. tetap dibalas dengan kode aslinya
        return jsonify({"status": "ERROR", "message": err.description}), err.code
    logger.exception("Kesalahan tak terduga: %s", err)
    return (
        jsonify(
            {
                "status": "ERROR",
                "message": "Terjadi kesalahan pada server saat menghitung rute.",
            }
        ),
        500,
    )


if __name__ == "__main__":
    # Dev server. Untuk produksi (Linux): gunicorn -w 2 -b 0.0.0.0:5000 app:app
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", 5000)),
        debug=False,
    )