// api/gerar-pix.js
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Inicializa o Firebase Admin para conseguir atualizar o status do aluno de forma segura
if (!getApps().length) {
    initializeApp({
        credential: {
            // Pegaremos essas chaves seguras das variáveis de ambiente da Vercel
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = getDatabase();

export default async function handler(req, res) {
    // Permite requisições do seu site
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ROTA 1: GERAR O PIX (Chamada quando o aluno clica em "Gerar Pix Oficial")
    if (req.method === 'POST' && !req.body.action) {
        const { clienteId, nome, valor } = req.body;

        if (!clienteId || !valor) {
            return res.status(400).json({ erro: 'Dados incompletos' });
        }

        try {
            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `${clienteId}-${Date.now()}`
                },
                body: JSON.stringify({
                    transaction_amount: parseFloat(valor),
                    description: `Mensalidade - ${nome}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: `aluno_${clienteId}@funcionalari.com`
                    },
                    // Vinculamos o ID do cliente no metadata para o Mercado Pago nos devolver depois
                    metadata: {
                        cliente_id: clienteId
                    }
                })
            });

            const data = await mpResponse.json();

            if (!mpResponse.ok) {
                console.error("Erro MP:", data);
                return res.status(400).json({ erro: data.message || 'Erro ao gerar pagamento no Mercado Pago' });
            }

            const pointOfInteraction = data.point_of_interaction;
            const qrCodeBase64 = pointOfInteraction?.transaction_data?.qr_code_base64;
            const qrCode = pointOfInteraction?.transaction_data?.qr_code;

            return res.status(200).json({
                pagamento_id: data.id,
                qr_code_base64: qrCodeBase64,
                qr_code: qrCode
            });

        } catch (error) {
            console.error("Erro interno:", error);
            return res.status(500).json({ erro: 'Erro interno ao processar pagamento' });
        }
    }

    // ROTA 2: WEBHOOK (O Mercado Pago chama esta rota automaticamente quando o aluno paga)
    if (req.method === 'POST' && (req.body.action || req.query.topic === 'payment')) {
        const paymentId = req.body.data?.id || req.query.id;

        if (paymentId) {
            try {
                // Consulta o status do pagamento direto na API do Mercado Pago
                const checkResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
                    }
                });

                const paymentData = await checkResponse.json();

                if (paymentData.status === 'approved') {
                    const clienteId = paymentData.metadata?.cliente_id;

                    if (clienteId) {
                        // ATUALIZA O FIREBASE DIRETAMENTE PARA PAGO!
                        await db.ref(`clientes/${clienteId}`).update({
                            statusMensalidade: 'pago'
                        });
                        console.log(`Mensalidade do cliente ${clienteId} atualizada para PAGO com sucesso!`);
                    }
                }
            } catch (err) {
                console.error("Erro no webhook:", err);
            }
        }

        return res.status(200).json({ received: true });
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}