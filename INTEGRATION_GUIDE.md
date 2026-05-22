# Guia de Integração WhatsApp & Evolution API (SaaS Obras)

Este guia apresenta todas as instruções necessárias para colocar a integração do seu sistema de acompanhamento de obras com o WhatsApp em produção utilizando a **Evolution API (gratuita)**, **Docker**, **Railway**, **Supabase** e **n8n**.

---

## 1. Estrutura da Integração (Arquitetura)

A arquitetura de integração de mensagens opera de forma cíclica e reativa:

```mermaid
graph TD
    A[n8n / Cron Job] -- 1. Dispara envio de pergunta --> B[Evolution API]
    B -- 2. Envia mensagem via WhatsApp --> C[Mestre de Obras / Encarregado]
    C -- 3. Responde (SIM, NÃO, 50%) --> B
    B -- 4. Encaminha evento messages.upsert --> D[Webhook Next.js API]
    D -- 5. Valida e normaliza resposta --> E[Supabase DB]
    E -- 6. Trigger recalcula progresso da fase/obra --> F[Dashboard Atualizado em Tempo Real]
```

---

## 2. Instalação da Evolution API via Docker

Para rodar a Evolution API localmente ou em uma VPS de maneira isolada e performática com cache em Redis, utilize o arquivo `docker-compose.yml` disponível na raiz do projeto:

```bash
# Para iniciar os containers em segundo plano:
docker compose up -d
```

### Principais configurações do `docker-compose.yml`:
* **Evolution API**: Porta `8080` expositada.
* **Redis**: Serviço auxiliar para cache de conexões e instâncias, aumentando drasticamente a estabilidade.
* **Chave de API (`API_KEY`)**: Definida como `sua_apikey_da_evolution`. Todas as requisições para a Evolution API precisam passar essa chave no cabeçalho HTTP `apikey`.

---

## 3. Configuração de Hospedagem no Railway

Caso queira hospedar a **Evolution API** no Railway para produção:

1. Acesse o painel do [Railway](https://railway.app) e crie um novo projeto.
2. Escolha **Deploy from a GitHub Repo** ou adicione um container a partir da imagem do Docker Hub `atendare/evolution-api:latest`.
3. Adicione um banco Redis no mesmo projeto.
4. Configure as seguintes variáveis de ambiente no serviço da Evolution API no Railway:
   * `SERVER_PORT` = `8080`
   * `SERVER_URL` = `https://seu-servico-evolution.up.railway.app` (gerado automaticamente pelo Railway)
   * `API_KEY` = `sua-chave-secreta-forte`
   * `REDIS_ENABLED` = `true`
   * `REDIS_URI` = `redis://default:senha@redis-host:porta` (utilize a variável de conexão automática do Redis fornecida pelo Railway, ex: `${{Redis.REDIS_URL}}`)
5. Clique em Deploy. A API estará disponível publicamente na URL gerada.

---

## 4. Gerenciamento de Instâncias e QR Code

A Evolution API permite gerenciar múltiplas conexões do WhatsApp através de **Instâncias**. Cada empresa (tenant) pode ter sua própria instância, viabilizando o modelo SaaS multi-empresa.

### 4.1. Criar uma Instância
Faça uma requisição `POST` para criar a instância que enviará/receberá as mensagens:

* **Endpoint**: `POST {{EVOLUTION_API_URL}}/instance/create`
* **Headers**:
  * `Content-Type: application/json`
  * `apikey: {{EVOLUTION_API_KEY}}`
* **Body**:
```json
{
  "instanceName": "instancia_teste",
  "token": "token_secreto_opcional",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS"
}
```

### 4.2. Gerar QR Code para Conectar o WhatsApp
Após criar a instância, você precisará ler o QR Code com o aplicativo do WhatsApp do celular:

* **Endpoint**: `GET {{EVOLUTION_API_URL}}/instance/connect/instancia_teste`
* **Headers**:
  * `apikey: {{EVOLUTION_API_KEY}}`
* **Retorno**: A API retornará uma imagem em Base64 do QR Code para renderização no painel administrativo do seu SaaS ou exibição no terminal. Basta escanear pelo WhatsApp em "Aparelhos conectados" -> "Conectar um aparelho".

---

## 5. Como Enviar e Receber Mensagens (Webhooks)

### 5.1. Enviar Mensagens
Para disparar mensagens de forma ativa (ex: através do cron job semanal):

* **Endpoint**: `POST {{EVOLUTION_API_URL}}/message/sendText/instancia_teste`
* **Headers**:
  * `Content-Type: application/json`
  * `apikey: {{EVOLUTION_API_KEY}}`
* **Body**:
```json
{
  "number": "5511999999999",
  "text": "Olá Mestre! Como está a fase de Instalação de Trilhos?\n\nResponda com SIM, NÃO ou o avanço estimado (25%, 50%, 75% ou 100%)."
}
```

### 5.2. Configurar o Webhook de Entrada
Para receber as respostas dos mestres de obras, você deve registrar um webhook apontando para o seu backend.

* **Endpoint para cadastrar Webhook**: `POST {{EVOLUTION_API_URL}}/webhook/set/instancia_teste`
* **Headers**:
  * `Content-Type: application/json`
  * `apikey: {{EVOLUTION_API_KEY}}`
* **Body**:
```json
{
  "enabled": true,
  "url": "https://seu-saas-obras.vercel.app/api/webhook/whatsapp",
  "events": [
    "messages.upsert"
  ]
}
```

---

## 6. Fluxo n8n de Automação

O arquivo `n8n_full_automation.json` na raiz contém a especificação pronta de um fluxo visual de automação completo para importar no n8n:

1. **Gatilho Cron (Toda Sexta às 16h)**: Inicia o fluxo automaticamente.
2. **Supabase - Buscar Perguntas**: Executa uma query SQL buscando obras ativas, seus encarregados (telefones) e a pergunta pendente atual.
3. **Evolution - Enviar Pergunta**: Dispara a mensagem formatada para o número do WhatsApp retornado.
4. **Webhook - Receber Resposta**: Aguarda respostas do WhatsApp enviadas pela Evolution API.
5. **Validar Resposta**: Filtra as respostas garantindo que correspondam a `SIM`, `NÃO`, ou porcentagens (`25`, `50`, `75`, `100`, `25%`, `50%`, `75%`, `100%`).
6. **Supabase - Salvar Resposta**: Registra a resposta no Supabase. O trigger do banco cuida de normalizar os dados e atualizar o progresso da obra de forma reativa.

---

## 7. Sistema Multiempresa (Multi-tenant) e RLS no Supabase

O sistema está estruturado em um modelo robusto de multi-tenancy a nível de banco de dados (Row Level Security):

* **Tabela `public.tenants`**: Representa cada construtora/empresa.
* **Isolamento de Dados**: As tabelas `usuarios` e `obras` possuem a coluna `tenant_id`. Todas as fases, perguntas, respostas, alertas e relatórios herdam a restrição a partir da obra a que pertencem.
* **Segurança de Consultas**: A função Postgres `public.get_user_empresa_id()` obtém o ID do tenant do usuário logado via `auth.uid()`.
* **Políticas RLS**: Todas as políticas RLS foram configuradas para garantir que usuários logados **nunca** consigam ler ou editar dados pertencentes a outros tenants.
* **Webhook do Bot**: O webhook do WhatsApp é processado de forma administrativa utilizando a chave `SUPABASE_SERVICE_ROLE_KEY`, localizando o encarregado pelo número de telefone e inserindo a resposta diretamente na obra a que ele está devidamente vinculado no banco de dados.

---

## 8. Tratamento de Erros, Logs e Produção

* **Normalização Resiliente**: O trigger `trg_normaliza_resposta` no Postgres trata variações comuns como `nao`, `NAO`, `50`, `50 %` para salvar de forma padronizada (`NÃO`, `50%`), prevenindo erros humanos de digitação por parte do encarregado.
* **Resiliência a API Indisponível**: Caso a Evolution API fique offline temporariamente, as rotas de webhook capturam a falha e registram avisos em logs sem derrubar o Next.js ou o n8n.
* **Segurança do Cron**: A rota `/api/cron/perguntas` é protegida com uma chave no parâmetro de URL ou cabeçalho `Authorization` correspondente à variável `CRON_SECRET`, impedindo execuções maliciosas.
