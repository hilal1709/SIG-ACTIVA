'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changeType,
  subtitle,
  icon,
  iconBgColor,
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{value}</h3>
          <div className="flex items-center gap-2">
            {changeType === 'increase' ? (
              <div className="flex items-center text-green-600 text-sm">
                <ArrowUp size={16} />
                <span className="font-medium">{change}</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600 text-sm">
                <ArrowDown size={16} />
                <span className="font-medium">{change}</span>
              </div>
            )}
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${iconBgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
