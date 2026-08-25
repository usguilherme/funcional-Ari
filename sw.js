// Service Worker mínimo do Funcional do Ari.
// Não faz cache agressivo — só existe para o navegador não reclamar do registro
// feito em index.html. Pode ser expandido depois para uso 100% offline.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Passa direto pra rede, sem interceptar nada.
});
