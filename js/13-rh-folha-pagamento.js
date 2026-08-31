    // ==========================================
    // 20. MÓDULO FOLHA DE PAGAMENTO / RH
    // ==========================================

    function trocarAbaRH(abaId, btnElement) {
        // Esconde todas as abas internas do RH
        const abas = ['contratos', 'vales', 'fechamento'];
        abas.forEach(a => {
            const el = document.getElementById('tab-rh-' + a);
            if(el) el.style.display = 'none';
        });
        
        // Mostra a aba clicada
        const abaAlvo = document.getElementById('tab-rh-' + abaId);
        if(abaAlvo) abaAlvo.style.display = 'block';
        
        // Atualiza a classe visual dos botões
        const botoes = btnElement.parentElement.querySelectorAll('.tab-btn');
        botoes.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // ==========================================
    // 20. MÓDULO FOLHA DE PAGAMENTO / RH (LÓGICA)
    // ==========================================

    // O listener de 'vales' agora vive em inicializarSistema() (módulo 02), junto
    // com os outros e só depois da autenticação. Antes rodava no load deste
    // arquivo, antes do login, e batia nas regras do banco.

    // Essa função preenche as caixas de seleção com o nome das profissionais
    function inicializarDadosRH() {
        const selectVale = document.getElementById("vale-prof");
        const selectFechamento = document.getElementById("fechamento-prof");
        const tabelaContratos = document.getElementById("tabela-rh-contratos");

        if(!selectVale || !tabelaContratos) return;

        let optionsHTML = '<option value="">Selecione a Profissional...</option>';
        let contratosHTML = '';

        store.profissionais.forEach(p => {
            optionsHTML += `<option value="${escapeAttr(p.id)}">${escapeHtml(p.nome)}</option>`;
            contratosHTML += `
                <tr>
                    <td><strong>${escapeHtml(p.nome)}</strong></td>
                    <td><span class="badge" style="background:#3b82f620; color:#3b82f6; font-size:10px;">COMISSIONADO</span></td>
                    <td><strong style="color:var(--success)">${Number(p.comissao) || 0}%</strong></td>
                    <td><button class="btn-small bg-yellow" onclick="abrirAba('profissionais')" title="Editar na aba Profissionais"><i data-lucide="pencil" style="width:14px"></i></button></td>
                </tr>
            `;
        });

        selectVale.innerHTML = optionsHTML;
        selectFechamento.innerHTML = optionsHTML;
        tabelaContratos.innerHTML = contratosHTML;
        
        if (window.lucide) lucide.createIcons();
    }

    // Quando abrir a aba do RH, ele carrega os dados atualizados
    document.addEventListener("sistemaPronto", inicializarDadosRH);
    const observerRH = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if(m.target.id === 'rh' && m.target.style.display !== 'none') {
                inicializarDadosRH();
            }
        });
    });
    if(document.getElementById('rh')) observerRH.observe(document.getElementById('rh'), { attributes: true, attributeFilter: ['style'] });


    function lancarVale() {
        const profId = document.getElementById("vale-prof").value;
        const valor = parseFloat(document.getElementById("vale-valor").value);
        const data = document.getElementById("vale-data").value;

        if(!profId || isNaN(valor) || valor <= 0 || !data) {
            return dispararToast("Preencha todos os campos para lançar o vale.", "error");
        }

        // Valor do <select> é sempre string; o id salvo é número. Comparação frouxa.
        const prof = store.profissionais.find(p => p.id == profId);
        if (!prof) return dispararToast("Instrutor não encontrado.", "error");

        db.ref('vales').push({
            profissionalId: profId,
            nomeProfissional: prof.nome,
            valor: valor,
            data: data,
            timestamp: Date.now()
        }).then(() => {
            dispararToast(`Vale de R$ ${valor.toFixed(2)} lançado para ${prof.nome}!`);
            document.getElementById("vale-valor").value = "";
            document.getElementById("vale-data").value = "";
        }).catch(erro => {
            console.error("Erro ao lançar vale:", erro);
            dispararToast("Erro ao conectar com o banco de dados.", "error");
        });
    }

    function renderizarValesRH() {
        const tbody = document.getElementById("tabela-rh-vales");
        if(!tbody) return;

        if(store.vales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Nenhum vale registrado no sistema.</td></tr>';
            return;
        }

        const valesOrdenados = [...store.vales].sort((a,b) => b.timestamp - a.timestamp);

        tbody.innerHTML = valesOrdenados.map(v => {
            const dataFormatada = typeof v.data === 'string' ? v.data.split('-').reverse().join('/') : '';
            return `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><strong>${escapeHtml(v.nomeProfissional)}</strong></td>
                    <td style="color:var(--danger); font-weight:bold;">- R$ ${(Number(v.valor) || 0).toFixed(2)}</td>
                    <td><button class="btn-small bg-purple" onclick="if(confirm('Excluir este vale?')) db.ref('vales/${escapeAttr(v.id)}').remove()" title="Excluir Vale"><i data-lucide="trash-2" style="width:14px"></i></button></td>
                </tr>
            `;
        }).join('');
        
        if (window.lucide) lucide.createIcons();
    }

    function calcularFolha() {
        const mesInput = document.getElementById("fechamento-mes").value; // Formato: "YYYY-MM"
        const profId = document.getElementById("fechamento-prof").value;
        const divResultado = document.getElementById("resultado-folha");

        if(!mesInput || !profId) {
            return dispararToast("Selecione o mês e a profissional para gerar a folha.", "error");
        }

        const profissional = store.profissionais.find(p => p.id == profId);
        if(!profissional) return dispararToast("Instrutor não encontrado.", "error");

        const percentualComissao = parseFloat(profissional.comissao) || 0;

        // 1. Filtrar Atendimentos do Mês selecionado para essa profissional
        //    (somente atendimentos concretizados — agendamentos públicos pendentes
        //    não entram no cálculo de comissão)
        const atendimentosMes = store.atendimentos.filter(a => {
            return a.profissionalId == profId
                && typeof a.data === 'string' && a.data.startsWith(mesInput)
                && atendimentoConfirmado(a);
        });

        // 2. Filtrar Vales do Mês selecionado para essa profissional
        const valesMes = store.vales.filter(v => {
            return v.profissionalId == profId && typeof v.data === 'string' && v.data.startsWith(mesInput);
        });

        // 3. Matemática
        const totalFaturamento = atendimentosMes.reduce((acc, a) => acc + (Number(a.total) || 0), 0);
        const totalComissao = totalFaturamento * (percentualComissao / 100);
        const totalVales = valesMes.reduce((acc, v) => acc + v.valor, 0);
        const liquidoAPagar = totalComissao - totalVales;

        // 4. Exibir o Holerite
        const [ano, mes] = mesInput.split('-');
        const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        divResultado.style.display = "block";
        divResultado.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px;">
                <div>
                    <h3 style="margin:0; color:var(--primary); text-transform:uppercase;">Recibo de Pagamento</h3>
                    <p style="margin:5px 0 0 0; color:var(--text-muted);">Instrutor: <strong>${escapeHtml(profissional.nome)}</strong> • Ref: ${escapeHtml(nomeMes)}</p>
                </div>
                <div>
                    <span class="badge" style="background:#10b98120; color:#10b981;">CÁLCULO AUTOMÁTICO</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom: 20px;">
                <div class="glass-panel" style="padding:15px; background:rgba(0,0,0,0.2);">
                    <small style="color:var(--text-muted)">Total Faturado no Salão</small>
                    <h3 style="margin:5px 0 0 0;">R$ ${totalFaturamento.toFixed(2)}</h3>
                    <small style="color:var(--text-muted)">Serviços realizados: ${atendimentosMes.length}</small>
                </div>
                
                <div class="glass-panel" style="padding:15px; background:rgba(0,0,0,0.2);">
                    <small style="color:var(--text-muted)">Comissão a Receber (${percentualComissao}%)</small>
                    <h3 style="margin:5px 0 0 0; color:var(--success);">+ R$ ${totalComissao.toFixed(2)}</h3>
                </div>
                
                <div class="glass-panel" style="padding:15px; background:rgba(0,0,0,0.2);">
                    <small style="color:var(--text-muted)">Vales e Adiantamentos Retirados</small>
                    <h3 style="margin:5px 0 0 0; color:var(--danger);">- R$ ${totalVales.toFixed(2)}</h3>
                </div>
                
                <div class="glass-panel" style="padding:15px; background:rgba(139, 92, 246, 0.2); border: 1px solid var(--primary);">
                    <small style="color:#a78bfa; font-weight:bold;">LÍQUIDO A PAGAR</small>
                    <h2 style="margin:5px 0 0 0; color:white; font-size:32px;">R$ ${liquidoAPagar.toFixed(2)}</h2>
                </div>
            </div>
        `;
    }

