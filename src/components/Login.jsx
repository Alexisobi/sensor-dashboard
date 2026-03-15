import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate a brief loading animation before login
    setIsAnimating(true);
    setTimeout(() => {
      onLogin(); // Tell App.jsx we are authenticated
    }, 800);
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
