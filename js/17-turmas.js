    // ==========================================
    // LOTAÇÃO DAS TURMAS (AGENDA)
    // ==========================================
    // Nó `turmas_lotadas`: { "1": bool, "3": bool, "5": bool, atualizadoEm }.
    // As chaves são o dia da semana (1=segunda, 3=quarta, 5=sexta), os únicos
    // dias com turma experimental. O admin liga/desliga cada dia neste painel
    // (aba Agenda). A página pública (agendar.html) lê esse nó e, se o dia
    // escolhido estiver lotado, manda o visitante para a Fila de Espera.
    // Leitura pública, escrita só autenticada — ver database.rules.json.
    // O listener vive em 02-tema-init-auth.js.

    let turmasLotadas = {};

    const DIAS_TURMA = [
        { n: 1, rot: 'Segunda-feira' },
        { n: 3, rot: 'Quarta-feira' },
        { n: 5, rot: 'Sexta-feira' }
    ];

    function renderTurmasLotadas() {
        const div = document.getElementById("painel-turmas-lotadas");
        if (!div) return;

        const linhas = DIAS_TURMA.map(d => {
            const lotado = turmasLotadas[String(d.n)] === true;
            return `
            <label class="turma-lotacao-item" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid ${lotado ? 'rgba(248,113,113,0.35)' : 'var(--border)'}; border-radius:12px; margin-bottom:10px; background:${lotado ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.02)'};">
                <span style="font-weight:600;">
                    ${d.rot}
                    <span class="badge" style="margin-left:8px; font-size:11px; background:${lotado ? 'rgba(248,113,113,0.18)' : 'rgba(16,185,129,0.18)'}; color:${lotado ? 'var(--danger)' : 'var(--success)'};">
                        ${lotado ? 'LOTADA — vai para fila' : 'Com vagas'}
                    </span>
                </span>
                <input type="checkbox" ${lotado ? 'checked' : ''} onchange="toggleTurmaLotada(${d.n}, this.checked)" style="width:20px; height:20px; cursor:pointer; accent-color: var(--danger);" aria-label="Marcar ${d.rot} como lotada">
            </label>`;
        }).join("");

        const qtd = DIAS_TURMA.filter(d => turmasLotadas[String(d.n)] === true).length;
        const quando = turmasLotadas.atualizadoEm
            ? ` · atualizado em ${new Date(turmasLotadas.atualizadoEm).toLocaleString('pt-BR')}`
            : '';

        div.innerHTML = `
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
                Marque os dias que estão <strong>lotados</strong>. No site, quem tentar agendar
                nesse dia é levado automaticamente para a <strong>Fila de Espera</strong>.
            </p>
            ${linhas}
            <p style="color:var(--text-dim); font-size:12px; margin-top:6px;">
                ${qtd === 0 ? 'Nenhum dia lotado.' : `${qtd} dia(s) lotado(s).`}${quando}
            </p>`;

        if (window.lucide) lucide.createIcons();
    }

    function toggleTurmaLotada(dia, lotado) {
        const chave = String(dia);
        db.ref('turmas_lotadas').update({
            [chave]: !!lotado,
            atualizadoEm: Date.now()
        }).then(() => {
            dispararToast(lotado
                ? `Turma de ${nomeDiaTurma(dia)} marcada como LOTADA.`
                : `Turma de ${nomeDiaTurma(dia)} reaberta.`);
        }).catch(err => {
            console.error("Erro ao atualizar lotação da turma:", err);
            dispararToast("Erro ao salvar a lotação. Tente de novo.", "error");
            renderTurmasLotadas(); // desfaz visualmente o checkbox
        });
    }

    function nomeDiaTurma(dia) {
        const d = DIAS_TURMA.find(x => x.n === Number(dia));
        return d ? d.rot.toLowerCase() : 'turma';
    }
