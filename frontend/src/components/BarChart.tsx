export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  color?: string;
  height?: number;
}

const WIDTH = 400;
const BAR_RADIUS = 4;
const AXIS_COLOR = 'var(--gridline)';
const LABEL_COLOR = 'var(--text-secondary)';
const VALUE_COLOR = 'var(--text-primary)';

/**
 * A plain single-series vertical bar chart. Single series never needs a
 * legend — the axis labels already name each category — so every bar uses
 * one consistent brand color, with the value drawn directly above each bar
 * (there are few enough categories that direct labels beat a shared axis
 * scale for readability).
 */
export const BarChart = ({ data, color = 'var(--color-accent)', height = 220 }: BarChartProps) => {
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const chartHeight = height - 40; // reserve space for axis labels
  const barWidth = data.length > 0 ? (WIDTH / data.length) * 0.5 : 0;
  const gap = data.length > 0 ? (WIDTH / data.length) * 0.5 : 0;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
    >
      <line x1={0} y1={chartHeight} x2={WIDTH} y2={chartHeight} stroke={AXIS_COLOR} strokeWidth={1} />
      {data.map((d, i) => {
        const barHeight = maxValue > 0 ? (d.value / maxValue) * (chartHeight - 24) : 0;
        const x = i * (barWidth + gap) + gap / 2;
        const y = chartHeight - barHeight;

        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 1)}
              rx={BAR_RADIUS}
              fill={color}
            />
            <text
              x={x + barWidth / 2}
              y={y - 8}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill={VALUE_COLOR}
            >
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={chartHeight + 20}
              textAnchor="middle"
              fontSize={12}
              fill={LABEL_COLOR}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
