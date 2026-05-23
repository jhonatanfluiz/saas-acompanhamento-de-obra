'use client';

/**
 * useRealtimeDashboard
 * Hook que assina eventos do Supabase Realtime para atualizar o dashboard
 * automaticamente ao receber novas respostas, alertas e atualizações de obra.
 *
 * Uso:
 *   const { isConnected, lastUpdate } = useRealtimeDashboard({ onUpdate: fetchDashboardData });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Criamos um cliente Supabase apenas com a ANON key (seguro para o cliente)
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UseRealtimeDashboardOptions {
  /** Callback chamado quando qualquer dado relevante é atualizado */
  onUpdate: (event: RealtimeEvent) => void;
  /** Filtrar por obra específica (opcional) */
  obraId?: string;
  /** Habilitar/desabilitar a assinatura (default: true) */
  enabled?: boolean;
}

export interface RealtimeEvent {
  tipo: 'nova_resposta' | 'novo_alerta' | 'progresso_atualizado' | 'nova_fase';
  tabela: string;
  payload: any;
  timestamp: Date;
}

interface UseRealtimeDashboardReturn {
  isConnected: boolean;
  lastUpdate: RealtimeEvent | null;
  totalUpdates: number;
}

export function useRealtimeDashboard({
  onUpdate,
  obraId,
  enabled = true,
}: UseRealtimeDashboardOptions): UseRealtimeDashboardReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeEvent | null>(null);
  const [totalUpdates, setTotalUpdates] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Mantém a referência do callback sempre atualizada sem re-criar o canal
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleEvent = useCallback((evento: RealtimeEvent) => {
    setLastUpdate(evento);
    setTotalUpdates((prev) => prev + 1);
    onUpdateRef.current(evento);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Cria o canal de Realtime
    const channelName = obraId
      ? `dashboard_obra_${obraId}`
      : 'dashboard_global';

    const channel = supabaseClient.channel(channelName);

    // ── 1. Ouvir novas respostas ─────────────────────────────────────────────
    const respostasFilter = obraId
      ? { event: 'INSERT', schema: 'public', table: 'respostas', filter: `obra_id=eq.${obraId}` }
      : { event: 'INSERT', schema: 'public', table: 'respostas' };

    channel.on('postgres_changes' as any, respostasFilter, (payload) => {
      handleEvent({
        tipo: 'nova_resposta',
        tabela: 'respostas',
        payload: payload.new,
        timestamp: new Date(),
      });
    });

    // ── 2. Ouvir novos alertas ───────────────────────────────────────────────
    const alertasFilter = obraId
      ? { event: 'INSERT', schema: 'public', table: 'alertas', filter: `obra_id=eq.${obraId}` }
      : { event: 'INSERT', schema: 'public', table: 'alertas' };

    channel.on('postgres_changes' as any, alertasFilter, (payload) => {
      handleEvent({
        tipo: 'novo_alerta',
        tabela: 'alertas',
        payload: payload.new,
        timestamp: new Date(),
      });
    });

    // ── 3. Ouvir atualização de progresso nas obras ──────────────────────────
    const obrasFilter = obraId
      ? { event: 'UPDATE', schema: 'public', table: 'obras', filter: `id=eq.${obraId}` }
      : { event: 'UPDATE', schema: 'public', table: 'obras' };

    channel.on('postgres_changes' as any, obrasFilter, (payload) => {
      handleEvent({
        tipo: 'progresso_atualizado',
        tabela: 'obras',
        payload: payload.new,
        timestamp: new Date(),
      });
    });

    // ── 4. Ouvir atualização de status das fases ─────────────────────────────
    channel.on('postgres_changes' as any, {
      event: 'UPDATE',
      schema: 'public',
      table: 'fases',
    }, (payload) => {
      handleEvent({
        tipo: 'nova_fase',
        tabela: 'fases',
        payload: payload.new,
        timestamp: new Date(),
      });
    });

    // ── 5. Controle de conexão ───────────────────────────────────────────────
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        console.log(`[Realtime] Conectado ao canal: ${channelName}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        console.warn(`[Realtime] Canal desconectado: ${channelName}`);
      }
    });

    channelRef.current = channel;

    // Cleanup: remove o canal ao desmontar o componente
    return () => {
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [obraId, enabled, handleEvent]);

  return { isConnected, lastUpdate, totalUpdates };
}

/**
 * Componente visual de indicador de conexão Realtime.
 * Pode ser usado em qualquer parte do dashboard.
 */
export function RealtimeIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: isConnected ? '#22c55e' : '#94a3b8',
        fontWeight: 500,
      }}
      title={isConnected ? 'Dashboard atualiza em tempo real' : 'Reconectando...'}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#22c55e' : '#94a3b8',
          animation: isConnected ? 'pulse-realtime 2s infinite' : 'none',
          display: 'inline-block',
        }}
      />
      {isConnected ? 'Ao vivo' : 'Offline'}

      <style>{`
        @keyframes pulse-realtime {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
