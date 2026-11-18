import os
import json
import time
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify
from flask_cors import CORS

from solvers.distance import build_distance_matrix
from solvers.ga_solver import run_ga
from solvers.abc_solver import run_abc
from solvers.hybrid_solver import run_hybrid

app = Flask(__name__)
CORS(app)

DATASET_PATH = os.path.join(
    os.path.dirname(__file__), "data", "dataset_31_kecamatan_indramayu.json"
)


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "OK", "message": "VRP Hybrid Flask Backend is running"})


@app.route("/api/dataset", methods=["GET"])
def get_dataset():
    if not os.path.exists(DATASET_PATH):
        return jsonify({"status": "ERROR", "message": "Dataset file not found"}), 404
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


def _timed_run(fn, locations, params, dist_matrix, customer_indices, depot_idx):
    t0 = time.perf_counter()
    res = fn(locations, params, dist_matrix, customer_indices, depot_idx)
    elapsed_ms = f"{(time.perf_counter() - t0) * 1000:.1f}"
    clean_res = {
        k: v
        for k, v in res.items()
        if k not in ("finalPopulation", "bestPerm", "bestEval")
    }
    return {**clean_res, "time": elapsed_ms, "executionTime": elapsed_ms}


@app.route("/api/solve", methods=["POST"])
def solve_vrp():
    payload = request.get_json(silent=True) or {}
    algorithm = str(payload.get("algorithm", "HYBRID")).upper()
    locations = payload.get("locations", [])
    params = payload.get("params", {})

    if not locations or len(locations) < 2:
        return jsonify({"status": "ERROR", "message": "Minimal 2 lokasi dibutuhkan"}), 400

    dist_matrix = build_distance_matrix(locations)

    found_depot = next(
        (idx for idx, loc in enumerate(locations) if loc.get("isDepot")), -1
    )
    depot_idx = found_depot if found_depot != -1 else 0
    customer_indices = [idx for idx in range(len(locations)) if idx != depot_idx]

    if algorithm == "BENCHMARK":
        with ThreadPoolExecutor(max_workers=3) as executor:
            fut_ga = executor.submit(
                _timed_run,
                run_ga,
                locations,
                params,
                dist_matrix,
                customer_indices,
                depot_idx,
            )
            fut_abc = executor.submit(
                _timed_run,
                run_abc,
                locations,
                params,
                dist_matrix,
                customer_indices,
                depot_idx,
            )
            fut_hybrid = executor.submit(
                _timed_run,
                run_hybrid,
                locations,
                params,
                dist_matrix,
                customer_indices,
                depot_idx,
            )

            ga_data = fut_ga.result()
            abc_data = fut_abc.result()
            hybrid_data = fut_hybrid.result()

        return jsonify(
            {
                "status": "SUCCESS",
                "isBenchmark": True,
                "data": {
                    "GA": ga_data,
                    "ABC": abc_data,
                    "HYBRID": hybrid_data,
                },
            }
        )

    solver_map = {
        "GA": run_ga,
        "ABC": run_abc,
        "HYBRID": run_hybrid,
    }
    solver_fn = solver_map.get(algorithm, run_hybrid)
    result_data = _timed_run(
        solver_fn, locations, params, dist_matrix, customer_indices, depot_idx
    )

    return jsonify(
        {
            "status": "SUCCESS",
            "isBenchmark": False,
            "algorithm": algorithm,
            "data": result_data,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)