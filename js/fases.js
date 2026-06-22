// Definição completa das fases do jogo
// Cada fase: { nome, dialogo, dimensao, modo3D, objetos[], matrizAlvo, unlocks[] }
// matrizAlvo: Float32Array que o jogador precisa reproduzir com a sequência

import {
  escala2x2, cisalhamento2x2,
  escala2D, translacao2D, rotacao2D, cisalhamento2D,
  escala3D, translacao3D, rotacaoX, rotacaoY, rotacaoZ,
  multiplicar,
} from './matrizes.js';

// Vértices de um quadrado unitário centrado na origem (2 triângulos, 6 verts)
const QUAD = [
  -0.2, -0.2,
   0.2, -0.2,
   0.2,  0.2,
  -0.2, -0.2,
   0.2,  0.2,
  -0.2,  0.2,
];

// Vértices de um cubo unitário (12 triângulos, 36 verts) para modo 3D
function gerarCubo(s = 0.3) {
  const v = [
    // Frente
    -s,-s, s,  s,-s, s,  s, s, s,
    -s,-s, s,  s, s, s, -s, s, s,
    // Trás
    -s,-s,-s, -s, s,-s,  s, s,-s,
    -s,-s,-s,  s, s,-s,  s,-s,-s,
    // Topo
    -s, s,-s, -s, s, s,  s, s, s,
    -s, s,-s,  s, s, s,  s, s,-s,
    // Base
    -s,-s,-s,  s,-s,-s,  s,-s, s,
    -s,-s,-s,  s,-s, s, -s,-s, s,
    // Direita
     s,-s,-s,  s, s,-s,  s, s, s,
     s,-s,-s,  s, s, s,  s,-s, s,
    // Esquerda
    -s,-s,-s, -s,-s, s, -s, s, s,
    -s,-s,-s, -s, s, s, -s, s,-s,
  ];
  return v;
}

// CG: placa 3D fina. A face frontal recebe a textura com o título, enquanto
// a pequena profundidade permite perceber iluminação e reflexo ao orbitar.
function gerarPlaca3D(largura = 1.2, altura = 0.45, profundidade = 0.07,
                       ox = -0.6, oy = -0.5, oz = 0.1) {
  const x0 = ox - largura / 2, x1 = ox + largura / 2;
  const y0 = oy - altura / 2,  y1 = oy + altura / 2;
  const z0 = oz - profundidade / 2, z1 = oz + profundidade / 2;
  return [
    // Frente
    x0,y0,z1,  x1,y0,z1,  x1,y1,z1,
    x0,y0,z1,  x1,y1,z1,  x0,y1,z1,
    // Trás
    x0,y0,z0,  x0,y1,z0,  x1,y1,z0,
    x0,y0,z0,  x1,y1,z0,  x1,y0,z0,
    // Topo
    x0,y1,z0,  x0,y1,z1,  x1,y1,z1,
    x0,y1,z0,  x1,y1,z1,  x1,y1,z0,
    // Base
    x0,y0,z0,  x1,y0,z0,  x1,y0,z1,
    x0,y0,z0,  x1,y0,z1,  x0,y0,z1,
    // Direita
    x1,y0,z0,  x1,y1,z0,  x1,y1,z1,
    x1,y0,z0,  x1,y1,z1,  x1,y0,z1,
    // Esquerda
    x0,y0,z0,  x0,y0,z1,  x0,y1,z1,
    x0,y0,z0,  x0,y1,z1,  x0,y1,z0,
  ];
}

// Cor vermelha padrão
const COR_VERMELHO = [0.9, 0.2, 0.2];

// --- Definição das fases ---

const FASES = [

  // ── MUNDO 1 — Transformações 2D ────────────────────────────────────────────

  // Fase 1 — Escala uniforme (tutorial completo)
  // Nenhum template: o jogador constrói a matriz de escala do zero
  {
    nome: 'Escala uniforme',
    dialogo: 'Você está preso. Eu também. Mas existe uma saída — as matrizes. O quadrado SÓLIDO vermelho é seu objeto. O alvo TRACEJADO mostra onde ele deve ir. COMO JOGAR: clique numa célula da matriz (painel inferior esquerdo), digite o valor, use a calculadora para sin/cos/π. Depois clique "+ Sequência" e "Verificar". AGORA: a escala uniforme usa os elementos da diagonal da matriz 2×2. Quando sx = sy, o objeto cresce proporcionalmente em todos os lados.',
    dimensao: 2,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: escala2x2(2, 2),
    templates: [],
  },

  // Fase 2 — Escala não-uniforme
  // Jogador já construiu escala na fase 1 → template escala disponível
  {
    nome: 'Escala não-uniforme',
    dialogo: 'A matriz [sx 0 / 0 sy] com sx ≠ sy estica cada eixo de forma independente. sx controla o quanto a largura (eixo X) muda; sy controla a altura (eixo Y). O alvo foi esticado horizontalmente e comprimido verticalmente — ou o contrário. Observe bem as proporções antes de preencher.',
    dimensao: 2,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: escala2x2(2.5, 0.8),
    templates: ['escala'],
  },

  // Fase 3 — Cisalhamento
  // Constrói cis do zero; escala disponível como apoio
  {
    nome: 'Cisalhamento',
    dialogo: 'O cisalhamento "inclina" o objeto mantendo a área. Na matriz 2×2, os elementos FORA da diagonal fazem isso: o elemento na posição (linha 0, coluna 1) desloca X em função de Y, e (linha 1, coluna 0) desloca Y em função de X. Em notação matemática: x\' = x + k·y. O resultado é um paralelogramo. Encontre o fator k e a posição correta na matriz.',
    dimensao: 2,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: cisalhamento2x2(0.7, 0),
    templates: ['escala'],
  },

  // Fase 4 — Translação (intro coordenadas homogêneas)
  // Constrói transl do zero; escala e cis disponíveis
  {
    nome: 'Translação',
    dialogo: 'Translação é diferente das transformações anteriores: ela move a ORIGEM. Isso significa que não é uma transformação linear — e não cabe numa matriz 2×2. A solução são as coordenadas homogêneas: adicionamos uma terceira coordenada, sempre igual a 1. Assim, tx e ty aparecem visualmente na terceira coluna da matriz 3×3, nas duas primeiras linhas.',
    dimensao: 3,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: translacao2D(0.4, 0.3),
    templates: ['escala', 'cis'],
  },

  // Fase 5 — Rotação
  // Constrói rot do zero; escala, cis e transl disponíveis
  {
    nome: 'Rotação',
    dialogo: 'Rotação de ângulo θ transforma os vetores unitários dos eixos: o eixo X (1,0) vira (cos θ, sin θ) e o eixo Y (0,1) vira (-sin θ, cos θ). Esses vetores transformados formam as COLUNAS da matriz de rotação. Para θ = π/4, use os botões "cos(" e "π/4" da calculadora para escrever cos(π/4) na célula. A matriz resultante é exibida no painel de Resultado — compare com o que você esperaria matematicamente.',
    dimensao: 3,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: rotacao2D(Math.PI / 4),
    templates: ['escala', 'cis', 'transl'],
  },

  // Fase 6 — Composição livre (2 transformações)
  // Todos os templates 2D disponíveis
  {
    nome: 'Composição — 2 passos',
    dialogo: 'Multiplicação de matrizes NÃO É COMUTATIVA: trocar a ordem muda o resultado. A sequência é aplicada de cima para baixo. Primeiro rotacione o objeto; depois descubra a translação que leva essa orientação até o alvo. Apenas a ordem que coincide com a silhueta é aceita.',
    dimensao: 3,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(translacao2D(0.3, 0.2), rotacao2D(Math.PI / 4), 3),
    templates: ['escala', 'cis', 'transl', 'rot'],
  },

  // Fase 7 — Composição livre (3 transformações) com cisalhamento
  // Todos os templates 2D disponíveis
  {
    nome: 'Composição — 3 passos',
    dialogo: 'Cisalhamento inclina o objeto sem alterar sua área quando aplicado em um único eixo. Nesta composição, a sequência é lida de cima para baixo: cisalhamento, escala não uniforme e, por fim, translação. A matriz final é T × S × C.',
    dimensao: 3,
    modo3D: false,
    objetos: [{ nome: 'Quadrado', vertices: QUAD, cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(
      translacao2D(-0.55, 0.48),
      multiplicar(escala2D(1.5, 0.55), cisalhamento2D(1.3, 0), 3),
      3
    ),
    templates: ['escala', 'cis', 'transl', 'rot'],
  },

  // ── MUNDO 2 — Transformações 3D ────────────────────────────────────────────

  // Fase 8 — Escala e translação 3D
  // Constrói escala3d e transl3d do zero
  {
    nome: 'Escala e translação 3D',
    dialogo: 'Bem-vindo ao espaço 3D. A matriz agora é 4×4 homogênea — a extensão natural da 3×3 do mundo 2D. Os eixos X/Y/Z estão indicados em vermelho/verde/azul no canvas. A diagonal principal da 4×4 contém os fatores de escala (sx, sy, sz) nas posições 0, 5, 10. A quarta coluna (índices 12, 13, 14) contém a translação (tx, ty, tz). Aplique escala uniforme e depois translação para o cubo atingir o alvo.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(translacao3D(1.1, 0.4, -0.5), escala3D(1.5, 1.5, 1.5), 4),
    templates: [],
  },

  // Fase 9 — Rotação em X e Y
  // Constrói rotX e rotY do zero; escala3d e transl3d disponíveis
  {
    nome: 'Rotação em X e Y',
    dialogo: 'Rotação em torno de X preserva X e rotaciona Y/Z; rotação em torno de Y preserva Y e rotaciona X/Z. Nesta fase, aplique primeiro a rotação em X, depois a rotação em Y e finalize com uma translação. Os eixos coloridos ajudam a identificar orientação e posição.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(
      translacao3D(0.7, 0.3, 0),
      multiplicar(rotacaoY(Math.PI / 6), rotacaoX(Math.PI / 4), 4),
      4
    ),
    templates: ['escala3d', 'transl3d'],
  },

  // Fase 10 — Rotação em Z
  // Constrói rotZ do zero; escala3d, transl3d, rotX e rotY disponíveis
  {
    nome: 'Rotação em Z — igual ao 2D',
    dialogo: 'Rotação em torno de Z é a extensão direta da rotação 2D: X e Y giram, enquanto Z permanece. Aplique primeiro a rotação em Z e depois uma translação para levar o cubo orientado até o alvo.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(translacao3D(0.6, 0.5, 0), rotacaoZ(Math.PI / 3), 4),
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY'],
  },

  // Fase 11 — Composição 3D (2 transformações)
  // Todos os templates 3D disponíveis
  {
    nome: 'Composição 3D — 2 passos',
    dialogo: 'Em 3D a não-comutatividade fica ainda mais evidente. Aplique primeiro a rotação em X e depois a translação. Trocar os itens desloca o cubo em uma direção diferente e não coincide com o alvo.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(translacao3D(0.9, 0.3, 0), rotacaoX(Math.PI / 4), 4),
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // Fase 12 — Composição 3D (3 transformações)
  // Todos os templates 3D disponíveis
  {
    nome: 'Composição 3D — 3 passos',
    dialogo: 'Observe tamanho, orientação e posição. A sequência correta aplica primeiro escala não uniforme, depois rotação em Z e por último translação. Use a câmera para confirmar como a textura evidencia cada transformação.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(
      translacao3D(0.8, -0.5, 0.2),
      multiplicar(rotacaoZ(Math.PI / 6), escala3D(1.2, 0.8, 1.0), 4),
      4
    ),
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // Fase 13 — Composição 3D livre e desafiadora
  // Todos os templates 3D disponíveis
  {
    nome: 'Composição 3D — livre',
    dialogo: 'Sem dicas desta vez. Observe o alvo com atenção: tamanho, orientação em cada eixo, posição no espaço. Use tudo que aprendeu. Arraste o canvas com o mouse para orbitar e ver o alvo de ângulos diferentes. Pode levar tentativas — essa é a última fase antes dos múltiplos objetos.',
    dimensao: 4,
    modo3D: true,
    objetos: [{ nome: 'Cubo', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO }],
    matrizAlvo: multiplicar(
      translacao3D(-0.7, 0.5, 0.9),
      multiplicar(
        rotacaoX(Math.PI / 3),
        multiplicar(rotacaoY(-Math.PI / 6), escala3D(0.8, 1.2, 0.8), 4),
        4
      ),
      4
    ),
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // ── MUNDO 3 — Múltiplos objetos 2D ─────────────────────────────────────────

  // Fase 14 — Dois objetos, mesma sequência
  // Todos os templates 2D disponíveis
  {
    nome: 'Dois objetos — mesma transformação',
    dialogo: 'Novo conceito: múltiplos objetos com transformações independentes. Clique num objeto no canvas para selecioná-lo — o selecionado fica com borda amarela e seu nome aparece no título dos painéis. Aqui, AMBOS os objetos precisam da MESMA transformação. Monte a sequência para o Quadrado A, aplique. Depois selecione o B e monte a mesma sequência. A mesma matriz pode ser usada em instâncias diferentes.',
    dimensao: 3,
    modo3D: false,
    objetos: [
      { nome: 'Quadrado A', vertices: QUAD.map((v, i) => i % 2 === 0 ? v - 0.4 : v), cor: COR_VERMELHO },
      { nome: 'Quadrado B', vertices: QUAD.map((v, i) => i % 2 === 0 ? v + 0.4 : v), cor: [0.2, 0.4, 0.9] },
    ],
    matrizAlvo: rotacao2D(Math.PI / 4),
    matrizAlvoObjetos: null,
    templates: ['escala', 'cis', 'transl', 'rot'],
  },

  // Fase 15 — Dois objetos, sequências diferentes
  // Todos os templates 2D disponíveis
  {
    nome: 'Dois objetos — transformações diferentes',
    dialogo: 'Agora cada objeto precisa de uma transformação DIFERENTE. Selecione o Quadrado A (clique nele no canvas), construa sua sequência. Depois selecione o B e construa a sequência dele. Os dois estados são completamente independentes — trocar de objeto não apaga o trabalho feito no outro.',
    dimensao: 3,
    modo3D: false,
    objetos: [
      { nome: 'Quadrado A', vertices: QUAD.map((v, i) => i % 2 === 0 ? v - 0.4 : v), cor: COR_VERMELHO },
      { nome: 'Quadrado B', vertices: QUAD.map((v, i) => i % 2 === 0 ? v + 0.4 : v), cor: [0.2, 0.4, 0.9] },
    ],
    matrizAlvoObjetos: [
      translacao2D(-0.2, 0.3),
      translacao2D(0.35, -0.2),
    ],
    templates: ['escala', 'cis', 'transl', 'rot'],
  },

  // Fase 16 — Encaixe Cruz
  // Todos os templates 2D disponíveis (precisa de transl e rot)
  {
    nome: 'Encaixe — Cruz',
    dialogo: 'O alvo é uma CRUZ — formada por uma barra horizontal e uma vertical. Você tem duas barras idênticas em posições diferentes. Uma vai para o eixo horizontal (só translação), a outra para o vertical (rotação 90° + translação). Qual vai para qual? Qualquer combinação que forme a cruz é válida.',
    dimensao: 3,
    modo3D: false,
    objetos: [
      { nome: 'Barra A', vertices: gerarBarra(-0.5, 0.25), cor: COR_VERMELHO },
      { nome: 'Barra B', vertices: gerarBarra(0.4, -0.25), cor: [0.2, 0.4, 0.9] },
    ],
    alvoVertices: gerarCruz(),
    combosValidos: [
      [
        translacao2D(0.5, -0.25),
        multiplicar(translacao2D(-0.25, -0.4), rotacao2D(Math.PI / 2), 3),
      ],
      [
        multiplicar(translacao2D(0.25, 0.5), rotacao2D(Math.PI / 2), 3),
        translacao2D(-0.4, 0.25),
      ],
    ],
    templates: ['escala', 'cis', 'transl', 'rot'],
  },

  // ── MUNDO 4 — Múltiplos objetos 3D ─────────────────────────────────────────

  // Fase 17 — Dois cubos no espaço
  // Todos os templates 3D disponíveis
  {
    nome: 'Dois cubos no espaço',
    dialogo: 'De volta ao 3D, mas com dois cubos. Cada cubo tem seu próprio espaço de transformação 4×4 independente. Clique em cada cubo no canvas para selecioná-lo (borda amarela = selecionado). Posicione o Cubo A no lado esquerdo e o Cubo B no lado direito, como indicam os alvos tracejados.',
    dimensao: 4,
    modo3D: true,
    objetos: [
      { nome: 'Cubo A', vertices: [], vertices3D: gerarCubo(), cor: COR_VERMELHO },
      { nome: 'Cubo B', vertices: [], vertices3D: gerarCubo(), cor: [0.2, 0.4, 0.9] },
    ],
    matrizAlvoObjetos: [
      translacao3D(-0.65, 0, 0),
      translacao3D(0.65, 0, 0),
    ],
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // Fase 18 — Hierarquia pai-filho
  // Todos os templates 3D disponíveis
  {
    nome: 'Pai e filho',
    dialogo: 'Hierarquia: o objeto Filho está vinculado ao Pai. Sua posição FINAL no mundo é M_pai × M_filho. Quando você move o Pai, o Filho se move junto porque herda a transformação. O puzzle pede que você encontre M_pai e M_filho SEPARADAMENTE — não basta uma transformação total no filho. Pense: o que o Pai precisa fazer? E o que o Filho precisa fazer em relação ao Pai?',
    dimensao: 4,
    modo3D: true,
    ehHierarquia: true,
    objetos: [
      { nome: 'Pai', vertices: [], vertices3D: gerarCubo(0.2), cor: [0.9, 0.6, 0.1] },
      { nome: 'Filho', vertices: [], vertices3D: gerarCubo(0.15), cor: COR_VERMELHO, pai: 0 },
    ],
    matrizAlvoObjetos: [
      rotacaoY(Math.PI / 4),
      translacao3D(0.5, 0, 0),
    ],
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // Fase 19 — Três peças, uma estrutura
  // Todos os templates 3D disponíveis
  {
    nome: 'Três peças',
    dialogo: 'Três cubos, três posições alvo no espaço 3D. Cada peça tem cor diferente (vermelho, verde, azul) para identificação. Selecione cada peça pelo clique no canvas, monte a sequência de transformações necessária. Este é o puzzle mais complexo do jogo — use o mouse para arrastar a câmera e visualizar o alvo de diferentes ângulos.',
    dimensao: 4,
    modo3D: true,
    objetos: [
      { nome: 'Peça A', vertices: [], vertices3D: gerarCubo(0.18), cor: COR_VERMELHO },
      { nome: 'Peça B', vertices: [], vertices3D: gerarCubo(0.18), cor: [0.2, 0.8, 0.4] },
      { nome: 'Peça C', vertices: [], vertices3D: gerarCubo(0.18), cor: [0.2, 0.4, 0.9] },
    ],
    matrizAlvoObjetos: [
      translacao3D(-0.6, 0.3, 0),
      translacao3D(0, -0.3, 0.2),
      translacao3D(0.6, 0.3, -0.2),
    ],
    templates: ['escala3d', 'transl3d', 'rotX', 'rotY', 'rotZ'],
  },

  // Fase 20 — portal final com textura, shader e iluminação
  {
    nome: 'Portal — Computação Gráfica',
    dialogo: 'A saída está diante de você. A placa “COMPUTAÇÃO GRÁFICA” é uma peça 3D: sua textura é posicionada por coordenadas UV, as normais controlam a iluminação e o fragment shader combina luz ambiente, difusa, especular, Fresnel e emissividade. A mecânica final é simples para que você possa observar o resultado: use apenas uma translação 3D para levar a placa sólida até o campo holográfico.',
    dimensao: 4,
    modo3D: true,
    isFinal: true,
    mensagemVitoria: 'COMPUTAÇÃO GRÁFICA atravessou o portal. O navegador foi desbloqueado — você escapou!',
    objetos: [
      { nome: 'Computação Gráfica', vertices: [], vertices3D: gerarPlaca3D(), cor: [0.18, 0.38, 1.0] },
    ],
    matrizAlvo: translacao3D(1.15, 1.0, -0.2),
    templates: ['transl3d'],
    visual: {
      preset: 'final-title',
      textura: 'title',
      animada: true,
      lightOrbit: true,
      targetStyle: 'portal',
      background: [0.008, 0.015, 0.055, 1],
      cameraTheta: 0.12,
      cameraPhi: 0.12,
    },
  },
];

// --- Geometria da fase de encaixe-cruz ---

// Retângulo horizontal 0.6×0.12 centrado em (ox, oy)
function gerarBarra(ox, oy) {
  const w = 0.3, h = 0.06;
  return [
    -w+ox, -h+oy,  w+ox, -h+oy,  w+ox, h+oy,
    -w+ox, -h+oy,  w+ox,  h+oy, -w+ox, h+oy,
  ];
}

// Cruz (barra horizontal + barra vertical) centrada na origem
function gerarCruz() {
  const horiz = gerarBarra(0, 0);
  const h = 0.06, l = 0.3;
  const vert = [
    -h, -l,  h, -l,  h, l,
    -h, -l,  h,  l, -h, l,
  ];
  return [...horiz, ...vert];
}

// --- API pública ---

export function obterFase(idx) {
  return FASES[idx] || FASES[0];
}

export function totalFases() {
  return FASES.length;
}
