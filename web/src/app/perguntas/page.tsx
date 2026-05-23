'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Phone,
  User,
  ExternalLink,
  HelpCircle,
  Play,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Obra {
  id: string;
  nome: string;
  manager_name: string | null;
  manager_phone: string | null;
}

interface Pergunta {
  id: string;
  fase_id: string;
  texto_pergunta: string;
  ordem: number;
  peso?: number;
  identificador_unico?: string | null;
}

interface Fase {
  id: string;
  nome: string;
  ordem: number;
  status: string;
  progresso: number;
  perguntas: Pergunta[];
}

export default function PerguntasPage() {
  // State
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('');
  const [fases, setFases] = useState<Fase[]>([]);
  
  const [loadingObras, setLoadingObras] = useState(true);
  const [loadingFases, setLoadingFases] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // WhatsApp dispatch states
  const [dispatching, setDispatching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  // Sandbox / Simulation states
  const [offlineGatewayDetails, setOfflineGatewayDetails] = useState<{
    phone: string;
    name: string;
    mensagem: string;
    fase: string;
    pergunta: string;
    pergunta_ordem?: number;
    is_legacy?: boolean;
  } | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [modalFormData, setModalFormData] = useState({
    faseId: '',
    texto: '',
    ordem: 1,
    peso: 1,
    identificadorUnico: '',
  });
  const [saving, setSaving] = useState(false);

  // Show Toast Notification
  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Helper to format Brazilian phones with country code 55
  const formatPhoneForWA = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
      return '55' + clean;
    }
    return clean;
  };

  // Fetch Obras on mount
  useEffect(() => {
    async function loadObras() {
      try {
        setLoadingObras(true);
        const { data, error: err } = await supabase
          .from('obras')
          .select('id, nome, manager_name, manager_phone')
          .eq('status', 'ativa')
          .order('nome');

        if (err) throw err;
        setObras(data || []);
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlObraId = urlParams.get('obra_id');

        if (urlObraId && data?.some(o => o.id === urlObraId)) {
          setSelectedObraId(urlObraId);
        } else if (data && data.length > 0) {
          setSelectedObraId(data[0].id);
        }
      } catch (err: any) {
        setError('Erro ao carregar as obras: ' + err.message);
      } finally {
        setLoadingObras(false);
      }
    }
    loadObras();
  }, []);

  // Fetch Fases and Perguntas when selectedObraId changes
  const loadFasesEPerguntas = async (obraId: string) => {
    if (!obraId) return;
    try {
      setLoadingFases(true);
      const { data, error: err } = await supabase
        .from('fases')
        .select(`
          id,
          nome,
          ordem,
          status,
          progresso,
          perguntas (
            id,
            fase_id,
            texto_pergunta,
            ordem,
            peso,
            identificador_unico
          )
        `)
        .eq('obra_id', obraId)
        .order('ordem');

      if (err) throw err;
      
      const mappedFases = (data || []).map((fase: any) => ({
        ...fase,
        perguntas: (fase.perguntas || []).sort((a: any, b: any) => a.ordem - b.ordem),
      }));

      setFases(mappedFases);
    } catch (err: any) {
      showToast('Erro ao carregar as fases: ' + err.message, 'error');
    } finally {
      setLoadingFases(false);
    }
  };

  useEffect(() => {
    if (selectedObraId) {
      loadFasesEPerguntas(selectedObraId);
      setOfflineGatewayDetails(null); // Reset sandbox on change
    } else {
      setFases([]);
    }
  }, [selectedObraId]);

  // Selected Obra details
  const selectedObra = useMemo(() => {
    return obras.find(o => o.id === selectedObraId);
  }, [obras, selectedObraId]);

  // Handle direct WhatsApp message trigger
  const handleImmediateWhatsAppSend = async (autoOpen: boolean = true) => {
    if (!selectedObraId) return;
    setDispatching(true);
    // Não limpa imediatamente para evitar transição brusca de tela
    try {
      const res = await fetch(`/api/cron/perguntas?token=chave_secreta_padrao_desenvolvimento_123&obra_id=${selectedObraId}`);
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.gateway_offline && data.disparos && data.disparos.length > 0) {
          // Gateway is offline, load simulation sandbox
          const disp = data.disparos[0];
          const formattedPhone = formatPhoneForWA(disp.manager_phone);
          
          setOfflineGatewayDetails({
            phone: disp.manager_phone,
            name: disp.manager_name,
            mensagem: disp.mensagem,
            fase: disp.fase_nome,
            pergunta: disp.pergunta_texto,
            pergunta_ordem: disp.pergunta_ordem,
            is_legacy: disp.is_legacy
          });
          
          // ABRE AUTOMATICAMENTE O WHATSAPP WEB EM NOVA ABA PRE-PREENCHIDA SE SOLICITADO
          if (autoOpen) {
            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(disp.mensagem)}`;
            window.open(waUrl, '_blank');
            showToast(`Gateway WhatsApp offline. Abrimos o WhatsApp Web para envio imediato!`, 'warning');
          } else {
            showToast(`Avançando na cascata! Nova pergunta carregada no painel Sandbox.`, 'success');
          }
        } else {
          setOfflineGatewayDetails(null);
          const hasSent = data.disparos && data.disparos.some((d: any) => d.status === 'sucesso');
          if (hasSent) {
            showToast(`WhatsApp disparado com sucesso para a obra: ${selectedObra?.nome}!`, 'success');
          } else {
            showToast(`Todas as perguntas e fases ativas desta obra foram respondidas!`, 'warning');
          }
        }
      } else {
        showToast(`Erro no envio: ${data.error || 'Erro interno'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro de rede ao conectar à API: ${err.message}`, 'error');
    } finally {
      setDispatching(false);
    }
  };

  // Simulate incoming manager reply via Webhook
  const handleSimulateReply = async (resposta: string) => {
    if (!offlineGatewayDetails) return;
    setSimulating(true);
    try {
      const formattedPhone = formatPhoneForWA(offlineGatewayDetails.phone);
      
      const payload = {
        event: 'messages.upsert',
        instance: 'instancia_teste',
        data: {
          key: {
            remoteJid: `${formattedPhone}@s.whatsapp.net`,
            fromMe: false,
            id: `simulado_${Date.now()}`
          },
          message: {
            conversation: resposta
          },
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      };

      const res = await fetch('/api/webhook/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Resposta "${resposta}" registrada com sucesso!`, 'success');
        // Atualiza a visualização das fases e progresso localmente na tela
        await loadFasesEPerguntas(selectedObraId);
        // Avança automaticamente para a próxima pergunta da cascata (sem abrir popup)
        await handleImmediateWhatsAppSend(false);
      } else {
        const errText = await res.text();
        showToast(`Erro ao registrar resposta simulada: ${errText}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro de conexão com o webhook de simulação: ${err.message}`, 'error');
    } finally {
      setSimulating(false);
    }
  };

  // Open Modal for Create
  const handleOpenCreateModal = (faseId: string = '') => {
    setModalType('create');
    setEditingQuestionId(null);
    
    const defaultFaseId = faseId || (fases.length > 0 ? fases[0].id : '');
    const selectedFase = fases.find(f => f.id === defaultFaseId);
    
    let nextOrdem = 1;
    if (selectedFase && selectedFase.perguntas.length > 0) {
      const existingOrdens = selectedFase.perguntas.map(p => p.ordem);
      nextOrdem = existingOrdens.includes(1) ? 2 : 1;
    }

    setModalFormData({
      faseId: defaultFaseId,
      texto: '',
      ordem: nextOrdem,
      peso: 1,
      identificadorUnico: '',
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (pergunta: Pergunta) => {
    setModalType('edit');
    setEditingQuestionId(pergunta.id);
    setModalFormData({
      faseId: pergunta.fase_id,
      texto: pergunta.texto_pergunta,
      ordem: pergunta.ordem,
      peso: pergunta.peso || 1,
      identificadorUnico: pergunta.identificador_unico || '',
    });
    setIsModalOpen(true);
  };

  // Handle save (Create / Edit)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFormData.texto.trim()) {
      showToast('O texto da pergunta não pode estar vazio.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (modalType === 'create') {
        const { error: err } = await supabase
          .from('perguntas')
          .insert({
            fase_id: modalFormData.faseId,
            texto_pergunta: modalFormData.texto.trim(),
            ordem: modalFormData.ordem,
            peso: modalFormData.peso,
            identificador_unico: modalFormData.identificadorUnico.trim() || null,
          });

        if (err) throw err;
        showToast('Pergunta cadastrada com sucesso!', 'success');
      } else {
        if (!editingQuestionId) return;
        const { error: err } = await supabase
          .from('perguntas')
          .update({
            texto_pergunta: modalFormData.texto.trim(),
            ordem: modalFormData.ordem,
            fase_id: modalFormData.faseId,
            peso: modalFormData.peso,
            identificador_unico: modalFormData.identificadorUnico.trim() || null,
          })
          .eq('id', editingQuestionId);

        if (err) throw err;
        showToast('Pergunta atualizada com sucesso!', 'success');
      }

      setIsModalOpen(false);
      loadFasesEPerguntas(selectedObraId);
    } catch (err: any) {
      showToast('Erro ao salvar pergunta: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta pergunta?')) return;
    try {
      const { error: err } = await supabase
        .from('perguntas')
        .delete()
        .eq('id', id);

      if (err) throw err;
      showToast('Pergunta excluída com sucesso!', 'success');
      loadFasesEPerguntas(selectedObraId);
    } catch (err: any) {
      showToast('Erro ao excluir pergunta: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 relative animate-in fade-in duration-300">
      {/* Toast Flutuante */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl border transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 
          toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' : 'bg-red-600 text-white border-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuração de Perguntas</h1>
          <p className="text-slate-500">Defina as perguntas de acompanhamento para cada fase da obra.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedObraId && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Pergunta
            </button>
          )}
        </div>
      </div>

      {/* Filtro de Obra & Detalhes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Selecionar Obra para Personalização</label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                disabled={loadingObras}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 appearance-none cursor-pointer"
              >
                {loadingObras ? (
                  <option>Carregando obras...</option>
                ) : obras.length === 0 ? (
                  <option value="">Nenhuma obra ativa encontrada</option>
                ) : (
                  obras.map((o) => (
                    <option key={o.id} value={o.id}>
                       🏗️ {o.nome}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {selectedObra && (
            <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
              <button
                onClick={() => handleImmediateWhatsAppSend()}
                disabled={dispatching || loadingFases}
                className="flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {dispatching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Disparo Imediato WhatsApp
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Informações Rápidas do Gerente */}
        {selectedObra && (
          <div className="pt-3 border-t border-slate-100 grid gap-4 sm:grid-cols-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <span>Gerente da Obra: <strong>{selectedObra.manager_name || 'Não informado'}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>WhatsApp de Destino: <strong>{selectedObra.manager_phone ? `+${selectedObra.manager_phone}` : 'Não informado'}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* PAINEL DE SIMULAÇÃO E CONTINGÊNCIA (Ativa se o gateway estiver offline) */}
      {offlineGatewayDetails && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-6 shadow-md space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
              <h3 className="font-bold text-base">Modo Sandbox: Gateway WhatsApp Indisponível</h3>
            </div>
            <button
              onClick={() => setOfflineGatewayDetails(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-amber-100 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="text-xs text-amber-800 space-y-1">
            <p><strong>Ação detectada:</strong> Tentamos disparar a pergunta de acompanhamento automática via Evolution API (porta 8080), mas o servidor está offline ou inacessível no momento.</p>
            <p><strong>Solução:</strong> Use o painel abaixo para testar o envio manual via <strong>WhatsApp Web</strong> ou simular a resposta de progresso instantaneamente!</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Mensagem que seria enviada */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Mensagem gerada para o WhatsApp</span>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed select-all cursor-pointer" title="Clique para selecionar tudo">
                {offlineGatewayDetails.mensagem}
              </div>
            </div>

            {/* Ações de Contingência e Sandbox */}
            <div className="flex flex-col justify-center space-y-3.5">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Opções de Teste e Envio</span>
              </div>
              
              {/* WhatsApp Web Envio Manual */}
              <a
                href={`https://api.whatsapp.com/send?phone=${formatPhoneForWA(offlineGatewayDetails.phone)}&text=${encodeURIComponent(offlineGatewayDetails.mensagem)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow hover:bg-slate-800 transition-all text-center"
              >
                <ExternalLink size={14} />
                Enviar Manualmente (WhatsApp Web)
              </a>

              <div className="border-t border-slate-200/80 pt-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Simular Resposta ({(!offlineGatewayDetails?.is_legacy || offlineGatewayDetails?.pergunta_ordem === 1) ? 'SIM / NÃO / N/A' : 'Percentual de Conclusão'})
                </span>
                {offlineGatewayDetails?.is_legacy && offlineGatewayDetails?.pergunta_ordem === 2 ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {['25%', '50%', '75%', '100%', 'N/A'].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleSimulateReply(pct)}
                        disabled={simulating}
                        className="flex items-center justify-center rounded-xl bg-indigo-600 px-1 py-2 text-[11px] font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                      >
                        {pct}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSimulateReply('SIM')}
                      disabled={simulating}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      Mestre "SIM"
                    </button>
                    <button
                      onClick={() => handleSimulateReply('NÃO')}
                      disabled={simulating}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                    >
                      <X size={14} />
                      Mestre "NÃO"
                    </button>
                    <button
                      onClick={() => handleSimulateReply('N/A')}
                      disabled={simulating}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                    >
                      <HelpCircle size={14} />
                      Mestre "N/A"
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carregamento das Fases */}
      {loadingFases && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando fases e perguntas de acompanhamento...</p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* Lista de Fases e Suas Perguntas */}
      {!loadingFases && !error && selectedObraId && (
        <div className="space-y-6">
          {fases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
              <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600">Nenhuma fase configurada para esta obra</p>
              <p className="text-sm mt-1">Crie as fases básicas primeiro no painel de administração.</p>
            </div>
          ) : (
            fases.map((fase) => (
              <div
                key={fase.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
              >
                {/* Header da Fase */}
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
                      {fase.ordem}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base">{fase.nome}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 uppercase ${
                      fase.status === 'concluida' ? 'bg-emerald-100 text-emerald-700' :
                      fase.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {fase.status === 'concluida' ? '✓ Concluída' :
                       fase.status === 'em_andamento' ? '🏗️ Em Andamento' : '⏱️ Pendente'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                      Progresso: {Number(fase.progresso).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Perguntas da Fase */}
                <div className="divide-y divide-slate-100">
                  {fase.perguntas.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                      Nenhuma pergunta cadastrada para esta fase. 
                      <button
                        onClick={() => handleOpenCreateModal(fase.id)}
                        className="text-indigo-600 font-bold ml-1 hover:underline cursor-pointer"
                      >
                        + Cadastrar Pergunta 1
                      </button>
                    </div>
                  ) : (
                    fase.perguntas.map((pergunta) => (
                      <div
                        key={pergunta.id}
                        className="flex items-start justify-between p-6 transition-all hover:bg-slate-50/40 gap-4"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mt-0.5">
                            <MessageSquare size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                Pergunta {pergunta.ordem}
                              </span>
                              {pergunta.identificador_unico && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  {pergunta.identificador_unico}
                                </span>
                              )}
                              {pergunta.peso !== undefined && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                  Peso: {pergunta.peso}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 leading-snug">{pergunta.texto_pergunta}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(pergunta)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Editar Pergunta"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(pergunta.id)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir Pergunta"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Sugerir Adicionar Segunda Pergunta se houver apenas 1 */}
                  {fase.perguntas.length === 1 && (
                    <div className="bg-slate-50/30 px-6 py-3 text-center border-t border-slate-100">
                      <button
                        onClick={() => handleOpenCreateModal(fase.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        Cadastrar Pergunta 2 da fase {fase.nome}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Regras Importantes do WhatsApp */}
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6">
        <h4 className="text-sm font-bold text-amber-800 mb-2">Importante: Regras do WhatsApp</h4>
        <div className="text-xs text-amber-700 leading-relaxed space-y-2">
          <p>O sistema de automação do WhatsApp suporta dois modelos de checklist:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Modelo Clássico de 2 Perguntas</strong>: A Pergunta 1 aceita SIM/NÃO/N/A e a Pergunta 2 aceita porcentagem (25%, 50%, 75% ou 100%). Se responder NÃO na P1, a P2 é pulada automaticamente.</li>
            <li><strong>Modelo Ponderado Multietapas</strong>: Fases com quantidade de perguntas diferente de 2. Todas as perguntas aceitam estritamente SIM, NÃO ou N/A, e o progresso da fase é calculado de forma ponderada pelos pesos das perguntas. Se um item com peso &ge; 3 for respondido como NÃO, um alerta crítico é gerado automaticamente.</li>
          </ul>
        </div>
      </div>

      {/* Modal - Cadastrar / Editar Pergunta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
                {modalType === 'create' ? 'Cadastrar Pergunta' : 'Editar Pergunta'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Selecionar Fase */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fase Associada</label>
                <select
                  value={modalFormData.faseId}
                  onChange={(e) => setModalFormData({ ...modalFormData, faseId: e.target.value })}
                  disabled={modalType === 'edit'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
                >
                  {fases.map((fase) => (
                    <option key={fase.id} value={fase.id}>
                      {fase.ordem}. {fase.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ordem da Pergunta */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ordem da Pergunta</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={modalFormData.ordem}
                  onChange={(e) => setModalFormData({ ...modalFormData, ordem: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Peso da Pergunta */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Peso de Importância (1 a 3)</label>
                <select
                  value={modalFormData.peso}
                  onChange={(e) => setModalFormData({ ...modalFormData, peso: parseInt(e.target.value) || 1 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value={1}>Peso 1 (Baixo)</option>
                  <option value={2}>Peso 2 (Médio)</option>
                  <option value={3}>Peso 3 (Crítico - gera alerta crítico se respondido NÃO)</option>
                </select>
              </div>

              {/* Identificador Único */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Identificador Único (Ex: INF-01, ELE-15)</label>
                <input
                  type="text"
                  placeholder="Ex: INF-01"
                  value={modalFormData.identificadorUnico}
                  onChange={(e) => setModalFormData({ ...modalFormData, identificadorUnico: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Texto da Pergunta */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Texto da Pergunta</label>
                <textarea
                  rows={3}
                  value={modalFormData.texto}
                  onChange={(e) => setModalFormData({ ...modalFormData, texto: e.target.value })}
                  placeholder="Ex: A alvenaria do 1º andar foi concluída?"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
              </div>

              {/* Botões de Ação */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Salvando...' : 'Salvar Pergunta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
