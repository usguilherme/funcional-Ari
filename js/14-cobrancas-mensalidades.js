    // ==========================================
// PAINEL DE COBRANÇAS E MENSALIDADES
// ==========================================
let filtroAtualCobranca = 'atrasados';

function filtrarCobrancas(filtro, btnElement) {
    filtroAtualCobranca = filtro;
    
    // Atualiza o visual das abas
    if(btnElement) {
        const botoes = btnElement.parentElement.querySelectorAll('.tab-btn');
        botoes.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }
    
    renderPainelCobrancas();
}

function renderPainelCobrancas() {
    const tbody = document.getElementById("tabela-cobrancas");
    if(!tbody) return;

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesAtual = hoje.toISOString().slice(0, 7);
    let clientesFiltrados = [];

    store.clientes.forEach(c => {
        if(!c.vencimento) return;
        const diaVenc = parseInt(c.vencimento);
        if(isNaN(diaVenc)) return;

        // Quem já pagou a mensalidade DESTE mês não aparece em nenhuma cobrança.
        if (c.statusMensalidade === 'pago' && c.mesPagamento === mesAtual) return;

        let status = '';
        let corStatus = '';

        if (diaVenc < diaHoje) {
            status = 'atrasados';
            corStatus = 'var(--danger)';
        } else if (diaVenc === diaHoje) {
            status = 'hoje';
            corStatus = 'var(--warning)';
        } else if (diaVenc <= diaHoje + 7) {
            status = 'proximos';
            corStatus = 'var(--success)';
        }

        if (status === filtroAtualCobranca) {
            clientesFiltrados.push({ ...c, diaVenc, statusVisual: status, corStatus });
        }
    });

    // Ordena pelo dia de vencimento
    clientesFiltrados.sort((a,b) => a.diaVenc - b.diaVenc);

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Nenhum aluno nesta categoria no momento. 🙌</td></tr>`;
        return;
    }

    const chavePix = configSistema.chavePix || "sua chave Pix";

    tbody.innerHTML = clientesFiltrados.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const primeiroNome = c.nome.split(' ')[0];
        let msg = '';
        let statusLabel = '';

        // Cria a mensagem personalizada dependendo do status do aluno
        if(filtroAtualCobranca === 'atrasados') {
            msg = `Olá ${primeiroNome}, tudo bem? Notamos que a sua mensalidade do Funcional do Ari (vencimento dia ${c.vencimento}) ficou pendente. Segue a chave Pix: ${chavePix} - Qualquer dúvida, estamos à disposição! 💪`;
            statusLabel = `Atrasado (Dia ${c.vencimento})`;
        } else if (filtroAtualCobranca === 'hoje') {
            msg = `Olá ${primeiroNome}! Passando para lembrar que sua mensalidade do Funcional vence HOJE (dia ${c.vencimento}). Segue a chave Pix para facilitar: ${chavePix} - Bom treino! 🏋️‍♂️`;
            statusLabel = `Vence Hoje!`;
        } else {
            msg = `Olá ${primeiroNome}! Passando para lembrar que sua mensalidade do Funcional vencerá no dia ${c.vencimento}. Segue a chave Pix para agilizar: ${chavePix} - Bom treino! 🏋️‍♀️`;
            statusLabel = `Vence dia ${c.vencimento}`;
        }

        const zapLink = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(msg)}` : '#';

        return `
        <tr>
            <td><strong>${escapeHtml(c.nome)}</strong></td>
            <td>Dia ${escapeHtml(c.vencimento)}</td>
            <td><span class="badge" style="background:${c.corStatus}20; color:${c.corStatus}; border: 1px solid ${c.corStatus}40;">${escapeHtml(statusLabel)}</span></td>
            <td>
                ${telefoneClean ? 
                    `<a href="${zapLink}" target="_blank" class="btn-small bg-green" style="display:flex; align-items:center; width:fit-content; text-decoration:none;" title="Enviar cobrança via WhatsApp">
                        <i data-lucide="message-circle" style="width:16px; height:16px; margin-right:6px;"></i> Enviar Cobrança
                    </a>` 
                    : '<small class="text-muted">Sem Contato</small>'
                }
            </td>
        </tr>
        `;
    }).join('');

    if(window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    const inputInicio = document.getElementById('novo-cli-inicio');
    const inputVencimento = document.getElementById('novo-cli-vencimento');

    if (inputInicio && inputVencimento) {
        inputInicio.addEventListener('change', (e) => {
            const dataSelecionada = e.target.value; // Formato AAAA-MM-DD
            if (dataSelecionada) {
                const dia = parseInt(dataSelecionada.split('-')[2], 10);
                // Preenche de forma dinâmica enquanto você edita/cadastra
                inputVencimento.value = dia;
            }
        });
    }
});


// Sincroniza automaticamente o vencimento com a data de início de todos os alunos ao abrir o sistema
document.addEventListener('sistemaPronto', () => {
    if (store && store.clientes) {
        store.clientes.forEach(c => {
            if (c.inicio && (!c.vencimento || c.vencimento === "10")) {
                const diaReal = parseInt(c.inicio.split('-')[2], 10);
                if (!isNaN(diaReal)) {
                    db.ref(`clientes/${c.id}`).update({
                        vencimento: diaReal.toString()
                    });
                }
            }
        });
    }
});


// Desenha o rótulo do painel rápido de mensalidade (usado no PDV).
function renderPainelStatusMensalidade(aluno) {
    const labelNome = document.getElementById('status-aluno-nome');
    if (!labelNome || !aluno) return;
    const status = aluno.statusMensalidade || 'atrasado';
    const cor = status === 'pago' ? '#10b981' : '#f43f5e';
    labelNome.innerHTML = `${escapeHtml(aluno.nome)} — Vencimento: Dia ${escapeHtml(aluno.vencimento || '10')} ` +
        `<span class="badge" style="margin-left:8px; background:${cor}20; color:${cor}">${escapeHtml(status.toUpperCase())}</span>`;
}

// Monitora a seleção de aluno no PDV para mostrar o painel de mensalidade rápida
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'pdv-cliente') {
        const clienteId = e.target.value;
        const painel = document.getElementById('painel-status-mensalidade');

        if (!clienteId) {
            if (painel) painel.style.display = 'none';
            return;
        }

        const aluno = store.clientes.find(c => c.id == clienteId);
        if (aluno && painel) {
            painel.style.display = 'block';
            renderPainelStatusMensalidade(aluno);
        }
    }
});

function mudarStatusMensalidade(novoStatus) {
    const selCliente = document.getElementById('pdv-cliente');
    if (!selCliente || !selCliente.value) {
        dispararToast("Selecione um aluno primeiro!", "error");
        return;
    }

    const clienteId = selCliente.value;
    atualizarStatusAluno(clienteId, novoStatus, () => {
        const aluno = store.clientes.find(c => c.id == clienteId);
        if (aluno) renderPainelStatusMensalidade(aluno);
    });
}


