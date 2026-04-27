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
import './LineChartWidget.css'; // Import the exact stylesheet used by other charts

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip glass-card" style={{ padding: '8px 12px' }}>
        <p className="label">{`${label}`}</p>
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
    <div className="glass-card chart-widget" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="chart-title" style={{ margin: 0 }}>Historical State of Charge</h3>
        <span style={{ 
          fontSize: '0.85rem', 
          fontWeight: 600, 
          padding: '4px 10px', 
          backgroundColor: 'rgba(0,0,0,0.3)', 
          border: '1px solid rgba(59,130,246,0.3)', 
          borderRadius: '8px', 
          color: '#3b82f6', 
          boxShadow: '0 0 10px rgba(59,130,246,0.2)' 
        }}>
          {dataPoints.length > 0 ? Math.round(dataPoints[dataPoints.length - 1].value) + '%' : '0%'}
        </span>
      </div>
      <div className="chart-container" style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dataPoints}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSoc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="var(--text-secondary)" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 100]}
              stroke="var(--text-secondary)" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSoc)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SocTrend;
