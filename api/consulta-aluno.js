// api/consulta-aluno.js
// A "Área do Aluno" da vitrine consulta a mensalidade pelo telefone.
// Antes, a vitrine lia TODA a coleção /clientes no navegador (exigindo leitura
// pública do banco inteiro). Agora a busca acontece aqui no servidor e só os
// campos mínimos voltam para o site.
import { getAdminDb } from './_firebase-admin.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

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

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

export default async function handler(req, res) {
  aplicarCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const telefone = soDigitos(req.body?.telefone);
  if (telefone.length < 8) {
    return res.status(400).json({ erro: 'Telefone inválido' });
  }

  try {
    const db = getAdminDb();
    const [snapClientes, snapServicos] = await Promise.all([
      db.ref('clientes').once('value'),
      db.ref('servicos').once('value')
    ]);

    const clientes = snapClientes.val() || {};
    const servicos = Object.values(snapServicos.val() || {});
    const precoPorPlano = {};
    servicos.forEach(s => { precoPorPlano[s.nome] = parseFloat(s.preco) || 0; });

    const aluno = Object.values(clientes).find(c => {
      const t = soDigitos(c.telefone);
      return t.length >= 8 && t === telefone;
    });

    if (!aluno) {
      return res.status(404).json({ erro: 'Aluno não encontrado' });
    }

    return res.status(200).json({
      id: aluno.id,
      primeiroNome: String(aluno.nome || 'Aluno').split(' ')[0],
      statusMensalidade: aluno.statusMensalidade || 'atrasado',
      vencimento: aluno.vencimento || '10',
      plano: aluno.frequencia || '',
      valorPlano: precoPorPlano[aluno.frequencia] || 0
    });
  } catch (err) {
    console.error('Erro na consulta de aluno:', err);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
