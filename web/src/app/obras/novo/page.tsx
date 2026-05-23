'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Save,
  Phone,
  Loader2,
  Building2,
  User,
  CalendarDays,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface FormData {
  nome: string;
  cliente: string;
  mestre_nome: string;
  mestre_phone: string;
  data_inicio: string;
  data_entrega: string;
  saudacao: string;
  checklist_id: string | null;
}

const initialForm: FormData = {
  nome: '',
  cliente: '',
  mestre_nome: '',
  mestre_phone: '',
  data_inicio: '',
  data_entrega: '',
  saudacao: 'Bom dia [nome]. Como está o avanço da obra [obra]?',
  checklist_id: null,
};

export default function NovaObraPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialForm);
  interface ChecklistOption {
    id: string;
    nome: string;
    fases_count: number;
    perguntas_count: number;
  }

  const [checklists, setChecklists] = useState<ChecklistOption[]>([]);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const { data, error } = await supabase
          .from('checklists')
          .select(`
            id,
            nome,
            checklist_fases (
              id,
              checklist_perguntas (
                id
              )
            )
          `)
          .order('nome');
        if (error) throw error;
        if (data) {
          const formatted = data.map((item: any) => {
            const fases_count = item.checklist_fases?.length || 0;
            const perguntas_count = item.checklist_fases?.reduce(
              (acc: number, fase: any) => acc + (fase.checklist_perguntas?.length || 0),
              0
            ) || 0;
            return {
              id: item.id,
              nome: item.nome,
              fases_count,
              perguntas_count,
            };
          });
          setChecklists(formatted);
        }
      } catch (err) {
        console.error('Erro ao carregar checklists:', err);
      }
    };
    fetchChecklists();
  }, []);

  const updateField = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'data_inicio' && value) {
        const date = new Date(value + 'T12:00:00');
        date.setDate(date.getDate() + 60);
        next.data_entrega = date.toISOString().split('T')[0];
      }
      return next;
    });
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validação básica
    if (!formData.nome.trim()) return setErrorMsg('O nome da obra é obrigatório.');
    if (!formData.mestre_nome.trim()) return setErrorMsg('O nome do mestre de obras é obrigatório.');
    if (!formData.mestre_phone.trim()) return setErrorMsg('O WhatsApp do mestre é obrigatório.');
    if (!formData.data_inicio) return setErrorMsg('A data de início é obrigatória.');
    if (!formData.data_entrega) return setErrorMsg('A data de entrega prevista é obrigatória.');

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('criar_obra_completa', {
        p_nome: formData.nome.trim(),
        p_mestre_nome: formData.mestre_nome.trim(),
        p_mestre_phone: formData.mestre_phone.replace(/\D/g, ''),
        p_saudacao: formData.saudacao.trim(),
        p_data_inicio: formData.data_inicio,
        p_data_entrega: formData.data_entrega,
        p_checklist_id: formData.checklist_id || null,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => router.push('/obras'), 2200);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro desconhecido ao criar obra.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg mt-24 text-center space-y-6 px-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Obra criada com sucesso!</h2>
        <p className="text-slate-500">
          As fases e perguntas da obra foram configuradas com base no checklist selecionado.
          Redirecionando para a lista de obras...
        </p>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }
  const selectedChecklist = checklists.find(c => c.id === formData.checklist_id);
  const totalFasesStr = selectedChecklist 
    ? `${selectedChecklist.fases_count} fases` 
    : '20 fases de montagem';
  const totalPerguntasStr = selectedChecklist 
    ? `${selectedChecklist.perguntas_count} perguntas` 
    : '40 perguntas';

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <Link
          href="/obras"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Voltar para Obras
        </Link>
      </div>

      {/* Hero do formulário */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 text-white shadow-xl shadow-indigo-200">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-5 w-5 text-indigo-300" />
          <span className="text-sm font-semibold text-indigo-200 uppercase tracking-wider">Nova Obra</span>
        </div>
        <h1 className="text-3xl font-bold">Cadastrar Nova Obra</h1>
        <p className="mt-2 text-indigo-100 text-sm max-w-md">
          Preencha os dados abaixo. O sistema criará automaticamente as{' '}
          <strong>{totalFasesStr}</strong> e <strong>{totalPerguntasStr}</strong> de acompanhamento.
        </p>

        {/* Chips de resumo */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            selectedChecklist ? `${selectedChecklist.fases_count} Fases automáticas` : '20 Fases automáticas',
            selectedChecklist ? `${selectedChecklist.perguntas_count} Perguntas configuradas` : '40 Perguntas configuradas',
            'Rastreio de 60 dias',
            'WhatsApp integrado'
          ].map((chip) => (
            <span key={chip} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              ✓ {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>

        {/* Seção: Identificação da Obra */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Identificação da Obra</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Nome da Obra <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={updateField('nome')}
              placeholder="Ex: Residencial Jardins da Serra"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cliente / Contratante
            </label>
            <input
              type="text"
              value={formData.cliente}
              onChange={updateField('cliente')}
              placeholder="Nome da construtora ou pessoa física"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Template de Checklist
            </label>
            <select
              value={formData.checklist_id || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, checklist_id: e.target.value || null }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="">Montagem Padrão de Elevadores (20 fases - Padrão do Sistema)</option>
              {checklists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Selecione um checklist customizado ou mantenha o padrão com as 20 fases clássicas de elevadores.
            </p>
          </div>
        </div>

        {/* Seção: Mestre de Obras */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Responsável / Mestre de Obras</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Nome do Mestre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.mestre_nome}
                onChange={updateField('mestre_nome')}
                placeholder="Nome completo"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={formData.mestre_phone}
                  onChange={updateField('mestre_phone')}
                  placeholder="55 11 99999-0000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">Inclua o código do país: 55 11 9...</p>
            </div>
          </div>
        </div>

        {/* Seção: Cronograma */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Cronograma</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Data de Início <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.data_inicio}
                onChange={updateField('data_inicio')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Entrega Prevista (60 dias padrão) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.data_entrega}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 cursor-not-allowed focus:outline-none transition-all"
              />
            </div>
          </div>

          {formData.data_inicio && formData.data_entrega && formData.data_entrega > formData.data_inicio && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-medium">
              ✓ Prazo de{' '}
              <strong>
                {Math.round(
                  (new Date(formData.data_entrega).getTime() - new Date(formData.data_inicio).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{' '}
                dias
              </strong>{' '}
              configurado. O sistema monitorará automaticamente o avanço com base nos 60 dias críticos.
            </div>
          )}
        </div>

        {/* Seção: Mensagem WhatsApp */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Mensagem de Acompanhamento</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Saudação Personalizada
            </label>
            <textarea
              rows={3}
              value={formData.saudacao}
              onChange={updateField('saudacao')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Use <code className="bg-slate-100 px-1 rounded">[nome]</code> para o nome do mestre e{' '}
              <code className="bg-slate-100 px-1 rounded">[obra]</code> para o nome da obra.
            </p>
          </div>
        </div>

        {/* Feedback de erro */}
        {errorMsg && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/obras"
            className="flex items-center justify-center rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando obra...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {selectedChecklist ? `Criar Obra com ${selectedChecklist.fases_count} Fases` : 'Criar Obra com 20 Fases'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
