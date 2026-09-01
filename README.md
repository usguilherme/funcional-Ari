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
- **Serverless (Vercel):**
  - `api/consulta-aluno.js` — consulta de mensalidade pela Área do Aluno.
  - `api/gerar-pix.js` — Pix + webhook Mercado Pago. O **valor da mensalidade é
    apurado no servidor** pelo `clienteId` (nunca vem do navegador).
  - `api/agendar.js` / `api/lead.js` — agendamento e fila de espera do site
    (antes o navegador escrevia direto no banco). Firebase Admin + limite por IP
    + honeypot. As regras do banco fecham a escrita pública nesses nós.
  - `api/upload-foto.js` — recebe a imagem comprimida do painel autenticado e
    grava no Firebase Storage (`fotos/`), devolvendo a URL. `uploadImagem` usa
    isto de forma tolerante: se o Storage falhar, volta a salvar data URL no RTDB.

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
internos. **Leitura** pública apenas em: `servicos`, `landingConfig`,
`vitrine_eventos`, `profissionais_publicos`, `disponibilidade` e o campo
`clientes/$id/statusMensalidade`. **Escrita** pública: nenhuma — `agendamentos_publicos`,
`leads_espera` e `disponibilidade` agora só aceitam escrita autenticada; o site
grava neles via `api/agendar` / `api/lead` (Firebase Admin).

> ⚠️ **Ordem ao atualizar:** publique o front + as funções na Vercel **antes** de
> rodar `firebase deploy --only database`. Se as regras forem apertadas enquanto
> um `agendar.html` antigo (em cache) ainda escreve direto no banco, o
> agendamento quebra até o Service Worker atualizar. Espere ~1 dia após o deploy
> da Vercel, ou aceite essa janela curta.

Falta ainda (defesa em profundidade, exige console do Firebase): **App Check**
(reCAPTCHA) para proteger também as *leituras* dos nós públicos.

### 2. Variáveis de ambiente na Vercel

Ver `.env.example`. Necessárias para as funções `api/`:

| Variável | Uso |
|---|---|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_DATABASE_URL` | Service Account do Firebase Admin |
| `MERCADO_PAGO_ACCESS_TOKEN` | Criar cobranças Pix |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validar a assinatura do webhook (recomendado) |
| `ALLOWED_ORIGIN` | Origem(ns) liberada(s) no CORS **e** na trava de origem de `api/gerar-pix` / `api/agendar` / `api/lead` (lista separada por vírgula; sem valor = não bloqueia). |
| `PIX_VALOR_MAXIMO` | Teto de valor por cobrança (padrão 2000) |
| `FIREBASE_STORAGE_BUCKET` | Opcional — bucket do Storage (padrão: `<projectId>.firebasestorage.app`). Usado por `api/upload-foto`. |

Todas as rotas públicas têm rate limit em memória (`api/_rate-limit.js`),
tipicamente 5/min por IP (`consulta-aluno`: 20/min).

**Backup automático:** `.github/workflows/backup-db.yml` exporta o banco toda
madrugada como artefato criptografado (14 dias). Precisa dos secrets
`FIREBASE_SERVICE_ACCOUNT` (JSON) e `BACKUP_PASSPHRASE` no GitHub. Restaurar:
`gpg -d backup-db-AAAA-MM-DD.json.gpg > backup.json`.

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

## Performance, SEO e segurança

- **Service Worker (`sw.js`):** App Shell em *stale-while-revalidate* (cache na
  hora, revalida em 2º plano). Firebase/APIs sempre pela rede. Ao mudar HTML/CSS/JS
  do shell, **incremente `VERSAO`** no topo do arquivo.
- **Cabeçalhos (`vercel.json`):** CSP, `Permissions-Policy` e `Cache-Control`
  (assets estáticos `immutable`; `css/` e `js/` com `stale-while-revalidate`;
  HTML e `sw.js` sem cache). Ao adicionar um domínio externo novo (script, fonte,
  API), libere na CSP — senão o navegador bloqueia silenciosamente.
- **CDN com versão fixa + SRI:** `lucide@1.38.0` e `chart.js@4.5.1` têm hash
  `integrity`. Ao trocar a versão, recalcule o hash:
  `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.
- **SEO (só telas públicas):** `vitrine.html` e `agendar.html` têm Open Graph,
  Twitter Card, `canonical` e JSON-LD (`ExerciseGym`). `robots.txt`, `sitemap.xml`
  e `404.html` na raiz. Imagem de compartilhamento: `assets/og-image.jpg` (1200×630).
- **`index.html` e `area-aluno.html`** têm `noindex`.
- **Vídeos da vitrine:** facade (miniatura `i.ytimg.com` + botão play). O iframe
  do YouTube (>1 MB) só entra no clique — economia grande de dados/LCP.
- **PWA:** manifests com `id`, `description`, `categories` e ícone `maskable`
  (`assets/icon-maskable-512.png`).

### Pendências (exigem conta/serviço externo ou refatoração maior)

- Monitoramento de erro (Sentry) no front e nas funções `api/`.
- Analytics de funil (vitrine → agendar → WhatsApp) e Web Vitals.
- **App Check** (reCAPTCHA) — protege também as *leituras* dos nós públicos do RTDB.
- Rate limit persistente (Vercel KV / Upstash) no lugar do limitador em memória.
- Login da Área do Aluno por OTP (código no WhatsApp) em vez de só telefone.
- `api/gerar-pix`: **`MERCADO_PAGO_ACCESS_TOKEN` não está configurado na Vercel** —
  a geração de Pix online está inativa (retorna "configuração ausente"). A lógica
  já está pronta (valor apurado no servidor); falta só a env var + o webhook.
- `api/consulta-aluno.js` lê coleções inteiras (`clientes`, `atendimentos`) a cada
  chamada — migrar para consulta indexada exige padronizar o formato do telefone
  no banco antes.
- Migração das fotos base64 → Storage: `api/upload-foto` já existe e `uploadImagem`
  já tenta usá-lo (com fallback). Falta: confirmar um upload de teste no bucket e
  rodar um script de migração para as fotos antigas.
- PWA `screenshots` e `shortcuts`: precisam de rotas por hash/query no painel
  (hoje não há) e de capturas reais de tela.
- Passo de build (esbuild): minificação + hash no nome do arquivo (destrava cache
  `immutable` de verdade em `css/` e `js/`). Hoje não há build de propósito.
- Self-host das fontes Google.

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
