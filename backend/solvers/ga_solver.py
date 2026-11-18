import random
from solvers.split_prins import (
    decode_chromosome,
    evaluate_permutation_cached,
    get_random_permutation,
    mutate_route_neighborhood,
)


def run_ga(
    locations: list,
    params: dict,
    dist_matrix: list,
    customer_indices: list,
    depot_idx: int,
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

    population = [get_random_permutation(customer_indices) for _ in range(pop_size)]

    best_perm = list(population[0])
    best_eval = {"distance": float("inf"), "fitness": float("inf"), "isFeasible": False}
    history = []
    improvement_count = 0

    for gen in range(generations):
        evaluated = []
        gen_improved = False
        for perm in population:
            eval_res = evaluate_permutation_cached(
                perm,
                locations,
                capacity,
                vehicles,
                dist_matrix,
                depot_idx,
                decode_cache,
                eval_cache,
            )
            if eval_res["fitness"] < best_eval["fitness"]:
                best_eval = eval_res
                best_perm = list(perm)
                gen_improved = True
            evaluated.append((eval_res["fitness"], perm))

        if gen_improved:
            improvement_count += 1

        history.append(
            {
                "generation": gen + 1,
                "fitness": round(best_eval["distance"], 2),
                "phase": "GA Selection & Crossover",
            }
        )

        evaluated.sort(key=lambda x: x[0])

        next_pop = [list(evaluated[0][1])]
        if pop_size > 1:
            next_pop.append(list(evaluated[1][1]))

        pool_size = max(1, pop_size // 2)
        while len(next_pop) < pop_size:
            parent1 = evaluated[random.randrange(pool_size)][1]
            parent2 = evaluated[random.randrange(pool_size)][1]

            p_len = len(parent1)
            start = random.randrange(p_len)
            end = start + random.randrange(p_len - start)

            child = [-1] * p_len
            child_set = set()
            for idx in range(start, end + 1):
                val = parent1[idx]
                child[idx] = val
                child_set.add(val)

            p2_idx = 0
            for idx in range(p_len):
                if child[idx] == -1:
                    while parent2[p2_idx] in child_set:
                        p2_idx += 1
                    val = parent2[p2_idx]
                    child[idx] = val
                    child_set.add(val)

            if random.random() < 0.2:
                child = mutate_route_neighborhood(child)
            next_pop.append(child)

        population = next_pop

    initial_dist = history[0]["fitness"] if history else best_eval["distance"]
    final_dist = round(best_eval["distance"], 2)
    reduction_pct = (
        round(((initial_dist - final_dist) / initial_dist) * 100, 2)
        if initial_dist > 0
        else 0.0
    )

    return {
        "bestRoutes": decode_chromosome(
            best_perm, locations, capacity, vehicles, dist_matrix, depot_idx, decode_cache
        ),
        "bestDistance": best_eval["distance"],
        "isFeasible": best_eval["isFeasible"],
        "history": history,
        "metrics": {
            "initialDistance": initial_dist,
            "finalDistance": final_dist,
            "reductionPct": max(0.0, reduction_pct),
            "improvementSteps": improvement_count,
            "totalEvaluations": generations * pop_size,
            "phaseSplit": f"100% GA ({generations} Gen)",
        },
        "finalPopulation": population,
        "bestPerm": best_perm,
        "bestEval": best_eval,
    }