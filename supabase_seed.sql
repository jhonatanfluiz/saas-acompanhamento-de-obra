-- Seed para 20 Fases Padrão de Montagem de Elevadores
-- Este script assume que você já tem uma obra criada e quer popular suas fases e perguntas.

-- 1. Fases
-- Nota: Você deve substituir 'ID_DA_OBRA_AQUI' pelo UUID da sua obra.

DO $$
DECLARE
    v_obra_id uuid := 'ID_DA_OBRA_AQUI'; -- SUBSTITUA ESTE ID
    v_fase_id uuid;
BEGIN
    -- FASE 1: Medição Técnica
    INSERT INTO public.fases (obra_id, nome, ordem) VALUES (v_obra_id, 'Medição Técnica', 1) RETURNING id INTO v_fase_id;
    INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem) VALUES 
    (v_fase_id, 'Poço está conforme projeto?', 1),
    (v_fase_id, 'Ganchos de içamento instalados?', 2),
    (v_fase_id, 'Iluminação do poço operacional?', 3),
    (v_fase_id, 'Energia de força disponível?', 4);

    -- FASE 2: Entrega de Materiais
    INSERT INTO public.fases (obra_id, nome, ordem) VALUES (v_obra_id, 'Entrega de Materiais', 2) RETURNING id INTO v_fase_id;
    INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem) VALUES 
    (v_fase_id, 'Materiais conferidos?', 1),
    (v_fase_id, 'Área de estoque segura?', 2),
    (v_fase_id, 'Trilhos no local?', 3),
    (v_fase_id, 'Máquina de tração entregue?', 4);

    -- FASE 3: Instalação de Trilhos
    INSERT INTO public.fases (obra_id, nome, ordem) VALUES (v_obra_id, 'Instalação de Trilhos', 3) RETURNING id INTO v_fase_id;
    INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem) VALUES 
    (v_fase_id, 'Suportes de trilhos instalados?', 1),
    (v_fase_id, 'Trilhos da cabine aprumados?', 2),
    (v_fase_id, 'Trilhos do contrapeso alinhados?', 3),
    (v_fase_id, 'Fixação final concluída?', 4);

    -- FASE 4: Montagem da Cabine
    INSERT INTO public.fases (obra_id, nome, ordem) VALUES (v_obra_id, 'Montagem da Cabine', 4) RETURNING id INTO v_fase_id;
    INSERT INTO public.perguntas (fase_id, texto_pergunta, ordem) VALUES 
    (v_fase_id, 'Armação da cabine montada?', 1),
    (v_fase_id, 'Piso e teto instalados?', 2),
    (v_fase_id, 'Painéis laterais fixados?', 3),
    (v_fase_id, 'Operador de porta instalado?', 4);

    -- ... Adicionar as outras fases conforme necessário ...
    -- FASE 5: Instalação de Portas de Pavimento
    -- FASE 6: Fiação de Poço
    -- FASE 7: Quadro de Comando
    -- FASE 8: Limites e Sensores
    -- FASE 9: Cabos de Tração
    -- FASE 10: Contrapeso e Peso de Teste
    -- FASE 11: Iluminação de Cabine
    -- FASE 12: Botoeiras de Pavimento
    -- FASE 13: Ajuste de Nivelamento
    -- FASE 14: Teste de Segurança (Para-quedas)
    -- FASE 15: Acabamentos Estéticos
    -- FASE 16: Intercomunicador e Emergência
    -- FASE 17: Inspeção Prévia
    -- FASE 18: Limpeza Final da Obra
    -- FASE 19: Teste de Carga
    -- FASE 20: Entrega e Treinamento

END $$;
