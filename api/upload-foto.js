// api/upload-foto.js
// Recebe uma imagem já comprimida no navegador (data URL) do painel autenticado,
// grava no Firebase Storage sob `fotos/<pasta>/` e devolve a URL pública.
// Objetivo: parar de guardar base64 dentro do Realtime Database (inchava o
// payload de `clientes` carregado a cada abertura do painel e os backups).
//
// O chamador (js/01-config-firebase-estado.js -> uploadImagem) usa isto de forma
// tolerante: se qualquer coisa falhar, ele volta a salvar como data URL. Ou
// seja, enquanto o Storage não estiver 100% configurado, nada quebra.
import { getAdminAuth, getAdminBucket } from './_firebase-admin.js';
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';
import { randomUUID } from 'node:crypto';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const PASTAS = new Set(['fotos_alunos', 'galeria_alunos', 'servicos', 'vitrine']);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 5 * 1024 * 1024;

function aplicarCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (ALLOWED_ORIGIN && origin && ALLOWED_ORIGIN.split(',').map(s => s.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function lerCorpo(req) {
  let b = req.body;
  if (b === undefined || b === null || b === '') {
    b = await new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => { d += c; });
      req.on('end', () => resolve(d));
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

  const ip = ipDaRequisicao(req);
  if (limiteExcedido('upload:' + ip, 30, 60000)) {
    return res.status(429).json({ erro: 'Muitos envios. Aguarde um minuto.' });
  }

  // Só usuário logado no painel pode enviar imagem.
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }

  const corpo = await lerCorpo(req);
  const pasta = PASTAS.has(String(corpo.pasta)) ? String(corpo.pasta) : 'fotos_alunos';
  const dataUrl = String(corpo.dataUrl || '');

  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) return res.status(400).json({ erro: 'Imagem inválida' });

  const mime = m[1].toLowerCase();
  const ext = EXT[mime];
  if (!ext) return res.status(415).json({ erro: 'Formato não suportado' });

  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) {
    return res.status(413).json({ erro: 'Imagem muito grande' });
  }

  try {
    const bucket = getAdminBucket();
    const caminho = `fotos/${pasta}/${Date.now()}-${randomUUID()}.${ext}`;
    await bucket.file(caminho).save(buffer, {
      resumable: false,
      contentType: mime,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' }
    });

    // URL de download do Firebase Storage (respeita storage.rules: fotos/ é
    // leitura pública). Não usa makePublic() — evita problema com acesso
    // uniforme no bucket.
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media`;
    return res.status(200).json({ url });
  } catch (err) {
    console.error('Erro no upload de foto:', err && err.stack ? err.stack : err);
    return res.status(500).json({ erro: 'Falha ao enviar a imagem' });
  }
}
