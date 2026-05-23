'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  RefreshCw,
  ChevronDown,
  Edit3,
  LayoutDashboard,
  X,
  Save,
  Loader2,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Obra {
  id: string;
  nome: string;
  cliente: string | null;
  responsavel: string | null;
  telefone: string | null;
  saudacao: string | null;
  status: string;
  progresso_total: number;
  data_inicio: string | null;
  data_entrega_prevista: string | null;
  alertas_ativos: number;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ativa:     { label: 'Ativa',     cls: 'bg-blue-100 text-blue-700' },
  concluida: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  pausada:   { label: 'Pausada',   cls: 'bg-amber-100 text-amber-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};

function getStatusAtrasada(obra: Obra): boolean {
  if (!obra.data_inicio || !obra.data_entrega_prevista) return false;
  const inicio = new Date(obra.data_inicio).getTime();
  const entrega = new Date(obra.data_entrega_prevista).getTime();
  const hoje = Date.now();
  const totalDias = (entrega - inicio) / (1000 * 60 * 60 * 24);
  const diasPassados = (hoje - inicio) / (1000 * 60 * 60 * 24);
  if (totalDias <= 0 || diasPassados <= 0) return false;
  const progressoEsperado = Math.min(100, (diasPassados / totalDias) * 100);
  return obra.progresso_total < progressoEsperado - 5; // 5% de tolerância
}

export default function ObrasPage() {
  const router = useRouter();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterOpen, setFilterOpen] = useState(false);

  // Estados de Edição e Dropdown
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estados de Deleção
  const [obraToDelete, setObraToDelete] = useState<Obra | null>(null);
  const [deletingType, setDeletingType] = useState<'soft' | 'hard' | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSoftDelete = async (obraId: string) => {
    setDeletingType('soft');
    setDeleteError(null);
    try {
      const { error: err } = await supabase
        .from('obras')
        .update({ status: 'arquivada' })
        .eq('id', obraId);

      if (err) throw err;
      
      setObraToDelete(null);
      fetchObras();
    } catch (e: any) {
      setDeleteError(e.message || 'Erro ao arquivar obra.');
    } finally {
      setDeletingType(null);
    }
  };

  const handleHardDelete = async (obraId: string) => {
    setDeletingType('hard');
    setDeleteError(null);
    try {
      const { error: err } = await supabase
        .from('obras')
        .delete()
        .eq('id', obraId);

      if (err) throw err;

      setObraToDelete(null);
      fetchObras();
    } catch (e: any) {
      setDeleteError(e.message || 'Erro ao excluir obra permanentemente.');
    } finally {
      setDeletingType(null);
    }
  };

  const fetchObras = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('obras')
        .select(`
          id,
          nome,
          cliente,
          manager_name,
          manager_phone,
          custom_greeting,
          status,
          progresso_total,
          data_inicio,
          data_entrega_prevista,
          alertas(id, resolvido)
        `)
        .neq('status', 'arquivada')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const mapped: Obra[] = (data || []).map((o: any) => ({
        id: o.id,
        nome: o.nome,
        cliente: o.cliente || null,
        responsavel: o.manager_name || null,
        telefone: o.manager_phone || null,
        saudacao: o.custom_greeting || null,
        status: o.status || 'ativa',
        progresso_total: Number(o.progresso_total) || 0,
        data_inicio: o.data_inicio,
        data_entrega_prevista: o.data_entrega_prevista,
        alertas_ativos: (o.alertas || []).filter((a: any) => !a.resolvido).length,
      }));

      // Corrigir status para "atrasada" quando aplicável
      const comStatus = mapped.map((o) => ({
        ...o,
        status: o.status === 'ativa' && getStatusAtrasada(o) ? 'atrasada' : o.status,
      }));

      setObras(comStatus);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar obras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObras();

    // Fechar dropdown ao clicar fora
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-trigger')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleUpdateSubmit = async () => {
    if (!editingObra) return;
    setEditError(null);
    if (!editingObra.nome.trim()) {
      setEditError('O nome da obra é obrigatório.');
      return;
    }
    if (!editingObra.responsavel?.trim()) {
      setEditError('O nome do mestre de obras é obrigatório.');
      return;
    }
    if (!editingObra.telefone?.trim()) {
      setEditError('O WhatsApp do mestre é obrigatório.');
      return;
    }
    if (!editingObra.data_inicio) {
      setEditError('A data de início é obrigatória.');
      return;
    }
    if (!editingObra.data_entrega_prevista) {
      setEditError('A data de entrega prevista é obrigatória.');
      return;
    }

    setUpdating(true);
    try {
      const { error: updateErr } = await supabase
        .from('obras')
        .update({
          nome: editingObra.nome.trim(),
          cliente: editingObra.cliente ? editingObra.cliente.trim() : null,
          manager_name: editingObra.responsavel.trim(),
          manager_phone: editingObra.telefone.replace(/\D/g, ''),
          status: editingObra.status,
          data_inicio: editingObra.data_inicio,
          data_entrega_prevista: editingObra.data_entrega_prevista,
          custom_greeting: editingObra.saudacao ? editingObra.saudacao.trim() : null,
        })
        .eq('id', editingObra.id);

      if (updateErr) throw updateErr;

      setEditingObra(null);
      fetchObras();
    } catch (e: any) {
      setEditError(e.message || 'Erro ao salvar alterações.');
    } finally {
      setUpdating(false);
    }
  };

  const filtered = useMemo(() => {
    return obras.filter((o) => {
      const matchSearch =
        o.nome.toLowerCase().includes(search.toLowerCase()) ||
        (o.responsavel || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'todos' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [obras, search, filterStatus]);

  const counts = useMemo(() => ({
    todos: obras.length,
    ativa: obras.filter((o) => o.status === 'ativa').length,
    atrasada: obras.filter((o) => o.status === 'atrasada').length,
    concluida: obras.filter((o) => o.status === 'concluida').length,
  }), [obras]);

  const getStatusBadge = (status: string) => {
    if (status === 'atrasada') return 'bg-red-100 text-red-700';
    return STATUS_CONFIG[status]?.cls || 'bg-slate-100 text-slate-600';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'atrasada') return 'Atrasada';
    return STATUS_CONFIG[status]?.label || status;
  };

  const getProgressColor = (progresso: number, status: string) => {
    if (status === 'atrasada') return 'bg-red-500';
    if (progresso >= 70) return 'bg-emerald-500';
    if (progresso >= 30) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Obras</h1>
          <p className="text-slate-500">Visualize e gerencie todos os projetos ativos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchObras}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <Link
            href="/obras/novo"
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Cadastrar Obra
          </Link>
        </div>
      </div>

      {/* Filtros por status (chips) */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'todos', label: 'Todas', icon: Activity, count: counts.todos },
          { key: 'ativa', label: 'Ativas', icon: CheckCircle2, count: counts.ativa },
          { key: 'atrasada', label: 'Atrasadas', icon: AlertTriangle, count: counts.atrasada },
          { key: 'concluida', label: 'Concluídas', icon: Clock, count: counts.concluida },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              filterStatus === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${filterStatus === key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome da obra ou responsável..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
        />
      </div>

      {/* Estado de carregamento */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Carregando obras...</p>
        </div>
      )}

      {/* Erro */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button onClick={fetchObras} className="mt-3 text-sm text-red-600 underline hover:no-underline">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Tabela de Obras */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Activity className="h-8 w-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700">Nenhuma obra encontrada</p>
                <p className="text-sm text-slate-400 mt-1">
                  {search || filterStatus !== 'todos'
                    ? 'Tente ajustar os filtros de busca.'
                    : 'Clique em "Cadastrar Obra" para adicionar a primeira obra.'}
                </p>
              </div>
              {!search && filterStatus === 'todos' && (
                <Link
                  href="/obras/novo"
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar Primeira Obra
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Obra</th>
                  <th className="px-6 py-4">Responsável</th>
                  <th className="px-6 py-4">Progresso</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Prazo</th>
                  <th className="px-6 py-4 text-center">Alertas</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((obra) => {
                  const isAtrasada = obra.status === 'atrasada';
                  return (
                    <tr
                      key={obra.id}
                      className={`hover:bg-slate-50/60 transition-colors ${isAtrasada ? 'bg-red-50/30' : ''}`}
                    >
                      {/* Nome */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{obra.nome}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          #{obra.id.slice(0, 8).toUpperCase()}
                        </div>
                      </td>

                      {/* Responsável */}
                      <td className="px-6 py-4 text-slate-600">
                        {obra.responsavel || (
                          <span className="text-slate-300 italic">Não informado</span>
                        )}
                      </td>

                      {/* Progresso */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 ${getProgressColor(obra.progresso_total, obra.status)}`}
                              style={{ width: `${obra.progresso_total}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700 tabular-nums">
                            {Number(obra.progresso_total).toFixed(0)}%
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${getStatusBadge(obra.status)}`}>
                          {getStatusLabel(obra.status)}
                        </span>
                      </td>

                      {/* Prazo */}
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {obra.data_entrega_prevista ? (
                          <div>
                            <div className="font-medium text-slate-700">
                              {new Date(obra.data_entrega_prevista).toLocaleDateString('pt-BR')}
                            </div>
                            <div className={`mt-0.5 ${
                              new Date(obra.data_entrega_prevista) < new Date()
                                ? 'text-red-500 font-semibold'
                                : 'text-slate-400'
                            }`}>
                              {new Date(obra.data_entrega_prevista) < new Date()
                                ? '⚠️ Prazo vencido'
                                : `${Math.ceil((new Date(obra.data_entrega_prevista).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} dias restantes`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Não definido</span>
                        )}
                      </td>

                      {/* Alertas */}
                      <td className="px-6 py-4 text-center">
                        {obra.alertas_ativos > 0 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 ring-2 ring-red-50">
                            {obra.alertas_ativos}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === obra.id ? null : obra.id);
                          }}
                          className="dropdown-trigger rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeMenuId === obra.id && (
                          <div className="absolute right-6 top-10 z-10 w-44 rounded-xl border border-slate-150 bg-white p-1.5 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                router.push('/dashboard');
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              <LayoutDashboard size={14} className="text-slate-400" />
                              Abrir Dashboard
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setEditingObra(obra);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 size={14} className="text-slate-400" />
                              Atualizar dados
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setObraToDelete(obra);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors border-t border-slate-100 mt-1 pt-2 rounded-t-none"
                            >
                              <Trash2 size={14} className="text-red-500" />
                              Excluir obra
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Rodapé da tabela */}
          {filtered.length > 0 && (
            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Exibindo <strong className="text-slate-600">{filtered.length}</strong> de{' '}
                <strong className="text-slate-600">{obras.length}</strong> obras
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Edição de Obra */}
      {editingObra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Atualizar Dados da Obra</h3>
              <button 
                onClick={() => setEditingObra(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {editError && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-600">
                {editError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nome da Obra *</label>
                <input 
                  type="text" 
                  value={editingObra.nome} 
                  onChange={(e) => setEditingObra({ ...editingObra, nome: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cliente / Contratante</label>
                <input 
                  type="text" 
                  value={editingObra.cliente || ''} 
                  onChange={(e) => setEditingObra({ ...editingObra, cliente: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Mestre de Obras *</label>
                  <input 
                    type="text" 
                    value={editingObra.responsavel || ''} 
                    onChange={(e) => setEditingObra({ ...editingObra, responsavel: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">WhatsApp *</label>
                  <input 
                    type="tel" 
                    value={editingObra.telefone || ''} 
                    onChange={(e) => setEditingObra({ ...editingObra, telefone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data de Início *</label>
                  <input 
                    type="date" 
                    value={editingObra.data_inicio || ''} 
                    onChange={(e) => setEditingObra({ ...editingObra, data_inicio: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Entrega Prevista *</label>
                  <input 
                    type="date" 
                    value={editingObra.data_entrega_prevista || ''} 
                    onChange={(e) => setEditingObra({ ...editingObra, data_entrega_prevista: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Status da Obra *</label>
                <select 
                  value={editingObra.status} 
                  onChange={(e) => setEditingObra({ ...editingObra, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                >
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Saudação WhatsApp Customizada</label>
                <textarea 
                  value={editingObra.saudacao || ''} 
                  onChange={(e) => setEditingObra({ ...editingObra, saudacao: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none text-xs"
                  placeholder="Mensagem disparada na saudação inicial..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
              <button 
                type="button" 
                onClick={() => setEditingObra(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                disabled={updating}
                onClick={handleUpdateSubmit}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Obra */}
      {obraToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Excluir Obra</h3>
                <p className="text-xs text-slate-500 font-medium">#{obraToDelete.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {deleteError && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-600">
                {deleteError}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Você está prestes a excluir a obra <strong className="text-slate-900">"{obraToDelete.nome}"</strong>. 
                Como deseja prosseguir?
              </p>
              
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Opções de Exclusão:</h4>
                <div className="text-xs text-slate-500 space-y-1.5 pl-1">
                  <div>• <strong className="text-slate-700">Manter no histórico:</strong> Remove a obra do dashboard ativo, mas preserva todo o histórico de respostas para consultas futuras.</div>
                  <div>• <strong className="text-slate-700">Apagar definitivamente:</strong> Remove permanentemente a obra e todos os dados relacionados do banco de dados de forma irreversível.</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingType !== null}
                onClick={() => handleSoftDelete(obraToDelete.id)}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 transition-colors disabled:opacity-50"
              >
                {deletingType === 'soft' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando no Histórico...
                  </>
                ) : (
                  <>
                    <Clock size={16} />
                    Apagar e manter no histórico
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={deletingType !== null}
                onClick={() => handleHardDelete(obraToDelete.id)}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-sm shadow-rose-100"
              >
                {deletingType === 'hard' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Excluindo definitivamente...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Apagar definitivamente
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={deletingType !== null}
                onClick={() => setObraToDelete(null)}
                className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50 mt-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
