    function renderTabelaClientes() {
        const tbody = document.getElementById("tabela-clientes");
        if(!tbody) return;
        
        // Ordena os clientes por nome de forma alfabética (A-Z)
        const clientesOrdenados = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
        
        tbody.innerHTML = clientesOrdenados.map(cli => {
            // Tratamento para exibir "-" caso o aluno não tenha aquele dado preenchido
            const sexo = escapeHtml(cli.sexo || '-');
            const idade = escapeHtml(cli.idade || '-');
            const telefone = escapeHtml(cli.telefone || '-');
            const email = escapeHtml(cli.email || '-');
            const objetivo = escapeHtml(cli.objetivo || '-');
            const frequencia = escapeHtml(cli.frequencia || '-');
            const tempo = escapeHtml(cli.tempoTreino || '-');
            const nome = escapeHtml(cli.nome);
            const idAttr = escapeAttr(cli.id);

            // Formata a data de YYYY-MM-DD para DD/MM/YYYY
            const inicio = cli.inicio ? cli.inicio.split('-').reverse().join('/') : '-';
            const vencimento = cli.vencimento ? `Dia ${escapeHtml(cli.vencimento)}` : '-';

            // Formata o número para o link do WhatsApp (tira parênteses e traços)
            const telefoneClean = cli.telefone ? String(cli.telefone).replace(/\D/g, '') : '';
            const zapLink = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Olá ${String(cli.nome || '').split(' ')[0]}, passando para lembrar do vencimento da sua mensalidade dia ${cli.vencimento} no Funcional do Ari!`)}` : '#';
            const fotoSafe = encodeURI(cli.foto || '');

            return `<tr data-cliente-id="${idAttr}">
                <td><div class="avatar" style="background-image:url('${fotoSafe}'); background-size:cover;">${cli.foto ? '' : nome.charAt(0).toUpperCase()}</div></td>
                <td><strong style="cursor:pointer; color:var(--primary)" onclick="abrirModalAnamnese('${idAttr}')" title="Ver Histórico Completo">${nome}</strong></td>
                <td>${sexo}</td>
                <td>${idade}</td>
                <td>${telefone}</td>
                <td>${email}</td>
                <td>${objetivo}</td>
                <td>${frequencia}</td>
                <td>${tempo}</td>
                <td>${inicio}</td>
                <td><span class="badge bg-purple">${vencimento}</span></td>
                <td style="white-space: nowrap; display: flex; gap: 6px;">
                    <button class="btn-small bg-yellow" onclick="editarCliente('${idAttr}')" title="Editar">
                        <i data-lucide="pencil" style="width:16px; height:16px;"></i>
                    </button>
                    <button class="btn-small bg-purple" onclick="abrirModalAnamnese('${idAttr}')" title="Ficha do Aluno">
                        <i data-lucide="clipboard-list" style="width:16px; height:16px;"></i>
                    </button>
                    ${telefoneClean ? `<a href="${zapLink}" target="_blank" class="btn-small bg-green" style="display:flex; align-items:center; text-decoration:none;" title="Cobrar no WhatsApp"><i data-lucide="message-circle" style="width:16px; height:16px;"></i></a>` : ''}
                    <button class="btn-small" style="background: rgba(248,113,113,0.1); color: var(--danger); border: 1px solid rgba(248,113,113,0.2);" onclick="excluirCliente('${idAttr}')" title="Excluir">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </td>
            </tr>`;
        }).join("");
        
        lucide.createIcons();
        if(document.getElementById("busca-cliente") || document.getElementById("clientes-filtro-profissional")) filtrarClientes();
    }
    
    function excluirCliente(id) {
        if(confirm("Tem certeza que deseja excluir este cliente? O histórico será perdido.")) {
            db.ref(`clientes/${id}`).remove()
            .then(() => dispararToast("Cliente removido!", "error"));
        }
    }

    function filtrarRetornosDashboard() {
        const div = document.getElementById("lista-retornos-dashboard");
        if(!div) return;
        const filtroData = document.getElementById("dash-filtro-data").value;
        const hoje = new Date().toISOString().split('T')[0];
        let lista = filtroData ? store.clientes.filter(c => c.previsaoRetorno === filtroData) : store.clientes.filter(c => c.previsaoRetorno && c.previsaoRetorno <= hoje);
        
        if(lista.length === 0) {
            div.innerHTML = `<p style='padding:15px; opacity:0.6'>${filtroData ? "Nenhum retorno para esta data." : "Nenhum retorno urgente."}</p>`;
            return;
        }
        div.innerHTML = lista.map(c => {
            const telefoneClean = c.telefone ? String(c.telefone).replace(/\D/g, '') : '';
            const linkZap = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Oi ${c.nome}, seu retorno está previsto para ${formatarData(c.previsaoRetorno)}.`)}` : '#';
            const isLate = c.previsaoRetorno < hoje;
            return `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
                <div><strong>${escapeHtml(c.nome)}</strong><br><small style="color:${isLate ? '#f43f5e' : '#f59e0b'}">${isLate ? 'Atrasado: ' : 'Data: '}${formatarData(c.previsaoRetorno)}</small></div>
                ${telefoneClean ? `<a href="${linkZap}" target="_blank" class="btn-small bg-green" style="text-decoration:none">Chamar</a>` : ''}
            </div>`
        }).join("");
    }

    function limparFiltroRetorno() {
        const input = document.getElementById("dash-filtro-data");
        if(input) { input.value = ""; filtrarRetornosDashboard(); }
    }

    function renderAniversariantesDashboard() {
        const card = document.getElementById("card-aniversariantes");
        const div = document.getElementById("lista-aniversariantes-dashboard");
        if(!card || !div) return;

        const hojeMesDia = new Date().toISOString().slice(5, 10); // "MM-DD"
        const aniversariantes = store.clientes.filter(c => c.dataNasc && c.dataNasc.slice(5, 10) === hojeMesDia);

        if(aniversariantes.length === 0) {
            card.style.display = "none";
            return;
        }

        card.style.display = "block";
        div.innerHTML = aniversariantes.map(c => {
            const telefoneClean = c.telefone ? String(c.telefone).replace(/\D/g, '') : '';
            const linkZapAniversario = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Feliz Aniversário, ${c.nome}! 🎉🎂 A equipe Funcional do Ari deseja um dia repleto de alegria. Contamos com sua visita para comemorar! 💪`)}` : '#';
            return `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
                <div><strong>🎂 ${escapeHtml(c.nome)}</strong>${c.telefone ? `<br><small style="opacity:0.7">${escapeHtml(c.telefone)}</small>` : ''}</div>
                ${telefoneClean ? `<a href="${linkZapAniversario}" target="_blank" class="btn-small" style="background:#f59e0b; color:white; text-decoration:none">Parabenizar</a>` : '<small style="opacity:0.5">Sem telefone</small>'}
            </div>`
        }).join("");
    }

    function abrirModalCliente() {
        // Sai de qualquer modo de edição anterior. Sem isto, editar um aluno e
        // depois clicar em "Cadastrar Novo Aluno" salvava por cima do aluno editado.
        idClienteEdicao = null;

        // 1. Atualiza o título para garantir que é um cadastro novo
        const titulo = document.getElementById('titulo-modal-cliente');
        if (titulo) titulo.innerText = 'Cadastrar Novo Aluno';

        // 2. Lista de todos os IDs de inputs que o modal pode ter
        const campos = [
            'id-cliente-edicao', 'novo-cli-nome', 'novo-cli-sexo', 'novo-cli-idade',
            'novo-cli-tel', 'novo-cli-email', 'novo-cli-objetivo', 'novo-cli-frequencia',
            'novo-cli-tempo', 'novo-cli-inicio', 'novo-cli-vencimento', 'novo-cli-nasc', 'novo-cli-foto',
            'novo-cli-drive'
        ];

        // 3. Limpa os campos de forma SEGURA (se o campo não existir, ele ignora e não trava)
        campos.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.value = '';
            }
        });

        // 4. Atualiza a lista de planos disponíveis no select do modal
        if (typeof renderSelectPlanosAluno === 'function') {
            renderSelectPlanosAluno();
        }

        // 5. Exibe o modal na tela
        const modal = document.getElementById('modal-novo-cliente');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error('Erro: Modal modal-novo-cliente não encontrado no HTML.');
        }
    }

    function editarCliente(id) {
        const c = store.clientes.find(x => x.id == id);
        if (!c) return;

        idClienteEdicao = id;
        
        // Atualiza o título do modal
        const titulo = document.getElementById("titulo-modal-cliente");
        if(titulo) titulo.innerText = "Editar Aluno";

        // Função auxiliar para preencher os dados de forma segura sem travar o código
        const preencherCampo = (idElemento, valor) => {
            const el = document.getElementById(idElemento);
            if (el) el.value = valor || "";
        };

        // Garante que as opções de planos estejam carregadas antes de definir o valor salvo do aluno
        if (typeof renderSelectPlanosAluno === 'function') {
            renderSelectPlanosAluno();
        }

        // Puxa todos os dados do banco e preenche no formulário novo
        preencherCampo("novo-cli-nome", c.nome);
        preencherCampo("novo-cli-sexo", c.sexo);
        preencherCampo("novo-cli-idade", c.idade);
        preencherCampo("novo-cli-tel", c.telefone);
        preencherCampo("novo-cli-email", c.email);
        preencherCampo("novo-cli-objetivo", c.objetivo);
        preencherCampo("novo-cli-frequencia", c.frequencia);
        preencherCampo("novo-cli-tempo", c.tempoTreino);
        preencherCampo("novo-cli-inicio", c.inicio);
        preencherCampo("novo-cli-vencimento", c.vencimento);
        preencherCampo("novo-cli-drive", c.linkDrive);

        preencherCampo("novo-cli-nasc", c.dataNasc);

        // Exibe o modal na tela
        const modal = document.getElementById("modal-novo-cliente");
        if (modal) modal.style.display = 'flex';
    }

    function fecharModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    async function salvarNovoClienteModal() {
        const btn = document.querySelector('#modal-novo-cliente .btn-glow');
        const nome = document.getElementById("novo-cli-nome").value.trim();
        const sexo = document.getElementById("novo-cli-sexo")?.value || "";
        const idade = document.getElementById("novo-cli-idade")?.value || "";

        // Telefone é opcional; vazio vira "Não informado".
        const tel = document.getElementById("novo-cli-tel").value.trim() || "Não informado";

        const email = document.getElementById("novo-cli-email")?.value.trim() || "";
        const objetivo = document.getElementById("novo-cli-objetivo")?.value.trim() || "";
        const frequencia = document.getElementById("novo-cli-frequencia")?.value.trim() || "";
        const tempoTreino = document.getElementById("novo-cli-tempo")?.value.trim() || "";
        const inicio = document.getElementById("novo-cli-inicio")?.value || new Date().toISOString().split('T')[0];
        const dataNasc = document.getElementById("novo-cli-nasc")?.value || "";

        // Captura o link do Google Drive para avaliações
        const linkDrive = document.getElementById("novo-cli-drive")?.value.trim() || "";

        // AUTOMATIZAÇÃO DO VENCIMENTO: Pega o dia exato da data de início escolhida
        let vencimento = document.getElementById("novo-cli-vencimento")?.value;
        if (!vencimento && inicio) {
            vencimento = parseInt(inicio.split('-')[2], 10).toString();
        }
        if (!vencimento) vencimento = "10";

        const fotoInput = document.getElementById("novo-cli-foto");

        if(!nome) return dispararToast("Nome é obrigatório", "error");
        if(!sexo) return dispararToast("Selecione o sexo", "error");

        const editando = !!idClienteEdicao;
        const textoBtn = btn ? btn.innerText : "";
        if (btn) { btn.disabled = true; btn.innerText = fotoInput && fotoInput.files[0] ? "ENVIANDO FOTO..." : "SALVANDO..."; }

        try {
            let fotoUrl = null;
            if (fotoInput && fotoInput.files[0]) {
                fotoUrl = await uploadImagem(fotoInput.files[0], 'fotos_alunos', 600, 0.7);
            }

            if (editando) {
                const updates = {
                    nome, sexo, idade, telefone: tel, email, dataNasc,
                    objetivo, frequencia, tempoTreino, inicio, vencimento, linkDrive
                };
                if (fotoUrl) updates.foto = fotoUrl;
                await db.ref(`clientes/${idClienteEdicao}`).update(updates);
                dispararToast("Dados do aluno atualizados!");
            } else {
                const id = novoId();
                await db.ref(`clientes/${id}`).set({
                    id, nome, sexo, idade, telefone: tel, email, dataNasc,
                    objetivo, frequencia, tempoTreino, inicio, vencimento, linkDrive,
                    dataCadastro: new Date().toISOString(),
                    pontos: 0,
                    statusMensalidade: 'atrasado',
                    foto: fotoUrl || null
                });
                dispararToast("Aluno cadastrado!");
            }

            idClienteEdicao = null;
            fecharModal('modal-novo-cliente');

            ["novo-cli-nome","novo-cli-sexo","novo-cli-idade","novo-cli-tel","novo-cli-email",
             "novo-cli-objetivo","novo-cli-frequencia","novo-cli-tempo","novo-cli-inicio",
             "novo-cli-nasc","novo-cli-drive","novo-cli-vencimento"].forEach(campo => {
                const el = document.getElementById(campo);
                if (el) el.value = "";
            });
            if (fotoInput) fotoInput.value = "";
        } catch (erro) {
            console.error("Erro ao salvar aluno:", erro);
            dispararToast("Erro ao salvar o aluno. Tente novamente.", "error");
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = textoBtn || "SALVAR ALUNO"; }
        }
    }

    function abrirModalAnamnese(id) {
        clienteAnamneseAtual = store.clientes.find(c => c.id == id);
        if(!clienteAnamneseAtual) return;
        document.getElementById("modal-anamnese").style.display = 'flex';
        document.getElementById("anamnese-cliente-nome").innerText = clienteAnamneseAtual.nome;
        
        // Agora abre na aba de compras (histórico) por padrão
        trocarAbaAnamnese('compras');
        
        // PREENCHE O HISTÓRICO DE COMPRAS/SERVIÇOS
        const divCompras = document.getElementById("lista-compras-servicos");
        if(divCompras) {
            const comprasDoCliente = store.atendimentos
                .filter(a => a.clienteId == id)
                .sort((a,b) => b.timestamp - a.timestamp);

            if(comprasDoCliente.length === 0) {
                divCompras.innerHTML = "<p style='opacity:0.5; padding:10px; text-align:center'>Nenhum serviço realizado ainda.</p>";
            } else {
                divCompras.innerHTML = comprasDoCliente.map(a => `
                    <div style="border-bottom:1px solid var(--border); padding:10px 0;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong style="color:var(--success)">${formatarData(a.data)}</strong>
                            <small>Total: R$ ${(Number(a.total) || 0).toFixed(2)}</small>
                        </div>
                        <div style="font-size:12px; margin-top:5px; color:#ddd;">
                            ${(a.servicos || []).map(s => `• ${escapeHtml(s.nome)}`).join("<br>")}
                        </div>
                    </div>
                `).join("");
            }
        }
    }

    function trocarAbaAnamnese(aba) {
        // Esconde todas
        const abas = ['historico', 'galeria', 'compras'];
        abas.forEach(a => {
            const el = document.getElementById('tab-' + a);
            if(el) el.style.display = 'none';
        });
        
        // Mostra a selecionada
        const alvo = document.getElementById('tab-' + aba);
        if(alvo) alvo.style.display = 'block';
        
        // Atualiza botões
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[onclick*="${aba}"]`).classList.add('active');
        
        if(aba === 'historico') renderHistoricoAnamnese();
        if(aba === 'galeria') renderGaleriaFotos();
    }

    function renderHistoricoAnamnese() {
        const div = document.getElementById("historico-lista");
        const hist = clienteAnamneseAtual.historico ? Object.values(clienteAnamneseAtual.historico) : [];
        div.innerHTML = hist.length === 0 ? "<small style='opacity:0.5'>Sem anotações técnicas.</small>" : hist.reverse().map(h => `<div style="border-left:2px solid var(--primary); padding-left:10px; margin-bottom:15px"><div style="display:flex; justify-content:space-between"><strong>${escapeHtml(h.titulo)}</strong><small style="opacity:0.5">${escapeHtml(h.data)}</small></div><p style="font-size:13px; color:#ddd; margin-top:5px; white-space:pre-wrap;">${escapeHtml(h.obs)}</p></div>`).join("");
    }

    function renderGaleriaFotos() {
        const div = document.getElementById("galeria-grid");
        const fotos = clienteAnamneseAtual.galeria ? Object.values(clienteAnamneseAtual.galeria) : [];
        
        div.innerHTML = fotos.length === 0 ? "<small style='opacity:0.5; grid-column:span 3; text-align:center;'>Nenhuma foto salva.</small>" : fotos.reverse().map(f => `
            <div class="gallery-item" onclick="window.open('${encodeURI(f.img || '')}')">
                <img src="${encodeURI(f.img || '')}" alt="">
                <div class="gallery-caption">${escapeHtml(f.desc)}</div>
            </div>
        `).join("");
    }

    function salvarAnamnese() {
        const titulo = document.getElementById("anam-titulo").value;
        const obs = document.getElementById("anam-obs").value;
        if(!titulo) return dispararToast("Preencha o título!", "error");
        const novo = { data: new Date().toLocaleDateString('pt-BR'), titulo, obs };
        db.ref(`clientes/${clienteAnamneseAtual.id}/historico`).push(novo).then(() => {
            document.getElementById("anam-titulo").value = "";
            document.getElementById("anam-obs").value = "";
            dispararToast("Ficha atualizada!");
            abrirModalAnamnese(clienteAnamneseAtual.id); // Reload
        });
    }

    async function salvarFotoGaleria() {
        const input = document.getElementById("input-foto-galeria");
        const desc = document.getElementById("desc-foto-galeria").value;
        const btn = document.querySelector('#tab-galeria .btn-glow');

        if(!input.files[0]) return dispararToast("Selecione uma foto!", "error");

        const textoBtn = btn ? btn.innerText : "";
        if (btn) { btn.disabled = true; btn.innerText = "ENVIANDO..."; }

        try {
            const imgUrl = await uploadImagem(input.files[0], 'galeria_alunos', 900, 0.75);
            const novaFoto = { data: new Date().toLocaleDateString('pt-BR'), desc: desc || "Sem descrição", img: imgUrl };
            await db.ref(`clientes/${clienteAnamneseAtual.id}/galeria`).push(novaFoto);
            input.value = "";
            document.getElementById("desc-foto-galeria").value = "";
            dispararToast("Foto salva!");
            abrirModalAnamnese(clienteAnamneseAtual.id); // Reload
        } catch (erro) {
            console.error("Erro ao salvar foto:", erro);
            dispararToast("Erro ao enviar a foto.", "error");
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = textoBtn || "SALVAR FOTO"; }
        }
    }

