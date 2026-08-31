// ==========================================
// CENTRAL DE ATUALIZAÇÃO DE MENSALIDADES
// ==========================================

// As abas chamam renderTabelaAtualizacao()/renderTabelaAvaliacoes() direto de
// abrirAba() (módulo 04). Aqui só garantimos a primeira renderização.
document.addEventListener('sistemaPronto', () => {
    renderTabelaAtualizacao();
});

function renderTabelaAtualizacao() {
    const tbody = document.getElementById("tabela-atualizacao-mensalidades");
    if (!tbody) return; // Se a aba não estiver aberta, evita erro

    if (!store.clientes || store.clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.5;">Nenhum aluno cadastrado.</td></tr>`;
        return;
    }

    // Ordena os alunos alfabeticamente
    const clientesOrdenados = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    tbody.innerHTML = clientesOrdenados.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const status = c.statusMensalidade || 'atrasado'; // Padrão como atrasado se não definido
        
        const badgeCor = status === 'pago' ? '#10b981' : '#f43f5e';
        const badgeTexto = status === 'pago' ? 'PAGO / REGULAR' : 'NÃO PAGO / ATRASADO';

        const idAttr = escapeAttr(c.id);
        return `
        <tr data-cliente-id="${idAttr}">
            <td><strong>${escapeHtml(c.nome)}</strong></td>
            <td>${escapeHtml(c.telefone || 'Sem telefone')}</td>
            <td>Dia ${escapeHtml(c.vencimento || '10')}</td>
            <td>
                <span class="badge" style="background:${badgeCor}20; color:${badgeCor}; border: 1px solid ${badgeCor}40;">
                    ${badgeTexto}
                </span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
                <button type="button" class="btn-small bg-green" onclick="atualizarStatusAluno('${idAttr}', 'pago')" title="Marcar como Pago">
                    ✅ Foi Pago
                </button>
                <button type="button" class="btn-small" style="background: rgba(248,113,113,0.15); color: var(--danger); border: 1px solid rgba(248,113,113,0.3);" onclick="atualizarStatusAluno('${idAttr}', 'atrasado')" title="Marcar como Não Pago">
                    ❌ Não Pago
                </button>
            </td>
        </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function atualizarStatusAluno(clienteId, novoStatus, aoConcluir) {
    const updates = { statusMensalidade: novoStatus };
    // Grava o mês do pagamento — é o que permite o reset automático no início
    // do mês seguinte (ver resetarMensalidadesDoMes em 02-tema-init-auth.js).
    if (novoStatus === 'pago') {
        updates.mesPagamento = mesReferenciaAtual();
    } else {
        updates.mesPagamento = null;
    }

    db.ref(`clientes/${clienteId}`).update(updates).then(() => {
        dispararToast(novoStatus === 'pago' ? "✅ Mensalidade marcada como PAGA!" : "⚠️ Mensalidade marcada como NÃO PAGA.");

        // Atualiza localmente no store para refletir na hora
        const aluno = store.clientes.find(c => c.id == clienteId);
        if (aluno) {
            aluno.statusMensalidade = novoStatus;
            aluno.mesPagamento = updates.mesPagamento;
        }

        renderTabelaAtualizacao();
        atualizarKPIs();
        if (typeof renderPainelCobrancas === 'function') renderPainelCobrancas();
        if (typeof aoConcluir === 'function') aoConcluir();
    }).catch(err => {
        console.error(err);
        dispararToast("Erro ao atualizar status", "error");
    });
}

function filtrarTabelaAtualizacao() {
    const inputBusca = document.getElementById("busca-atualizacao");
    if (!inputBusca) return;
    const termo = inputBusca.value.toLowerCase();
    const linhas = document.querySelectorAll("#tabela-atualizacao-mensalidades tr");
    
    linhas.forEach(linha => {
        const txt = linha.innerText.toLowerCase();
        linha.style.display = txt.includes(termo) ? "" : "none";
    });
}


function renderSelectPlanosAluno() {
    const sel = document.getElementById("novo-cli-frequencia");
    if (!sel) return;

    const valorAtual = sel.value; // Mantém selecionado se estiver editando

    let html = '<option value="">Selecione o plano...</option>';
    if (store.servicos && store.servicos.length > 0) {
        store.servicos.forEach(s => {
            html += `<option value="${escapeAttr(s.nome)}">${escapeHtml(s.nome)} - R$ ${(parseFloat(s.preco) || 0).toFixed(2)}</option>`;
        });
    }

    sel.innerHTML = html;
    if (valorAtual) sel.value = valorAtual;
}

// ==========================================
// MÓDULO DE AVALIAÇÕES (GOOGLE DRIVE)
// ==========================================

function renderTabelaAvaliacoes() {
    const tbody = document.getElementById("tabela-avaliacoes");
    if (!tbody) return;

    if (!store.clientes || store.clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Nenhum aluno cadastrado.</td></tr>`;
        return;
    }

    const clientesOrdenados = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    tbody.innerHTML = clientesOrdenados.map(c => {
        const linkDrive = typeof c.linkDrive === 'string' ? c.linkDrive.trim() : '';
        const temLink = /^https?:\/\//i.test(linkDrive);
        const idAttr = escapeAttr(c.id);
        const statusBadge = temLink
            ? `<span class="badge" style="background:#10b98120; color:#10b981; border: 1px solid #10b98140;"><i data-lucide="check-circle" style="width:12px; margin-right:4px;"></i> Avaliado</span>`
            : `<span class="badge" style="background:#f59e0b20; color:#f59e0b; border: 1px solid #f59e0b40;">Pendente</span>`;

        const acaoBtn = temLink
            ? `<a href="${escapeAttr(linkDrive)}" target="_blank" rel="noopener" class="btn-small bg-green" style="display:inline-flex; align-items:center; text-decoration:none;"><i data-lucide="external-link" style="width:16px; margin-right:6px;"></i> Acessar Pasta</a>`
            : `<button class="btn-small" style="background:rgba(255,255,255,0.1); color:#fff;" onclick="editarCliente('${idAttr}')"><i data-lucide="plus" style="width:16px; margin-right:6px;"></i> Add Link</button>`;

        return `
        <tr data-status-link="${temLink ? 'avaliados' : 'pendentes'}">
            <td><strong>${escapeHtml(c.nome)}</strong></td>
            <td>${escapeHtml(c.objetivo || '-')}</td>
            <td>${statusBadge}</td>
            <td style="display:flex; gap:10px;">
                ${acaoBtn}
                <button class="btn-small bg-yellow" onclick="editarCliente('${idAttr}')" title="Editar Link"><i data-lucide="pencil" style="width:16px;"></i></button>
            </td>
        </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
    filtrarAvaliacoes(); // Aplica os filtros se já tiver algo digitado
}

function filtrarAvaliacoes() {
    const inputBusca = document.getElementById("busca-avaliacao");
    const selectStatus = document.getElementById("filtro-status-avaliacao");
    if (!inputBusca || !selectStatus) return;

    const termo = inputBusca.value.toLowerCase();
    const filtroStatus = selectStatus.value;
    const linhas = document.querySelectorAll("#tabela-avaliacoes tr");
    
    linhas.forEach(linha => {
        const txt = linha.innerText.toLowerCase();
        const statusLink = linha.getAttribute("data-status-link"); // 'avaliados' ou 'pendentes'
        
        const bateTexto = txt.includes(termo);
        const bateStatus = (filtroStatus === 'todos') || (filtroStatus === statusLink);

        linha.style.display = (bateTexto && bateStatus) ? "" : "none";
    });
}











