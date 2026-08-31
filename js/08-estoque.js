    // ==========================================
    // 10. ESTOQUE (NOVO)
    // ==========================================
    function salvarProdutoEstoque() {
        const nome = document.getElementById("prod-nome").value;
        const qtd = parseInt(document.getElementById("prod-qtd").value);
        const preco = parseFloat(document.getElementById("prod-preco").value);
        let qtdMinima = parseInt(document.getElementById("prod-qtd-minima").value);
        if(isNaN(qtdMinima)) qtdMinima = 0;

        if(!nome || isNaN(qtd) || isNaN(preco)) return dispararToast("Preencha todos os campos!", "error");

        if (idProdutoEdicao) {
            db.ref(`estoque/${idProdutoEdicao}`).update({ nome, qtd, preco, qtdMinima })
                .then(() => dispararToast("Produto atualizado!"));
            cancelarEdicaoProduto();
        } else {
            const id = novoId();
            db.ref(`estoque/${id}`).set({ id, nome, qtd, preco, qtdMinima })
                .then(() => dispararToast("Produto cadastrado!"));
            document.getElementById("prod-nome").value = "";
            document.getElementById("prod-qtd").value = "";
            document.getElementById("prod-preco").value = "";
            document.getElementById("prod-qtd-minima").value = "";
        }
    }

    function renderEstoque() {
        const tbody = document.getElementById("tabela-estoque");
        if(!tbody) return;

        if(store.estoque.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; opacity:0.5'>Estoque vazio.</td></tr>";
        } else {
            tbody.innerHTML = store.estoque.map(p => {
                const estoqueBaixo = p.qtdMinima > 0 && p.qtd <= p.qtdMinima;
                return `
                <tr>
                    <td>${escapeHtml(p.nome)} ${estoqueBaixo ? '<span title="Estoque baixo!">⚠️</span>' : ''}</td>
                    <td style="${estoqueBaixo ? 'color:#f87171; font-weight:700' : ''}">${escapeHtml(p.qtd)} un</td>
                    <td>R$ ${(parseFloat(p.preco) || 0).toFixed(2)}</td>
                    <td>
                        <button class="btn-small bg-yellow" onclick="editarProdutoEstoque('${escapeAttr(p.id)}')"><i data-lucide="pencil" style="width:14px"></i></button>
                        <button class="btn-small bg-purple" onclick="if(confirm('Excluir produto?')) db.ref('estoque/${escapeAttr(p.id)}').remove()"><i data-lucide="trash-2" style="width:14px"></i></button>
                    </td>
                </tr>
            `}).join("");
        }
        lucide.createIcons();
        renderAlertaEstoqueBaixo();
    }

    function renderAlertaEstoqueBaixo() {
        const card = document.getElementById("card-estoque-baixo");
        const div = document.getElementById("lista-estoque-baixo");
        if(!card || !div) return;

        const produtosBaixos = store.estoque.filter(p => p.qtdMinima > 0 && p.qtd <= p.qtdMinima);

        if(produtosBaixos.length === 0) {
            card.style.display = "none";
            return;
        }

        card.style.display = "block";
        div.innerHTML = produtosBaixos.map(p => `
            <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
                <div><strong>${escapeHtml(p.nome)}</strong></div>
                <span style="color:#f87171; font-weight:700">${escapeHtml(p.qtd)} un (mín: ${escapeHtml(p.qtdMinima)})</span>
            </div>
        `).join("");
    }

    function editarProdutoEstoque(id) {
        const p = store.estoque.find(x => x.id == id);
        if(!p) return;

        idProdutoEdicao = p.id;
        document.getElementById("prod-nome").value = p.nome;
        document.getElementById("prod-qtd").value = p.qtd;
        document.getElementById("prod-preco").value = p.preco;
        document.getElementById("prod-qtd-minima").value = p.qtdMinima || "";

        document.getElementById("btn-salvar-produto").innerText = "ATUALIZAR";
        document.getElementById("btn-cancelar-produto").style.display = "inline-block";
    }

    function cancelarEdicaoProduto() {
        idProdutoEdicao = null;
        document.getElementById("prod-nome").value = "";
        document.getElementById("prod-qtd").value = "";
        document.getElementById("prod-preco").value = "";
        document.getElementById("prod-qtd-minima").value = "";
        document.getElementById("btn-salvar-produto").innerText = "Salvar";
        document.getElementById("btn-cancelar-produto").style.display = "none";
    }


    // ==========================================
