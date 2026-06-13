import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Card } from '../../components/common';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('請輸入帳號和密碼');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || '登入失敗，請檢查帳號密碼');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)',
      padding: 'var(--space-4)'
    }}>
      <Card style={{
        width: '100%',
        maxWidth: '420px',
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-2xl)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ 
            fontSize: 'var(--text-3xl)', 
            color: 'var(--color-primary-800)', 
            margin: 0,
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>社照會</h1>
          <p style={{ 
            margin: 'var(--space-1) 0 0 0', 
            color: 'var(--color-neutral-500)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500'
          }}>薪資管理系統</p>
        </div>

        {error && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-error-light)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            marginBottom: 'var(--space-4)',
            borderLeft: '4px solid var(--color-error)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="登入帳號"
            placeholder="請輸入您的帳號"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label="登入密碼"
            type="password"
            placeholder="請輸入您的密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            style={{ width: '100%', marginTop: 'var(--space-4)', padding: 'var(--space-3)' }}
          >
            登入系統
          </Button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-neutral-400)'
        }}>
          &copy; 2026 社會照顧關懷協會. All rights reserved.
        </div>
      </Card>
    </div>
  );
}
