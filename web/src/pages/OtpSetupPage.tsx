import React, { useState, useEffect } from 'react';
import { Shield, Loader, CheckCircle } from 'lucide-react';
import { api, setToken } from '../api/http';

interface OtpSetupPageProps {
  tempToken: string;
  onComplete: () => void;
  onCancel: () => void;
}

const OtpSetupPage: React.FC<OtpSetupPageProps> = ({ tempToken, onComplete, onCancel }) => {
  const [qrCode, setQrCode] = useState<string>('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'scan' | 'verify'>('scan');
  const [newTempToken, setNewTempToken] = useState(tempToken);

  useEffect(() => {
    loadQrCode();
  }, []);

  const loadQrCode = async () => {
    setLoading(true);
    try {
      const res = await api.otpSetup(newTempToken);
      if (res.success && res.data?.qrCode) {
        setQrCode(res.data.qrCode);
        if (res.data.tempToken) {
          setNewTempToken(res.data.tempToken);
        }
        setStep('verify');
      } else {
        setError(res.error || '获取二维码失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await api.otpVerify(newTempToken, code);
      if (res.success && res.data?.token) {
        setToken(res.data.token);
        onComplete();
      } else {
        setError(res.error || '验证码错误');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#F0F2F5' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: '#1677FF' }}
          >
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">双因素认证绑定</h1>
          <p className="text-sm text-gray-400 mt-1">请按照以下步骤完成绑定</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {loading ? (
            <div className="text-center py-8">
              <Loader size={24} className="animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-gray-500 mt-3">正在生成二维码...</p>
            </div>
          ) : step === 'verify' ? (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">请使用身份验证器（如 Google Authenticator）扫描下方二维码</p>
                {qrCode && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 inline-block">
                    <img src={qrCode} alt="OTP QR Code" className="w-48 h-48" />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm text-gray-600 mb-4 text-center">扫描成功后，请输入下方显示的6位验证码</p>
                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="输入6位验证码"
                    maxLength={6}
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-all text-center tracking-widest font-mono text-lg"
                  />

                  {error && (
                    <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={code.length !== 6 || submitting}
                    className="w-full py-3 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: '#1677FF' }}
                  >
                    {submitting ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {submitting ? '验证中...' : '完成绑定'}
                  </button>

                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    取消
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-red-500">{error || '加载失败'}</p>
              <button
                onClick={onCancel}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                返回登录
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtpSetupPage;
