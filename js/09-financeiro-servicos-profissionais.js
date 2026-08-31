    // 11. DESPESAS E FINANCEIRO
    // ==========================================
    function lancarDespesa() {
        const desc = document.getElementById("desp-desc").value;
        const valor = parseFloat(document.getElementById("desp-valor").value);
        const data = document.getElementById("desp-data").value;
        const cat = document.getElementById("desp-cat").value;
        if(!desc || isNaN(valor) || !data) return dispararToast("Preencha tudo!", "error");
        
        if (idDespesaEdicao) {
            db.ref(`despesas/${idDespesaEdicao}`).update({ descricao: desc, valor: valor, data: data, categoria: cat }).then(() => dispararToast("Despesa atualizada!"));
            cancelarEdicaoDespesa();
        } else {
            const id = novoId();
            db.ref(`despesas/${id}`).set({ id, descricao: desc, valor: valor, data: data, categoria: cat, tipo: 'saida' }).then(() => dispararToast("Despesa salva!"));
            document.getElementById("desp-desc").value = "";
            document.getElementById("desp-valor").value = "";
        }
    }

    function renderListaGestaoDespesas() {
        const tbody = document.getElementById("lista-gestao-despesas");
        if(!tbody) return;
        const lista = [...store.despesas].sort((a,b) => new Date(b.data) - new Date(a.data));
        tbody.innerHTML = lista.map(d => `<tr><td>${formatarData(d.data)}</td><td>${escapeHtml(d.descricao)}</td><td>R$ ${(Number(d.valor) || 0).toFixed(2)}</td><td><button class="btn-small bg-yellow" onclick="prepararEdicaoDespesa('${escapeAttr(d.id)}')">Editar</button><button class="btn-small bg-purple" onclick="if(confirm('Apagar?')) db.ref('despesas/${escapeAttr(d.id)}').remove()">X</button></td></tr>`).join("");
    }

    function prepararEdicaoDespesa(id) {
        const d = store.despesas.find(x => x.id == id);
        if(!d) return;
        document.getElementById("desp-desc").value = d.descricao;
        document.getElementById("desp-valor").value = d.valor;
        document.getElementById("desp-data").value = d.data;
        document.getElementById("desp-cat").value = d.categoria;
        idDespesaEdicao = id;
        document.getElementById("titulo-form-despesa").innerText = "Editar Despesa";
        document.getElementById("btn-salvar-despesa").innerText = "SALVAR ALTERAÇÕES";
        document.getElementById("btn-cancelar-despesa").style.display = "inline-block";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelarEdicaoDespesa() {
        idDespesaEdicao = null;
        document.getElementById("titulo-form-despesa").innerText = "Registrar Despesa";
        document.getElementById("btn-salvar-despesa").innerText = "LANÇAR DESPESA";
        document.getElementById("btn-cancelar-despesa").style.display = "none";
        document.getElementById("desp-desc").value = "";
        document.getElementById("desp-valor").value = "";
    }

    async function salvarServicoCad() {
        const nome = document.getElementById("serv-nome").value.trim();
        let preco = parseFloat(document.getElementById("serv-preco").value);
        const categoria = document.getElementById("serv-categoria") ? document.getElementById("serv-categoria").value : "cabelo";
        const descricao = document.getElementById("serv-descricao") ? document.getElementById("serv-descricao").value.trim() : "";
        const destaque = document.getElementById("serv-destaque") ? document.getElementById("serv-destaque").checked : false;
        const fotoInput = document.getElementById("serv-foto");
        const btn = document.getElementById("btn-salvar-servico");

        if(!nome) return dispararToast("Preencha o nome do plano!", "error");
        // "manicure" é a chave interna do 2º tipo de plano (Treino em Grupo).
        if(categoria === "manicure" && !(preco > 0)) return dispararToast("Preencha o preço para esse tipo de plano!", "error");

        // Preço vazio vira 0 para não quebrar o banco.
        if(!Number.isFinite(preco) || preco < 0) preco = 0;

        const textoBtn = btn ? btn.innerText : "";
        if (btn) { btn.disabled = true; btn.innerText = fotoInput && fotoInput.files[0] ? "ENVIANDO..." : "SALVANDO..."; }

        try {
            const dados = { nome, preco, categoria, descricao, destaque };
            if (fotoInput && fotoInput.files[0]) {
                dados.foto = await uploadImagem(fotoInput.files[0], 'servicos', 800, 0.72);
            }

            if (idServicoEdicao) {
                await db.ref(`servicos/${idServicoEdicao}`).update(dados);
                dispararToast("Plano atualizado!");
            } else {
                const id = novoId();
                await db.ref(`servicos/${id}`).set({ id, ...dados });
                dispararToast("Plano salvo!");
            }
            cancelarEdicaoServico();
        } catch (erro) {
            console.error("Erro ao salvar plano:", erro);
            alert("Não foi possível salvar o plano.\n\n" + ((erro && erro.message) ? erro.message : "Verifique sua conexão e tente novamente."));
            dispararToast("Erro ao salvar o plano.", "error");
        } finally {
            // Destrava o botão SEMPRE.
            if (btn) {
                btn.disabled = false;
                if (btn.innerText === "ENVIANDO..." || btn.innerText === "SALVANDO...") btn.innerText = textoBtn || "Salvar";
            }
        }
    }

    function renderListaServicosCad() {
        const div = document.getElementById("lista-servicos-cad");
        div.innerHTML = store.servicos.map(s => `<div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px;">
            <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
                ${s.foto ? `<img src="${encodeURI(s.foto)}" alt="" style="width:50px; height:50px; object-fit:cover; border-radius:8px; flex-shrink:0;">` : ''}
                <div style="min-width:0;">
                    <strong>${escapeHtml(s.nome)}</strong> ${s.destaque ? '⭐' : ''}<br>
                    <span class="text-gradient">R$ ${(parseFloat(s.preco) || 0).toFixed(2)}</span>
                    ${s.descricao ? `<br><small class="text-muted" style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px;">${escapeHtml(s.descricao)}</small>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-shrink:0;">
                <button class="btn-small bg-yellow" onclick="prepararEdicaoServico('${escapeAttr(s.id)}')" title="Editar"><i data-lucide="pencil" style="width:14px"></i></button>
                <button class="btn-small bg-purple" onclick="if(confirm('Excluir?')) db.ref('servicos/${escapeAttr(s.id)}').remove()" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
            </div>
        </div>`).join("");
        lucide.createIcons();
    }

    function prepararEdicaoServico(id) {
        const s = store.servicos.find(x => x.id == id);
        if(!s) return;
        document.getElementById("serv-nome").value = s.nome;
        document.getElementById("serv-preco").value = s.preco;
        
        // 👇 AQUI! Preenche a categoria com o que tá no banco, ou joga "cabelo" se for um serviço antigo
        if(document.getElementById("serv-categoria")) {
            document.getElementById("serv-categoria").value = s.categoria || "cabelo";
        }

        if(document.getElementById("serv-descricao")) document.getElementById("serv-descricao").value = s.descricao || "";
        if(document.getElementById("serv-destaque")) document.getElementById("serv-destaque").checked = !!s.destaque;
        const preview = document.getElementById("serv-foto-preview");
        if(preview) preview.innerHTML = s.foto ? `<img src="${s.foto}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">` : "";
        idServicoEdicao = id;
        const btn = document.getElementById("btn-salvar-servico");
        if(btn) { btn.innerText = "ATUALIZAR"; btn.style.background = "var(--warning)"; }
        document.getElementById("btn-cancelar-servico").style.display = "block";
        document.getElementById("servicos").scrollIntoView({ behavior: 'smooth' });
    }

    function cancelarEdicaoServico() {
        idServicoEdicao = null;
        document.getElementById("serv-nome").value = "";
        document.getElementById("serv-preco").value = "";
        
        // 👇 AQUI! Limpa a caixinha devolvendo ela pro padrão ("cabelo")
        if(document.getElementById("serv-categoria")) {
            document.getElementById("serv-categoria").value = "cabelo";
        }

        if(document.getElementById("serv-descricao")) document.getElementById("serv-descricao").value = "";
        if(document.getElementById("serv-destaque")) document.getElementById("serv-destaque").checked = false;
        if(document.getElementById("serv-foto")) document.getElementById("serv-foto").value = "";
        if(document.getElementById("serv-foto-preview")) document.getElementById("serv-foto-preview").innerHTML = "";
        const btn = document.getElementById("btn-salvar-servico");
        if(btn) { btn.innerText = "Salvar"; btn.style.background = ""; }
        document.getElementById("btn-cancelar-servico").style.display = "none";
    }
    // ==========================================
    // PROFISSIONAIS (CADASTRO E FILTROS)
    // ==========================================
    function salvarProfissionalCad() {
        const nome = document.getElementById("prof-nome").value.trim();
        const telefone = document.getElementById("prof-telefone").value.trim();
        const especialidade = document.getElementById("prof-especialidade").value.trim();
        let comissao = parseFloat(document.getElementById("prof-comissao").value);
        if(isNaN(comissao)) comissao = 0;
        if(comissao < 0) comissao = 0;
        if(comissao > 100) comissao = 100;
        if(!nome) return dispararToast("Preencha o nome da profissional!", "error");

        if (idProfissionalEdicao) {
            db.ref(`profissionais/${idProfissionalEdicao}`).update({ nome, telefone, especialidade, comissao })
                .then(() => dispararToast("Profissional atualizada!"));
            cancelarEdicaoProfissional();
        } else {
            const id = novoId();
            db.ref(`profissionais/${id}`).set({ id, nome, telefone, especialidade, comissao, ativo: true });
            dispararToast("Profissional cadastrada!");
            document.getElementById("prof-nome").value = "";
            document.getElementById("prof-telefone").value = "";
            document.getElementById("prof-especialidade").value = "";
            document.getElementById("prof-comissao").value = "";
        }
    }

    function renderListaProfissionaisCad() {
        const div = document.getElementById("lista-profissionais-cad");
        if(!div) return;
        if(store.profissionais.length === 0) {
            div.innerHTML = "<p class='text-muted' style='text-align:center; padding:20px;'>Nenhuma profissional cadastrada ainda.</p>";
            return;
        }
        div.innerHTML = store.profissionais.map(p => `<div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
            <div>
                <strong>${escapeHtml(p.nome)}</strong><br>
                <span class="text-muted" style="font-size:12px;">${escapeHtml(p.especialidade || 'Instrutor')}${p.telefone ? ' · ' + escapeHtml(p.telefone) : ''}</span><br>
                <span class="badge" style="background:#8b5cf620; color:#8b5cf6; margin-top:4px; display:inline-block; font-size:11px;">Repassa ${Number(p.comissao) || 0}% ao estúdio</span>
            </div>
            <div style="display:flex; gap:10px">
                <button class="btn-small bg-yellow" onclick="prepararEdicaoProfissional('${escapeAttr(p.id)}')" title="Editar"><i data-lucide="pencil" style="width:14px"></i></button>
                <button class="btn-small bg-purple" onclick="excluirProfissional('${escapeAttr(p.id)}')" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
            </div>
        </div>`).join("");
        lucide.createIcons();
    }

    function prepararEdicaoProfissional(id) {
        const p = store.profissionais.find(x => x.id == id);
        if(!p) return;
        document.getElementById("prof-nome").value = p.nome;
        document.getElementById("prof-telefone").value = p.telefone || "";
        document.getElementById("prof-especialidade").value = p.especialidade || "";
        document.getElementById("prof-comissao").value = p.comissao || "";
        idProfissionalEdicao = id;
        const btn = document.getElementById("btn-salvar-profissional");
        if(btn) { btn.innerText = "ATUALIZAR"; btn.style.background = "var(--warning)"; }
        document.getElementById("btn-cancelar-profissional").style.display = "block";
        document.getElementById("profissionais").scrollIntoView({ behavior: 'smooth' });
    }

    function cancelarEdicaoProfissional() {
        idProfissionalEdicao = null;
        document.getElementById("prof-nome").value = "";
        document.getElementById("prof-telefone").value = "";
        document.getElementById("prof-especialidade").value = "";
        document.getElementById("prof-comissao").value = "";
        const btn = document.getElementById("btn-salvar-profissional");
        if(btn) { btn.innerText = "Salvar"; btn.style.background = ""; }
        document.getElementById("btn-cancelar-profissional").style.display = "none";
    }

    function excluirProfissional(id) {
        if(confirm("Excluir esta profissional? O histórico de vendas dela será mantido, mas ela some dos filtros.")) {
            db.ref(`profissionais/${id}`).remove().then(() => dispararToast("Profissional removida!", "error"));
        }
    }

    // Popula todos os <select> de filtro/seleção de profissional espalhados pelo sistema
    function renderSelectsProfissionais() {
        const opcoes = store.profissionais
            .slice()
            .sort((a,b) => a.nome.localeCompare(b.nome))
            .map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.nome)}</option>`).join("");

        // Select do PDV/Caixa (obrigatório escolher quem atendeu)
        const selPdv = document.getElementById("pdv-profissional");
        if(selPdv) {
            const valorAtual = selPdv.value;
            selPdv.innerHTML = `<option value="">Selecione...</option>${opcoes}`;
            if(valorAtual) selPdv.value = valorAtual;
        }

        // Selects de filtro (Agenda, Financeiro, Dashboard, Clientes) - todos têm opção "Todas"
        ["agenda-filtro-profissional", "financeiro-filtro-profissional", "dash-filtro-profissional", "clientes-filtro-profissional"].forEach(idSel => {
            const sel = document.getElementById(idSel);
            if(sel) {
                const valorAtual = sel.value;
                sel.innerHTML = `<option value="">Todas as Profissionais</option>${opcoes}`;
                if(valorAtual) sel.value = valorAtual;
            }
        });
    }

    function atualizarKPIs() {
        try {
            const hojeIso = new Date().toISOString().split('T')[0];
            const mesAtualIso = hojeIso.slice(0, 7); // Ex: "2026-08"

            const profFiltroDash = document.getElementById('dash-filtro-profissional')?.value || "";
            const profFiltroFin = document.getElementById('financeiro-filtro-profissional')?.value || "";

            const inputInicio = document.getElementById('dash-grafico-inicio');
            const inputFim = document.getElementById('dash-grafico-fim');

            const dataInicio = inputInicio?.value || mesAtualIso + '-01';
            const dataFim = inputFim?.value || hojeIso;

            let faturamentoPeriodo = 0;
            let agendamentosHoje = 0;
            let retornosPendentes = 0;
            let pontosDistribuidos = 0;
            let entradasAtendimentosMes = 0;
            let saidasMes = 0;

            // ====================================================
            // 1. CÁLCULO DE MENSALIDADES (MOTOR FINANCEIRO)
            // ====================================================
            let receitaPlanosTotal = 0;
            let receitaPlanosPagos = 0;

            const clientes = store.clientes || [];
            const listaClientes = Array.isArray(clientes) ? clientes : Object.values(clientes);

            listaClientes.forEach(c => {
                // KPIs padrão do dashboard
                if (c.previsaoRetorno && c.previsaoRetorno <= hojeIso) retornosPendentes++;
                if (c.pontos) pontosDistribuidos += (Number(c.pontos) || 0);

                // Se o aluno está ativo e tem um plano definido, usa o preço do
                // serviço cadastrado (fonte única de verdade — antes havia uma
                // tabela fixa aqui que divergia do cadastro de planos).
                if (c.status !== 'Inativo' && c.frequencia) {
                    const valorPlano = getPrecoPlano(c);
                    receitaPlanosTotal += valorPlano;

                    // Se foi marcado como PAGO na aba Atualização, soma nas Entradas reais
                    if (c.statusMensalidade === 'pago') {
                        receitaPlanosPagos += valorPlano;
                    }
                }
            });

            // ====================================================
            // 2. PROCESSA ATENDIMENTOS (Para Dashboard)
            // ====================================================
            const atendimentos = store.atendimentos || [];
            atendimentos.forEach(a => {
                if (!a.data) return;
                if (!atendimentoConfirmado(a)) return; // agendamentos pendentes não são receita

                if (a.data >= dataInicio && a.data <= dataFim) {
                    if (!profFiltroDash || a.profissionalId == profFiltroDash) {
                        faturamentoPeriodo += (Number(a.total) || 0);
                    }
                }

                if (typeof a.data === 'string' && a.data.slice(0, 7) === mesAtualIso) {
                    entradasAtendimentosMes += (Number(a.total) || 0);
                }

                if (a.data === hojeIso) {
                    if (!profFiltroDash || a.profissionalId == profFiltroDash) {
                        agendamentosHoje++;
                    }
                }
            });

            // Despesas do mês corrente (para os cards do Financeiro)
            (store.despesas || []).forEach(d => {
                if (typeof d.data === 'string' && d.data.slice(0, 7) === mesAtualIso) {
                    saidasMes += (Number(d.valor) || 0);
                }
            });

            // ====================================================
            // 3. ATUALIZA OS TEXTOS NO DASHBOARD
            // ====================================================
            const elFaturamento = document.getElementById('dash-faturamento');
            const elAtendimentos = document.getElementById('dash-atendimentos');
            const elRetornos = document.getElementById('dash-retornos');
            const elPontos = document.getElementById('dash-pontos');

            if (elFaturamento) elFaturamento.innerText = `R$ ${(faturamentoPeriodo + receitaPlanosPagos).toFixed(2)}`;
            if (elAtendimentos) elAtendimentos.innerText = agendamentosHoje;
            if (elRetornos) elRetornos.innerText = retornosPendentes;
            if (elPontos) elPontos.innerText = pontosDistribuidos;

            // ====================================================
            // 4. CARDS DO FINANCEIRO (valores reais do mês corrente)
            // ====================================================
            const entradasMes = entradasAtendimentosMes + receitaPlanosPagos;
            const lucroMes = entradasMes - saidasMes;
            const pendente = receitaPlanosTotal - receitaPlanosPagos;

            const setTexto = (id, texto) => {
                const el = document.getElementById(id);
                if (el) el.innerText = texto;
            };

            setTexto('fin-entradas', `R$ ${entradasMes.toFixed(2)}`);
            setTexto('fin-saidas', `R$ ${saidasMes.toFixed(2)}`);
            setTexto('fin-lucro', `R$ ${lucroMes.toFixed(2)}`);

            // Painel dedicado de mensalidades (não sobrescreve mais os cards acima)
            setTexto('fin-mens-paga', `R$ ${receitaPlanosPagos.toFixed(2)}`);
            setTexto('fin-mens-pendente', `R$ ${pendente.toFixed(2)}`);
            setTexto('fin-mens-previsto', `R$ ${receitaPlanosTotal.toFixed(2)}`);

        } catch (erro) {
            console.error("Erro no Dashboard/Financeiro:", erro);
        }
    }

    function renderTabelaFinanceiro() {
        const tbody = document.getElementById("tabela-financeiro");
        if(!tbody) return;
        const filtroFin = document.getElementById("financeiro-filtro-profissional") ? document.getElementById("financeiro-filtro-profissional").value : "";

        const receitas = store.atendimentos
            .filter(a => atendimentoConfirmado(a))
            .filter(a => !filtroFin || a.profissionalId == filtroFin)
            .map(a => ({ data: a.data, desc: `Venda: ${escapeHtml(a.nomeCliente)}${a.nomeProfissional ? ' (' + escapeHtml(a.nomeProfissional) + ')' : ''}`, tipo: 'entrada', valor: Number(a.total) || 0 }));
        // Despesas são do estúdio como um todo, então só aparecem quando não há filtro de profissional específico
        const saidas = filtroFin ? [] : store.despesas.map(d => ({ data: d.data, desc: escapeHtml(d.descricao), tipo: 'saida', valor: Number(d.valor) || 0 }));
        const extrato = [...receitas, ...saidas].sort((a,b) => new Date(b.data) - new Date(a.data));
        tbody.innerHTML = extrato.map(item => `<tr><td>${formatarData(item.data)}</td><td>${item.desc}</td><td><span class="badge" style="${item.tipo==='entrada'?'background:#10b98120;color:#10b981':'background:#f43f5e20;color:#f43f5e'}">${item.tipo.toUpperCase()}</span></td><td>R$ ${item.valor.toFixed(2)}</td></tr>`).join("");
    }

    // -----------------------------------------------------------
    // ATUALIZAÇÃO IMPORTANTE NO GRÁFICO (AGRUPAMENTO POR DIA)
    // -----------------------------------------------------------
    // Função auxiliar para definir datas rápidas (Hoje, 7 dias, etc)
    function setPeriodoGrafico(tipo) {
        const hoje = new Date().toISOString().split('T')[0];
        const inputFim = document.getElementById("dash-grafico-fim");
        const inputInicio = document.getElementById("dash-grafico-inicio");

        inputFim.value = hoje;

        if (tipo === 'hoje') {
            inputInicio.value = hoje;
        } else if (tipo === '7dias') {
            const seteDiasAtras = new Date();
            seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
            inputInicio.value = seteDiasAtras.toISOString().split('T')[0];
        }
        
        atualizarGraficos();
    }
    // Gráficos atualizados com filtro por data (Visual Profissional)
    // Retorna as cores certas pro gráfico de acordo com o tema ativo no momento
function getCoresGrafico() {
    const claro = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        legenda: claro ? '#374151' : '#ffffff',
        eixos: claro ? '#4b5563' : '#a1a1aa',
        gradeLinhas: claro ? 'rgba(20,24,38,0.08)' : 'rgba(255,255,255,0.03)',
        bordaFatia: claro ? '#ffffff' : '#09090b',
        pontoFundo: claro ? '#ffffff' : '#09090b'
    };
}

// Gráficos atualizados com filtro por data (Visual Profissional)
function atualizarGraficos() {
    let dataInicio = document.getElementById("dash-grafico-inicio").value;
    let dataFim = document.getElementById("dash-grafico-fim").value;

    // Se não houver data definida, assume os últimos 7 dias por padrão
    if (!dataInicio || !dataFim) {
        const hoje = new Date();
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(hoje.getDate() - 6);
        
        dataInicio = seteDiasAtras.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
        
        if(document.getElementById("dash-grafico-inicio")) document.getElementById("dash-grafico-inicio").value = dataInicio;
        if(document.getElementById("dash-grafico-fim")) document.getElementById("dash-grafico-fim").value = dataFim;
    }

    const filtroDash = document.getElementById("dash-filtro-profissional") ? document.getElementById("dash-filtro-profissional").value : "";
    const cores = getCoresGrafico();

    // Filtrar atendimentos dentro do período selecionado (e por profissional, se selecionado)
    const atendimentosFiltrados = store.atendimentos
        .filter(a => atendimentoConfirmado(a))
        .filter(a => a.data >= dataInicio && a.data <= dataFim)
        .filter(a => !filtroDash || a.profissionalId == filtroDash);

    // 1. Lógica do Gráfico de Rosca (Serviços)
    const contagem = {}; 
    atendimentosFiltrados.forEach(a => {
        if(a.servicos) {
            a.servicos.forEach(s => contagem[s.nome] = (contagem[s.nome] || 0) + 1);
        }
    });
    const sorted = Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0,5);
    
    if(chartTop) chartTop.destroy();
    chartTop = new Chart(document.getElementById("chartTopServicos"), {
        type: 'doughnut',
        data: { 
            labels: sorted.map(x => x[0]), 
            datasets: [{ 
                data: sorted.map(x => x[1]), 
                backgroundColor: ['#d946ef', '#8b5cf6', '#6366f1', '#ec4899', '#a855f7'], 
                borderColor: cores.bordaFatia, 
                borderWidth: 2 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: cores.legenda, boxWidth: 10 } } } 
        }
    });

    // 2. Lógica do Gráfico de Linha (Faturamento Agrupado - VISUAL ELEGANTE)
    const diasRange = [];
    const faturamentosRange = [];
    
    let atual = new Date(dataInicio + 'T00:00:00');
    const fim = new Date(dataFim + 'T00:00:00');

    while (atual <= fim) {
        const dataStr = atual.toISOString().split('T')[0];
        const label = `${atual.getDate()}/${atual.getMonth() + 1}`;
        
        diasRange.push(label);
        
        const totalDoDia = store.atendimentos
            .filter(a => atendimentoConfirmado(a))
            .filter(a => a.data === dataStr)
            .filter(a => !filtroDash || a.profissionalId == filtroDash)
            .reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
            
        faturamentosRange.push(totalDoDia);
        atual.setDate(atual.getDate() + 1);
    }

    if(chartSemana) chartSemana.destroy();
    chartSemana = new Chart(document.getElementById("chartSemanal"), {
        type: 'line',
        data: { 
            labels: diasRange, 
            datasets: [{ 
                label: 'Faturamento (R$)', 
                data: faturamentosRange,
                borderColor: '#a855f7', 
                borderWidth: 3, 
                tension: 0.4, 
                fill: true,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
                    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
                    return gradient;
                },
                pointBackgroundColor: cores.pontoFundo, 
                pointBorderColor: '#a855f7', 
                pointBorderWidth: 3,
                pointRadius: 5
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { grid: { color: cores.gradeLinhas }, ticks: { color: cores.eixos }, beginAtZero: true }, 
                x: { grid: { display: false }, ticks: { color: cores.eixos } } 
            } 
        }
    });
}
    function filtrarClientes() {
        const inputBusca = document.getElementById("busca-cliente");
        if(!inputBusca) return;
        const termo = inputBusca.value.toLowerCase();
        const filtroProfissional = document.getElementById("clientes-filtro-profissional") ? document.getElementById("clientes-filtro-profissional").value : "";
        const linhas = document.querySelectorAll("#tabela-clientes tr");
        linhas.forEach(linha => {
            const txt = linha.innerText.toLowerCase();
            const bateTexto = txt.includes(termo);

            let bateProfissional = true;
            if(filtroProfissional) {
                const clienteId = linha.getAttribute("data-cliente-id");
                bateProfissional = store.atendimentos.some(a => a.clienteId == clienteId && a.profissionalId == filtroProfissional);
            }

            linha.style.display = (bateTexto && bateProfissional) ? "" : "none";
        });
    }

    function formatarData(dataISO) {
        if(!dataISO) return "";
        const [ano, mes, dia] = dataISO.split("-");
        return `${dia}/${mes}/${ano}`;
    }

