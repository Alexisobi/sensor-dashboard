import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SocTrend = ({ dataPoints }) => {
  // dataPoints is expected to be an array of objects: { time: string, value: number }

  const data = {
    labels: dataPoints.map(p => p.time),
    datasets: [
      {
        label: 'State of Charge (%)',
        data: dataPoints.map(p => p.value),
        borderColor: '#3b82f6', // Blue curve
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // Blue transparency
        tension: 0.4, // Cubic interpolation for smooth curves
        fill: true,
        pointRadius: dataPoints.length > 15 ? 0 : 3, // Hide points if too many
        pointHoverRadius: 6,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 6, // Don't crowd the x-axis
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
        },
        min: 0,
        max: 100, // SOC is 0-100
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white m-0">Historical State of Charge</h3>
        <span className="text-sm font-medium px-2 py-1 bg-black/30 rounded-md text-[#3b82f6]">
          {dataPoints.length > 0 ? Math.round(dataPoints[dataPoints.length - 1].value) + '%' : '0%'}
        </span>
      </div>
      <div className="relative flex-1 w-full min-h-[250px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default SocTrend;
