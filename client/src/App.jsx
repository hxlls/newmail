import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './components/MainLayout';
import { authAPI } from './services/api';

function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    setUser(user);
    message.success(t('auth.login_success'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    message.success(t('auth.logout_success'));
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>{t('common.loading')}</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register onLogin={handleLogin} />} />
      <Route path="/*" element={user ? <MainLayout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
