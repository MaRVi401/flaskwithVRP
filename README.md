# 🚚 VRP Solver Indramayu — Memetic Hybrid Optimization (GA + Local Search + ABC)

Aplikasi web interaktif untuk menyelesaikan **Capacitated Vehicle Routing Problem (CVRP)** pada studi kasus distribusi logistik di Kabupaten Indramayu. Sistem ini menggabungkan eksplorasi global **Genetic Algorithm (GA)**, pencarian lokal **2-Opt Memetic**, dan eksploitasi lokal **Artificial Bee Colony (ABC)** yang didekodekan menggunakan algoritma **Split Prins Dynamic Programming**.

---

## ✨ Fitur Utama

### 1. Mesin Optimasi & Komputasi Backend (Python Flask)
* **4 Mode Eksekusi Solver:**
  * **Genetic Algorithm (GA):** Seleksi *Tournament*, *Elitism*, *Order Crossover (OX)*, dan *Swap Mutation*.
  * **Artificial Bee Colony (ABC):** Fase *Employed Bees*, *Onlooker Bees* (seleksi probabilistik), dan *Scout Bees* untuk menghindari *local optima*.
  * **Memetic Hybrid (GA + Local Search + ABC):** 60% generasi awal menggunakan GA untuk eksplorasi global, dipertajam dengan **2-Opt Local Search**, lalu 40% generasi akhir dieksploitasi oleh ABC.
  * **Benchmark Semua Algoritma:** Menjalankan GA, ABC, dan Hybrid secara **paralel sejati** menggunakan `ProcessPoolExecutor` (mengatasi batasan *Python GIL*) untuk perbandingan performa yang adil.
* **Split Prins Dynamic Programming:** Memecah kromosom permutasi pelanggan menjadi sub-rute armada secara optimal sesuai batas kapasitas kendaraan dengan optimasi *early stopping*.
* **Perhitungan Jarak Haversine:** Membangun matriks jarak geografis $N \times N$ dalam satuan kilometer secara presisi.
* **Validasi Input & Keamanan:** Pembatasan ukuran *payload*, validasi tipe dan rentang parameter, serta penanganan *error* terstruktur dalam format JSON.

### 2. Antarmuka Pengguna Interaktif (React + Tailwind CSS)
* **Peta Visualisasi Rute Interaktif:** Tambah titik pelanggan langsung dengan mengklik peta, ubah titik Depot utama, edit koordinat/permintaan (*demand*), dan lihat rute berwarna per armada.
* **Kunci Hasil Optimasi (`Seed` Reproducibility):** Fitur ceklis satu klik untuk mengunci *random seed* agar hasil pengujian dan presentasi konsisten 100%, atau biarkan acak untuk eksplorasi solusi baru.
* **Analitik Konvergensi & Audit Kinerja:**
  * Grafik konvergensi interaktif (*Recharts*) dengan *tooltip* detail per generasi dan *toggle* legenda pada mode Benchmark.
  * Tab **Log & Efektivitas** lengkap dengan filter **"Hanya Update"** untuk melacak setiap generasi yang berhasil memangkas jarak.
  * Mode **Layar Penuh (Fullscreen Modal)** pada tabel dan grafik untuk kemudahan presentasi.
* **Progress Overlay Adaptif:** Indikator progres berpersentase hingga **100%** dengan rincian tahapan eksekusi backend dan tombol pembatalan (*AbortController*).
* **Manajemen Dataset & Ekspor Laporan:**
  * Dataset bawaan **7 titik utama Indramayu** serta tombol pemuat **31 Kecamatan Indramayu** langsung dari API.
  * Mendukung **Import** dataset `.csv` / `.json` dan **Export** hasil optimasi lengkap ke format `.json`.
  * Dukungan **Dark Mode & Light Mode** responsif untuk desktop maupun perangkat seluler.

---

## 🛠️ Arsitektur & Teknologi

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Leaflet (`react-leaflet`), Recharts, Tabler Icons |
| **Backend** | Python 3.10+, Flask, Flask-CORS, `concurrent.futures.ProcessPoolExecutor` |
| **Algoritma** | Genetic Algorithm (GA), Artificial Bee Colony (ABC), 2-Opt Local Search, Split Prins DP, Haversine Formula |

---

## 📁 Struktur Direktori

```text
vrp-hybrid-app/
├── backend/
│   ├── app.py                                      # Entry point API Flask & ProcessPoolExecutor
│   ├── requirements.txt                            # Daftar dependensi Python
│   ├── data/
│   │   └── dataset_31_kecamatan_indramayu.json     # Dataset koordinat & demand 31 kecamatan
│   └── solvers/
│       ├── distance.py                             # Perhitungan matriks jarak Haversine
│       ├── split_prins.py                          # Decoding Split Prins Dynamic Programming
│       ├── ga.py                                   # Implementasi Genetic Algorithm
│       ├── abc_solver.py                           # Implementasi Artificial Bee Colony
│       ├── hybrid.py                               # Implementasi Memetic Hybrid (GA + LS + ABC)
│       └── runner.py                               # Orchestrator & pencatat metrik evaluasi
│
└── frontend/
    ├── index.html
    ├── package.json
    └── src/
        ├── App.jsx                                 # Layout utama, manajemen state, tabel & modal
        ├── App.css                                 # Kustomisasi gaya Leaflet & scrollbar
        ├── components/
        │   ├── MapView.jsx                         # Peta interaktif Leaflet & polyline rute
        │   ├── FitnessChart.jsx                    # Grafik konvergensi fitness (Single & Benchmark)
        │   └── CalculationOverlay.jsx              # Modal progress bar adaptif 100%
        └── hooks/
            └── useVrpSolver.js                     # Custom hook komunikasi API & AbortController

```

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### Prasyarat

* **Python** versi 3.10 atau lebih baru
* **Node.js** versi 18 atau lebih baru beserta **npm**

### 1. Menjalankan Backend (Flask)

Buka terminal pertama dan arahkan ke folder `backend`:

```bash
cd backend

# Membuat virtual environment (opsional namun disarankan)
python -m venv venv

# Aktivasi virtual environment:
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependensi
pip install -r requirements.txt

# Jalankan server Flask
python app.py

```

Server backend akan berjalan di **`http://localhost:5000`**.

### 2. Menjalankan Frontend (React + Vite)

Buka terminal kedua dan arahkan ke folder `frontend`:

```bash
cd frontend

# Install dependensi Node.js
npm install

# Jalankan development server
npm run dev

```

Aplikasi web dapat diakses melalui browser di **`http://localhost:5173`**.

---

### Backend (Environment Variables)

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `5000` | Port server Flask |
| `CORS_ORIGINS` | `localhost` | Daftar origin yang diizinkan (pisahkan dengan koma untuk produksi) |
| `VRP_MAX_LOCATIONS` | `100` | Batas maksimal titik lokasi dalam satu permintaan |
| `VRP_MAX_GENERATIONS` | `1000` | Batas maksimal jumlah generasi |
| `VRP_MAX_POP_SIZE` | `300` | Batas maksimal ukuran populasi |
| `VRP_MAX_EVALUATIONS` | `60000` | Batas maksimal `generations × popSize` |

---

## 📡 Dokumentasi API Backend

### 1. Health Check

* **Endpoint:** `GET /`
* **Respons (`200 OK`):**
```json
{
  "status": "OK",
  "message": "VRP Hybrid Flask Backend is running"
}

```



### 2. Ambil Dataset 31 Kecamatan Indramayu

* **Endpoint:** `GET /api/dataset`
* **Respons (`200 OK`):** Mengembalikan array objek lokasi (`name`, `lat`, `lng`, `demand`, `isDepot`).

### 3. Jalankan Optimasi / Benchmark VRP

* **Endpoint:** `POST /api/solve`
* **Request Body (`application/json`):**
```json
{
  "algorithm": "HYBRID",
  "seed": 42,
  "params": {
    "capacity": 35,
    "vehicles": 3,
    "generations": 100,
    "popSize": 40
  },
  "locations": [
    {
      "name": "Alun-Alun Indramayu (Depot)",
      "lat": -6.3265,
      "lng": 108.32,
      "demand": 0,
      "isDepot": true
    },
    {
      "name": "Pasar Karangampel",
      "lat": -6.4633,
      "lng": 108.4522,
      "demand": 12,
      "isDepot": false
    }
  ]
}

```


> **Catatan:** Nilai `algorithm` dapat diisi `"GA"`, `"ABC"`, `"HYBRID"`, atau `"BENCHMARK"`. Parameter `seed` bersifat opsional (jika tidak disertakan, server akan membangkitkan *seed* acak).


* **Respons (`200 OK`):**
```json
{
  "status": "SUCCESS",
  "isBenchmark": false,
  "algorithm": "HYBRID",
  "seed": 42,
  "warnings": [],
  "data": {
    "bestDistance": 193.23,
    "bestRoutes": [[1, 2, 6], [5, 4], [3]],
    "executionTime": "53.4",
    "isFeasible": true,
    "metrics": {
      "initialDistance": 195.91,
      "finalDistance": 193.23,
      "reductionPct": 1.37,
      "phaseSplit": "60% GA (60 Gen) + Local Search + 40% ABC (40 Gen)",
      "improvementSteps": 3,
      "totalEvaluations": 5600
    },
    "history": [
      { "generation": 1, "fitness": 195.91, "phase": "GA Exploration" }
    ]
  }
}

```



---

## 📄 Format Import Dataset CSV

Jika ingin mengunggah dataset kustom melalui tombol **Import**, gunakan struktur header CSV berikut:

```csv
name,lat,lng,demand,isDepot
Alun-Alun Indramayu,-6.3265,108.3200,0,true
Pasar Karangampel,-6.4633,108.4522,12,false
Kecamatan Jatibarang,-6.4712,108.3075,8,false

```

---

## 👨‍💻 Pengembang

Dikembangkan oleh kelompok 6 RPL 4A, sebagai proyek riset optimasi rute distribusi logistik menggunakan algoritma metaheuristik hibrida.

* **Ahmad Yassin - Pahril Lesmana - Eka Dava** — Rekayasa Perangkat Lunak, Teknik Informatika, Politeknik Negeri Indramayu
