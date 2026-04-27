import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ padding: '8px 12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-color)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{`${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: 0, fontWeight: 600 }}>
            {`SOC: ${Math.round(entry.value)}%`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SocTrend = ({ dataPoints }) => {
  return (
    <div className="w-full h-full min-h-[300px] flex flex-col p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-white m-0 tracking-wide">Historical State of Charge</h3>
        <span className="text-sm font-medium px-3 py-1 bg-black/40 border border-[#3b82f6]/30 rounded-lg text-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.2)]">
          {dataPoints.length > 0 ? Math.round(dataPoints[dataPoints.length - 1].value) + '%' : '0%'}
        </span>
      </div>
      <div className="relative flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dataPoints}
            margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSoc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8" 
              fontSize={11} 
              tickLine={false}
              axisLine={false}
              minTickGap={15}
            />
            <YAxis 
              domain={[0, 100]}
              stroke="#94a3b8" 
              fontSize={11} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSoc)"
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SocTrend;
