// Render e lógica da tela de jogo principal

import { estado, reiniciarFase, sincronizarSequencias } from '../state.js';
import { obterFase, totalFases } from '../fases.js';
import {
  inicializarWebGL, iniciarLoop, calcularMatrizAcumulada, marcarParaRenderizar,
  triggerSuccessFeedback, triggerErrorFeedback, projetarCentroObjeto,
} from '../webgl.js';
import {
  renderizarConstrutor,
  registrarCalculadora,
  registrarSalvarMatriz,
  registrarSequencia,
  registrarModalTemplate,
  renderizarSequencia,
  renderizarSalvas,
  renderizarTemplates,
  atualizarTitulosObjeto,
  renderizarSeletorObjetos,
  selecionarObjeto,
} from '../ui.js';
import { matrizesSaoIguais } from '../matrizes.js';

let webglInicializado = false;
let navegarParaFn = null;
let aoVoltarSelecaoFn = null;
let ignorarProximoClique = false;

export function inicializarJogo(navegarPara, aoVoltarSelecao) {
  navegarParaFn = navegarPara;
  aoVoltarSelecaoFn = aoVoltarSelecao;

  const canvas = document.getElementById('canvas-jogo');

  if (!inicializarWebGL(canvas)) return;
  iniciarLoop(canvas);
  webglInicializado = true;

  // Botão de voltar à seleção
  document.getElementById('btn-voltar-selecao').addEventListener('click', () => {
    if (aoVoltarSelecaoFn) aoVoltarSelecaoFn();
    navegarPara('selecao');
  });

  // Verificar vitória
  document.getElementById('btn-verificar').addEventListener('click', verificarVitoria);

  // Fechar diálogo
  document.getElementById('btn-fechar-dialogo').addEventListener('click', () => {
    document.getElementById('barra-dialogo').hidden = true;
  });

  // Seleção de objeto por clique no canvas
  canvas.addEventListener('click', (e) => selecionarObjetoPorClique(e, canvas));

  // Pan da câmera via teclado e mouse
  registrarNavegacaoCanvas(canvas);

  registrarCalculadora();
  registrarSalvarMatriz();
  registrarSequencia();
  registrarModalTemplate();
}

export function carregarFase(idxFase) {
  const fase = obterFase(idxFase);
  estado.faseAtual = idxFase;
  estado.dadosFase = fase;
  estado.dimensaoMatriz = fase.dimensao;
  estado.modo3D = fase.modo3D;
  estado.templatesDesbloqueados = fase.templates ? [...fase.templates] : [];
  estado.panX = 0;
  estado.panY = 0;
  estado.orbitTheta = fase.visual?.cameraTheta ?? ORBIT_THETA_INICIAL;
  estado.orbitPhi   = fase.visual?.cameraPhi ?? ORBIT_PHI_INICIAL;

  // Mostra/oculta o overlay de labels dos eixos
  const labelCanvas = document.getElementById('canvas-labels');
  if (labelCanvas) labelCanvas.style.display = fase.modo3D ? 'block' : 'none';

  // Copia os objetos da fase para o estado, preservando imutabilidade da definição
  estado.objetos = fase.objetos.map((obj) => ({ ...obj }));
  estado.objetoAtivo = 0;

  reiniciarFase();
  sincronizarSequencias();

  // Atualiza nome da fase
  document.getElementById('fase-nome').textContent = `Fase ${idxFase + 1} — ${fase.nome}`;

  // Mostra diálogo de introdução
  exibirDialogo(fase.dialogo);

  // Renderiza todos os painéis
  renderizarConstrutor();
  renderizarSequencia();
  renderizarSalvas();
  renderizarTemplates();
  atualizarTitulosObjeto();
  renderizarSeletorObjetos();

  marcarParaRenderizar();
}

// --- Verificação de vitória ---

function verificarVitoria() {
  const fase = estado.dadosFase;
  if (!fase) return;

  const n = estado.dimensaoMatriz;

  // Fases com múltiplos combos válidos (ex: encaixe-cruz)
  if (fase.combosValidos) {
    const correto = fase.combosValidos.some((combo) =>
      estado.objetos.every((_, idx) =>
        matrizesSaoIguais(calcularMatrizAcumulada(idx), combo[idx], n)
      )
    );
    if (correto) aoVencer(); else aoErrar();
    return;
  }

  let todosCorretos = true;

  estado.objetos.forEach((obj, idx) => {
    const matrizAlvo = fase.matrizAlvoObjetos
      ? fase.matrizAlvoObjetos[idx]
      : fase.matrizAlvo;

    const matrizResultante = calcularMatrizAcumulada(idx);

    const correto = matrizesSaoIguais(matrizResultante, matrizAlvo, n);

    if (!correto) todosCorretos = false;
  });

  if (todosCorretos) {
    aoVencer();
  } else {
    aoErrar();
  }
}


function aoVencer() {
  const fase = estado.dadosFase;
  const idxFase = estado.faseAtual;

  // Marca fase como completa
  estado.fasesCompletas.add(idxFase);

  // CG: ativa o pulso emissivo nos materiais sem alterar matrizes ou geometria.
  triggerSuccessFeedback();

  // Animação de vitória
  const canvas = document.getElementById('canvas-jogo');
  canvas.classList.add('canvas-vitoria');
  setTimeout(() => canvas.classList.remove('canvas-vitoria'), 1000);

  // Diálogo de vitória
  exibirDialogo(fase.isFinal
    ? (fase.mensagemVitoria || 'Desafio final concluído. Liberdade conquistada!')
    : 'Correto! Fase concluída. Você desbloqueou novos recursos.');

  // Avança para próxima fase ou créditos após delay
  setTimeout(() => {
    if (fase.isFinal) {
      navegarParaFn('creditos');
    } else {
      const proximo = idxFase + 1;
      if (proximo < totalFases()) {
        estado.faseAtual = proximo;
        carregarFase(proximo);
      } else {
        navegarParaFn('creditos');
      }
    }
  }, 2000);
}

function aoErrar() {
  // CG: o shader recebe um pulso vermelho; o shake CSS continua como reforço visual.
  triggerErrorFeedback();
  const canvas = document.getElementById('canvas-jogo');
  canvas.classList.add('canvas-erro');
  setTimeout(() => canvas.classList.remove('canvas-erro'), 600);
  exibirDialogo('Não é bem isso... Tente ajustar a sequência ou os valores.');
  // Fecha automaticamente após 2s para não bloquear os painéis inferiores
  setTimeout(() => {
    document.getElementById('barra-dialogo').hidden = true;
  }, 2000);
}

// --- Seleção de objeto por clique no canvas ---

function selecionarObjetoPorClique(e, canvas) {
  if (ignorarProximoClique) {
    ignorarProximoClique = false;
    return;
  }
  if (estado.objetos.length <= 1) return;

  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const cy = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  let melhorIdx = estado.objetoAtivo;
  let melhorDist = Infinity;

  estado.objetos.forEach((_, idx) => {
    const centro = projetarCentroObjeto(idx, canvas);
    if (!centro) return;
    const dx = cx - centro[0];
    const dy = cy - centro[1];
    const dist = dx * dx + dy * dy;
    if (dist < melhorDist) {
      melhorDist = dist;
      melhorIdx = idx;
    }
  });

  selecionarObjeto(melhorIdx);
}

// --- Navegação do canvas (pan 2D / órbita 3D) ---

const ORBIT_THETA_INICIAL = Math.PI * 0.25;
const ORBIT_PHI_INICIAL   = Math.PI * 0.15;

function registrarNavegacaoCanvas(canvas) {
  let arrastando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let distanciaArraste = 0;

  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('keydown', (e) => {
    const delta = 0.05;
    if (estado.modo3D) {
      // Setas orbitam a câmera em 3D
      if (e.key === 'ArrowLeft')  { estado.orbitTheta -= delta; e.preventDefault(); }
      if (e.key === 'ArrowRight') { estado.orbitTheta += delta; e.preventDefault(); }
      if (e.key === 'ArrowUp')    { estado.orbitPhi = Math.min(Math.PI/2 - 0.05, estado.orbitPhi + delta); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { estado.orbitPhi = Math.max(-Math.PI/2 + 0.05, estado.orbitPhi - delta); e.preventDefault(); }
    } else {
      // Setas fazem pan em 2D
      if (e.key === 'ArrowLeft')  { estado.panX -= delta; e.preventDefault(); }
      if (e.key === 'ArrowRight') { estado.panX += delta; e.preventDefault(); }
      if (e.key === 'ArrowUp')    { estado.panY += delta; e.preventDefault(); }
      if (e.key === 'ArrowDown')  { estado.panY -= delta; e.preventDefault(); }
    }
    marcarParaRenderizar();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    arrastando = true;
    ignorarProximoClique = false;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    distanciaArraste = 0;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!arrastando) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - ultimoX) / rect.width;
    const dy = (e.clientY - ultimoY) / rect.height;
    distanciaArraste += Math.abs(e.clientX-ultimoX)+Math.abs(e.clientY-ultimoY);
    if (distanciaArraste > 4) ignorarProximoClique = true;

    if (estado.modo3D) {
      estado.orbitTheta += dx * Math.PI * 2;
      estado.orbitPhi = Math.max(-Math.PI/2 + 0.05,
                        Math.min( Math.PI/2 - 0.05, estado.orbitPhi - dy * Math.PI));
    } else {
      estado.panX += dx * 2;
      estado.panY -= dy * 2;
    }

    ultimoX = e.clientX;
    ultimoY = e.clientY;
    marcarParaRenderizar();
  });

  canvas.addEventListener('mouseup', () => { arrastando = false; });
  canvas.addEventListener('mouseleave', () => { arrastando = false; });

  canvas.addEventListener('dblclick', () => {
    if (estado.modo3D) {
      estado.orbitTheta = estado.dadosFase?.visual?.cameraTheta ?? ORBIT_THETA_INICIAL;
      estado.orbitPhi   = estado.dadosFase?.visual?.cameraPhi ?? ORBIT_PHI_INICIAL;
    } else {
      estado.panX = 0;
      estado.panY = 0;
    }
    marcarParaRenderizar();
  });
}

// --- Diálogo ---

function exibirDialogo(texto) {
  if (!texto) return;
  document.getElementById('dialogo-texto').textContent = texto;
  document.getElementById('barra-dialogo').hidden = false;
}
