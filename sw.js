// Service Worker do Funcional do Ari.
// Estratégia: "stale-while-revalidate" para o App Shell (HTML, CSS, JS e páginas
// estáticas do mesmo domínio): responde na hora com o cache (carregamento
// secundário/offline instantâneo) e atualiza o cache em 2º plano com a versão
// nova da rede. Chamadas ao Firebase/APIs passam direto pela rede, sem cache.
// O próprio sw.js nunca é servido do cache, para não travar futuras atualizações.

const VERSAO = 'v24';
const CACHE_NOME = `funcionaldoari-${VERSAO}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/style.css',
  './js/00-utils.js',
  './js/01-config-firebase-estado.js',
  './js/02-tema-init-auth.js',
  './js/03-config-vitrine.js',
  './js/04-navegacao-ui.js',
  './js/06-agenda.js',
  './js/07-clientes.js',
  './js/08-estoque.js',
  './js/09-financeiro-servicos-profissionais.js',
  './js/10-notificacoes-mascaras.js',
  './js/12-modo-tv-fila.js',
  './js/13-rh-folha-pagamento.js',
  './js/14-cobrancas-mensalidades.js',
  './js/15-atualizacao-avaliacoes.js',
  './js/16-leads.js',
  './js/17-turmas.js',
  './pages/dashboard.html',
  './pages/agenda.html',
  './pages/novo_atendimento.html',
  './pages/profissionais.html',
  './pages/clientes.html',
  './pages/avaliacoes.html',
  './pages/estoque.html',
  './pages/financeiro.html',
  './pages/servicos.html',
  './pages/despesas.html',
  './pages/landing.html',
  './pages/leads.html',
  './area-aluno.html',
  './404.html',
  './manifest-aluno.json',
  './assets/ding.mp3',
  './logofuncionalari.webp',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ASSETS).catch((e) => {
      console.warn('SW: alguns assets não foram pré-cacheados', e);
    }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function ehExterno(url) {
  return url.includes('firebasejs') ||
         url.includes('firebaseio') ||
         url.includes('firebasedatabase') ||
         url.includes('firebasestorage') ||
         url.includes('googleapis') ||
         url.includes('gstatic') ||
         url.includes('mercadopago') ||
         url.includes('/api/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || ehExterno(req.url)) return;

  const url = new URL(req.url);
  // Só tratamos o App Shell (mesmo domínio). Externos já saíram acima.
  if (url.origin !== self.location.origin) return;
  // O próprio Service Worker sempre vem da rede, nunca do cache.
  if (url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    caches.match(req).then((cacheado) => {
      const daRede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NOME).then((cache) => cache.put(req, clone));
          }
          return resp;
        })
        .catch(() => cacheado || caches.match('./index.html'));

      // stale-while-revalidate: cache na hora, rede atualiza em 2º plano.
      return cacheado || daRede;
    })
  );
});
