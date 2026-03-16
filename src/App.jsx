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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, onSnapshot, query, orderBy, limit, doc } from 'firebase/firestore';
import { db } from './firebase'; // Import the db instance

import SensorCard from './components/SensorCard';
import LineChartWidget from './components/LineChartWidget';
import Login from './components/Login';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chartData, setChartData] = useState([]); // Start empty
  
  // Real-time current values (start with zeros until data loads)
  const [currentValues, setCurrentValues] = useState({
    energy: 0,
    temperature: 0,
    humidity: 0,
    light: 0,
    occupancy: 0
  });

  // 1. Listen for Real-time Current Sensor Values
  useEffect(() => {
    // Assuming you have a document 'latest' inside a 'sensors' collection
    const currentDataRef = doc(db, 'sensors', 'latest');
    
    // onSnapshot listens for real-time changes in the database
    const unsubscribeCurrent = onSnapshot(currentDataRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentValues(docSnap.data());
      } else {
        console.log("No such document in Realtime database: 'sensors/latest'");
      }
    }, (error) => {
      console.error("Error fetching latest sensor data. (Expected if placeholder config is used):", error);
    });

    // Cleanup listener on unmount
    return () => unsubscribeCurrent();
  }, []);

  // 2. Fetch Historical Data for Charts
  useEffect(() => {
    // Assuming you have a 'history' collection, ordered by timestamp
    const historyRef = collection(db, 'history');
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(24));

    const unsubscribeHistory = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData.timestamp) {
            data.push({
            time: format(docData.timestamp.toDate(), 'HH:mm'), // Convert Firestore timestamp
            temperature: docData.temperature,
            humidity: docData.humidity,
            energy: docData.energy,
            light: docData.light,
            });
        }
      });
      // Reverse to get chronological order for the chart (oldest to newest)
      setChartData(data.reverse()); 
    }, (error) => {
      console.error("Error fetching history data. (Expected if placeholder config is used):", error);
    });

    return () => unsubscribeHistory();
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
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
              <LineChartWidget 
                title="Temperature & Humidity (24h)"
                data={chartData}
                dataKeys={['temperature', 'humidity']}
                colors={['var(--color-temp)', 'var(--color-humidity)']}
              />
              <LineChartWidget 
                title="Energy Consumption (kWh)"
                data={chartData}
                dataKeys={['energy']}
                colors={['var(--color-energy)']}
              />
            </div>
          </>
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
