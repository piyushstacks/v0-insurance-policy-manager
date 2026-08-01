'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: 'healthy' | 'attention' | 'risk' | 'blue';
  height?: number;
}

const colorMap = {
  healthy:   { stroke: 'var(--status-healthy)',    fill: 'var(--status-healthy-bg)' },
  attention: { stroke: 'var(--status-attention)',  fill: 'var(--status-attention-bg)' },
  risk:      { stroke: 'var(--status-risk)',       fill: 'var(--status-risk-bg)' },
  blue:      { stroke: '#3b82f6',                  fill: '#eff6ff' },
};

export function Sparkline({ data, color = 'blue', height = 40 }: SparklineProps) {
  const { stroke, fill } = colorMap[color];
  const chartData = data.map((v, i) => ({ v, i }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={stroke} stopOpacity={0.25} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
