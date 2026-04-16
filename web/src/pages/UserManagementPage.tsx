import React, { useEffect, useState } from 'react';
import { api } from '../api/http';
import { useAppStore } from '../store/appStore';
import { User, ShieldCheck, Camera, Save, Loader, Plus, X } from 'lucide-react';

const roleLabels: Record<string, { label: string; canManageUsers: boolean }> = {
  system_admin: { label: '系统管理员', canManageUsers: true },
  ops_admin: { label: '运维管理员', canManageUsers: false },
};

const UserManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'admin'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  
  const { user, setUser } = useAppStore();

  const [profileData, setProfileData] = useState({
    username: '',
    avatar: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        username: user.username || '',
        avatar: user.avatar || '',
      }));
    }
  }, [user]);

  const [users, setUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'ops_admin' as 'system_admin' | 'ops_admin',
  });

  useEffect(() => {
    if (user?.role && roleLabels[user.role]?.canManageUsers) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setAdminLoading(true);
    try {
      const res = await api.getUsers();
      if (res.success) {
        setUsers(res.data);
      } else {
        setMessage(res.error || '获取用户列表失败');
        setMsgType('error');
      }
    } catch {
      setMessage('请求失败');
      setMsgType('error');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    if (profileData.newPassword || profileData.confirmPassword) {
      if (!profileData.currentPassword) {
        setMessage('请输入当前密码');
        setMsgType('error');
        setLoading(false);
        return;
      }
      if (profileData.newPassword.length < 6) {
        setMessage('新密码长度不能少于 6 位');
        setMsgType('error');
        setLoading(false);
        return;
      }
      if (profileData.newPassword !== profileData.confirmPassword) {
        setMessage('两次输入的新密码不一致');
        setMsgType('error');
        setLoading(false);
        return;
      }
    }
    
    try {
      const res = await api.updateMe({ avatar: profileData.avatar });
      if (!res.success) {
        setMessage(res.error || '头像更新失败');
        setMsgType('error');
        setLoading(false);
        return;
      }
      
      if (profileData.newPassword) {
        const passwordRes = await api.changePassword({
          currentPassword: profileData.currentPassword,
          newPassword: profileData.newPassword,
        });
        if (!passwordRes.success) {
          setMessage(passwordRes.error || '密码修改失败');
          setMsgType('error');
          setLoading(false);
          return;
        }
      }
      
      setMessage('保存成功');
      setMsgType('success');
      const meRes = await api.me();
      if (meRes.success) {
        setUser(meRes.data);
      }
      setProfileData(prev => ({ 
        ...prev, 
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        avatar: meRes.data?.avatar || prev.avatar,
      }));
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage('请求失败');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id: string, data: any) => {
    try {
      const res = await api.updateUser(id, data);
      if (res.success) {
        fetchUsers();
        setMessage('操作成功');
        setMsgType('success');
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(res.error || '操作失败');
        setMsgType('error');
      }
    } catch {
      setMessage('请求失败');
      setMsgType('error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createData.username || !createData.password) {
      setMessage('用户名和密码不能为空');
      setMsgType('error');
      return;
    }
    if (createData.password.length < 6) {
      setMessage('密码长度不能少于6位');
      setMsgType('error');
      return;
    }
    if (createData.password !== createData.confirmPassword) {
      setMessage('两次输入的密码不一致');
      setMsgType('error');
      return;
    }

    try {
      const res = await api.createUser({
        username: createData.username,
        password: createData.password,
        role: createData.role,
      });
      if (res.success) {
        setMessage('创建成功');
        setMsgType('success');
        setShowCreateForm(false);
        setCreateData({ username: '', password: '', confirmPassword: '', role: 'ops_admin' });
        fetchUsers();
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(res.error || '创建失败');
        setMsgType('error');
      }
    } catch {
      setMessage('请求失败');
      setMsgType('error');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage('图片大小不能超过 5MB');
        setMsgType('error');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setProfileData(prev => ({ ...prev, avatar: compressed }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* My Profile Section */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
          <User size={15} className="text-primary" />
          我的资料
        </h2>

        <form onSubmit={handleUpdateProfile}>
          <div className="flex gap-10 items-start">
            {/* Avatar + Info */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden ring-2 ring-border">
                  {profileData.avatar ? (
                    <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-bg-tertiary text-text-secondary">
                      <User size={40} />
                    </div>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                  <Camera size={22} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                </label>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-text-primary">{profileData.username}</p>
                <p className="text-sm text-text-secondary mt-1">{roleLabels[user?.role || '']?.label || user?.role || ''}</p>
              </div>
            </div>

            {/* Password Fields */}
            <div className="flex-1 space-y-4 pt-4">
              <input
                type="password"
                placeholder="当前密码（修改时必填）"
                value={profileData.currentPassword}
                onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/60 transition-colors"
              />
              <input
                type="password"
                placeholder="新密码"
                value={profileData.newPassword}
                onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/60 transition-colors"
              />
              <input
                type="password"
                placeholder="确认密码"
                value={profileData.confirmPassword}
                onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              {loading ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
              保存修改
            </button>
            {message && (
              <span className={`text-xs ${msgType === 'success' ? 'text-status-success' : 'text-status-error'}`}>
                {message}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* All Users Section (Admin Only) */}
      {user?.role && roleLabels[user.role]?.canManageUsers && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck size={15} className="text-primary-light" />
              用户列表
            </h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white text-xs font-medium transition-all"
            >
              {showCreateForm ? <X size={12} /> : <Plus size={12} />}
              {showCreateForm ? '取消' : '新增用户'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-bg-tertiary/50 rounded-lg border border-border">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">用户名</label>
                  <input
                    type="text"
                    value={createData.username}
                    onChange={(e) => setCreateData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="输入用户名"
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">密码</label>
                  <input
                    type="password"
                    value={createData.password}
                    onChange={(e) => setCreateData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="输入密码"
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">确认密码</label>
                  <input
                    type="password"
                    value={createData.confirmPassword}
                    onChange={(e) => setCreateData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="再次输入密码"
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">角色</label>
                  <select
                    value={createData.role}
                    onChange={(e) => setCreateData(prev => ({ ...prev, role: e.target.value as 'system_admin' | 'ops_admin' }))}
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors"
                  >
                    <option value="ops_admin">运维管理员</option>
                    <option value="system_admin">系统管理员</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white text-sm font-medium transition-all"
                >
                  <Plus size={12} />
                  创建用户
                </button>
                {message && (
                  <span className={`text-xs ${msgType === 'success' ? 'text-status-success' : 'text-status-error'}`}>
                    {message}
                  </span>
                )}
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-text-secondary border-b border-border">
                  <th className="text-left py-3 px-2 font-medium">用户</th>
                  <th className="text-left py-3 px-2 font-medium">角色</th>
                  <th className="text-left py-3 px-2 font-medium">状态</th>
                  <th className="text-right py-3 px-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {adminLoading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-text-secondary">
                      <Loader size={20} className="animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-tertiary border border-border flex-shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-secondary">
                              <User size={14} />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-text-primary font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        roleLabels[u.role]?.canManageUsers ? 'bg-primary/10 text-primary' : 'bg-bg-tertiary text-text-secondary'
                      }`}>
                        {roleLabels[u.role]?.label || u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {u.is_frozen ? (
                        <span className="text-xs text-status-error">已冻结</span>
                      ) : (
                        <span className="text-xs text-status-success">正常</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            const nextRole = u.role === 'system_admin' ? 'ops_admin' : 'system_admin';
                            handleUpdateUser(u.id, { role: nextRole });
                          }}
                          disabled={
                            (u.role === 'system_admin' && users.filter(user => user.role === 'system_admin').length <= 1)
                          }
                          className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            (u.role === 'system_admin' && users.filter(user => user.role === 'system_admin').length <= 1)
                              ? '至少保留一个系统管理员' : ''
                          }
                        >
                          {u.role === 'system_admin' ? '降级为运维' : '升级为系统'}
                        </button>
                        <button
                          onClick={() => handleUpdateUser(u.id, { is_frozen: !u.is_frozen })}
                          disabled={
                            (!u.is_frozen && users.filter(user => !user.is_frozen).length <= 1)
                          }
                          className={`px-2 py-1 text-xs rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                            u.is_frozen ? 'text-status-success hover:bg-status-success/10' : 'text-status-error hover:bg-status-error/10'
                          }`}
                          title={
                            (!u.is_frozen && users.filter(user => !user.is_frozen).length <= 1)
                              ? '至少保留一个活跃用户' : ''
                          }
                        >
                          {u.is_frozen ? '解冻' : '冻结'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
