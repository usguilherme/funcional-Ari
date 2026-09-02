    // 5. CONFIGURAÇÕES & MODAL
    // ==========================================
    function abrirModalConfig() {
        document.getElementById("cfg-chave-pix").value = configSistema.chavePix || "";
        document.getElementById("cfg-nome-pix").value = configSistema.nomePix || "";
        document.getElementById("cfg-cidade-pix").value = configSistema.cidadePix || "";
        document.getElementById("cfg-meta-mensal").value = configSistema.metaMensal || "";
        const campoEvo = document.getElementById("cfg-evolucao-base");
        if (campoEvo) campoEvo.value = configSistema.evolucaoBaseUrl || "";

        document.getElementById("modal-config").style.display = 'flex';
    }

    function salvarConfiguracoes() {
        // URL base da evolução: normaliza (só http/https, sem espaços). Vazio =
        // volta para o padrão no servidor (api/consulta-aluno.js).
        let evolucaoBaseUrl = (document.getElementById("cfg-evolucao-base")?.value || "").trim();
        if (evolucaoBaseUrl && !/^https?:\/\//i.test(evolucaoBaseUrl)) {
            evolucaoBaseUrl = "https://" + evolucaoBaseUrl.replace(/^\/+/, "");
        }

        const novaConfig = {
            chavePix: document.getElementById("cfg-chave-pix").value,
            nomePix: document.getElementById("cfg-nome-pix").value,
            cidadePix: document.getElementById("cfg-cidade-pix").value,
            metaMensal: parseFloat(document.getElementById("cfg-meta-mensal").value) || 0,
            evolucaoBaseUrl: evolucaoBaseUrl
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
    
    // As imagens da vitrine são comprimidas no navegador e guardadas como
    // string base64 no próprio landingConfig (helper uploadImagem em
    // 01-config-firebase-estado.js). Não há upload para o Firebase Storage.
    // Largura menor aqui porque o landingConfig é público e recarregado a
    // cada visita da vitrine — segura o tamanho do payload.
    const enviarImagemVitrine = (file) => uploadImagem(file, 'vitrine', 1000, 0.7);

    function preencherFormularioLanding() {
        if(!document.getElementById("landing-titulo")) return; // Aborta se a página não estiver montada

        document.getElementById("landing-titulo").value = landingConfig.titulo || "";
        document.getElementById("landing-subtitulo").value = landingConfig.subtitulo || "";
        document.getElementById("landing-whatsapp").value = landingConfig.whatsapp || "";
        document.getElementById("landing-instagram").value = landingConfig.instagram || "";
        document.getElementById("landing-endereco").value = landingConfig.endereco || "";
        document.getElementById("landing-maps").value = landingConfig.googleMapsUrl || "";

        const inHorariosAluno = document.getElementById("landing-horarios-aluno");
        if (inHorariosAluno) inHorariosAluno.value = landingConfig.horariosAluno || "";
        const inRecadoAluno = document.getElementById("landing-recado-aluno");
        if (inRecadoAluno) inRecadoAluno.value = landingConfig.recadoAluno || "";
        
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

            const horariosAluno = document.getElementById("landing-horarios-aluno")?.value.trim() || "";
            const recadoAluno = document.getElementById("landing-recado-aluno")?.value.trim() || "";

            const updates = { titulo, subtitulo, whatsapp, instagram, endereco, googleMapsUrl: maps, horariosAluno, recadoAluno };

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
            const msg = (error && error.message) ? error.message : "Verifique sua conexão e tente novamente.";
            alert("Não foi possível salvar a vitrine.\n\n" + msg);
            dispararToast("Erro ao salvar vitrine", "error");
        } finally {
            // Destrava o botão SEMPRE, mesmo se algo acima falhar.
            btn.disabled = false;
            btn.innerText = txtOriginal || "SALVAR VITRINE";
        }
    }

    // ==========================================
    // AULÕES / EVENTOS ESPECIAIS DA VITRINE
    // ==========================================
    // Salvos em vitrine_eventos/{id}. É um nó público (lido direto pela
    // vitrine.html), então as imagens seguem o mesmo padrão do resto da vitrine:
    // comprimidas no navegador e guardadas como data URL. O admin também pode
    // colar uma URL de imagem pronta em vez de subir um arquivo.
    let eventosVitrine = [];
    let idEventoVitrineEdicao = null;

    function formatarDataEvento(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
        const [a, m, d] = iso.split('-').map(Number);
        const dt = new Date(a, m - 1, d);
        const txt = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        return txt.charAt(0).toUpperCase() + txt.slice(1);
    }

    function fonteImagemEvento(foto) {
        const s = String(foto || "").trim();
        if (!s) return "";
        return s.startsWith('data:') ? s : encodeURI(s);
    }

    function renderListaEventosVitrine() {
        const div = document.getElementById("lista-eventos-cad");
        if (!div) return;

        const lista = [...eventosVitrine].sort((x, y) =>
            String(x.dataISO || "").localeCompare(String(y.dataISO || "")));

        if (!lista.length) {
            div.innerHTML = `<p style="font-size:13px; color:var(--text-muted);">Nenhum aulão cadastrado ainda.</p>`;
            return;
        }

        div.innerHTML = lista.map(e => `<div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px;">
            <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:0;">
                ${e.foto ? `<img src="${fonteImagemEvento(e.foto)}" alt="" style="width:50px; height:50px; object-fit:cover; border-radius:8px; flex-shrink:0;">` : ''}
                <div style="min-width:0;">
                    <strong>${escapeHtml(e.titulo)}</strong><br>
                    <span class="text-gradient">${escapeHtml(formatarDataEvento(e.dataISO))}</span>
                    ${e.descricao ? `<br><small class="text-muted" style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;">${escapeHtml(e.descricao)}</small>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-shrink:0;">
                <button class="btn-small bg-yellow" onclick="prepararEdicaoEvento('${escapeAttr(e.id)}')" title="Editar"><i data-lucide="pencil" style="width:14px"></i></button>
                <button class="btn-small bg-purple" onclick="excluirEventoVitrine('${escapeAttr(e.id)}')" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
            </div>
        </div>`).join("");

        if (window.lucide) lucide.createIcons();
    }

    function excluirEventoVitrine(id) {
        if (!confirm("Excluir este aulão da vitrine?")) return;
        db.ref(`vitrine_eventos/${id}`).remove()
            .then(() => dispararToast("Aulão excluído."))
            .catch(err => dispararToast("Erro ao excluir: " + err.message, "error"));
    }

    function prepararEdicaoEvento(id) {
        const e = eventosVitrine.find(x => String(x.id) === String(id));
        if (!e) return;

        document.getElementById("evt-titulo").value = e.titulo || "";
        document.getElementById("evt-data").value = e.dataISO || "";
        document.getElementById("evt-descricao").value = e.descricao || "";
        document.getElementById("evt-foto").value = "";
        document.getElementById("evt-foto-url").value = (e.foto && !String(e.foto).startsWith('data:')) ? e.foto : "";

        const preview = document.getElementById("evt-foto-preview");
        if (preview) preview.innerHTML = e.foto
            ? `<img src="${fonteImagemEvento(e.foto)}" style="width:90px; height:90px; object-fit:cover; border-radius:10px;">`
            : "";

        idEventoVitrineEdicao = id;
        const btn = document.getElementById("btn-salvar-evento");
        if (btn) { btn.innerText = "ATUALIZAR AULÃO"; btn.style.background = "var(--warning)"; }
        const cancelar = document.getElementById("btn-cancelar-evento");
        if (cancelar) cancelar.style.display = "inline-flex";

        const alvo = document.getElementById("config-eventos");
        if (alvo) alvo.scrollIntoView({ behavior: 'smooth' });
    }

    function cancelarEdicaoEvento() {
        idEventoVitrineEdicao = null;
        ["evt-titulo", "evt-data", "evt-descricao", "evt-foto", "evt-foto-url"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
        const preview = document.getElementById("evt-foto-preview");
        if (preview) preview.innerHTML = "";
        const btn = document.getElementById("btn-salvar-evento");
        if (btn) { btn.innerText = "SALVAR AULÃO"; btn.style.background = ""; }
        const cancelar = document.getElementById("btn-cancelar-evento");
        if (cancelar) cancelar.style.display = "none";
    }

    async function salvarEventoVitrine() {
        const titulo = document.getElementById("evt-titulo").value.trim();
        const dataISO = document.getElementById("evt-data").value;
        const descricao = document.getElementById("evt-descricao").value.trim();
        const fotoInput = document.getElementById("evt-foto");
        const fotoUrl = document.getElementById("evt-foto-url").value.trim();
        const btn = document.getElementById("btn-salvar-evento");

        if (!titulo) return dispararToast("Preencha o título do aulão!", "error");
        if (!dataISO) return dispararToast("Escolha a data do aulão!", "error");
        if (!descricao) return dispararToast("Escreva uma descrição curta!", "error");

        const emEdicao = eventosVitrine.find(x => String(x.id) === String(idEventoVitrineEdicao));
        const temFoto = (fotoInput && fotoInput.files[0]) || fotoUrl || (emEdicao && emEdicao.foto);
        if (!temFoto) return dispararToast("Adicione uma foto (upload ou URL).", "error");

        const txtOriginal = btn ? btn.innerText : "";
        if (btn) {
            btn.disabled = true;
            btn.innerText = (fotoInput && fotoInput.files[0]) ? "ENVIANDO FOTO..." : "SALVANDO...";
        }

        try {
            const dados = { titulo, dataISO, descricao };

            if (fotoInput && fotoInput.files[0]) {
                dados.foto = await enviarImagemVitrine(fotoInput.files[0]);
            } else if (fotoUrl) {
                dados.foto = fotoUrl;
            } else if (emEdicao && emEdicao.foto) {
                dados.foto = emEdicao.foto;
            }

            if (idEventoVitrineEdicao) {
                await db.ref(`vitrine_eventos/${idEventoVitrineEdicao}`).update(dados);
                dispararToast("🔥 Aulão atualizado!");
            } else {
                const id = novoId();
                await db.ref(`vitrine_eventos/${id}`).set({ id, ...dados, criadoEm: Date.now() });
                dispararToast("🔥 Aulão publicado na vitrine!");
            }
            cancelarEdicaoEvento();
        } catch (error) {
            console.error("Erro ao salvar aulão:", error);
            const msg = (error && error.message) ? error.message : "Verifique sua conexão e tente novamente.";
            alert("Não foi possível salvar o aulão.\n\n" + msg);
            dispararToast("Erro ao salvar o aulão.", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                if (btn.innerText === "ENVIANDO FOTO..." || btn.innerText === "SALVANDO...") {
                    btn.innerText = txtOriginal || "SALVAR AULÃO";
                }
            }
        }
    }

    // ==========================================
