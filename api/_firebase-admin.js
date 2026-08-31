// Inicialização compartilhada do Firebase Admin para as funções serverless.
// As credenciais vêm de variáveis de ambiente na Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY        (com \n escapados)
//   FIREBASE_DATABASE_URL       (ex: https://funcional-ari-default-rtdb.firebaseio.com)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let dbInstance = null;

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error('Credenciais do Firebase Admin ausentes nas variáveis de ambiente.');
  }

  if (!getApps().length) {
    initializeApp({
      // cert() constrói uma Credential válida — passar um objeto simples
      // em "credential" (como estava antes) falha na autenticação.
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL
    });
  }

  dbInstance = getDatabase();
  return dbInstance;
}
