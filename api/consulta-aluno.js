// api/consulta-aluno.js
// A "Área do Aluno" (area-aluno.html) consulta os dados do aluno pelo telefone.
// A busca acontece no servidor (Firebase Admin) e só os campos necessários
// voltam para o site — o navegador nunca lê a coleção /clientes inteira.
import { getAdminDb } from './_firebase-admin.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

// As anotações técnicas do professor (aba "Ficha do Aluno" no painel) podem
// conter informação sensível de saúde. Como a Área do Aluno é identificada só
// pelo WhatsApp (sem senha), o texto das anotações só é exposto se esta
// variável for "true". Os títulos e datas (ex.: "Avaliação física — 10/03")
// sempre aparecem, pois servem de linha do tempo e não são sensíveis.
const EXPOR_NOTAS_PROFESSOR = String(process.env.EXPOR_NOTAS_PROFESSOR || '').toLowerCase() === 'true';

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
const paraLista = (v) => (v && typeof v === 'object') ? Object.values(v) : (Array.isArray(v) ? v : []);

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
    const [snapClientes, snapServicos, snapAtend, snapConfig] = await Promise.all([
      db.ref('clientes').once('value'),
      db.ref('servicos').once('value'),
      db.ref('atendimentos').once('value'),
      db.ref('landingConfig').once('value')
    ]);

    const clientes = snapClientes.val() || {};
    const servicos = paraLista(snapServicos.val());
    const precoPorPlano = {};
    servicos.forEach(s => { precoPorPlano[s.nome] = parseFloat(s.preco) || 0; });

    const aluno = Object.values(clientes).find(c => {
      const t = soDigitos(c.telefone);
      return t.length >= 8 && t === telefone;
    });

    if (!aluno) {
      return res.status(404).json({ erro: 'Aluno não encontrado' });
    }

    const planoAluno = servicos.find(s => s.nome === aluno.frequencia) || null;

    // Histórico de compras/serviços do aluno (PDV) — últimos 30 registros.
    const atendimentos = paraLista(snapAtend.val())
      .filter(a => a && String(a.clienteId) === String(aluno.id))
      .map(a => ({
        data: a.data || '',
        total: Number(a.total) || 0,
        pagamento: a.pagamento || '',
        itens: paraLista(a.servicos).map(s => s && s.nome).filter(Boolean)
      }))
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, 30);

    // Galeria de evolução (fotos enviadas pelo professor).
    const galeria = paraLista(aluno.galeria)
      .map(f => ({ data: f.data || '', desc: f.desc || '', img: f.img || '' }))
      .filter(f => f.img);

    // Linha do tempo — títulos/datas sempre; texto só se EXPOR_NOTAS_PROFESSOR.
    const historico = paraLista(aluno.historico)
      .map(h => ({
        data: h.data || '',
        titulo: h.titulo || 'Registro',
        obs: EXPOR_NOTAS_PROFESSOR ? (h.obs || '') : ''
      }));

    const cfg = snapConfig.val() || {};

    return res.status(200).json({
      // --- identificação / perfil ---
      id: aluno.id,
      nome: aluno.nome || 'Aluno',
      primeiroNome: String(aluno.nome || 'Aluno').split(' ')[0],
      foto: aluno.foto || '',
      sexo: aluno.sexo || '',
      idade: aluno.idade || '',
      objetivo: aluno.objetivo || '',
      tempoTreino: aluno.tempoTreino || '',
      inicio: aluno.inicio || '',
      dataNasc: aluno.dataNasc || '',
      dataCadastro: aluno.dataCadastro || '',

      // --- plano / mensalidade ---
      plano: aluno.frequencia || '',
      planoDescricao: planoAluno?.descricao || '',
      vencimento: aluno.vencimento || '10',
      statusMensalidade: aluno.statusMensalidade || 'atrasado',
      mesPagamento: aluno.mesPagamento || '',
      valorPlano: precoPorPlano[aluno.frequencia] || 0,

      // --- engajamento ---
      pontos: Number(aluno.pontos) || 0,
      linkDrive: typeof aluno.linkDrive === 'string' ? aluno.linkDrive.trim() : '',
      galeria,
      historico,
      atendimentos,

      // --- catálogo e dados do estúdio ---
      planos: servicos
        .map(s => ({ nome: s.nome || '', preco: parseFloat(s.preco) || 0, descricao: s.descricao || '', destaque: !!s.destaque }))
        .filter(s => s.nome),
      estudio: {
        nome: cfg.titulo ? String(cfg.titulo) : 'Funcional do Ari',
        whatsapp: cfg.whatsapp || '',
        instagram: cfg.instagram || '',
        endereco: cfg.endereco || '',
        googleMapsUrl: cfg.googleMapsUrl || '',
        horarios: cfg.horariosAluno || 'Segunda, Quarta e Sexta · 19h20 às 20h20',
        recado: cfg.recadoAluno || ''
      }
    });
  } catch (err) {
    console.error('Erro na consulta de aluno:', err);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
