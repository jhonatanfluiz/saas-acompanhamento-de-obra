-- EXECUTE ESTE SQL NO EDITOR SQL DO SEU PAINEL DO SUPABASE
-- Ele atualizará a trigger de atualização de progresso para suportar checklists de 2 perguntas de SIM/NÃO sem dar erros.

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
