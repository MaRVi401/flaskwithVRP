import React, { useState, useEffect, useRef, useCallback } from "react";

const ALGORITHM_PIPELINE = {
  HYBRID: [
    "Menghitung Matriks Jarak Haversine (N × N)",
    "Tahap 1: Eksplorasi Global Genetic Algorithm",
    "Memetic Local Search (2-Opt, Relocate & Swap)",
    "Tahap 2: Eksploitasi Artificial Bee Colony",
    "Final Polishing & Validasi Kapasitas Armada",
  ],
  GA: [
    "Menghitung Matriks Jarak Haversine (N × N)",
    "Inisialisasi Populasi & Decoding Split Prins DP",
    "Seleksi Elitism, Order Crossover (OX) & Mutasi",
    "Evaluasi Konvergensi & Rute Terbaik",
  ],
  ABC: [
    "Menghitung Matriks Jarak Haversine (N × N)",
    "Fase Employed Bees: Pencarian Tetangga Lokal",
    "Fase Onlooker Bees: Seleksi Probabilistik",
    "Fase Scout Bees & Pembaruan Solusi Global",
  ],
  BENCHMARK: [
    "Menyiapkan Matriks Jarak & Process Pool Paralel",
    "Menjalankan Genetic Algorithm (GA)",
    "Menjalankan Artificial Bee Colony (ABC)",
    "Menjalankan Memetic Hybrid (GA + Local Search + ABC)",
    "Mengompilasi Tabel & Kurva Perbandingan",
  ],
};

function estimateDurationMs(algorithm, params, locationCount) {
  const gens = Number(params?.generations) || 100;
  const pop = Number(params?.popSize) || 40;
  const locs = Math.max(5, Number(locationCount) || 7);

  const complexityFactor =
    algorithm === "BENCHMARK"
      ? 2.2
      : algorithm === "ABC"
        ? 1.8
        : algorithm === "HYBRID"
          ? 1.2
          : 0.5;

  const workUnits = (gens * pop * locs) / 1000;
  return Math.max(500, workUnits * 15 * complexityFactor);
}

export default function CalculationOverlay({
  isCalculating,
  onCancel,
  algorithm,
  params,
  locationCount,
  isDarkMode,
  error = null,
}) {
  const [visible, setVisible] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState("0.0");
  const [progress, setProgress] = useState(0);

  const wasCalculatingRef = useRef(false);
  const cancelledRef = useRef(false);

  const pipeline = ALGORITHM_PIPELINE[algorithm] || ALGORITHM_PIPELINE.HYBRID;

  const handleCloseModal = useCallback(() => {
    setVisible(false);
    setIsCompleting(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    let intervalId = null;

    if (isCalculating) {
      wasCalculatingRef.current = true;
      cancelledRef.current = false;
      setVisible(true);
      setIsCompleting(false);
      setProgress(8);
      setElapsedSec("0.0");

      const startTime = Date.now();
      const estimatedMs = estimateDurationMs(algorithm, params, locationCount);

      intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedSec((elapsed / 1000).toFixed(1));

        // Bergerak mulus maksimal hingga 95% selama menunggu backend
        const ratio = elapsed / estimatedMs;
        const computedPct = Math.min(
          95,
          Math.round(95 * (1 - Math.exp(-1.8 * ratio)))
        );
        setProgress(Math.max(8, computedPct));
      }, 60);
    } else if (wasCalculatingRef.current) {
      wasCalculatingRef.current = false;

      if (cancelledRef.current || error) {
        handleCloseModal();
      } else {
        // Backend selesai: capai 100% dan tahan modal sampai tombol diklik
        setIsCompleting(true);
        setProgress(100);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCalculating, algorithm, params, locationCount, error, handleCloseModal]);

  const isDoneAll = isCompleting || progress >= 100;

  // Izinkan tutup dengan tombol Enter / Escape saat sudah 100%
  useEffect(() => {
    if (!visible || !isDoneAll) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, isDoneAll, handleCloseModal]);

  const handleCancelClick = () => {
    cancelledRef.current = true;
    handleCloseModal();
    if (onCancel) onCancel();
  };

  if (!visible) return null;

  const stepIndex = isDoneAll
    ? pipeline.length
    : Math.min(
        pipeline.length - 1,
        Math.floor((progress / 100) * pipeline.length)
      );

  const currentStepLabel = isDoneAll
    ? "Optimasi selesai! Siap ditampilkan."
    : pipeline[stepIndex];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div
        className={`w-full max-w-md p-5 sm:p-6 rounded-2xl border shadow-2xl space-y-4 transition-all ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`relative flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors ${
                isDoneAll
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-indigo-600/15 text-indigo-500"
              }`}
            >
              <i
                className={`ti ${
                  isDoneAll
                    ? "ti-circle-check text-2xl"
                    : "ti-cpu text-2xl animate-pulse"
                }`}
              ></i>
              {!isDoneAll && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              )}
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black tracking-tight">
                {isDoneAll
                  ? `Komputasi Selesai (${algorithm})`
                  : `Optimasi Rute (${algorithm})`}
              </h4>
              <p className="text-[11px] opacity-70">
                {isDoneAll
                  ? "Seluruh tahapan perhitungan berhasil dijalankan"
                  : "Sedang memproses di server Python Flask..."}
              </p>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold border shrink-0 ${
              isDoneAll
                ? isDarkMode
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-indigo-400"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700"
            }`}
          >
            {elapsedSec}s
          </div>
        </div>

        {/* Progress Bar dengan Persentase hingga 100% */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold">
            <span
              className={`truncate pr-2 ${
                isDoneAll ? "text-emerald-500" : "text-indigo-500"
              }`}
            >
              {currentStepLabel}
            </span>
            <span
              className={`font-mono font-extrabold shrink-0 ${
                isDoneAll ? "text-emerald-500" : "text-indigo-500"
              }`}
            >
              {progress}%
            </span>
          </div>
          <div
            className={`w-full h-3 rounded-full overflow-hidden p-0.5 ${
              isDarkMode ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-200 ease-out ${
                isDoneAll
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist Tahapan Tersinkronisasi */}
        <div
          className={`p-3.5 rounded-xl border space-y-2 text-[11px] ${
            isDarkMode
              ? "bg-slate-950/80 border-slate-800"
              : "bg-slate-50 border-slate-200/90"
          }`}
        >
          {pipeline.map((stepLabel, idx) => {
            const isDone = isDoneAll || idx < stepIndex;
            const isCurrent = !isDoneAll && idx === stepIndex;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 transition-opacity duration-200 ${
                  isDone || isCurrent ? "opacity-100" : "opacity-40"
                }`}
              >
                {isDone ? (
                  <i className="ti ti-circle-check-filled text-emerald-500 text-base shrink-0"></i>
                ) : isCurrent ? (
                  <i className="ti ti-loader-2 text-indigo-500 text-base animate-spin shrink-0"></i>
                ) : (
                  <i className="ti ti-circle text-slate-400 text-base shrink-0"></i>
                )}
                <span
                  className={`truncate ${
                    isCurrent ? "font-bold text-indigo-500" : ""
                  }`}
                >
                  {stepLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Parameter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] opacity-80">
          <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 font-bold">
            {locationCount} Titik Lokasi
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 font-bold">
            {params.vehicles} Armada (Kap. {params.capacity})
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 font-bold">
            {params.generations} Gen • {params.popSize} Pop
          </span>
        </div>

        {/* Tombol Aksi: "Batalkan Permintaan" saat berjalan, "Lihat Benchmark / Hasil" saat 100% */}
        <div className="pt-1">
          {isDoneAll ? (
            <button
              type="button"
              autoFocus
              onClick={handleCloseModal}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <i className="ti ti-chart-bar text-base"></i>
              <span>
                {algorithm === "BENCHMARK"
                  ? "Lihat Benchmark"
                  : "Lihat Hasil Rute"}
              </span>
            </button>
          ) : (
            onCancel && (
              <button
                type="button"
                onClick={handleCancelClick}
                className={`w-full py-2 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDarkMode
                    ? "bg-rose-950/50 border-rose-800/80 text-rose-300 hover:bg-rose-900/70"
                    : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                }`}
              >
                <i className="ti ti-x text-sm"></i>
                <span>Batalkan Permintaan</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}