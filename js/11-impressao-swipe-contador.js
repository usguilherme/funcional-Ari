    // ==========================================
    // 14. IMPRESSÃO TÉRMICA (CUPOM 80MM)
    // ==========================================
    function imprimirCupom(atendimento) {
        // Abre uma janela invisível formatada para impressoras Bluetooth (80mm)
        const printWindow = window.open('', '_blank', 'width=300,height=600');
        const htmlCupom = `
        <html>
        <head>
            <title>Recibo</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 80mm; margin: 0 auto; padding: 10px; color: #000; background: #fff;}
                h2 { text-align: center; margin: 0 0 5px 0; font-size: 18px; }
                p { margin: 3px 0; }
                .divisor { border-top: 1px dashed #000; margin: 8px 0; }
                .item { display: flex; justify-content: space-between; margin-bottom: 3px;}
                .total { font-weight: bold; font-size: 16px; text-align: right; margin-top: 5px; }
                .center { text-align: center; }
            </style>
        </head>
        <body>
            <h2>FUNCIONAL DO ARI</h2>
            <p class="center">Treinamento Funcional</p>
            <div class="divisor"></div>
            <p>Data: ${formatarData(atendimento.data)} - ${escapeHtml(atendimento.hora)}</p>
            <p>Cliente: ${escapeHtml(atendimento.nomeCliente)}</p>
            <p>Instrutor: ${escapeHtml(atendimento.nomeProfissional || 'Geral')}</p>
            <div class="divisor"></div>
            <p><b>PLANOS / PRODUTOS:</b></p>
            ${(atendimento.servicos || []).map(s => `<div class="item"><span>${escapeHtml(s.nome)}</span><span>R$ ${(parseFloat(s.preco) || 0).toFixed(2)}</span></div>`).join('')}
            <div class="divisor"></div>
            <div class="total">TOTAL: R$ ${(Number(atendimento.total) || 0).toFixed(2)}</div>
            <p style="text-align:right;">Pagamento: ${escapeHtml(atendimento.pagamento)}</p>
            <div class="divisor"></div>
            <p class="center" style="font-size:11px; margin-top:15px;">Obrigado pela preferência!</p>
            <p class="center" style="font-size:11px;">Desenvolvido por Guilherme Macario</p>
            <script>
                window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }
            </script>
        </body>
        </html>`;
        
        printWindow.document.write(htmlCupom);
        printWindow.document.close();
    }

    // ==========================================
    // 15. GESTO NATIVO: SWIPE TO DELETE (CARRINHO)
    // ==========================================
    let startX = 0;
    let currentX = 0;

    function handleTouchStart(e) {
        startX = e.touches[0].clientX;
        e.currentTarget.style.transition = 'none'; // Tira animação enquanto o dedo segura
    }

    function handleTouchMove(e) {
        if (!startX) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        
        // Só permite arrastar para a ESQUERDA (valores negativos) limitados a 100px
        if (diff < 0 && diff > -120) {
            e.currentTarget.style.transform = `translateX(${diff}px)`;
        }
    }

    function handleTouchEnd(e) {
        if (!startX) return;
        const diff = currentX - startX;
        const frontCard = e.currentTarget;
        const container = frontCard.closest('.swipe-item-container');
        const index = container.getAttribute('data-index');

        frontCard.style.transition = 'transform 0.2s ease-out'; // Volta animação suave
        
        if (diff < -60) {
            // Se arrastou mais de 60px pra esquerda, joga pra fora e apaga!
            frontCard.style.transform = `translateX(-100%)`;
            setTimeout(() => removerDoCarrinho(index), 200);
        } else {
            // Se arrastou pouco, volta pro lugar (cancelou a exclusão)
            frontCard.style.transform = `translateX(0)`;
        }
        startX = 0; currentX = 0;
    }

    // ==========================================
    // 16. EFEITO TICKER (CONTADOR ANIMADO DE VALORES)
    // ==========================================
    function animarContador(elementoId, valorFinal, ehMoeda = true) {
        const el = document.getElementById(elementoId);
        if (!el) return;

        // Se houver um skeleton ativo, limpa primeiro
        if (el.querySelector('.skeleton')) {
            el.innerHTML = '';
        }

        const valorInicial = parseFloat(el.innerText.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
        const duracao = 800; // Duração em milissegundos
        const passos = 30;
        const incremento = (valorFinal - valorInicial) / passos;
        let atual = valorInicial;
        let passoAtual = 0;

        const timer = setInterval(() => {
            passoAtual++;
            atual += incremento;
            if (passoAtual >= passos) {
                atual = valorFinal;
                clearInterval(timer);
            }
            
            if (ehMoeda) {
                el.innerText = `R$ ${atual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else {
                el.innerText = Math.round(atual);
            }
        }, duracao / passos);
    }


