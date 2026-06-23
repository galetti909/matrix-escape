// Lógica da tela de menu inicial

export function inicializarMenu(navegarPara) {
  const btnIniciar = document.getElementById('botao-iniciar');

  btnIniciar.addEventListener('click', () => {
    navegarPara('selecao');
  });
}
