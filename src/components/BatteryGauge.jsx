import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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
          'rgba(255, 255, 255, 0.1)' // Empty portion color (transparent-ish white)
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
    <div className="relative w-full h-full min-h-[200px] flex flex-col items-center justify-center p-4">
      <h3 className="text-lg font-medium text-white mb-2 absolute top-4 left-4">Battery SOC</h3>
      <div className="relative w-full max-w-[250px] aspect-[2/1] mt-8">
        <Doughnut data={data} options={options} />
        {/* Center UI: Display the percentage integer and the string "Battery Level" in the middle */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-2">
          <span className="text-4xl font-bold text-white mb-1">{Math.round(validSoc)}%</span>
          <span className="text-sm text-gray-400 font-medium">Battery Level</span>
        </div>
      </div>
    </div>
  );
};

export default BatteryGauge;
