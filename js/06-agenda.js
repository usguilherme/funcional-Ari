    // ==========================================
    // 8. AGENDA
    // ==========================================
    function initAgenda() {
        const hoje = new Date().toISOString().split('T')[0];
        const input = document.getElementById("agenda-date-input");
        if(input) {
            input.value = hoje;
            renderAgenda();
        }
    }

    // NOVO: exclui o atendimento e limpa o registro de horário ocupado (disponibilidade)
    function excluirAtendimentoEDisponibilidade(id, data, profissionalId, hora) {
        if(!confirm('Excluir este atendimento?')) return;
        db.ref(`atendimentos/${id}`).remove();
        if(profissionalId && data && hora) {
            db.ref(`disponibilidade/${data}/${profissionalId}/${hora.replace(':','-')}`).remove()
                .catch(err => console.error("Erro ao limpar disponibilidade:", err));
        }
    }

    function renderAgenda() {
        const div = document.getElementById("lista-agenda");
        const inputDate = document.getElementById("agenda-date-input");
        
        if(!inputDate || !div) return;

        const dataSelecionada = inputDate.value;
        
        // Atualiza o texto do dia da semana
        const dataObj = new Date(dataSelecionada + 'T00:00:00');
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const diaEl = document.getElementById("agenda-dia-semana");
        if(diaEl) diaEl.innerText = dataObj.toLocaleDateString('pt-BR', options);

        // Busca na lista de CLIENTES quem tem a data de "inicio" igual à data selecionada
        const alunosNovosHoje = store.clientes
            .filter(c => c.inicio === dataSelecionada)
            .sort((a,b) => a.nome.localeCompare(b.nome));

        // Aulas confirmadas pelo site para esta data
        const aulasConfirmadas = (store.agendamentosPublicos || [])
            .filter(a => a.status === 'confirmado' && a.data === dataSelecionada)
            .sort((a,b) => String(a.hora).localeCompare(String(b.hora)));

        let html = "";

        html += aulasConfirmadas.map(a => {
            const telClean = a.telefoneCliente ? String(a.telefoneCliente).replace(/\D/g, '') : '';
            return `
            <div class="glass-panel" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--primary); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <span class="badge" style="background:#8b5cf620; color:var(--primary); font-size:11px;">📅 Aula agendada pelo site</span>
                    <h4 style="margin:6px 0 0 0; font-size:17px;">${escapeHtml(a.nomeCliente)} <small style="color:var(--text-muted); font-weight:400;">${escapeHtml(a.hora || '')}</small></h4>
                    <small class="text-muted">${escapeHtml(a.servicoNome || '-')} · ${escapeHtml(a.profissionalNome || 'Instrutor')}</small>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${telClean ? `<a href="https://wa.me/55${telClean}" target="_blank" class="btn-small bg-green" style="text-decoration:none;" title="WhatsApp"><i data-lucide="message-circle" style="width:14px"></i></a>` : ''}
                    <button class="btn-small bg-purple" onclick="concluirAgendamentoPublico('${escapeAttr(a.id)}')" title="Marcar como concluída">✔ Concluir</button>
                    <button class="btn-small" style="background:rgba(248,113,113,0.15); color:var(--danger); border:1px solid rgba(248,113,113,0.3);" onclick="recusarAgendamentoPublico('${escapeAttr(a.id)}')" title="Cancelar">✕</button>
                </div>
            </div>`;
        }).join("");

        html += alunosNovosHoje.map(c => {
            const telefoneClean = c.telefone ? String(c.telefone).replace(/\D/g, '') : '';
            const linkBoasVindas = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Olá ${String(c.nome || '').split(' ')[0]}! Hoje é sua primeira aula no Funcional do Ari! Estamos te esperando com muita energia. 💪`)}` : '#';

            return `
            <div class="glass-panel" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--success); display:flex; justify-content:space-between; align-items:center">
                <div>
                    <span class="badge" style="background:#10b98120; color:var(--success); margin-bottom:8px; display:inline-block; font-size: 11px;">✨ Primeira Aula / Novo Cadastro</span>
                    <h4 style="margin: 0; font-size: 18px; color: var(--text-main);">${escapeHtml(c.nome)}</h4>
                    <small class="text-muted">Objetivo: ${escapeHtml(c.objetivo || '-')} | Frequência: ${escapeHtml(c.frequencia || '-')}</small>
                </div>
                <div style="display:flex; align-items:center; gap:10px">
                    ${telefoneClean ? `<a href="${linkBoasVindas}" target="_blank" class="btn-small bg-green" style="text-decoration:none; display:flex; align-items:center; gap:5px;" title="Enviar Boas-Vindas"><i data-lucide="message-circle" style="width:14px"></i> Boas-Vindas</a>` : ''}
                    <button class="btn-small bg-purple" onclick="abrirModalAnamnese('${escapeAttr(c.id)}')" title="Ver Ficha do Aluno" style="display:flex; align-items:center; gap:5px;"><i data-lucide="clipboard-list" style="width:14px"></i> Ficha</button>
                </div>
            </div>`;
        }).join("");

        div.innerHTML = html || "<p class='text-muted' style='text-align:center; padding:20px;'>Nada agendado para este dia. 🏋️</p>";

        if(window.lucide) lucide.createIcons();
    }

    // ==========================================
    // AGENDAMENTOS VINDOS DO SITE
    // ==========================================
    // O visitante cria em `agendamentos_publicos` com status "pendente".
    // O painel confirma (status "confirmado") ou recusa (remove). Confirmados
    // aparecem também na lista do dia, em renderAgenda().
    function renderAgendamentosPublicos() {
        const div = document.getElementById("lista-agendamentos-publicos");
        const card = document.getElementById("card-agendamentos-publicos");
        if (!div) return;

        const pendentes = [...(store.agendamentosPublicos || [])]
            .filter(a => (a.status || 'pendente') === 'pendente')
            .sort((a, b) => String(a.data + a.hora).localeCompare(String(b.data + b.hora)));

        if (card) card.style.display = pendentes.length ? "block" : "none";
        if (pendentes.length === 0) {
            div.innerHTML = "";
            return;
        }

        div.innerHTML = pendentes.map(a => {
            const telClean = a.telefoneCliente ? String(a.telefoneCliente).replace(/\D/g, '') : '';
            const dataFmt = typeof a.data === 'string' ? a.data.split('-').reverse().join('/') : '';
            const valorFmt = Number(a.valor) > 0 ? `R$ ${Number(a.valor).toFixed(2)}` : 'Aula experimental';
            return `
            <div class="glass-panel" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--warning); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <span class="badge" style="background:#f59e0b20; color:var(--warning); font-size:11px;">⏳ Aguardando confirmação</span>
                    <h4 style="margin:6px 0 0 0; font-size:17px;">${escapeHtml(a.nomeCliente)}</h4>
                    <small class="text-muted">${escapeHtml(a.servicoNome || '-')} · ${escapeHtml(a.profissionalNome || 'Qualquer instrutor')}</small><br>
                    <small class="text-muted">${dataFmt} às ${escapeHtml(a.hora || '')} · ${valorFmt} · ${escapeHtml(a.telefoneCliente || 'sem telefone')}</small>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${telClean ? `<a href="https://wa.me/55${telClean}" target="_blank" class="btn-small bg-green" style="text-decoration:none;" title="Falar no WhatsApp"><i data-lucide="message-circle" style="width:14px"></i></a>` : ''}
                    <button class="btn-small bg-purple" onclick="confirmarAgendamentoPublico('${escapeAttr(a.id)}')" title="Confirmar">✅ Confirmar</button>
                    <button class="btn-small" style="background:rgba(248,113,113,0.15); color:var(--danger); border:1px solid rgba(248,113,113,0.3);" onclick="recusarAgendamentoPublico('${escapeAttr(a.id)}')" title="Recusar">✕</button>
                </div>
            </div>`;
        }).join("");

        if (window.lucide) lucide.createIcons();
    }

    function _liberarDisponibilidade(ag) {
        if (ag.profissionalId && ag.data && ag.hora) {
            db.ref(`disponibilidade/${ag.data}/${ag.profissionalId}/${String(ag.hora).replace(':', '-')}`).remove()
                .catch(err => console.error("Limpar disponibilidade:", err));
        }
    }

    function recusarAgendamentoPublico(id) {
        const ag = (store.agendamentosPublicos || []).find(a => a.id === id);
        if (!ag) return;
        if (!confirm(`Recusar o agendamento de ${ag.nomeCliente}?`)) return;
        db.ref(`agendamentos_publicos/${id}`).remove()
            .then(() => { _liberarDisponibilidade(ag); dispararToast("Agendamento recusado.", "error"); })
            .catch(err => { console.error(err); dispararToast("Erro ao recusar.", "error"); });
    }

    function confirmarAgendamentoPublico(id) {
        const ag = (store.agendamentosPublicos || []).find(a => a.id === id);
        if (!ag) return;

        let profissionalId = ag.profissionalId || "";
        let nomeProfissional = ag.profissionalNome || "";

        // Se veio sem instrutor definido, o operador escolhe agora.
        if (!profissionalId) {
            if (!store.profissionais.length) return dispararToast("Cadastre um instrutor primeiro.", "error");
            const nomes = store.profissionais.map((p, i) => `${i + 1}) ${p.nome}`).join('\n');
            const escolha = prompt(`Qual instrutor vai atender ${ag.nomeCliente}?\n\n${nomes}\n\nDigite o número:`);
            if (escolha === null) return;
            const idx = parseInt(escolha, 10) - 1;
            if (isNaN(idx) || !store.profissionais[idx]) return dispararToast("Instrutor inválido — confirmação cancelada.", "error");
            profissionalId = String(store.profissionais[idx].id);
            nomeProfissional = store.profissionais[idx].nome;
        }

        db.ref(`agendamentos_publicos/${id}`).update({
            status: 'confirmado',
            confirmadoEm: Date.now(),
            profissionalId: String(profissionalId),
            profissionalNome: nomeProfissional
        }).then(() => {
            if (ag.data && ag.hora) {
                db.ref(`disponibilidade/${ag.data}/${profissionalId}/${String(ag.hora).replace(':', '-')}`).set(true)
                    .catch(err => console.error("Disponibilidade:", err));
            }
            dispararToast(`Aula de ${ag.nomeCliente} confirmada.`);
        }).catch(err => {
            console.error(err);
            dispararToast("Erro ao confirmar agendamento.", "error");
        });
    }

    function concluirAgendamentoPublico(id) {
        const ag = (store.agendamentosPublicos || []).find(a => a.id === id);
        if (!ag) return;
        if (!confirm(`Marcar a aula de ${ag.nomeCliente} como concluída e remover da lista?`)) return;
        db.ref(`agendamentos_publicos/${id}`).remove()
            .then(() => dispararToast("Aula concluída."))
            .catch(err => { console.error(err); dispararToast("Erro ao concluir.", "error"); });
    }

    // ==========================================
    // 9. CLIENTES, GALERIA & EDIÇÃO
    // ==========================================
