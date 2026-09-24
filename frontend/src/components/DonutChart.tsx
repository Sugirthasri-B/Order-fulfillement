export interface DonutChartDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutChartDatum[];
  centerLabel?: string;
  size?: number;
}

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
};

const describeDonutSlice = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string => {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner = polarToCartesian(cx, cy, innerR, endAngle);

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
};

/**
 * A donut chart with a text legend — never color alone, per the app's
 * status-color rule (some status hues sit below 3:1 contrast on light
 * surfaces, so the label always carries the meaning too).
 */
export const DonutChart = ({ data, centerLabel, size = 180 }: DonutChartProps) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = outerR * 0.62;

  let cursor = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const startAngle = (cursor / total) * 360;
      cursor += d.value;
      const endAngle = (cursor / total) * 360;
      return { ...d, startAngle, endAngle };
    });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Donut chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
      >
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--gridline)" strokeWidth={outerR - innerR} />
        ) : (
          slices.map((slice) => (
            <path key={slice.label} d={describeDonutSlice(cx, cy, outerR, innerR, slice.startAngle, slice.endAngle)} fill={slice.color}>
              <title>{`${slice.label}: ${slice.value}`}</title>
            </path>
          ))
        )}
        {centerLabel && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={700} fill="var(--text-primary)">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d) => (
          <li key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span
              aria-hidden="true"
              style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
