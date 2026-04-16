import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DeployPage from './pages/DeployPage';
import BackupPage from './pages/BackupPage';
import PortCheckPage from './pages/PortCheckPage';
import RemoteMaintenancePage from './pages/RemoteMaintenancePage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import { useAppStore } from './store/appStore';
import { getToken, clearToken, api } from './api/http';

function App() {
  const checkHealth = useAppStore((s) => s.checkHealth);
  const setUser = useAppStore((s) => s.setUser);
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    if (!authed) return;
    
    // 启动时校验 token 是否仍有效，并获取用户信息
    const initAuth = async () => {
      try {
        const res = await api.me();
        if (res.success) {
          setUser(res.data);
        } else {
          clearToken();
          setAuthed(false);
        }
      } catch {
        clearToken();
        setAuthed(false);
      }
    };

    initAuth();
    
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [authed, setUser, checkHealth]);

  // 监听 401 响应，自动退出登录
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const clone = res.clone();
        clone.json().then((data) => {
          if (data?.error && data.error.includes('未登录')) {
            clearToken();
            setAuthed(false);
          }
        }).catch(() => {});
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={() => { clearToken(); setAuthed(false); }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deploy" element={<DeployPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/ports" element={<PortCheckPage />} />
          <Route path="/remote" element={<RemoteMaintenancePage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users" element={<UserManagementPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
