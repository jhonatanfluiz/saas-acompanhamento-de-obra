'use client';

import React from 'react';
import { AlertTriangle, MapPin, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const alertas = [
  { id: 1, obra: 'Residencial Alpha', fase: 'Elétrica', tipo: 'Crítico', msg: 'Mestre reportou NÃO para concretagem 3 semanas seguidas.', data: 'Há 2 horas', status: 'pendente' },
  { id: 2, obra: 'Parque das Águas', fase: 'Fundação', tipo: 'Atraso', msg: 'Baixa produtividade detectada na última medição.', data: 'Há 5 horas', status: 'pendente' },
  { id: 3, obra: 'Edifício Horizonte', fase: 'Estrutura', tipo: 'Divergência', msg: 'Resposta NÃO recebida na pergunta de segurança.', data: 'Ontem', status: 'resolvido' },
];

export default function AlertasPage() {
  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alertas e Anomalias</h1>
        <p className="text-slate-500">Acompanhe situações que exigem atenção imediata.</p>
      </div>

      <div className="grid gap-4">
        {alertas.map((alerta) => (
          <div 
            key={alerta.id} 
            className={`relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all ${
              alerta.status === 'resolvido' ? 'opacity-60 grayscale' : 'border-slate-200'
            }`}
          >
            {alerta.status === 'pendente' && (
              <div className="absolute left-0 top-0 h-full w-1.5 bg-red-500"></div>
            )}
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className={`rounded-xl p-3 ${alerta.status === 'resolvido' ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600'}`}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{alerta.obra}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      alerta.tipo === 'Crítico' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {alerta.tipo}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{alerta.msg}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center"><MapPin size={12} className="mr-1" /> {alerta.fase}</span>
                    <span className="flex items-center"><Clock size={12} className="mr-1" /> {alerta.data}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {alerta.status === 'pendente' ? (
                  <>
                    <button className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors">
                      Resolver
                    </button>
                    <button className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      Ignorar
                    </button>
                  </>
                ) : (
                  <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <CheckCircle size={14} className="mr-1" /> Resolvido
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
