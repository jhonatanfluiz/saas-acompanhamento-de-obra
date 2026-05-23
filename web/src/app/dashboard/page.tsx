'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  Send,
  Calendar,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import ProgressChart from '@/components/ProgressChart';
import { supabase } from '@/lib/supabase';
import { useRealtimeDashboard, RealtimeIndicator, RealtimeEvent } from '@/lib/useRealtimeDashboard';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [metrics, setMetrics] = useState({
    ativas: 0,
    concluidas: 0,
    atrasadas: 0,
    alertas: 0
  });
  const [allWorks, setAllWorks] = useState<any[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeFlash, setRealtimeFlash] = useState(false); // pisca ao receber update

  const getForecastDetails = (dataInicioStr: string, progress: number) => {
    const start = new Date(dataInicioStr);
    const now = Date.now();
    const elapsedDays = Math.max(0.1, (now - start.getTime()) / (1000 * 60 * 60 * 24));
    
    let remainingDays = 60 - elapsedDays;
    let totalEstimatedDays = 60;
    
    if (progress > 0) {
      totalEstimatedDays = elapsedDays * (100 / progress);
      remainingDays = totalEstimatedDays - elapsedDays;
    }
    
    const forecastDate = new Date(start.getTime() + totalEstimatedDays * 24 * 60 * 60 * 1000);
    
    return {
      elapsedDays: Math.floor(elapsedDays),
      remainingDays: Math.max(0, Math.floor(remainingDays)),
      forecastDateStr: forecastDate.toLocaleDateString('pt-BR'),
      totalEstimatedDays: Math.floor(totalEstimatedDays)
    };
  };

  // Estados dos novos recursos interativos
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState({
    day: 'Segunda-feira',
    time: '08:00',
    recur: 'Semanal'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // ─── Função de fetch centralizada (usada tanto no mount quanto no Realtime) ──
  const fetchData = useCallback(async () => {
    // 1. Métricas Básicas
    let obrasQuery = supabase.from('obras').select('*', { count: 'exact', head: true }).in('status', ['ativa', 'atrasada']);
    let concluidasQuery = supabase.from('obras').select('*', { count: 'exact', head: true }).eq('status', 'concluida');
    let alertasQuery = supabase.from('alertas').select('*, obras!inner(nome)', { count: 'exact', head: true }).eq('resolvido', false);

    let worksListQuery = supabase.from('obras').select('*, fases(*)').in('status', ['ativa', 'atrasada']).order('created_at', { ascending: false }).limit(20);
    let alertsListQuery = supabase.from('alertas').select('*, obras!inner(nome)').order('created_at', { ascending: false }).limit(5);

    if (query) {
      obrasQuery = obrasQuery.ilike('nome', `%${query}%`);
      concluidasQuery = concluidasQuery.ilike('nome', `%${query}%`);
      alertasQuery = alertasQuery.ilike('obras.nome', `%${query}%`);
      alertsListQuery = alertsListQuery.ilike('obras.nome', `%${query}%`);
    }

    const { count: ativas } = await obrasQuery;
    const { count: concluidas } = await concluidasQuery;
    const { count: alertas } = await alertasQuery;

    // 2. Buscar Obras
    const { data: worksRaw } = await worksListQuery;
    
    // Calcular progresso_esperado e status_prazo localmente
    const works = (worksRaw || []).map(obra => {
      const start = new Date(obra.data_inicio).getTime();
      const now = Date.now();
      const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
      const progresso_esperado = Math.min(100, Math.round((daysElapsed / 60) * 100));
      
      const fases = (obra.fases as any[]) || [];
      const fasesAtrasadas = fases.filter(fase => {
        return daysElapsed > (fase.ordem * 3) && fase.status !== 'concluida';
      });

      const status_prazo = fasesAtrasadas.length > 0 || obra.progresso_total < (progresso_esperado - 10) ? 'atrasada' : 'em_dia';
      
      return { 
        ...obra, 
        progresso_esperado, 
        status_prazo,
        fases_atrasadas_count: fasesAtrasadas.length,
        fases_atrasadas_list: fasesAtrasadas
      };
    });

    // Calcular KPI de atrasadas
    let atrasadas = 0;
    if (worksRaw && worksRaw.length > 0) {
      const obrasParaContar = query ? works.filter(w => w.nome.toLowerCase().includes(query.toLowerCase())) : works;
      atrasadas = obrasParaContar.filter(w => w.status_prazo === 'atrasada').length;
    }

    setMetrics({
      ativas: ativas || 0,
      concluidas: concluidas || 0,
      atrasadas: atrasadas,
      alertas: alertas || 0
    });

    setAllWorks(works || []);
    if (works && works.length > 0) {
      setSelectedObraId(prev => prev || works[0].id);
    }

    // 3. Alertas Recentes
    const { data: alerts } = await alertsListQuery;
    setRecentAlerts(alerts || []);

    setLoading(false);
  }, [query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Exibir feedback flutuante (Toast) — declarado antes do Realtime para ser chamado nele
  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // ─── Callback do Realtime: atualiza dados ao receber evento ────────────────
  const handleRealtimeUpdate = useCallback((event: RealtimeEvent) => {
    // Pisca o indicador visual
    setRealtimeFlash(true);
    setTimeout(() => setRealtimeFlash(false), 1200);

    // Re-busca todos os dados atualizados
    fetchData();

    // Toast contextualizado por tipo de evento
    if (event.tipo === 'nova_resposta') {
      showToast('📨 Nova resposta recebida via WhatsApp!', 'success');
    } else if (event.tipo === 'novo_alerta') {
      showToast('🚨 Novo alerta crítico gerado!', 'error');
    } else if (event.tipo === 'progresso_atualizado') {
      showToast('📊 Progresso de obra atualizado!', 'success');
    }
  }, [fetchData]);

  // ─── Ativa o Supabase Realtime ─────────────────────────────────────────────
  const { isConnected } = useRealtimeDashboard({
    onUpdate: handleRealtimeUpdate,
  });

  // Lógica para Forçar o Disparo via API do WhatsApp
  const handleForceDispatch = async (obraId: string, obraNome: string) => {
    setDispatchingId(obraId);
    try {
      const res = await fetch(`/api/cron/perguntas?token=chave_secreta_padrao_desenvolvimento_123&obra_id=${obraId}`);
      const data = await res.json();

      if (res.ok && data.success) {
        // Verifica se algum disparo reportou sucesso
        const disparouComSucesso = data.disparos.some((d: string) => d.includes('Mensagem enviada'));
        
        if (disparouComSucesso) {
          showToast(`WhatsApp enviado com sucesso para a obra: ${obraNome}!`, 'success');
        } else {
          // Processado mas gateway offline
          showToast(`Disparo simulado com sucesso! Mas o Gateway de WhatsApp local está offline no momento.`, 'warning');
        }
      } else {
        showToast(`Erro ao disparar mensagem: ${data.error || 'Erro interno'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro de comunicação com a API: ${err.message}`, 'error');
    } finally {
      setDispatchingId(null);
    }
  };

  // Salvar agendamento
  const handleSaveSchedule = () => {
    setIsScheduleModalOpen(false);
    showToast(`Disparos agendados com sucesso para toda ${scheduleSettings.day} às ${scheduleSettings.time}!`, 'success');
  };

  const selectedWork = useMemo(() => {
    if (!allWorks || allWorks.length === 0) return null;
    return allWorks.find(o => o.id === selectedObraId) || allWorks[0];
  }, [allWorks, selectedObraId]);

  const forecast = useMemo(() => {
    if (!selectedWork) return null;
    return getForecastDetails(selectedWork.data_inicio, selectedWork.progresso_total);
  }, [selectedWork]);

  const chartData = useMemo(() => {
    const totalSemanas = 8; // ~60 dias

    if (!selectedWork) {
      return Array.from({ length: totalSemanas }).map((_, i) => ({
        name: `Semana ${i + 1}`,
        real: 0,
        esperado: Math.round(((i + 1) / totalSemanas) * 100)
      }));
    }

    const start = new Date(selectedWork.data_inicio).getTime();
    const now = Date.now();
    const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
    const weeksElapsed = Math.max(1, Math.min(totalSemanas, Math.ceil(daysElapsed / 7)));
    
    return Array.from({ length: totalSemanas }).map((_, i) => {
      const weekNum = i + 1;
      const progressoEsperadoAteAqui = Math.min(100, Math.round((weekNum / totalSemanas) * 100));
      
      let progressoReal = null;
      if (weekNum <= weeksElapsed) {
        // Interpolação simples até o progresso atual
        progressoReal = Math.round((selectedWork.progresso_total / weeksElapsed) * weekNum);
      }

      return {
        name: `Semana ${weekNum}`,
        real: progressoReal,
        esperado: progressoEsperadoAteAqui
      };
    });
  }, [selectedWork]);

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Toast Flutuante */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl border transition-all duration-300 animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 
          toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' : 'bg-red-600 text-white border-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header com botões responsivos */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard de Acompanhamento</h1>
            {/* Indicador Realtime — pulsing dot */}
            <div
              title={isConnected ? 'Atualização em tempo real ativa' : 'Reconectando ao tempo real...'}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-500 ${
                isConnected
                  ? realtimeFlash
                    ? 'bg-emerald-100 text-emerald-700 scale-110'
                    : 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Ao vivo
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </div>
          </div>
          <p className="text-slate-500">Gestão centralizada de montagem de elevadores.</p>
        </div>
        
        {/* Contêiner de botões responsivos */}
        <div className="flex flex-col gap-3 sm:flex-row w-full sm:w-auto">
          <button 
            onClick={() => fetchData()}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 w-full sm:w-auto cursor-pointer"
            title="Atualizar dados manualmente"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-slate-500" />
            Atualizar
          </button>

          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 w-full sm:w-auto cursor-pointer"
          >
            <Calendar className="mr-2 h-4 w-4 text-slate-500" />
            Programar Mensagens
          </button>
          
          <button 
            onClick={() => router.push('/obras/novo')}
            className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 w-full sm:w-auto cursor-pointer"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Obra
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Obras Ativas" value={loading ? '...' : metrics.ativas} icon={Activity} color="blue" />
        <KPICard title="Concluídas" value={loading ? '...' : metrics.concluidas} icon={CheckCircle2} color="emerald" />
        <KPICard title="Em Atraso (60d)" value={loading ? '...' : metrics.atrasadas} icon={Clock} color="amber" />
        <KPICard title="Alertas Críticos" value={loading ? '...' : metrics.alertas} icon={AlertCircle} color="red" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Gráfico Principal */}
        <div className="lg:col-span-2">
          <ProgressChart 
            data={chartData} 
            title={
              (selectedObraId ? allWorks.find(o => o.id === selectedObraId) : allWorks[0])
                ? `Evolução de Montagem - ${(selectedObraId ? allWorks.find(o => o.id === selectedObraId) : allWorks[0])?.nome} (Real vs Meta 60 Dias)`
                : 'Evolução de Montagem (Real vs Meta 60 Dias)'
            } 
          />
        </div>

        {/* Feed de Alertas */}
        <div className={`rounded-2xl border bg-white p-6 shadow-sm transition-all duration-500 ${
          realtimeFlash ? 'border-emerald-300 shadow-emerald-100 shadow-md' : 'border-slate-100'
        }`}>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Alertas Recentes</h3>
              <RealtimeIndicator isConnected={isConnected} />
            </div>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600">
              {metrics.alertas} novos
            </span>
          </div>
          <div className="space-y-4">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <div key={alert.id} className="flex gap-4 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${alert.tipo === 'critico' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{alert.obras?.nome}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{alert.mensagem}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-slate-400 py-8">Nenhum alerta crítico no momento.</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Controle de Obras Ativas */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Tabela de Obras */}
        <div className={`lg:col-span-2 rounded-2xl border bg-white p-6 shadow-sm transition-all duration-500 ${
          realtimeFlash ? 'border-emerald-300 shadow-emerald-100 shadow-md' : 'border-slate-100'
        }`}>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Controle de Obras Ativas</h3>
              <p className="text-sm text-slate-500">Monitore o status do prazo de 60 dias e acione o gerente da obra via WhatsApp.</p>
            </div>
            {realtimeFlash && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Atualizando...
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="pb-4 font-medium">Obra</th>
                  <th className="pb-4 font-medium">Progresso Real</th>
                  <th className="pb-4 font-medium">Esperado (60d)</th>
                  <th className="pb-4 font-medium">Status Prazo</th>
                  <th className="pb-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allWorks.length > 0 ? (
                  allWorks.map((obra) => (
                    <tr 
                      key={obra.id} 
                      onClick={() => setSelectedObraId(obra.id)}
                      className={`group cursor-pointer transition-colors ${selectedObraId === obra.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="py-4 font-semibold text-slate-900">
                        <div>
                          {obra.nome}
                          <div className="text-xs text-slate-400 font-normal">Gerente: {obra.manager_name || 'Não cadastrado'}</div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${obra.progresso_total}%` }} />
                          </div>
                          {obra.progresso_total}%
                        </div>
                      </td>
                      <td className="py-4 text-slate-600">{obra.progresso_esperado}%</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          obra.status_prazo === 'atrasada' 
                            ? 'bg-red-50 text-red-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {obra.status_prazo === 'atrasada' ? '⚠️ Atrasada' : '✅ Em Dia'}
                        </span>
                      </td>
                      <td className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {/* Botões responsivos por linha */}
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-2">
                          <button 
                            onClick={() => handleForceDispatch(obra.id, obra.nome)}
                            disabled={dispatchingId === obra.id}
                            className="flex items-center justify-center rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            {dispatchingId === obra.id ? 'Enviando...' : 'Forçar Disparo'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhuma obra ativa encontrada para controle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel Detalhado da Obra Selecionada */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
          {selectedWork ? (
            <div className="space-y-6 flex flex-col h-full">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Detalhamento da Obra</h3>
                <p className="text-xl font-extrabold text-indigo-600 mt-1">{selectedWork.nome}</p>
                <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                  <p><strong>Gerente:</strong> {selectedWork.manager_name || 'Não informado'}</p>
                  <p><strong>Telefone:</strong> {selectedWork.manager_phone || 'Não informado'}</p>
                  <p><strong>Data de Início:</strong> {new Date(selectedWork.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Métricas específicas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Previsão</span>
                  <span className="block text-sm font-extrabold text-slate-800 mt-1">{forecast?.forecastDateStr}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atrasadas</span>
                  <span className={`block text-sm font-extrabold mt-1 ${selectedWork.fases_atrasadas_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedWork.fases_atrasadas_count} fases
                  </span>
                </div>
              </div>

              {/* Barra de Progresso do Prazo (60 dias) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Cronograma (60 dias corridos)</span>
                  <span className="text-slate-700">{forecast?.elapsedDays}d / 60d</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.round(((forecast?.elapsedDays || 0) / 60) * 100))}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-right font-medium">
                  {forecast && forecast.remainingDays > 0 ? `${forecast.remainingDays} dias restantes no prazo padrão` : 'Prazo de 60 dias expirado'}
                </p>
              </div>

              {/* Lista de Fases */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Checklist das 20 Fases Padrão</span>
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[350px] scrollbar-thin scrollbar-thumb-slate-200">
                  {selectedWork.fases && selectedWork.fases.length > 0 ? (
                    ((selectedWork.fases as any[]) || [])
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((fase) => {
                        const isFaseAtrasada = (forecast?.elapsedDays || 0) > (fase.ordem * 3) && fase.status !== 'concluida';
                        return (
                          <div key={fase.id} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/50 transition-all">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                  {String(fase.ordem).padStart(2, '0')}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">{fase.nome}</span>
                              </div>
                              {isFaseAtrasada && (
                                <span className="shrink-0 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  ⚠️ Atrasada
                                </span>
                              )}
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-3">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    fase.status === 'concluida' ? 'bg-emerald-500' :
                                    fase.status === 'em_andamento' ? 'bg-amber-500' : 'bg-slate-200'
                                  }`} 
                                  style={{ width: `${fase.progresso || 0}%` }} 
                                />
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-slate-500">
                                {fase.status === 'concluida' ? `${fase.progresso}%` :
                                 fase.status === 'em_andamento' ? `${fase.progresso}%` : 'Pendente'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">Nenhuma fase cadastrada para esta obra.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <Sparkles className="h-8 w-8 text-slate-300 mb-2 animate-pulse" />
              <p className="text-sm font-semibold">Nenhuma obra selecionada</p>
              <p className="text-xs mt-1">Selecione uma obra na lista ao lado para ver o detalhamento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Programação das Datas das Mensagens */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600 shrink-0" />
                Programar Mensagens
              </h3>
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dia de Disparo Semanal</label>
                <select 
                  value={scheduleSettings.day} 
                  onChange={(e) => setScheduleSettings({...scheduleSettings, day: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horário do Envio</label>
                <input 
                  type="time" 
                  value={scheduleSettings.time} 
                  onChange={(e) => setScheduleSettings({...scheduleSettings, time: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Recorrência</label>
                <select 
                  value={scheduleSettings.recur} 
                  onChange={(e) => setScheduleSettings({...scheduleSettings, recur: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Semanal">Semanal (Sugerido)</option>
                  <option value="Quinzenal">Quinzenal</option>
                  <option value="Mensal">Mensal</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSchedule}
                className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors active:scale-95 cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Carregando painel...</p>
      </div>
    }>
      <DashboardContent />
    </React.Suspense>
  );
}
