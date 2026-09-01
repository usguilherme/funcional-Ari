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
