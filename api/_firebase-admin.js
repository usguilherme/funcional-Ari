// Inicialização compartilhada do Firebase Admin para as funções serverless.
// Credenciais vêm de variáveis de ambiente na Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY          (PEM com \n escapados OU quebras reais)
//   FIREBASE_PRIVATE_KEY_BASE64   (alternativa: o PEM inteiro codificado em base64)
//   FIREBASE_DATABASE_URL         (opcional — deduzido do project id se ausente)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let dbInstance = null;

const PEM_HEADER = '-----BEGIN PRIVATE KEY-----';

// Normaliza um PEM que chegou como texto (FIREBASE_PRIVATE_KEY):
//   - aspas em volta (a Vercel às vezes guarda o valor colado com aspas)
//   - \n / \r\n escapados  -> quebras de linha reais
//   - \r\n                 -> \n
//   - garante quebra final (o parser do OpenSSL é exigente)
function normalizarPem(raw) {
  let k = String(raw).trim();

  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }

  k = k
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (!k.endsWith('\n')) k += '\n';
  return k;
}

// Decodifica o PEM a partir de FIREBASE_PRIVATE_KEY_BASE64. Aceita base64 padrão
// e url-safe, com ou sem quebras de linha / espaços no meio.
function decodificarBase64(raw) {
  const limpo = String(raw).trim().replace(/["']/g, '').replace(/\s+/g, '');
  const padrao = limpo.replace(/-/g, '+').replace(/_/g, '/');
  const pem = Buffer.from(padrao, 'base64').toString('utf8');
  if (!pem.includes(PEM_HEADER)) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY_BASE64 decodificou para um valor sem o cabeçalho PEM ' +
      '("' + PEM_HEADER + '"). Confirme que o base64 foi gerado a partir do PEM da service account ' +
      '(ex.: `base64 -w0 chave.pem`).'
    );
  }
  return normalizarPem(pem);
}

// Resolve a chave privada a partir do ambiente. O sufixo _BASE64 tem prioridade
// e é sempre tratado como base64; caso contrário usa o PEM em texto.
function resolverChavePrivada() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  const texto = process.env.FIREBASE_PRIVATE_KEY;

  if (b64 && b64.trim()) {
    return { chave: decodificarBase64(b64), origem: 'FIREBASE_PRIVATE_KEY_BASE64' };
  }
  if (texto && texto.trim()) {
    // Se o valor colado em FIREBASE_PRIVATE_KEY for na verdade base64 (sem o
    // cabeçalho PEM em texto claro), decodifica também — evita um 500 por
    // engano de qual variável foi usada.
    const t = texto.trim().replace(/["']/g, '');
    if (!t.includes(PEM_HEADER) && /^[A-Za-z0-9+/_=\s-]+$/.test(t)) {
      try {
        return { chave: decodificarBase64(texto), origem: 'FIREBASE_PRIVATE_KEY (base64)' };
      } catch { /* trata como PEM em texto abaixo */ }
    }
    return { chave: normalizarPem(texto), origem: 'FIREBASE_PRIVATE_KEY' };
  }
  return { chave: '', origem: null };
}

function urlBancoPadrao(projectId) {
  return projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '';
}

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || urlBancoPadrao(projectId);

  let chave = '';
  let origemChave = null;
  try {
    ({ chave, origem: origemChave } = resolverChavePrivada());
  } catch (err) {
    // Erro ao decodificar o base64 — mostra o stack completo na Vercel.
    console.error('[firebase-admin] Falha ao ler a chave privada:', err && err.stack ? err.stack : err);
    throw new Error('Firebase Admin: ' + (err && err.message ? err.message : err), { cause: err });
  }

  const faltando = [];
  if (!projectId) faltando.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) faltando.push('FIREBASE_CLIENT_EMAIL');
  if (!chave) faltando.push('FIREBASE_PRIVATE_KEY (ou FIREBASE_PRIVATE_KEY_BASE64)');
  if (!databaseURL) faltando.push('FIREBASE_DATABASE_URL');
  if (faltando.length) {
    const msg = 'Firebase Admin: variáveis de ambiente ausentes -> ' + faltando.join(', ');
    console.error('[firebase-admin] ' + msg);
    throw new Error(msg);
  }

  if (!chave.includes(PEM_HEADER)) {
    const msg = 'Firebase Admin: chave privada em formato inválido (sem cabeçalho PEM) — origem: ' + origemChave;
    console.error('[firebase-admin] ' + msg);
    throw new Error(msg);
  }

  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: chave }),
        databaseURL
      });
      console.log('[firebase-admin] inicializado (projeto: ' + projectId + ', chave via ' + origemChave + ').');
    } catch (err) {
      // Stack completo (inclui erros do OpenSSL, ex.: DECODER routines::unsupported).
      console.error('[firebase-admin] Falha em initializeApp/cert:', err && err.stack ? err.stack : err);
      throw new Error(
        'Firebase Admin: falha ao inicializar (' + (err && err.message ? err.message : err) + ')',
        { cause: err }
      );
    }
  }

  dbInstance = getDatabase();
  return dbInstance;
}
