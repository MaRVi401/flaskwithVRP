import React, { useState, useEffect, useMemo, useCallback } from "react";
import MapView from "./components/MapView";
import FitnessChart from "./components/FitnessChart";
import { useVrpSolver } from "./hooks/useVrpSolver";
import CalculationOverlay from "./components/CalculationOverlay";

const defaultLocations = [
  {
    id: "depot-1",
    name: "Alun-Alun Indramayu (Depot)",
    lat: -6.3265,
    lng: 108.32,
    demand: 0,
    isDepot: true,
  },
  {
    id: "loc-1",
    name: "Pasar Karangampel",
    lat: -6.4633,
    lng: 108.4522,
    demand: 12,
    isDepot: false,
  },
  {
    id: "loc-2",
    name: "Kecamatan Jatibarang",
    lat: -6.4712,
    lng: 108.3075,
    demand: 8,
    isDepot: false,
  },
  {
    id: "loc-3",
    name: "Kecamatan Losarang",
    lat: -6.3985,
    lng: 108.1485,
    demand: 15,
    isDepot: false,
  },
  {
    id: "loc-4",
    name: "Kecamatan Haurgeulis",
    lat: -6.4589,
    lng: 107.9421,
    demand: 10,
    isDepot: false,
  },
  {
    id: "loc-5",
    name: "Pelabuhan Eretan",
    lat: -6.3021,
    lng: 108.0125,
    demand: 18,
    isDepot: false,
  },
  {
    id: "loc-6",
    name: "POLINDRA",
    lat: -6.4063,
    lng: 108.2825,
    demand: 9,
    isDepot: false,
  },
];

const routeColors = [
  "#E63946",
  "#2A9D8F",
  "#F4A261",
  "#9C27B0",
  "#3F51B5",
  "#00BCD4",
  "#E91E63",
  "#8BC34A",
];

const EMPTY_ROUTES = [];

// Parser baris CSV yang aman terhadap tanda kutip (mis. "Pasar Baru, Indramayu")
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default function App() {
  const [locations, setLocations] = useState(defaultLocations);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [algorithm, setAlgorithm] = useState("HYBRID");
  const [params, setParams] = useState({
    capacity: 35,
    vehicles: 3,
    generations: 100,
    popSize: 40,
    seed: "",
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("vrp_dark_mode");
      if (saved !== null) return saved === "true";
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch {
      return false;
    }
  });

  const [alertModal, setAlertModal] = useState(null);
  const [showTradeOff, setShowTradeOff] = useState(false);
  const [benchmarkView, setBenchmarkView] = useState("table"); // 'table' | 'chart'
  const [singleView, setSingleView] = useState("chart"); // 'chart' | 'log'
  const [onlyImprovements, setOnlyImprovements] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [isRouteOutdated, setIsRouteOutdated] = useState(false);
  const [mobileTab, setMobileTab] = useState("result"); // 'result' | 'locations' | 'params'

  const [manualInput, setManualInput] = useState({
    name: "",
    lat: "",
    lng: "",
    demand: 10,
    isDepot: false,
  });

  const [editingLoc, setEditingLoc] = useState(null);
  const {
    isCalculating,
    isLoadingDataset,
    result,
    benchmarkResult,
    runSolver,
    cancelSolver,
    loadDatasetFromApi,
    error,
  } = useVrpSolver();

  const showAlert = useCallback((message, type = "error", title = null) => {
    const defaultTitles = {
      error: "Terjadi Kesalahan",
      success: "Berhasil!",
      info: "Informasi",
    };
    setAlertModal({
      title: title || defaultTitles[type] || "Pemberitahuan",
      message,
      type,
    });
  }, []);

  useEffect(() => {
    if (!alertModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        setAlertModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alertModal]);

  useEffect(() => {
    try {
      localStorage.setItem("vrp_dark_mode", String(isDarkMode));
    } catch {
      // Abaikan jika storage penuh/diblokir
    }
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const updateLocations = useCallback((newLocations, shouldFitMap = false) => {
    setLocations(newLocations);
    setIsRouteOutdated(true);
    if (shouldFitMap) {
      setFitTrigger((prev) => prev + 1);
    }
  }, []);

  const updateParams = (newParams) => {
    setParams(newParams);
    setIsRouteOutdated(true);
  };

  const handleAlgorithmChange = (newAlg) => {
    setAlgorithm(newAlg);
    setIsRouteOutdated(true);
  };

  const handleRunOptimization = async () => {
    const hasDepot = locations.some((l) => l.isDepot);
    const customerCount = locations.filter((l) => !l.isDepot).length;

    if (!hasDepot || customerCount === 0) {
      showAlert(
        "Pastikan terdapat minimal 1 Depot dan 1 titik pelanggan sebelum menjalankan optimasi.",
        "error",
        "Data Belum Lengkap",
      );
      return;
    }
    if (
      params.capacity <= 0 ||
      params.vehicles <= 0 ||
      params.generations <= 0 ||
      params.popSize < 2
    ) {
      showAlert(
        "Parameter Kapasitas, Armada, Generasi (>= 1), dan Populasi (>= 2) harus diisi dengan angka yang valid.",
        "error",
        "Parameter Tidak Valid",
      );
      return;
    }

    setIsRouteOutdated(false);
    setShowTradeOff(false);
    setBenchmarkView("table");
    setMobileTab("result");

    const res = await runSolver(algorithm, locations, params);
    if (res?.error) {
      showAlert(res.error, "error", "Gagal Memproses Optimasi");
    } else if (res?.aborted) {
      showAlert(
        "Permintaan optimasi telah dibatalkan.",
        "info",
        "Proses Dibatalkan",
      );
    }
  };

  const handleLoadBackendDataset = async () => {
    const res = await loadDatasetFromApi();
    if (res?.error) {
      showAlert(res.error, "error", "Gagal Memuat Dataset");
      return;
    }
    if (res?.data && res.data.length > 0) {
      updateLocations(res.data, true);
      if (params.capacity * params.vehicles < 250) {
        updateParams({
          ...params,
          capacity: 100,
          vehicles: 4,
        });
      }
      showAlert(
        `Berhasil memuat ${res.data.length} titik lokasi dari server Flask.`,
        "success",
        "Dataset Dimuat!",
      );
    }
  };

  const handleMapClick = useCallback((latlng) => {
    setLocations((prev) => {
      const hasDepot = prev.some((l) => l.isDepot);
      const newLoc = {
        id: `loc-${Date.now()}`,
        name: `Titik Peta ${prev.length + 1}`,
        lat: latlng.lat,
        lng: latlng.lng,
        demand: hasDepot ? 10 : 0,
        isDepot: !hasDepot,
      };
      return [...prev, newLoc];
    });
    setIsRouteOutdated(true);
  }, []);

  const handleAddManual = (e) => {
    e.preventDefault();
    if (!manualInput.lat || !manualInput.lng) return;

    let updatedLocations = [...locations];
    if (manualInput.isDepot) {
      updatedLocations = updatedLocations.map((loc) => ({
        ...loc,
        isDepot: false,
      }));
    }

    const newLoc = {
      id: `loc-${Date.now()}`,
      name: manualInput.name.trim() || `Lokasi ${locations.length + 1}`,
      lat: parseFloat(manualInput.lat),
      lng: parseFloat(manualInput.lng),
      demand: manualInput.isDepot
        ? 0
        : Math.max(0, parseInt(manualInput.demand, 10) || 0),
      isDepot: manualInput.isDepot,
    };

    updateLocations([...updatedLocations, newLoc], false);
    setManualInput({ name: "", lat: "", lng: "", demand: 10, isDepot: false });
  };

  const handleSetDepot = (id) => {
    updateLocations(
      locations.map((loc) => ({
        ...loc,
        isDepot: loc.id === id,
        demand: loc.id === id ? 0 : loc.demand > 0 ? loc.demand : 10,
      })),
      false,
    );
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingLoc) return;

    const updated = locations.map((loc) => {
      if (loc.id === editingLoc.id) {
        return {
          ...editingLoc,
          name: editingLoc.name.trim() || loc.name,
          lat: parseFloat(editingLoc.lat),
          lng: parseFloat(editingLoc.lng),
          demand: editingLoc.isDepot
            ? 0
            : Math.max(0, parseInt(editingLoc.demand, 10) || 0),
        };
      }
      if (editingLoc.isDepot) {
        return { ...loc, isDepot: false };
      }
      return loc;
    });

    updateLocations(updated, false);
    setEditingLoc(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsed = [];
        if (file.name.endsWith(".json")) {
          const raw = JSON.parse(event.target.result);
          if (!Array.isArray(raw)) throw new Error("Format JSON harus array");
          raw.forEach((item, idx) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              const depotFlag = Boolean(item.isDepot);
              parsed.push({
                id: item.id || `json-${idx}-${Date.now()}`,
                name: String(item.name || `Loc ${idx + 1}`),
                lat,
                lng,
                demand: depotFlag
                  ? 0
                  : Math.max(0, parseInt(item.demand, 10) || 0),
                isDepot: depotFlag,
              });
            }
          });
        } else if (file.name.endsWith(".csv")) {
          const lines = event.target.result
            .split(/\r?\n/)
            .filter((l) => l.trim());
          lines.slice(1).forEach((line, idx) => {
            const parts = parseCsvLine(line);
            if (parts.length >= 3) {
              const isDepotRaw = parts[parts.length - 1];
              const demandRaw = parts[parts.length - 2];
              const lngRaw = parts[parts.length - 3];
              const latRaw = parts[parts.length - 4];
              const nameRaw = parts.slice(0, parts.length - 4).join(", ");

              const lat = parseFloat(latRaw);
              const lng = parseFloat(lngRaw);
              if (!isNaN(lat) && !isNaN(lng)) {
                const depotFlag =
                  (isDepotRaw || "").trim().toLowerCase() === "true";
                parsed.push({
                  id: `csv-${idx}-${Date.now()}`,
                  name: nameRaw || `Loc ${idx + 1}`,
                  lat,
                  lng,
                  demand: depotFlag
                    ? 0
                    : Math.max(0, parseInt(demandRaw, 10) || 0),
                  isDepot: depotFlag,
                });
              }
            }
          });
        }

        if (parsed.length === 0) {
          showAlert(
            "Dataset kosong atau koordinat tidak valid.",
            "error",
            "Gagal Import",
          );
          return;
        }

        let depotAssigned = false;
        parsed = parsed.map((item) => {
          if (item.isDepot && !depotAssigned) {
            depotAssigned = true;
            return { ...item, demand: 0 };
          }
          return { ...item, isDepot: false };
        });

        if (!depotAssigned) {
          parsed[0].isDepot = true;
          parsed[0].demand = 0;
        }

        updateLocations(parsed, true);
        showAlert(
          `Berhasil mengimpor ${parsed.length} lokasi dari file.`,
          "success",
          "Import Berhasil!",
        );
      } catch {
        showAlert(
          "Format file tidak valid! Pastikan struktur CSV atau JSON sesuai.",
          "error",
          "Format File Salah",
        );
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExportResult = () => {
    if (!activeResult) return;
    const usedAlg =
      activeResult.winnerAlgorithm || activeResult.algorithm || algorithm;
    const payload = {
      algorithm: usedAlg,
      params,
      totalDistanceKm: Number(activeResult.bestDistance.toFixed(2)),
      executionTimeMs: activeResult.executionTime || activeResult.time,
      isFeasible: activeResult.isFeasible,
      metrics: activeResult.metrics || null,
      routes: activeResult.bestRoutes.map((r, idx) => ({
        armada: idx + 1,
        load: r.reduce((sum, cIdx) => sum + (locations[cIdx]?.demand || 0), 0),
        stops: r.map((cIdx) => locations[cIdx]?.name),
      })),
      benchmark: activeBenchmark || null,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vrp-result-${usedAlg.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeResult = !isRouteOutdated ? result : null;
  const activeBenchmark = !isRouteOutdated ? benchmarkResult : null;

  const memoizedRoutes = useMemo(() => {
    return activeResult ? activeResult.bestRoutes : EMPTY_ROUTES;
  }, [activeResult]);

  // Precompute baris log iterasi beserta delta & filter perbaikan
  const logRows = useMemo(() => {
    const hist = activeResult?.history || [];
    const mapped = hist.map((item, idx, arr) => {
      const prevFit = idx > 0 ? arr[idx - 1].fitness : item.fitness;
      const diff = Number((item.fitness - prevFit).toFixed(2));
      return {
        ...item,
        diff,
        isImproved: idx === 0 || diff < 0,
        phaseLabel:
          item.phase ||
          (item.generation <= Math.floor(params.generations * 0.6)
            ? "GA Exploration"
            : "ABC Exploitation"),
      };
    });
    return onlyImprovements ? mapped.filter((r) => r.isImproved) : mapped;
  }, [activeResult, onlyImprovements, params.generations]);

  const feasibilityInfo = useMemo(() => {
    const customers = locations.filter((l) => !l.isDepot);
    const totalCustomerDemand = customers.reduce(
      (sum, l) => sum + (l.demand || 0),
      0,
    );
    const totalFleetCapacity =
      (Number(params.capacity) || 0) * (Number(params.vehicles) || 0);
    const oversizedCustomer = customers.find(
      (l) => (l.demand || 0) > (Number(params.capacity) || 0),
    );

    const isTotalOver = totalCustomerDemand > totalFleetCapacity;
    const isSingleOver = Boolean(oversizedCustomer);
    const isFeasible = !isTotalOver && !isSingleOver;

    let reason = "";
    if (isSingleOver) {
      reason = `Demand "${oversizedCustomer.name}" (${oversizedCustomer.demand}) melebihi kapasitas armada (${params.capacity})`;
    } else if (isTotalOver) {
      reason = `Total demand (${totalCustomerDemand}) melebihi total kapasitas (${totalFleetCapacity})`;
    }

    return {
      totalCustomerDemand,
      totalFleetCapacity,
      isFeasible,
      isSingleOver,
      reason,
    };
  }, [locations, params.capacity, params.vehicles]);

  const cardSurface = isDarkMode
    ? "bg-slate-800/95 border-slate-700/80"
    : "bg-white border-slate-200/90";

  const inputSurface = isDarkMode
    ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
    : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none";

  // Helper render konten Analitik (dipakai baik di panel bawah maupun modal fullscreen)
  const renderAnalyticsContent = (isExpanded = false) => {
    if (activeBenchmark) {
      return (
        <div className="h-full flex flex-col min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
            <h3
              className={`${
                isExpanded ? "text-sm" : "text-xs"
              } font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5`}
            >
              <i className="ti ti-flame text-orange-500 text-base"></i>
              <span>Perbandingan Benchmark Algoritma</span>
            </h3>

            <div className="flex items-center gap-1.5">
              <div
                className={`inline-flex p-0.5 rounded-lg border ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-700"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                <button
                  onClick={() => setBenchmarkView("table")}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition flex items-center gap-1 ${
                    benchmarkView === "table"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isDarkMode
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="ti ti-table text-xs"></i>
                  <span>Tabel</span>
                </button>
                <button
                  onClick={() => setBenchmarkView("chart")}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition flex items-center gap-1 ${
                    benchmarkView === "chart"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isDarkMode
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="ti ti-chart-line text-xs"></i>
                  <span>Kurva</span>
                </button>
              </div>

              <button
                onClick={() => setIsAnalyticsExpanded(!isExpanded)}
                title={
                  isExpanded ? "Perkecil Tampilan" : "Perbesar Tabel & Grafik"
                }
                className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <i
                  className={`ti ${
                    isExpanded ? "ti-arrows-minimize" : "ti-arrows-maximize"
                  } text-sm`}
                ></i>
              </button>
            </div>
          </div>

          {benchmarkView === "table" ? (
            <div
              className={`flex-1 overflow-auto rounded-xl border ${
                isDarkMode ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <table className="w-full text-left border-collapse min-w-[460px]">
                <thead
                  className={`text-[10px] sm:text-[11px] uppercase sticky top-0 z-10 ${
                    isDarkMode
                      ? "bg-slate-900 text-slate-300 border-b border-slate-700"
                      : "bg-slate-100 text-slate-700 border-b border-slate-200"
                  }`}
                >
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">Algoritma</th>
                    <th className="py-2 px-3 whitespace-nowrap">Total Jarak</th>
                    <th className="py-2 px-3 whitespace-nowrap">Efisiensi</th>
                    <th className="py-2 px-3 whitespace-nowrap">Waktu CPU</th>
                    <th className="py-2 px-3 whitespace-nowrap">Evaluasi</th>
                    <th className="py-2 px-3 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y text-xs ${
                    isDarkMode ? "divide-slate-700/80" : "divide-slate-200"
                  }`}
                >
                  {Object.entries(activeBenchmark).map(([alg, d]) => {
                    const isWinner = activeResult?.winnerAlgorithm === alg;
                    return (
                      <tr
                        key={alg}
                        className={`transition-colors ${
                          isWinner
                            ? isDarkMode
                              ? "bg-indigo-950/50"
                              : "bg-indigo-50/80"
                            : isDarkMode
                              ? "hover:bg-slate-900/50"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-extrabold text-indigo-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{alg}</span>
                            {isWinner && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                                ★ Terbaik
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                          {d.bestDistance.toFixed(2)} km
                        </td>
                        <td className="py-2.5 px-3 text-emerald-500 font-bold whitespace-nowrap">
                          -{d.metrics?.reductionPct ?? 0}%
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {d.time} ms
                        </td>
                        <td className="py-2.5 px-3 font-mono opacity-80 whitespace-nowrap">
                          {d.metrics?.totalEvaluations ?? "-"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {d.isFeasible === false ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[11px] font-bold inline-flex items-center gap-1">
                              <i className="ti ti-alert-triangle text-xs"></i>
                              Overload
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[11px] font-bold inline-flex items-center gap-1">
                              <i className="ti ti-circle-check text-xs"></i>
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 min-h-[160px] w-full">
              <FitnessChart
                benchmarkData={activeBenchmark}
                isDarkMode={isDarkMode}
                isExpanded={isExpanded}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
          <h3
            className={`${
              isExpanded ? "text-sm" : "text-xs"
            } font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5`}
          >
            <i className="ti ti-chart-line text-indigo-500 text-base"></i>
            <span>
              {singleView === "chart"
                ? "Kurva Konvergensi Fitness"
                : "Efektivitas & Log Iterasi"}
            </span>
          </h3>

          <div className="flex items-center gap-1.5">
            {activeResult && (
              <div
                className={`inline-flex p-0.5 rounded-lg border ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-700"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                <button
                  onClick={() => setSingleView("chart")}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition flex items-center gap-1 ${
                    singleView === "chart"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isDarkMode
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="ti ti-chart-line text-xs"></i>
                  <span>Kurva</span>
                </button>
                <button
                  onClick={() => setSingleView("log")}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition flex items-center gap-1 ${
                    singleView === "log"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isDarkMode
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <i className="ti ti-list-details text-xs"></i>
                  <span>Log & Efektivitas</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setIsAnalyticsExpanded(!isExpanded)}
              title={
                isExpanded ? "Perkecil Tampilan" : "Perbesar Tabel & Grafik"
              }
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                isDarkMode
                  ? "bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <i
                className={`ti ${
                  isExpanded ? "ti-arrows-minimize" : "ti-arrows-maximize"
                } text-sm`}
              ></i>
            </button>
          </div>
        </div>

        {singleView === "log" && activeResult ? (
          <div className="flex-1 flex flex-col min-h-0 gap-2 text-xs">
            {/* Kartu Ringkasan Efektivitas & Splitting (Responsif tanpa teks terpotong) */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl border shrink-0 ${
                isDarkMode
                  ? "bg-slate-900/90 border-slate-700"
                  : "bg-indigo-50/70 border-indigo-200/80"
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold opacity-65 uppercase tracking-wide">
                  Efektivitas Jarak
                </div>
                <div className="font-black text-emerald-500 text-xs leading-snug">
                  -{activeResult.metrics?.reductionPct ?? 0}%{" "}
                  <span className="font-mono font-semibold opacity-90">
                    ({activeResult.metrics?.initialDistance} →{" "}
                    {activeResult.metrics?.finalDistance} km)
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-bold opacity-65 uppercase tracking-wide">
                  Fase & Splitting
                </div>
                <div className="font-bold text-xs leading-snug break-words">
                  {activeResult.metrics?.phaseSplit ||
                    `${params.generations} Gen • Split Prins DP`}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-bold opacity-65 uppercase tracking-wide">
                  Pergerakan Solusi
                </div>
                <div className="font-bold text-xs leading-snug">
                  {activeResult.metrics?.improvementSteps ?? 0}x Update •{" "}
                  <span className="font-mono">
                    {activeResult.metrics?.totalEvaluations ?? 0} Eval
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Log Iterasi */}
            <div className="flex items-center justify-between text-[11px] shrink-0 px-0.5">
              <span className="opacity-70 font-medium">
                Menampilkan <strong>{logRows.length}</strong> baris iterasi
              </span>
              <button
                type="button"
                onClick={() => setOnlyImprovements(!onlyImprovements)}
                className={`px-2 py-0.5 rounded-md font-bold border transition cursor-pointer flex items-center gap-1 ${
                  onlyImprovements
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : isDarkMode
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <i className="ti ti-filter text-xs"></i>
                <span>
                  {onlyImprovements
                    ? "Hanya Update (Aktif)"
                    : "Filter: Hanya Update"}
                </span>
              </button>
            </div>

            {/* Tabel Log Pergerakan Tiap Generasi */}
            <div
              className={`flex-1 min-h-[110px] overflow-auto border rounded-xl ${
                isDarkMode ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <table className="w-full text-left border-collapse min-w-[380px] text-[11px]">
                <thead
                  className={`uppercase sticky top-0 z-10 text-[10px] ${
                    isDarkMode
                      ? "bg-slate-900 text-slate-300 border-b border-slate-700"
                      : "bg-slate-100 text-slate-700 border-b border-slate-200"
                  }`}
                >
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">Iterasi</th>
                    <th className="py-2 px-3 whitespace-nowrap">
                      Fase Pencarian
                    </th>
                    <th className="py-2 px-3 whitespace-nowrap">
                      Jarak Terbaik
                    </th>
                    <th className="py-2 px-3 whitespace-nowrap">
                      Perubahan (Delta)
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isDarkMode ? "divide-slate-800" : "divide-slate-200"
                  }`}
                >
                  {logRows.map((item) => (
                    <tr
                      key={item.generation}
                      className={
                        item.diff < 0
                          ? isDarkMode
                            ? "bg-emerald-950/25"
                            : "bg-emerald-50/60"
                          : ""
                      }
                    >
                      <td className="py-1.5 px-3 font-mono font-bold whitespace-nowrap">
                        Gen #{item.generation}
                      </td>
                      <td className="py-1.5 px-3 opacity-85 whitespace-nowrap">
                        {item.phaseLabel}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold text-indigo-500 whitespace-nowrap">
                        {Number(item.fitness).toFixed(2)} km
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold whitespace-nowrap">
                        {item.diff < 0 ? (
                          <span className="text-emerald-500">
                            {item.diff.toFixed(2)} km
                          </span>
                        ) : (
                          <span className="opacity-45">0.00 km</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-[160px] w-full">
            <FitnessChart
              historyData={activeResult ? activeResult.history : []}
              isDarkMode={isDarkMode}
              isExpanded={isExpanded}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen lg:h-screen w-full p-2.5 sm:p-3.5 pb-20 lg:pb-3.5 font-sans flex flex-col lg:overflow-hidden transition-colors duration-200 ${
        isDarkMode
          ? "bg-slate-950 text-slate-100"
          : "bg-slate-100 text-slate-800"
      }`}
    >
      {/* Popup Modal Bergaya SweetAlert di Tengah Layar */}
      {alertModal && (
        <div
          onClick={() => setAlertModal(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm transition-opacity"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm p-6 rounded-2xl border shadow-2xl text-center space-y-4 transform transition-all ${
              isDarkMode
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            <div
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-4 ${
                alertModal.type === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                  : alertModal.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    : "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
              }`}
            >
              <i
                className={`ti ${
                  alertModal.type === "error"
                    ? "ti-x text-3xl"
                    : alertModal.type === "success"
                      ? "ti-check text-3xl"
                      : "ti-info-circle text-3xl"
                }`}
              ></i>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black tracking-tight">
                {alertModal.title}
              </h3>
              <p className="text-xs sm:text-sm opacity-75 leading-relaxed">
                {alertModal.message}
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => setAlertModal(null)}
                className={`w-full py-2.5 px-5 rounded-xl text-xs font-extrabold text-white shadow-md transition active:scale-[0.98] cursor-pointer ${
                  alertModal.type === "error"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : alertModal.type === "success"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                OK, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fullscreen untuk Tabel & Grafik (Bila diperbesar) */}
      {isAnalyticsExpanded && (
        <div
          onClick={() => setIsAnalyticsExpanded(false)}
          className="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-5xl h-[82vh] p-4 sm:p-6 rounded-2xl border shadow-2xl flex flex-col min-h-0 ${cardSurface}`}
          >
            {renderAnalyticsContent(true)}
          </div>
        </div>
      )}

      {/* 1. Sticky Header */}
      <header
        className={`sticky top-2 z-30 min-h-[3.25rem] px-3 sm:px-4 py-2 lg:py-0 rounded-xl shadow-sm border backdrop-blur-md flex items-center justify-between gap-2 shrink-0 mb-3 transition-colors ${cardSurface}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/15 text-indigo-500 flex items-center justify-center shrink-0">
            <i className="ti ti-route text-base"></i>
          </div>
          <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
            VRP Solver Indramayu
          </h1>
          <span
            className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold border shrink-0 ${
              isDarkMode
                ? "bg-indigo-950/80 text-indigo-300 border-indigo-800"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {algorithm}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div
            title={feasibilityInfo.reason || "Kapasitas armada mencukupi"}
            className={`hidden md:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
              feasibilityInfo.isFeasible
                ? isDarkMode
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isDarkMode
                  ? "bg-rose-950/50 border-rose-800 text-rose-300"
                  : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            <i
              className={`ti ${
                feasibilityInfo.isFeasible ? "ti-package" : "ti-alert-triangle"
              } text-sm`}
            ></i>
            <span>Muatan:</span>
            <strong>
              {feasibilityInfo.totalCustomerDemand} /{" "}
              {feasibilityInfo.totalFleetCapacity}
            </strong>
            {!feasibilityInfo.isFeasible && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase">
                Tidak Feasible
              </span>
            )}
          </div>

          {activeResult && (
            <button
              onClick={handleExportResult}
              title="Download Hasil JSON"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                isDarkMode
                  ? "bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600"
                  : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <i className="ti ti-download text-sm"></i>
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-amber-300 hover:bg-slate-600"
                : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <i
              className={`ti ${
                isDarkMode ? "ti-sun text-amber-300" : "ti-moon text-slate-700"
              } text-sm`}
            ></i>
            <span className="hidden sm:inline">
              {isDarkMode ? "Light" : "Dark"}
            </span>
          </button>

          <button
            onClick={handleRunOptimization}
            disabled={isCalculating}
            className="hidden lg:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:bg-slate-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <i
              className={`ti ${
                isCalculating ? "ti-loader-2 animate-spin" : "ti-player-play"
              } text-sm`}
            ></i>
            <span>{isCalculating ? "Kalkulasi..." : "Jalankan Optimasi"}</span>
          </button>
        </div>
      </header>

      {/* Banner Peringatan Kapasitas */}
      {!feasibilityInfo.isFeasible && (
        <div
          className={`mb-3 px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 shrink-0 ${
            isDarkMode
              ? "bg-rose-950/40 border-rose-800/80 text-rose-200"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <i className="ti ti-alert-triangle text-rose-500 text-base shrink-0"></i>
          <span>
            <strong>Peringatan Kapasitas (Tidak Feasible):</strong>{" "}
            {feasibilityInfo.reason}. Tingkatkan kapasitas per armada atau
            sesuaikan jumlah armada.
          </span>
        </div>
      )}

      {/* 2. Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 lg:overflow-hidden">
        {/* KOLOM KANAN (DESKTOP) / ATAS (MOBILE): Peta + Panel Hasil */}
        <div className="order-1 lg:order-2 lg:col-span-8 flex flex-col gap-3 min-h-0">
          {/* Peta Interaktif */}
          <div
            className={`p-2 rounded-xl shadow-sm border h-[280px] sm:h-[360px] lg:h-auto lg:flex-1 flex flex-col min-h-0 relative transition-colors ${cardSurface}`}
          >
            <div className="flex-1 rounded-lg overflow-hidden relative z-0">
              <MapView
                locations={locations}
                routes={memoizedRoutes}
                onMapClick={handleMapClick}
                fitTrigger={fitTrigger}
                isDarkMode={isDarkMode}
              />
            </div>
            <div className="mt-1.5 px-1 flex justify-between items-center text-[10px] opacity-65">
              <span className="flex items-center gap-1">
                <i className="ti ti-click text-xs text-indigo-500"></i>
                Ketuk peta untuk menambah titik pelanggan baru
              </span>
              <span className="font-semibold">
                {locations.length} Titik Terdaftar
              </span>
            </div>
          </div>

          {/* Navigasi Tab Khusus Mobile & Tablet (< lg) */}
          <div
            className={`grid grid-cols-3 gap-1 p-1 rounded-xl border lg:hidden ${cardSurface}`}
          >
            {[
              { id: "result", icon: "ti-chart-line", label: "Hasil & Grafik" },
              {
                id: "locations",
                icon: "ti-map-pin",
                label: `Lokasi (${locations.length})`,
              },
              {
                id: "params",
                icon: "ti-adjustments-horizontal",
                label: "Parameter",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  mobileTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : isDarkMode
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className={`ti ${tab.icon} text-sm`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Panel Hasil & Grafik (Tinggi lebih proporsional agar tabel & grafik lega) */}
          <div
            className={`${
              mobileTab === "result" ? "flex" : "hidden lg:flex"
            } h-auto md:h-[260px] lg:h-[275px] p-3.5 rounded-xl shadow-sm border shrink-0 flex-col md:flex-row gap-3.5 lg:overflow-hidden transition-colors ${cardSurface}`}
          >
            {/* Status Hasil Rute */}
            <div
              className={`w-full md:w-5/12 flex flex-col justify-between border-b md:border-b-0 md:border-r pb-3 md:pb-0 md:pr-3.5 min-h-0 ${
                isDarkMode ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <div className="flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5">
                    <i
                      className={`ti ${
                        showTradeOff
                          ? "ti-bulb text-amber-500"
                          : "ti-route-2 text-indigo-500"
                      } text-base`}
                    ></i>
                    <span>
                      {showTradeOff
                        ? "Analisis Trade-Off"
                        : activeResult?.winnerAlgorithm
                          ? `Terbaik (${activeResult.winnerAlgorithm})`
                          : "Hasil Optimasi"}
                    </span>
                  </h3>
                  <button
                    onClick={() => setShowTradeOff(!showTradeOff)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                      isDarkMode
                        ? "bg-indigo-950 text-indigo-300 hover:bg-indigo-900"
                        : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    }`}
                  >
                    <i
                      className={`ti ${
                        showTradeOff ? "ti-list-details" : "ti-scale"
                      } text-xs`}
                    ></i>
                    <span>{showTradeOff ? "Rute" : "Trade-Off"}</span>
                  </button>
                </div>

                {showTradeOff ? (
                  <div
                    className={`flex-1 min-h-0 overflow-auto rounded-xl border ${
                      isDarkMode ? "border-slate-700" : "border-slate-200"
                    }`}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead
                        className={`text-[10px] uppercase sticky top-0 ${
                          isDarkMode
                            ? "bg-slate-900 text-slate-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <tr>
                          <th className="p-2">Armada</th>
                          <th className="p-2">Jarak</th>
                          <th className="p-2">Waktu</th>
                          <th className="p-2">BBM</th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${
                          isDarkMode ? "divide-slate-700" : "divide-slate-200"
                        }`}
                      >
                        <tr>
                          <td className="p-2 font-bold">Sedikit</td>
                          <td className="p-2 text-emerald-500 font-semibold">
                            Pendek
                          </td>
                          <td className="p-2 text-amber-500 font-semibold">
                            Lama
                          </td>
                          <td className="p-2 text-emerald-500 font-semibold">
                            Hemat
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold">Banyak</td>
                          <td className="p-2 text-rose-500 font-semibold">
                            Panjang
                          </td>
                          <td className="p-2 text-emerald-500 font-semibold">
                            Cepat
                          </td>
                          <td className="p-2 text-rose-500 font-semibold">
                            Boros
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : activeResult ? (
                  <div className="flex flex-col h-full min-h-0 space-y-2">
                    <div className="shrink-0 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-xl sm:text-2xl font-black text-indigo-500">
                          {activeResult.bestDistance.toFixed(2)} km
                        </span>
                        <div className="text-[11px] opacity-70 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-0.5">
                            <i className="ti ti-clock text-xs"></i>
                            {activeResult.executionTime || activeResult.time} ms
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-0.5">
                            <i className="ti ti-truck text-xs"></i>
                            {activeResult.bestRoutes.length} Armada
                          </span>
                          {activeResult.metrics?.reductionPct > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-500 font-bold">
                                -{activeResult.metrics.reductionPct}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {activeResult.isFeasible === false ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1 shrink-0">
                          <i className="ti ti-alert-triangle text-xs"></i>
                          Overload
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                          <i className="ti ti-circle-check text-xs"></i>
                          Valid
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-h-60 md:max-h-none flex-1 min-h-0 overflow-y-auto space-y-1.5 text-[11px] border-t pt-2 pr-1 ${
                        isDarkMode ? "border-slate-700" : "border-slate-100"
                      }`}
                    >
                      {activeResult.bestRoutes.map((r, i) => {
                        const routeLoad = r.reduce(
                          (sum, cIdx) => sum + (locations[cIdx]?.demand || 0),
                          0,
                        );
                        const isOverload = routeLoad > params.capacity;
                        const badgeColor = routeColors[i % routeColors.length];

                        return (
                          <div
                            key={i}
                            style={{ borderLeftColor: badgeColor }}
                            className={`p-2 rounded-lg border border-l-4 leading-snug ${
                              isDarkMode
                                ? "bg-slate-900/90 border-slate-700 text-slate-200"
                                : "bg-slate-50 border-slate-200/80 text-slate-700"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[11px] flex items-center gap-1">
                                <i className="ti ti-truck-delivery text-xs opacity-75"></i>
                                Armada #{i + 1}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isOverload
                                    ? "bg-rose-500/15 text-rose-500"
                                    : "bg-emerald-500/15 text-emerald-500"
                                }`}
                              >
                                {routeLoad}/{params.capacity} unit
                              </span>
                            </div>
                            <div className="text-[11px] opacity-90 flex flex-wrap items-center gap-1 leading-relaxed">
                              <span className="font-semibold">Depot</span>
                              {r.map((c, idx) => (
                                <React.Fragment key={idx}>
                                  <i className="ti ti-arrow-right text-[10px] opacity-50"></i>
                                  <span>{locations[c]?.name}</span>
                                </React.Fragment>
                              ))}
                              <i className="ti ti-arrow-right text-[10px] opacity-50"></i>
                              <span className="font-semibold">Depot</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-xs opacity-60 italic py-4 px-2 gap-1.5">
                    <i className="ti ti-info-circle text-xl"></i>
                    <span>
                      {isCalculating
                        ? "Menghitung rute optimal..."
                        : isRouteOutdated
                          ? "Data atau parameter berubah. Jalankan optimasi untuk hasil terbaru."
                          : "Tekan 'Jalankan Optimasi' untuk memulai pencarian rute terbaik."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan Panel Bawah: Grafik Konvergensi / Tabel Benchmark / Log Iterasi */}
            <div className="w-full md:w-7/12 h-64 md:h-full flex flex-col min-h-0 overflow-hidden">
              {renderAnalyticsContent(false)}
            </div>
          </div>
        </div>

        {/* KOLOM KIRI (DESKTOP) / TAB LOKASI & PARAMETER (MOBILE) */}
        <div className="order-2 lg:order-1 lg:col-span-4 flex flex-col gap-3 min-h-0">
          {/* Panel Parameter Algoritma */}
          <div
            className={`${
              mobileTab === "params" ? "block" : "hidden lg:block"
            } p-3 rounded-xl shadow-sm border shrink-0 space-y-2.5 transition-colors ${cardSurface}`}
          >
            <div className="flex justify-between items-center gap-1">
              <h2 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <i className="ti ti-adjustments-horizontal text-indigo-500 text-sm"></i>
                <span>Konfigurasi Algoritma</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadBackendDataset}
                  disabled={isLoadingDataset}
                  title="Muat dataset 31 kecamatan langsung dari server Flask (/api/dataset)"
                  className="text-[11px] text-emerald-500 hover:underline font-bold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <i
                    className={`ti ${
                      isLoadingDataset
                        ? "ti-loader-2 animate-spin"
                        : "ti-database-import"
                    } text-xs`}
                  ></i>
                  <span>31 Kec (API)</span>
                </button>
                <span className="opacity-30 text-xs">|</span>
                <input
                  type="file"
                  accept=".csv, .json"
                  onChange={handleFileUpload}
                  id="file-upload"
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="text-[11px] text-indigo-500 hover:underline font-bold cursor-pointer flex items-center gap-1"
                >
                  <i className="ti ti-upload text-xs"></i>
                  <span>Import</span>
                </label>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <select
                value={algorithm}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
                className={`w-full p-2 lg:p-1.5 border rounded-lg font-bold text-xs ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-700 text-indigo-300"
                    : "bg-slate-50 border-slate-200 text-indigo-700"
                }`}
              >
                <option value="HYBRID">Hybrid (GA + ABC)</option>
                <option value="GA">Genetic Algorithm (GA)</option>
                <option value="ABC">Artificial Bee Colony (ABC)</option>
                <option value="BENCHMARK">Benchmark Semua Algoritma</option>
              </select>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                {[
                  { key: "capacity", label: "Kapasitas", minVal: 1 },
                  { key: "vehicles", label: "Armada", minVal: 1 },
                  { key: "generations", label: "Generasi", minVal: 1 },
                  { key: "popSize", label: "Populasi", minVal: 2 },
                ].map(({ key, label, minVal }) => (
                  <div key={key}>
                    <label className="opacity-70 block truncate mb-0.5 font-medium">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={minVal}
                      value={params[key]}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateParams({
                          ...params,
                          [key]:
                            raw === ""
                              ? ""
                              : Math.max(0, parseInt(raw, 10) || 0),
                        });
                      }}
                      onBlur={() => {
                        const num = parseInt(params[key], 10);
                        if (isNaN(num) || num < minVal) {
                          updateParams({
                            ...params,
                            [key]: minVal,
                          });
                        }
                      }}
                      className={`w-full p-2 lg:p-1 border rounded-lg text-center font-bold text-xs ${inputSurface}`}
                    />
                  </div>
                ))}
              </div>

              {/* Checkbox Pengunci Hasil Acak */}
              <label
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition ${
                  params.seed !== ""
                    ? isDarkMode
                      ? "bg-indigo-950/50 border-indigo-700/80 text-indigo-300"
                      : "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : isDarkMode
                      ? "bg-slate-900/70 border-slate-700/80 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    checked={params.seed !== ""}
                    onChange={(e) =>
                      updateParams({
                        ...params,
                        seed: e.target.checked ? 42 : "",
                      })
                    }
                    className="rounded accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Kunci hasil optimasi (Konsisten)</span>
                </span>
                <span className="text-[10px] font-bold opacity-75">
                  {params.seed !== "" ? "Terkunci" : "Acak"}
                </span>
              </label>
            </div>
          </div>

          {/* Panel Form Tambah Lokasi Manual */}
          <div
            className={`${
              mobileTab === "locations" ? "block" : "hidden lg:block"
            } p-3 rounded-xl shadow-sm border shrink-0 space-y-2 transition-colors ${cardSurface}`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <i className="ti ti-map-pin-plus text-indigo-500 text-sm"></i>
              <span>Tambah Titik Lokasi</span>
            </h2>
            <form onSubmit={handleAddManual} className="space-y-2 text-xs">
              <input
                type="text"
                placeholder="Nama Lokasi (cth: Pasar Baru)"
                value={manualInput.name}
                onChange={(e) =>
                  setManualInput({ ...manualInput, name: e.target.value })
                }
                className={`w-full px-2.5 py-2 lg:py-1.5 border rounded-lg transition ${inputSurface}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (-6.xxx)"
                  value={manualInput.lat}
                  onChange={(e) =>
                    setManualInput({ ...manualInput, lat: e.target.value })
                  }
                  className={`px-2.5 py-2 lg:py-1.5 border rounded-lg transition ${inputSurface}`}
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (108.xxx)"
                  value={manualInput.lng}
                  onChange={(e) =>
                    setManualInput({ ...manualInput, lng: e.target.value })
                  }
                  className={`px-2.5 py-2 lg:py-1.5 border rounded-lg transition ${inputSurface}`}
                  required
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] opacity-70">Demand:</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={manualInput.demand}
                    disabled={manualInput.isDepot}
                    onChange={(e) =>
                      setManualInput({ ...manualInput, demand: e.target.value })
                    }
                    className={`w-20 px-2 py-1.5 lg:py-1 border rounded-lg disabled:opacity-40 font-semibold ${inputSurface}`}
                  />
                </div>
                <label className="flex items-center text-[11px] gap-1.5 cursor-pointer font-semibold text-rose-500">
                  <input
                    type="checkbox"
                    checked={manualInput.isDepot}
                    onChange={(e) =>
                      setManualInput({
                        ...manualInput,
                        isDepot: e.target.checked,
                      })
                    }
                    className="rounded accent-rose-600"
                  />
                  <span>Jadikan Depot</span>
                </label>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg font-bold transition ml-auto bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <i className="ti ti-plus text-xs"></i>
                  <span>Tambah</span>
                </button>
              </div>
            </form>
          </div>

          {/* List Kelola Lokasi */}
          <div
            className={`${
              mobileTab === "locations" ? "flex" : "hidden lg:flex"
            } p-3 rounded-xl shadow-sm border max-h-96 lg:max-h-none lg:flex-1 flex-col min-h-0 transition-colors ${cardSurface}`}
          >
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <i className="ti ti-list-check text-indigo-500 text-sm"></i>
                <span>Daftar Titik ({locations.length})</span>
              </h2>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => updateLocations(defaultLocations, true)}
                  className="text-[11px] text-indigo-500 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <i className="ti ti-rotate-clockwise text-xs"></i>
                  <span>Default</span>
                </button>
                <button
                  onClick={() => updateLocations([], false)}
                  className="text-[11px] text-rose-500 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <i className="ti ti-trash text-xs"></i>
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div
              className={`flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs border-t pt-2 ${
                isDarkMode ? "border-slate-700" : "border-slate-100"
              }`}
            >
              {locations.length === 0 ? (
                <div className="text-center py-6 text-xs opacity-50 italic">
                  Belum ada lokasi. Ketuk peta atau tambahkan manual.
                </div>
              ) : (
                locations.map((loc) => {
                  const isOversized =
                    !loc.isDepot && (loc.demand || 0) > params.capacity;
                  return (
                    <div
                      key={loc.id}
                      className={`p-2 rounded-lg border flex justify-between items-center gap-2 transition ${
                        loc.isDepot
                          ? isDarkMode
                            ? "bg-rose-950/35 border-rose-800/80"
                            : "bg-rose-50/90 border-rose-200"
                          : isOversized
                            ? isDarkMode
                              ? "bg-amber-950/40 border-amber-700/80"
                              : "bg-amber-50 border-amber-300"
                            : isDarkMode
                              ? "bg-slate-900/90 border-slate-700/80"
                              : "bg-slate-50 border-slate-200/70"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold flex items-center gap-1.5 truncate text-xs">
                          <i
                            className={`ti ${
                              loc.isDepot
                                ? "ti-building-warehouse text-rose-500"
                                : isOversized
                                  ? "ti-alert-triangle text-amber-500"
                                  : "ti-map-pin text-indigo-500"
                            } text-sm shrink-0`}
                          ></i>
                          <span
                            className={`truncate ${
                              loc.isDepot ? "text-rose-500" : "opacity-95"
                            }`}
                          >
                            {loc.name}
                          </span>
                          {loc.isDepot && (
                            <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-extrabold shrink-0">
                              DEPOT
                            </span>
                          )}
                          {isOversized && (
                            <span className="bg-amber-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded font-extrabold shrink-0">
                              &gt; KAP
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] opacity-60 truncate mt-0.5 pl-5">
                          {loc.isDepot
                            ? "Pusat Distribusi"
                            : `Demand: ${loc.demand} unit`}{" "}
                          • ({loc.lat.toFixed(4)}, {loc.lng.toFixed(4)})
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!loc.isDepot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDepot(loc.id);
                            }}
                            title="Jadikan Depot"
                            className={`px-2 py-1.5 lg:py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                              isDarkMode
                                ? "bg-rose-950 text-rose-300 hover:bg-rose-900"
                                : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            }`}
                          >
                            Depot
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLoc(loc);
                          }}
                          title="Edit Lokasi"
                          className={`p-1.5 lg:p-1 rounded-md text-xs transition cursor-pointer ${
                            isDarkMode
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          <i className="ti ti-pencil text-xs"></i>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateLocations(
                              locations.filter((l) => l.id !== loc.id),
                              false,
                            );
                          }}
                          className="text-rose-500 hover:bg-rose-500/10 rounded-md p-1.5 lg:p-1 transition cursor-pointer"
                          title="Hapus lokasi"
                        >
                          <i className="ti ti-x text-xs"></i>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bottom Action Bar (Khusus Mobile & Tablet < lg) */}
      <div
        className={`fixed bottom-0 inset-x-0 z-30 p-2.5 border-t backdrop-blur-md flex items-center justify-between gap-3 lg:hidden ${
          isDarkMode
            ? "bg-slate-900/95 border-slate-800"
            : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="text-[11px] leading-tight">
          <div className="opacity-60">Total Muatan / Kapasitas</div>
          <div
            className={`font-extrabold ${
              feasibilityInfo.isFeasible ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {feasibilityInfo.totalCustomerDemand} /{" "}
            {feasibilityInfo.totalFleetCapacity} unit ({params.vehicles} Armada)
            {!feasibilityInfo.isFeasible && " • Tidak Feasible"}
          </div>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={isCalculating}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-slate-500 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold transition shadow-md shrink-0 flex items-center gap-1.5"
        >
          <i
            className={`ti ${
              isCalculating ? "ti-loader-2 animate-spin" : "ti-player-play"
            } text-sm`}
          ></i>
          <span>{isCalculating ? "Menghitung..." : "Jalankan Optimasi"}</span>
        </button>
      </div>

      {/* Modal Proses Kalkulasi Interaktif */}
      <CalculationOverlay
        isCalculating={isCalculating}
        onCancel={cancelSolver}
        algorithm={algorithm}
        params={params}
        locationCount={locations.length}
        isDarkMode={isDarkMode}
        error={error}
      />

      {/* Modal Edit Pop-up */}
      {editingLoc && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div
            className={`rounded-2xl p-4 max-w-sm w-full shadow-2xl border space-y-3 ${cardSurface}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <i className="ti ti-edit text-indigo-500 text-sm"></i>
                <span>Edit Data Lokasi</span>
              </h3>
              <button
                onClick={() => setEditingLoc(null)}
                className="opacity-60 hover:opacity-100 p-1 cursor-pointer"
              >
                <i className="ti ti-x text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] opacity-60 block mb-1">
                  Nama Lokasi
                </label>
                <input
                  type="text"
                  value={editingLoc.name}
                  onChange={(e) =>
                    setEditingLoc({ ...editingLoc, name: e.target.value })
                  }
                  className={`w-full p-2 border rounded-lg ${inputSurface}`}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] opacity-60 block mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingLoc.lat}
                    onChange={(e) =>
                      setEditingLoc({ ...editingLoc, lat: e.target.value })
                    }
                    className={`w-full p-2 border rounded-lg ${inputSurface}`}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] opacity-60 block mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingLoc.lng}
                    onChange={(e) =>
                      setEditingLoc({ ...editingLoc, lng: e.target.value })
                    }
                    className={`w-full p-2 border rounded-lg ${inputSurface}`}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] opacity-60 block mb-1">
                  Demand (Unit)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingLoc.demand}
                  disabled={editingLoc.isDepot}
                  onChange={(e) =>
                    setEditingLoc({ ...editingLoc, demand: e.target.value })
                  }
                  className={`w-full p-2 border rounded-lg disabled:opacity-40 ${inputSurface}`}
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-rose-500 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editingLoc.isDepot}
                  onChange={(e) =>
                    setEditingLoc({ ...editingLoc, isDepot: e.target.checked })
                  }
                  className="accent-rose-600"
                />
                <span>Set sebagai Depot Utama</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLoc(null)}
                  className={`px-3.5 py-2 rounded-lg font-semibold cursor-pointer ${
                    isDarkMode
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <i className="ti ti-device-floppy text-sm"></i>
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
