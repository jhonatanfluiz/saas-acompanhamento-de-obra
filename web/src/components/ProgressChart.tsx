'use client';

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ProgressChartProps {
  title?: string;
  data: {
    name: string;
    real: number | null;
    esperado: number;
  }[];
}

export default function ProgressChart({ data, title }: ProgressChartProps) {
  return (
    <div className="w-full rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <h3 className="mb-4 text-lg font-bold text-slate-900">
        {title || 'Evolução de Montagem (Real vs Meta 60 Dias)'}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
            }} 
          />
          <Legend iconType="circle" />
          <Area 
            type="monotone" 
            dataKey="real" 
            name="Progresso Real"
            stroke="#4f46e5" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorReal)" 
          />
          <Area 
            type="monotone" 
            dataKey="esperado" 
            name="Meta (60 dias)"
            stroke="#64748b" 
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1} 
            fill="url(#colorMeta)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
