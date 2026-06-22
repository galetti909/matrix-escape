// Lógica da tela de menu inicial

import { estado } from '../state.js';

export function inicializarMenu(navegarPara) {
  const btnIniciar = document.getElementById('btn-iniciar');

  btnIniciar.addEventListener('click', () => {
    navegarPara('selecao');
  });
}
