import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { firestoreDb } from '../firebase';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // First try Firestore users collection
      const userDoc = await getDoc(doc(firestoreDb, 'users', email));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.password === password) {
          setIsAnimating(true);
          setTimeout(() => {
            onLogin(email); // Pass username to App.jsx
          }, 800);
          return;
        } else {
          setError('Invalid password');
          setIsLoading(false);
          return;
        }
      }

      // Fallback to hardcoded credentials for backwards compatibility
      if (email === 'g12026' && password === '14cpe*') {
        setIsAnimating(true);
        setTimeout(() => {
          onLogin(email);
        }, 800);
      } else {
        setError('Invalid username or password');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      // If Firestore is unreachable, fallback to hardcoded check
      if (email === 'g12026' && password === '14cpe*') {
        setIsAnimating(true);
        setTimeout(() => {
          onLogin(email);
        }, 800);
      } else {
        setError('Invalid username or password');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="login-container">
      {/* Decorative background elements */}
      <div className="login-bg-shape login-shape-1"></div>
      <div className="login-bg-shape login-shape-2"></div>
      <div className="login-bg-shape login-shape-3"></div>

      <div className={`login-card ${isAnimating ? 'login-success-anim' : ''}`}>
        <div className="login-header">
          <h1 className="login-title">SensoDash</h1>
        </div>

        {error && (
          <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <span className="input-icon">
              <Mail size={18} />
            </span>
            <input
              type="text"
              placeholder="Username or Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
            />
          </div>

          <div className="input-group">
            <span className="input-icon">
              <Lock size={18} />
            </span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input"
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            <span>{isLoading ? 'Authenticating...' : 'Authenticate'}</span>
            <ArrowRight size={18} className="submit-icon" />
          </button>
        </form>

        <div className="login-footer">
          <p>Authorized Personnel Only.</p>
          <p>Contact System Configurator for access.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
