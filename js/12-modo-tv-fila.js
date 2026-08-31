    // ==========================================
    // 17. MODO TV / PAINEL DE RECEPÇÃO
    // ==========================================
    let timerRelogioTV = null;

    function abrirModoTV() {
        const modal = document.getElementById("modal-modo-tv");
        if(modal) modal.style.display = 'block';
        
        // Inicia relógio em tempo real
        atualizarRelogioTV();
        timerRelogioTV = setInterval(atualizarRelogioTV, 1000);
        
        renderizarDadosModoTV();
    }

    function fecharModoTV() {
        const modal = document.getElementById("modal-modo-tv");
        if(modal) modal.style.display = 'none';
        if(timerRelogioTV) clearInterval(timerRelogioTV);
    }

    function atualizarRelogioTV() {
        const relogio = document.getElementById("relogio-tv");
        if(relogio) {
            const agora = new Date();
            relogio.innerText = agora.toLocaleTimeString('pt-BR');
        }
    }

    function renderizarDadosModoTV() {
        const hoje = new Date().toISOString().split('T')[0];
        const atendimentosHoje = store.atendimentos
            .filter(a => a.data === hoje)
            .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

        const elCliente = document.getElementById("tv-cliente-atual");
        const elServico = document.getElementById("tv-servico-atual");
        const elProf = document.getElementById("tv-prof-atual");
        const elFila = document.getElementById("tv-lista-fila");

        if (atendimentosHoje.length === 0) {
            if(elCliente) elCliente.innerText = "Nenhum agendamento hoje";
            if(elServico) elServico.innerText = "Aproveite o dia!";
            if(elProf) elProf.innerText = "Salão Livre";
            if(elFila) elFila.innerHTML = "<p style='opacity:0.5; text-align:center;'>Sem clientes na fila.</p>";
            return;
        }

        // O primeiro da lista do dia vira o destaque principal
        const principal = atendimentosHoje[0];
        if(elCliente) elCliente.innerText = principal.nomeCliente || '';
        if(elServico) elServico.innerText = (principal.servicos || []).map(s => s.nome).join(" + ");
        if(elProf) elProf.innerText = `Instrutor: ${principal.nomeProfissional || 'Geral'}`;

        // O restante vai para a fila lateral
        const restante = atendimentosHoje.slice(1);
        if(elFila) {
            if (restante.length === 0) {
                elFila.innerHTML = "<p style='opacity:0.5; text-align:center; margin-top:20px;'>Fila encerrada para hoje!</p>";
            } else {
                elFila.innerHTML = restante.map(a => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; margin-bottom:10px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                        <div>
                            <strong style="font-size:18px; color:#fff;">${escapeHtml(a.nomeCliente)}</strong><br>
                            <small style="color:var(--text-muted);">${escapeHtml((a.servicos || []).map(s => s.nome).join(", "))}</small>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:18px; font-weight:bold; color:var(--success);">${escapeHtml(a.hora)}</span><br>
                            <small style="color:#a78bfa;">${escapeHtml(a.nomeProfissional || '')}</small>
                        </div>
                    </div>
                `).join("");
            }
        }
    }


    // ==========================================
    // 18. ATUALIZAR VISUAL E SOM DA TV
    // ==========================================
    function atualizarVisualModoTV(nome) {
        const elCliente = document.getElementById("tv-cliente-atual");
        
        // Tenta tocar o áudio como reforço visual e sonoro
        const audio = new Audio('assets/ding.mp3');
        audio.play().catch(e => console.log("Áudio bloqueado pelo navegador até o primeiro clique."));

        if (!elCliente) return;

        // Efeito Visual de Ouro e Piscar
        elCliente.innerText = `AGORA: ${nome.toUpperCase()}`;
        elCliente.style.color = "#fbbf24"; // Cor Dourada
        elCliente.style.textShadow = "0 0 20px #fbbf24";
        elCliente.style.animation = "piscar 1s infinite";
        
        // Remove o efeito após 10 segundos
        setTimeout(() => {
            elCliente.style.animation = "none";
            elCliente.style.color = "#fff";
            elCliente.style.textShadow = "none";
        }, 10000);
    }

    // ==========================================
    // 19. FILA INTELIGENTE (CHAMADA NA TV)
    // ==========================================
    function chamarCliente(idAtendimento, nomeCliente) {
        console.log("Chamando cliente:", nomeCliente, "ID:", idAtendimento);

        db.ref('painel_tv').set({
            idAtendimento: idAtendimento,
            nome: nomeCliente,
            timestamp: Date.now()
        }).then(() => {
            dispararToast(`Chamando ${nomeCliente} na TV!`);
        }).catch(erro => {
            console.error("Erro ao chamar cliente:", erro);
            dispararToast("Erro ao acionar a TV", "error");
        });
    }



    function abrirHistoricoRapido(clienteId) {
        const cliente = store.clientes.find(c => c.id == clienteId);
        if (!cliente) {
            return dispararToast("Cliente sem cadastro detalhado.", "error");
        }

        document.getElementById("rapido-nome-cliente").innerText = cliente.nome;
        const container = document.getElementById("rapido-conteudo");

        // Pega a última foto da galeria (se houver)
        const fotos = cliente.galeria ? Object.values(cliente.galeria) : [];
        const ultimaFoto = fotos.length > 0 ? fotos[fotos.length - 1] : null;

        // Pega as últimas anotações de anamnese (se houver)
        const historico = cliente.historico ? Object.values(cliente.historico) : [];
        const ultimaAnamnese = historico.length > 0 ? historico[historico.length - 1] : null;

        container.innerHTML = `
            <div style="margin-bottom: 15px; text-align: center;">
                ${ultimaFoto ? `
                    <img src="${ultimaFoto.img}" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 10px; margin-bottom: 8px;">
                    <small style="opacity: 0.7; display: block;">Ultima foto (${ultimaFoto.data}): ${ultimaFoto.desc}</small>
                ` : `<p style="opacity: 0.5; font-size: 13px;">Nenhuma foto salva na galeria.</p>`}
            </div>
            
            <div style="border-top: 1px solid var(--border); padding-top: 12px;">
                <strong style="font-size: 14px; color: var(--success);">Última Anotação:</strong>
                ${ultimaAnamnese ? `
                    <p style="font-size: 13px; margin-top: 5px; color: #ddd;"><b>${ultimaAnamnese.titulo}</b> (${ultimaAnamnese.data})</p>
                    <p style="font-size: 12px; opacity: 0.8; margin-top: 2px;">${ultimaAnamnese.obs}</p>
                ` : `<p style="opacity: 0.5; font-size: 13px; margin-top: 5px;">Nenhuma anotação registrada.</p>`}
            </div>
        `;

        document.getElementById("modal-historico-rapido").style.display = "flex";
        if (window.lucide) lucide.createIcons();
    }

