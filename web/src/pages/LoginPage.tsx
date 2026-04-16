import React, { useState, useEffect, useRef } from 'react';
import { Server, Lock, User as UserIcon, Eye, EyeOff, Loader, Shield, Zap } from 'lucide-react';
import { api, setToken } from '../api/http';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'setup' | 'verify'>('verify');
  const [qrCode, setQrCode] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState(false);
  const tempTokenRef = useRef(tempToken);

  useEffect(() => {
    tempTokenRef.current = tempToken;
  }, [tempToken]);

  useEffect(() => {
    if (step === 'otp' && otpPurpose === 'setup' && !qrCode && !loadingQr && tempToken) {
      setLoadingQr(true);
      api.otpSetup(tempToken).then(res => {
        if (res.success && res.data?.qrCode) {
          setQrCode(res.data.qrCode);
        } else {
          setError(res.error || '获取二维码失败');
        }
        setLoadingQr(false);
      }).catch(() => {
        setError('网络错误');
        setLoadingQr(false);
      });
    }
  }, [step, otpPurpose]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || loading) return;

    setLoading(true);
    setError('');

    const res = await api.login(username, password);
    if (res.success && res.data) {
      if (res.data.requireOtpSetup || res.data.requireOtpVerify) {
        setTempToken(res.data.tempToken || '');
        setOtpPurpose(res.data.requireOtpSetup ? 'setup' : 'verify');
        setStep('otp');
        setQrCode('');
      } else if (res.data.token) {
        setToken(res.data.token);
        onLogin();
      }
    } else {
      setError(res.error || '用户名或密码错误，请重试');
    }
    setLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6 || loading) return;

    setLoading(true);
    setError('');

    const res = otpPurpose === 'setup'
      ? await api.otpVerify(tempToken, otpCode)
      : await api.otpVerifyLogin(tempToken, otpCode);

    if (res.success && res.data?.token) {
      setToken(res.data.token);
      onLogin();
    } else {
      setError(res.error || '验证码错误');
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
    setOtpCode('');
    setTempToken('');
    setQrCode('');
    setError('');
  };

  const handleLoadQr = () => {
    if (!tempToken || loadingQr) return;
    setQrCode('');
    setLoadingQr(true);
    setError('');
    api.otpSetup(tempToken).then(res => {
      if (res.success && res.data?.qrCode) {
        setQrCode(res.data.qrCode);
      } else {
        setError(res.error || '获取二维码失败');
      }
      setLoadingQr(false);
    }).catch(() => {
      setError('网络错误');
      setLoadingQr(false);
    });
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F0F2F5' }}>
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #1677FF 0%, #0958D9 100%)' }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Server size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">项目自助发布平台</span>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-white leading-tight">
            高效、安全、便捷的<br />项目部署解决方案
          </h2>
          <p className="text-white/80 text-sm leading-relaxed">
            自动化部署流程，简化发布操作，提升开发效率
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Zap size={16} />
              </div>
              <span className="text-sm">一键部署，自动构建</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Shield size={16} />
              </div>
              <span className="text-sm">双因素认证，安全保障</span>
            </div>
          </div>
        </div>

        <div className="text-white/50 text-xs">
          © 2024 项目自助发布平台
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{ background: '#1677FF' }}
            >
              <Server size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">项目自助发布平台</h1>
          </div>

          <div className="text-center mb-8">
            <p className="text-sm text-gray-400 mt-1">
              {step === 'credentials' ? '请输入账号信息' : otpPurpose === 'setup' ? '请绑定双因素认证' : '请输入验证码'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {step === 'credentials' ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                {otpPurpose === 'setup' ? (
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-4">请使用身份验证器（如 Google Authenticator）扫描下方二维码</p>
                    {loadingQr ? (
                      <div className="py-8">
                        <Loader size={24} className="animate-spin mx-auto text-blue-500" />
                        <p className="text-xs text-gray-500 mt-2">正在生成二维码...</p>
                      </div>
                    ) : qrCode ? (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 inline-block">
                        <img src={qrCode} alt="OTP QR Code" className="w-48 h-48" />
                      </div>
                    ) : error ? (
                      <div className="py-4">
                        <p className="text-red-500 text-sm">{error}</p>
                        <button
                          type="button"
                          onClick={handleLoadQr}
                          className="mt-2 text-sm text-blue-500 hover:underline"
                        >
                          点击重试
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <button
                          type="button"
                          onClick={handleLoadQr}
                          className="text-sm text-blue-500 hover:underline"
                        >
                          点击加载二维码
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">请输入身份验证器中的6位验证码</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-500 mb-2 font-medium">验证码</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    disabled={loadingQr}
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all text-center tracking-widest font-mono"
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpCode.length !== 6 || loading || loadingQr}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: '#1677FF' }}
                >
                  {loading ? <Loader size={14} className="animate-spin" /> : null}
                  {loading ? '验证中...' : '确 定'}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  返回上一步
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
