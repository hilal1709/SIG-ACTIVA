'use client';

import { memo } from 'react';

interface DonutChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  title: string;
  centerText?: string;
  centerSubtext?: string;
}

function DonutChart({ data, title, centerText, centerSubtext }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let currentAngle = 0;
  const radius = 40;
  const centerX = 50;
  const centerY = 50;
  const strokeWidth = 10;

  const createArc = (value: number, color: string) => {
    if (total === 0) return null;
    
    const percentage = (value / total) * 100;
    const angle = (percentage / 100) * 360;
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    currentAngle = endAngle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    ].join(' ');

    return (
      <path
        key={color}
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover-lift transition-smooth">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">{title}</h3>
      
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0 animate-scaleIn">
          <svg viewBox="0 0 100 100" className="w-48 h-48 transform -rotate-90">
            {data.map((item) => createArc(item.value, item.color))}
          </svg>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerText && (
              <div className="text-2xl font-bold text-gray-800">{centerText}</div>
            )}
            {centerSubtext && (
              <div className="text-xs text-gray-500 mt-1">{centerSubtext}</div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3 w-full">
          {data.map((item, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors animate-fadeIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {item.value.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-gray-500">
                  {((item.value / total) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(DonutChart);
