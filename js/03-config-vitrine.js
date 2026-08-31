    // 5. CONFIGURAÇÕES & MODAL
    // ==========================================
    function abrirModalConfig() {
        document.getElementById("cfg-chave-pix").value = configSistema.chavePix || "";
        document.getElementById("cfg-nome-pix").value = configSistema.nomePix || "";
        document.getElementById("cfg-cidade-pix").value = configSistema.cidadePix || "";
        document.getElementById("cfg-meta-mensal").value = configSistema.metaMensal || "";
        
        document.getElementById("modal-config").style.display = 'flex';
    }

    function salvarConfiguracoes() {
        const novaConfig = {
            chavePix: document.getElementById("cfg-chave-pix").value,
            nomePix: document.getElementById("cfg-nome-pix").value,
            cidadePix: document.getElementById("cfg-cidade-pix").value,
            metaMensal: parseFloat(document.getElementById("cfg-meta-mensal").value) || 0
        };

        db.ref('config').set(novaConfig)
            .then(() => {
                configSistema = novaConfig;
                dispararToast("⚙️ Configurações salvas!");
                fecharModal('modal-config');
                atualizarKPIs(); 
            })
            .catch(erro => dispararToast("Erro ao salvar: " + erro.message, "error"));
    }

    // ==========================================
    // VITRINE / LANDING PAGE PÚBLICA
    // ==========================================
    
    // As imagens da vitrine vão para o Firebase Storage (helper uploadImagem em
    // 01-config-firebase-estado.js). O landingConfig guarda só a URL.
    const enviarImagemVitrine = (file) => uploadImagem(file, 'vitrine', 1200, 0.72);

    function preencherFormularioLanding() {
        if(!document.getElementById("landing-titulo")) return; // Aborta se a página não estiver montada

        document.getElementById("landing-titulo").value = landingConfig.titulo || "";
        document.getElementById("landing-subtitulo").value = landingConfig.subtitulo || "";
        document.getElementById("landing-whatsapp").value = landingConfig.whatsapp || "";
        document.getElementById("landing-instagram").value = landingConfig.instagram || "";
        document.getElementById("landing-endereco").value = landingConfig.endereco || "";
        document.getElementById("landing-maps").value = landingConfig.googleMapsUrl || "";
        
        if(document.getElementById("ba1-texto")) document.getElementById("ba1-texto").value = landingConfig.ba1Texto || "";
        if(document.getElementById("ba2-texto")) document.getElementById("ba2-texto").value = landingConfig.ba2Texto || "";
    }

    async function salvarConfigLanding() {
        const btn = document.querySelector('#config-landing button');
        if(!btn) return;
        
        const txtOriginal = btn.innerText;
        btn.innerText = "COMPRIMINDO E SALVANDO...";
        btn.disabled = true;

        try {
            const titulo = document.getElementById("landing-titulo").value.trim();
            const subtitulo = document.getElementById("landing-subtitulo").value.trim();
            const whatsapp = document.getElementById("landing-whatsapp").value.replace(/\D/g, ''); 
            const instagram = document.getElementById("landing-instagram").value.trim();
            const endereco = document.getElementById("landing-endereco").value.trim();
            const maps = document.getElementById("landing-maps").value.trim();

            const updates = { titulo, subtitulo, whatsapp, instagram, endereco, googleMapsUrl: maps };

            // CAPA PRINCIPAL
            const capaInput = document.getElementById("landing-capa");
            if (capaInput && capaInput.files[0]) updates.capa = await enviarImagemVitrine(capaInput.files[0]);
            else if (landingConfig.capa) updates.capa = landingConfig.capa;

            // FOTO DA EQUIPE
            const equipeInput = document.getElementById("landing-equipe-foto");
            if (equipeInput && equipeInput.files[0]) updates.equipeFoto = await enviarImagemVitrine(equipeInput.files[0]);
            else if (landingConfig.equipeFoto) updates.equipeFoto = landingConfig.equipeFoto;

            // ALUNO DESTAQUE 1 (ANTES E DEPOIS)
            const ba1Antes = document.getElementById("ba1-antes");
            const ba1Depois = document.getElementById("ba1-depois");
            updates.ba1Texto = document.getElementById("ba1-texto").value.trim();
            
            if (ba1Antes && ba1Antes.files[0]) updates.ba1Antes = await enviarImagemVitrine(ba1Antes.files[0]);
            else if (landingConfig.ba1Antes) updates.ba1Antes = landingConfig.ba1Antes;
            
            if (ba1Depois && ba1Depois.files[0]) updates.ba1Depois = await enviarImagemVitrine(ba1Depois.files[0]);
            else if (landingConfig.ba1Depois) updates.ba1Depois = landingConfig.ba1Depois;

            // ALUNO DESTAQUE 2 (ANTES E DEPOIS)
            const ba2Antes = document.getElementById("ba2-antes");
            const ba2Depois = document.getElementById("ba2-depois");
            updates.ba2Texto = document.getElementById("ba2-texto").value.trim();
            
            if (ba2Antes && ba2Antes.files[0]) updates.ba2Antes = await enviarImagemVitrine(ba2Antes.files[0]);
            else if (landingConfig.ba2Antes) updates.ba2Antes = landingConfig.ba2Antes;
            
            if (ba2Depois && ba2Depois.files[0]) updates.ba2Depois = await enviarImagemVitrine(ba2Depois.files[0]);
            else if (landingConfig.ba2Depois) updates.ba2Depois = landingConfig.ba2Depois;

            // Salva no banco de dados
            await db.ref('landingConfig').set(updates);
            
            // Atualiza na memória do navegador
            landingConfig = updates;
            
            dispararToast("🌐 Vitrine atualizada com sucesso!");
        } catch (error) {
            console.error(error);
            dispararToast("Erro ao salvar vitrine", "error");
        } finally {
            btn.innerText = txtOriginal;
            btn.disabled = false;
        }
    }

    

    // ==========================================
