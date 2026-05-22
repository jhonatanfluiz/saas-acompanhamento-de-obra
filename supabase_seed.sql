-- Seed para Sistema SaaS de Acompanhamento de Obras
-- Cria um tenant padrão (empresa) e popula a base com dados iniciais de exemplo.

-- 1. Criação do Tenant (Empresa)
INSERT INTO public.tenants (id, name) 
VALUES ('d8be0c31-9e2e-4b47-a87f-3b7c8df0bcae', 'Construtora Alfa S.A.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Atualizar usuários e obras existentes sem tenant para usar o tenant padrão
UPDATE public.usuarios 
SET tenant_id = 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae' 
WHERE tenant_id IS NULL;

UPDATE public.obras 
SET tenant_id = 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae' 
WHERE tenant_id IS NULL;

-- 3. Criação de Fases e Perguntas de Exemplo para uma Obra específica
-- Nota: Para associar a uma obra real, substitua o ID abaixo pelo UUID da sua obra.
DO $$
DECLARE
    v_tenant_id uuid := 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae';
    v_obra_id uuid;
    v_fase_id uuid;
    v_mestre_id uuid;
BEGIN
    -- Obter um mestre de obras cadastrado se existir, ou usar NULL
    SELECT id INTO v_mestre_id FROM public.usuarios WHERE funcao = 'mestre_obras' OR funcao = 'usuario' LIMIT 1;

    -- Se não houver obra cadastrada, cria uma obra padrão para teste
    SELECT id INTO v_obra_id FROM public.obras LIMIT 1;
    
    IF v_obra_id IS NULL THEN
        INSERT INTO public.obras (
            id, nome, descricao, cliente, status, progresso_total, 
            data_inicio, data_entrega_prevista, orcamento_total, 
            manager_name, manager_phone, custom_greeting, tenant_id
        ) VALUES (
            'a8be0c31-9e2e-4b47-a87f-3b7c8df0bcad',
            'Residencial Vista Alegre',
            'Construção de edifício residencial de 12 andares',
            'Alfa Empreendimentos',
            'ativa',
            0.0,
            CURRENT_DATE - 30, -- Iniciada há 30 dias
            CURRENT_DATE + 30, -- Entrega em 30 dias (total 60 dias)
            1500000.00,
            'Divanil Encarregado',
            '5511999999999',
            'Olá, [mestre]! Tudo bem? Como está o andamento do [obra]?',
            v_tenant_id
        ) RETURNING id INTO v_obra_id;
    END IF;

    -- Garantir que as fases não sejam duplicadas para a obra selecionada
    IF NOT EXISTS (SELECT 1 FROM public.fases WHERE obra_id = v_obra_id LIMIT 1) THEN
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
    END IF;

END $$;
