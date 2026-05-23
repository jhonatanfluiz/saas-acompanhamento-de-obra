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
        v_obra_id := public.criar_obra_completa(
            'Residencial Vista Alegre',
            'Divanil Encarregado',
            '5511999999999',
            'Olá, [mestre]! Tudo bem? Como está o andamento do [obra]?',
            CURRENT_DATE - 30,
            CURRENT_DATE + 30
        );
    ELSE
        -- Garantir que as fases não sejam duplicadas para a obra selecionada
        IF NOT EXISTS (SELECT 1 FROM public.fases WHERE obra_id = v_obra_id LIMIT 1) THEN
            -- Se a obra existe mas não tem fases, excluímos e recriamos com as 20 fases padrão
            DELETE FROM public.obras WHERE id = v_obra_id;
            
            v_obra_id := public.criar_obra_completa(
                'Residencial Vista Alegre',
                'Divanil Encarregado',
                '5511999999999',
                'Olá, [mestre]! Tudo bem? Como está o andamento do [obra]?',
                CURRENT_DATE - 30,
                CURRENT_DATE + 30
            );
    END IF;

END $$;

-- 4. Criação do Checklist Padrão (Template)
DO $$
DECLARE
    v_tenant_id uuid := 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae';
    v_checklist_id uuid;
    v_checklist_fase_id uuid;
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
    i integer;
BEGIN
    -- Inserir Checklist se não existir
    SELECT id INTO v_checklist_id FROM public.checklists WHERE nome = 'Montagem Padrão de Elevadores' AND tenant_id = v_tenant_id LIMIT 1;
    
    IF v_checklist_id IS NULL THEN
        INSERT INTO public.checklists (nome, descricao, tenant_id)
        VALUES ('Montagem Padrão de Elevadores', 'Template padrão contendo 20 fases críticas para instalação de elevadores comerciais/residenciais.', v_tenant_id)
        RETURNING id INTO v_checklist_id;
        
        -- Inserir as fases e perguntas padrão do template
        FOR i IN 1..20 LOOP
            INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
            VALUES (v_checklist_id, v_fases_templates[i], i)
            RETURNING id INTO v_checklist_fase_id;
            
            INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem)
            VALUES 
                (v_checklist_fase_id, 'Executado?', 1),
                (v_checklist_fase_id, 'Qual o percentual executado?', 2);
        END LOOP;
    END IF;
END $$;

-- 5. Criação do Novo Checklist Semanal de Obras (9 Etapas - 180 Perguntas)
DO $$
DECLARE
    v_tenant_id uuid := 'd8be0c31-9e2e-4b47-a87f-3b7c8df0bcae';
    v_checklist_id uuid;
    v_fase_id uuid;
BEGIN
    SELECT id INTO v_checklist_id FROM public.checklists WHERE nome = 'Acompanhamento Semanal de Obras' AND tenant_id = v_tenant_id LIMIT 1;
    
    IF v_checklist_id IS NULL THEN
        INSERT INTO public.checklists (nome, descricao, tenant_id)
        VALUES ('Acompanhamento Semanal de Obras', 'Checklist semanal completo de 9 etapas (Infraestrutura, Elétrica, Hidráulica, Elevadores, Acabamentos, Segurança, Planejamento, Qualidade e Pendências) com 20 perguntas ponderadas por etapa.', v_tenant_id)
        RETURNING id INTO v_checklist_id;
        
        -- Fase 1: Infraestrutura (INF)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Infraestrutura', 1) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'A prumada do poço do elevador foi verificada e liberada?', 1, 3, 'INF-01'),
        (v_fase_id, 'O piso do poço do elevador está impermeabilizado e seco?', 2, 3, 'INF-02'),
        (v_fase_id, 'As vigas divisórias de caixa (passadiço) estão instaladas?', 3, 3, 'INF-03'),
        (v_fase_id, 'Os suportes das guias foram fixados de acordo com o projeto estrutural?', 4, 3, 'INF-04'),
        (v_fase_id, 'A fixação dos chumbadores das guias foi concluída e testada?', 5, 3, 'INF-05'),
        (v_fase_id, 'A casa de máquinas possui ventilação adequada e iluminação instalada?', 6, 2, 'INF-06'),
        (v_fase_id, 'A porta de acesso à casa de máquinas é metálica e possui fechadura funcional?', 7, 2, 'INF-07'),
        (v_fase_id, 'O poço do elevador possui escada marinheiro instalada?', 8, 2, 'INF-08'),
        (v_fase_id, 'A drenagem do poço está funcionando e sem acúmulo de água?', 9, 3, 'INF-09'),
        (v_fase_id, 'Os andaimes e proteções de periferia nos vãos das portas estão instalados?', 10, 3, 'INF-10'),
        (v_fase_id, 'A estrutura metálica da caixa (se aplicável) foi pintada com primer anticorrosivo?', 11, 2, 'INF-11'),
        (v_fase_id, 'A soleira de cada pavimento está nivelada e chumbada?', 12, 3, 'INF-12'),
        (v_fase_id, 'A alvenaria ao redor dos batentes das portas está finalizada?', 13, 2, 'INF-13'),
        (v_fase_id, 'O teto da caixa possui gancho de içamento homologado e testado?', 14, 3, 'INF-14'),
        (v_fase_id, 'O piso da casa de máquinas está regularizado e pintado?', 15, 1, 'INF-15'),
        (v_fase_id, 'A área de estocagem de materiais de elevadores está limpa e seca?', 16, 2, 'INF-16'),
        (v_fase_id, 'As passagens de cabos entre caixa e casa de máquinas estão desobstruídas?', 17, 2, 'INF-17'),
        (v_fase_id, 'O poço está livre de detritos e entulhos de obra?', 18, 2, 'INF-18'),
        (v_fase_id, 'A fixação mecânica da base da máquina de tração foi inspecionada?', 19, 3, 'INF-19'),
        (v_fase_id, 'O aterramento estrutural da caixa do elevador foi interligado?', 20, 3, 'INF-20');

        -- Fase 2: Elétrica (ELE)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Elétrica', 2) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'O quadro de força exclusivo para os elevadores está instalado e energizado?', 1, 3, 'ELE-01'),
        (v_fase_id, 'A tensão de alimentação trifásica está dentro dos limites especificados?', 2, 3, 'ELE-02'),
        (v_fase_id, 'Os disjuntores de força e iluminação da cabine estão identificados?', 3, 2, 'ELE-03'),
        (v_fase_id, 'Os cabos de alimentação trifásica possuem a seção correta conforme projeto?', 4, 3, 'ELE-04'),
        (v_fase_id, 'A iluminação temporária ou definitiva do poço está funcionando?', 5, 2, 'ELE-05'),
        (v_fase_id, 'As tomadas no poço e na casa de máquinas estão instaladas e ativas?', 6, 1, 'ELE-06'),
        (v_fase_id, 'A fiação dos limites de fim de curso na caixa foi instalada?', 7, 3, 'ELE-07'),
        (v_fase_id, 'O cabo de manobra da cabine (chicote flexível) está pendurado sem torções?', 8, 3, 'ELE-08'),
        (v_fase_id, 'A ligação da botoeira de inspeção no topo da cabine foi testada?', 9, 3, 'ELE-09'),
        (v_fase_id, 'O quadro de comando está devidamente fixado na parede ou piso?', 10, 2, 'ELE-10'),
        (v_fase_id, 'A fiação do motor da máquina de tração está conectada ao inversor?', 11, 3, 'ELE-11'),
        (v_fase_id, 'A fiação do freio magnético da máquina foi concluída?', 12, 3, 'ELE-12'),
        (v_fase_id, 'Os sensores de nivelamento e parada nos pavimentos estão ligados?', 13, 3, 'ELE-13'),
        (v_fase_id, 'O aterramento elétrico do quadro e da carcaça do motor foi testado?', 14, 3, 'ELE-14'),
        (v_fase_id, 'A fiação do operador de portas da cabine está interligada?', 15, 3, 'ELE-15'),
        (v_fase_id, 'Os cabos de sinalização das botoeiras de pavimento estão passados?', 16, 2, 'ELE-16'),
        (v_fase_id, 'O sistema de interfone e alarme de emergência está cabeado?', 17, 2, 'ELE-17'),
        (v_fase_id, 'O DPS (Dispositivo de Proteção contra Surtos) está instalado no quadro?', 18, 2, 'ELE-18'),
        (v_fase_id, 'A iluminação de emergência da casa de máquinas está operacional?', 19, 2, 'ELE-19'),
        (v_fase_id, 'O chicote elétrico da cabine está conectado à caixa de junção?', 20, 3, 'ELE-20');

        -- Fase 3: Hidráulica (HID)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Hidráulica', 3) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'O dreno do poço está conectado à rede de águas pluviais ou esgoto?', 1, 2, 'HID-01'),
        (v_fase_id, 'A bomba de poço (se houver) está instalada e testada no automático?', 2, 3, 'HID-02'),
        (v_fase_id, 'Há proteção contra refluxo de água no poço do elevador?', 3, 2, 'HID-03'),
        (v_fase_id, '(Para Elevadores Hidráulicos) O pistão hidráulico foi aprumado e fixado?', 4, 3, 'HID-04'),
        (v_fase_id, 'A central hidráulica (bomba, motor e reservatório) está posicionada?', 5, 3, 'HID-05'),
        (v_fase_id, 'As tubulações de óleo de alta pressão foram conectadas e apertadas?', 6, 3, 'HID-06'),
        (v_fase_id, 'O óleo hidráulico específico foi colocado no reservatório no nível correto?', 7, 3, 'HID-07'),
        (v_fase_id, 'O sistema hidráulico foi pressurizado para verificação de vazamentos?', 8, 3, 'HID-08'),
        (v_fase_id, 'A válvula de alívio e sobrepressão foi calibrada?', 9, 3, 'HID-09'),
        (v_fase_id, 'Os silenciadores da linha de óleo estão instalados?', 10, 1, 'HID-10'),
        (v_fase_id, 'A tubulação de PVC de drenagem de óleo residual está conectada?', 11, 2, 'HID-11'),
        (v_fase_id, 'O registro de corte de fluxo (válvula esfera) está operacional?', 12, 2, 'HID-12'),
        (v_fase_id, 'A canaleta de contenção de óleo na casa de máquinas está limpa?', 13, 2, 'HID-13'),
        (v_fase_id, 'O trocador de calor ou aquecedor de óleo (se houver) está ligado?', 14, 2, 'HID-14'),
        (v_fase_id, 'O respiro do reservatório de óleo está desobstruído?', 15, 1, 'HID-15'),
        (v_fase_id, 'A tubulação externa de água da obra está afastada da projeção do elevador?', 16, 3, 'HID-16'),
        (v_fase_id, 'O reservatório de óleo está aterrado contra eletricidade estática?', 17, 2, 'HID-17'),
        (v_fase_id, 'O manômetro de pressão de trabalho está calibrado e visível?', 18, 2, 'HID-18'),
        (v_fase_id, 'A vedação dos anéis O-ring das conexões hidráulicas foi inspecionada?', 19, 3, 'HID-19'),
        (v_fase_id, 'O dreno de condensado do ar-condicionado da cabine foi direcionado?', 20, 2, 'HID-20');

        -- Fase 4: Elevadores (ELV)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Elevadores', 4) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'A máquina de tração foi fixada e alinhada na base metálica?', 1, 3, 'ELV-01'),
        (v_fase_id, 'O cabo de aço de tração foi passado pelas polias e fixado nos terminais?', 2, 3, 'ELV-02'),
        (v_fase_id, 'Os clipes de fixação dos cabos de aço (clips/soquetes) estão torqueados?', 3, 3, 'ELV-03'),
        (v_fase_id, 'O limitador de velocidade está instalado e alinhado com o cabo de segurança?', 4, 3, 'ELV-04'),
        (v_fase_id, 'O cabo de aço do limitador de velocidade foi tensionado no poço?', 5, 3, 'ELV-05'),
        (v_fase_id, 'O chassi da cabine (arcada) está montado e nivelado?', 6, 3, 'ELV-06'),
        (v_fase_id, 'O chassi do contrapeso está montado e com as guias de borracha fixadas?', 7, 3, 'ELV-07'),
        (v_fase_id, 'Os blocos de contrapeso foram inseridos e travados na grade?', 8, 3, 'ELV-08'),
        (v_fase_id, 'Os patins (corrediças/guias) da cabine e contrapeso estão ajustados?', 9, 3, 'ELV-09'),
        (v_fase_id, 'O freio de segurança (freio de cunha) da cabine foi montado e regulado?', 10, 3, 'ELV-10'),
        (v_fase_id, 'Os amortecedores de impacto (para-choques) do poço estão fixados?', 11, 3, 'ELV-11'),
        (v_fase_id, 'A cabine foi montada (piso, painéis laterais, teto)?', 12, 3, 'ELV-12'),
        (v_fase_id, 'O operador de porta da cabine está fixado e regulado mecanicamente?', 13, 3, 'ELV-13'),
        (v_fase_id, 'As portas da cabine correm suavemente sem atrito excessivo?', 14, 2, 'ELV-14'),
        (v_fase_id, 'As portas de pavimento estão instaladas e alinhadas com a soleira?', 15, 3, 'ELV-15'),
        (v_fase_id, 'Os contatos elétricos de segurança das portas de pavimento foram testados?', 16, 3, 'ELV-16'),
        (v_fase_id, 'As travas mecânicas das portas de pavimento (trincos) funcionam?', 17, 3, 'ELV-17'),
        (v_fase_id, 'O sistema de resgate automático de passageiros (UPS/nobreak) está ativo?', 18, 2, 'ELV-18'),
        (v_fase_id, 'O codificador (encoder) do motor da máquina está acoplado?', 19, 3, 'ELV-19'),
        (v_fase_id, 'O alinhamento vertical geral das guias foi validado com gabarito?', 20, 3, 'ELV-20');

        -- Fase 5: Acabamentos (ACA)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Acabamentos', 5) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'O piso interno da cabine (granito, vinílico ou chapa) está assentado?', 1, 2, 'ACA-01'),
        (v_fase_id, 'O revestimento de aço inox da cabine está sem riscos e protegido?', 2, 2, 'ACA-02'),
        (v_fase_id, 'O espelho interno da cabine está instalado e sem trincas?', 3, 1, 'ACA-03'),
        (v_fase_id, 'O corrimão interno da cabine está fixado com rigidez?', 4, 1, 'ACA-04'),
        (v_fase_id, 'O subteto decorativo e as lâmpadas de LED da cabine estão funcionando?', 5, 2, 'ACA-05'),
        (v_fase_id, 'As molduras das botoeiras de cabine e pavimento estão alinhadas?', 6, 1, 'ACA-06'),
        (v_fase_id, 'A pintura das portas de pavimento (se não forem inox) está concluída?', 7, 1, 'ACA-07'),
        (v_fase_id, 'A soleira foi polida e está livre de respingos de cimento?', 8, 2, 'ACA-08'),
        (v_fase_id, 'O acabado de gesso ou alvenaria ao redor do portal foi finalizado?', 9, 2, 'ACA-09'),
        (v_fase_id, 'Os rodapés internos da cabine estão bem ajustados?', 10, 1, 'ACA-10'),
        (v_fase_id, 'O teto da cabine está limpo e sem rebarbas metálicas?', 11, 1, 'ACA-11'),
        (v_fase_id, 'A sinalização visual de numeração dos andares está colada?', 12, 1, 'ACA-12'),
        (v_fase_id, 'O ventilador da cabine está operacional e sem ruídos estranhos?', 13, 2, 'ACA-13'),
        (v_fase_id, 'As películas protetoras das chapas de inox foram removidas (se finalizado)?', 14, 1, 'ACA-14'),
        (v_fase_id, 'A casa de máquinas está limpa, varrida e sem poeira em suspensão?', 15, 2, 'ACA-15'),
        (v_fase_id, 'A pintura do piso da casa de máquinas com tinta epóxi está seca?', 16, 2, 'ACA-16'),
        (v_fase_id, 'As guias metálicas foram limpas e lubrificadas com óleo adequado?', 17, 2, 'ACA-17'),
        (v_fase_id, 'O teto do poço foi pintado ou limpo?', 18, 1, 'ACA-18'),
        (v_fase_id, 'A cabine está limpa e aspirada para a entrega técnica?', 19, 2, 'ACA-19'),
        (v_fase_id, 'O protetor acolchoado de cabine (para mudanças) foi fornecido?', 20, 1, 'ACA-20');

        -- Fase 6: Segurança (SEG)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Segurança', 6) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'O botão de emergência (pare) no poço desliga o circuito de comando?', 1, 3, 'SEG-01'),
        (v_fase_id, 'O botão de emergência no topo da cabine está operacional?', 2, 3, 'SEG-02'),
        (v_fase_id, 'O guarda-corpo no topo da cabine está instalado e firme?', 3, 3, 'SEG-03'),
        (v_fase_id, 'Os EPIs obrigatórios (cinto de segurança, capacete, bota) estão em uso?', 4, 3, 'SEG-04'),
        (v_fase_id, 'A linha de vida ou ponto de ancoragem no poço está disponível?', 5, 3, 'SEG-05'),
        (v_fase_id, 'A sinalização de advertência na porta da casa de máquinas está fixada?', 6, 2, 'SEG-06'),
        (v_fase_id, 'As telas de proteção de polias e partes giratórias estão instaladas?', 7, 3, 'SEG-07'),
        (v_fase_id, 'O extintor de incêndio na casa de máquinas está dentro da validade?', 8, 3, 'SEG-08'),
        (v_fase_id, 'A barreira infravermelha (sensor de porta) reabre a porta ao detectar obstáculo?', 9, 3, 'SEG-09'),
        (v_fase_id, 'O botão de reabertura de portas na botoeira funciona corretamente?', 10, 3, 'SEG-10'),
        (v_fase_id, 'O contato mecânico do trinco da porta de pavimento impede partida se aberto?', 11, 3, 'SEG-11'),
        (v_fase_id, 'A chave de emergência para abertura manual da porta de pavimento está no local?', 12, 3, 'SEG-12'),
        (v_fase_id, 'O interruptor do alarme de emergência na cabine está funcional?', 13, 3, 'SEG-13'),
        (v_fase_id, 'O sensor de sobrecarga da cabine impede a partida com peso excessivo?', 14, 3, 'SEG-14'),
        (v_fase_id, 'Os blocos de segurança contra queda livre no limitador foram testados?', 15, 3, 'SEG-15'),
        (v_fase_id, 'A iluminação de emergência da cabine acende em falta de energia?', 16, 3, 'SEG-16'),
        (v_fase_id, 'As travas mecânicas das portas de poço estão operacionais?', 17, 3, 'SEG-17'),
        (v_fase_id, 'A aterramento de todas as partes metálicas expostas está funcional?', 18, 3, 'SEG-18'),
        (v_fase_id, 'A área de trabalho está isolada com tapumes e placas de "Elevador em Montagem"?', 19, 3, 'SEG-19'),
        (v_fase_id, 'O plano de resgate rápido está afixado na parede da casa de máquinas?', 20, 2, 'SEG-20');

        -- Fase 7: Planejamento (PLA)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Planejamento', 7) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'O cronograma de montagem física está atualizado e no local da obra?', 1, 2, 'PLA-01'),
        (v_fase_id, 'O diário de obra está sendo preenchido diariamente pelo supervisor?', 2, 2, 'PLA-02'),
        (v_fase_id, 'Os materiais importados ou críticos já estão em estoque na obra?', 3, 3, 'PLA-03'),
        (v_fase_id, 'A equipe está dimensionada corretamente de acordo com o planejado?', 4, 2, 'PLA-04'),
        (v_fase_id, 'As datas de entrega das interfaces da construtora estão alinhadas?', 5, 2, 'PLA-05'),
        (v_fase_id, 'As medições de avanço físico foram enviadas para faturamento?', 6, 2, 'PLA-06'),
        (v_fase_id, 'A vistoria de pré-requisitos com a construtora foi assinada?', 7, 2, 'PLA-07'),
        (v_fase_id, 'Há previsão de interrupção de montagem por falta de frente de trabalho?', 8, 3, 'PLA-08'),
        (v_fase_id, 'O cronograma de testes finais foi combinado com a fiscalização?', 9, 2, 'PLA-09'),
        (v_fase_id, 'Os desenhos "As-Built" elétricos e mecânicos estão em andamento?', 10, 1, 'PLA-10'),
        (v_fase_id, 'A ART (Anotação de Responsabilidade Técnica) do engenheiro foi emitida?', 11, 3, 'PLA-11'),
        (v_fase_id, 'A programação de vistorias dos órgãos municipais está agendada?', 12, 2, 'PLA-12'),
        (v_fase_id, 'A data de entrega técnica foi validada com o gerente do contrato?', 13, 2, 'PLA-13'),
        (v_fase_id, 'O plano de contingência para atraso de materiais foi elaborado?', 14, 2, 'PLA-14'),
        (v_fase_id, 'As reuniões de coordenação semanais com a construtora foram mantidas?', 15, 1, 'PLA-15'),
        (v_fase_id, 'A inspeção preliminar de segurança da obra foi registrada?', 16, 2, 'PLA-16'),
        (v_fase_id, 'O cronograma de entrega das chaves da obra está definido?', 17, 1, 'PLA-17'),
        (v_fase_id, 'O plano de recebimento de cargas pesadas (maquinário) foi executado?', 18, 2, 'PLA-18'),
        (v_fase_id, 'A liberação de horas extras para aceleração da obra foi aprovada?', 19, 2, 'PLA-19'),
        (v_fase_id, 'O relatório mensal de progresso físico foi validado pelo cliente?', 20, 2, 'PLA-20');

        -- Fase 8: Qualidade (QUA)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Qualidade', 8) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'A folga entre a cabine e as portas de pavimento está em 4mm (+-1)?', 1, 3, 'QUA-01'),
        (v_fase_id, 'O nivelamento da cabine nos andares está com precisão de +-2mm?', 2, 3, 'QUA-02'),
        (v_fase_id, 'O ruído interno da cabine em movimento está abaixo de 50 dB(A)?', 3, 2, 'QUA-03'),
        (v_fase_id, 'A aceleração e desaceleração estão suaves sem solavancos (conforto)?', 4, 3, 'QUA-04'),
        (v_fase_id, 'As guias foram alinhadas com fio de prumo laser com tolerância de 0,5mm?', 5, 3, 'QUA-05'),
        (v_fase_id, 'O aperto dos parafusos estruturais foi inspecionado com torquímetro?', 6, 3, 'QUA-06'),
        (v_fase_id, 'A pintura e acabamento das partes metálicas do elevador estão sem falhas?', 7, 1, 'QUA-07'),
        (v_fase_id, 'A tensão dos cabos de tração está equalizada entre todos os cabos?', 8, 3, 'QUA-08'),
        (v_fase_id, 'A temperatura da máquina de tração após 1h de operação está normal?', 9, 2, 'QUA-09'),
        (v_fase_id, 'Os sensores de portas estão limpos e sem poeira acumulada?', 10, 2, 'QUA-10'),
        (v_fase_id, 'A lubrificação dos patins foi feita com óleo de viscosidade correta?', 11, 2, 'QUA-11'),
        (v_fase_id, 'A tensão das correias do operador de portas está ajustada?', 12, 2, 'QUA-12'),
        (v_fase_id, 'A vedação da cabine contra ruídos da caixa de corrida foi verificada?', 13, 2, 'QUA-13'),
        (v_fase_id, 'O painel de comando foi aspirado para remoção de poeira metálica?', 14, 3, 'QUA-14'),
        (v_fase_id, 'Os certificados de calibração dos instrumentos de medição estão válidos?', 15, 2, 'QUA-15'),
        (v_fase_id, 'A isolação elétrica dos enrolamentos do motor foi testada (megômetro)?', 16, 3, 'QUA-16'),
        (v_fase_id, 'O alinhamento da polia de tração com a polia de desvio está correto?', 17, 3, 'QUA-17'),
        (v_fase_id, 'O funcionamento dos coolers de ventilação do comando foi checado?', 18, 2, 'QUA-18'),
        (v_fase_id, 'A folga entre o contrapeso e o para-choque em repouso está correta?', 19, 3, 'QUA-19'),
        (v_fase_id, 'O relatório final de comissionamento de qualidade foi emitido e assinado?', 20, 3, 'QUA-20');

        -- Fase 9: Pendências (PEN)
        INSERT INTO public.checklist_fases (checklist_id, nome, ordem)
        VALUES (v_checklist_id, 'Pendências', 9) RETURNING id INTO v_fase_id;
        
        INSERT INTO public.checklist_perguntas (checklist_fase_id, texto_pergunta, ordem, peso, identificador_unico) VALUES
        (v_fase_id, 'A construtora concluiu o fechamento dos vãos das portas de pavimento?', 1, 3, 'PEN-01'),
        (v_fase_id, 'A construtora limpou a caixa de corrida e removeu entulhos do poço?', 2, 3, 'PEN-02'),
        (v_fase_id, 'A construtora entregou a linha telefônica / ponto de dados no comando?', 3, 2, 'PEN-03'),
        (v_fase_id, 'A construtora finalizou a pintura do portal dos elevadores?', 4, 1, 'PEN-04'),
        (v_fase_id, 'A construtora instalou a tomada de força de 220V e 110V na casa de máquinas?', 5, 2, 'PEN-05'),
        (v_fase_id, 'A fresta entre a soleira do elevador e o piso acabado foi rejuntada?', 6, 2, 'PEN-06'),
        (v_fase_id, 'A construtora liberou a área para armazenamento de resíduos no térreo?', 7, 1, 'PEN-07'),
        (v_fase_id, 'A construtora eliminou vazamentos de água na laje da casa de máquinas?', 8, 3, 'PEN-08'),
        (v_fase_id, 'A construtora instalou o corrimão de acesso seguro na casa de máquinas?', 9, 2, 'PEN-09'),
        (v_fase_id, 'A construtora forneceu a iluminação de patamar externa regulamentar?', 10, 2, 'PEN-10'),
        (v_fase_id, 'A construtora disponibilizou energia definitiva para os testes finais?', 11, 3, 'PEN-11'),
        (v_fase_id, 'A construtora retirou a proteção de madeira das soleiras?', 12, 1, 'PEN-12'),
        (v_fase_id, 'A construtora concluiu a regularização da parede interna da caixa?', 13, 2, 'PEN-13'),
        (v_fase_id, 'A equipe de montagem resolveu todas as não-conformidades de qualidade?', 14, 3, 'PEN-14'),
        (v_fase_id, 'Os testes de estanqueidade hidráulica do poço foram validados?', 15, 2, 'PEN-15'),
        (v_fase_id, 'A construtora assinou o termo de guarda e responsabilidade da cabine?', 16, 2, 'PEN-16'),
        (v_fase_id, 'As chaves da porta de inspeção do poço foram entregues à portaria?', 17, 1, 'PEN-17'),
        (v_fase_id, 'O manual do usuário e do condomínio está impresso e pronto?', 18, 2, 'PEN-18'),
        (v_fase_id, 'O certificado de garantia dos equipamentos foi emitido?', 19, 2, 'PEN-19'),
        (v_fase_id, 'O checklist de pré-entrega foi assinado pelo supervisor e engenheiro?', 20, 3, 'PEN-20');
    END IF;
END $$;
