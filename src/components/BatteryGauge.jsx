import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Custom Chart.js Plugin to draw the sliding pointer
const gaugePointer = {
  id: 'gaugePointer',
  afterDatasetDraw(chart, args, options) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const arc = meta.data[0];
    
    // Calculate the position of the pointer at the end of the colored arc
    const angle = arc.endAngle;
    const radius = (arc.innerRadius + arc.outerRadius) / 2;
    
    const x = arc.x + Math.cos(angle) * radius;
    const y = arc.y + Math.sin(angle) * radius;
    
    // Draw the pointer (a circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e293b'; // matching dark background theme for contrast
    ctx.stroke();
    ctx.restore();
  }
};

const BatteryGauge = ({ soc }) => {
  // Ensure we have a valid number between 0 and 100
  const validSoc = typeof soc === 'number' && !isNaN(soc) ? Math.min(Math.max(soc, 0), 100) : 0;
  
  // Logic: Color should dynamically change: Green (>50%), Yellow (21-50%), Red (<20%).
  let color = '#10b981'; // Green
  if (validSoc <= 50 && validSoc > 20) {
    color = '#f59e0b'; // Yellow
  } else if (validSoc <= 20) {
    color = '#ef4444'; // Red
  }

  const data = {
    labels: ['Battery', 'Empty'],
    datasets: [
      {
        data: [validSoc, 100 - validSoc],
        backgroundColor: [
          color,
          'rgba(255, 255, 255, 0.1)' // Empty portion color
        ],
        borderWidth: 0,
        circumference: 180, // Semi-circle
        rotation: 270, // Start from left side
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%', // Make it a thin doughnut
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  return (
    <div className="relative w-full h-full min-h-[250px] flex flex-col items-center justify-between p-4">
      {/* Title on top */}
      <h3 className="text-lg font-medium text-white m-0">Battery State of Charge</h3>
      
      <div className="relative w-full max-w-[250px] aspect-[2/1] mt-8 flex-1">
        <Doughnut data={data} options={options} plugins={[gaugePointer]} />
        {/* Percentage in the middle of the chart */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-2">
          <span className="text-4xl font-bold text-white mb-1">{Math.round(validSoc)}%</span>
        </div>
      </div>

      {/* Battery Level at bottom middle of the tab */}
      <div className="mt-8">
        <span className="text-sm text-gray-400 font-medium tracking-wide uppercase">Battery Level</span>
      </div>
    </div>
  );
};

export default BatteryGauge;
