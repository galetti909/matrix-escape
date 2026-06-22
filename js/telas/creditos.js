// Lógica da tela de créditos

export function inicializarCreditos(navegarPara) {
  document.getElementById('botao-voltar-inicio').addEventListener('click', () => {
    navegarPara('menu');
  });
}
