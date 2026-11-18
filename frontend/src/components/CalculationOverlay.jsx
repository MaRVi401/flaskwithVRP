import React, { useState, useEffect } from "react";

const ALGORITHM_STEPS = {
  HYBRID: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 18 },
    { label: "Tahap 1: Eksplorasi Global Genetic Algorithm (60%)", pct: 46 },
    { label: "Memetic Local Search (2-Opt, Relocate & Swap)", pct: 72 },
    { label: "Tahap 2: Eksploitasi Artificial Bee Colony (40%)", pct: 90 },
    { label: "Final Polishing & Validasi Kapasitas Armada", pct: 98 },
  ],
  GA: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 22 },
    { label: "Inisialisasi Populasi & Decoding Split Prins DP", pct: 50 },
    { label: "Seleksi Elitism, Order Crossover (OX) & Mutasi", pct: 80 },
    { label: "Evaluasi Konvergensi & Rute Terbaik", pct: 98 },
  ],
  ABC: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 22 },
    { label: "Fase Employed Bees: Pencarian Tetangga Lokal", pct: 52 },
    { label: "Fase Onlooker Bees: Seleksi Probabilistik Roulette", pct: 82 },
    { label: "Fase Scout Bees & Pembaruan Solusi Global", pct: 98 },
  ],
  BENCHMARK: [
    { label: "Menyiapkan Matriks Jarak & Parallel Thread Pool", pct: 16 },
    { label: "Menjalankan Genetic Algorithm (GA)...", pct: 42 },
    { label: "Menjalankan Artificial Bee Colony (ABC)...", pct: 70 },
    { label: "Menjalankan Memetic Hybrid (GA + Local Search + ABC)...", pct: 92 },
    { label: "Mengompilasi Tabel & Kurva Perbandingan", pct: 98 },
  ],
};

export default function CalculationOverlay({
  isCalculating,
  algorithm,
  params,
  locationCount,
  isDarkMode,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState("0.0");

  const steps = ALGORITHM_STEPS[algorithm] || ALGORITHM_STEPS.HYBRID;

  useEffect(() => {
    if (!isCalculating) {
      setStepIndex(0);
      setElapsedSec("0.0");
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedSec(((Date.now() - startTime) / 1000).toFixed(1));
    }, 80);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 320);

    return () => {
      clearInterval(timerInterval);
      clearInterval(stepInterval);
    };
  }, [isCalculating, algorithm, steps.length]);

  if (!isCalculating) return null;

  const currentStep = steps[stepIndex];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md p-5 sm:p-6 rounded-2xl border shadow-2xl space-y-4 transform transition-all ${
          isDarkMode
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/15 text-indigo-500 shrink-0">
              <i className="ti ti-cpu text-2xl animate-pulse"></i>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black tracking-tight">
                Optimasi Rute ({algorithm})
              </h4>
              <p className="text-[11px] opacity-65">
                Komputasi aktif di backend Python Flask
              </p>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold border shrink-0 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-indigo-400"
                : "bg-indigo-50 border-indigo-200 text-indigo-700"
            }`}
          >
            {elapsedSec}s
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold">
            <span className="text-indigo-500 truncate pr-2">
              {currentStep.label}
            </span>
            <span className="font-mono shrink-0">{currentStep.pct}%</span>
          </div>
          <div
            className={`w-full h-3 rounded-full overflow-hidden p-0.5 ${
              isDarkMode ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${currentStep.pct}%` }}
            />
          </div>
        </div>

        {/* Stepper Checklist */}
        <div
          className={`p-3.5 rounded-xl border space-y-2 text-[11px] ${
            isDarkMode
              ? "bg-slate-950/80 border-slate-800"
              : "bg-slate-50 border-slate-200/90"
          }`}
        >
          {steps.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;

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
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Parameter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] opacity-80">
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
      </div>
    </div>
  );
}