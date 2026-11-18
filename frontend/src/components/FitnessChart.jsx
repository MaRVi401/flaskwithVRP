import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label, isDarkMode }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={`p-2.5 rounded-xl border shadow-lg text-xs space-y-1.5 backdrop-blur-md ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-700 text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-800'
      }`}
    >
      <div className="font-extrabold text-[11px] border-b pb-1 border-slate-500/20 flex items-center justify-between gap-4">
        <span>Generasi #{label}</span>
        {payload[0]?.payload?.phase && (
          <span className="text-[10px] font-semibold text-indigo-500">
            {payload[0].payload.phase}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}:</span>
            </span>
            <span className="font-mono font-extrabold">
              {typeof entry.value === 'number'
                ? `${entry.value.toFixed(2)} km`
                : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FitnessChart({ historyData, benchmarkData, isDarkMode, isExpanded = false }) {
  const [hiddenSeries, setHiddenSeries] = useState({});

  const axisColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  const handleLegendClick = (e) => {
    const key = e.dataKey;
    if (!key) return;
    setHiddenSeries((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Mode Perbandingan 3 Kurva (Benchmark)
  if (benchmarkData?.GA && benchmarkData?.ABC && benchmarkData?.HYBRID) {
    const gaHist = benchmarkData.GA.history || [];
    const abcHist = benchmarkData.ABC.history || [];
    const hybHist = benchmarkData.HYBRID.history || [];
    const maxLen = Math.max(gaHist.length, abcHist.length, hybHist.length);

    const mergedData = Array.from({ length: maxLen }, (_, idx) => ({
      generation: idx + 1,
      GA: gaHist[idx]?.fitness ?? null,
      ABC: abcHist[idx]?.fitness ?? null,
      HYBRID: hybHist[idx]?.fitness ?? null,
    }));

    return (
      <div className="w-full h-full flex flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={mergedData}
            margin={{
              top: 8,
              right: 14,
              left: 2,
              bottom: isExpanded ? 12 : 2,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.7} />
            <XAxis
              dataKey="generation"
              tick={{ fontSize: isExpanded ? 12 : 10, fill: axisColor }}
              tickMargin={4}
              minTickGap={20}
            />
            <YAxis
              width={isExpanded ? 56 : 46}
              tick={{ fontSize: isExpanded ? 12 : 10, fill: axisColor }}
              domain={['auto', 'auto']}
              tickFormatter={(val) => `${Math.round(val)}`}
            />
            <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
            <Legend
              onClick={handleLegendClick}
              wrapperStyle={{
                fontSize: isExpanded ? '12px' : '10px',
                paddingTop: '4px',
                cursor: 'pointer',
              }}
            />
            <Line
              type="monotone"
              dataKey="GA"
              name="GA (km)"
              stroke="#3b82f6"
              strokeWidth={isExpanded ? 2.5 : 2}
              dot={false}
              activeDot={{ r: 5 }}
              hide={Boolean(hiddenSeries.GA)}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ABC"
              name="ABC (km)"
              stroke="#f59e0b"
              strokeWidth={isExpanded ? 2.5 : 2}
              dot={false}
              activeDot={{ r: 5 }}
              hide={Boolean(hiddenSeries.ABC)}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="HYBRID"
              name="HYBRID (km)"
              stroke="#10b981"
              strokeWidth={isExpanded ? 3 : 2.5}
              dot={false}
              activeDot={{ r: 5 }}
              hide={Boolean(hiddenSeries.HYBRID)}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Mode Algoritma Tunggal
  if (!historyData || historyData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-xs opacity-55 italic gap-1 p-4 text-center">
        <i className="ti ti-chart-dots text-xl opacity-70"></i>
        <span>Grafik konvergensi akan muncul setelah optimasi dijalankan</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={historyData}
        margin={{
          top: 8,
          right: 14,
          left: 2,
          bottom: isExpanded ? 12 : 2,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.7} />
        <XAxis
          dataKey="generation"
          tick={{ fontSize: isExpanded ? 12 : 10, fill: axisColor }}
          tickMargin={4}
          minTickGap={20}
        />
        <YAxis
          width={isExpanded ? 56 : 46}
          tick={{ fontSize: isExpanded ? 12 : 10, fill: axisColor }}
          domain={['auto', 'auto']}
          tickFormatter={(val) => `${Math.round(val)}`}
        />
        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
        <Line
          type="monotone"
          dataKey="fitness"
          name="Jarak Terbaik"
          stroke="#6366f1"
          strokeWidth={isExpanded ? 3 : 2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default React.memo(FitnessChart);