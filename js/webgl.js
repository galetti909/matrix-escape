// Contexto WebGL, shaders, buffers e game loop
// Shaders compilados uma única vez na inicialização — nunca dentro do loop

import { estado } from './state.js';
import { multiplicarSequencia, multiplicar, perspectiva, identidade3, identidade4, escala3D, lookAt } from './matrizes.js';

let gl = null;
let programa2D = null;
let programaMaterial2D = null;
let programa3D = null;
let programaMaterial3D = null;
let programaGrid = null;
let programaTracejado = null;
let programaTracejado3D = null;
let bufferVertices = null;
let bufferGrid = null;
let bufferEixos2D = null;
let bufferEixos3D = null;
let texturaObjeto = null;
let texturaAlvo = null;
let cacheGeometria2D = new WeakMap();
let cacheGeometria3D = new WeakMap();
let verticesGridCount = 0;
let eixos3DSegmentos = [];  // [{offset, count, cor}]
let animId = null;

// --- Código GLSL dos shaders ---

// Shader 2D: aplica transformação + pan da câmera
const VERT_2D = `
  attribute vec2 a_posicao;
  uniform mat3 u_transform;
  uniform vec2 u_pan;
  void main() {
    vec3 pos = u_transform * vec3(a_posicao, 1.0);
    gl_Position = vec4(pos.xy + u_pan, 0.0, 1.0);
  }
`;

// CG: vertex shader 2D. A UV nasce na geometria local, portanto a textura acompanha
// escala, rotação e cisalhamento em vez de ficar presa aos pixels da tela.
const VERT_MATERIAL_2D = `
  attribute vec2 a_posicao;
  attribute vec2 a_uv;
  uniform mat3 u_transform;
  uniform vec2 u_pan;
  varying vec2 v_uv;
  void main() {
    vec3 pos = u_transform * vec3(a_posicao, 1.0);
    v_uv = a_uv;
    gl_Position = vec4(pos.xy + u_pan, 0.0, 1.0);
  }
`;

// Shader de grid: sem transformação de objeto, apenas pan
const VERT_GRID = `
  attribute vec2 a_posicao;
  uniform vec2 u_pan;
  void main() {
    gl_Position = vec4(a_posicao + u_pan, 0.0, 1.0);
  }
`;

// Fragment de cor sólida — usado para objetos e alvo
const FRAG_SOLIDO = `
  precision mediump float;
  uniform vec4 u_cor;
  void main() {
    gl_FragColor = u_cor;
  }
`;

// Fragment do grid: linhas pontilhadas cinza claro
const FRAG_GRADE = `
  precision mediump float;
  void main() {
    float d = mod(gl_FragCoord.x + gl_FragCoord.y, 10.0);
    if (d > 3.0) discard;
    gl_FragColor = vec4(0.70, 0.74, 0.82, 0.52);
  }
`;

// Fragment tracejado: borda diagonal alternada para o contorno do alvo
const FRAG_TRACEJADO = `
  precision mediump float;
  uniform vec4 u_cor;
  void main() {
    float d = mod(gl_FragCoord.x - gl_FragCoord.y, 10.0);
    if (d < 5.0) discard;
    gl_FragColor = u_cor;
  }
`;

// CG: fragment shader 2D. Mistura cor e textura procedural e acrescenta
// seleção/feedback como emissão de cor, sem modificar a geometria do puzzle.
const FRAG_MATERIAL_2D = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 u_cor;
  uniform float u_targetMode;
  uniform float u_selectedObject;
  uniform float u_feedbackMode;
  uniform float u_glowAmount;
  uniform float u_time;
  varying vec2 v_uv;
  void main() {
    vec4 texel = texture2D(u_texture, v_uv);
    vec3 material = mix(u_cor.rgb * (0.72 + texel.r * 0.28), texel.rgb, 0.22);
    if (u_targetMode > 0.5) {
      material = mix(u_cor.rgb, texel.rgb, 0.68);
    }
    vec3 selectedGlow = vec3(1.0, 0.78, 0.12) * u_selectedObject * 0.18;
    vec3 feedbackColor = u_feedbackMode > 0.5
      ? vec3(0.15, 1.0, 0.42)
      : vec3(1.0, 0.12, 0.08);
    float pulse = 0.85 + 0.15 * sin(u_time * 12.0);
    material += selectedGlow + feedbackColor * u_glowAmount * pulse * 0.55;
    float alpha = u_targetMode > 0.5 ? u_cor.a * texel.a : u_cor.a;
    gl_FragColor = vec4(material, alpha);
  }
`;

const VERT_3D = `
  attribute vec3 a_posicao;
  uniform mat4 u_transform;
  uniform mat4 u_projecao;
  uniform mat4 u_view;
  void main() {
    gl_Position = u_projecao * u_view * u_transform * vec4(a_posicao, 1.0);
  }
`;

// CG: vertex shader 3D. Envia posição de mundo, normal e UV ao fragment shader.
const VERT_MATERIAL_3D = `
  attribute vec3 a_posicao;
  attribute vec3 a_normal;
  attribute vec2 a_uv;
  uniform mat4 u_transform;
  uniform mat4 u_projecao;
  uniform mat4 u_view;
  uniform mat3 u_normalMatrix;
  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying vec2 v_uv;
  void main() {
    vec4 world = u_transform * vec4(a_posicao, 1.0);
    v_worldPos = world.xyz;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_uv = a_uv;
    gl_Position = u_projecao * u_view * world;
  }
`;

// CG: fragment shader Phong: ambiente + difusa + especular.
// Uniforms controlam textura, seleção, alvo e feedback emissivo.
const FRAG_MATERIAL_3D = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 u_cor;
  uniform vec3 u_lightDir;
  uniform vec3 u_cameraPos;
  uniform float u_ambientStrength;
  uniform float u_diffuseStrength;
  uniform float u_specularStrength;
  uniform float u_shininess;
  uniform float u_time;
  uniform float u_feedbackMode;
  uniform float u_glowAmount;
  uniform float u_selectedObject;
  uniform float u_targetMode;
  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying vec2 v_uv;
  void main() {
    vec4 texel = texture2D(u_texture, v_uv);
    vec3 base = mix(u_cor.rgb * (0.70 + texel.r * 0.30), texel.rgb, 0.18);
    vec3 N = normalize(v_normal);
    vec3 L = normalize(-u_lightDir);
    vec3 V = normalize(u_cameraPos - v_worldPos);
    float diffuse = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);
    float specular = pow(max(dot(V, R), 0.0), u_shininess);
    vec3 lit = base * (u_ambientStrength + u_diffuseStrength * diffuse)
             + vec3(u_specularStrength * specular);

    // CG: rim light destaca o objeto selecionado sem mudar a malha usada na vitória.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2) * u_selectedObject;
    lit += vec3(1.0, 0.72, 0.10) * rim * 0.75;

    vec3 feedbackColor = u_feedbackMode > 0.5
      ? vec3(0.12, 1.0, 0.38)
      : vec3(1.0, 0.08, 0.05);
    float pulse = 0.82 + 0.18 * sin(u_time * 12.0);
    lit += feedbackColor * u_glowAmount * pulse;

    float outputAlpha = u_cor.a * texel.a;
    if (u_targetMode > 0.5) {
      lit = mix(u_cor.rgb, texel.rgb, 0.72) + vec3(0.12, 0.16, 0.22);
    }
    gl_FragColor = vec4(lit, outputAlpha);
  }
`;

// --- Inicialização ---

export function inicializarWebGL(canvas) {
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    alert('Seu navegador não suporta WebGL. O jogo requer WebGL 1.0.');
    return false;
  }

  programa2D = criarPrograma(VERT_2D, FRAG_SOLIDO);
  programaMaterial2D = criarPrograma(VERT_MATERIAL_2D, FRAG_MATERIAL_2D);
  programa3D = criarPrograma(VERT_3D, FRAG_SOLIDO);
  programaMaterial3D = criarPrograma(VERT_MATERIAL_3D, FRAG_MATERIAL_3D);
  programaGrid = criarPrograma(VERT_GRID, FRAG_GRADE);
  programaTracejado = criarPrograma(VERT_2D, FRAG_TRACEJADO);
  programaTracejado3D = criarPrograma(VERT_3D, FRAG_TRACEJADO);

  bufferVertices = gl.createBuffer();
  bufferGrid = gl.createBuffer();
  bufferEixos2D = gl.createBuffer();
  bufferEixos3D = gl.createBuffer();
  cacheGeometria2D = new WeakMap();
  cacheGeometria3D = new WeakMap();

  // CG: texturas procedurais são criadas apenas na inicialização e reutilizadas
  // em todas as fases; não há download nem custo de geração dentro do frame.
  texturaObjeto = createObjectTexture(64);
  texturaAlvo = createStripeTexture(64);

  // Grid 2D: pré-gera e envia os vértices para a GPU uma única vez
  const vertGrid = gerarVerticesGrid(0.2, 2.0);
  verticesGridCount = vertGrid.length / 2;
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferGrid);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertGrid), gl.STATIC_DRAW);

  // CG: eixos principais 2D ficam em buffer próprio e acompanham o pan da câmera.
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferEixos2D);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2,0, 2,0, 0,-2, 0,2]), gl.STATIC_DRAW);

  // Eixos e grid 3D: gerados uma vez
  const { posicoes, segmentos } = gerarEixosGrid3D();
  eixos3DSegmentos = segmentos;
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferEixos3D);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(posicoes), gl.STATIC_DRAW);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (animId) cancelAnimationFrame(animId);
  });

  canvas.addEventListener('webglcontextrestored', () => {
    inicializarWebGL(canvas);
    iniciarLoop(canvas);
  });

  return true;
}

// Gera vértices de linhas de grid no range [-limite, +limite] com passo `passo`
function gerarVerticesGrid(passo, limite) {
  const verts = [];
  for (let x = -limite; x <= limite + 1e-9; x += passo) {
    const xi = Math.round(x / passo) * passo;
    verts.push(xi, -limite, xi, limite);
  }
  for (let y = -limite; y <= limite + 1e-9; y += passo) {
    const yi = Math.round(y / passo) * passo;
    verts.push(-limite, yi, limite, yi);
  }
  return verts;
}

function criarPrograma(vertSrc, fragSrc) {
  const vert = compilarShader(gl.VERTEX_SHADER, vertSrc);
  const frag = compilarShader(gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Erro ao linkar programa:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

// CG: cria uma textura WebGL a partir de um canvas procedural. Tamanho potência
// de dois permite repetição (REPEAT) no WebGL 1.0.
function criarTexturaGL(canvas) {
  const textura = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textura);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return textura;
}

// CG: textura procedural do alvo. As diagonais tornam rotação e cisalhamento
// imediatamente perceptíveis e a transparência mantém o objeto visível por baixo.
function createStripeTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(3, size / 12);
  const passo = size / 3;
  for (let d = -size; d <= size * 2; d += passo) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d - size, size);
    ctx.stroke();
  }
  return criarTexturaGL(canvas);
}

// CG: textura procedural de orientação. A grade evidencia escala/cisalhamento e
// a seta evidencia a direção da superfície após uma rotação.
function createObjectTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dedee8';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(35,45,65,0.42)';
  ctx.lineWidth = 1;
  const passo = size / 4;
  for (let p = 0; p <= size; p += passo) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  return criarTexturaGL(canvas);
}

function compilarShader(tipo, src) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Erro ao compilar shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// --- Game loop ---

export function iniciarLoop(canvas) {
  function frame(agora) {
    const feedbackAtivo = updateFeedbackState(agora);
    if (estado.precisaRenderizar) {
      renderizar(canvas, agora);
      // Durante um pulso, o próximo frame também precisa atualizar os uniforms.
      estado.precisaRenderizar = feedbackAtivo;
    }
    animId = requestAnimationFrame(frame);
  }
  animId = requestAnimationFrame(frame);
}

// CG: inicia feedback por uniform. A duração curta evita um game loop permanente.
export function triggerSuccessFeedback() {
  estado.feedback = { modo: 1, inicio: performance.now(), duracao: 1050 };
  estado.precisaRenderizar = true;
}

export function triggerErrorFeedback() {
  estado.feedback = { modo: -1, inicio: performance.now(), duracao: 650 };
  estado.precisaRenderizar = true;
}

export function updateFeedbackState(agora = performance.now()) {
  const feedback = estado.feedback;
  if (!feedback || feedback.modo === 0) return false;
  if (agora - feedback.inicio >= feedback.duracao) {
    estado.feedback = { modo: 0, inicio: 0, duracao: 0 };
    estado.precisaRenderizar = true;
    return false;
  }
  return true;
}

export function getFeedbackUniforms(agora = performance.now()) {
  const feedback = estado.feedback;
  if (!feedback || feedback.modo === 0) {
    return { modo: 0, glow: 0, tempo: agora / 1000 };
  }
  const progresso = Math.min(1, Math.max(0, (agora - feedback.inicio) / feedback.duracao));
  return {
    modo: feedback.modo,
    glow: Math.sin(progresso * Math.PI),
    tempo: agora / 1000,
  };
}

// --- Renderização ---

function renderizar(canvas, agora = performance.now()) {
  if (!gl) return;
  if (!estado.dadosFase || estado.objetos.length === 0) return;

  gl.viewport(0, 0, canvas.width, canvas.height);

  if (estado.modo3D) {
    gl.clearColor(0.025, 0.035, 0.075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderizar3D(agora);
  } else {
    gl.clearColor(0.965, 0.973, 0.992, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderizarGrid();
    renderizar2D(agora);
  }
}

// Desenha o grid de linhas pontilhadas no fundo do canvas 2D
function renderizarGrid() {
  if (!programaGrid) return;
  gl.useProgram(programaGrid);

  const locPos = gl.getAttribLocation(programaGrid, 'a_posicao');
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferGrid);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(programaGrid, 'u_pan'), estado.panX, estado.panY);

  gl.drawArrays(gl.LINES, 0, verticesGridCount);

  // CG: X e Y usam cores discretas distintas para orientar translações e rotações.
  gl.useProgram(programa2D);
  const eixoPos = gl.getAttribLocation(programa2D, 'a_posicao');
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferEixos2D);
  gl.enableVertexAttribArray(eixoPos);
  gl.vertexAttribPointer(eixoPos, 2, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix3fv(gl.getUniformLocation(programa2D, 'u_transform'), false, identidade3());
  gl.uniform2f(gl.getUniformLocation(programa2D, 'u_pan'), estado.panX, estado.panY);
  gl.uniform4f(gl.getUniformLocation(programa2D, 'u_cor'), 0.86, 0.28, 0.30, 0.48);
  gl.drawArrays(gl.LINES, 0, 2);
  gl.uniform4f(gl.getUniformLocation(programa2D, 'u_cor'), 0.18, 0.55, 0.78, 0.48);
  gl.drawArrays(gl.LINES, 2, 2);
}

function renderizar2D(agora) {
  if (!programaMaterial2D) return;

  const n = estado.dimensaoMatriz;
  const fase = estado.dadosFase;
  const feedback = getFeedbackUniforms(agora);

  // Alvo unificado (fases como encaixe-cruz): uma única área tracejada no centro
  if (fase.alvoVertices) {
    const ident = identidade3();
    desenharMaterial2D(fase.alvoVertices, [0.9, 0.2, 0.2], 0.42, ident, n, true, false, feedback);
    desenharOutlineTracejado2D(fase.alvoVertices, [0.9, 0.2, 0.2], ident, n);
  }

  estado.objetos.forEach((obj, idx) => {
    const matrizTransform = calcularMatrizAcumulada(idx);

    // Alvo por objeto: só desenha se não há alvoVertices unificado
    if (!fase.alvoVertices) {
      const matrizAlvo = fase.matrizAlvoObjetos
        ? fase.matrizAlvoObjetos[idx]
        : fase.matrizAlvo;
      if (matrizAlvo) {
        desenharMaterial2D(obj.vertices, obj.cor, 0.40, matrizAlvo, n, true, false, feedback);
        desenharOutlineTracejado2D(obj.vertices, obj.cor, matrizAlvo, n);
      }
    }

    // Objeto transformado pelo jogador
    const destaque = idx === estado.objetoAtivo;
    desenharMaterial2D(obj.vertices, obj.cor, 1.0, matrizTransform, n, false, destaque, feedback);
    if (destaque) desenharOutlineSelecao2D(obj.vertices, matrizTransform, n);
  });
}

// CG: calcula UVs no espaço local uma única vez. Isso faz a grade desenhada na
// textura deformar junto com a matriz aplicada pelo jogador.
function obterGeometria2D(vertices) {
  let geo = cacheGeometria2D.get(vertices);
  if (geo) return geo;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < vertices.length; i += 2) {
    minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]); maxY = Math.max(maxY, vertices[i + 1]);
  }
  const dx = Math.max(maxX - minX, 1e-6);
  const dy = Math.max(maxY - minY, 1e-6);
  const uvs = [];
  for (let i = 0; i < vertices.length; i += 2) {
    uvs.push((vertices[i] - minX) / dx, (vertices[i + 1] - minY) / dy);
  }
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
  geo = { positionBuffer, uvBuffer, count: vertices.length / 2 };
  cacheGeometria2D.set(vertices, geo);
  return geo;
}

function desenharMaterial2D(vertices, cor, alfa, matrizTransform, n, ehAlvo, destaque, feedback) {
  const prog = programaMaterial2D;
  gl.useProgram(prog);
  const geo = obterGeometria2D(vertices);
  const locPos = gl.getAttribLocation(prog, 'a_posicao');
  const locUV = gl.getAttribLocation(prog, 'a_uv');
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.positionBuffer);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.uvBuffer);
  gl.enableVertexAttribArray(locUV);
  gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'u_transform'), false, expandir2x2Para3x3(matrizTransform, n));
  gl.uniform2f(gl.getUniformLocation(prog, 'u_pan'), estado.panX, estado.panY);
  gl.uniform4f(gl.getUniformLocation(prog, 'u_cor'), cor[0], cor[1], cor[2], alfa);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_targetMode'), ehAlvo ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_selectedObject'), destaque ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_feedbackMode'), feedback.modo);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glowAmount'), ehAlvo ? 0 : feedback.glow);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), feedback.tempo);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ehAlvo ? texturaAlvo : texturaObjeto);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, geo.count);
}

// CG: halo geométrico de seleção é desenhado separadamente e não participa da
// matriz final nem da checagem de vitória.
function desenharOutlineSelecao2D(vertices, matrizTransform, n) {
  gl.useProgram(programa2D);
  const outlineVerts = gerarOutline(vertices);
  const locPos = gl.getAttribLocation(programa2D, 'a_posicao');
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferVertices);
  gl.bufferData(gl.ARRAY_BUFFER, outlineVerts, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix3fv(gl.getUniformLocation(programa2D, 'u_transform'), false, expandir2x2Para3x3(matrizTransform, n));
  gl.uniform2f(gl.getUniformLocation(programa2D, 'u_pan'), estado.panX, estado.panY);
  gl.uniform4f(gl.getUniformLocation(programa2D, 'u_cor'), 1, 0.78, 0.08, 0.95);
  gl.drawArrays(gl.LINE_LOOP, 0, outlineVerts.length / 2);
}

// Desenha o alvo com hachura diagonal (shader tracejado sobre os próprios triângulos do objeto)
// Funciona corretamente tanto para quads simples quanto para formas complexas (letras)
function desenharOutlineTracejado2D(vertices, cor, matrizAlvo, n) {
  if (!programaTracejado) return;
  gl.useProgram(programaTracejado);

  const locPos = gl.getAttribLocation(programaTracejado, 'a_posicao');
  const locTransform = gl.getUniformLocation(programaTracejado, 'u_transform');
  const locCor = gl.getUniformLocation(programaTracejado, 'u_cor');
  const locPan = gl.getUniformLocation(programaTracejado, 'u_pan');

  const matrizShader = expandir2x2Para3x3(matrizAlvo, n);

  const dados = new Float32Array(vertices);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferVertices);
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix3fv(locTransform, false, matrizShader);
  gl.uniform2f(locPan, estado.panX, estado.panY);

  const [r, g, b] = cor;
  gl.uniform4f(locCor, r, g, b, 1.0);
  // Usa GL_TRIANGLES para exibir a forma real do alvo com padrão diagonal
  // Funciona para qualquer geometria (quads, letras, peças irregulares)
  gl.drawArrays(gl.TRIANGLES, 0, dados.length / 2);

  gl.useProgram(programa2D);
}

// Expande uma matriz 2×2 para 3×3 se necessário (para compatibilidade com o shader mat3)
function expandir2x2Para3x3(m, n) {
  if (n === 2) {
    return new Float32Array([
      m[0], m[1], 0,
      m[2], m[3], 0,
      0,    0,    1,
    ]);
  }
  return m;
}

function gerarOutline(vertices) {
  // Extrai os 4 cantos do quad de 2 triângulos (12 valores = 6 pares xy)
  if (vertices.length === 12) {
    return new Float32Array([
      vertices[0], vertices[1],
      vertices[2], vertices[3],
      vertices[4], vertices[5],
      vertices[10], vertices[11],
    ]);
  }
  // Para outras geometrias (letras, peças), usa os primeiros vértices únicos
  const unicos = [];
  const vistos = new Set();
  for (let i = 0; i < vertices.length; i += 2) {
    const k = `${vertices[i].toFixed(4)},${vertices[i + 1].toFixed(4)}`;
    if (!vistos.has(k)) {
      vistos.add(k);
      unicos.push(vertices[i], vertices[i + 1]);
    }
  }
  return new Float32Array(unicos);
}

function renderizar3D(agora) {
  if (!programaMaterial3D) return;
  gl.enable(gl.DEPTH_TEST);

  const canvas = gl.canvas;
  const aspect = canvas.width / canvas.height;
  const proj = perspectiva(Math.PI / 4, aspect, 0.1, 100);
  const camera = obterCamera3D(estado.orbitTheta, estado.orbitPhi);
  const view = camera.view;
  const feedback = getFeedbackUniforms(agora);

  // Eixos e grid de referência 3D — desenhados antes dos objetos
  renderizarEixosGrid3D(proj, view);
  gl.useProgram(programa3D);

  const locProj = gl.getUniformLocation(programa3D, 'u_projecao');
  const locView = gl.getUniformLocation(programa3D, 'u_view');
  gl.uniformMatrix4fv(locProj, false, proj);
  gl.uniformMatrix4fv(locView, false, view);

  const fase = estado.dadosFase;

  estado.objetos.forEach((obj, idx) => {
    const matrizTransform = calcularMatrizAcumulada(idx);
    const matrizAlvo = fase.matrizAlvoObjetos
      ? fase.matrizAlvoObjetos[idx]
      : (fase.matrizAlvo || identidade4());

    // CG: alvo transparente não escreve profundidade, evitando esconder o objeto.
    gl.depthMask(false);
    desenharMaterial3D(obj.vertices3D, obj.cor, 0.42, matrizAlvo, proj, view, camera.eye, true, false, feedback);
    desenharOutline3D(programa3D, obj.vertices3D, [0.75, 0.88, 1.0], 0.55, matrizAlvo, false, true);
    gl.depthMask(true);

    // Objeto do jogador
    const destaque = idx === estado.objetoAtivo;
    desenharMaterial3D(obj.vertices3D, obj.cor, 1.0, matrizTransform, proj, view, camera.eye, false, destaque, feedback);
    if (destaque) {
      desenharOutline3D(programa3D, obj.vertices3D, [1, 0.85, 0], 0.72, matrizTransform, true, false);
    }
  });

  gl.disable(gl.DEPTH_TEST);

  // Labels X/Y/Z projetados sobre o canvas overlay
  desenharLabelsEixos(proj, view);
}

// CG: gera normais planas por triângulo e UVs por projeção dominante. Como as
// peças atuais são malhas trianguladas, isso serve para cubos de qualquer tamanho.
function obterGeometria3D(vertices) {
  let geo = cacheGeometria3D.get(vertices);
  if (geo) return geo;
  const normals = new Float32Array(vertices.length);
  const uvs = new Float32Array((vertices.length / 3) * 2);
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for (let i=0; i<vertices.length; i+=3) {
    minX=Math.min(minX,vertices[i]); maxX=Math.max(maxX,vertices[i]);
    minY=Math.min(minY,vertices[i+1]); maxY=Math.max(maxY,vertices[i+1]);
    minZ=Math.min(minZ,vertices[i+2]); maxZ=Math.max(maxZ,vertices[i+2]);
  }
  const dx=Math.max(maxX-minX,1e-6), dy=Math.max(maxY-minY,1e-6), dz=Math.max(maxZ-minZ,1e-6);
  for (let i=0; i<vertices.length; i+=9) {
    const ax=vertices[i], ay=vertices[i+1], az=vertices[i+2];
    const bx=vertices[i+3], by=vertices[i+4], bz=vertices[i+5];
    const cx=vertices[i+6], cy=vertices[i+7], cz=vertices[i+8];
    const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const len=Math.hypot(nx,ny,nz)||1; nx/=len; ny/=len; nz/=len;
    for (let v=0; v<3; v++) {
      const pi=i+v*3, vi=(pi/3)*2;
      normals[pi]=nx; normals[pi+1]=ny; normals[pi+2]=nz;
      if (Math.abs(nz)>=Math.abs(nx) && Math.abs(nz)>=Math.abs(ny)) {
        uvs[vi]=(vertices[pi]-minX)/dx; uvs[vi+1]=(vertices[pi+1]-minY)/dy;
      } else if (Math.abs(ny)>=Math.abs(nx)) {
        uvs[vi]=(vertices[pi]-minX)/dx; uvs[vi+1]=(vertices[pi+2]-minZ)/dz;
      } else {
        uvs[vi]=(vertices[pi+2]-minZ)/dz; uvs[vi+1]=(vertices[pi+1]-minY)/dy;
      }
    }
  }
  const positionBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  const normalBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,normals,gl.STATIC_DRAW);
  const uvBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);
  geo={positionBuffer,normalBuffer,uvBuffer,count:vertices.length/3};
  cacheGeometria3D.set(vertices,geo);
  return geo;
}

// CG: inversa-transposta da parte 3x3 da model matrix. Corrige as normais quando
// a matriz do jogador contém escala não uniforme ou cisalhamento.
function calcularMatrizNormal(m) {
  const a00=m[0],a01=m[4],a02=m[8],a10=m[1],a11=m[5],a12=m[9],a20=m[2],a21=m[6],a22=m[10];
  const b01=a22*a11-a12*a21, b11=-a22*a10+a12*a20, b21=a21*a10-a11*a20;
  const det=a00*b01+a01*b11+a02*b21;
  if (Math.abs(det)<1e-8) return new Float32Array([1,0,0,0,1,0,0,0,1]);
  const d=1/det;
  // Resultado já organizado em column-major e transposto para transformar normais.
  return new Float32Array([
    b01*d, (-a22*a01+a02*a21)*d, (a12*a01-a02*a11)*d,
    b11*d, (a22*a00-a02*a20)*d, (-a12*a00+a02*a10)*d,
    b21*d, (-a21*a00+a01*a20)*d, (a11*a00-a01*a10)*d,
  ]);
}

function desenharMaterial3D(vertices, cor, alfa, matriz, proj, view, eye, ehAlvo, destaque, feedback) {
  const prog = programaMaterial3D;
  gl.useProgram(prog);
  const geo = obterGeometria3D(vertices);
  const atributos = [
    ['a_posicao', geo.positionBuffer, 3],
    ['a_normal',  geo.normalBuffer,   3],
    ['a_uv',      geo.uvBuffer,       2],
  ];
  for (const [nome, buffer, tamanho] of atributos) {
    const loc = gl.getAttribLocation(prog, nome);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, tamanho, gl.FLOAT, false, 0, 0);
  }
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_transform'),    false, matriz);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_projecao'),     false, proj);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_view'),         false, view);
  gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'u_normalMatrix'), false, calcularMatrizNormal(matriz));
  gl.uniform4f(gl.getUniformLocation(prog, 'u_cor'), cor[0], cor[1], cor[2], alfa);
  gl.uniform3f(gl.getUniformLocation(prog, 'u_lightDir'), -0.45, -0.85, -0.35);
  gl.uniform3f(gl.getUniformLocation(prog, 'u_cameraPos'), eye[0], eye[1], eye[2]);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_ambientStrength'),  ehAlvo ? 0.8  : 0.34);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_diffuseStrength'),  ehAlvo ? 0.2  : 0.72);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_specularStrength'), ehAlvo ? 0.0  : 0.34);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_shininess'),        24.0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_time'),        feedback.tempo);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_feedbackMode'), feedback.modo);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glowAmount'),   ehAlvo ? 0 : feedback.glow * 0.75);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_selectedObject'), destaque ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_targetMode'),    ehAlvo ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ehAlvo ? texturaAlvo : texturaObjeto);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, geo.count);
}

// Outline 3D via técnica de hull invertido:
// Desenha a geometria ligeiramente maior com face-culling invertido
function desenharOutline3D(prog, vertices, cor, alfa, matriz, ehSelecao, ehAlvo) {
  gl.useProgram(prog);
  const locPos = gl.getAttribLocation(prog, 'a_posicao');
  const locTransform = gl.getUniformLocation(prog, 'u_transform');
  const locCor = gl.getUniformLocation(prog, 'u_cor');

  // Escala ligeiramente maior no espaço local do objeto
  const fator = ehSelecao ? 1.12 : 1.08;
  const matrizOutline = multiplicar(matriz, escala3D(fator, fator, fator), 4);

  const dados = new Float32Array(vertices);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferVertices);
  gl.bufferData(gl.ARRAY_BUFFER, dados, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(locTransform, false, matrizOutline);

  const [r, g, b] = cor;
  // Alvo: borda com a cor do objeto (mais clara); seleção: amarelo
  gl.uniform4f(locCor, r, g, b, alfa);

  // Hull invertido: culling de faces frontais para mostrar apenas as traseiras
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT);
  gl.drawArrays(gl.TRIANGLES, 0, dados.length / 3);
  gl.disable(gl.CULL_FACE);
}

// Câmera esférica: theta = ângulo horizontal, phi = ângulo vertical
// O jogador controla theta/phi via drag do mouse para orbitar em torno da origem
function obterCamera3D(theta, phi) {
  const dist = 3.5;
  const eye = [
    dist * Math.sin(theta) * Math.cos(phi),
    dist * Math.sin(phi),
    dist * Math.cos(theta) * Math.cos(phi),
  ];
  return { eye, view: lookAt(eye, [0, 0, 0], [0, 1, 0]) };
}

// Multiplica mat4 (Float32Array column-major) por vec4 → vec4
function multMat4Vec4(m, v) {
  return [
    m[0]*v[0] + m[4]*v[1] + m[8]*v[2]  + m[12]*v[3],
    m[1]*v[0] + m[5]*v[1] + m[9]*v[2]  + m[13]*v[3],
    m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
    m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3],
  ];
}

// Desenha labels X/Y/Z num canvas 2D sobreposto ao WebGL
function desenharLabelsEixos(proj, view) {
  const labelCanvas = document.getElementById('canvas-labels');
  if (!labelCanvas) return;
  const wc = gl.canvas;
  if (labelCanvas.width !== wc.width) labelCanvas.width = wc.width;
  if (labelCanvas.height !== wc.height) labelCanvas.height = wc.height;
  const ctx = labelCanvas.getContext('2d');
  ctx.clearRect(0, 0, wc.width, wc.height);

  const tips = [
    { pos: [1.9, 0, 0, 1], label: 'X', cor: '#e05050' },
    { pos: [0, 1.9, 0, 1], label: 'Y', cor: '#40d86a' },
    { pos: [0, 0, 1.9, 1], label: 'Z', cor: '#4090e8' },
  ];

  const marg = 18;
  ctx.font = 'bold 16px "Courier New", monospace';
  for (const { pos, label, cor } of tips) {
    const clip = multMat4Vec4(proj, multMat4Vec4(view, pos));
    if (clip[3] <= 0.01) continue;
    const rawNx = (clip[0] / clip[3] + 1) * 0.5 * wc.width;
    const rawNy = (1 - (clip[1] / clip[3] + 1) * 0.5) * wc.height;
    // Clamp to canvas so labels remain visible even when axis tip is off-screen
    const nx = Math.max(marg, Math.min(wc.width - marg, rawNx));
    const ny = Math.max(marg + 2, Math.min(wc.height - marg, rawNy));
    ctx.fillStyle = cor;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, nx, ny);
    ctx.fillText(label, nx, ny);
  }
}

// Gera eixos coloridos (X=vermelho, Y=verde, Z=azul) e grid de chão no plano XZ
function gerarEixosGrid3D() {
  const posicoes = [];
  const segmentos = [];

  function adicionarLinha(x0,y0,z0, x1,y1,z1) {
    posicoes.push(x0,y0,z0, x1,y1,z1);
  }

  // Eixo X (vermelho)
  const ofsX = posicoes.length / 3;
  adicionarLinha(-2,0,0, 2,0,0);
  segmentos.push({ offset: ofsX, count: 2, cor: [0.85, 0.2, 0.2, 0.9] });

  // Eixo Y (verde)
  const ofsY = posicoes.length / 3;
  adicionarLinha(0,-2,0, 0,2,0);
  segmentos.push({ offset: ofsY, count: 2, cor: [0.2, 0.78, 0.35, 0.9] });

  // Eixo Z (azul)
  const ofsZ = posicoes.length / 3;
  adicionarLinha(0,0,-2, 0,0,2);
  segmentos.push({ offset: ofsZ, count: 2, cor: [0.2, 0.55, 0.9, 0.9] });

  // Grid de chão no plano XZ (Y=0) — cinza claro
  const ofsGrid = posicoes.length / 3;
  let countGrid = 0;
  const passo = 0.5;
  const lim   = 2.0;
  for (let x = -lim; x <= lim + 1e-9; x += passo) {
    const xi = Math.round(x / passo) * passo;
    adicionarLinha(xi, 0, -lim, xi, 0, lim);
    countGrid += 2;
  }
  for (let z = -lim; z <= lim + 1e-9; z += passo) {
    const zi = Math.round(z / passo) * passo;
    adicionarLinha(-lim, 0, zi, lim, 0, zi);
    countGrid += 2;
  }
  segmentos.push({ offset: ofsGrid, count: countGrid, cor: [0.38, 0.46, 0.60, 0.24] });

  return { posicoes, segmentos };
}

// Desenha eixos e grid de chão 3D
function renderizarEixosGrid3D(proj, view) {
  if (!programa3D || !bufferEixos3D) return;
  gl.useProgram(programa3D);

  const locPos   = gl.getAttribLocation(programa3D, 'a_posicao');
  const locTrans = gl.getUniformLocation(programa3D, 'u_transform');
  const locProj  = gl.getUniformLocation(programa3D, 'u_projecao');
  const locView  = gl.getUniformLocation(programa3D, 'u_view');
  const locCor   = gl.getUniformLocation(programa3D, 'u_cor');

  gl.uniformMatrix4fv(locProj, false, proj);
  gl.uniformMatrix4fv(locView, false, view);
  gl.uniformMatrix4fv(locTrans, false, identidade4());

  gl.bindBuffer(gl.ARRAY_BUFFER, bufferEixos3D);
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);

  for (const seg of eixos3DSegmentos) {
    gl.uniform4f(locCor, ...seg.cor);
    gl.lineWidth(seg.cor[3] > 0.5 ? 2 : 1);
    gl.drawArrays(gl.LINES, seg.offset, seg.count);
  }
  gl.lineWidth(1);
}

// --- Cálculo da matriz acumulada do objeto ---

export function calcularMatrizAcumulada(idxObjeto) {
  const n = estado.dimensaoMatriz;
  const seq = estado.sequencias[idxObjeto] || [];

  const matrizes = seq.map((item) => {
    if (item.tipo === 'salva') return item.valores;
    if (item.tipo === 'template') return item.construir(item.params);
    return null;
  }).filter(Boolean);

  return multiplicarSequencia(matrizes, n);
}

// Projeta o centro local do objeto para NDC, exatamente no mesmo espaço usado
// pelo clique. Em 3D inclui model, hierarquia, view e projection; em 2D inclui pan.
export function projetarCentroObjeto(idxObjeto, canvas = gl?.canvas) {
  const obj = estado.objetos[idxObjeto];
  if (!obj || !canvas) return null;
  let matriz = calcularMatrizAcumulada(idxObjeto);

  if (estado.modo3D) {
    const vertices = obj.vertices3D || [];
    if (vertices.length === 0) return null;
    let x=0,y=0,z=0,n=0;
    for (let i=0;i<vertices.length;i+=3) {
      x+=vertices[i]; y+=vertices[i+1]; z+=vertices[i+2]; n++;
    }
    const centro=[x/n,y/n,z/n,1];
    const camera=obterCamera3D(estado.orbitTheta,estado.orbitPhi);
    const proj=perspectiva(Math.PI/4,canvas.width/canvas.height,0.1,100);
    const clip=multMat4Vec4(proj,multMat4Vec4(camera.view,multMat4Vec4(matriz,centro)));
    if (clip[3] <= 0.0001) return null;
    return [clip[0]/clip[3],clip[1]/clip[3]];
  }

  const vertices=obj.vertices || [];
  if (vertices.length === 0) return null;
  let x=0,y=0,n=0;
  for (let i=0;i<vertices.length;i+=2) { x+=vertices[i]; y+=vertices[i+1]; n++; }
  x/=n; y/=n;
  if (estado.dimensaoMatriz===2) {
    return [matriz[0]*x+matriz[2]*y+estado.panX,
            matriz[1]*x+matriz[3]*y+estado.panY];
  }
  return [matriz[0]*x+matriz[3]*y+matriz[6]+estado.panX,
          matriz[1]*x+matriz[4]*y+matriz[7]+estado.panY];
}

export function marcarParaRenderizar() {
  estado.precisaRenderizar = true;
}

export function obterGL() {
  return gl;
}
