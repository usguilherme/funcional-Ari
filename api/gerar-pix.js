// api/gerar-pix.js
// Duas responsabilidades:
//   1. POST { clienteId, nome, valor }  -> cria uma cobrança Pix no Mercado Pago
//   2. Webhook do Mercado Pago          -> ao confirmar pagamento, marca a
//      mensalidade do aluno como "pago" no Realtime Database.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAdminDb } from './_firebase-admin.js';
import { ipDaRequisicao, limiteExcedido } from './_rate-limit.js';

const MP_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const VALOR_MAXIMO = Number(process.env.PIX_VALOR_MAXIMO || 2000);

// Só o site do estúdio pode pedir a geração de um Pix. Se ALLOWED_ORIGIN não
// estiver configurado (ou for "*"), não bloqueia — mantém o comportamento antigo
// em dev. O webhook do Mercado Pago NÃO passa por aqui (não tem header Origin).
function origemPermitida(req) {
  if (!ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*') return true;
  const permitidas = ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  if (origin) return permitidas.includes(origin);
  // Sem Origin (alguns navegadores em same-origin): cai no Referer.
  return permitidas.some(o => referer === o || referer.startsWith(o + '/'));
}

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

// Valida a assinatura x-signature enviada pelo Mercado Pago.
// Doc: manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
function webhookAssinaturaValida(req) {
  if (!MP_WEBHOOK_SECRET) {
    console.warn('MERCADO_PAGO_WEBHOOK_SECRET não configurado — pulando verificação de assinatura.');
    return true; // A reconsulta do pagamento na API do MP ainda serve de salvaguarda.
  }
  try {
    const assinatura = req.headers['x-signature'] || '';
    const requestId = req.headers['x-request-id'] || '';
    const partes = Object.fromEntries(
      assinatura.split(',').map(p => p.split('=').map(s => s.trim()))
    );
    const ts = partes.ts;
    const v1 = partes.v1;
    if (!ts || !v1) return false;

    const dataId = String(req.query['data.id'] || req.body?.data?.id || '').toLowerCase();
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const esperado = createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex');

    const a = Buffer.from(esperado, 'hex');
    const b = Buffer.from(v1, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch (e) {
    console.error('Erro ao validar assinatura do webhook:', e);
    return false;
  }
}

async function consultarPagamentoMP(paymentId) {
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` }
  });
  return resp.json();
}

export default async function handler(req, res) {
  aplicarCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  if (!MP_TOKEN) {
    console.error('MERCADO_PAGO_ACCESS_TOKEN não configurado.');
    return res.status(500).json({ erro: 'Pagamento indisponível: configuração ausente.' });
  }

  const body = req.body || {};
  const ehWebhook = !!body.action || req.query.type === 'payment' || req.query.topic === 'payment';

  // ================= ROTA 2: WEBHOOK =================
  if (ehWebhook) {
    if (!webhookAssinaturaValida(req)) {
      return res.status(401).json({ erro: 'Assinatura inválida' });
    }

    const paymentId = body.data?.id || req.query['data.id'] || req.query.id;
    if (!paymentId) return res.status(200).json({ received: true });

    try {
      const pagamento = await consultarPagamentoMP(paymentId);
      if (pagamento.status === 'approved') {
        const clienteId = pagamento.metadata?.cliente_id;
        if (clienteId) {
          const mesRef = new Date().toISOString().slice(0, 7); // YYYY-MM
          await getAdminDb().ref(`clientes/${clienteId}`).update({
            statusMensalidade: 'pago',
            mesPagamento: mesRef,
            ultimoPagamentoPixId: String(paymentId)
          });
          console.log(`Mensalidade do cliente ${clienteId} confirmada (pagamento ${paymentId}).`);
        }
      }
    } catch (err) {
      console.error('Erro no webhook:', err);
    }
    return res.status(200).json({ received: true });
  }

  // ================= ROTA 1: GERAR PIX =================
  // Trava básica: só o site oficial + limite de tentativas por IP.
  if (!origemPermitida(req)) {
    return res.status(403).json({ erro: 'Origem não autorizada.' });
  }
  const ip = ipDaRequisicao(req);
  if (limiteExcedido('pix:' + ip, 5, 60000)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
  }

  // Só o `clienteId` é confiável aqui. O VALOR e o NOME são buscados no banco —
  // nunca no corpo da requisição — para que ninguém consiga pagar R$ 1 e ficar
  // com a mensalidade marcada como "pago".
  const clienteId = String(body.clienteId == null ? '' : body.clienteId).trim();
  if (!clienteId || clienteId.length > 200 || /[.#$\[\]/\s\u0000-\u001f\u007f]/.test(clienteId)) {
    return res.status(400).json({ erro: 'clienteId inválido' });
  }

  let valorNum;
  let nomeAluno;
  try {
    const db = getAdminDb();
    const [snapCliente, snapServicos] = await Promise.all([
      db.ref('clientes/' + clienteId).once('value'),
      db.ref('servicos').once('value')
    ]);

    const cliente = snapCliente.val();
    if (!cliente || typeof cliente !== 'object') {
      return res.status(404).json({ erro: 'Aluno não encontrado' });
    }
    nomeAluno = String(cliente.nome || 'Aluno').slice(0, 80);

    const servicosVal = snapServicos.val();
    const servicos = servicosVal && typeof servicosVal === 'object' ? Object.values(servicosVal) : [];
    const plano = servicos.find(s => s && typeof s === 'object' && s.nome === cliente.frequencia);
    const preco = plano ? parseFloat(plano.preco) : NaN;

    if (!Number.isFinite(preco) || preco <= 0) {
      return res.status(422).json({
        erro: 'Não há um valor de mensalidade configurado para o seu plano. Fale com o estúdio.'
      });
    }
    valorNum = Number(preco.toFixed(2));
  } catch (err) {
    console.error('Erro ao apurar o valor da mensalidade:', err && err.stack ? err.stack : err);
    return res.status(500).json({ erro: 'Não foi possível apurar o valor da mensalidade agora.' });
  }

  if (valorNum > VALOR_MAXIMO) {
    return res.status(400).json({ erro: `Valor acima do limite permitido (R$ ${VALOR_MAXIMO}).` });
  }

  // Idempotência: o cliente manda uma chave estável por tentativa de pagamento
  // (reaproveitada em retry / duplo-clique). Sem ela, cai numa "janela" de 1h
  // por aluno — evita cobrança duplicada sem travar uma 2ª via legítima no dia
  // seguinte.
  const chaveCliente = String(body.idempotencyKey || '');
  const idempotencyKey = /^[A-Za-z0-9_-]{8,64}$/.test(chaveCliente)
    ? chaveCliente
    : `${clienteId}-${new Date().toISOString().slice(0, 13)}`;

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: valorNum,
        description: `Mensalidade - ${nomeAluno}`,
        payment_method_id: 'pix',
        payer: { email: `aluno_${clienteId.replace(/[^a-zA-Z0-9_-]/g, '')}@funcionalari.com` },
        metadata: { cliente_id: clienteId }
      })
    });

    const data = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Erro MP:', data);
      return res.status(400).json({ erro: data.message || 'Erro ao gerar pagamento no Mercado Pago' });
    }

    const td = data.point_of_interaction?.transaction_data;
    return res.status(200).json({
      pagamento_id: data.id,
      qr_code_base64: td?.qr_code_base64,
      qr_code: td?.qr_code
    });
  } catch (error) {
    console.error('Erro interno ao gerar Pix:', error);
    return res.status(500).json({ erro: 'Erro interno ao processar pagamento' });
  }
}
