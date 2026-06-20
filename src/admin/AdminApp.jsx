import React, { useState, useEffect, useRef } from 'react';
import {
  Lock, Mail, ArrowRight, Coins, Receipt, Copy, Check,
  LogOut, History, Zap, Printer, X, ChevronDown, User, MapPin, Activity, Menu
} from 'lucide-react';
import { collection, query as fsQuery, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { firestoreDb, db, generateTokenFn } from '../firebase';
import './AdminApp.css';

const RATE_NGN_PER_KWH = 2300;

function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState(null);
  const [currentView, setCurrentView] = useState('purchase'); // 'purchase' | 'history'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Purchase state
  const [amountNgn, setAmountNgn] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');

  // History state
  const [transactions, setTransactions] = useState([]);

  // Telemetry state
  const [totalEnergy, setTotalEnergy] = useState(0);

  // Token copy feedback
  const [copied, setCopied] = useState(false);

  // Receipt modal
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef(null);

  // Fetch transaction history
  useEffect(() => {
    if (!isAuthenticated || !username) return;

    const q = fsQuery(
      collection(firestoreDb, 'billing_transactions'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txns = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.username === username) {
          txns.push({ id: doc.id, ...data });
        }
      });
      setTransactions(txns);
    });

    return () => unsubscribe();
  }, [isAuthenticated, username]);

  // Fetch Live Telemetry (for Total Energy Used)
  useEffect(() => {
    if (!isAuthenticated) return;

    const liveRef = ref(db, 'telemetry/live');
    const unsubscribe = onValue(liveRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTotalEnergy(data.energy || 0);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const userDoc = await getDoc(doc(firestoreDb, 'users', loginUsername));
      if (userDoc.exists()) {
        const docData = userDoc.data();
        if (docData.password === loginPassword) {
          setUsername(loginUsername);
          setUserData(docData);
          setIsAuthenticated(true);
        } else {
          setLoginError('Invalid password.');
        }
      } else {
        setLoginError('User not found.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Login failed. Check console for details.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Purchase handler
  const handlePurchase = async () => {
    setPurchaseError('');
    const amount = parseFloat(amountNgn);

    if (!amount || amount < 230) {
      setPurchaseError('Minimum purchase is ₦230 (0.1 kWh).');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateTokenFn({
        amount_ngn: amount,
        username: username
      });
      setGeneratedResult(result.data);
      setAmountNgn('');
      setShowReceipt(true);
    } catch (err) {
      console.error('Token generation error:', err);
      setPurchaseError(err.message || 'Failed to generate token.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy token to clipboard
  const handleCopyToken = async () => {
    if (generatedResult?.token) {
      await navigator.clipboard.writeText(generatedResult.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Print receipt
  const handlePrintReceipt = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>SensoDash Receipt</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; }
            .receipt-header { text-align: center; margin-bottom: 24px; }
            .receipt-header h2 { margin: 0; font-size: 1.5rem; color: #1e293b; }
            .receipt-header p { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; }
            .receipt-divider { border: none; border-top: 2px dashed #cbd5e1; margin: 16px 0; }
            .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 0.95rem; }
            .receipt-row .label { color: #64748b; }
            .receipt-row .value { font-weight: 600; color: #1e293b; }
            .receipt-token { text-align: center; padding: 16px; background: #f1f5f9; border-radius: 8px; margin: 16px 0; font-family: monospace; font-size: 1.3rem; font-weight: 700; letter-spacing: 2px; color: #1e293b; }
            .receipt-footer { text-align: center; margin-top: 24px; color: #94a3b8; font-size: 0.8rem; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Computed kWh preview
  const previewKwh = amountNgn ? (parseFloat(amountNgn) / RATE_NGN_PER_KWH) : 0;

  // ============ LOGIN SCREEN ============
  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-bg-shape admin-shape-1"></div>
        <div className="admin-login-bg-shape admin-shape-2"></div>
        <div className="admin-login-bg-shape admin-shape-3"></div>

        <div className={`admin-login-card ${isLoggingIn ? 'admin-login-animating' : ''}`}>
          <div className="admin-login-header">
            <div className="admin-login-icon-wrap">
              <Coins size={32} />
            </div>
            <h1 className="admin-login-title">SensoDash</h1>
            <p className="admin-login-subtitle">Energy Credit Portal</p>
          </div>

          {loginError && (
            <div className="admin-error-banner">{loginError}</div>
          )}

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="admin-input-group">
              <span className="admin-input-icon"><Mail size={18} /></span>
              <input
                type="text"
                placeholder="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                className="admin-login-input"
                id="admin-username"
              />
            </div>
            <div className="admin-input-group">
              <span className="admin-input-icon"><Lock size={18} /></span>
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="admin-login-input"
                id="admin-password"
              />
            </div>
            <button type="submit" className="admin-login-btn" disabled={isLoggingIn} id="admin-login-submit">
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="admin-login-footer">
            <p>Authorized facility accounts only.</p>
          </div>
        </div>
      </div>
    );
  }

  // ============ MAIN ADMIN PANEL (SIDEBAR LAYOUT) ============
  return (
    <div className="admin-app-layout">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-icon">
            <Zap size={24} />
          </div>
          <div>
            <h1>SensoDash</h1>
            <p>Credit Portal</p>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          <button
            className={`admin-nav-link ${currentView === 'purchase' ? 'active' : ''}`}
            onClick={() => { setCurrentView('purchase'); setIsMobileMenuOpen(false); }}
          >
            <Coins size={20} />
            <span>Purchase Credit</span>
          </button>
          <button
            className={`admin-nav-link ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => { setCurrentView('history'); setIsMobileMenuOpen(false); }}
          >
            <History size={20} />
            <span>Transaction History</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <button
            className="admin-logout-btn"
            onClick={() => { setIsAuthenticated(false); setUsername(''); setUserData(null); }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main-content">
        <header className="admin-content-header">
          <div className="admin-header-left">
            <button className="admin-mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2>{currentView === 'purchase' ? 'Purchase Energy Credit' : 'Transaction History'}</h2>
          </div>
          <div className="admin-user-badge">
            <div className="admin-user-avatar">{username.charAt(0).toUpperCase()}</div>
            <span className="admin-user-name">{userData?.display_name || username}</span>
          </div>
        </header>

        <div className="admin-scrollable-area">
          {currentView === 'purchase' && (
            <>
              <div className="admin-dashboard-grid">
              {/* Account Details Card */}
              <div className="admin-card admin-profile-card">
                <div className="admin-card-header">
                  <User size={20} className="admin-card-icon" />
                  <h3>Account Details</h3>
                </div>
                <div className="admin-profile-grid">
                  <div className="admin-profile-item">
                    <span className="admin-profile-label">Account Name</span>
                    <span className="admin-profile-value">{userData?.display_name || 'N/A'}</span>
                  </div>
                  <div className="admin-profile-item">
                    <span className="admin-profile-label">Username</span>
                    <span className="admin-profile-value">@{username}</span>
                  </div>
                  <div className="admin-profile-item">
                    <span className="admin-profile-label"><MapPin size={14} /> Address</span>
                    <span className="admin-profile-value">{userData?.address || 'Not provided'}</span>
                  </div>
                  <div className="admin-profile-item highlight-item">
                    <span className="admin-profile-label"><Activity size={14} /> Total Energy Used</span>
                    <span className="admin-profile-value energy-val">{totalEnergy.toFixed(2)} kWh</span>
                  </div>
                </div>
              </div>

              {/* Purchase Form Card */}
              <div className="admin-card admin-purchase-card">
                <div className="admin-card-header">
                  <Coins size={20} className="admin-card-icon" />
                  <h3>Generate Token</h3>
                </div>
                <p className="admin-card-desc">
                  Enter the amount in Naira (₦) to purchase energy credit.
                  <br />Rate: <strong>₦2,300 per kWh</strong>.
                </p>

                {purchaseError && (
                  <div className="admin-error-banner">{purchaseError}</div>
                )}

                <div className="admin-purchase-form">
                  <label className="admin-form-label">Amount (₦)</label>
                  <div className="admin-amount-input-wrap">
                    <span className="admin-currency-symbol">₦</span>
                    <input
                      type="number"
                      placeholder="e.g. 23000"
                      value={amountNgn}
                      onChange={(e) => setAmountNgn(e.target.value)}
                      min="230"
                      step="1"
                      className="admin-amount-input"
                    />
                  </div>

                  {/* kWh Preview */}
                  {amountNgn && parseFloat(amountNgn) > 0 && (
                    <div className="admin-kwh-preview">
                      <div className="admin-kwh-preview-inner">
                        <ChevronDown size={16} />
                        <span>You will receive</span>
                        <strong>{previewKwh.toFixed(2)} kWh</strong>
                        <span>of energy credit</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={isGenerating || !amountNgn || parseFloat(amountNgn) < 230}
                    className="admin-purchase-btn"
                  >
                    {isGenerating ? (
                      <>
                        <div className="admin-spinner"></div>
                        Generating Token...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Buy & Generate Token
                      </>
                    )}
                  </button>
                </div>

                <div className="admin-quick-amounts">
                  <span className="admin-quick-label">Quick select:</span>
                  {[2300, 5000, 11500, 23000, 46000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmountNgn(amt.toString())}
                      className="admin-quick-btn"
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Horizontal Rate Info Card */}
            <div className="admin-card admin-info-card-horizontal">
              <div className="admin-rate-grid-horizontal">
                <div className="admin-rate-item">
                  <span className="admin-rate-label">Base Rate</span>
                  <span className="admin-rate-value">₦230 / 0.1 kWh</span>
                </div>
                <div className="admin-rate-item">
                  <span className="admin-rate-label">Per kWh</span>
                  <span className="admin-rate-value">₦2,300</span>
                </div>
                <div className="admin-rate-item">
                  <span className="admin-rate-label">Min Purchase</span>
                  <span className="admin-rate-value">₦230 (0.1 kWh)</span>
                </div>
                <div className="admin-rate-item">
                  <span className="admin-rate-label">Token Format</span>
                  <span className="admin-rate-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>SDASH-XXXX-XXXX-XXXX</span>
                </div>
              </div>
            </div>
            </>
          )}

          {currentView === 'history' && (
            <div className="admin-card admin-history-card">
              <div className="admin-card-header">
                <History size={20} className="admin-card-icon" />
                <h3>Transaction History</h3>
              </div>
              {transactions.length === 0 ? (
                <div className="admin-empty-state">
                  <Receipt size={48} />
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Receipt</th>
                        <th>Amount (₦)</th>
                        <th>Energy (kWh)</th>
                        <th>Token</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id}>
                          <td>{new Date(txn.timestamp).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className="admin-receipt-id">{txn.receipt_id}</span></td>
                          <td>₦{txn.amount_ngn?.toLocaleString()}</td>
                          <td><strong style={{ color: '#10b981' }}>{txn.kwh_value?.toFixed(2)}</strong></td>
                          <td><code className="admin-token-code">{txn.token}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Receipt Modal */}
      {showReceipt && generatedResult && (
        <div className="admin-modal-overlay" onClick={() => setShowReceipt(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="admin-modal-close" onClick={() => setShowReceipt(false)}>
              <X size={20} />
            </button>

            <div ref={receiptRef} className="admin-receipt">
              <div className="receipt-header">
                <h2>⚡ SensoDash</h2>
                <p>Energy Credit Receipt</p>
              </div>
              <hr className="receipt-divider" />
              <div className="receipt-row">
                <span className="label">Receipt ID</span>
                <span className="value">{generatedResult.receipt_id}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Date</span>
                <span className="value">{new Date(generatedResult.timestamp).toLocaleString('en-NG')}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Account</span>
                <span className="value">{userData?.display_name || generatedResult.username}</span>
              </div>
              <hr className="receipt-divider" />
              <div className="receipt-row">
                <span className="label">Amount Paid</span>
                <span className="value" style={{ color: '#10b981', fontSize: '1.1rem' }}>₦{generatedResult.amount_ngn?.toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span className="label">Energy Credit</span>
                <span className="value" style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{generatedResult.kwh_value?.toFixed(2)} kWh</span>
              </div>
              <hr className="receipt-divider" />
              <div className="admin-receipt-token-section">
                <p className="admin-receipt-token-label">Your Token</p>
                <div className="admin-receipt-token-display">
                  {generatedResult.token}
                </div>
                <p className="admin-receipt-token-hint">Enter this token in your SensoDash dashboard to load credit.</p>
              </div>
              <hr className="receipt-divider" />
              <div className="receipt-footer">
                <p>Thank you for your purchase.</p>
                <p>SensoDash Energy Management System</p>
              </div>
            </div>

            <div className="admin-receipt-actions">
              <button className="admin-receipt-action-btn admin-copy-btn" onClick={handleCopyToken}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Token'}
              </button>
              <button className="admin-receipt-action-btn admin-print-btn" onClick={handlePrintReceipt}>
                <Printer size={16} />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApp;
