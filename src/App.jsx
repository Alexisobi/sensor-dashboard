import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Thermometer, 
  Droplets, 
  Sun, 
  Users,
  LayoutDashboard,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  BarChart2,
  Activity,
  Power,
  Gauge,
  Radar
} from 'lucide-react';
import { format, subHours, subDays, subWeeks, subMonths } from 'date-fns';
import { ref, onValue, push, set, query as rtdbQuery, orderByChild, limitToLast, update } from 'firebase/database';
import { collection, query as fsQuery, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, firestoreDb } from './firebase'; // Import both db and firestoreDb

import SensorCard from './components/SensorCard';
import LineChartWidget from './components/LineChartWidget';
import Login from './components/Login';
import BatteryGauge from './components/BatteryGauge';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [reportsTimeframe, setReportsTimeframe] = useState('hourly'); // 'hourly', 'daily', 'weekly', 'monthly'
  const [chartData, setChartData] = useState([]); // Start empty
  const [reportsData, setReportsData] = useState([]); // Specifically for the Reports view
  
  // Real-time current values initialized to 0
  const [currentValues, setCurrentValues] = useState({
    energy: 0,
    temperature: 0,
    humidity: 0,
    light: 0,
    occupancy: 0,
    current: 0,
    voltage: 0,
    power: 0,
    presence: 0
  });

  // Inverter and Power Flow State
  const [inverterData, setInverterData] = useState({
    battery_soc: 0,
    current_amps: 0,
    load_watts: 0,
    status: 'Idle',
    last_seen: null,
    battery_voltage: 0
  });
  const [socTrendData, setSocTrendData] = useState([]);
  
  const [lastDataReceivedAt, setLastDataReceivedAt] = useState(Date.now());

  // Removed EXPERIMENTAL Mock Data Pumper since hardware handles real data pushing

  // 1. Real-time Unified Sensor and Inverter Values from telemetry/live
  useEffect(() => {
    const connectedRef = ref(db, ".info/connected");
    const unsubConnected = onValue(connectedRef, (snap) => {
      console.log("📡 Firebase Connection Status:", snap.val() === true ? "ONLINE 🟢" : "OFFLINE / CONNECTING 🔴");
    });

    const liveRef = ref(db, 'telemetry/live');
    
    console.log("Attempting to connect to Firebase Realtime Database at 'telemetry/live'...");
    
    const unsubscribe = onValue(liveRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        setLastDataReceivedAt(Date.now());
        
        setCurrentValues({
          energy: data.energy ?? 0,
          temperature: data.temperature ?? 0,
          humidity: data.humidity ?? 0,
          light: data.lux ?? data.light ?? 0,                  
          occupancy: data.ultrasonic_occupancy ?? data.occupancy ?? 0, 
          current: data.current ?? 0,
          voltage: data.voltage ?? 0,
          power: data.power ?? 0,
          presence: data.radar_motion ?? data.presence ?? 0
        });

        setInverterData({
          battery_soc: data.battery_soc ?? 0,
          current_amps: data.current_amps ?? 0,
          load_watts: data.load_watts ?? 0,
          status: data.status ?? 'Unknown',
          last_seen: data.last_seen ?? null,
          battery_voltage: data.battery_voltage ?? 0
        });

        setSocTrendData(prev => {
          const now = new Date();
          const timeString = format(now, 'HH:mm:ss');
          const newPoint = { time: timeString, value: data.battery_soc ?? 0 };
          const newArray = [...prev, newPoint];
          return newArray.slice(-30);
        });
      } else {
        console.warn("Data not found at 'telemetry/live'.");
      }
    }, (error) => {
      console.error("Error fetching real-time data:", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Historical Data for SOC Chart (Live from Firestore)
  useEffect(() => {
    const q = fsQuery(
      collection(firestoreDb, 'reports_hourly'),
      orderBy('timestamp', 'desc'),
      limit(24)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = [];
      snapshot.forEach((doc) => {
        const val = doc.data();
        logs.push({
          time: format(new Date(val.timestamp), 'HH:mm'), // Format to hour/min
          soc: val.battery_soc || 0
        });
      });
      // Data is ordered desc, so newest is first. Reverse to chart chronologically.
      setChartData(logs.reverse());
    });

    return () => unsubscribe();
  }, []);

  // Timer for the clock in the header
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Inactivity Auto-Logout
  useEffect(() => {
    let timeoutId;
    
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 7 minutes = 7 * 60 * 1000 = 420000 ms
      if (isAuthenticated) {
        timeoutId = setTimeout(() => {
          setIsAuthenticated(false);
        }, 420000);
      }
    };

    // Events that count as user activity
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'
    ];

    if (isAuthenticated) {
      resetTimer(); // Start the timer initially
      activityEvents.forEach(event => document.addEventListener(event, resetTimer));
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  // Fetch Historical Reports Data from Firestore based on timeframe
  useEffect(() => {
    const collectionMap = {
      'hourly': 'reports_hourly',
      'daily': 'reports_daily',
      'weekly': 'reports_weekly',
      'monthly': 'reports_monthly'
    };

    const targetCollection = collectionMap[reportsTimeframe];
    if (!targetCollection) return;

    let points = 24;
    let timeFormatter = (timestamp) => format(new Date(timestamp), 'HH:mm');

    switch(reportsTimeframe) {
      case 'daily':
        points = 7;
        timeFormatter = (timestamp) => format(new Date(timestamp), 'EEE'); // Mon, Tue
        break;
      case 'weekly':
        points = 4;
        timeFormatter = (timestamp) => `Week ${format(new Date(timestamp), 'w')}`;
        break;
      case 'monthly':
        points = 12;
        timeFormatter = (timestamp) => format(new Date(timestamp), 'MMM'); // Jan, Feb
        break;
      default: // hourly
        points = 24;
        break;
    }

    const q = fsQuery(
      collection(firestoreDb, targetCollection),
      orderBy('timestamp', 'desc'),
      limit(points)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        const val = doc.data();
        data.push({
          time: timeFormatter(val.timestamp),
          temperature: val.temperature || 0,
          humidity: val.humidity || 0,
          energy: val.energy || 0,
          light: val.lux || val.light || 0,
          occupancy: val.ultrasonic_occupancy || val.occupancy || 0,
          soc: val.battery_soc || val.soc || 0
        });
      });
      // Data is ordered desc, so newest is first. Reverse to chart chronologically (left to right).
      setReportsData(data.reverse());
    });

    return () => unsubscribe();
  }, [reportsTimeframe]);

  // Dynamically compute active alerts
  const activeAlerts = [];
  
  // Compute difference between current running time and when we last got data
  if (currentTime.getTime() - lastDataReceivedAt > 2 * 1000) {
    activeAlerts.push({
      id: 'offline',
      level: 'critical',
      message: 'System Offline: Sensor data has not been updated in over 2 seconds.',
      timestamp: new Date(lastDataReceivedAt)
    });
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Layout */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h1>SensoDash</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Real-time Monitoring facility
            </p>
          </div>
          <button 
            className="mobile-nav-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        <nav className={isMobileMenuOpen ? 'mobile-open' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '2rem' }}>
          <div 
            className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: activeTab === 'dashboard' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'dashboard' ? 'white' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'dashboard' ? 500 : 'normal'
            }}>
            <LayoutDashboard size={20} />
            Dashboard
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', 
              backgroundColor: activeTab === 'reports' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'reports' ? 'white' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'reports' ? 500 : 'normal'
            }}>
            <BarChart2 size={20} />
            Reports & Analytics
          </div>
          <div 
            className={`sidebar-link ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('alerts'); setIsMobileMenuOpen(false); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', 
              backgroundColor: activeTab === 'alerts' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'alerts' ? 'white' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'alerts' ? 500 : 'normal'
            }}>
            <Bell size={20} />
            Alerts
          </div>
          <div 
            className="sidebar-link"
            onClick={() => setIsAuthenticated(false)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', 
              backgroundColor: 'transparent', 
              color: '#ef4444', 
              fontWeight: 'normal',
              marginTop: '1rem'
            }}>
            <LogOut size={20} />
            Logout
          </div>
        </nav>
        
        <div className="sidebar-status" style={{ marginTop: 'auto', padding: '16px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>System Status</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeAlerts.length > 0 ? '#ef4444' : '#10b981' }}></div>
            <span style={{ fontSize: '0.9rem', color: 'white' }}>{activeAlerts.length > 0 ? 'Sensor Offline' : 'All sensors active'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <div>
            <h2 className="header-title">Facility Overview</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {format(currentTime, 'EEEE, MMMM do, yyyy | HH:mm:ss')}
            </p>
          </div>
          <div className="header-actions">
            <div className="mobile-sensor-status">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeAlerts.length > 0 ? '#ef4444' : '#10b981' }}></div>
              <span style={{ fontSize: '0.85rem', color: 'white' }}>Status: {activeAlerts.length > 0 ? 'Offline' : 'Active'}</span>
            </div>
            <button onClick={() => setActiveTab('alerts')} className="alerts-btn" style={{ backgroundColor: activeAlerts.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-bg)', border: activeAlerts.length > 0 ? '1px solid #ef4444' : 'var(--glass-border)', color: activeAlerts.length > 0 ? '#ef4444' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer' }}>
              <Bell size={18} />
              <span style={{ fontSize: '0.9rem' }}>{activeAlerts.length} Alerts</span>
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            {/* Top Cards Grid */}
            <div className="dashboard-grid">
              <SensorCard 
                title="Energy Usage" 
                value={currentValues.energy} 
                unit="kWh" 
                icon={Zap} 
                color="var(--color-energy)"
                trend={{ isPositive: false, value: 2.1 }}
              />
              <SensorCard 
                title="Temperature" 
                value={currentValues.temperature} 
                unit="°C" 
                icon={Thermometer} 
                color="var(--color-temp)"
                trend={{ isPositive: true, value: 0.5 }}
              />
              <SensorCard 
                title="Humidity" 
                value={currentValues.humidity} 
                unit="%" 
                icon={Droplets} 
                color="var(--color-humidity)"
                trend={{ isPositive: false, value: 1.2 }}
              />
              <SensorCard 
                title="Light Intensity" 
                value={currentValues.light} 
                unit="lux" 
                icon={Sun} 
                color="var(--color-light)"
              />
              <SensorCard 
                title="Occupancy" 
                value={currentValues.occupancy} 
                unit="people" 
                icon={Users} 
                color="var(--color-occupancy)"
              />

              <SensorCard 
                title="Power" 
                value={currentValues.power} 
                unit="W" 
                icon={Power} 
                color="#ec4899"
              />
              <SensorCard 
                title="Battery Voltage" 
                value={inverterData.battery_voltage} 
                unit="V" 
                icon={Gauge} 
                color="#10b981"
              />
              <SensorCard 
                title="Battery Current" 
                value={inverterData.current_amps} 
                unit="A" 
                icon={Activity} 
                color="#3b82f6"
              />
            </div>

            {/* Charts Section */}
            <div className="charts-grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 flex flex-col justify-center">
                <BatteryGauge soc={inverterData.battery_soc} />
              </div>
              <div style={{ width: '100%' }}>
                <LineChartWidget 
                  title="Historical State of Charge"
                  data={chartData}
                  dataKeys={['soc']}
                  colors={['#3b82f6']}
                  yAxisDomain={[0, 100]}
                  yAxisTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                  showDots={true}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'reports' && (
          <div className="reports-section">
            <div className="reports-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Historical Analytics</h3>
              
              <div className="timeframe-selector" style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: 'var(--glass-border)' }}>
                {['hourly', 'daily', 'weekly', 'monthly'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setReportsTimeframe(tf)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: reportsTimeframe === tf ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: reportsTimeframe === tf ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: reportsTimeframe === tf ? 600 : 400,
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Average Temperature</span>
                <span style={{ fontSize: '2rem', fontWeight: 700 }}>22.4°C</span>
              </div>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Peak Energy Usage</span>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-energy)' }}>18.2 kWh</span>
              </div>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Data Points Logged</span>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-humidity)' }}>{reportsData.length}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-card" style={{ height: '400px' }}>
                <LineChartWidget 
                  title={`Temperature Trends (${reportsTimeframe})`}
                  data={reportsData}
                  dataKeys={['temperature']}
                  colors={['var(--color-temp)']}
                />
              </div>
              
              <div className="glass-card" style={{ height: '400px' }}>
                <LineChartWidget 
                  title={`Energy Consumption (${reportsTimeframe})`}
                  data={reportsData}
                  dataKeys={['energy']}
                  colors={['var(--color-energy)']}
                />
              </div>

              <div className="glass-card" style={{ height: '400px' }}>
                <LineChartWidget 
                  title={`Humidity Trends (${reportsTimeframe})`}
                  data={reportsData}
                  dataKeys={['humidity']}
                  colors={['var(--color-humidity)']}
                />
              </div>

              <div className="glass-card" style={{ height: '400px' }}>
                <LineChartWidget 
                  title={`Light Intensity (${reportsTimeframe})`}
                  data={reportsData}
                  dataKeys={['light']}
                  colors={['var(--color-light)']}
                />
              </div>

              <div className="glass-card" style={{ height: '400px' }}>
                <LineChartWidget 
                  title={`Occupancy Rate (${reportsTimeframe})`}
                  data={reportsData}
                  dataKeys={['occupancy']}
                  colors={['var(--color-occupancy)']}
                />
              </div>
            </div>
          </div>
        )}



        {activeTab === 'alerts' && (
          <div style={{ padding: '2rem', backgroundColor: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '16px', marginTop: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>System Alerts</h3>
            {activeAlerts.length === 0 ? (
               <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981' }}>
                 No active alerts. All systems are operating normally.
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {activeAlerts.map(alert => (
                   <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#f8fafc' }}>
                     <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '50%', display: 'flex' }}>
                       <Bell size={24} className="text-red-500" />
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontWeight: 700, color: '#ef4444' }}>{alert.level.toUpperCase()} WARNING</span>
                       <span style={{ fontSize: '0.95rem', marginTop: '2px' }}>{alert.message}</span>
                       <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                         Last recorded heartbeat: {format(alert.timestamp, 'MMM do, yyyy HH:mm:ss')}
                       </span>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
