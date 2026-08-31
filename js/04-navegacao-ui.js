    // 6. NAVEGAÇÃO E UI
    // ==========================================
    function abrirAba(idAba) {
        const abasAtivas = document.querySelectorAll('.aba');
        abasAtivas.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            setTimeout(() => el.style.display = 'none', 200);
        });

        document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => el.classList.remove('active'));
        
        const btnMenu = document.querySelector(`.nav-item[onclick*="${idAba}"]`);
        if(btnMenu) btnMenu.classList.add('active');
        
        const btnMobile = document.querySelector(`.mobile-nav-item[onclick*="${idAba}"]`);
        if(btnMobile) btnMobile.classList.add('active');
        
        setTimeout(() => {
            const aba = document.getElementById(idAba);
            if(aba) {
                aba.style.display = 'block';
                void aba.offsetWidth; // Força reflow
                aba.classList.add('fade-in');
                aba.style.opacity = '1';
                aba.style.transform = 'translateY(0)';
            }
            lucide.createIcons();
        }, 200);

        // LÓGICA DE SINCRONIZAÇÃO DE DATA (AGENDA -> PDV)
        if (idAba === 'novo_atendimento') {
            const dataAgenda = document.getElementById("agenda-date-input");
            const dataPDV = document.getElementById("pdv-data");
            
            // Se estivermos editando um atendimento, não mexe na data, usa a original
            if (idAtendimentoEdicao) return;

            // Se veio da Agenda e tem data selecionada, aplica no PDV
            if (dataAgenda && dataAgenda.value && dataPDV) {
                dataPDV.value = dataAgenda.value;
            } else if (dataPDV && !dataPDV.value) {
                // Se não, usa hoje como fallback
                dataPDV.value = new Date().toISOString().split('T')[0];
            }
        }

        // NOVO: preenche o formulário da vitrine ao abrir essa aba
        if (idAba === 'landing') {
            setTimeout(preencherFormularioLanding, 250);
        }

        // Hooks por aba (antes eram feitos monkey-patchando window.abrirAba
        // em vários módulos, o que gerava wrappers duplicados).
        if (idAba === 'novo_atendimento' && typeof renderTabelaAtualizacao === 'function') {
            renderTabelaAtualizacao();
        }
        if (idAba === 'avaliacoes' && typeof renderTabelaAvaliacoes === 'function') {
            renderTabelaAvaliacoes();
        }
        if (idAba === 'rh' && typeof inicializarDadosRH === 'function') {
            inicializarDadosRH();
        }
        if (idAba === 'agenda') {
            if (typeof renderAgendamentosPublicos === 'function') renderAgendamentosPublicos();
            if (typeof renderAgenda === 'function') renderAgenda();
        }
    }

    function dispararToast(msg, tipo = 'success') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const el = document.createElement('div');
        el.className = 'glass-panel';
        el.style.padding = '15px 20px';
        el.style.marginBottom = '10px';
        el.style.borderLeft = tipo === 'error' ? '4px solid #f43f5e' : '4px solid #10b981';
        el.style.color = 'white';
        el.innerText = msg;
        el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
        
        container.style.position = 'fixed';
        if (document.body.classList.contains('mobile-mode')) {
            container.style.bottom = '80px'; 
        } else {
            container.style.bottom = '20px';
        }
        container.style.right = '20px';
        container.style.zIndex = '9999';

        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // ==========================================
