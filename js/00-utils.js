// =====================================================================
// HELPERS COMPARTILHADOS
// Carregado como <script> clássico ANTES de 01-*: as funções ficam no
// escopo global e valem para todas as telas (painel, vitrine, agendar,
// área do aluno). Antes da faxina, cada tela reimplementava escapeHtml /
// formatarData / soDigitos por conta própria.
// =====================================================================

// Escapa texto vindo do banco antes de injetar em innerHTML.
// Vários campos podem ser preenchidos pela página pública de agendamento,
// então precisam ser tratados.
function escapeHtml(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Escapa um valor para uso dentro de atributo entre aspas simples de um onclick.
function escapeAttr(valor) {
    return escapeHtml(valor).replace(/\\/g, "&#92;");
}

// Só os dígitos de um telefone / documento.
function soDigitos(valor) {
    return String(valor === null || valor === undefined ? "" : valor).replace(/\D/g, "");
}

// "2026-08-31" (ou ISO com hora) -> "31/08/2026". Devolve "" se vazio.
function formatarData(dataISO) {
    if (!dataISO) return "";
    const iso = String(dataISO).slice(0, 10);
    const p = iso.split("-");
    if (p.length !== 3) return String(dataISO);
    return `${p[2]}/${p[1]}/${p[0]}`;
}

// Aliases usados por telas antigas (mantidos para não quebrar chamadas).
const formatarDataBR = formatarData;

// =====================================================================
// CAPTURA GLOBAL DE ERRO
// Antes, um erro de JS não tratado deixava a tela quebrada em silêncio e
// ninguém ficava sabendo. Aqui: mostra um aviso discreto ao usuário e
// manda um resumo para /api/log (aparece em `vercel logs`). Nunca lança.
// =====================================================================
(function () {
    var jaAvisou = false;
    var ultimaMsg = '';
    var enviados = 0;

    // Ruído que não é bug do app: erro cross-origin sem detalhe, loop do
    // ResizeObserver, e erros injetados por extensão do navegador.
    function ehRuido(msg, fonte) {
        msg = String(msg || '');
        if (!msg || msg === 'Script error.') return true;
        if (/ResizeObserver loop/i.test(msg)) return true;
        if (/^(chrome|moz|safari|webkit)-extension:\/\//.test(String(fonte || ''))) return true;
        return false;
    }

    function mostrarAviso() {
        if (jaAvisou) return;
        jaAvisou = true;
        try {
            var d = document.createElement('div');
            d.setAttribute('role', 'alert');
            d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 24px);background:#1c1c1f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px 14px;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45);display:flex;gap:12px;align-items:center';
            var span = document.createElement('span');
            span.textContent = 'Algo não carregou como esperado.';
            var btn = document.createElement('button');
            btn.textContent = 'Recarregar';
            btn.style.cssText = 'background:#C0392B;color:#fff;border:0;border-radius:8px;padding:7px 12px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap';
            btn.addEventListener('click', function () { location.reload(); });
            var fechar = document.createElement('button');
            fechar.setAttribute('aria-label', 'Fechar aviso');
            fechar.textContent = '×';
            fechar.style.cssText = 'background:transparent;color:#a2a2a8;border:0;font-size:20px;line-height:1;cursor:pointer;padding:0 2px';
            fechar.addEventListener('click', function () { d.remove(); });
            d.appendChild(span); d.appendChild(btn); d.appendChild(fechar);
            (document.body || document.documentElement).appendChild(d);
            setTimeout(function () { if (d && d.parentNode) d.remove(); }, 12000);
        } catch (e) { /* nunca deixa o handler quebrar */ }
    }

    function reportar(info) {
        try {
            if (enviados >= 8) return;           // no máx. 8 por carregamento
            var msg = String(info.message || '');
            if (msg && msg === ultimaMsg) return; // não repete o mesmo erro
            ultimaMsg = msg;
            enviados++;

            var payload = {
                message: msg.slice(0, 500),
                source: String(info.source || '').slice(0, 300),
                lineno: info.lineno || 0,
                colno: info.colno || 0,
                stack: String(info.stack || '').slice(0, 2000),
                url: String(location.href).slice(0, 300),
                ua: String(navigator.userAgent || '').slice(0, 300),
                ts: Date.now()
            };
            var corpo = JSON.stringify(payload);
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/log', new Blob([corpo], { type: 'application/json' }));
            } else {
                fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: true }).catch(function () {});
            }
        } catch (e) { /* silencioso de propósito */ }
    }

    window.addEventListener('error', function (ev) {
        var fonte = ev && ev.filename;
        var msg = ev && ev.message;
        if (ehRuido(msg, fonte)) return;
        reportar({
            message: msg,
            source: fonte,
            lineno: ev && ev.lineno,
            colno: ev && ev.colno,
            stack: ev && ev.error && ev.error.stack
        });
        mostrarAviso();
    });

    // Promise rejeitada sem .catch(): normalmente é transitório (rede, Firebase).
    // Só registra — não incomoda o usuário com o aviso visual.
    window.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        var msg = (r && (r.message || (r.toString && r.toString()))) || 'Promise rejeitada sem tratamento';
        if (ehRuido(msg)) return;
        reportar({ message: 'unhandledrejection: ' + msg, stack: r && r.stack });
    });
})();

// =====================================================================
// PWA — botão "Instalar App"
// O navegador dispara `beforeinstallprompt` uma única vez, cedo, e só
// quando a instalação é possível (HTTPS + manifest + SW + não instalado
// + engajamento). Guardamos o evento e deixamos as telas plugarem um
// botão que só aparece nesse caso.
// =====================================================================
let _promptInstalarPWA = null;
const _botoesInstalarPWA = [];

function _sincronizarBotoesInstalar() {
    const mostrar = !!_promptInstalarPWA;
    _botoesInstalarPWA.forEach(btn => { if (btn) btn.hidden = !mostrar; });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _promptInstalarPWA = e;
    _sincronizarBotoesInstalar();
});

window.addEventListener('appinstalled', () => {
    _promptInstalarPWA = null;
    _sincronizarBotoesInstalar();
});

// Liga um <button hidden> ao fluxo de instalação. Ele só deixa de ser
// `hidden` quando o navegador oferece a instalação. Seguro de chamar mais
// de uma vez com o mesmo elemento.
function configurarBotaoInstalar(btn) {
    if (!btn || btn.dataset.instalarWired === '1') {
        if (btn) btn.hidden = !_promptInstalarPWA;
        return;
    }
    btn.dataset.instalarWired = '1';
    _botoesInstalarPWA.push(btn);
    btn.hidden = !_promptInstalarPWA;
    btn.addEventListener('click', async () => {
        if (!_promptInstalarPWA) return;
        _promptInstalarPWA.prompt();
        try { await _promptInstalarPWA.userChoice; } catch (e) { /* ignora */ }
        _promptInstalarPWA = null;
        _sincronizarBotoesInstalar();
    });
}
