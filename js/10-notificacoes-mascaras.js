    // ==========================================
    // 13. NOTIFICAÇÕES (LÓGICA)
    // ==========================================
    function verificarNotificacoes() {
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);
        
        // Formata para YYYY-MM-DD mantendo o fuso local (evita erro de virada de dia UTC)
        const y = amanha.getFullYear();
        const m = String(amanha.getMonth() + 1).padStart(2, '0');
        const d = String(amanha.getDate()).padStart(2, '0');
        const dataAmanhaStr = `${y}-${m}-${d}`;

        const clientesAmanha = store.atendimentos.filter(a => a.data === dataAmanhaStr);
        
        const badge = document.getElementById("badge-notificacao");
        const lista = document.getElementById("lista-notificacoes-itens");
        
        // Atualiza a bolinha vermelha
        if (clientesAmanha.length > 0) {
            badge.style.display = "flex";
            badge.innerText = clientesAmanha.length;
            
            // Atualiza a lista
            lista.innerHTML = clientesAmanha.map(a => {
                const cliente = a.clienteId ? store.clientes.find(c => c.id == a.clienteId) : null;
                const telClienteBruto = (cliente && cliente.telefone) || a.telefoneCliente || '';
                const telefoneClean = String(telClienteBruto).replace(/\D/g, '');
                const linkConfirmar = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Oi ${a.nomeCliente}! Passando para confirmar seu horário amanhã às ${a.hora} no Funcional do Ari. Podemos confirmar? 💪`)}` : '';
                const itens = (a.servicos || []).map(s => s.nome).join(", ");
                return `
                <div class="notif-item">
                    <div>
                        <strong>${escapeHtml(a.nomeCliente)}</strong>
                        <span>${escapeHtml(a.hora)} - ${escapeHtml(itens)}</span>
                    </div>
                    ${linkConfirmar ? `<a href="${linkConfirmar}" target="_blank" class="btn-small bg-green" style="text-decoration:none; white-space:nowrap;" title="Confirmar no WhatsApp"><i data-lucide="message-circle" style="width:14px; height:14px;"></i></a>` : ''}
                </div>
            `}).join("");
            lucide.createIcons();
        } else {
            badge.style.display = "none";
            lista.innerHTML = `<p style="padding:15px; opacity:0.5; font-size:12px; text-align:center;">Nenhum agendamento para amanhã.</p>`;
        }
    }

    function toggleNotificacoes() {
        const dropdown = document.getElementById("dropdown-notificacoes");
        if (dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        } else {
            dropdown.classList.add('active');
        }
    }

    // Fecha dropdown ao clicar fora dele
    document.addEventListener('click', function(e) {
        const wrapper = document.querySelector('.notification-wrapper');
        const dropdown = document.getElementById("dropdown-notificacoes");
        
        if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // ==========================================
    // 12. MÁSCARAS DE INPUT (UX)
    // ==========================================
    document.addEventListener('input', function (e) {
        const target = e.target;

        // Máscara de Telefone (id contém 'tel')
        if (target.id.includes('tel')) {
            let x = target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        }
    });

    // --- FUNÇÃO DE DEBOUNCE ---
    let timeoutBuscaCliente;
    function filtrarClientesDebounced() {
        clearTimeout(timeoutBuscaCliente);
        timeoutBuscaCliente = setTimeout(() => {
            filtrarClientes();
        }, 300); // Aguarda 300ms após o usuário parar de digitar
    }


