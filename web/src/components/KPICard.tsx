import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  color: string;
}

export default function KPICard({ title, value, trend, trendType, icon: Icon, color }: KPICardProps) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${colorMap[color] || colorMap.slate}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${
            trendType === 'up' ? 'text-emerald-600' : trendType === 'down' ? 'text-red-600' : 'text-slate-500'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  );
}
