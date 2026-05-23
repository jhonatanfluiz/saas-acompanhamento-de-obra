'use client';

import React from 'react';
import { 
  Building2, 
  CreditCard, 
  Users, 
  TrendingUp, 
  Search, 
  MoreVertical,
  Activity,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import KPICard from '@/components/KPICard';

const empresas = [
  { id: 1, nome: 'Construtora Alpha', plano: 'Profissional', status: 'Ativo', obras: '8/15', mrr: 'R$ 299,00' },
  { id: 2, nome: 'Engenharia Horizonte', plano: 'Básico', status: 'Ativo', obras: '3/3', mrr: 'R$ 99,00' },
  { id: 3, nome: 'Obras & Cia', plano: 'Enterprise', status: 'Atrasado', obras: '142/999', mrr: 'R$ 999,00' },
];

export default function AdminSaaSPage() {
  return (
    <div className="space-y-8">
      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin SaaS Console</h1>
          <p className="text-slate-500">Gestão de inquilinos, planos e faturamento da plataforma.</p>
        </div>
      </div>

      {/* Métricas Globais do SaaS */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="MRR Total" 
          value="R$ 42.850" 
          icon={TrendingUp} 
          color="indigo" 
          trend="+12% este mês"
          trendType="up"
        />
        <KPICard 
          title="Total Empresas" 
          value="158" 
          icon={Building2} 
          color="blue" 
        />
        <KPICard 
          title="Usuários Ativos" 
          value="1.240" 
          icon={Users} 
          color="slate" 
        />
        <KPICard 
          title="Taxa Churn" 
          value="2.4%" 
          icon={Activity} 
          color="red" 
          trend="-0.5%"
          trendType="up"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Gestão de Empresas (Tenants)</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar empresa..." 
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Plano</th>
              <th className="px-6 py-4">Uso de Obras</th>
              <th className="px-6 py-4">Faturamento</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empresas.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900">{emp.nome}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase">
                    {emp.plano}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 font-mono">{emp.obras}</td>
                <td className="px-6 py-4 font-semibold text-slate-900">{emp.mrr}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                    emp.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {emp.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-slate-600">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
