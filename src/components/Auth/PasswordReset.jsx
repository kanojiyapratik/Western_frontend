import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './PasswordReset.css';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (import.meta.env.MODE === 'production') {
    return 'https://threed-configurator-backend-7pwk.onrender.com/api';
  }
  if (typeof window !== 'undefined' && 
    (window.location.hostname.includes('vercel.app') || 
     window.location.hostname.includes('netlify.app'))) {
    return 'https://threed-configurator-backend-7pwk.onrender.com/api';
  }
  return 'http://192.168.1.7:5000/api';
};

export default function PasswordReset() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1=request, 2=reset
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill email with current user's email
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const requestOtp = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send OTP');
      setMessage('OTP sent to your email');
      setStep(2);
    } catch (err) {
      setMessage(err.message || 'Error');
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to reset password');
      setMessage('Password reset successful. You can now login.');
      setStep(1);
      setEmail(''); setOtp(''); setNewPassword('');
    } catch (err) {
      setMessage(err.message || 'Error');
    } finally { setLoading(false); }
  };

  return (
    <div className="password-reset-card">
      <h2>Change / Reset Password</h2>
      {message && <div className="message">{message}</div>}

      {step === 1 ? (
        <div>
          <label>Email</label>
          <input 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="user@example.com"
            readOnly={!!user?.email}
            style={user?.email ? {backgroundColor: '#f3f4f6', cursor: 'not-allowed'} : {}}
          />
          <div style={{marginTop:12}}>
            <button onClick={requestOtp} disabled={loading || !email}>Send OTP</button>
          </div>
        </div>
      ) : (
        <div>
          <label>Email</label>
          <input 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            readOnly={!!user?.email}
            style={user?.email ? {backgroundColor: '#f3f4f6', cursor: 'not-allowed'} : {}}
          />
          <label>OTP</label>
          <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter OTP from email" />
          <label>New password</label>
          <div className="password-input-container">
            <input 
              type={showPassword ? "text" : "password"} 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Enter new password" 
            />
            <button 
              type="button" 
              className="password-toggle-btn" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div style={{marginTop:12}}>
            <button onClick={submitReset} disabled={loading || !otp || !newPassword}>Reset password</button>
          </div>
        </div>
      )}
    </div>
  );
}
