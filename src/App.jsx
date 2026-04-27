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
import { ref, onValue } from 'firebase/database';
import { db } from './firebase'; // Import the db instance

import SensorCard from './components/SensorCard';
import LineChartWidget from './components/LineChartWidget';
import Login from './components/Login';
import BatteryGauge from './components/BatteryGauge';
import PowerFlow from './components/PowerFlow';
import LoadTrend from './components/LoadTrend';
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
    last_seen: null
  });
  const [loadTrendData, setLoadTrendData] = useState([]);

  // 1. Real-time Current Sensor Values from Firebase Realtime Database
  useEffect(() => {
    // --- DIAGONSTICS: Track connection state directly ---
    const connectedRef = ref(db, ".info/connected");
    const unsubConnected = onValue(connectedRef, (snap) => {
      console.log("📡 Firebase Connection Status:", snap.val() === true ? "ONLINE 🟢" : "OFFLINE / CONNECTING 🔴");
    });

    // Listen to Firebase 'live_data' path for real-time updates
    const currentRef = ref(db, 'live_data');
    
    // onValue listens for data changes at a particular path
    console.log("Attempting to connect to Firebase Realtime Database at 'live_data'...");
    
    const unsubscribe = onValue(currentRef, (snapshot) => {
      const data = snapshot.val();
      console.log("🔥 Firebase Data Received:", data);
      
      if (data) {
        // Map the custom database values to what our dashboard expects
        setCurrentValues({
          energy: data.energy ?? 0,
          temperature: data.temperature ?? 0,
          humidity: data.humidity ?? 0,
          light: data.lux ?? 0,                  // Maps 'lux' to 'light'
          occupancy: data.ultrasonic_occupancy ?? 0, // Maps 'ultrasonic_occupancy' to 'occupancy'
          current: data.current ?? 0,
          voltage: data.voltage ?? 0,
          power: data.power ?? 0,
          presence: data.radar_motion ?? 0
        });
      } else {
        console.warn("Sensor data not found in Firebase. Please create data at the 'sensors/current' path.");
      }
    }, (error) => {
      console.error("Error fetching real-time data from Realtime Database:", error);
    });

    // onValue returns an unsubscribe callback
    return () => unsubscribe();
  }, []);

  // 1b. Real-time Inverter Data from Firebase
  useEffect(() => {
    const inverterRef = ref(db, 'inverter');
    
    const unsubscribe = onValue(inverterRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInverterData({
          battery_soc: data.battery_soc ?? 0,
          current_amps: data.current_amps ?? 0,
          load_watts: data.load_watts ?? 0,
          status: data.status ?? 'Unknown',
          last_seen: data.last_seen ?? null
        });

        // Update sliding window for LoadTrend (last 30 readings)
        setLoadTrendData(prev => {
          const now = new Date();
          const timeString = format(now, 'HH:mm:ss');
          const newPoint = { time: timeString, load: data.load_watts ?? 0 };
          const newArray = [...prev, newPoint];
          return newArray.slice(-30); // Keep last 30 items
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Historical Data for Charts (For Presentation)
  useEffect(() => {
    // Use the same mock generator we built for reports to populate the dashboard charts instantly
    // In the future, uncomment the Firebase logic here
    setChartData(generateMockData('hourly'));
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

  // Generate Mock Data for Reports based on timeframe
  const generateMockData = (timeframe) => {
    const data = [];
    const now = new Date();
    
    let points = 24;
    let timeFormatter = (d) => format(d, 'HH:mm');
    let subtractor = subHours;
    let baseTemp = 22;
    let baseHum = 45;
    let baseEnergy = 12;

    switch(timeframe) {
      case 'daily':
        points = 7;
        timeFormatter = (d) => format(d, 'EEE'); // Mon, Tue
        subtractor = subDays;
        break;
      case 'weekly':
        points = 4;
        timeFormatter = (d) => `Week ${format(d, 'w')}`;
        subtractor = subWeeks;
        break;
      case 'monthly':
        points = 12;
        timeFormatter = (d) => format(d, 'MMM'); // Jan, Feb
        subtractor = subMonths;
        break;
      default: // hourly
        points = 24;
        break;
    }

    for (let i = points - 1; i >= 0; i--) {
      const date = subtractor(now, i);
      data.push({
        time: timeFormatter(date),
        temperature: baseTemp + (Math.random() * 4 - 2),
        humidity: baseHum + (Math.random() * 10 - 5),
        energy: baseEnergy + (Math.random() * 5 - 2),
        light: Math.floor(Math.random() * 500 + 300),
        occupancy: Math.max(0, Math.floor(12 + (Math.random() * 8 - 4)))
      });
    }
    return data;
  };

  // Update reports data when timeframe changes
  useEffect(() => {
    setReportsData(generateMockData(reportsTimeframe));
  }, [reportsTimeframe]);

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
            className={`sidebar-link ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '12px', 
              backgroundColor: activeTab === 'config' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'config' ? 'white' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'config' ? 500 : 'normal'
            }}>
            <Settings size={20} />
            Sensors & Config
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
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
            <span style={{ fontSize: '0.9rem', color: 'white' }}>All sensors active</span>
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
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              <span style={{ fontSize: '0.85rem', color: 'white' }}>Status: Active</span>
            </div>
            <button className="alerts-btn" style={{ backgroundColor: 'var(--glass-bg)', border: 'var(--glass-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer' }}>
              <Bell size={18} />
              <span style={{ fontSize: '0.9rem' }}>2 Alerts</span>
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
                title="Presence (Radar)" 
                value={currentValues.presence} 
                unit={currentValues.presence > 0 ? "Detected" : "Clear"} 
                icon={Radar} 
                color={currentValues.presence > 0 ? "#f43f5e" : "#94a3b8"}
              />
              <SensorCard 
                title="Current" 
                value={currentValues.current} 
                unit="A" 
                icon={Activity} 
                color="#f59e0b"
              />
              <SensorCard 
                title="Voltage" 
                value={currentValues.voltage} 
                unit="V" 
                icon={Gauge} 
                color="#8b5cf6"
              />
              <SensorCard 
                title="Power" 
                value={currentValues.power} 
                unit="W" 
                icon={Power} 
                color="#ec4899"
              />
            </div>

            {/* Charts Section */}
            <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 flex flex-col justify-center">
                <BatteryGauge soc={inverterData.battery_soc} />
              </div>
              <PowerFlow 
                currentAmps={inverterData.current_amps}
                status={inverterData.status}
                lastSeen={inverterData.last_seen}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <LoadTrend dataPoints={loadTrendData} />
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

        {activeTab === 'config' && (
          <div style={{ padding: '2rem', backgroundColor: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '16px', marginTop: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>Sensors & Configuration</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Sensor connection settings and thresholds configuration will go here.</p>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ padding: '2rem', backgroundColor: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: '16px', marginTop: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>System Alerts</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Notices, warnings, and error logs will go here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
