// Ponto de entrada — inicializa a SPA e gerencia o roteamento entre telas
// main.js é o único módulo que conecta select.js e jogo.js, evitando dependência circular

import { estado } from './state.js';
import { inicializarMenu } from './telas/menu.js';
import { inicializarSelecao, renderizarGrade } from './telas/select.js';
import { inicializarJogo, carregarFase } from './telas/jogo.js';
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
  inicializarMenu(navegarPara);

  // Passa carregarFase como callback para select.js não depender de jogo.js
  inicializarSelecao(navegarPara, (idx) => carregarFase(idx));

  // Passa renderizarGrade como callback para jogo.js não depender de select.js
  inicializarJogo(navegarPara, () => renderizarGrade());

  document.getElementById('botao-voltar-inicio').addEventListener('click', () => {
    navegarPara('menu');
  });

  navegarPara('menu');

  // Helper de debug: ?fase=N na URL vai direto para aquela fase
  const params = new URLSearchParams(window.location.search);
  const faseParam = parseInt(params.get('fase'), 10);
  if (!isNaN(faseParam) && faseParam >= 0 && faseParam < totalFases()) {
    for (let i = 0; i < faseParam; i++) estado.fasesCompletas.add(i);
    carregarFase(faseParam);
    navegarPara('jogo');
  }
}

document.addEventListener('DOMContentLoaded', inicializar);
