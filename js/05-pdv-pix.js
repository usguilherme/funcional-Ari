    // 7. MÓDULO: PDV & PIX (COM PREÇO VARIÁVEL)
    // ==========================================
    function renderServicosPDV() {
        const sel = document.getElementById("pdv-servico");
        if(!sel) return;
        
        let html = '<option value="">Selecione...</option>';
        
        // Grupo de Serviços
        html += '<optgroup label="✨ Serviços">';
        store.servicos.forEach(s => {
            html += `<option value="${escapeAttr(s.id)}" data-tipo="servico" data-preco="${escapeAttr(parseFloat(s.preco) || 0)}">${escapeHtml(s.nome)} - R$ ${(parseFloat(s.preco) || 0).toFixed(2)}</option>`;
        });
        html += '</optgroup>';

        // Grupo de Produtos (Estoque) - NOVO
        html += '<optgroup label="📦 Produtos / Estoque">';
        store.estoque.forEach(p => {
            html += `<option value="${escapeAttr(p.id)}" data-tipo="produto" data-preco="${escapeAttr(parseFloat(p.preco) || 0)}">${escapeHtml(p.nome)} (Estoque: ${escapeHtml(p.qtd)}) - R$ ${(parseFloat(p.preco) || 0).toFixed(2)}</option>`;
        });
        html += '</optgroup>';

        sel.innerHTML = html;
    }

    function renderClientesPDV() {
    const sel = document.getElementById("pdv-cliente");
    if(!sel) return;

    // Criamos uma cópia da lista e ordenamos por nome (A-Z)
    const clientesOrdenados = [...store.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    // Agora usamos a lista ordenada para gerar os <option>
    sel.innerHTML = '<option value="">Cliente Avulso / Sem Cadastro</option>' +
        clientesOrdenados.map(c => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.nome)}</option>`).join("");
}

    // ALTERAÇÃO: Ao clicar em adicionar, abrimos a confirmação de preço
    function adicionarAoCarrinho() {
        const sel = document.getElementById("pdv-servico");
        const option = sel.options[sel.selectedIndex];
        
        if(!sel.value) return dispararToast("Selecione algo!", "error");

        // Captura se é serviço ou produto
        itemPendente = {
            id: sel.value,
            nome: option.text.split(' - R$')[0].split(' (Estoque')[0], // Limpa o nome para o carrinho
            preco: option.getAttribute('data-preco'),
            tipo: option.getAttribute('data-tipo') // 'servico' ou 'produto'
        };

        // Abre o Modal de Confirmação em vez de adicionar direto
        abrirModalPreco(itemPendente);
    }

    // === FUNÇÕES DO MODAL DE PREÇO ===
    function abrirModalPreco(item) {
        document.getElementById("txt-modal-produto").innerText = item.nome;
        document.getElementById("txt-modal-preco-original").innerText = `Valor Padrão: R$ ${parseFloat(item.preco).toFixed(2)}`;
        
        // Reseta o estado do modal
        document.getElementById("etapa-pergunta-preco").style.display = 'block';
        document.getElementById("etapa-novo-preco").style.display = 'none';
        document.getElementById("input-novo-preco").value = "";
        
        document.getElementById("modal-confirmar-preco").style.display = "flex";
    }

    function mostrarInputPreco() {
        document.getElementById("etapa-pergunta-preco").style.display = 'none';
        document.getElementById("etapa-novo-preco").style.display = 'block';
        document.getElementById("input-novo-preco").focus();
    }

    function fecharModalPreco() {
        document.getElementById("modal-confirmar-preco").style.display = "none";
        itemPendente = null;
    }

    function confirmarPreco(isOriginal) {
        if (!itemPendente) return;

        if (isOriginal) {
            // Usa o preço original já salvo em itemPendente
            store.carrinho.push(itemPendente);
            dispararToast("Item adicionado com valor original.");
        } else {
            // Pega o novo valor do input
            const novoValor = parseFloat(document.getElementById("input-novo-preco").value);
            if (isNaN(novoValor) || novoValor < 0) {
                return dispararToast("Digite um valor válido!", "error");
            }
            itemPendente.preco = novoValor; // Atualiza SÓ para esta venda
            store.carrinho.push(itemPendente);
            dispararToast("Item adicionado com novo valor!");
        }

        renderCarrinho();
        fecharModalPreco();
    }
    // ==========================================

    function renderCarrinho() {
        const lista = document.getElementById("lista-carrinho");
        let total = 0;
        
        if(store.carrinho.length === 0) {
            lista.innerHTML = '<li class="empty-state">Carrinho vazio...</li>';
            document.getElementById("pdv-total").innerText = "R$ 0,00";
            if(document.getElementById("pdv-troco-display")) document.getElementById("pdv-troco-display").innerText = "R$ 0,00";
            return;
        }

        lista.innerHTML = store.carrinho.map((item, index) => {
            total += parseFloat(item.preco) || 0;
            return `
            <div class="swipe-item-container" data-index="${index}">
                <div class="swipe-back">
                    <i data-lucide="trash-2" style="margin-right:5px; width:16px;"></i> Apagar
                </div>
                <div class="swipe-front" ontouchstart="handleTouchStart(event)" ontouchmove="handleTouchMove(event)" ontouchend="handleTouchEnd(event)">
                    <span>${item.tipo === 'produto' ? '📦 ' : '✨ '} ${escapeHtml(item.nome)}</span>
                    <div style="display:flex; align-items:center; gap:10px">
                        <strong>R$ ${parseFloat(item.preco).toFixed(2)}</strong>
                        <i data-lucide="trash-2" onclick="removerDoCarrinho(${index})" style="width:14px; cursor:pointer; color:#f43f5e" class="pc-only-trash"></i>
                    </div>
                </div>
            </div>`;
        }).join("");
        
        lucide.createIcons();
        document.getElementById("pdv-total").innerText = `R$ ${total.toFixed(2)}`;

        const pgto = document.getElementById("pdv-pagamento");
        if (pgto && pgto.value === "Pix") {
            gerarPix(total);
        } else if (pgto && pgto.value === "Dinheiro") {
            calcularTroco();
        }
    }

    function removerDoCarrinho(index) {
        store.carrinho.splice(index, 1);
        renderCarrinho();
    }

    function calcularDataRetorno() {
        const diasInput = document.getElementById("pdv-dias-retorno");
        const inputData = document.getElementById("pdv-retorno");
        if(!diasInput || !inputData) return;
        const dias = parseInt(diasInput.value);
        if(!isNaN(dias) && dias > 0) {
            const dataFutura = new Date();
            dataFutura.setDate(dataFutura.getDate() + dias);
            inputData.value = dataFutura.toISOString().split('T')[0];
        } else {
            inputData.value = "";
        }
    }

    function toggleTroco() {
        const tipo = document.getElementById("pdv-pagamento").value;
        const areaTroco = document.getElementById("area-troco");
        const areaPix = document.getElementById("area-pix");
        
        areaTroco.style.display = "none";
        areaPix.style.display = "none";
        
        if(tipo === "Dinheiro") {
            areaTroco.style.display = "block";
        } else if (tipo === "Pix") {
            areaPix.style.display = "block";
            const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);
            if(total > 0) gerarPix(total);
        }
    }

    function calcularTroco() {
        const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);
        const pago = parseFloat(document.getElementById("pdv-valor-pago").value) || 0;
        const troco = pago - total;
        const display = document.getElementById("pdv-troco-display");
        
        if(troco >= 0) {
            display.innerText = `R$ ${troco.toFixed(2)}`;
            display.style.color = "var(--success)";
        } else {
            display.innerText = "Faltam R$ " + Math.abs(troco).toFixed(2);
            display.style.color = "var(--danger)";
        }
    }

    // ==========================================
    // FUNÇÕES AVANÇADAS DE PIX (CRC16 REAL)
    // ==========================================

    // 1. Função auxiliar para formatar os campos do Pix (ID + Tamanho + Valor)
    function formatField(id, value) {
        const valStr = value.toString();
        const len = valStr.length.toString().padStart(2, '0');
        return `${id}${len}${valStr}`;
    }

    // 2. Remove acentos e caracteres especiais (O Banco Central exige isso)
    function removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "");
    }

    // 3. Cálculo Matemático do CRC16 (Obrigatório para o banco aceitar)
    function crc16(buffer) {
        let crc = 0xFFFF;
        for (let i = 0; i < buffer.length; i++) {
            let x = ((crc >> 8) ^ buffer.charCodeAt(i)) & 0xFF;
            x ^= x >> 4;
            crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    // 4. Função Principal Atualizada
    function gerarPix(valor) {
        if(!configSistema.chavePix || !configSistema.nomePix) {
            document.getElementById("pix-copia-cola").value = "Configure a Chave Pix nas Configurações!";
            return;
        }

        // Limpa os dados para evitar erros de acentuação
        const chave = configSistema.chavePix.trim();
        const nome = removeAcentos(configSistema.nomePix.trim()).substring(0, 25); // Limita tamanho
        const cidade = removeAcentos(configSistema.cidadePix || "Cidade").trim().substring(0, 15);
        const valorFormatado = valor.toFixed(2);

        // Monta a estrutura oficial do Pix (EMV QRCPS)
        let payload = 
            formatField("00", "01") +                          // Payload Format Indicator
            formatField("26",                                  // Merchant Account Information
                formatField("00", "BR.GOV.BCB.PIX") +
                formatField("01", chave)
            ) +
            formatField("52", "0000") +                        // Merchant Category Code
            formatField("53", "986") +                         // Transaction Currency (BRL)
            formatField("54", valorFormatado) +                // Transaction Amount
            formatField("58", "BR") +                          // Country Code
            formatField("59", nome) +                          // Merchant Name
            formatField("60", cidade) +                        // Merchant City
            formatField("62",                                  // Additional Data Field
                formatField("05", "***")                       // Reference Label
            );

        // Adiciona o ID do CRC16 no final
        payload += "6304";
        
        // Calcula o código verificador real baseado nos dados acima
        payload += crc16(payload);

        // Gera o QR Code visual
        const qr = new QRious({
            element: document.getElementById('qr-pix'),
            value: payload, 
            size: 200,
            level: 'M' // Nível médio de correção de erro (melhor leitura)
        });
        
        // Coloca o código no input para copiar
        document.getElementById("pix-copia-cola").value = payload;
    }

    function copiarPix() {
        const input = document.getElementById("pix-copia-cola");
        input.select();
        document.execCommand("copy");
        dispararToast("Chave Pix copiada!");
    }

    function finalizarVenda() {
        if(store.carrinho.length === 0) return dispararToast("Carrinho vazio!", "error");

        const idCliente = document.getElementById("pdv-cliente").value;
        const idProfissional = document.getElementById("pdv-profissional") ? document.getElementById("pdv-profissional").value : "";
        const pagamento = document.getElementById("pdv-pagamento").value;
        const retorno = document.getElementById("pdv-retorno").value;
        const obs = document.getElementById("pdv-obs").value;
        
        // Captura a data que está no campo visual
        const dataSelecionada = document.getElementById("pdv-data").value;

        if(!idProfissional) return dispararToast("Selecione quem atendeu!", "error");

        const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);

        let nomeCliente = "Cliente Avulso";
        let pontosGanhos = Math.floor(total); 

        if(idCliente) {
            const c = store.clientes.find(x => x.id == idCliente);
            if(c) nomeCliente = c.nome;
        }

        let nomeProfissional = "";
        const prof = store.profissionais.find(x => x.id == idProfissional);
        if(prof) nomeProfissional = prof.nome;

        const id = idAtendimentoEdicao || novoId();
        const atendimento = {
            id,
            // Usa a data do campo ou hoje se estiver vazio
            data: dataSelecionada || new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString('pt-BR').substr(0,5),
            timestamp: Date.now(),
            clienteId: idCliente || null,
            nomeCliente: nomeCliente,
            profissionalId: idProfissional,
            nomeProfissional: nomeProfissional,
            servicos: store.carrinho,
            total: total,
            pagamento: pagamento,
            status: "Concluido",
            obs: obs,
            previsaoRetorno: retorno || null
        };

        if (idAtendimentoEdicao) {
            // --- MODO EDIÇÃO ---
            // Sai do status "Aguardando Confirmação" quando o operador finaliza no PDV.
            db.ref(`atendimentos/${id}`).update(atendimento);
            dispararToast("Atendimento atualizado com sucesso!");
        } else {
            // --- MODO NOVA VENDA ---
            db.ref(`atendimentos/${id}`).set(atendimento);

            // NOVO: registra o horário como ocupado no node público "disponibilidade"
            // (usado pela página pública de agendamento pra evitar choque de horário)
            if(idProfissional) {
                db.ref(`disponibilidade/${atendimento.data}/${idProfissional}/${atendimento.hora.replace(':','-')}`).set(true)
                    .catch(err => console.error("Erro ao registrar disponibilidade:", err));
            }
            
            // --- NOVO: CONFIRMAÇÃO DE IMPRESSÃO ---
            if(confirm("✅ Venda Finalizada com sucesso!\n\nDeseja imprimir o Cupom?")) {
                imprimirCupom(atendimento);
            } else {
                dispararToast("Venda salva!", "success");
            }
            
            if(idCliente) {
                db.ref(`clientes/${idCliente}/pontos`).transaction((pontosAtuais) => {
                    return (pontosAtuais || 0) + pontosGanhos;
                });
            }

            // Baixa no Estoque (apenas se for venda nova). Conta quantas unidades
            // do MESMO produto estão no carrinho — antes dava baixa de 1 só.
            const baixaPorProduto = {};
            store.carrinho.forEach(item => {
                if (item.tipo === 'produto') {
                    baixaPorProduto[item.id] = (baixaPorProduto[item.id] || 0) + 1;
                }
            });
            Object.keys(baixaPorProduto).forEach(prodId => {
                const qtdVendida = baixaPorProduto[prodId];
                db.ref(`estoque/${prodId}/qtd`).transaction((atual) => {
                    const nova = (parseInt(atual, 10) || 0) - qtdVendida;
                    return nova < 0 ? 0 : nova;
                }).catch(err => console.error("Baixa de estoque:", err));
            });
        }

        if(idCliente) {
            let updates = { ultimaVisita: atendimento.data };
            if(retorno) updates.previsaoRetorno = retorno;
            db.ref(`clientes/${idCliente}`).update(updates);
        }

        // === LIMPEZA E RESET ===
        store.carrinho = [];
        document.getElementById("pdv-obs").value = "";
        document.getElementById("pdv-retorno").value = "";
        document.getElementById("pdv-cliente").value = "";
        if(document.getElementById("pdv-profissional")) document.getElementById("pdv-profissional").value = "";
        if(document.getElementById("pdv-dias-retorno")) document.getElementById("pdv-dias-retorno").value = "";

        // Reseta a data para HOJE para a próxima venda
        const inputData = document.getElementById("pdv-data");
        if(inputData) inputData.value = new Date().toISOString().split('T')[0];

        toggleTroco();
        renderCarrinho();

        // === RESETAR O VISUAL (SAIR DO MODO EDIÇÃO) ===
        idAtendimentoEdicao = null; // Limpa a variável de controle
        
        const btnFinalizar = document.getElementById("btn-finalizar-pdv");
        const badgeStatus = document.getElementById("badge-status-pdv");

        if(btnFinalizar) {
            btnFinalizar.innerText = "FINALIZAR";
            btnFinalizar.style.background = ""; // Volta ao original (gradiente verde)
            btnFinalizar.style.color = "";
        }
        if(badgeStatus) {
            badgeStatus.innerText = "Aberto";
            badgeStatus.style.background = ""; 
            badgeStatus.style.color = "";
        }
    }

    function editarAtendimento(id) {
        const a = store.atendimentos.find(item => item.id == id);
        if (!a) return;
        if (!document.getElementById("pdv-cliente")) return; // PDV não montado nesta build

        // Define o ID global para sabermos que é uma edição
        idAtendimentoEdicao = a.id;

        // 1. Carrega a Data Original do Atendimento
        const inputData = document.getElementById("pdv-data");
        if(inputData) inputData.value = a.data;

        // 2. Carrega os outros dados
        document.getElementById("pdv-cliente").value = a.clienteId || "";
        if(document.getElementById("pdv-profissional")) document.getElementById("pdv-profissional").value = a.profissionalId || "";
        store.carrinho = a.servicos ? [...a.servicos] : [];
        document.getElementById("pdv-pagamento").value = a.pagamento || "Dinheiro";
        document.getElementById("pdv-obs").value = a.obs || "";
        document.getElementById("pdv-retorno").value = a.previsaoRetorno || "";
        
        // 3. Renderiza o carrinho
        renderCarrinho();
        
        // 4. Abre a aba
        abrirAba('novo_atendimento');
        
        // 5. ATUALIZAÇÃO VISUAL (Para saber que está editando)
        const btnFinalizar = document.getElementById("btn-finalizar-pdv");
        const badgeStatus = document.getElementById("badge-status-pdv");

        if(btnFinalizar) {
            btnFinalizar.innerText = "SALVAR ALTERAÇÕES";
            btnFinalizar.style.background = "var(--warning)"; // Fica amarelo/laranja
            btnFinalizar.style.color = "black";
        }
        if(badgeStatus) {
            badgeStatus.innerText = "EDITANDO";
            badgeStatus.style.background = "var(--warning)";
            badgeStatus.style.color = "black";
        }

        // 6. ROLA A TELA PARA O TOPO (Correção do Celular)
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        dispararToast("Modo de edição ativado: " + a.nomeCliente);
    }

