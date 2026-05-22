'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Search, CheckCircle2, XCircle, MessageCircle, ChevronRight, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HistoricoPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Obras
  useEffect(() => {
    async function fetchObras() {
      const { data, error } = await supabase.from('obras').select('id, nome').eq('status', 'ativa').order('created_at', { ascending: false });
      setObras(data || []);
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlObraId = urlParams.get('obra_id');

      if (urlObraId && data?.some(o => o.id === urlObraId)) {
        setSelectedObraId(urlObraId);
      } else if (data && data.length > 0) {
        setSelectedObraId(data[0].id);
      }
      setLoadingObras(false);
    }
    fetchObras();
  }, []);

  // 2. Fetch Historico when selectedObraId changes
  useEffect(() => {
    async function fetchHistorico() {
      if (!selectedObraId) return;
      setLoadingHistory(true);
      
      const { data, error } = await supabase
        .from('respostas')
        .select(`
          id, 
          resposta, 
          data_resposta, 
          usuario_responsavel, 
          obras(nome, manager_name), 
          fases(nome), 
          perguntas(texto_pergunta)
        `)
        .eq('obra_id', selectedObraId)
        .order('data_resposta', { ascending: false });

      if (!error && data) {
        setHistorico(data.map(item => {
          const obra = Array.isArray(item.obras) ? item.obras[0] : item.obras;
          const fase = Array.isArray(item.fases) ? item.fases[0] : item.fases;
          const pergunta = Array.isArray(item.perguntas) ? item.perguntas[0] : item.perguntas;

          return {
            id: item.id,
            obra: obra?.nome || 'Obra Desconhecida',
            fase: fase?.nome || 'Fase Desconhecida',
            pergunta: pergunta?.texto_pergunta || 'Pergunta Excluída',
            resposta: item.resposta,
            data: new Date(item.data_resposta).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            mestre: item.usuario_responsavel || obra?.manager_name || 'Sistema'
          };
        }));
      }
      setLoadingHistory(false);
    }
    fetchHistorico();
  }, [selectedObraId]);

  // 3. Filter Historico
  const filteredHistorico = historico.filter(log => 
    log.pergunta.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.fase.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Histórico de Respostas</h1>
          <p className="text-slate-500">Log detalhado de todas as interações e repostas associadas à obra.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar de Seleção de Obra */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Selecionar Obra</h3>
            <div className="space-y-2">
              {loadingObras ? (
                <p className="text-sm text-slate-400">Carregando obras...</p>
              ) : obras.length > 0 ? obras.map((obra) => (
                <button 
                  key={obra.id} 
                  onClick={() => setSelectedObraId(obra.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all ${
                    selectedObraId === obra.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate pr-2 text-left">{obra.nome}</span>
                  <ChevronRight size={16} className="shrink-0" />
                </button>
              )) : (
                <p className="text-sm text-slate-500">Nenhuma obra ativa encontrada.</p>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Histórico */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por pergunta ou fase..." 
                className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-emerald-600 transition-colors text-sm font-medium border border-slate-100">
                <Calendar size={16} /> Data
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-emerald-600 transition-colors text-sm font-medium border border-slate-100">
                <Filter size={16} /> Status
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400">Carregando histórico...</div>
            ) : filteredHistorico.length > 0 ? (
              filteredHistorico.map((log) => (
                <div key={log.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      log.resposta?.toUpperCase() === 'SIM' ? 'bg-emerald-100 text-emerald-600' : 
                      log.resposta?.toUpperCase() === 'NÃO' || log.resposta?.toUpperCase() === 'NAO' ? 'bg-red-100 text-red-600' : 
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {log.resposta?.toUpperCase() === 'SIM' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900">{log.obra}</span>
                        <span className="text-[10px] text-slate-400 font-medium">• {log.fase}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-700 italic">"{log.pergunta}"</h4>
                      <div className="flex items-center gap-3 mt-2">
                         <span className="flex items-center text-xs text-slate-400"><MessageCircle size={12} className="mr-1" /> {log.mestre}</span>
                         <span className="text-xs text-slate-300">|</span>
                         <span className="text-xs text-slate-400">{log.data}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest ${
                    log.resposta?.toUpperCase() === 'SIM' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                    log.resposta?.toUpperCase() === 'NÃO' || log.resposta?.toUpperCase() === 'NAO' ? 'bg-red-50 text-red-700 border border-red-100' :
                    'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    {log.resposta?.toUpperCase() || '-'}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                Nenhum histórico de respostas encontrado para esta obra ou filtro.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
