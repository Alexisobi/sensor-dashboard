import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Custom Chart.js Plugin to draw the needle
const gaugeNeedle = {
  id: 'gaugeNeedle',
  afterDatasetDraw(chart, args, options) {
    const { ctx } = chart;
    const soc = options.soc ?? 0;
    
    // Math to get needle rotation
    // 0 to 100 mapped to -180 to 0 degrees (-PI to 0)
    const angle = Math.PI + (Math.max(0, Math.min(soc, 100)) / 100) * Math.PI;
    
    const meta = chart.getDatasetMeta(0);
    const arc = meta.data[0];
    if (!arc) return;
    
    const cx = arc.x;
    const cy = arc.y;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    // Draw center anchor circle (grey like reference image)
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, 2 * Math.PI);
    ctx.fillStyle = '#838e9a'; // A neutral grey/slate
    ctx.fill();
    
    // Rotate to draw the needle
    ctx.rotate(angle);
    ctx.beginPath();
    // Start at center, somewhat thick
    ctx.moveTo(0, -6);
    // Extend needle slightly past inner radius into the colors
    ctx.lineTo(arc.innerRadius + 15, 0); 
    ctx.lineTo(0, 6);
    
    // Needle color: Dark styling for contrast or white?
    // Using a very dark slate, matching modern dark theme dashboards
    ctx.fillStyle = '#1e293b'; 
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    
    // Re-draw a tiny grey dot inside the anchor to match layered industrial look
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.restore();
  }
};

// Custom plugin to draw scale ticks around the needle border
const gaugeTicks = {
  id: 'gaugeTicks',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const arc = meta.data[0];
    const cx = arc.x;
    const cy = arc.y;
    const outerRadius = arc.outerRadius;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    // Draw ticks from 0 to 100
    for(let i = 0; i <= 10; i++) {
        const val = i * 10;
        const angle = Math.PI + (val / 100) * Math.PI;
        
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        // Move outside the doughnut track
        ctx.moveTo(outerRadius + 8, 0);
        // Draw the tick line
        ctx.lineTo(outerRadius + 16, 0);
        
        // Emphasize the 0, 50, 100 ticks
        const isMajor = (i === 0 || i === 5 || i === 10);
        ctx.strokeStyle = isMajor ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = isMajor ? 2 : 1;
        ctx.stroke();
        
        // Draw values on major ticks
        if (i % 2 === 0) {
           ctx.translate(outerRadius + 32, 0);
           ctx.rotate(-angle); // make text horizontal
           ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
           ctx.font = '11px Inter, sans-serif';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText(`${val}%`, 0, 0);
        }
        ctx.restore();
    }
    ctx.restore();
  }
};

const BatteryGauge = ({ soc }) => {
  const validSoc = typeof soc === 'number' && !isNaN(soc) ? Math.min(Math.max(soc, 0), 100) : 0;
  
  // Bands configuration for battery SOC
  // Red (0-20), Yellow (20-50), Green (50-100)
  const data = {
    labels: ['Critical', 'Low', 'Healthy'],
    datasets: [
      {
        data: [20, 30, 50],
        backgroundColor: [
          '#ef4444', // Red
          '#f59e0b', // Yellow
          '#10b981', // Green
        ],
        borderWidth: 0,
        circumference: 180, // Semi-circle
        rotation: 270, // Start from -180deg
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%', // Thickness of the arc
    layout: {
      padding: {
        top: 20,
        left: 50,
        right: 50,
        bottom: 15
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      // Pass soc prop to the custom plugin
      gaugeNeedle: { soc: validSoc }
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
      {/* Title on top */}
      <h3 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'white', margin: 0, letterSpacing: '0.05em', textAlign: 'center' }}>Battery State of Charge</h3>
      
      {/* The Doughnut wrapped in a slightly taller container for the ticks/labels padding */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '300px', flex: 1, marginTop: '2rem', paddingBottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <Doughnut data={data} options={options} plugins={[gaugeTicks, gaugeNeedle]} />
        
        {/* Exact Digital Value in the center baseline beneath the needle */}
        <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', zIndex: 10 }}>
          <span style={{ fontSize: '2.25rem', fontWeight: 700, color: 'white', letterSpacing: '0.1em' }}>{Math.round(validSoc)}%</span>
        </div>
      </div>

      {/* Battery Level at bottom middle of the tab */}
      <div style={{ marginTop: 'auto' }}>
        <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Battery Level</span>
      </div>
    </div>
  );
};

export default BatteryGauge;
