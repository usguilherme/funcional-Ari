// Inicialização compartilhada do Firebase Admin para as funções serverless.
// Credenciais vêm de variáveis de ambiente na Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY          (com \n escapados OU quebras reais OU base64)
//   FIREBASE_PRIVATE_KEY_BASE64   (alternativa: a chave inteira em base64)
//   FIREBASE_DATABASE_URL         (opcional — deduzido do project id se ausente)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let dbInstance = null;

// A chave privada é a maior fonte de erro 500 aqui. A Vercel guarda o valor
// como texto puro; dependendo de como foi colado, ele chega:
//   - com \n literais (mais comum)           -> precisa virar quebra real
//   - com aspas em volta                      -> precisa remover
//   - com \r\n                                -> normalizar
//   - inteiro em base64 (sem BEGIN/END)       -> decodificar
// Esta função cobre todos os casos.
function normalizarChavePrivada(raw) {
  if (!raw) return raw;
  let k = String(raw).trim();

  // Remove aspas externas se o valor foi colado com elas.
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }

  // Chave inteira em base64 (não contém o cabeçalho PEM em texto claro).
  if (!k.includes('BEGIN PRIVATE KEY') && /^[A-Za-z0-9+/=\s]+$/.test(k)) {
    try {
      const decodificada = Buffer.from(k, 'base64').toString('utf8');
      if (decodificada.includes('BEGIN PRIVATE KEY')) k = decodificada.trim();
    } catch { /* segue com o valor original */ }
  }

  // \n / \r\n escapados -> quebras de linha reais.
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Garante quebra de linha final (o parser do OpenSSL é exigente).
  if (!k.endsWith('\n')) k += '\n';

  return k;
}

function urlBancoPadrao(projectId) {
  return projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '';
}

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizarChavePrivada(
    process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64
  );
  const databaseURL = process.env.FIREBASE_DATABASE_URL || urlBancoPadrao(projectId);

  const faltando = [];
  if (!projectId) faltando.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) faltando.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) faltando.push('FIREBASE_PRIVATE_KEY');
  if (!databaseURL) faltando.push('FIREBASE_DATABASE_URL');
  if (faltando.length) {
    throw new Error('Firebase Admin: variáveis de ambiente ausentes -> ' + faltando.join(', '));
  }
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Firebase Admin: FIREBASE_PRIVATE_KEY em formato inválido (sem cabeçalho PEM).');
  }

  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        databaseURL
      });
    } catch (err) {
      throw new Error('Firebase Admin: falha ao inicializar (' + (err && err.message ? err.message : err) + ')');
    }
  }

  dbInstance = getDatabase();
  return dbInstance;
}
