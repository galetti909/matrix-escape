// Gera dist/index.html — arquivo único autocontido, sem dependências externas.
// Execução: node scripts/build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Ordem de dependências: módulos que importam vêm depois dos que são importados
const MODULOS = [
  'js/matrizes.js',
  'js/state.js',
  'js/fases.js',
  'js/webgl.js',
  'js/ui.js',
  'js/telas/menu.js',
  'js/telas/creditos.js',
  'js/telas/select.js',
  'js/telas/jogo.js',
  'js/main.js',
];

const ESTILOS = [
  'style/base.css',
  'style/menu.css',
  'style/game.css',
  'style/dialogue.css',
];

// Remove import/export de um módulo ES para torná-lo código plano
function removerModuleSyntax(src) {
  return src
    // Remove blocos import (incluindo multi-linha)
    .replace(/^import\b[\s\S]*?from\s+['"][^'"]*['"]\s*;/gm, '')
    // Remove 'export' de declarações
    .replace(/^export\s+(function|const|let|var|class)\s+/gm, '$1 ')
    .replace(/^export\s+default\s+/gm, '')
    .trim();
}

// --- Bundle JS ---
const jsBundle = MODULOS.map((caminho) => {
  const src = readFileSync(join(ROOT, caminho), 'utf8');
  return `// ── ${caminho} ──\n${removerModuleSyntax(src)}`;
}).join('\n\n');

// --- Bundle CSS ---
const cssBundle = ESTILOS.map((caminho) =>
  readFileSync(join(ROOT, caminho), 'utf8')
).join('\n');

// --- HTML base ---
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Substitui <link rel="stylesheet"> por <style> inline
html = html.replace(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/g, '');
html = html.replace('</head>', `<style>\n${cssBundle}\n</style>\n</head>`);

// Substitui <script type="module"> por <script> inline
html = html.replace(
  /<script\s+type="module"\s+src="[^"]+"><\/script>/,
  `<script>\n${jsBundle}\n</script>`
);

// --- Saída ---
mkdirSync(join(ROOT, 'dist'), { recursive: true });
const destino = join(ROOT, 'dist/index.html');
writeFileSync(destino, html, 'utf8');

const kb = (readFileSync(destino).length / 1024).toFixed(1);
console.log(`Build concluído: dist/index.html (${kb} KB)`);
