'use client';

import { memo } from 'react';
import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface StatusCardProps {
  title: string;
  items: {
    label: string;
    count: number;
    status: 'success' | 'warning' | 'error' | 'pending';
  }[];
}

function StatusCard({ title, items }: StatusCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'warning':
        return <AlertCircle size={18} className="text-yellow-600" />;
      case 'error':
        return <XCircle size={18} className="text-red-600" />;
      case 'pending':
        return <Clock size={18} className="text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'pending':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover-lift transition-smooth">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getStatusBg(item.status)} animate-fadeIn transition-smooth`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(StatusCard);
