// api/agendar.js
// Agendamento da aula experimental feito pelo site (agendar.html).
// Antes o navegador escrevia direto em `agendamentos_publicos` / `disponibilidade`
// no Realtime Database — o que deixava um bot spammar a agenda chamando a REST
// API do Firebase direto. Agora a escrita passa por aqui: Firebase Admin, com
// limite por IP, honeypot e validação de servidor. As regras do banco fecham a
// escrita pública nesses nós.
import { getAdminDb } from './_firebase-admin.js';
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const DIAS_PERMITIDOS = [1, 3, 5]; // seg, qua, sex
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

// Bloqueia só requisição comprovadamente cross-site (browser manda
// Sec-Fetch-Site). O peso real contra bot fica no honeypot + rate limit +
// validação; a checagem de Origin era frágil (dependia de um env certo).
function pedidoCrossSite(req) {
  return String(req.headers['sec-fetch-site'] || '') === 'cross-site';
}

function ehDiaPermitido(dataStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return false;
  const d = new Date(dataStr + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return DIAS_PERMITIDOS.includes(d.getUTCDay());
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
  if (pedidoCrossSite(req)) return res.status(403).json({ erro: 'Origem não autorizada.' });

  const ip = ipDaRequisicao(req);
  if (limiteExcedido('agendar:' + ip, 5, 60000)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
  }

  const corpo = await lerCorpo(req);

  // Honeypot: campo escondido no formulário. Se veio preenchido, é bot —
  // responde 200 (sem gravar) para não ensinar o robô.
  if (String(corpo.hp || '').trim() !== '') return res.status(200).json({ ok: true });

  const nome = String(corpo.nome || '').trim().slice(0, 120);
  const telefoneBruto = String(corpo.telefone || '').replace(/[^0-9 ()+.\-]/g, '').trim().slice(0, 30);
  const data = String(corpo.data || '').trim();
  const hora = String(corpo.hora || '').trim();
  const profissionalId = corpo.profissionalId ? String(corpo.profissionalId).trim() : '';
  const profissionalNome = String(corpo.profissionalNome || 'Qualquer Instrutor').trim().slice(0, 120);

  if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
  if (!RE_TEL.test(telefoneBruto)) return res.status(400).json({ erro: 'WhatsApp inválido.' });
  if (!ehDiaPermitido(data)) return res.status(400).json({ erro: 'A data precisa cair numa segunda, quarta ou sexta.' });
  if (!/^\d{1,2}:\d{2}$/.test(hora)) return res.status(400).json({ erro: 'Horário inválido.' });
  if (profissionalId && !/^[0-9A-Za-z_-]{1,40}$/.test(profissionalId)) {
    return res.status(400).json({ erro: 'Instrutor inválido.' });
  }

  try {
    const db = getAdminDb();
    const chaveHora = hora.replace(':', '-');

    if (profissionalId) {
      const snap = await db.ref(`disponibilidade/${data}/${profissionalId}/${chaveHora}`).once('value');
      if (snap.exists()) {
        return res.status(409).json({ erro: 'Esse horário já está ocupado com esse instrutor.' });
      }
    }

    await db.ref('agendamentos_publicos').push({
      data,
      hora,
      nomeCliente: nome,
      telefoneCliente: telefoneBruto,
      servicoNome: 'Aula experimental gratuita',
      profissionalId: profissionalId || null,
      profissionalNome: profissionalNome || 'Qualquer Instrutor',
      valor: 0,
      obs: 'Agendado pelo site — aula experimental gratuita, aguardando confirmação',
      status: 'pendente',
      criadoEm: Date.now()
    });

    if (profissionalId) {
      await db.ref(`disponibilidade/${data}/${profissionalId}/${chaveHora}`).set(true);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar agendamento:', err && err.stack ? err.stack : err);
    return res.status(500).json({ erro: 'Não foi possível registrar o agendamento agora.' });
  }
}
