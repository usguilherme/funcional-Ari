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
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let dbInstance = null;
let projectIdCache = '';

// Caracteres de controle (C0/C1) e invisíveis (BOM, zero-width, NBSP,
// ideographic space, marcas bidi, soft hyphen) que o copiar-e-colar às vezes
// injeta e que .trim() / \s não removem. Montado por code point para não
// depender de literais invisíveis no código-fonte.
const RE_INVISIVEIS = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00A0\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\u3000\\uFEFF]',
  'g'
);
function limparEnv(v) {
  return String(v == null ? '' : v)
    .replace(RE_INVISIVEIS, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/;

// Reconstrói um PEM canônico a partir de QUALQUER texto que contenha um bloco
// PEM: aceita \n / \r\n escapados, espaços, quebras erradas, aspas em volta,
// JSON em volta. Só o corpo base64 precisa estar intacto. Isso elimina o
// "Invalid PEM formatted message" do parser, que é exigente com o formato.
function canonicalizarPem(texto) {
  if (!texto) return null;
  const desescapado = String(texto)
    .replace(RE_INVISIVEIS, '')
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
    // Diagnóstico: o que exatamente veio nessa variável (sem vazar a chave).
    const bruto = String(valor).trim();
    let decodificado = bruto;
    const d = tentarBase64(bruto);
    if (d) decodificado = d.trim();
    const impressao = (x) => x.length + ' chars; ini="' +
      x.slice(0, 24).replace(/\s/g, '·') + '"; fim="' +
      x.slice(-24).replace(/\s/g, '·') + '"; BEGIN=' + x.includes('BEGIN') +
      '; ENDPK=' + x.includes('END PRIVATE KEY') + '; json=' + x.trimStart().startsWith('{');
    console.error('[firebase-admin] ' + nome + ' não produziu um PEM utilizável.');
    console.error('[firebase-admin]   bruto      -> ' + impressao(bruto));
    if (decodificado !== bruto) console.error('[firebase-admin]   decodificado-> ' + impressao(decodificado));
  }
  return { privateKey: '', clientEmail: null, projectId: null, origem: null };
}

function urlBancoPadrao(projectId) {
  return projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '';
}

// Extrai uma URL utilizável da FIREBASE_DATABASE_URL, por mais suja que venha:
// aspas, invisíveis, esquema repetido, barra/path, ou até um link markdown
// "[texto](url)" colado por engano. O Admin SDK quer só protocolo + host.
function normalizarUrlBanco(u) {
  let s = limparEnv(u).replace(/\\[rn]/g, ' ');
  if (!s) return '';
  // 1ª URL http(s) que aparecer (resolve markdown, aspas, texto em volta).
  const m = s.match(/https?:\/\/[^\s()[\]"'<>]+/i);
  s = m ? m[0] : s.replace(/\s+/g, '').replace(/^[[(]+/, '');
  s = 'https://' + s.replace(/^(https?:\/\/)+/i, '');
  try {
    return new URL(s).origin;
  } catch {
    return s.replace(/\/+$/, '');
  }
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

  const projectId = limparEnv(process.env.FIREBASE_PROJECT_ID) || cred.projectId || '';
  projectIdCache = projectId;
  const clientEmail = limparEnv(process.env.FIREBASE_CLIENT_EMAIL) || cred.clientEmail || '';
  const privateKey = cred.privateKey || '';
  const databaseURL = normalizarUrlBanco(process.env.FIREBASE_DATABASE_URL) || urlBancoPadrao(projectId);

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
      console.log('[firebase-admin] inicializado (projeto: ' + projectId + ', db: ' + databaseURL + ', credencial via ' + cred.origem + ').');
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

  try {
    // URL explícita — não depende do que ficou salvo no app.
    dbInstance = databaseURL ? getDatabase(getApps()[0], databaseURL) : getDatabase();
  } catch (err) {
    console.error('[firebase-admin] Falha em getDatabase (url="' + databaseURL + '"):', err && err.stack ? err.stack : err);
    throw new Error('Firebase Admin: URL do Realtime Database inválida (' + (err && err.message ? err.message : err) + ')', { cause: err });
  }
  return dbInstance;
}

// Firebase Authentication (Admin) — usado para validar o ID token do usuário
// logado no painel antes de aceitar um upload.
export function getAdminAuth() {
  getAdminDb(); // garante o initializeApp
  return getAuth(getApps()[0]);
}

// Bucket do Firebase Storage. Nome vem de FIREBASE_STORAGE_BUCKET ou é deduzido
// do project id (padrão dos projetos novos: <projectId>.firebasestorage.app).
export function getAdminBucket() {
  getAdminDb();
  const nome = limparEnv(process.env.FIREBASE_STORAGE_BUCKET)
    || (projectIdCache ? projectIdCache + '.firebasestorage.app' : '');
  if (!nome) throw new Error('Firebase Admin: bucket do Storage não configurado (FIREBASE_STORAGE_BUCKET).');
  return getStorage(getApps()[0]).bucket(nome);
}
