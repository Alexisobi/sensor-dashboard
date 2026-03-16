import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (email === 'abcde' && password === 'cpe2026') {
      // Simulate a brief loading animation before login
      setIsAnimating(true);
      setTimeout(() => {
        onLogin(); // Tell App.jsx we are authenticated
      }, 800);
    } else {
      setError('Invalid username or password');
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

          <button type="submit" className="login-submit-btn">
            <span>Authenticate</span>
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
