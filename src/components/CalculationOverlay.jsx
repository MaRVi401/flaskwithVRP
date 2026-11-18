import React, { useState, useEffect } from "react";

const ALGORITHM_STEPS = {
  HYBRID: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 15 },
    { label: "Tahap 1: Eksplorasi Global Genetic Algorithm (60%)", pct: 45 },
    { label: "Memetic Local Search (2-Opt, Relocate & Swap)", pct: 68 },
    { label: "Tahap 2: Eksploitasi Artificial Bee Colony (40%)", pct: 88 },
    { label: "Final Polishing & Validasi Kapasitas Armada", pct: 96 },
  ],
  GA: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 20 },
    { label: "Inisialisasi Populasi & Decoding Split Prins DP", pct: 45 },
    { label: "Seleksi Elitism, Order Crossover (OX) & Mutasi", pct: 75 },
    { label: "Evaluasi Konvergensi & Rute Terbaik", pct: 95 },
  ],
  ABC: [
    { label: "Menghitung Matriks Jarak Haversine (N × N)", pct: 20 },
    { label: "Fase Employed Bees: Pencarian Tetangga Lokal", pct: 50 },
    { label: "Fase Onlooker Bees: Seleksi Probabilistik Roulette", pct: 78 },
    { label: "Fase Scout Bees & Pembaruan Solusi Global", pct: 95 },
  ],
  BENCHMARK: [
    { label: "Menyiapkan Matriks Jarak & Parallel Thread Pool", pct: 15 },
    { label: "Menjalankan Genetic Algorithm (GA)...", pct: 40 },
    { label: "Menjalankan Artificial Bee Colony (ABC)...", pct: 68 },
    { label: "Menjalankan Memetic Hybrid (GA + Local Search + ABC)...", pct: 90 },
    { label: "Mengompilasi Tabel & Kurva Perbandingan", pct: 97 },
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
  const [elapsedSec, setElapsedSec] = useState(0);

  const steps = ALGORITHM_STEPS[algorithm] || ALGORITHM_STEPS.HYBRID;

  useEffect(() => {
    if (!isCalculating) {
      setStepIndex(0);
      setElapsedSec(0);
      return;
    }

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedSec(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 650);

    return () => {
      clearInterval(timerInterval);
      clearInterval(stepInterval);
    };
  }, [isCalculating, algorithm, steps.length]);

  if (!isCalculating) return null;

  const currentStep = steps[stepIndex];

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs rounded-lg transition-all duration-200">
      <div
        className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl space-y-4 ${
          isDarkMode
            ? "bg-slate-900/95 border-slate-700 text-slate-100"
            : "bg-white/95 border-slate-200 text-slate-800"
        }`}
      >
        {/* Header Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600/15 text-indigo-500">
              <i className="ti ti-cpu text-xl animate-pulse"></i>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black tracking-tight">
                Optimasi Rute ({algorithm})
              </h4>
              <p className="text-[11px] opacity-65">
                Memproses di server Python Flask...
              </p>
            </div>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
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
          <div className="flex justify-between items-center text-[11px] font-semibold">
            <span className="text-indigo-500 truncate pr-2">
              {currentStep.label}
            </span>
            <span className="font-mono shrink-0">{currentStep.pct}%</span>
          </div>
          <div
            className={`w-full h-2.5 rounded-full overflow-hidden ${
              isDarkMode ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <div
              className="h-full bg-linear-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentStep.pct}%` }}
            />
          </div>
        </div>

        {/* Stepper Checklist */}
        <div
          className={`p-3 rounded-xl border space-y-2 text-[11px] ${
            isDarkMode
              ? "bg-slate-950/70 border-slate-800"
              : "bg-slate-50 border-slate-200/80"
          }`}
        >
          {steps.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  isDone || isCurrent ? "opacity-100" : "opacity-40"
                }`}
              >
                {isDone ? (
                  <i className="ti ti-circle-check-filled text-emerald-500 text-sm shrink-0"></i>
                ) : isCurrent ? (
                  <i className="ti ti-loader-2 text-indigo-500 text-sm animate-spin shrink-0"></i>
                ) : (
                  <i className="ti ti-circle text-slate-400 text-sm shrink-0"></i>
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
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] opacity-75">
          <span className="px-2 py-0.5 rounded bg-slate-500/10 font-semibold">
            {locationCount} Lokasi
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-500/10 font-semibold">
            {params.vehicles} Armada (Kap. {params.capacity})
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-500/10 font-semibold">
            {params.generations} Gen • {params.popSize} Pop
          </span>
        </div>
      </div>
    </div>
  );
}