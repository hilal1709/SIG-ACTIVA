'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChartData {
  label: string;
  value: number;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface SimpleBarChartProps {
  data: ChartData[];
  title: string;
  maxValue?: number;
  color?: string;
  height?: number;
}

function SimpleBarChart({ data, title, maxValue, color = '#dc2626', height = 200 }: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  
  const getBarColor = (index: number) => {
    const colors = ['#dc2626', '#059669', '#2563eb', '#7c3aed', '#ea580c'];
    return colors[index % colors.length];
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} className="text-green-600" />;
      case 'down':
        return <TrendingDown size={14} className="text-red-600" />;
      case 'stable':
        return <Minus size={14} className="text-gray-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover-lift transition-smooth">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">{title}</h3>
      
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                {item.trend && getTrendIcon(item.trend)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {item.value.toLocaleString('id-ID')}
                </span>
                {item.percentage !== undefined && (
                  <span className="text-xs text-gray-500">({item.percentage}%)</span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: getBarColor(index),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SimpleBarChart);
