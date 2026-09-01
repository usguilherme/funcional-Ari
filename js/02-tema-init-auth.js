    // 1.1 MODO CLARO/ESCURO
    // ==========================================
    function alternarTema() {
    const html = document.documentElement;
    const temaAtual = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const novoTema = temaAtual === 'light' ? 'dark' : 'light';

    if (novoTema === 'light') {
        html.setAttribute('data-theme', 'light');
    } else {
        html.removeAttribute('data-theme');
    }
    localStorage.setItem('tema', novoTema);
    atualizarIconeTema();

    // Redesenha os gráficos com as cores certas do novo tema
    if (typeof atualizarGraficos === 'function' && document.getElementById("chartTopServicos")) {
        atualizarGraficos();
    }
}

    function atualizarIconeTema() {
        const icone = document.getElementById('icone-tema');
        if (!icone) return;
        const temaAtual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        icone.setAttribute('data-lucide', temaAtual === 'light' ? 'moon' : 'sun');
        if (window.lucide) lucide.createIcons();
    }

    // ==========================================
    // 2. CONTROLE DE INICIALIZAÇÃO (NOVO)
    // ==========================================


    // Escuta o evento que vem do index.html quando os arquivos .html terminam de carregar
    document.addEventListener('sistemaPronto', () => {
        console.log("DOM Modular carregado.");
        htmlCarregado = true;
        
        // Inicia efeitos visuais
        lucide.createIcons();
        initRippleEffect();
        
        // Configura data do header
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateEl = document.getElementById("data-hoje");
        if(dateEl) dateEl.innerText = new Date().toLocaleDateString('pt-BR', options);

        atualizarIconeTema();

        tentarIniciarSistema();
    });

    // Listener de Autenticação do Firebase
    auth.onAuthStateChanged((user) => {
        const loader = document.getElementById("loader-overlay");
        
        if (user) {
            console.log("Logado como:", user.email);
            usuarioLogado = user;

            if(document.getElementById("user-email-display")) {
                document.getElementById("user-email-display").innerText = user.email;
            }

            // Esconde loader
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }

            // Verifica se precisa fechar login
            const deviceOverlay = document.getElementById('device-selection');
            if (deviceOverlay && deviceOverlay.style.display === 'none') {
                document.getElementById("login-overlay").style.display = 'none';
            }

            tentarIniciarSistema();

        } else {
            usuarioLogado = null;
            sistemaIniciado = false; // Reseta flag se deslogar
            
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }
        }
    });

    function tentarIniciarSistema() {
        if (htmlCarregado && usuarioLogado && !sistemaIniciado) {
            console.log("Iniciando lógica do sistema...");
            sistemaIniciado = true;
            initAgenda(); // Configura o input date da agenda
            inicializarSistema(); // Conecta com o Firebase
            
            // Define a data inicial do PDV como hoje
            const inputPDV = document.getElementById("pdv-data");
            if(inputPDV) inputPDV.value = new Date().toISOString().split('T')[0];
        }
    }

    // ==========================================
    // 3. LÓGICA DE SELEÇÃO DE DISPOSITIVO
    // ==========================================
    function escolherDispositivo(tipo) {
        const overlay = document.getElementById('device-selection');
        if (tipo === 'mobile') {
            document.body.classList.add('mobile-mode');
            setTimeout(() => lucide.createIcons(), 100);
        }
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            if (!auth.currentUser) {
                document.getElementById('login-overlay').style.display = 'flex';
            }
        }, 300);
    }

    // ==========================================
    // 4. FUNÇÕES DO SISTEMA
    // ==========================================

    function verificarSenha() {
        const email = document.getElementById("input-email").value.trim();
        const senha = document.getElementById("input-senha").value;
        const btn = document.querySelector('.btn-glow');
        const erro = document.getElementById("erro-senha");
        
        if(!email || !senha) {
            erro.style.display = "block";
            erro.innerText = "Preencha e-mail e senha";
            return;
        }
        btn.innerText = "CONECTANDO...";
        
        auth.signInWithEmailAndPassword(email, senha)
            .then(() => {
                btn.innerText = "SUCESSO!";
                erro.style.display = "none";
                document.getElementById("login-overlay").style.display = 'none';
            })
            .catch((error) => {
                erro.style.display = "block";
                erro.innerText = "Erro ao acessar.";
                btn.innerText = "ENTRAR";
            });
    }

    function logout() {
        auth.signOut().then(() => {
            location.reload();
        });
    }

    // O antigo resetarSistema() fazia db.ref('/').set(null) — apagava o banco
    // inteiro a partir de um botão no header de produção. Foi removido por ser
    // perigoso demais. Um reset completo, se necessário, deve ser feito
    // manualmente pelo console do Firebase.

    function fazerBackup() {
        if (typeof XLSX === 'undefined') {
            dispararToast("Erro: Biblioteca Excel não carregada.", "error");
            return;
        }

        const wb = XLSX.utils.book_new(); 
        const dataHoje = new Date().toISOString().split('T')[0];

        // --- ABA 1: CLIENTES ---
        const dadosClientes = store.clientes.map(c => ({
            "Nome": c.nome,
            "Telefone": c.telefone,
            "Pontos Fidelidade": c.pontos || 0,
            "Última Visita": formatarData(c.ultimaVisita),
            "Previsão Retorno": formatarData(c.previsaoRetorno),
            "Data Cadastro": c.dataCadastro ? formatarData(c.dataCadastro.split('T')[0]) : '-'
        }));
        const wsClientes = XLSX.utils.json_to_sheet(dadosClientes);
        XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes VIP");

        // --- ABA 2: VENDAS (ATENDIMENTOS) ---
        const dadosVendas = store.atendimentos.map(a => ({
            "Data": formatarData(a.data),
            "Hora": a.hora,
            "Cliente": a.nomeCliente,
            "Profissional": a.nomeProfissional || "-",
            "Itens Vendidos": a.servicos ? a.servicos.map(s => s.nome).join(", ") : "",
            "Total (R$)": a.total,
            "Forma Pagto": a.pagamento,
            "Observações": a.obs
        }));
        const wsVendas = XLSX.utils.json_to_sheet(dadosVendas);
        XLSX.utils.book_append_sheet(wb, wsVendas, "Relatório Vendas");

        // --- ABA 3: ESTOQUE ---
        const dadosEstoque = store.estoque.map(e => ({
            "Produto": e.nome,
            "Quantidade Atual": e.qtd,
            "Preço Venda (R$)": e.preco
        }));
        const wsEstoque = XLSX.utils.json_to_sheet(dadosEstoque);
        XLSX.utils.book_append_sheet(wb, wsEstoque, "Controle Estoque");

        // --- ABA 4: DESPESAS ---
        const dadosDespesas = store.despesas.map(d => ({
            "Data": formatarData(d.data),
            "Descrição": d.descricao,
            "Categoria": d.categoria,
            "Valor (R$)": d.valor
        }));
        const wsDespesas = XLSX.utils.json_to_sheet(dadosDespesas);
        XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas");

        // --- ABA 5: PROFISSIONAIS ---
        const dadosProfissionais = store.profissionais.map(p => ({
            "Nome": p.nome,
            "Especialidade": p.especialidade || "-",
            "Telefone": p.telefone || "-"
        }));
        const wsProfissionais = XLSX.utils.json_to_sheet(dadosProfissionais);
        XLSX.utils.book_append_sheet(wb, wsProfissionais, "Profissionais");

        // --- DOWNLOAD ---
        XLSX.writeFile(wb, `Gestao_FuncionalDoAri_${dataHoje}.xlsx`);
        dispararToast("📁 Planilha Excel gerada e baixada!");
    }

    function initRippleEffect() {
        document.addEventListener('click', function (e) {
            const target = e.target.closest('.btn-primary, .btn-glow, .btn-checkout, .btn-danger, .device-option, .nav-item, .mobile-nav-item');
            if (target) {
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                const rect = target.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
                target.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            }
        });
    }

    function inicializarSistema() {
        console.log("Conectando Listeners do Firebase...");
        
        // --- INJEÇÃO DO SKELETON ENQUANTO CARREGA ---
        const tbodyClientes = document.getElementById("tabela-clientes");
        if(tbodyClientes) tbodyClientes.innerHTML = `<tr><td colspan="5"><div class="skeleton skeleton-box"></div><div class="skeleton skeleton-box"></div></td></tr>`;
        
        const agendaDiv = document.getElementById("lista-agenda");
        if(agendaDiv) agendaDiv.innerHTML = `<div class="skeleton skeleton-box"></div><div class="skeleton skeleton-box"></div>`;
        
        // Proteção dos 4 Cards Superiores com Skeletons
        const metricasIds = ["dash-faturamento", "dash-atendimentos", "dash-retornos", "dash-pontos"];
        metricasIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<div class="skeleton" style="height: 28px; width: 70%; margin-top: 5px; border-radius: 6px;"></div>`;
        });
        // --------------------------------------------

        // --- NOVO: OUVINTE DO PAINEL TV ---
        db.ref('painel_tv').on('value', snap => {
            const data = snap.val();
            if (data) {
                // Toca o som (certifique-se que o arquivo está em assets/ding.mp3)
                const audio = new Audio('assets/ding.mp3'); 
                audio.play().catch(e => console.log("Aguardando interação do usuário para áudio"));
                
                // Atualiza o visual na TV
                atualizarVisualModoTV(data.nome);
            }
        });

        // CARREGAR CONFIGURAÇÕES
        db.ref('config').on('value', snap => {
            if(snap.val()) {
                configSistema = snap.val();
            }
        });

        // NOVO: CARREGAR CONFIGURAÇÃO DA VITRINE (LANDING PAGE PÚBLICA)
        db.ref('landingConfig').on('value', snap => {
            landingConfig = snap.val() || {};
            preencherFormularioLanding();
        });

        // NOVO: AULÕES / EVENTOS ESPECIAIS DA VITRINE
        db.ref('vitrine_eventos').on('value', snap => {
            eventosVitrine = snap.val() ? Object.values(snap.val()) : [];
            if (typeof renderListaEventosVitrine === 'function') renderListaEventosVitrine();
        });
        
        db.ref('servicos').on('value', snap => {
            store.servicos = snap.val() ? Object.values(snap.val()) : [];
            renderServicosPDV();
            renderListaServicosCad();
            if (typeof renderSelectPlanosAluno === 'function') renderSelectPlanosAluno(); // 👈 Atualiza a lista de planos no cadastro do aluno
            // Preços de plano dependem de servicos: recalcula os painéis financeiros.
            atualizarKPIs();
            if (typeof renderPainelCobrancas === 'function') renderPainelCobrancas();
        });

        db.ref('clientes').on('value', snap => {
            store.clientes = snap.val() ? Object.values(snap.val()) : [];
            resetarMensalidadesDoMes();
            renderClientesPDV();
            renderTabelaClientes();
            atualizarKPIs();
            filtrarRetornosDashboard();
            renderAniversariantesDashboard();
            if (typeof renderPainelCobrancas === 'function') renderPainelCobrancas();
            
            // Atualiza a tabela na aba de Atualização instantaneamente
            if (typeof renderTabelaAtualizacao === 'function') renderTabelaAtualizacao();
            if (typeof renderTabelaAvaliacoes === 'function') renderTabelaAvaliacoes();
        });

        // Janela de dados: em vez de um número fixo de registros (que fazia
        // relatórios ficarem silenciosamente incompletos), carregamos tudo a
        // partir de ~24 meses atrás — cobre qualquer relatório real e continua
        // limitado. Requer índice em "timestamp" (ver database.rules.json).
        const CORTE_HISTORICO_MS = Date.now() - 1000 * 60 * 60 * 24 * 730;

        db.ref('atendimentos').orderByChild('timestamp').startAt(CORTE_HISTORICO_MS).on('value', snap => {
            store.atendimentos = snap.val() ? Object.values(snap.val()) : [];
            atualizarKPIs();
            renderTabelaFinanceiro();
            atualizarGraficos();
            renderAgenda();
            if (typeof renderPainelCobrancas === 'function') renderPainelCobrancas();

            // --- NOVO: CHECA SE TEM GENTE PARA AMANHÃ ---
            verificarNotificacoes();
        });

        // Despesas usam a própria chave (novoId/Date.now baseada em tempo) para o corte.
        db.ref('despesas').orderByKey().startAt(String(CORTE_HISTORICO_MS)).on('value', snap => {
            store.despesas = snap.val() ? Object.values(snap.val()) : [];
            renderTabelaFinanceiro();
            renderListaGestaoDespesas();
            atualizarKPIs();
        });

        // Vales / adiantamentos do RH (antes era registrado no load do módulo 13,
        // rodando antes da autenticação).
        db.ref('vales').on('value', snap => {
            store.vales = [];
            snap.forEach(child => {
                store.vales.push({ id: child.key, ...child.val() });
            });
            if (typeof renderizarValesRH === 'function') renderizarValesRH();
        });

        // NOVO: Estoque
        db.ref('estoque').on('value', snap => {
            store.estoque = snap.val() ? Object.values(snap.val()) : [];
            renderEstoque();
            renderServicosPDV(); 
        });

        // NOVO: Profissionais
        db.ref('profissionais').on('value', snap => {
            store.profissionais = snap.val() ? Object.values(snap.val()) : [];
            sincronizarProfissionaisPublicos();
            renderListaProfissionaisCad();
            renderSelectsProfissionais();
            renderAgenda();
            renderTabelaFinanceiro();
            atualizarKPIs();
            atualizarGraficos();
            renderTabelaClientes();
            if (typeof inicializarDadosRH === 'function') inicializarDadosRH();
        });

        // Agendamentos vindos da página pública (fila para confirmação + aulas
        // já confirmadas que aparecem na agenda do dia).
        db.ref('agendamentos_publicos').on('value', snap => {
            store.agendamentosPublicos = [];
            snap.forEach(child => {
                store.agendamentosPublicos.push({ id: child.key, ...child.val() });
            });
            if (typeof renderAgendamentosPublicos === 'function') renderAgendamentosPublicos();
            if (typeof renderAgenda === 'function') renderAgenda();
        });

        // Limpeza única de dados que cresciam para sempre.
        limparDisponibilidadeAntiga();
    }

    // Mantém profissionais_publicos = { id: nome } sincronizado. Essa é a lista
    // que a página pública de agendamento consome (sem expor telefone/comissão).
    function sincronizarProfissionaisPublicos() {
        const mapa = {};
        (store.profissionais || []).forEach(p => { mapa[p.id] = p.nome || ""; });
        db.ref('profissionais_publicos').set(mapa).catch(err => console.error("Sync profissionais públicos:", err));
    }

    // Remove os registros de "disponibilidade" (horários ocupados) de datas
    // que já passaram — antes esse nó só crescia.
    function limparDisponibilidadeAntiga() {
        const hoje = new Date().toISOString().split('T')[0];
        db.ref('disponibilidade').once('value').then(snap => {
            const dados = snap.val();
            if (!dados) return;
            const remocoes = {};
            Object.keys(dados).forEach(data => {
                if (data < hoje) remocoes[data] = null;
            });
            if (Object.keys(remocoes).length) {
                db.ref('disponibilidade').update(remocoes).catch(err => console.error("Limpeza de disponibilidade:", err));
            }
        }).catch(err => console.error("Limpeza de disponibilidade:", err));
    }

    // ==========================================
    // RESET MENSAL DO STATUS DE MENSALIDADE
    // ==========================================
    // Antes, statusMensalidade='pago' nunca voltava: o aluno ficava "em dia"
    // para sempre e o financeiro somava a mesma receita todo mês.
    // Agora, ao marcar como pago gravamos também "mesPagamento" (YYYY-MM).
    // Ao carregar o sistema, quem foi pago num mês anterior volta para 'atrasado'.
    let resetMensalidadesFeito = false;
    function resetarMensalidadesDoMes() {
        if (resetMensalidadesFeito) return;
        if (!store.clientes || store.clientes.length === 0) return;
        resetMensalidadesFeito = true;

        const mesAtual = mesReferenciaAtual();
        const updates = {};
        store.clientes.forEach(c => {
            if (c.statusMensalidade !== 'pago') return;
            // Reseta se o pagamento foi registrado num mês anterior — ou se é um
            // registro antigo sem mês de pagamento (dado legado, considerado vencido).
            const pagoEmMesAnterior = !c.mesPagamento || c.mesPagamento < mesAtual;
            if (pagoEmMesAnterior) {
                updates[`${c.id}/statusMensalidade`] = 'atrasado';
                if (c.mesPagamento) updates[`${c.id}/mesPagamentoAnterior`] = c.mesPagamento;
            }
        });

        if (Object.keys(updates).length) {
            db.ref('clientes').update(updates).catch(err => console.error("Reset mensal:", err));
        }
    }

    // ==========================================
