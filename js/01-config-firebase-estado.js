    // ==========================================
    // 1. CONFIGURAÇÃO GERAL E FIREBASE REAL
    // ==========================================
    const firebaseConfig = {
        apiKey: "AIzaSyBY4nfykJETa-Vw6E5TLOVAkuPVXva0Bx4",
        authDomain: "funcional-ari.firebaseapp.com",
        projectId: "funcional-ari",
        storageBucket: "funcional-ari.firebasestorage.app",
        messagingSenderId: "790601708418",
        appId: "1:790601708418:web:048f04d9d498096460159b"
    };

    // Inicializa o Firebase com as chaves reais
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.database();
    const auth = firebase.auth();
    // NÃO usamos Firebase Storage. O upload direto do navegador esbarra em CORS
    // no bucket e trava o cadastro em "Comprimindo e salvando...". Todas as
    // imagens são comprimidas aqui no cliente e salvas como string base64
    // (data URL) direto no Realtime Database — ver uploadImagem() abaixo.

    let configSistema = {
        chavePix: "",
        nomePix: "",
        cidadePix: "",
        metaMensal: 0
    };
    let landingConfig = {};

    // Estado Global
    let store = {
        servicos: [],
        clientes: [],
        atendimentos: [],
        despesas: [],
        estoque: [],
        profissionais: [],
        vales: [],
        agendamentosPublicos: [],
        carrinho: []
    };

    // Variáveis de Controle
    let chartTop = null;
    let chartSemana = null;
    let idDespesaEdicao = null;
    let idServicoEdicao = null;
    let idAtendimentoEdicao = null;
    let idProdutoEdicao = null;
    let idClienteEdicao = null;
    let idProfissionalEdicao = null;
    let clienteAnamneseAtual = null;

    // Controle de Item Pendente (Novo Preço)
    let itemPendente = null;

    // Controle de Carregamento (HTML Modular)
    let htmlCarregado = false;
    let usuarioLogado = null;
    let sistemaIniciado = false; // Evita rodar inicializarSistema 2x

    // ==========================================
    // HELPERS COMPARTILHADOS
    // ==========================================

    // Gera um ID numérico único. Usar Date.now() puro permitia colisão quando
    // dois cadastros aconteciam no mesmo milissegundo (perda de dados). Aqui
    // multiplicamos por 1000 e somamos um sufixo aleatório, mantendo o valor
    // dentro de Number.MAX_SAFE_INTEGER e compatível com os registros antigos.
    function novoId() {
        return Date.now() * 1000 + Math.floor(Math.random() * 1000);
    }

    // escapeHtml / escapeAttr / soDigitos / formatarData vivem em js/00-utils.js
    // (carregado antes deste arquivo).

    // Preço do plano de um aluno: fonte única de verdade = cadastro de serviços.
    // c.frequencia guarda o NOME do serviço escolhido no cadastro do aluno.
    function getPrecoPlano(cliente) {
        if (!cliente || !cliente.frequencia) return 0;
        const servico = (store.servicos || []).find(s => s.nome === cliente.frequencia);
        if (servico) return parseFloat(servico.preco) || 0;
        return 0;
    }

    // Retorna o mês de referência (YYYY-MM) atual.
    function mesReferenciaAtual() {
        return new Date().toISOString().slice(0, 7);
    }

    // Um atendimento só conta como receita quando foi realmente concretizado.
    // Agendamentos vindos da página pública entram como "Pendente" /
    // "Aguardando Confirmação" e NÃO devem inflar o faturamento.
    function atendimentoConfirmado(a) {
        if (!a) return false;
        if (a.pagamento === 'Pendente') return false;
        if (a.status === 'Aguardando Confirmação') return false;
        return true;
    }

    // Comprime uma imagem no canvas e devolve um Blob JPEG leve.
    // Reduz qualidade/tamanho progressivamente até caber em ~180 KB, para a
    // string base64 resultante (~33% maior) não inchar o Realtime Database.
    function comprimirImagem(file, larguraMax = 800, qualidade = 0.7) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            if (!/^image\//.test(file.type || "")) {
                return reject(new Error("O arquivo selecionado não é uma imagem."));
            }
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
                img.onload = () => {
                    const gerarBlob = (largura, q) => new Promise((res, rej) => {
                        const canvas = document.createElement('canvas');
                        const escala = img.width > largura ? largura / img.width : 1;
                        canvas.width = Math.max(1, Math.round(img.width * escala));
                        canvas.height = Math.max(1, Math.round(img.height * escala));
                        const ctx = canvas.getContext('2d');
                        // Fundo branco: JPEG não tem transparência (evita PNGs "pretos").
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(
                            (blob) => blob ? res(blob) : rej(new Error("Falha ao compactar imagem")),
                            'image/jpeg',
                            q
                        );
                    });

                    (async () => {
                        const ALVO_BYTES = 180 * 1024;
                        let largura = larguraMax;
                        let q = qualidade;
                        let blob = await gerarBlob(largura, q);
                        let tentativas = 0;
                        while (blob.size > ALVO_BYTES && tentativas < 7) {
                            tentativas++;
                            if (q > 0.45) q -= 0.12;
                            else largura = Math.round(largura * 0.82);
                            blob = await gerarBlob(largura, q);
                        }
                        resolve(blob);
                    })().catch(reject);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function blobParaDataURL(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(new Error("Falha ao converter a imagem"));
            r.onloadend = () => resolve(r.result);
            r.readAsDataURL(blob);
        });
    }

    // Comprime a imagem no navegador e devolve uma string base64 (data URL),
    // que é salva DIRETO no Realtime Database. Não há upload para servidor.
    // O parâmetro `pasta` é mantido só por compatibilidade de assinatura.
    async function uploadImagem(file, pasta, larguraMax = 800, qualidade = 0.7) {
        const processar = (async () => {
            const blob = await comprimirImagem(file, larguraMax, qualidade);
            if (!blob) return null;
            const dataUrl = await blobParaDataURL(blob);
            // Trava final: data URLs gigantes incham o banco e os listeners.
            if (dataUrl && dataUrl.length > 950000) {
                throw new Error("Imagem muito pesada mesmo após compressão. Escolha uma foto menor.");
            }
            return dataUrl;
        })();

        // Nunca deixa o botão preso: se algo travar, rejeita em 20s.
        let timer;
        const timeout = new Promise((_, rej) => {
            timer = setTimeout(() => rej(new Error("Tempo esgotado ao processar a imagem.")), 20000);
        });
        processar.catch(() => {}); // evita "unhandled rejection" se o timeout vencer
        try {
            return await Promise.race([processar, timeout]);
        } finally {
            clearTimeout(timer);
        }
    }

    // ==========================================
