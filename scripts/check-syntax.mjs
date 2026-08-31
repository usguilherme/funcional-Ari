#!/usr/bin/env node
// Verificação leve de sintaxe. Não há build nem framework neste projeto:
// os arquivos de js/ são scripts de navegador (globais compartilhados) e os de
// api/ são funções serverless. Aqui só garantimos que todo arquivo .js/.mjs faz
// parse sem erro de sintaxe (node --check), o que já pega a maioria das quebras.

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const raiz = new URL('..', import.meta.url).pathname;
const pastas = ['js', 'api', 'scripts'];
const arquivosSoltos = ['sw.js'];

function listarJs(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) continue;
    if (['.js', '.mjs'].includes(extname(nome))) out.push(caminho);
  }
  return out;
}

const alvos = [];
for (const p of pastas) {
  try { alvos.push(...listarJs(join(raiz, p))); } catch { /* pasta ausente */ }
}
for (const f of arquivosSoltos) alvos.push(join(raiz, f));

let falhas = 0;
for (const arquivo of alvos) {
  try {
    // Scripts de navegador não são módulos: --check no modo script (padrão).
    execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' });
    console.log(`ok   ${arquivo.replace(raiz, '')}`);
  } catch (e) {
    falhas++;
    console.error(`FALHA ${arquivo.replace(raiz, '')}`);
    console.error((e.stderr || e.stdout || e).toString());
  }
}

// Os arquivos de js/ são carregados como <script> clássicos que dividem UM
// escopo global. Concatenamos na ordem do index.html e verificamos o parse —
// isso pega colisão de `const`/`let` no topo entre módulos, que o check
// arquivo-a-arquivo não vê.
try {
  const jsDir = join(raiz, 'js');
  const modulos = readdirSync(jsDir)
    .filter(n => /^\d\d-.*\.js$/.test(n))
    .sort();
  let bundle = '';
  for (const m of modulos) bundle += `\n// ===== ${m} =====\n` + readFileSync(join(jsDir, m), 'utf8');
  new vm.Script(bundle, { filename: 'bundle-navegador.js' });
  console.log(`ok   [bundle de ${modulos.length} módulos js/ no mesmo escopo global]`);
} catch (e) {
  falhas++;
  console.error('FALHA [bundle js/ concatenado]');
  console.error(String(e && e.message || e));
}

if (falhas) {
  console.error(`\n${falhas} verificação(ões) com erro.`);
  process.exit(1);
}
console.log(`\n${alvos.length} arquivos OK + bundle de navegador OK.`);
