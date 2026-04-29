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
  Radar,
  Download
} from 'lucide-react';
import { format, subHours, subDays, subWeeks, subMonths } from 'date-fns';
import { ref, onValue, push, set, query as rtdbQuery, orderByChild, limitToLast, update } from 'firebase/database';
import { collection, query as fsQuery, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
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
  
  // CSV Download State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStart, setDownloadStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [downloadEnd, setDownloadEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isDownloading, setIsDownloading] = useState(false);
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
      collection(firestoreDb, 'reports_ten_minute'),
      orderBy('timestamp', 'desc'),
      limit(144)
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
      'hourly': 'reports_ten_minute',
      'daily': 'reports_hourly',
      'weekly': 'reports_daily',
      'monthly': 'reports_daily'
    };

    const targetCollection = collectionMap[reportsTimeframe];
    if (!targetCollection) return;

    let points = 24;
    let timeFormatter = (timestamp) => format(new Date(timestamp), 'HH:mm');

    switch(reportsTimeframe) {
      case 'daily':
        points = 168; // 24 hours * 7 days
        timeFormatter = (timestamp) => format(new Date(timestamp), 'EEE HH:mm'); // Mon 14:00
        break;
      case 'weekly':
        points = 28; // 7 days * 4 weeks
        timeFormatter = (timestamp) => format(new Date(timestamp), 'MMM d'); // Oct 12
        break;
      case 'monthly':
        points = 365; // 365 days
        timeFormatter = (timestamp) => format(new Date(timestamp), 'MMM d'); // Jan 5
        break;
      default: // hourly
        points = 144; // 6 points per hour * 24 hours
        timeFormatter = (timestamp) => format(new Date(timestamp), 'HH:mm'); // 14:30
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

  const handleDownloadData = async () => {
    try {
      setIsDownloading(true);
      const collectionMap = {
        'hourly': 'reports_ten_minute',
        'daily': 'reports_hourly',
        'weekly': 'reports_daily',
        'monthly': 'reports_daily'
      };
      const targetCollection = collectionMap[reportsTimeframe] || 'reports_ten_minute';

      const startDate = new Date(downloadStart);
      const endDate = new Date(downloadEnd);
      // set to start/end of the day respectively
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const q = fsQuery(
        collection(firestoreDb, targetCollection),
        where('timestamp', '>=', startDate.getTime()),
        where('timestamp', '<=', endDate.getTime()),
        orderBy('timestamp', 'asc') // chronological
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("No data found for this date range.");
        setIsDownloading(false);
        return;
      }

      // Generate CSV
      let csvContent = "Time,Temperature(C),Humidity(%),Energy(kWh),Light(lux),Occupancy,SOC(%)\n";
      
      snapshot.forEach(doc => {
        const val = doc.data();
        const dateStr = format(new Date(val.timestamp), 'yyyy-MM-dd HH:mm:ss');
        const temp = val.temperature || 0;
        const hum = val.humidity || 0;
        const nrg = val.energy || 0;
        const lux = val.lux || val.light || 0;
        const occ = val.ultrasonic_occupancy || val.occupancy || 0;
        const soc = val.battery_soc || val.soc || 0;
        
        csvContent += `${dateStr},${temp},${hum},${nrg},${lux},${occ},${soc}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sensodash_${reportsTimeframe}_${downloadStart}_to_${downloadEnd}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowDownloadModal(false);
    } catch (error) {
      console.error("Error downloading CSV:", error);
      alert("Failed to download data. See console for details.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Dynamically compute active alerts
  const activeAlerts = [];
  
  // Compute difference between current running time and when we last got data
  if (currentTime.getTime() - lastDataReceivedAt > 6 * 1000) {
    activeAlerts.push({
      id: 'offline',
      level: 'critical',
      message: 'System Offline: Sensor data has not been updated in over 5 seconds.',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Historical Analytics</h3>
                <button 
                  onClick={() => setShowDownloadModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
              
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
                <span style={{ fontSize: '2rem', fontWeight: 700 }}>
                  {reportsData.length > 0 
                    ? (reportsData.reduce((acc, curr) => acc + curr.temperature, 0) / reportsData.length).toFixed(1) 
                    : "0.0"}°C
                </span>
              </div>
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Peak Energy Usage</span>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-energy)' }}>
                  {reportsData.length > 0 
                    ? Math.max(...reportsData.map(d => d.energy)).toFixed(1) 
                    : "0.0"} kWh
                </span>
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

        {/* Download CSV Modal */}
        {showDownloadModal && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ width: '90%', maxWidth: '400px', padding: '24px', position: 'relative' }}>
              <button 
                onClick={() => setShowDownloadModal(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
              <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={20} /> Download Data
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Select a date range to export the <b>{reportsTimeframe}</b> data.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Start Date</label>
                  <input 
                    type="date" 
                    value={downloadStart}
                    onChange={(e) => setDownloadStart(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End Date</label>
                  <input 
                    type="date" 
                    value={downloadEnd}
                    onChange={(e) => setDownloadEnd(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <button 
                onClick={handleDownloadData}
                disabled={isDownloading}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, cursor: isDownloading ? 'not-allowed' : 'pointer', opacity: isDownloading ? 0.7 : 1 }}
              >
                {isDownloading ? 'Generating CSV...' : 'Download Export'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
