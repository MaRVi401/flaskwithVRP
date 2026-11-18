from collections import OrderedDict


class BoundedCache(OrderedDict):
    """Cache LRU berukuran terbatas (drop-in pengganti dict).

    Mencegah memori membengkak saat populasi/generasi besar. Properti
    `misses` menghitung berapa kali sebuah kromosom benar-benar harus
    dievaluasi (bukan diambil dari cache), sehingga bisa dipakai sebagai
    hitungan evaluasi yang jujur.
    """

    def __init__(self, maxsize: int = 30000):
        super().__init__()
        self.maxsize = maxsize
        self.misses = 0

    def __getitem__(self, key):
        value = super().__getitem__(key)
        self.move_to_end(key)
        return value

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
        if len(self) > self.maxsize:
            self.popitem(last=False)


def count_miss(cache) -> None:
    if isinstance(cache, BoundedCache):
        cache.misses += 1