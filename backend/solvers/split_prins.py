import random
from solvers.distance import get_single_route_distance

OVERLOAD_PENALTY = 1000.0


def evaluate_solution(
    routes: list,
    dist_matrix: list,
    depot_idx: int,
    locations: list,
    vehicle_capacity: float,
) -> dict:
    """Evaluasi total jarak (km) + penalti overload."""
    total_distance = 0.0
    total_penalty = 0.0

    for route in routes:
        if not route:
            continue

        total_distance += get_single_route_distance(route, dist_matrix, depot_idx)
        route_demand = sum(locations[c_idx].get("demand", 0) for c_idx in route)

        if route_demand > vehicle_capacity:
            total_penalty += (route_demand - vehicle_capacity) * OVERLOAD_PENALTY

    return {
        "distance": total_distance,
        "fitness": total_distance + total_penalty,
        "isFeasible": total_penalty == 0,
    }


def decode_chromosome(
    permutation: list,
    locations: list,
    vehicle_capacity: float,
    num_vehicles: int,
    dist_matrix: list,
    depot_idx: int,
    cache: dict = None,
) -> list:
    """Algoritma Split Prins (Dynamic Programming) dengan Memoization Cache."""
    m = len(permutation)
    if num_vehicles <= 0 or m == 0:
        return []

    perm_key = tuple(permutation)
    if cache is not None and perm_key in cache:
        return [list(r) for r in cache[perm_key]]

    inf = float("inf")
    seg_cost = [[inf] * m for _ in range(m)]
    demands = [loc.get("demand", 0) for loc in locations]
    depot_row = dist_matrix[depot_idx]

    for i in range(m):
        load = 0.0
        dist = 0.0
        seg_row = seg_cost[i]
        for j in range(i, m):
            cust = permutation[j]
            load += demands[cust]
            if j == i:
                dist = depot_row[cust]
            else:
                dist += dist_matrix[permutation[j - 1]][cust]

            total_trip_dist = dist + dist_matrix[cust][depot_idx]
            penalty = (
                (load - vehicle_capacity) * OVERLOAD_PENALTY
                if load > vehicle_capacity
                else 0.0
            )
            seg_row[j] = total_trip_dist + penalty

    dp = [[inf] * (m + 1) for _ in range(num_vehicles + 1)]
    parent = [[-1] * (m + 1) for _ in range(num_vehicles + 1)]
    dp[0][0] = 0.0

    for k in range(1, num_vehicles + 1):
        dp_prev = dp[k - 1]
        dp_curr = dp[k]
        par_curr = parent[k]
        for j in range(1, m + 1):
            best_c = dp_curr[j]
            best_i = -1
            j_minus_1 = j - 1
            for i in range(k - 1, j):
                prev_val = dp_prev[i]
                if prev_val == inf:
                    continue
                cost = prev_val + seg_cost[i][j_minus_1]
                if cost < best_c:
                    best_c = cost
                    best_i = i
            if best_i != -1:
                dp_curr[j] = best_c
                par_curr[j] = best_i

    best_k = min(range(1, num_vehicles + 1), key=lambda k: dp[k][m])

    routes = []
    curr_j = m
    for k in range(best_k, 0, -1):
        prev_i = parent[k][curr_j]
        if prev_i == -1:
            break
        routes.append(permutation[prev_i:curr_j])
        curr_j = prev_i
    routes.reverse()

    result = routes if routes else [list(permutation)]
    if cache is not None:
        cache[perm_key] = result
    return [list(r) for r in result]


def evaluate_permutation_cached(
    permutation: list,
    locations: list,
    vehicle_capacity: float,
    num_vehicles: int,
    dist_matrix: list,
    depot_idx: int,
    decode_cache: dict,
    eval_cache: dict,
) -> dict:
    """Evaluasi kromosom langsung dengan cache tingkat individu (O(1) saat hit)."""
    perm_key = tuple(permutation)
    if perm_key in eval_cache:
        return eval_cache[perm_key]

    routes = decode_chromosome(
        permutation,
        locations,
        vehicle_capacity,
        num_vehicles,
        dist_matrix,
        depot_idx,
        cache=decode_cache,
    )
    res = evaluate_solution(routes, dist_matrix, depot_idx, locations, vehicle_capacity)
    eval_cache[perm_key] = res
    return res


def get_random_permutation(customer_indices: list) -> list:
    arr = list(customer_indices)
    random.shuffle(arr)
    return arr


def mutate_route_neighborhood(perm: list) -> list:
    arr = list(perm)
    n = len(arr)
    if n < 2:
        return arr

    op = random.random()
    i = random.randrange(n)
    j = random.randrange(n - 1)
    if j >= i:
        j += 1

    if op < 0.34:
        arr[i], arr[j] = arr[j], arr[i]
    elif op < 0.67:
        removed = arr.pop(i)
        arr.insert(j, removed)
    else:
        start, end = min(i, j), max(i, j)
        arr[start : end + 1] = reversed(arr[start : end + 1])

    return arr