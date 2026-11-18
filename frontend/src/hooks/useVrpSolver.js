import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function useVrpSolver() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [result, setResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const cancelSolver = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsCalculating(false);
  }, []);

  const loadDatasetFromApi = useCallback(async () => {
    setIsLoadingDataset(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/dataset`);
      const rawData = await response.json();

      if (!response.ok || !Array.isArray(rawData)) {
        throw new Error(rawData?.message || 'Gagal memuat dataset dari server Flask');
      }

      let depotAssigned = false;
      const formatted = rawData
        .filter((item) => !isNaN(parseFloat(item.lat)) && !isNaN(parseFloat(item.lng)))
        .map((item, idx) => {
          const isDepotFlag = Boolean(item.isDepot) && !depotAssigned;
          if (isDepotFlag) depotAssigned = true;

          return {
            id: item.id || `api-loc-${idx}-${Date.now()}`,
            name: String(item.name || `Lokasi ${idx + 1}`),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
            demand: isDepotFlag ? 0 : Math.max(0, parseInt(item.demand, 10) || 0),
            isDepot: isDepotFlag,
          };
        });

      if (formatted.length > 0 && !depotAssigned) {
        formatted[0].isDepot = true;
        formatted[0].demand = 0;
      }

      return { data: formatted, error: null };
    } catch (err) {
      const msg = err.message || 'Gagal memuat dataset dari Flask';
      setError(msg);
      return { data: null, error: msg };
    } finally {
      setIsLoadingDataset(false);
    }
  }, []);

  const runSolver = useCallback(async (algorithm, locations, params) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCalculating(true);
    setError(null);

    const cleanParams = {
      capacity: Number(params.capacity),
      vehicles: Number(params.vehicles),
      generations: Number(params.generations),
      popSize: Number(params.popSize),
    };

    // Kirim seed di level terluar payload agar terbaca oleh payload.get("seed") di app.py
    const hasSeed =
      params.seed !== '' &&
      params.seed !== null &&
      params.seed !== undefined &&
      !isNaN(Number(params.seed));

    const requestBody = {
      algorithm,
      locations,
      params: cleanParams,
      ...(hasSeed ? { seed: parseInt(params.seed, 10) } : {}),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok || payload.status !== 'SUCCESS') {
        throw new Error(payload.message || `Server error: ${response.status}`);
      }

      if (payload.isBenchmark) {
        const benchData = payload.data;
        setBenchmarkResult(benchData);

        const entries = Object.entries(benchData);
        entries.sort(([, a], [, b]) => {
          const aValid = a.isFeasible !== false ? 0 : 1;
          const bValid = b.isFeasible !== false ? 0 : 1;
          if (aValid !== bValid) return aValid - bValid;
          return a.bestDistance - b.bestDistance;
        });

        const [winnerAlg, winnerData] = entries[0];
        setResult({
          ...winnerData,
          winnerAlgorithm: winnerAlg,
        });
      } else {
        setBenchmarkResult(null);
        setResult({
          ...payload.data,
          algorithm: payload.algorithm || algorithm,
        });
      }

      return { payload, error: null, aborted: false };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { payload: null, error: null, aborted: true };
      }
      const msg = err.message || 'Gagal terhubung ke backend Flask';
      setError(msg);
      return { payload: null, error: msg, aborted: false };
    } finally {
      if (abortControllerRef.current === controller) {
        setIsCalculating(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  return {
    isCalculating,
    isLoadingDataset,
    result,
    benchmarkResult,
    runSolver,
    cancelSolver,
    loadDatasetFromApi,
    error,
  };
}

export default useVrpSolver;