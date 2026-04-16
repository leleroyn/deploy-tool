import React, { useState } from 'react';
import { Server, Lock, User as UserIcon, Eye, EyeOff, Loader } from 'lucide-react';
import { api, setToken } from '../api/http';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || loading) return;

    setLoading(true);
    setError('');

    const res = await api.login(username, password);
    if (res.success && res.data?.token) {
      setToken(res.data.token);
      onLogin();
    } else {
      setError(res.error || '用户名或密码错误，请重试');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#F0F2F5' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: '#1677FF' }}
          >
            <Server size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">项目自助发布平台</h1>
          <p className="text-sm text-gray-400 mt-1">请输入账号信息</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-500 mb-2 font-medium">用户名</label>
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  autoFocus
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2 font-medium">访问密码</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!username || !password || loading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: '#1677FF' }}
            >
              {loading ? <Loader size={14} className="animate-spin" /> : null}
              {loading ? '验证中...' : '登 录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
