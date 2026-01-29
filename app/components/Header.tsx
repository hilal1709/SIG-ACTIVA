'use client';

import { Bell, User, LogOut, Menu, AlertCircle, TrendingUp, Package } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onMenuClick?: () => void;
}

interface Notification {
  id: string;
  type: 'accrual' | 'prepaid' | 'material';
  title: string;
  message: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const [showLogout, setShowLogout] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('');
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get user info from localStorage
    const name = localStorage.getItem('userName') || 'User';
    const role = localStorage.getItem('userRole') || '';
    setUserName(name);
    setUserRole(role);

    // Load read notifications from localStorage
    const readIds = localStorage.getItem('readNotifications');
    if (readIds) {
      setReadNotifications(new Set(JSON.parse(readIds)));
    }

    // Load notifications
    fetchNotifications();

    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        
        // Get read notifications from localStorage
        const readIds = localStorage.getItem('readNotifications');
        const readSet = readIds ? new Set(JSON.parse(readIds)) : new Set();
        
        // Count only unread notifications
        const unreadCount = data.notifications.filter((n: Notification) => !readSet.has(n.id)).length;
        setNotificationCount(unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    const newReadSet = new Set(readNotifications);
    newReadSet.add(notificationId);
    setReadNotifications(newReadSet);
    
    // Save to localStorage
    localStorage.setItem('readNotifications', JSON.stringify([...newReadSet]));
    
    // Update count
    const unreadCount = notifications.filter(n => !newReadSet.has(n.id)).length;
    setNotificationCount(unreadCount);
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadNotifications(allIds);
    localStorage.setItem('readNotifications', JSON.stringify([...allIds]));
    setNotificationCount(0);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLogout(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    if (showLogout || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLogout, showNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'accrual':
        return <TrendingUp size={16} className="text-blue-500" />;
      case 'prepaid':
        return <AlertCircle size={16} className="text-orange-500" />;
      case 'material':
        return <Package size={16} className="text-purple-500" />;
      default:
        return <Bell size={16} className="text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'medium':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-4 border-blue-500 bg-blue-50';
      default:
        return 'border-l-4 border-gray-300 bg-gray-50';
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    setShowNotifications(false);
    window.location.href = notif.link;
  };

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
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Bell className="text-gray-600 w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Notifikasi</h3>
                  <div className="flex items-center gap-2">
                    {notificationCount > 0 && (
                      <>
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                          {notificationCount} Baru
                        </span>
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Tandai Semua
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto flex-1">
                {loadingNotifications ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-2 text-sm">Memuat notifikasi...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Tidak ada notifikasi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notif) => {
                      const isRead = readNotifications.has(notif.id);
                      return (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${getPriorityColor(notif.priority)} ${isRead ? 'opacity-60' : ''}`}
                        >
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-sm font-semibold text-gray-800 ${!isRead ? 'font-bold' : ''}`}>
                                  {notif.title}
                                </p>
                                {!isRead && (
                                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {notif.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => {
                      fetchNotifications();
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium w-full text-center"
                  >
                    Refresh Notifikasi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Admin Profile */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowLogout(!showLogout)}
            className="flex items-center gap-2 md:gap-3 hover:bg-gray-50 rounded-lg px-2 md:px-3 py-2 transition-colors"
          >
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-800">{userName}</p>
              {userRole && <p className="text-xs text-gray-500">{userRole.replace('_', ' ')}</p>}
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
