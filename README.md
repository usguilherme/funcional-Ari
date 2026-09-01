# Funcional do Ari — Painel de Gestão

PWA de gestão para o estúdio (alunos, agenda, mensalidades, financeiro, folha/RH,
estoque) + site público (`vitrine.html`, `agendar.html`) + Área do Aluno
(`area-aluno.html`).

## Stack

- **Front-end:** HTML/CSS/JS puro, sem build. `index.html` carrega os fragmentos
  de `pages/` e os módulos `js/00..15-*.js` (scripts clássicos, escopo global
  compartilhado, carregados na ordem numérica). `js/00-utils.js` tem os helpers
  compartilhados (`escapeHtml`, `escapeAttr`, `soDigitos`, `formatarData`), usados
  também pelas telas públicas. `css/tokens.css` é a paleta oficial da marca —
  carregado antes de tudo nas 4 telas.
- **Banco:** Firebase Realtime Database (projeto `funcional-ari`), acessado do
  navegador para o painel autenticado.
- **Auth:** Firebase Authentication (e-mail/senha).
- **Imagens:** comprimidas no navegador e salvas como data URL no próprio banco
  (helper `uploadImagem`). O modelo do estúdio é 100% mensalidade — o antigo
  módulo de PDV/venda avulsa foi removido.
- **Serverless (Vercel):** `api/gerar-pix.js` (Pix + webhook Mercado Pago) e
  `api/consulta-aluno.js` (consulta de mensalidade pela vitrine).

## Rodando os checks

```bash
npm install
npm run check      # parse de todos os .js + bundle do navegador + APIs
```

Não há build: o deploy publica os arquivos estáticos como estão.

## Configuração (obrigatória)

### 1. Regras do banco e do Storage

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database,storage
```

`database.rules.json` fecha o banco: só usuário autenticado lê/escreve os dados
internos. São públicos apenas: `servicos`, `landingConfig`, `vitrine_eventos`
(aulões/eventos exibidos na vitrine), `profissionais_publicos`
(espelho `{id:nome}` mantido pelo painel), `disponibilidade` (só horários) e o
campo `clientes/$id/statusMensalidade` (usado pela Área do Aluno). Agendamentos do
site entram em `agendamentos_publicos` (o visitante só cria; o painel confirma).

### 2. Variáveis de ambiente na Vercel

Ver `.env.example`. Necessárias para as funções `api/`:

| Variável | Uso |
|---|---|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_DATABASE_URL` | Service Account do Firebase Admin |
| `MERCADO_PAGO_ACCESS_TOKEN` | Criar cobranças Pix |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validar a assinatura do webhook (recomendado) |
| `ALLOWED_ORIGIN` | Origem(ns) liberada(s) no CORS **e** na trava de origem do `api/gerar-pix` (lista separada por vírgula; sem valor = não bloqueia). |
| `PIX_VALOR_MAXIMO` | Teto de valor por cobrança (padrão 2000) |

As rotas públicas `api/gerar-pix` e `api/consulta-aluno` têm um rate limit simples
em memória (`api/_rate-limit.js`): 5/min e 20/min por IP, respectivamente.

### 3. Webhook do Mercado Pago

Apontar para `https://SEU_DOMINIO/api/gerar-pix` (evento *payments*) e copiar a
assinatura secreta para `MERCADO_PAGO_WEBHOOK_SECRET`.

## Área do Aluno (`area-aluno.html`)

Portal do aluno, identificado só pelo WhatsApp cadastrado (sem senha). Consome
`api/consulta-aluno.js` (que devolve perfil, plano, mensalidade, galeria de fotos,
linha do tempo, histórico de compras e dados do estúdio) e reaproveita
`api/gerar-pix.js` para o pagamento. Seções:

- **Início:** saudação, tempo de treino, status da mensalidade, pontos/nível,
  sequência de treinos, próxima aula, frase do dia, recado do estúdio, ações
  rápidas (WhatsApp, agendar/repor aula, indicar amigo).
- **Mensalidade:** status, Pix oficial (QR + copia-e-cola, confirmação em tempo
  real via `clientes/$id/statusMensalidade`), plano atual, histórico de compras,
  outros planos.
- **Evolução:** objetivo, link da avaliação (Google Drive), galeria de fotos,
  linha do tempo do professor e um registro de peso local (só no aparelho).
- **Treinos:** planilha (Drive), grade de horários, meta semanal + check-in de
  treino (local), checklist "levar para a aula".
- **Conquistas:** nível por pontos (Iniciante → Lenda) e ~16 troféus calculados
  (tempo de treino, mensalidade em dia, constância, aniversário, etc.).

Check-ins, meta, peso e checklist ficam em `localStorage` (por aparelho, não vão
para o banco). O texto das anotações técnicas do professor só aparece se
`EXPOR_NOTAS_PROFESSOR=true` (ver `.env.example`); títulos e datas sempre aparecem.
Os campos "Horários das aulas" e "Recado para os alunos" ficam na aba
*Vitrine Online* do painel (`landingConfig.horariosAluno` / `recadoAluno`).

## Notas de operação

- **Mensalidades:** marque cada aluno como pago na aba *Atualização*. Isso grava
  `mesPagamento`; no primeiro carregamento de um novo mês, quem estava "pago" volta
  a "atrasado" automaticamente. O valor de cada plano vem do preço cadastrado em
  *Planos / Treinos* (fonte única — não há mais tabela de preços fixa no código).
- **Agendamentos do site:** entram em `agendamentos_publicos` com status
  *pendente* e aparecem na aba *Agenda* para o operador **confirmar** ou
  **recusar**. Confirmados passam a listar na agenda do dia, com botão para
  marcar como *concluída*. Não geram lançamento financeiro (o modelo do estúdio
  é mensalidade). Registros antigos de `atendimentos` marcados como "Pendente" /
  "Aguardando Confirmação" ficam fora do faturamento.
