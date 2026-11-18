import math


def calculate_distance(loc1: dict, loc2: dict) -> float:
    """Kalkulasi jarak Haversine (km) antar dua titik koordinat."""
    R = 6371.0
    lat1, lng1 = float(loc1["lat"]), float(loc1["lng"])
    lat2, lng2 = float(loc2["lat"]), float(loc2["lng"])

    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def build_distance_matrix(locations: list) -> list:
    """Buat Matriks Jarak N x N (simetris)."""
    n = len(locations)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            dist = calculate_distance(locations[i], locations[j])
            matrix[i][j] = dist
            matrix[j][i] = dist
    return matrix


def get_single_route_distance(route: list, dist_matrix: list, depot_idx: int) -> float:
    """Menghitung jarak satu rute tunggal dari Depot -> pelanggan -> Depot."""
    if not route:
        return 0.0
    dist = dist_matrix[depot_idx][route[0]]
    for i in range(len(route) - 1):
        dist += dist_matrix[route[i]][route[i + 1]]
    dist += dist_matrix[route[-1]][depot_idx]
    return dist