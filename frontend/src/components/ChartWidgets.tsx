import React, { useMemo } from 'react';

export interface ChartSeries {
  name: string;
  values: number[];
  color: string;
}

interface RingChartProps {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  valueClassName?: string;
}

export const RingChart: React.FC<RingChartProps> = ({
  value,
  label,
  sublabel,
  size = 144,
  stroke = 12,
  color = '#14b8a6',
  trackColor = '#e2e8f0',
  valueClassName = 'text-slate-900',
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`text-3xl font-bold ${valueClassName}`}>{Math.round(clamped)}%</div>
        <div className="text-[11px] text-slate-500">{label}</div>
        {sublabel ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{sublabel}</div> : null}
      </div>
    </div>
  );
};

interface SimpleLineChartProps {
  labels: string[];
  series: ChartSeries[];
  className?: string;
  height?: number;
}

function buildPath(values: number[], maxValue: number, count: number, height = 100): string {
  if (!values.length) return '';

  const paddingX = 6;
  const paddingY = 10;
  const usableWidth = 100 - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const step = count > 1 ? usableWidth / (count - 1) : 0;

  return values
    .map((value, index) => {
      const x = paddingX + step * index;
      const y = paddingY + (1 - (maxValue > 0 ? value / maxValue : 0)) * usableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildPoints(values: number[], maxValue: number, count: number, height = 100): { x: number; y: number }[] {
  const paddingX = 6;
  const paddingY = 10;
  const usableWidth = 100 - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const step = count > 1 ? usableWidth / (count - 1) : 0;

  return values.map((value, index) => {
    const x = paddingX + step * index;
    const y = paddingY + (1 - (maxValue > 0 ? value / maxValue : 0)) * usableHeight;
    return { x, y };
  });
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ labels, series, className = '', height = 220 }) => {
  const { maxValue, count } = useMemo(() => {
    const seriesMax = Math.max(...series.flatMap((item) => item.values), 1);
    const longest = Math.max(labels.length, ...series.map((item) => item.values.length), 1);
    return { maxValue: seriesMax, count: longest };
  }, [labels.length, series]);

  return (
    <div className={`space-y-3 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full overflow-visible" style={{ height }}>
        {[20, 40, 60, 80].map((grid) => (
          <line key={grid} x1="6" x2="94" y1={grid} y2={grid} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="1.5 2.5" />
        ))}

        {series.map((item) => {
          const values = item.values.slice(-count);
          const path = buildPath(values, maxValue, count, 100);
          const points = buildPoints(values, maxValue, count, 100);
          return (
            <g key={item.name}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={`${item.name}-${index}`} cx={point.x} cy={point.y} r="1.15" fill={item.color} />
              ))}
            </g>
          );
        })}
      </svg>

      {labels.length > 0 ? (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
          {labels.map((label, index) => (
            <div key={`${label}-${index}`} className="text-center text-[10px] text-slate-400">
              {label}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
        {series.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-8 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RadarChartProps {
  labels: string[];
  values: number[];
  color?: string;
  trackColor?: string;
  className?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  labels,
  values,
  color = '#2563eb',
  trackColor = '#dbeafe',
  className = '',
}) => {
  const count = Math.max(labels.length, values.length, 3);
  const points = useMemo(() => {
    const size = 100;
    const center = size / 2;
    const radius = 34;
    return Array.from({ length: count }).map((_, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2) / count) * index;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      const value = values[index] ?? 0;
      const inner = radius * (Math.max(0, Math.min(100, value)) / 100);
      const px = center + Math.cos(angle) * inner;
      const py = center + Math.sin(angle) * inner;
      return { x, y, px, py, angle };
    });
  }, [count, values]);

  const polygon = points.map((point) => `${point.px.toFixed(2)},${point.py.toFixed(2)}`).join(' ');

  return (
    <div className={`space-y-3 ${className}`}>
      <svg viewBox="0 0 100 100" className="h-[260px] w-full overflow-visible">
        {[10, 20, 30, 40].map((radius) => (
          <polygon
            key={radius}
            points={Array.from({ length: count })
              .map((_, index) => {
                const angle = (-Math.PI / 2) + ((Math.PI * 2) / count) * index;
                const x = 50 + Math.cos(angle) * radius;
                const y = 50 + Math.sin(angle) * radius;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(' ')}
            fill="none"
            stroke={trackColor}
            strokeWidth="0.6"
            strokeDasharray="1.3 2.2"
          />
        ))}

        {points.map((point, index) => (
          <line key={`axis-${index}`} x1="50" y1="50" x2={point.x} y2={point.y} stroke={trackColor} strokeWidth="0.6" />
        ))}

        <polygon points={polygon} fill="rgba(37, 99, 235, 0.12)" stroke={color} strokeWidth="1.4" />
        {points.map((point, index) => (
          <circle key={`node-${index}`} cx={point.px} cy={point.py} r="1.4" fill={color} />
        ))}

        {points.map((point, index) => {
          const label = labels[index] ?? `E${index + 1}`;
          const x = 50 + Math.cos(point.angle) * 46;
          const y = 50 + Math.sin(point.angle) * 46;
          return (
            <text key={`label-${index}`} x={x} y={y} fill="#475569" fontSize="4.4" textAnchor="middle" dominantBaseline="middle">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
