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
import { useAppStore } from './store/appStore';
import { getToken, clearToken } from './api/http';

function App() {
  const checkHealth = useAppStore((s) => s.checkHealth);
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    if (!authed) return;
    // 启动时校验 token 是否仍有效
    checkHealth().then((ok) => {
      // health 不需要认证，但如果 API 调用返回 401 则退出
    });
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [authed]);

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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
