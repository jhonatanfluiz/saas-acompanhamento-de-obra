-- Estrutura SQL para Sistema SaaS de Acompanhamento de Obras
-- Preparado para o Supabase (Multi-tenant e respostas flexíveis)

-- 1. Limpeza (caso exista estrutura anterior)
DROP VIEW IF EXISTS public.vw_status_obras CASCADE;
DROP TRIGGER IF EXISTS trg_atualiza_progresso ON public.respostas CASCADE;
DROP TRIGGER IF EXISTS trg_normaliza_resposta ON public.respostas CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_progresso_fase_obra() CASCADE;
DROP FUNCTION IF EXISTS public.normalizar_resposta() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.criar_obra_completa(text, text, text, text, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.criar_obra_completa(text, text, text, text, date, date, uuid) CASCADE;
DROP TABLE IF EXISTS public.checklist_perguntas CASCADE;
DROP TABLE IF EXISTS public.checklist_fases CASCADE;
DROP TABLE IF EXISTS public.checklists CASCADE;

DROP TABLE IF EXISTS public.sessao_conversa CASCADE;
DROP TABLE IF EXISTS public.logs_webhook CASCADE;
DROP TABLE IF EXISTS public.relatorios CASCADE;
DROP TABLE IF EXISTS public.alertas CASCADE;
DROP TABLE IF EXISTS public.respostas CASCADE;
DROP TABLE IF EXISTS public.perguntas CASCADE;
DROP TABLE IF EXISTS public.fases CASCADE;
DROP TABLE IF EXISTS public.obras CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- 2. Tabela: Tenants (Empresas)
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Tabela: Usuários (Estendendo auth.users)
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  telefone text,
  funcao text DEFAULT 'usuario', -- Ex: 'admin', 'mestre_obras', 'usuario'
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 3.5. Tabelas para Templates de Checklists
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae'::uuid,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

CREATE TABLE public.checklist_fases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(checklist_id, ordem)
);

CREATE TABLE public.checklist_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_fase_id uuid NOT NULL REFERENCES public.checklist_fases(id) ON DELETE CASCADE,
  texto_pergunta text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1),
  peso integer DEFAULT 1,
  identificador_unico text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(checklist_fase_id, ordem)
);

-- 4. Tabela: Obras
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cliente text,
  mestre_obras_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text DEFAULT 'ativa', -- 'ativa', 'concluida', 'pausada'
  progresso_total numeric DEFAULT 0.0 CHECK (progresso_total >= 0 AND progresso_total <= 100),
  data_inicio date,
  data_entrega_prevista date,
  orcamento_total numeric,
  manager_name text,
  manager_phone text,
  custom_greeting text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae'::uuid,
  checklist_id uuid REFERENCES public.checklists(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id)
);

-- 5. Tabela: Fases (até 100 por obra)
CREATE TABLE public.fases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1 AND ordem <= 100),
  status text DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluida', 'atrasada'
  progresso numeric DEFAULT 0.0 CHECK (progresso >= 0 AND progresso <= 100),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(obra_id, ordem)
);

-- 6. Tabela: Perguntas (até 100 por fase)
CREATE TABLE public.perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id uuid NOT NULL REFERENCES public.fases(id) ON DELETE CASCADE,
  texto_pergunta text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1 AND ordem <= 100),
  peso integer DEFAULT 1,
  identificador_unico text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(fase_id, ordem)
);

-- 7. Tabela: Respostas (Aceitam SIM, NÃO ou porcentagens)
CREATE TABLE public.respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.fases(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  resposta text NOT NULL CHECK (resposta IN ('SIM', 'NÃO', '25%', '50%', '75%', '100%', 'N/A')),
  observacao text,
  usuario_responsavel uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  data_resposta timestamp with time zone DEFAULT now()
);

-- 8. Tabela: Sessão de Conversa WhatsApp
-- Permite rastrear estado por telefone e retomar questionário interrompido
CREATE TABLE public.sessao_conversa (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                 text NOT NULL UNIQUE,
  obra_id               uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  fase_id               uuid REFERENCES public.fases(id) ON DELETE CASCADE,
  tentativas_invalidas  integer DEFAULT 0,
  ultima_mensagem_em    timestamp with time zone DEFAULT now(),
  created_at            timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_sessao_phone ON public.sessao_conversa(phone);

-- RLS: Apenas service_role acessa (webhook usa service_role key)
ALTER TABLE public.sessao_conversa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Apenas service_role pode ler sessoes" ON public.sessao_conversa
  FOR ALL USING (auth.role() = 'service_role');

-- 8.5. Tabela: Logs de Webhook (auditoria completa de eventos recebidos)
CREATE TABLE public.logs_webhook (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento               text NOT NULL,           -- 'mensagem_recebida', 'resposta_salva', 'alerta_gerado', 'resposta_invalida', 'sessao_bloqueada', 'erro'
  phone                text,                    -- número do remetente
  obra_id              uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  fase_id              uuid REFERENCES public.fases(id) ON DELETE SET NULL,
  pergunta_id          uuid REFERENCES public.perguntas(id) ON DELETE SET NULL,
  usuario_id           uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  payload_entrada      jsonb,                   -- payload bruto recebido da Evolution API
  texto_recebido       text,                    -- texto bruto da mensagem do usuário
  resposta_processada  text,                    -- valor normalizado salvo (SIM/NÃO/N/A/25%...)
  status               text DEFAULT 'ok',       -- 'ok', 'invalido', 'erro', 'bloqueado', 'ignorado'
  mensagem_enviada     text,                    -- texto enviado de volta ao WhatsApp
  erro_detalhe         text,                    -- detalhes do erro, se houver
  duracao_ms           integer,                 -- tempo de processamento em milissegundos
  created_at           timestamp with time zone DEFAULT now()
);

-- Índices de performance para logs
CREATE INDEX idx_logs_webhook_phone ON public.logs_webhook(phone);
CREATE INDEX idx_logs_webhook_obra ON public.logs_webhook(obra_id);
CREATE INDEX idx_logs_webhook_status ON public.logs_webhook(status);
CREATE INDEX idx_logs_webhook_created ON public.logs_webhook(created_at DESC);

-- RLS: service_role pode inserir/ler; usuários autenticados leem apenas os da sua empresa
ALTER TABLE public.logs_webhook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role acesso total em logs" ON public.logs_webhook
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Usuarios veem logs da sua empresa" ON public.logs_webhook
  FOR SELECT USING (
    obra_id IN (SELECT id FROM public.obras WHERE tenant_id = public.get_user_empresa_id())
  );

-- 9. Tabela: Alertas
CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fase_id uuid REFERENCES public.fases(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- Ex: 'atraso', 'problema', 'critico'
  mensagem text NOT NULL,
  resolvido boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Tabela: Relatórios
CREATE TABLE public.relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- Ex: 'semanal', 'mensal', 'final'
  dados_json jsonb,
  url_arquivo text,
  gerado_por uuid REFERENCES public.usuarios(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 10. Índices de Performance
CREATE INDEX idx_obras_mestre ON public.obras(mestre_obras_id);
CREATE INDEX idx_fases_obra ON public.fases(obra_id);
CREATE INDEX idx_perguntas_fase ON public.perguntas(fase_id);
CREATE INDEX idx_respostas_obra ON public.respostas(obra_id);
CREATE INDEX idx_respostas_fase ON public.respostas(fase_id);
CREATE INDEX idx_alertas_nao_resolvidos ON public.alertas(obra_id) WHERE resolvido = false;
CREATE INDEX idx_checklists_tenant ON public.checklists(tenant_id);
CREATE INDEX idx_checklist_fases_checklist ON public.checklist_fases(checklist_id);
CREATE INDEX idx_checklist_perguntas_fase ON public.checklist_perguntas(checklist_fase_id);

-- 11. Função e Trigger para Normalização de Respostas
CREATE OR REPLACE FUNCTION public.normalizar_resposta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.resposta := TRIM(UPPER(NEW.resposta));
  
  IF NEW.resposta IN ('NAO', 'NÃO') THEN
    NEW.resposta := 'NÃO';
  ELSIF NEW.resposta IN ('SIM') THEN
    NEW.resposta := 'SIM';
  ELSIF NEW.resposta IN ('25%', '25') THEN
    NEW.resposta := '25%';
  ELSIF NEW.resposta IN ('50%', '50') THEN
    NEW.resposta := '50%';
  ELSIF NEW.resposta IN ('75%', '75') THEN
    NEW.resposta := '75%';
  ELSIF NEW.resposta IN ('100%', '100') THEN
    NEW.resposta := '100%';
  ELSIF NEW.resposta IN ('N/A', 'NA', 'N A') THEN
    NEW.resposta := 'N/A';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normaliza_resposta
BEFORE INSERT OR UPDATE ON public.respostas
FOR EACH ROW
EXECUTE FUNCTION public.normalizar_resposta();

-- 12. Função e Trigger para Cálculo Automático de Progresso
CREATE OR REPLACE FUNCTION public.atualizar_progresso_fase_obra()
RETURNS TRIGGER AS $$
DECLARE
  v_num_perguntas integer;
  v_progresso_fase numeric := 0.0;
  v_progresso_obra numeric := 0.0;
  v_fase_status text := 'pendente';
  
  -- Para lógica clássica
  v_resp_p1 text;
  v_resp_p2 text;
  v_p1_id uuid;
  v_p2_id uuid;
  
  -- Para lógica ponderada
  v_soma_pesos_sim numeric := 0.0;
  v_soma_pesos_total numeric := 0.0;
  v_total_perguntas_fase integer;
  v_total_respostas_fase integer;
  v_total_na integer;
  
  -- Alertas
  v_pergunta_peso integer;
  v_pergunta_texto text;
  v_pergunta_id_unico text;
BEGIN
  -- Verificar a quantidade de perguntas cadastradas para esta fase
  SELECT COUNT(*) INTO v_num_perguntas FROM public.perguntas WHERE fase_id = NEW.fase_id;
  
  -- Verificar se é a lógica clássica (2 perguntas, ordem 1 e 2, onde a segunda é percentual)
  IF v_num_perguntas = 2 AND EXISTS (
    SELECT 1 FROM public.perguntas 
    WHERE fase_id = NEW.fase_id 
      AND ordem = 2 
      AND (texto_pergunta ILIKE '%percentual%' OR texto_pergunta ILIKE '%porcentagem%')
  ) THEN
    -- Obter os IDs das perguntas 1 e 2 para a fase
    SELECT id INTO v_p1_id FROM public.perguntas WHERE fase_id = NEW.fase_id AND ordem = 1;
    SELECT id INTO v_p2_id FROM public.perguntas WHERE fase_id = NEW.fase_id AND ordem = 2;

    -- Obter as respostas para as perguntas 1 e 2
    SELECT resposta INTO v_resp_p1 FROM public.respostas WHERE pergunta_id = v_p1_id AND obra_id = NEW.obra_id;
    SELECT resposta INTO v_resp_p2 FROM public.respostas WHERE pergunta_id = v_p2_id AND obra_id = NEW.obra_id;

    -- Calcular o progresso da fase com base nas regras clássicas
    IF v_resp_p1 = 'NÃO' OR v_resp_p1 = 'N/A' THEN
      v_progresso_fase := 0.0;
    ELSIF v_resp_p1 = 'SIM' THEN
      IF v_resp_p2 IS NOT NULL THEN
        v_progresso_fase := REPLACE(v_resp_p2, '%', '')::numeric;
      ELSE
        v_progresso_fase := 0.0;
      END IF;
    ELSE
      v_progresso_fase := 0.0;
    END IF;

    -- Definir status da fase clássica
    v_fase_status := CASE 
                       WHEN v_resp_p1 = 'NÃO' THEN 'concluida'
                       WHEN v_resp_p1 = 'N/A' THEN 'concluida'
                       WHEN v_resp_p2 IS NOT NULL THEN 'concluida'
                       WHEN v_resp_p1 = 'SIM' THEN 'em_andamento'
                       ELSE 'pendente'
                     END;
                     
    -- Gerar alerta se respondeu NÃO na P1
    IF v_resp_p1 = 'NÃO' AND NEW.pergunta_id = v_p1_id THEN
      INSERT INTO public.alertas (obra_id, fase_id, tipo, mensagem)
      VALUES (
        NEW.obra_id, 
        NEW.fase_id, 
        'atraso', 
        'A etapa foi respondida como NÃO executada. Alerta de possível atraso registrado.'
      ) ON CONFLICT DO NOTHING;
    END IF;

  ELSE
    -- Lógica ponderada (Prompt 3)
    -- Progresso = (soma dos pesos das respostas SIM) / (soma dos pesos das perguntas, exceto as respondidas com N/A) * 100
    SELECT 
      COALESCE(SUM(CASE WHEN r.resposta = 'SIM' THEN p.peso ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN r.resposta = 'N/A' THEN 0 ELSE p.peso END), 0)
    INTO v_soma_pesos_sim, v_soma_pesos_total
    FROM public.perguntas p
    LEFT JOIN public.respostas r ON r.pergunta_id = p.id AND r.obra_id = NEW.obra_id
    WHERE p.fase_id = NEW.fase_id;

    IF v_soma_pesos_total > 0 THEN
      v_progresso_fase := ROUND((v_soma_pesos_sim / v_soma_pesos_total) * 100, 2);
    ELSE
      v_progresso_fase := 100.0; -- Se tudo for N/A, considera concluída
    END IF;

    -- Obter total de perguntas e respostas para definir o status da fase
    SELECT COUNT(*) INTO v_total_perguntas_fase FROM public.perguntas WHERE fase_id = NEW.fase_id;
    SELECT COUNT(*) INTO v_total_respostas_fase FROM public.respostas WHERE fase_id = NEW.fase_id AND obra_id = NEW.obra_id;
    SELECT COUNT(*) INTO v_total_na FROM public.respostas WHERE fase_id = NEW.fase_id AND obra_id = NEW.obra_id AND resposta = 'N/A';

    IF v_total_respostas_fase = v_total_perguntas_fase OR (v_soma_pesos_total = 0 AND v_total_na > 0) THEN
      v_fase_status := 'concluida';
    ELSIF v_total_respostas_fase > 0 THEN
      v_fase_status := 'em_andamento';
    ELSE
      v_fase_status := 'pendente';
    END IF;

    -- Buscar dados da pergunta atual que disparou a trigger
    SELECT peso, texto_pergunta, identificador_unico 
    INTO v_pergunta_peso, v_pergunta_texto, v_pergunta_id_unico 
    FROM public.perguntas 
    WHERE id = NEW.pergunta_id;

    -- Regra de alerta de atraso baseada em pesos
    IF NEW.resposta = 'NÃO' THEN
      INSERT INTO public.alertas (obra_id, fase_id, tipo, mensagem)
      VALUES (
        NEW.obra_id,
        NEW.fase_id,
        CASE WHEN COALESCE(v_pergunta_peso, 1) >= 3 THEN 'critico' ELSE 'atraso' END,
        CASE 
          WHEN COALESCE(v_pergunta_peso, 1) >= 3 THEN 
            'CRÍTICO: Item essencial não executado (' || COALESCE(v_pergunta_id_unico, 'S/ID') || '): ' || v_pergunta_texto
          ELSE 
            'Alerta de pendência (' || COALESCE(v_pergunta_id_unico, 'S/ID') || '): ' || v_pergunta_texto
        END
      ) ON CONFLICT DO NOTHING;
    END IF;

  END IF;

  -- Atualizar a fase correspondente
  UPDATE public.fases
  SET progresso = v_progresso_fase,
      status = v_fase_status
  WHERE id = NEW.fase_id;

  -- Calcular progresso da obra (média aritmética de todas as fases com pesos iguais)
  SELECT COALESCE(AVG(progresso), 0)
  INTO v_progresso_obra
  FROM public.fases
  WHERE obra_id = NEW.obra_id;

  -- Atualizar progresso total da obra
  UPDATE public.obras
  SET progresso_total = v_progresso_obra,
      status = CASE
                 WHEN v_progresso_obra = 100 THEN 'concluida'
                 ELSE 'ativa'
               END
  WHERE id = NEW.obra_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_progresso
AFTER INSERT OR UPDATE ON public.respostas
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_progresso_fase_obra();

-- 13. Segurança RLS (Row Level Security) e Políticas por Tenant (Empresa)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_perguntas ENABLE ROW LEVEL SECURITY;

-- Helper para obter o tenant_id do usuário logado (retorna o tenant padrão para usuários anônimos)
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.usuarios WHERE id = auth.uid()),
    'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae'::uuid
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas
CREATE POLICY "Acesso ao tenant da empresa" ON public.tenants
  FOR SELECT USING (id = public.get_user_empresa_id());

CREATE POLICY "Isolamento por Empresa - Usuarios" ON public.usuarios
  FOR ALL USING (id = auth.uid() OR tenant_id = public.get_user_empresa_id());

CREATE POLICY "Isolamento por Empresa - Obras" ON public.obras
  FOR ALL USING (tenant_id = public.get_user_empresa_id());

CREATE POLICY "Isolamento por Empresa - Checklists" ON public.checklists
  FOR ALL USING (tenant_id = public.get_user_empresa_id());

CREATE POLICY "Isolamento por Empresa - Checklist Fases" ON public.checklist_fases
  FOR ALL USING (checklist_id IN (SELECT id FROM public.checklists WHERE tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Checklist Perguntas" ON public.checklist_perguntas
  FOR ALL USING (checklist_fase_id IN (SELECT cf.id FROM public.checklist_fases cf JOIN public.checklists c ON cf.checklist_id = c.id WHERE c.tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Fases" ON public.fases
  FOR ALL USING (obra_id IN (SELECT id FROM public.obras WHERE tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Perguntas" ON public.perguntas
  FOR ALL USING (fase_id IN (SELECT f.id FROM public.fases f JOIN public.obras o ON f.obra_id = o.id WHERE o.tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Respostas" ON public.respostas
  FOR ALL USING (obra_id IN (SELECT id FROM public.obras WHERE tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Alertas" ON public.alertas
  FOR ALL USING (obra_id IN (SELECT id FROM public.obras WHERE tenant_id = public.get_user_empresa_id()));

CREATE POLICY "Isolamento por Empresa - Relatorios" ON public.relatorios
  FOR ALL USING (obra_id IN (SELECT id FROM public.obras WHERE tenant_id = public.get_user_empresa_id()));

-- 14. View para Status de Obra (Regra dos 60 dias)
CREATE OR REPLACE VIEW public.vw_status_obras AS
SELECT 
    o.id,
    o.nome,
    o.data_inicio,
    o.progresso_total,
    o.tenant_id,
    EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) as dias_decorridos,
    LEAST(100, ROUND((EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) / 60.0) * 100, 2)) as progresso_esperado,
    CASE 
        WHEN o.progresso_total < (EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) / 60.0) * 100 THEN 'atrasada'
        ELSE 'em_dia'
    END as status_prazo
FROM public.obras o;

-- 15. Função para criar uma obra completa com suporte a checklists/templates clonados
CREATE OR REPLACE FUNCTION public.criar_obra_completa(
  p_nome text,
  p_mestre_nome text,
  p_mestre_phone text,
  p_saudacao text,
  p_data_inicio date,
  p_data_entrega date,
  p_checklist_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_obra_id uuid;
    v_fase_id uuid;
    v_fase_nome text;
    v_checklist_id uuid := p_checklist_id;
    r_fase record;
    i integer;
    v_fases_templates text[] := ARRAY[
        'Mobilização da equipe',
        'Conferência da prumada',
        'Liberação do poço',
        'Instalação de andaimes e proteção',
        'Instalação das guias da cabine',
        'Instalação das guias do contrapeso',
        'Montagem da máquina de tração',
        'Instalação da base da máquina',
        'Instalação do limitador de velocidade',
        'Instalação do quadro de comando',
        'Passagem de chicotes e cabeamentos',
        'Montagem da cabine',
        'Montagem do contrapeso',
        'Instalação das portas de pavimento',
        'Instalação das botoeiras e sinalizações',
        'Instalação do operador de portas',
        'Ajustes elétricos e parametrizações',
        'Testes operacionais',
        'Ajustes finais e acabamento',
        'Entrega técnica ao cliente'
    ];
BEGIN
    -- Inserir Obra enforcando o prazo padrão de 60 dias
    INSERT INTO public.obras (
        nome, 
        manager_name, 
        manager_phone, 
        custom_greeting, 
        data_inicio, 
        data_entrega_prevista, 
        status,
        progresso_total,
        tenant_id,
        checklist_id
    )
    VALUES (
        p_nome, 
        p_mestre_nome, 
        p_mestre_phone, 
        p_saudacao, 
        p_data_inicio, 
        p_data_inicio + INTERVAL '60 days', -- Enforçar prazo de 60 dias corridos
        'ativa',
        0,
        public.get_user_empresa_id(), -- usar tenant do usuário
        v_checklist_id
    )
    RETURNING id INTO v_obra_id;

    -- Se o checklist_id for fornecido e existir, clonar fases e perguntas do checklist
    IF v_checklist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.checklists WHERE id = v_checklist_id) THEN
        FOR r_fase IN (
            SELECT id, nome, ordem 
            FROM public.checklist_fases 
            WHERE checklist_id = v_checklist_id 
            ORDER BY ordem
        ) LOOP
            INSERT INTO public.fases (obra_id, nome, ordem, status, progresso)
            VALUES (v_obra_id, r_fase.nome, r_fase.ordem, 'pendente', 0)
            RETURNING id INTO v_fase_id;

            -- Inserir perguntas padrão associadas a esta fase do template
            INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem, peso, identificador_unico)
            SELECT v_fase_id, texto_pergunta, ordem, peso, identificador_unico
            FROM public.checklist_perguntas
            WHERE checklist_fase_id = r_fase.id
            ORDER BY ordem;
        END LOOP;
    ELSE
        -- Fallback: Criar 20 Fases do Elevador com base no template clássico
        FOR i IN 1..20 LOOP
            v_fase_nome := v_fases_templates[i];
            
            INSERT INTO public.fases (obra_id, nome, ordem, status, progresso)
            VALUES (v_obra_id, v_fase_nome, i, 'pendente', 0)
            RETURNING id INTO v_fase_id;

            -- Criar exatamente as 2 Perguntas Padrão por Fase
            INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem) VALUES
            (v_fase_id, 'Executado?', 1),
            (v_fase_id, 'Qual o percentual executado?', 2);
        END LOOP;
    END IF;

    RETURN v_obra_id;
END;
$$ LANGUAGE plpgsql;

