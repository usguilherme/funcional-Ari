// api/gerar-pix.js
// Duas responsabilidades:
//   1. POST { clienteId, nome, valor }  -> cria uma cobrança Pix no Mercado Pago
//   2. Webhook do Mercado Pago          -> ao confirmar pagamento, marca a
//      mensalidade do aluno como "pago" no Realtime Database.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAdminDb } from './_firebase-admin.js';

const MP_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const VALOR_MAXIMO = Number(process.env.PIX_VALOR_MAXIMO || 2000);

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
  const { clienteId, nome, valor } = body;
  const valorNum = parseFloat(valor);

  if (clienteId === undefined || clienteId === null || String(clienteId).length === 0) {
    return res.status(400).json({ erro: 'clienteId obrigatório' });
  }
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    return res.status(400).json({ erro: 'Valor inválido' });
  }
  if (valorNum > VALOR_MAXIMO) {
    return res.status(400).json({ erro: `Valor acima do limite permitido (R$ ${VALOR_MAXIMO}).` });
  }

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${clienteId}-${Date.now()}`
      },
      body: JSON.stringify({
        transaction_amount: Number(valorNum.toFixed(2)),
        description: `Mensalidade - ${String(nome || '').slice(0, 80) || 'Aluno'}`,
        payment_method_id: 'pix',
        payer: { email: `aluno_${String(clienteId).replace(/[^a-zA-Z0-9_-]/g, '')}@funcionalari.com` },
        metadata: { cliente_id: String(clienteId) }
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
