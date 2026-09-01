    // ==========================================
    // FILA DE ESPERA / LEADS
    // ==========================================
    // Nó `leads_espera`: { nome, telefone, criadoEm, origem, atendido? }.
    // Escrita pública só de CRIAÇÃO (agendar.html), leitura só autenticada —
    // ver database.rules.json. O listener vive em 02-tema-init-auth.js.

    let leadsEspera = [];

    function renderLeadsEspera() {
        const tbody = document.getElementById("tabela-leads-espera");
        if (!tbody) return;

        const lista = [...leadsEspera].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        const contador = document.getElementById("leads-contador");
        const pendentes = lista.filter(l => !l.atendido).length;
        if (contador) contador.innerText = pendentes === 1 ? "1 na fila" : `${pendentes} na fila`;

        if (!lista.length) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Ninguém na fila de espera ainda.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(l => {
            const tel = soDigitos(l.telefone);
            const telZap = tel.startsWith('55') ? tel : ('55' + tel);
            const primeiroNome = String(l.nome || '').split(' ')[0];
            const zap = tel
                ? `https://wa.me/${telZap}?text=${encodeURIComponent(`Oi ${primeiroNome}! Abriu vaga aqui no Funcional do Ari. Bora marcar sua aula experimental? 💪`)}`
                : '#';
            const quando = l.criadoEm ? new Date(l.criadoEm).toLocaleDateString('pt-BR') : '-';

            return `<tr style="${l.atendido ? 'opacity:0.45;' : ''}">
                <td><strong>${escapeHtml(l.nome || '-')}</strong></td>
                <td>${escapeHtml(l.telefone || '-')}</td>
                <td>${quando}</td>
                <td style="white-space:nowrap; display:flex; gap:6px;">
                    ${tel ? `<a href="${zap}" target="_blank" class="btn-small bg-green" style="text-decoration:none; display:flex; align-items:center;" title="Chamar no WhatsApp"><i data-lucide="message-circle" style="width:14px"></i></a>` : ''}
                    <button class="btn-small ${l.atendido ? 'bg-yellow' : 'bg-purple'}" onclick="alternarLeadAtendido('${escapeAttr(l.id)}', ${l.atendido ? 'false' : 'true'})">${l.atendido ? '↩︎ Reabrir' : '✓ Atendido'}</button>
                    <button class="btn-small" style="background:rgba(248,113,113,0.12); color:var(--danger); border:1px solid rgba(248,113,113,0.25);" onclick="excluirLead('${escapeAttr(l.id)}')" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
                </td>
            </tr>`;
        }).join("");

        if (window.lucide) lucide.createIcons();
    }

    function alternarLeadAtendido(id, atendido) {
        const marcar = atendido === true || atendido === 'true';
        db.ref(`leads_espera/${id}/atendido`).set(marcar)
            .then(() => dispararToast(marcar ? "Lead marcado como atendido." : "Lead reaberto na fila."))
            .catch(err => { console.error(err); dispararToast("Erro ao atualizar o lead.", "error"); });
    }

    function excluirLead(id) {
        if (!confirm("Remover esta pessoa da fila de espera?")) return;
        db.ref(`leads_espera/${id}`).remove()
            .then(() => dispararToast("Removido da fila."))
            .catch(err => { console.error(err); dispararToast("Erro ao remover.", "error"); });
    }
