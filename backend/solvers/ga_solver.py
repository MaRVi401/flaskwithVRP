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

    for gen in range(generations):
        evaluated = []
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
            evaluated.append((eval_res["fitness"], perm))

        history.append(
            {
                "generation": gen + 1,
                "fitness": round(best_eval["distance"], 2),
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

    return {
        "bestRoutes": decode_chromosome(
            best_perm, locations, capacity, vehicles, dist_matrix, depot_idx, decode_cache
        ),
        "bestDistance": best_eval["distance"],
        "isFeasible": best_eval["isFeasible"],
        "history": history,
        "finalPopulation": population,
        "bestPerm": best_perm,
        "bestEval": best_eval,
    }