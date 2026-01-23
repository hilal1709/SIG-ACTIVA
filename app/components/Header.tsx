'use client';

import { Bell, User, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
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
    <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notification */}
        <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        
        {/* Admin Profile */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowLogout(!showLogout)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">Admin Akuntansi</p>
              <p className="text-xs text-gray-500">Finance Dept</p>
            </div>
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
              <User size={20} className="text-white" />
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
