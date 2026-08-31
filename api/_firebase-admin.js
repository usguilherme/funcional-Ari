// Inicialização compartilhada do Firebase Admin para as funções serverless.
// Credenciais vêm de variáveis de ambiente na Vercel. A leitura é tolerante:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY            PEM (com \n escapados OU quebras reais)
//   FIREBASE_PRIVATE_KEY_BASE64     o PEM inteiro em base64
//   FIREBASE_SERVICE_ACCOUNT        o JSON inteiro da service account
//   FIREBASE_SERVICE_ACCOUNT_BASE64 o JSON inteiro da service account em base64
//   FIREBASE_DATABASE_URL           opcional — deduzido do project id se ausente
// Qualquer uma das formas acima serve; project id / client email saem do JSON
// quando ele é fornecido e as variáveis dedicadas estão vazias.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let dbInstance = null;

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/;

// Reconstrói um PEM canônico a partir de QUALQUER texto que contenha um bloco
// PEM: aceita \n / \r\n escapados, espaços, quebras erradas, aspas em volta,
// JSON em volta. Só o corpo base64 precisa estar intacto. Isso elimina o
// "Invalid PEM formatted message" do parser, que é exigente com o formato.
function canonicalizarPem(texto) {
  if (!texto) return null;
  const desescapado = String(texto)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
  const m = desescapado.match(PEM_RE);
  if (!m) return null;
  const tipo = m[1].trim();
  const corpo = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  if (!corpo) return null;
  const linhas = corpo.match(/.{1,64}/g) || [];
  return `-----BEGIN ${tipo}-----\n${linhas.join('\n')}\n-----END ${tipo}-----\n`;
}

// String base64 "pura" (sem cabeçalho PEM em texto claro, sem { de JSON).
function pareceBase64(s) {
  const t = s.replace(/\s+/g, '');
  return t.length > 40 && /^[A-Za-z0-9+/_=-]+$/.test(t) && !t.includes('PRIVATEKEY');
}

function tentarBase64(s) {
  const limpo = s.trim().replace(/["']/g, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    const txt = Buffer.from(limpo, 'base64').toString('utf8');
    if (txt.includes('BEGIN') || txt.trim().startsWith('{')) return txt;
  } catch { /* ignora */ }
  return null;
}

// Recebe o valor cru de uma variável e devolve { privateKey, clientEmail?,
// projectId? }. Lida com: PEM em texto, PEM em base64, JSON da service account
// (texto ou base64), e valor entre aspas.
function desempacotarCredencial(raw) {
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  // base64 -> decodifica primeiro
  if (!s.includes('BEGIN PRIVATE KEY') && !s.startsWith('{') && pareceBase64(s)) {
    const decodificado = tentarBase64(s);
    if (decodificado) s = decodificado.trim();
  }

  // JSON inteiro da service account
  if (s.startsWith('{')) {
    let json;
    try { json = JSON.parse(s); } catch {
      throw new Error('Credencial do Firebase: valor parece JSON mas não pôde ser parseado.');
    }
    return {
      privateKey: canonicalizarPem(json.private_key),
      clientEmail: json.client_email || null,
      projectId: json.project_id || null
    };
  }

  // PEM (em texto ou já decodificado do base64)
  return { privateKey: canonicalizarPem(s), clientEmail: null, projectId: null };
}

// Percorre as variáveis aceitas na ordem de prioridade e devolve a primeira
// que produzir uma chave privada válida.
function resolverCredencial() {
  const fontes = [
    ['FIREBASE_SERVICE_ACCOUNT_BASE64', process.env.FIREBASE_SERVICE_ACCOUNT_BASE64],
    ['FIREBASE_SERVICE_ACCOUNT', process.env.FIREBASE_SERVICE_ACCOUNT],
    ['FIREBASE_PRIVATE_KEY_BASE64', process.env.FIREBASE_PRIVATE_KEY_BASE64],
    ['FIREBASE_PRIVATE_KEY', process.env.FIREBASE_PRIVATE_KEY]
  ];

  for (const [nome, valor] of fontes) {
    if (!valor || !valor.trim()) continue;
    const { privateKey, clientEmail, projectId } = desempacotarCredencial(valor);
    if (privateKey) {
      return { privateKey, clientEmail, projectId, origem: nome };
    }
    console.error('[firebase-admin] ' + nome + ' foi encontrada mas não contém um bloco PEM utilizável.');
  }
  return { privateKey: '', clientEmail: null, projectId: null, origem: null };
}

function urlBancoPadrao(projectId) {
  return projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '';
}

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  let cred;
  try {
    cred = resolverCredencial();
  } catch (err) {
    console.error('[firebase-admin] Falha ao ler a credencial:', err && err.stack ? err.stack : err);
    throw new Error('Firebase Admin: ' + (err && err.message ? err.message : err), { cause: err });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || cred.projectId || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || cred.clientEmail || '';
  const privateKey = cred.privateKey || '';
  const databaseURL = process.env.FIREBASE_DATABASE_URL || urlBancoPadrao(projectId);

  const faltando = [];
  if (!projectId) faltando.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) faltando.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) faltando.push('FIREBASE_PRIVATE_KEY (ou _BASE64 / SERVICE_ACCOUNT)');
  if (!databaseURL) faltando.push('FIREBASE_DATABASE_URL');
  if (faltando.length) {
    const msg = 'Firebase Admin: variáveis de ambiente ausentes -> ' + faltando.join(', ');
    console.error('[firebase-admin] ' + msg);
    throw new Error(msg);
  }

  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        databaseURL
      });
      console.log('[firebase-admin] inicializado (projeto: ' + projectId + ', credencial via ' + cred.origem + ').');
    } catch (err) {
      // Stack completo (inclui erros do OpenSSL / node-forge).
      console.error('[firebase-admin] Falha em initializeApp/cert:', err && err.stack ? err.stack : err);
      console.error('[firebase-admin] diagnóstico: origem=' + cred.origem +
        ' pemLinhas=' + privateKey.split('\n').length +
        ' pemInicio="' + privateKey.slice(0, 32).replace(/\n/g, '\\n') + '"');
      throw new Error(
        'Firebase Admin: falha ao inicializar (' + (err && err.message ? err.message : err) + ')',
        { cause: err }
      );
    }
  }

  dbInstance = getDatabase();
  return dbInstance;
}
