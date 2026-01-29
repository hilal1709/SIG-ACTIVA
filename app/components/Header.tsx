'use client';

import { Bell, User, LogOut, Menu } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onMenuClick?: () => void;
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const [showLogout, setShowLogout] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLogout(false);
      }
    }

    if (showLogout) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLogout]);

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Hamburger Menu for Mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} className="text-gray-600" />
        </button>
        
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-xs md:text-sm text-gray-500 hidden sm:block">{subtitle}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        {/* Notification */}
        <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="text-gray-600 w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        
        {/* Admin Profile */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowLogout(!showLogout)}
            className="flex items-center gap-2 md:gap-3 hover:bg-gray-50 rounded-lg px-2 md:px-3 py-2 transition-colors"
          >
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-800">Admin Akuntansi</p>
              <p className="text-xs text-gray-500">Finance Dept</p>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-600 rounded-full flex items-center justify-center">
              <User size={16} className="md:w-5 md:h-5 text-white" />
            </div>
          </button>

          {/* Logout Dropdown */}
          {showLogout && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
