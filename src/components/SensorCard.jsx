import React from 'react';
import './SensorCard.css';

const SensorCard = ({ title, value, unit, icon: Icon, trend, color }) => {
  return (
    <div className="glass-card sensor-card">
      <div className="sensor-header">
        <h3 className="sensor-title">{title}</h3>
        <div 
          className="sensor-icon-wrapper" 
          style={{ backgroundColor: `${color}20`, color: color }}
        >
          {Icon && <Icon size={20} />}
        </div>
      </div>
      
      <div className="sensor-value-container">
        <span className="sensor-value">{value}</span>
        <span className="sensor-unit">{unit}</span>
      </div>
      
      {trend && (
        <div className={`sensor-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% since last hour
        </div>
      )}
    </div>
  );
};

export default SensorCard;
