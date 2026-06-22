// Ponto de entrada — inicializa a SPA e gerencia o roteamento entre telas
// main.js é o único módulo que conecta select.js e jogo.js, evitando dependência circular

import { estado } from './state.js';
import { inicializarMenu } from './telas/menu.js';
import { inicializarSelecao, renderizarGrade } from './telas/select.js';
import { inicializarJogo, carregarFase } from './telas/jogo.js';
import { inicializarCreditos } from './telas/creditos.js';
import { totalFases } from './fases.js';

const telas = {
  menu: document.getElementById('tela-menu'),
  selecao: document.getElementById('tela-selecao'),
  jogo: document.getElementById('tela-jogo'),
  creditos: document.getElementById('tela-creditos'),
};

// Troca a tela visível sem recarregar a página
// renderizarGrade é chamado aqui para que a grade seja atualizada ao navegar,
// independente do ponto de origem (menu ou volta do jogo)
export function navegarPara(nomeTela) {
  for (const [nome, el] of Object.entries(telas)) {
    el.hidden = nome !== nomeTela;
  }
  if (nomeTela === 'selecao') renderizarGrade();
  estado.precisaRenderizar = true;
}

function inicializar() {
  // Inicializa todas as telas e registra callbacks de navegação, eliminando dependências circulares
  inicializarMenu(navegarPara);
  inicializarSelecao(navegarPara, carregarFase);
  inicializarJogo(navegarPara, renderizarGrade);
  inicializarCreditos(navegarPara);

  navegarPara('menu');
}

document.addEventListener('DOMContentLoaded', inicializar);
