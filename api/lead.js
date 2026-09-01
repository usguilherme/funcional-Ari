// api/lead.js
// Fila de espera / captura de lead do site (agendar.html -> "Entrar na fila").
// Mesma motivação de api/agendar.js: a escrita em `leads_espera` era pública e
// dava para spammar direto pela REST API do Firebase. Agora passa por aqui.
import { getAdminDb } from './_firebase-admin.js';
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const RE_TEL = /^[0-9 ()+.\-]{8,30}$/;

function aplicarCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (ALLOWED_ORIGIN && origin && ALLOWED_ORIGIN.split(',').map(s => s.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function origemPermitida(req) {
  if (!ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*') return true;
  const permitidas = ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  if (origin) return permitidas.includes(origin);
  return permitidas.some(o => referer === o || referer.startsWith(o + '/'));
}

async function lerCorpo(req) {
  let b = req.body;
  if (b === undefined || b === null || b === '') {
    b = await new Promise((resolve) => {
      let dados = '';
      req.on('data', (c) => { dados += c; });
      req.on('end', () => resolve(dados));
      req.on('error', () => resolve(''));
    });
  }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string' && b.trim()) {
    try { return JSON.parse(b); } catch { /* ignora */ }
  }
  return {};
}

export default async function handler(req, res) {
  aplicarCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });
  if (!origemPermitida(req)) return res.status(403).json({ erro: 'Origem não autorizada.' });

  const ip = ipDaRequisicao(req);
  if (limiteExcedido('lead:' + ip, 5, 60000)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
  }

  const corpo = await lerCorpo(req);
  if (String(corpo.hp || '').trim() !== '') return res.status(200).json({ ok: true });

  const nome = String(corpo.nome || '').trim().slice(0, 120);
  const telefone = String(corpo.telefone || '').replace(/[^0-9 ()+.\-]/g, '').trim().slice(0, 30);
  const origem = String(corpo.origem || 'site').trim().slice(0, 40) || 'site';

  if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
  if (!RE_TEL.test(telefone)) return res.status(400).json({ erro: 'WhatsApp inválido.' });

  try {
    await getAdminDb().ref('leads_espera').push({
      nome,
      telefone,
      origem,
      criadoEm: Date.now()
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar lead:', err && err.stack ? err.stack : err);
    return res.status(500).json({ erro: 'Não foi possível entrar na fila agora.' });
  }
}
