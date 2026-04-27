import React, { useEffect, useState } from 'react';
import { Sun, UtilityPole, Battery, Home, Zap } from 'lucide-react';

const PowerFlow = ({ currentAmps, status, lastSeen }) => {
  const [isLive, setIsLive] = useState(false);

  // Parse and clamp currentAmps (Floor logic)
  const rawAmps = Number(currentAmps) || 0;
  const amps = (rawAmps >= -0.1 && rawAmps <= 0.1) ? 0 : rawAmps;

  // Determine direction
  const isCharging = amps > 0;
  const isDischarging = amps < 0;
  const isIdle = amps === 0;

  // Live Pulse check
  useEffect(() => {
    const checkLiveStatus = () => {
      if (!lastSeen) {
        setIsLive(false);
        return;
      }
      
      // Assume lastSeen is timestamp in ms (or s, we'll try to handle if it's seconds by checking length)
      const lastSeenMs = lastSeen.toString().length <= 10 ? lastSeen * 1000 : lastSeen;
      const now = Date.now();
      const difference = now - lastSeenMs;
      
      setIsLive(difference <= 30000); // Live if updated within last 30 seconds
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 5000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  // CSS for marching ants animation based on direction
  return (
    <div className="relative w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
      
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <h3 className="text-lg font-medium text-white">Power Flow</h3>
        <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} title={isLive ? "Live" : "Offline (>30s since last update)"}></div>
      </div>
      
      <div className="absolute top-4 right-4 bg-black/40 px-3 py-1 rounded-full text-sm font-medium border border-white/10 text-gray-300">
        Status: <span className={isCharging ? "text-green-400" : isDischarging ? "text-yellow-400" : "text-gray-400"}> {status || "Unknown"}</span>
        <span className="ml-2">({amps.toFixed(2)}A)</span>
      </div>

      {/* Diagram container */}
      <div className="relative w-full max-w-lg aspect-video mt-8 border border-transparent flex items-center justify-center">
        
        {/* SVG overlay for flowing lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          {/* Grid to Inverter (Always flowing if Grid is active, but we can assume simple left to right for now) */}
          <line x1="20%" y1="50%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          
          <line 
            x1="20%" y1="50%" x2="50%" y2="50%" 
            stroke="#3b82f6" 
            strokeWidth="4" 
            strokeDasharray="8 8"
            className={!isDischarging ? "animate-[dash_1s_linear_infinite]" : "opacity-0"} 
          />

          {/* Inverter to Home */}
          <line x1="50%" y1="50%" x2="80%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          <line 
            x1="50%" y1="50%" x2="80%" y2="50%" 
            stroke="#10b981" 
            strokeWidth="4" 
            strokeDasharray="8 8"
            className={isDischarging ? "animate-[dash-reverse_1s_linear_infinite]" : "animate-[dash_1s_linear_infinite]"} 
          />

          {/* Inverter to Battery (charging) or Battery to Inverter (discharging) */}
          <line x1="50%" y1="50%" x2="50%" y2="80%" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
          
          {/* Charging flow (down to battery) */}
          <line 
            x1="50%" y1="50%" x2="50%" y2="80%" 
            stroke="#10b981" 
            strokeWidth="4" 
            strokeDasharray="8 8"
            className={isCharging ? "animate-[dash_1s_linear_infinite]" : "opacity-0"} 
          />
          {/* Discharging flow (up from battery) */}
          <line 
             x1="50%" y1="80%" x2="50%" y2="50%" 
             stroke="#f59e0b" 
             strokeWidth="4" 
             strokeDasharray="8 8"
             className={isDischarging ? "animate-[dash_1s_linear_infinite]" : "opacity-0"} 
          />
        </svg>

        {/* CSS Animations defined inline for the dash strokes */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes dash {
            to { stroke-dashoffset: -16; }
          }
          @keyframes dash-reverse {
            to { stroke-dashoffset: 16; }
          }
        `}} />

        {/* Nodes */}
        {/* Grid / Solar Node */}
        <div className="absolute left-[10%] top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10 w-24">
          <div className="w-16 h-16 rounded-full bg-blue-900/50 border-2 border-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <UtilityPole className="text-blue-400" size={32} />
          </div>
          <span className="mt-2 text-sm font-semibold text-gray-300">Grid</span>
        </div>

        {/* Inverter Node */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10 w-24">
          <div className="w-20 h-20 rounded-2xl bg-purple-900/50 border-2 border-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
            <Zap className="text-purple-400" size={40} />
          </div>
          <span className="mt-2 text-sm font-semibold text-white">Inverter</span>
        </div>

        {/* Home Load Node */}
        <div className="absolute right-[10%] top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10 w-24">
          <div className="w-16 h-16 rounded-full bg-emerald-900/50 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <Home className="text-emerald-400" size={32} />
          </div>
          <span className="mt-2 text-sm font-semibold text-gray-300">Home</span>
        </div>

        {/* Battery Node */}
        <div className="absolute left-1/2 bottom-[5%] -translate-x-1/2 flex flex-col items-center justify-center z-10 w-24">
          <div className={`w-16 h-16 rounded-xl bg-orange-900/50 border-2 ${isCharging ? 'border-green-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : isDischarging ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'border-gray-500'} flex items-center justify-center`}>
            <Battery className={isCharging ? "text-green-400" : isDischarging ? "text-orange-400" : "text-gray-400"} size={32} />
          </div>
          <span className="mt-2 text-sm font-semibold text-gray-300">Battery</span>
        </div>

      </div>
    </div>
  );
};

export default PowerFlow;
