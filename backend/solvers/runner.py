"""Pembungkus eksekusi solver.

Dipisah dari app.py agar proses worker (ProcessPoolExecutor) hanya mengimpor
modul solver, tanpa ikut memuat Flask. Aman dipakai di Linux (fork) maupun
Windows/macOS (spawn).
"""

import random
import time

from solvers.abc_solver import run_abc
from solvers.ga_solver import run_ga
from solvers.hybrid_solver import run_hybrid

SOLVERS = {
    "GA": run_ga,
    "ABC": run_abc,
    "HYBRID": run_hybrid,
}

_INTERNAL_KEYS = ("finalPopulation", "bestPerm", "bestEval")


def timed_run(
    algorithm: str,
    locations: list,
    params: dict,
    dist_matrix: list,
    customer_indices: list,
    depot_idx: int,
    seed: int,
) -> dict:
    # Seed per proses: hasil sama untuk seed yang sama, dan di mode Benchmark
    # ketiga algoritma mulai dari kondisi acak yang setara.
    random.seed(seed)
    t0 = time.perf_counter()
    res = SOLVERS[algorithm](locations, params, dist_matrix, customer_indices, depot_idx)
    elapsed_ms = f"{(time.perf_counter() - t0) * 1000:.1f}"
    clean = {k: v for k, v in res.items() if k not in _INTERNAL_KEYS}
    return {**clean, "time": elapsed_ms, "executionTime": elapsed_ms}