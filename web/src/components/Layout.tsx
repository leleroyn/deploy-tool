import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Rocket, Archive, Radio, FileText, Settings, Menu, Server, Bell, Terminal, Users } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import UserDropdown from './UserDropdown';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/backup', icon: Archive, label: '备份管理' },
  { to: '/deploy', icon: Rocket, label: '部署管理' },
  { to: '/ports', icon: Radio, label: '端口检测' },
  { to: '/remote', icon: Terminal, label: '远程维护' },
  { to: '/logs', icon: FileText, label: '日志历史' },
  { to: '/users', icon: Users, label: '用户管理' },
  { to: '/settings', icon: Settings, label: '系统设置' },
];

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const serverOnline = useAppStore((s) => s.serverOnline);
  const user = useAppStore((s) => s.user);
  const location = useLocation();

  const currentPage = navItems.find(n => n.to === location.pathname)?.label || 'Deploy Tool';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F2F5' }}>
      <aside
        className={`${sidebarOpen ? 'w-52' : 'w-14'} flex-shrink-0 flex flex-col transition-all duration-300`}
        style={{ background: '#001529' }}
      >
        <div
          className="h-14 flex items-center flex-shrink-0 border-b px-3"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 w-full">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                style={{
                  background: 'linear-gradient(135deg, #1677FF 0%, #0958D9 100%)',
                  boxShadow: '0 0 12px rgba(22,119,255,0.55)',
                }}
              >
                <Server size={15} className="text-white" />
              </div>
              <div className="flex flex-col leading-none gap-0.5">
                <span className="font-bold text-[14.5px] text-white tracking-wide leading-none">项目自助发布平台</span>
                <span className="text-[10px] font-medium text-white/35 tracking-widest leading-none">DEPLOY · BACKUP · MONITOR</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1677FF 0%, #0958D9 100%)',
                  boxShadow: '0 0 10px rgba(22,119,255,0.5)',
                }}
              >
                <Server size={15} className="text-white" />
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                  sidebarOpen ? 'px-5 py-2.5' : 'px-0 py-2.5 justify-center'
                } ${
                  isActive
                    ? 'text-white border-l-[3px] border-[#4096FF]'
                    : 'text-[#8BA3BC] hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'rgba(22,119,255,0.18)' } : {}}
            >
              <Icon size={15} className="flex-shrink-0" />
              {sidebarOpen && <span className="text-sm truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#8BA3BC' }}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${serverOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>{serverOnline ? '服务在线' : '服务离线'}</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="h-14 flex items-center justify-between px-5 flex-shrink-0 shadow-sm"
          style={{ background: '#1677FF' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-8 h-8 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-white/70">项目自助发布平台</span>
              <span className="text-white/50">/</span>
              <span className="text-white font-medium">{currentPage}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-green-300' : 'bg-red-300'}`} />
              {serverOnline ? '服务正常' : '服务离线'}
            </div>

            <button className="w-8 h-8 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all relative">
              <Bell size={16} />
            </button>

            {user && (
              <UserDropdown
                username={user.username}
                avatar={user.avatar}
                onLogout={onLogout || (() => {})}
              />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6" style={{ background: '#F0F2F5' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;


