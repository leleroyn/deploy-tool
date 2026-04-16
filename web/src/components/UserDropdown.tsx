import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserDropdownProps {
  username: string;
  avatar?: string;
  onLogout: () => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ username, avatar, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 cursor-pointer group px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
      >
        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/30 flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center bg-white/20 text-white text-xs font-semibold"
            >
              <User size={14} />
            </div>
          )}
        </div>
        <span className="text-white text-xs hidden sm:block">{username}</span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
          <div className="px-4 py-3 mb-1 border-b border-gray-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User size={20} />
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">当前用户</p>
              <p className="text-sm font-bold text-gray-700 truncate">{username}</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              navigate('/users');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Settings size={16} className="text-gray-400" />
            用户管理
          </button>

          <div className="my-1 border-t border-gray-50" />

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} className="text-red-400" />
            注销
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
