// api/log.js
// Recebe erros de JS do navegador (window.onerror / unhandledrejection, ver
// js/00-utils.js) e joga em `console.error` — aparecem em `vercel logs`.
// Sem banco, sem custo além do volume de log. Rate limit por IP para não virar
// canal de flood. É telemetria de melhor esforço até ter um Sentry de verdade.
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';

const LIMITE = 30; // por minuto por IP

async function lerCorpo(req) {
  let b = req.body;
  if (b === undefined || b === null || b === '') {
    b = await new Promise((resolve) => {
      let d = '';
      let total = 0;
      req.on('data', (c) => {
        total += c.length;
        if (total <= 8192) d += c;
      });
      req.on('end', () => resolve(d));
      req.on('error', () => resolve(''));
    });
  }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string' && b.trim()) {
    try { return JSON.parse(b.slice(0, 8192)); } catch { /* ignora */ }
  }
  return {};
}

const corta = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').slice(0, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = ipDaRequisicao(req);
  if (limiteExcedido('log:' + ip, LIMITE, 60000)) return res.status(204).end();

  try {
    const c = await lerCorpo(req);
    console.error('[client-error]', JSON.stringify({
      msg: corta(c.message, 500),
      src: corta(c.source, 300),
      pos: `${Number(c.lineno) || 0}:${Number(c.colno) || 0}`,
      stack: corta(c.stack, 1500),
      url: corta(c.url, 300),
      ua: corta(c.ua, 300),
      ip
    }));
  } catch (e) {
    console.error('[client-error] payload ilegível:', e && e.message);
  }
  return res.status(204).end();
}
