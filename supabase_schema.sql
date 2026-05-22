-- Estrutura SQL para Sistema SaaS de Acompanhamento de Obras
-- Preparado para o Supabase

-- 1. Limpeza (caso exista estrutura anterior)
DROP TABLE IF EXISTS public.relatorios CASCADE;
DROP TABLE IF EXISTS public.alertas CASCADE;
DROP TABLE IF EXISTS public.respostas CASCADE;
DROP TABLE IF EXISTS public.perguntas CASCADE;
DROP TABLE IF EXISTS public.fases CASCADE;
DROP TABLE IF EXISTS public.obras CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- 2. Tabela: Usuários (Estendendo auth.users)
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  telefone text,
  funcao text DEFAULT 'usuario', -- Ex: 'admin', 'mestre_obras', 'usuario'
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Tabela: Obras
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cliente text,
  mestre_obras_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text DEFAULT 'ativa', -- 'ativa', 'concluida', 'pausada'
  progresso_total numeric DEFAULT 0.0 CHECK (progresso_total >= 0 AND progresso_total <= 100),
  data_inicio date,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id)
);

-- 4. Tabela: Fases (20 por obra)
CREATE TABLE public.fases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1 AND ordem <= 20),
  status text DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluida', 'atrasada'
  progresso numeric DEFAULT 0.0 CHECK (progresso >= 0 AND progresso <= 100),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(obra_id, ordem)
);

-- 5. Tabela: Perguntas (2 por fase)
CREATE TABLE public.perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id uuid NOT NULL REFERENCES public.fases(id) ON DELETE CASCADE,
  texto_pergunta text NOT NULL,
  ordem integer NOT NULL CHECK (ordem >= 1 AND ordem <= 4),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(fase_id, ordem)
);

-- 6. Tabela: Respostas (Aceitam SIM ou NÃO)
CREATE TABLE public.respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fase_id uuid NOT NULL REFERENCES public.fases(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  resposta text NOT NULL CHECK (resposta IN ('SIM', 'NÃO')),
  observacao text,
  usuario_responsavel uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  data_resposta timestamp with time zone DEFAULT now()
);

-- 7. Tabela: Alertas
CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fase_id uuid REFERENCES public.fases(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- Ex: 'atraso', 'problema', 'critico'
  mensagem text NOT NULL,
  resolvido boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Tabela: Relatórios
CREATE TABLE public.relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- Ex: 'semanal', 'mensal', 'final'
  dados_json jsonb,
  url_arquivo text,
  gerado_por uuid REFERENCES public.usuarios(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Índices de Performance
CREATE INDEX idx_obras_mestre ON public.obras(mestre_obras_id);
CREATE INDEX idx_fases_obra ON public.fases(obra_id);
CREATE INDEX idx_perguntas_fase ON public.perguntas(fase_id);
CREATE INDEX idx_respostas_obra ON public.respostas(obra_id);
CREATE INDEX idx_respostas_fase ON public.respostas(fase_id);
CREATE INDEX idx_alertas_nao_resolvidos ON public.alertas(obra_id) WHERE resolvido = false;

-- 10. Funções e Triggers (Cálculo Automático)
CREATE OR REPLACE FUNCTION atualizar_progresso_fase_obra()
RETURNS TRIGGER AS $$
DECLARE
  v_progresso_fase numeric;
  v_progresso_obra numeric;
BEGIN
  -- Calcula progresso da fase (respostas 'SIM' valem 25% cada)
  SELECT COALESCE(SUM(CASE WHEN resposta = 'SIM' THEN 25 ELSE 0 END), 0)
  INTO v_progresso_fase
  FROM public.respostas
  WHERE fase_id = NEW.fase_id;

  IF v_progresso_fase > 100 THEN v_progresso_fase := 100; END IF;
  
  -- Atualiza fase
  UPDATE public.fases
  SET progresso = v_progresso_fase,
      status = CASE 
                 WHEN v_progresso_fase = 100 THEN 'concluida'
                 WHEN v_progresso_fase > 0 THEN 'em_andamento'
                 ELSE 'pendente'
               END
  WHERE id = NEW.fase_id;

  -- Calcula progresso da obra (média)
  SELECT COALESCE(AVG(progresso), 0)
  INTO v_progresso_obra
  FROM public.fases
  WHERE obra_id = NEW.obra_id;

  -- Atualiza obra
  UPDATE public.obras
  SET progresso_total = v_progresso_obra,
      status = CASE
                 WHEN v_progresso_obra = 100 THEN 'concluida'
                 ELSE 'ativa'
               END
  WHERE id = NEW.obra_id;

  -- Gera alerta automático em caso de 'NÃO'
  IF NEW.resposta = 'NÃO' THEN
    INSERT INTO public.alertas (obra_id, fase_id, tipo, mensagem)
    VALUES (NEW.obra_id, NEW.fase_id, 'atraso', 'Resposta NÃO recebida na fase. Alerta de possível atraso registrado.');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_progresso
AFTER INSERT OR UPDATE ON public.respostas
FOR EACH ROW
EXECUTE FUNCTION atualizar_progresso_fase_obra();

-- 11. Políticas RLS (Row Level Security)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (Exemplos base)
CREATE POLICY "Ler perfis" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Ler obras do usuário" ON public.obras FOR SELECT USING (auth.uid() = mestre_obras_id OR auth.uid() = created_by);
CREATE POLICY "Ler fases da obra acessível" ON public.fases FOR SELECT USING (obra_id IN (SELECT id FROM public.obras WHERE auth.uid() = mestre_obras_id OR auth.uid() = created_by));
CREATE POLICY "Ler perguntas" ON public.perguntas FOR SELECT USING (true);
CREATE POLICY "Acesso as respostas" ON public.respostas FOR SELECT USING (true);
CREATE POLICY "Ler alertas" ON public.alertas FOR SELECT USING (true);
CREATE POLICY "Ler relatorios" ON public.relatorios FOR SELECT USING (true);

-- 12. View para Status de Obra (Regra dos 60 dias)
CREATE OR REPLACE VIEW public.vw_status_obras AS
SELECT 
    o.id,
    o.nome,
    o.data_inicio,
    o.progresso_total,
    EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) as dias_decorridos,
    LEAST(100, ROUND((EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) / 60.0) * 100, 2)) as progresso_esperado,
    CASE 
        WHEN o.progresso_total < (EXTRACT(DAY FROM (now() - o.data_inicio::timestamp)) / 60.0) * 100 THEN 'atrasada'
        ELSE 'em_dia'
    END as status_prazo
FROM public.obras o;
