// Rate limiter simples, em memória, por instância serverless "quente".
// Não é à prova de balas (uma instância nova zera o contador, e a Vercel
// pode rodar várias em paralelo), mas corta abuso trivial de script/bot
// sem precisar de Redis/KV. Serve como primeira barreira nas rotas
// públicas (gerar Pix, consulta de aluno).

const baldes = new Map();

export function ipDaRequisicao(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

// Devolve true quando a chave já estourou o limite na janela atual.
export function limiteExcedido(chave, max = 8, janelaMs = 60000) {
  const agora = Date.now();
  const reg = baldes.get(chave);

  if (!reg || agora > reg.reset) {
    baldes.set(chave, { count: 1, reset: agora + janelaMs });
    // Limpeza preguiçosa para o Map não crescer sem limite.
    if (baldes.size > 5000) {
      for (const [k, v] of baldes) { if (agora > v.reset) baldes.delete(k); }
    }
    return false;
  }

  reg.count += 1;
  return reg.count > max;
}
