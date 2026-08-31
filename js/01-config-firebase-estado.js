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
    // Storage é usado para guardar as imagens (fotos de alunos, galeria e vitrine)
    // fora do Realtime Database, evitando inchar o banco e o tráfego dos listeners.
    const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;

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

    // Escapa texto vindo do banco antes de injetar em innerHTML.
    // Vários campos (nome do aluno, observações, nome de serviço) podem ser
    // preenchidos pela página pública de agendamento, então precisam ser tratados.
    function escapeHtml(valor) {
        if (valor === null || valor === undefined) return "";
        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Escapa um valor para uso dentro de atributo entre aspas simples de um onclick.
    function escapeAttr(valor) {
        return escapeHtml(valor).replace(/\\/g, "&#92;");
    }

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
    function comprimirImagem(file, larguraMax = 800, qualidade = 0.7) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const escala = img.width > larguraMax ? larguraMax / img.width : 1;
                    canvas.width = Math.round(img.width * escala);
                    canvas.height = Math.round(img.height * escala);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(
                        (blob) => blob ? resolve(blob) : reject(new Error("Falha ao compactar imagem")),
                        'image/jpeg',
                        qualidade
                    );
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Faz upload da imagem para o Firebase Storage e devolve a URL pública.
    // Se o Storage não estiver disponível (SDK não carregado), cai para dataURL
    // como último recurso para não travar o cadastro.
    async function uploadImagem(file, pasta, larguraMax = 800, qualidade = 0.7) {
        const blob = await comprimirImagem(file, larguraMax, qualidade);
        if (!blob) return null;

        if (!storage) {
            return await new Promise((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result);
                r.readAsDataURL(blob);
            });
        }

        const caminho = `${pasta}/${novoId()}.jpg`;
        const ref = storage.ref().child(caminho);
        await ref.put(blob, { contentType: 'image/jpeg' });
        return await ref.getDownloadURL();
    }

    // ==========================================
