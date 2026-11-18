from solvers.distance import get_single_route_distance
from solvers.split_prins import (
    decode_chromosome,
    evaluate_solution,
    evaluate_permutation_cached,
)
from solvers.ga_solver import run_ga
from solvers.abc_solver import run_abc


def apply_intra_route_2opt(routes: list, dist_matrix: list, depot_idx: int) -> list:
    """1. Intra-Route 2-Opt dengan O(1) Delta Evaluation untuk akselerasi."""
    result_routes = []
    for route in routes:
        n = len(route)
        if n < 3:
            result_routes.append(list(route))
            continue

        best_route = list(route)
        improved = True

        while improved:
            improved = False
            for i in range(n - 1):
                prev_node = depot_idx if i == 0 else best_route[i - 1]
                node_i = best_route[i]
                d_prev_i = dist_matrix[prev_node][node_i]

                for k in range(i + 1, n):
                    node_k = best_route[k]
                    next_node = depot_idx if k == n - 1 else best_route[k + 1]

                    old_edges = d_prev_i + dist_matrix[node_k][next_node]
                    new_edges = (
                        dist_matrix[prev_node][node_k]
                        + dist_matrix[node_i][next_node]
                    )

                    if new_edges + 1e-6 < old_edges:
                        best_route[i : k + 1] = reversed(best_route[i : k + 1])
                        improved = True
                        break
                if improved:
                    break

        result_routes.append(best_route)
    return result_routes


def apply_inter_route_optimization(
    routes: list,
    dist_matrix: list,
    depot_idx: int,
    locations: list,
    capacity: float,
) -> list:
    """2. Inter-Route Relocate (1-0) + Inter-Route Swap (1-1)."""
    current_routes = [list(r) for r in routes if len(r) > 0]
    improved = True

    while improved:
        improved = False
        loads = [
            sum(locations[idx].get("demand", 0) for idx in r) for r in current_routes
        ]

        # A. Inter-Route Relocate (1-0)
        for r_from in range(len(current_routes)):
            for pos_from in range(len(current_routes[r_from])):
                customer = current_routes[r_from][pos_from]
                cust_demand = locations[customer].get("demand", 0)

                for r_to in range(len(current_routes)):
                    if r_from == r_to or loads[r_to] + cust_demand > capacity:
                        continue

                    old_dist = get_single_route_distance(
                        current_routes[r_from], dist_matrix, depot_idx
                    ) + get_single_route_distance(
                        current_routes[r_to], dist_matrix, depot_idx
                    )

                    new_from = [
                        c for idx, c in enumerate(current_routes[r_from]) if idx != pos_from
                    ]
                    new_from_dist = get_single_route_distance(
                        new_from, dist_matrix, depot_idx
                    )

                    best_insert_pos = -1
                    best_new_dist = old_dist

                    for pos_to in range(len(current_routes[r_to]) + 1):
                        candidate_to = (
                            current_routes[r_to][:pos_to]
                            + [customer]
                            + current_routes[r_to][pos_to:]
                        )
                        total_new_dist = new_from_dist + get_single_route_distance(
                            candidate_to, dist_matrix, depot_idx
                        )
                        if total_new_dist + 1e-6 < best_new_dist:
                            best_new_dist = total_new_dist
                            best_insert_pos = pos_to

                    if best_insert_pos != -1:
                        current_routes[r_from] = new_from
                        current_routes[r_to].insert(best_insert_pos, customer)
                        current_routes = [r for r in current_routes if len(r) > 0]
                        improved = True
                        break
                if improved:
                    break
            if improved:
                break

        if improved:
            continue

        # B. Inter-Route Swap (1-1)
        for r1 in range(len(current_routes)):
            for p1 in range(len(current_routes[r1])):
                c1 = current_routes[r1][p1]
                d1 = locations[c1].get("demand", 0)

                for r2 in range(r1 + 1, len(current_routes)):
                    for p2 in range(len(current_routes[r2])):
                        c2 = current_routes[r2][p2]
                        d2 = locations[c2].get("demand", 0)

                        if (
                            loads[r1] - d1 + d2 > capacity
                            or loads[r2] - d2 + d1 > capacity
                        ):
                            continue

                        old_dist = get_single_route_distance(
                            current_routes[r1], dist_matrix, depot_idx
                        ) + get_single_route_distance(
                            current_routes[r2], dist_matrix, depot_idx
                        )

                        rem1 = [
                            c for idx, c in enumerate(current_routes[r1]) if idx != p1
                        ]
                        rem2 = [
                            c for idx, c in enumerate(current_routes[r2]) if idx != p2
                        ]

                        best_cand1 = None
                        best_dist1 = float("inf")
                        for ins1 in range(len(rem1) + 1):
                            cand1 = rem1[:ins1] + [c2] + rem1[ins1:]
                            dist1 = get_single_route_distance(
                                cand1, dist_matrix, depot_idx
                            )
                            if dist1 < best_dist1:
                                best_dist1 = dist1
                                best_cand1 = cand1

                        best_cand2 = None
                        best_dist2 = float("inf")
                        for ins2 in range(len(rem2) + 1):
                            cand2 = rem2[:ins2] + [c1] + rem2[ins2:]
                            dist2 = get_single_route_distance(
                                cand2, dist_matrix, depot_idx
                            )
                            if dist2 < best_dist2:
                                best_dist2 = dist2
                                best_cand2 = cand2

                        if best_dist1 + best_dist2 + 1e-6 < old_dist:
                            current_routes[r1] = best_cand1
                            current_routes[r2] = best_cand2
                            improved = True
                            break
                    if improved:
                        break
                if improved:
                    break
            if improved:
                break

    return apply_intra_route_2opt(current_routes, dist_matrix, depot_idx)


def refine_routes_memetic(
    routes: list,
    dist_matrix: list,
    depot_idx: int,
    locations: list,
    capacity: float,
) -> list:
    return apply_inter_route_optimization(
        routes, dist_matrix, depot_idx, locations, capacity
    )


def run_hybrid(
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

    ga_gen = max(1, int(generations * 0.6))
    abc_gen = max(1, generations - ga_gen)

    # Tahap 1: Eksplorasi global dengan GA (60% generasi)
    ga_params = {**params, "generations": ga_gen}
    ga_result = run_ga(
        locations,
        ga_params,
        dist_matrix,
        customer_indices,
        depot_idx,
        decode_cache=decode_cache,
        eval_cache=eval_cache,
    )

    refined_ga_routes = refine_routes_memetic(
        ga_result["bestRoutes"], dist_matrix, depot_idx, locations, capacity
    )
    refined_ga_eval = evaluate_solution(
        refined_ga_routes, dist_matrix, depot_idx, locations, capacity
    )

    ranked_items = []
    for perm in ga_result["finalPopulation"]:
        fit = evaluate_permutation_cached(
            perm,
            locations,
            capacity,
            vehicles,
            dist_matrix,
            depot_idx,
            decode_cache,
            eval_cache,
        )["fitness"]
        ranked_items.append((fit, perm))

    ranked_items.sort(key=lambda x: x[0])
    ranked_pop = [item[1] for item in ranked_items]

    elite_count = min(3, pop_size)
    for i in range(elite_count):
        elite_routes = refine_routes_memetic(
            decode_chromosome(
                ranked_pop[i],
                locations,
                capacity,
                vehicles,
                dist_matrix,
                depot_idx,
                decode_cache,
            ),
            dist_matrix,
            depot_idx,
            locations,
            capacity,
        )
        ranked_pop[i] = [cust for route in elite_routes for cust in route]

    seed_perm = [cust for route in refined_ga_routes for cust in route]
    seed_decoded_eval = evaluate_permutation_cached(
        seed_perm,
        locations,
        capacity,
        vehicles,
        dist_matrix,
        depot_idx,
        decode_cache,
        eval_cache,
    )

    # Tahap 2: Eksploitasi lokal lanjutan dengan ABC (40% sisa generasi)
    abc_params = {**params, "generations": abc_gen}
    abc_result = run_abc(
        locations,
        abc_params,
        dist_matrix,
        customer_indices,
        depot_idx,
        seed_state={
            "population": ranked_pop,
            "bestPerm": seed_perm,
            "bestEval": seed_decoded_eval,
        },
        decode_cache=decode_cache,
        eval_cache=eval_cache,
    )

    polished_abc_routes = refine_routes_memetic(
        abc_result["bestRoutes"], dist_matrix, depot_idx, locations, capacity
    )
    polished_abc_eval = evaluate_solution(
        polished_abc_routes, dist_matrix, depot_idx, locations, capacity
    )

    # Pilih kandidat terbaik mutlak yang tidak melampaui jumlah armada maksimal
    raw_candidates = [
        {"routes": ga_result["bestRoutes"], "evalRes": ga_result["bestEval"]},
        {"routes": refined_ga_routes, "evalRes": refined_ga_eval},
        {
            "routes": abc_result["bestRoutes"],
            "evalRes": evaluate_solution(
                abc_result["bestRoutes"], dist_matrix, depot_idx, locations, capacity
            ),
        },
        {"routes": polished_abc_routes, "evalRes": polished_abc_eval},
    ]
    valid_vehicle_candidates = [
        c for c in raw_candidates if len(c["routes"]) <= vehicles
    ]
    candidates = valid_vehicle_candidates if valid_vehicle_candidates else raw_candidates
    candidates.sort(key=lambda x: x["evalRes"]["fitness"])
    winner = candidates[0]

    refined_ga_dist_rounded = round(refined_ga_eval["distance"], 2)
    winner_dist_rounded = round(winner["evalRes"]["distance"], 2)

    history = list(ga_result["history"])
    abc_hist_len = len(abc_result["history"])
    for i, h in enumerate(abc_result["history"]):
        fitness_val = (
            winner_dist_rounded
            if i == abc_hist_len - 1
            else min(h["fitness"], refined_ga_dist_rounded)
        )
        history.append(
            {
                "generation": ga_gen + i + 1,
                "fitness": fitness_val,
            }
        )

    return {
        "bestRoutes": winner["routes"],
        "bestDistance": winner["evalRes"]["distance"],
        "isFeasible": winner["evalRes"]["isFeasible"],
        "history": history,
    }