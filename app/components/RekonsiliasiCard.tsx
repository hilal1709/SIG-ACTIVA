'use client';

interface RekonsiliasiCardProps {
  title: string;
  value?: string;
  type?: 'number' | 'vertical' | 'horizontal';
  data?: Array<{ name: string; value: number; maxValue: number }>;
}

export default function RekonsiliasiCard({ title, value, type = 'number', data = [] }: RekonsiliasiCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
      <h4 className="text-sm font-medium text-gray-600 mb-4">{title}</h4>
      
      {/* Number Only Display */}
      {type === 'number' && value && (
        <div className="flex items-center justify-start h-32">
          <p className="text-4xl font-bold text-red-600">{value}</p>
        </div>
      )}

      {/* Vertical Bar Chart */}
      {type === 'vertical' && data.length > 0 && (
        <div className="flex items-end justify-center gap-8 h-48 pt-4">
          {data.map((item, index) => {
            const heightPercentage = (item.value / item.maxValue) * 100;
            return (
              <div key={index} className="flex flex-col items-center justify-end h-full">
                {/* Bar */}
                <div className="flex items-end justify-center" style={{ height: '85%' }}>
                  <div
                    className="bg-red-600 rounded-t w-12 transition-all"
                    style={{ height: `${heightPercentage}%` }}
                  ></div>
                </div>
                {/* Label on bottom */}
                <span className="text-xs text-gray-600 mt-2 whitespace-nowrap">{item.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Horizontal Bar Chart */}
      {type === 'horizontal' && data.length > 0 && (
        <div className="space-y-3 mt-2">
          {data.map((item, index) => {
            const widthPercentage = (item.value / item.maxValue) * 100;
            return (
              <div key={index} className="flex items-center gap-3">
                {/* Label on left */}
                <span className="text-xs text-gray-600 w-20 text-right whitespace-nowrap">{item.name}</span>
                {/* Bar container */}
                <div className="flex-1 flex items-center">
                  <div
                    className="bg-red-600 h-6 rounded-r-sm transition-all"
                    style={{ width: `${widthPercentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
