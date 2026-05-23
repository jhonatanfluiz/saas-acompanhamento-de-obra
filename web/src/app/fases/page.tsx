'use client';

import React, { useEffect, useState } from 'react';
import { Layers, Search, ChevronRight, CheckCircle2, Clock, AlertCircle, Trash2, Plus, X, ArrowUp, ArrowDown, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FasesPage() {
  const router = useRouter();
  const [obras, setObras] = useState<any[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [fases, setFases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingPhase, setIsAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // 1. Fetch Obras
  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('id, nome').eq('status', 'ativa').order('created_at', { ascending: false });
      setObras(data || []);
      if (data && data.length > 0) {
        setSelectedObraId(data[0].id);
      } else {
        setLoading(false);
      }
    }
    fetchObras();
  }, []);

  // 2. Fetch Fases when selectedObraId changes
  useEffect(() => {
    async function fetchFases() {
      if (!selectedObraId) return;
      setLoading(true);
      const { data } = await supabase.from('fases').select('*').eq('obra_id', selectedObraId).order('ordem', { ascending: true });
      setFases(data || []);
      setLoading(false);
    }
    fetchFases();
  }, [selectedObraId]);

  // 3. Filter Fases
  const filteredFases = fases.filter(fase => 
    fase.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 4. Adicionar Nova Fase
  const handleAddFase = async () => {
    if (!newPhaseName.trim() || !selectedObraId) return;
    setIsProcessing('add');
    const newOrdem = fases.length > 0 ? Math.max(...fases.map(f => f.ordem)) + 1 : 1;
    
    const { data, error } = await supabase.from('fases').insert({
      obra_id: selectedObraId,
      nome: newPhaseName.trim(),
      ordem: newOrdem,
      status: 'pendente',
      progresso: 0
    }).select().single();

    if (!error && data) {
      setFases([...fases, data]);
      setNewPhaseName('');
      setIsAddingPhase(false);
    }
    setIsProcessing(null);
  };

  // 5. Excluir Fase
  const handleDeleteFase = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fase? As perguntas associadas também poderão ser afetadas.')) return;
    setIsProcessing(id);
    const { error } = await supabase.from('fases').delete().eq('id', id);
    if (!error) {
      setFases(fases.filter(f => f.id !== id));
    }
    setIsProcessing(null);
  };

  // 6. Mover Fase (Alterar Ordem)
  const handleMoveFase = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === fases.length - 1)
    ) return;

    setIsProcessing(`move-${index}`);
    const newFases = [...fases];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap ordem numbers
    const tempOrdem = newFases[index].ordem;
    newFases[index].ordem = newFases[swapIndex].ordem;
    newFases[swapIndex].ordem = tempOrdem;

    // Swap positions in array
    const temp = newFases[index];
    newFases[index] = newFases[swapIndex];
    newFases[swapIndex] = temp;

    // Persist in DB
    const { error: err1 } = await supabase.from('fases').update({ ordem: newFases[index].ordem }).eq('id', newFases[index].id);
    const { error: err2 } = await supabase.from('fases').update({ ordem: newFases[swapIndex].ordem }).eq('id', newFases[swapIndex].id);

    if (!err1 && !err2) {
      setFases(newFases);
    }
    setIsProcessing(null);
  };

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
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Fases</h1>
          <p className="text-slate-500">Controle as fases e parametrize as perguntas personalizadas.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar de Seleção de Obra */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Selecionar Obra</h3>
            <div className="space-y-2">
              {obras.length > 0 ? obras.map((obra) => (
                <button 
                  key={obra.id} 
                  onClick={() => setSelectedObraId(obra.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all ${
                    selectedObraId === obra.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
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

        {/* Lista de Fases */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar fases..." 
                className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Carregando fases...</div>
            ) : filteredFases.length > 0 ? (
              filteredFases.map((fase, index) => (
                <div key={fase.id} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-200 hover:shadow-md flex-wrap gap-4">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleMoveFase(index, 'up')}
                        disabled={index === 0 || isProcessing?.startsWith('move')}
                        className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        {fase.ordem}
                      </div>
                      <button 
                        onClick={() => handleMoveFase(index, 'down')}
                        disabled={index === filteredFases.length - 1 || isProcessing?.startsWith('move')}
                        className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{fase.nome}</h4>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <div className="flex items-center text-xs text-slate-500">
                          {fase.status === 'concluída' && <CheckCircle2 size={14} className="mr-1 text-emerald-500" />}
                          {fase.status === 'em andamento' && <Clock size={14} className="mr-1 text-blue-500" />}
                          {fase.status === 'pendente' && <AlertCircle size={14} className="mr-1 text-slate-300" />}
                          <span className="capitalize">{fase.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 sm:w-32 rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 transition-all" 
                              style={{ width: `${fase.progresso}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{fase.progresso}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => router.push(`/perguntas?obra_id=${selectedObraId}`)}
                      className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-900 hover:text-white"
                    >
                      Gerenciar Perguntas
                    </button>
                    <button 
                      onClick={() => handleDeleteFase(fase.id)}
                      disabled={isProcessing === fase.id}
                      className="shrink-0 rounded-xl border border-red-100 bg-red-50 p-2 text-red-500 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                      title="Excluir Fase"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">Nenhuma fase encontrada.</div>
            )}
            
            {isAddingPhase ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm transition-all">
                <h4 className="text-sm font-bold text-indigo-800">Nova Fase</h4>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    value={newPhaseName}
                    onChange={(e) => setNewPhaseName(e.target.value)}
                    placeholder="Ex: Instalações Elétricas..."
                    className="flex-1 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setIsAddingPhase(false)}
                      className="flex-1 sm:flex-none flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <X size={16} className="mr-1" /> Cancelar
                    </button>
                    <button
                      onClick={handleAddFase}
                      disabled={isProcessing === 'add' || !newPhaseName.trim()}
                      className="flex-1 sm:flex-none flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isProcessing === 'add' ? 'Salvando...' : 'Salvar Fase'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingPhase(true)}
                disabled={!selectedObraId}
                className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-sm font-medium text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="mr-2 h-5 w-5" />
                Adicionar Fase Manual (Opcional)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
