import random
from solvers.split_prins import (
    decode_chromosome,
    evaluate_permutation_cached,
    get_random_permutation,
    mutate_route_neighborhood,
)


def run_abc(
    locations: list,
    params: dict,
    dist_matrix: list,
    customer_indices: list,
    depot_idx: int,
    seed_state: dict = None,
    decode_cache: dict = None,
    eval_cache: dict = None,
) -> dict:
    generations = int(params["generations"])
    pop_size = int(params["popSize"])
    capacity = float(params["capacity"])
    vehicles = int(params["vehicles"])

    if decode_cache is None:
        decode_cache = {}
    if eval_cache is None:
        eval_cache = {}

    if seed_state and seed_state.get("population"):
        food_sources = [list(p) for p in seed_state["population"]]
    else:
        food_sources = [
            get_random_permutation(customer_indices) for _ in range(pop_size)
        ]

    fitness_cache = [
        evaluate_permutation_cached(
            perm,
            locations,
            capacity,
            vehicles,
            dist_matrix,
            depot_idx,
            decode_cache,
            eval_cache,
        )
        for perm in food_sources
    ]

    trial_limits = [0] * pop_size
    max_trials = 15

    best_perm = (
        list(seed_state["bestPerm"])
        if (seed_state and seed_state.get("bestPerm"))
        else list(food_sources[0])
    )
    best_eval = (
        dict(seed_state["bestEval"])
        if (seed_state and seed_state.get("bestEval"))
        else dict(fitness_cache[0])
    )
    history = []

    for gen in range(generations):
        # 1. Employed Bees Phase
        for i in range(pop_size):
            new_perm = mutate_route_neighborhood(food_sources[i])
            new_eval = evaluate_permutation_cached(
                new_perm,
                locations,
                capacity,
                vehicles,
                dist_matrix,
                depot_idx,
                decode_cache,
                eval_cache,
            )
            if new_eval["fitness"] < fitness_cache[i]["fitness"]:
                food_sources[i] = new_perm
                fitness_cache[i] = new_eval
                trial_limits[i] = 0
            else:
                trial_limits[i] += 1

        # 2. Onlooker Bees Phase
        qualities = [1.0 / (1.0 + e["fitness"]) for e in fitness_cache]
        total_quality = sum(qualities)

        for _ in range(pop_size):
            r = random.random() * total_quality
            selected = 0
            for j in range(pop_size):
                r -= qualities[j]
                if r <= 0:
                    selected = j
                    break

            new_perm = mutate_route_neighborhood(food_sources[selected])
            new_eval = evaluate_permutation_cached(
                new_perm,
                locations,
                capacity,
                vehicles,
                dist_matrix,
                depot_idx,
                decode_cache,
                eval_cache,
            )
            if new_eval["fitness"] < fitness_cache[selected]["fitness"]:
                food_sources[selected] = new_perm
                fitness_cache[selected] = new_eval
                trial_limits[selected] = 0
            else:
                trial_limits[selected] += 1

        # 3. Scout Bees Phase
        best_source_idx = min(
            range(pop_size), key=lambda idx: fitness_cache[idx]["fitness"]
        )

        for i in range(pop_size):
            if i != best_source_idx and trial_limits[i] > max_trials:
                food_sources[i] = get_random_permutation(customer_indices)
                fitness_cache[i] = evaluate_permutation_cached(
                    food_sources[i],
                    locations,
                    capacity,
                    vehicles,
                    dist_matrix,
                    depot_idx,
                    decode_cache,
                    eval_cache,
                )
                trial_limits[i] = 0

        # Update Global Best
        for i in range(pop_size):
            if fitness_cache[i]["fitness"] < best_eval["fitness"]:
                best_eval = dict(fitness_cache[i])
                best_perm = list(food_sources[i])

        history.append(
            {
                "generation": gen + 1,
                "fitness": round(best_eval["distance"], 2),
            }
        )

    return {
        "bestRoutes": decode_chromosome(
            best_perm, locations, capacity, vehicles, dist_matrix, depot_idx, decode_cache
        ),
        "bestDistance": best_eval["distance"],
        "isFeasible": best_eval["isFeasible"],
        "history": history,
    }