// Service Worker do Funcional do Ari.
// Estratégia: "network first" para navegação/estáticos (sempre tenta a versão
// nova e cai para o cache quando offline). Chamadas ao Firebase/APIs passam
// direto pela rede, sem cache.

const VERSAO = 'v12';
const CACHE_NOME = `funcionaldoari-${VERSAO}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/01-config-firebase-estado.js',
  './js/02-tema-init-auth.js',
  './js/03-config-vitrine.js',
  './js/04-navegacao-ui.js',
  './js/05-pdv-pix.js',
  './js/06-agenda.js',
  './js/07-clientes.js',
  './js/08-estoque.js',
  './js/09-financeiro-servicos-profissionais.js',
  './js/10-notificacoes-mascaras.js',
  './js/11-impressao-swipe-contador.js',
  './js/12-modo-tv-fila.js',
  './js/13-rh-folha-pagamento.js',
  './js/14-cobrancas-mensalidades.js',
  './js/15-atualizacao-avaliacoes.js',
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
  './area-aluno.html',
  './manifest-aluno.json',
  './assets/ding.mp3',
  './logofuncionalari.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png'
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

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NOME).then((cache) => cache.put(req, clone));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
  );
});
