// Lógica da tela de seleção de fases

import { estado } from '../state.js';
import { obterFase } from '../fases.js';

const MUNDOS = [
  { nome: 'Mundo 1 — Transformações 2D', fases: [0, 1, 2, 3, 4, 5, 6] },
  { nome: 'Mundo 2 — Transformações 3D', fases: [7, 8, 9, 10, 11, 12] },
  { nome: 'Mundo 3 — Múltiplos objetos 2D', fases: [13, 14, 15] },
  { nome: 'Mundo 4 — Múltiplos objetos 3D', fases: [16, 17, 18, 19] },
];

// aoSelecionarFase(idx): callback injetado pelo main.js para evitar dependência circular com jogo.js
let _aoSelecionarFase = null;
let _navegarPara = null;

export function inicializarSelecao(navegarPara, aoSelecionarFase) {
  _navegarPara = navegarPara;
  _aoSelecionarFase = aoSelecionarFase;

  const btnVoltar = document.getElementById('btn-voltar-menu');
  btnVoltar.addEventListener('click', () => navegarPara('menu'));
}

// Redesenha a grade ao voltar para a tela, para refletir progresso atualizado
export function renderizarGrade() {
  const grade = document.getElementById('grade-mundos');
  grade.innerHTML = '';

  MUNDOS.forEach((mundo) => {
    const secao = document.createElement('div');
    secao.className = 'mundo-secao';

    const titulo = document.createElement('h3');
    titulo.className = 'mundo-titulo';
    titulo.textContent = mundo.nome;
    secao.appendChild(titulo);

    const grid = document.createElement('div');
    grid.className = 'mundo-fases';

    mundo.fases.forEach((idxFase) => {
      const fase = obterFase(idxFase);
      const desbloqueada = true; // TODO: restaurar progressão após testes
      const completa = estado.fasesCompletas.has(idxFase);

      const card = document.createElement('button');
      card.className = 'fase-card' + (desbloqueada ? '' : ' bloqueada') + (completa ? ' completa' : '');

      const icone = document.createElement('span');
      icone.className = 'fase-icone';
      icone.textContent = completa ? '✓' : desbloqueada ? '▶' : '🔒';

      const numero = document.createElement('span');
      numero.className = 'fase-numero';
      numero.textContent = `Fase ${idxFase + 1}`;

      const nome = document.createElement('span');
      nome.className = 'fase-nome-card';
      nome.textContent = fase.nome;

      card.appendChild(icone);
      card.appendChild(numero);
      card.appendChild(nome);

      if (desbloqueada) {
        card.addEventListener('click', () => {
          estado.faseAtual = idxFase;
          _aoSelecionarFase(idxFase);
          _navegarPara('jogo');
        });
      }

      grid.appendChild(card);
    });

    secao.appendChild(grid);
    grade.appendChild(secao);
  });
}
