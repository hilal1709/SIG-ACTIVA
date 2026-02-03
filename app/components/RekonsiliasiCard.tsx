'use client';

import { memo } from 'react';

interface RekonsiliasiCardProps {
  title: string;
  description: string;
  status: 'normal' | 'warning' | 'error';
  percentage: number;
}

function RekonsiliasiCard({ title, description, status, percentage }: RekonsiliasiCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover-lift transition-smooth">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-800 mb-2">{title}</h4>
          <p className="text-sm text-gray-600 mb-4">{description}</p>
        </div>
        <div className={`text-2xl font-bold ${getStatusColor(status)}`}>
          {percentage}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(status)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
        {percentage > 100 && (
          <div className="absolute right-0 top-0 h-2 w-1 bg-blue-500 animate-pulse"></div>
        )}
      </div>

      {/* Status Text */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">Status:</span>
        <span className={`font-medium capitalize ${getStatusColor(status)}`}>
          {percentage > 100 ? 'Over Target' : status}
        </span>
      </div>
    </div>
  );
}

export default memo(RekonsiliasiCard);
