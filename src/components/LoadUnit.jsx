import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight, Check, AlertTriangle, Clock, Coins } from 'lucide-react';
import { collection, query as fsQuery, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { firestoreDb, redeemTokenFn } from '../firebase';

const LoadUnit = ({ username, currentCredit, creditStatus }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [result, setResult] = useState(null); // { success, message, kwh_added, new_credit } | { error, message }
  const [recentRedemptions, setRecentRedemptions] = useState([]);

  // Fetch recent redemptions for this user
  useEffect(() => {
    if (!username) return;

    const q = fsQuery(
      collection(firestoreDb, 'billing_transactions'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const redemptions = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.username === username) {
          redemptions.push({ id: doc.id, ...data });
        }
      });
      setRecentRedemptions(redemptions.slice(0, 5));
    });

    return () => unsubscribe();
  }, [username]);

  // Auto-format token input
  const handleTokenChange = (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setTokenInput(value);
  };

  // Redeem token
  const handleRedeem = async () => {
    if (!tokenInput.trim()) return;

    setIsRedeeming(true);
    setResult(null);

    try {
      const response = await redeemTokenFn({
        token: tokenInput.trim(),
        username: username
      });

      setResult({
        success: true,
        message: `Successfully loaded ${response.data.kwh_added.toFixed(2)} kWh!`,
        kwh_added: response.data.kwh_added,
        new_credit: response.data.new_credit
      });
      setTokenInput('');
    } catch (err) {
      console.error('Token redemption error:', err);
      setResult({
        error: true,
        message: err.message || 'Failed to redeem token. Please check and try again.'
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && tokenInput.trim()) {
      handleRedeem();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      {/* Current Credit Status */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: creditStatus === 'normal' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: creditStatus === 'normal' ? '#10b981' : '#ef4444'
          }}>
            <Zap size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Energy Credit Balance</h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {creditStatus === 'normal' ? 'Credit is active' :
               creditStatus === 'low' ? 'Low credit — please top up' :
               'Credit depleted — service interrupted'}
            </p>
          </div>
        </div>
        <div style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: creditStatus === 'normal' ? '#10b981' : '#ef4444',
          letterSpacing: '-1px',
          animation: creditStatus === 'depleted' ? 'pulse 1.5s infinite' : 'none'
        }}>
          {currentCredit.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>kWh</span>
        </div>
        {creditStatus === 'low' && (
          <div style={{
            marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px',
            color: '#ef4444', fontSize: '0.85rem'
          }}>
            <AlertTriangle size={16} />
            Low credit warning — your balance is below 5 kWh
          </div>
        )}
        {creditStatus === 'depleted' && (
          <div style={{
            marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px',
            color: '#ef4444', fontSize: '0.85rem', fontWeight: 600
          }}>
            <AlertTriangle size={16} />
            Credit depleted — relay cutoff active. Load a token to restore service.
          </div>
        )}
      </div>

      {/* Token Input Form */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Coins size={20} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Load Energy Token</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Enter the token from your purchase receipt to load energy credit.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="SDASH-XXXX-XXXX-XXXX"
            value={tokenInput}
            onChange={handleTokenChange}
            onKeyDown={handleKeyDown}
            disabled={isRedeeming}
            id="token-input"
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px 16px',
              borderRadius: '12px',
              color: 'white',
              fontSize: '1rem',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              outline: 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)';
              e.target.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.08)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleRedeem}
            disabled={isRedeeming || !tokenInput.trim()}
            id="redeem-token-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 20px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #10b981)',
              color: 'white', fontWeight: 600, cursor: isRedeeming || !tokenInput.trim() ? 'not-allowed' : 'pointer',
              opacity: isRedeeming || !tokenInput.trim() ? 0.5 : 1,
              transition: 'all 0.3s', fontSize: '0.95rem',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap'
            }}
          >
            {isRedeeming ? (
              <>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }}></div>
                Loading...
              </>
            ) : (
              <>
                <ArrowRight size={18} />
                Load
              </>
            )}
          </button>
        </div>

        {/* Success/Error feedback */}
        {result && (
          <div style={{
            marginTop: '16px', padding: '12px 16px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${result.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: result.success ? '#10b981' : '#ef4444',
            fontSize: '0.9rem',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {result.success ? <Check size={18} /> : <AlertTriangle size={18} />}
            {result.message}
          </div>
        )}
      </div>

      {/* Recent Redemptions */}
      {recentRedemptions.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Clock size={18} color="var(--text-secondary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Transactions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentRedemptions.map((txn) => (
              <div
                key={txn.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'rgba(0,0,0,0.15)',
                  borderRadius: '10px', fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    {new Date(txn.timestamp).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <code style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{txn.token}</code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: '#10b981' }}>+{txn.kwh_value?.toFixed(2)} kWh</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>₦{txn.amount_ngn?.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyframe styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default LoadUnit;
