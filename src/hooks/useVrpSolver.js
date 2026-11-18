import { useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function useVrpSolver() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [error, setError] = useState(null);

  const runSolver = useCallback(async (algorithm, locations, params) => {
    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          algorithm,
          locations,
          params,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.status !== 'SUCCESS') {
        throw new Error(payload.message || `Server error: ${response.status}`);
      }

      if (payload.isBenchmark) {
        const benchData = payload.data; // { GA, ABC, HYBRID }
        setBenchmarkResult(benchData);

        // Tentukan pemenang terbaik (prioritas solusi valid dengan jarak terpendek)
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

      return payload;
    } catch (err) {
      console.error('[useVrpSolver] Error:', err);
      setError(err.message || 'Gagal terhubung ke backend Flask');
      alert(`Gagal memproses optimasi: ${err.message || 'Periksa server Flask'}`);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  return {
    isCalculating,
    result,
    benchmarkResult,
    runSolver,
    error,
  };
}

export default useVrpSolver;