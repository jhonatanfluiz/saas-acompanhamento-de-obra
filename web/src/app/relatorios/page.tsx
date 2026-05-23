'use client';

import React from 'react';
import { FileText, Download, Filter, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const relatorios = [
  { id: 1, nome: 'Relatório Mensal - Abril 2026', obra: 'Residencial Alpha', data: '02/05/2026', tamanho: '2.4 MB' },
  { id: 2, nome: 'Fechamento Semanal - Semana 18', obra: 'Edifício Horizonte', data: '30/04/2026', tamanho: '1.1 MB' },
  { id: 3, nome: 'Relatório de Alertas Críticos', obra: 'Todas as Obras', data: '28/04/2026', tamanho: '850 KB' },
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Relatórios</h1>
          <p className="text-slate-500">Gere e exporte documentos técnicos de acompanhamento.</p>
        </div>
        <button className="flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors">
          <Calendar className="mr-2 h-5 w-5" />
          Gerar Novo Relatório
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {['Produtividade', 'Atrasos', 'Geral'].map((tipo) => (
          <div key={tipo} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-4 transition-colors">
              <FileText size={24} />
            </div>
            <h3 className="font-bold text-slate-900">Template: {tipo}</h3>
            <p className="text-xs text-slate-500 mt-1">Exportação em PDF e Excel</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Arquivos Gerados Recentemente</h3>
          <button className="text-xs font-bold text-indigo-600 flex items-center hover:underline">
            <Filter size={14} className="mr-1" /> Filtrar
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {relatorios.map((rel) => (
            <div key={rel.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-red-500">
                  <FileText size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{rel.nome}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{rel.obra}</span>
                    <span>•</span>
                    <span>{rel.data}</span>
                    <span>•</span>
                    <span>{rel.tamanho}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm">
                <Download size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
