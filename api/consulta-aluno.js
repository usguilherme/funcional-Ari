// api/consulta-aluno.js
// A "Área do Aluno" (area-aluno.html) consulta os dados do aluno pelo telefone.
// A busca acontece no servidor (Firebase Admin) e só os campos necessários
// voltam para o site — o navegador nunca lê a coleção /clientes inteira.
import { getAdminDb } from './_firebase-admin.js';
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const paraLista = (v) => (v && typeof v === 'object') ? Object.values(v) : (Array.isArray(v) ? v : []);

// Lê o corpo da requisição de forma tolerante. Dependendo do runtime da Vercel
// e do Content-Type, `req.body` pode vir:
//   - já como objeto  (application/json parseado automaticamente)
//   - como string      (JSON cru, ou form-urlencoded)
//   - como Buffer
//   - undefined         (o runtime não parseou nada -> lemos o stream cru)
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
    const s = b.trim();
    try { return JSON.parse(s); } catch { /* tenta querystring abaixo */ }
    try { return Object.fromEntries(new URLSearchParams(s)); } catch { /* ignora */ }
  }
  return {};
}

export default async function handler(req, res) {
  aplicarCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // O front-end (area-aluno.html) chama via POST com { telefone } no corpo.
  // GET com ?telefone=... também é aceito (teste direto no navegador).
  // Lemos das duas fontes independentemente do método, para não depender de
  // qual delas o runtime/proxy preencheu.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido', metodoRecebido: req.method });
  }

  const corpo = await lerCorpo(req);
  const query = req.query || {};
  const telefoneBruto = corpo.telefone ?? query.telefone ?? corpo.phone ?? query.phone;

  // Trava básica contra enumeração de números: limite de consultas por IP.
  const ip = ipDaRequisicao(req);
  if (limiteExcedido('consulta:' + ip, 20, 60000)) {
    return res.status(429).json({ erro: 'Muitas consultas. Aguarde um minuto e tente novamente.' });
  }

  const telefone = soDigitos(telefoneBruto);
  if (telefone.length < 8) {
    const debug = String(process.env.EXPOR_ERRO_CONFIG || '').toLowerCase() === 'true';
    return res.status(400).json({
      erro: 'Telefone inválido',
      ...(debug ? {
        metodo: req.method,
        recebidoDoCorpo: corpo.telefone ?? null,
        recebidoDaQuery: query.telefone ?? null,
        chavesCorpo: Object.keys(corpo),
        contentType: req.headers['content-type'] || null
      } : {})
    });
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
    const servicos = paraLista(snapServicos.val()).filter(s => s && typeof s === 'object');
    const precoPorPlano = {};
    servicos.forEach(s => { if (s.nome) precoPorPlano[s.nome] = parseFloat(s.preco) || 0; });

    const aluno = Object.values(clientes).find(c => {
      if (!c || typeof c !== 'object') return false;
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
    // Stack completo no log da Vercel — inclui a causa original (OpenSSL,
    // decodificação do base64, initializeApp) quando existir.
    console.error('Erro na consulta de aluno:', err && err.stack ? err.stack : err);
    if (err && err.cause) {
      console.error('  causa:', err.cause && err.cause.stack ? err.cause.stack : err.cause);
    }

    const ehConfig = /vari[aá]veis de ambiente|formato inv[aá]lido|inicializar|cabe[çc]alho PEM|Firebase Admin/i.test((err && err.message) || '');

    // EXPOR_ERRO_CONFIG=true faz a API devolver o motivo exato no corpo da
    // resposta (aparece no console do navegador). Use só para diagnosticar e
    // depois volte para "false" — a mensagem pode conter detalhes internos.
    const exporDetalhe = String(process.env.EXPOR_ERRO_CONFIG || '').toLowerCase() === 'true';

    return res.status(500).json({
      erro: ehConfig
        ? 'Consulta indisponível no momento (configuração do servidor). Fale com o estúdio.'
        : 'Erro interno',
      ...(exporDetalhe ? { detalhe: (err && err.message) || String(err) } : {})
    });
  }
}
