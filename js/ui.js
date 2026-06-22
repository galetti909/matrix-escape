// Lógica de todos os painéis da tela de jogo
// Construtor de matriz, sequência, salvas e templates

import { estado } from './state.js';
import { avaliarExpressao, multiplicarSequencia, identidade3, identidade4 } from './matrizes.js';
import { marcarParaRenderizar } from './webgl.js';

// --- Construtor de matriz ---

export function renderizarConstrutor() {
  const n = estado.dimensaoMatriz;
  const grid = document.getElementById('grid-matriz');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  // Inicializa valores se vazio (identidade)
  if (estado.valoresConstrutor.length !== n * n) {
    const id = n === 3 ? identidade3() : n === 4 ? identidade4() : new Float32Array([1, 0, 0, 1]);
    estado.valoresConstrutor = Array.from(id).map((v) => String(v));
  }

  // Cria um input por célula, em ordem row-major para exibição
  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      // Converte row-major visual → column-major de armazenamento
      const idx = col * n + lin;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'celula-matriz';
      input.value = estado.valoresConstrutor[idx];
      input.dataset.idx = idx;

      input.addEventListener('focus', () => {
        estado.celulaAtiva = idx;
        input.select();
      });

      input.addEventListener('input', () => {
        estado.valoresConstrutor[idx] = input.value;
        atualizarResultado();
      });

      grid.appendChild(input);
    }
  }
}

// Insere valor da calculadora na célula ativa
export function registrarCalculadora() {
  document.querySelectorAll('.calc-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (estado.celulaAtiva === null) return;
      const val = btn.textContent;
      const input = document.querySelector(`.celula-matriz[data-idx="${estado.celulaAtiva}"]`);
      if (!input) return;
      const pos = input.selectionStart;
      input.value = input.value.slice(0, pos) + val + input.value.slice(input.selectionEnd);
      estado.valoresConstrutor[estado.celulaAtiva] = input.value;
      input.focus();
      atualizarResultado();
    });
  });
}

// Tenta avaliar os valores do construtor como expressões numéricas
export function obterMatrizConstrutor() {
  const n = estado.dimensaoMatriz;
  const vals = estado.valoresConstrutor.map(avaliarExpressao);
  if (vals.some((v) => v === null)) return null;
  return new Float32Array(vals);
}

// --- Salvar matriz ---

export function registrarSalvarMatriz() {
  document.getElementById('btn-salvar-matriz').addEventListener('click', salvarMatrizAtual);
}

function salvarMatrizAtual() {
  const matriz = obterMatrizConstrutor();
  if (!matriz) {
    destacarErro();
    return;
  }
  const rotulos = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rotulo = rotulos[estado.matrizesSalvas.length % rotulos.length];
  estado.matrizesSalvas.push({ rotulo, valores: matriz, dimensao: estado.dimensaoMatriz });
  renderizarSalvas();
}

function destacarErro() {
  document.querySelectorAll('.celula-matriz').forEach((el) => {
    const v = avaliarExpressao(el.value);
    if (v === null) el.classList.add('celula-erro');
    else el.classList.remove('celula-erro');
  });
}

export function renderizarSalvas() {
  const lista = document.getElementById('lista-salvas');
  lista.innerHTML = '';
  estado.matrizesSalvas.forEach((m, idx) => {
    const li = document.createElement('li');
    li.className = 'salva-item';
    li.textContent = m.rotulo;
    li.title = formatarMatriz(m.valores, m.dimensao);
    li.draggable = true;

    // Clique: carrega no construtor
    li.addEventListener('click', () => carregarSalvaNoConstutor(idx));

    lista.appendChild(li);
  });
}

function carregarSalvaNoConstutor(idx) {
  const m = estado.matrizesSalvas[idx];
  estado.valoresConstrutor = Array.from(m.valores).map((v) => String(+v.toFixed(6)));
  estado.dimensaoMatriz = m.dimensao;
  renderizarConstrutor();
}

// --- Sequência ---

export function registrarSequencia() {
  document.getElementById('btn-add-sequencia').addEventListener('click', () => {
    const matriz = obterMatrizConstrutor();
    if (!matriz) {
      destacarErro();
      return;
    }
    const n = estado.dimensaoMatriz;
    const rotulo = `M${estado.sequencias[estado.objetoAtivo].length + 1}`;
    estado.sequencias[estado.objetoAtivo].push({
      tipo: 'salva',
      rotulo,
      valores: matriz,
      n,
      construir: () => matriz,
    });
    renderizarSequencia();
    marcarParaRenderizar();
  });
}

export function renderizarSequencia() {
  const lista = document.getElementById('lista-sequencia');
  lista.innerHTML = '';

  const seq = estado.sequencias[estado.objetoAtivo] || [];

  seq.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'seq-item';

    const nome = document.createElement('span');
    nome.className = 'seq-item-nome';
    nome.textContent = item.rotulo || item.nome || `M${idx + 1}`;
    li.appendChild(nome);

    // Botão de remover
    const btnRem = document.createElement('button');
    btnRem.className = 'seq-btn-remover';
    btnRem.textContent = '✕';
    btnRem.addEventListener('click', () => {
      estado.sequencias[estado.objetoAtivo].splice(idx, 1);
      renderizarSequencia();
      marcarParaRenderizar();
    });

    // Mover para cima
    const btnUp = document.createElement('button');
    btnUp.className = 'seq-btn-mover';
    btnUp.textContent = '↑';
    btnUp.disabled = idx === 0;
    btnUp.addEventListener('click', () => {
      const s = estado.sequencias[estado.objetoAtivo];
      [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]];
      renderizarSequencia();
      marcarParaRenderizar();
    });

    // Mover para baixo
    const btnDown = document.createElement('button');
    btnDown.className = 'seq-btn-mover';
    btnDown.textContent = '↓';
    btnDown.disabled = idx === seq.length - 1;
    btnDown.addEventListener('click', () => {
      const s = estado.sequencias[estado.objetoAtivo];
      [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
      renderizarSequencia();
      marcarParaRenderizar();
    });

    li.appendChild(btnUp);
    li.appendChild(btnDown);
    li.appendChild(btnRem);
    lista.appendChild(li);
  });

  atualizarResultado();
}

function atualizarResultado() {
  const n = estado.dimensaoMatriz;
  const seq = estado.sequencias[estado.objetoAtivo] || [];
  const matrizes = seq.map((item) => item.construir(item.params)).filter(Boolean);
  const resultado = multiplicarSequencia(matrizes, n);

  const grid = document.getElementById('grid-resultado');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      const idx = col * n + lin;
      const span = document.createElement('span');
      span.className = 'resultado-celula';
      span.textContent = (+resultado[idx].toFixed(3)).toString();
      grid.appendChild(span);
    }
  }

  marcarParaRenderizar();
}

// --- Templates ---

const TODOS_TEMPLATES = [
  {
    id: 'escala', nome: 'escala(sx,sy)', params: ['sx', 'sy'], dim: [2, 3],
    construir: (p) => {
      const [sx, sy] = p;
      const n = estado.dimensaoMatriz;
      if (n === 2) return new Float32Array([sx, 0, 0, sy]);
      return new Float32Array([sx,0,0, 0,sy,0, 0,0,1]);
    },
  },
  {
    id: 'cis', nome: 'cis(k)', params: ['k'], dim: [3],
    construir: (p) => {
      const k = p[0];
      return new Float32Array([1,0,0, k,1,0, 0,0,1]);
    },
  },
  {
    id: 'transl', nome: 'transl(x,y)', params: ['x', 'y'], dim: [3],
    construir: (p) => {
      const [tx, ty] = p;
      return new Float32Array([1,0,0, 0,1,0, tx,ty,1]);
    },
  },
  {
    id: 'rot', nome: 'rot(θ)', params: ['θ'], dim: [3],
    construir: (p) => {
      const t = p[0];
      const c = Math.cos(t), s = Math.sin(t);
      return new Float32Array([c,s,0, -s,c,0, 0,0,1]);
    },
  },
  {
    id: 'escala3d', nome: 'escala3d(sx,sy,sz)', params: ['sx', 'sy', 'sz'], dim: [4],
    construir: (p) => {
      const [sx, sy, sz] = p;
      return new Float32Array([sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1]);
    },
  },
  {
    id: 'transl3d', nome: 'transl3d(x,y,z)', params: ['x','y','z'], dim: [4],
    construir: (p) => {
      const [tx,ty,tz] = p;
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1]);
    },
  },
  {
    id: 'rotX', nome: 'rotX(θ)', params: ['θ'], dim: [4],
    construir: (p) => {
      const t=p[0], c=Math.cos(t), s=Math.sin(t);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    },
  },
  {
    id: 'rotY', nome: 'rotY(θ)', params: ['θ'], dim: [4],
    construir: (p) => {
      const t=p[0], c=Math.cos(t), s=Math.sin(t);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    },
  },
  {
    id: 'rotZ', nome: 'rotZ(θ)', params: ['θ'], dim: [4],
    construir: (p) => {
      const t=p[0], c=Math.cos(t), s=Math.sin(t);
      return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    },
  },
];

export function renderizarTemplates() {
  const lista = document.getElementById('lista-templates');
  const painel = document.getElementById('painel-direito');
  const jogo = document.getElementById('jogo-layout');
  lista.innerHTML = '';

  const n = estado.dimensaoMatriz;
  const disponiveis = TODOS_TEMPLATES.filter((t) =>
    estado.templatesDesbloqueados.includes(t.id) &&
    (!t.dim || t.dim.includes(n))
  );

  if (disponiveis.length === 0) {
    if (painel) painel.hidden = true;
    if (jogo) jogo.style.gridTemplateColumns = 'var(--largura-painel-lateral) 1fr';
    return;
  }

  if (painel) painel.hidden = false;
  if (jogo) jogo.style.gridTemplateColumns = 'var(--largura-painel-lateral) 1fr var(--largura-painel-lateral)';

  disponiveis.forEach((tmpl) => {
    const li = document.createElement('li');
    li.className = 'template-item';

    const nome = document.createElement('span');
    nome.className = 'template-nome';
    nome.textContent = tmpl.nome;
    li.appendChild(nome);

    const btnUsar = document.createElement('button');
    btnUsar.className = 'btn-usar-template';
    btnUsar.textContent = 'Usar';
    btnUsar.addEventListener('click', () => abrirModalTemplate(tmpl));
    li.appendChild(btnUsar);

    lista.appendChild(li);
  });
}

// --- Modal de parâmetros de template ---

let _tmplPendente = null;

function abrirModalTemplate(tmpl) {
  _tmplPendente = tmpl;
  const modal = document.getElementById('modal-template');
  document.getElementById('modal-tmpl-titulo').textContent = tmpl.nome;

  const container = document.getElementById('modal-tmpl-params');
  container.innerHTML = '';
  tmpl.params.forEach((nomep) => {
    const label = document.createElement('label');
    label.className = 'modal-param-label';
    label.textContent = nomep;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'celula-matriz modal-param-input';
    input.placeholder = `ex: π/4 ou 1.5`;
    input.dataset.param = nomep;

    input.addEventListener('focus', () => { input.dataset.ativo = '1'; });
    input.addEventListener('blur', () => { delete input.dataset.ativo; });

    container.appendChild(label);
    container.appendChild(input);
  });

  // Foca no primeiro input
  const primeiro = container.querySelector('input');
  if (primeiro) setTimeout(() => primeiro.focus(), 50);

  // Calculadora do modal insere no input ativo
  document.querySelectorAll('.modal-calc-btn').forEach((btn) => {
    btn.onclick = () => {
      const ativo = container.querySelector('input[data-ativo="1"]') || container.querySelector('input');
      if (!ativo) return;
      const pos = ativo.selectionStart ?? ativo.value.length;
      const val = btn.textContent;
      ativo.value = ativo.value.slice(0, pos) + val + ativo.value.slice(ativo.selectionEnd ?? pos);
      ativo.focus();
      ativo.setSelectionRange(pos + val.length, pos + val.length);
    };
  });

  modal.hidden = false;
}

function confirmarModalTemplate() {
  const tmpl = _tmplPendente;
  if (!tmpl) return;

  const inputs = document.querySelectorAll('#modal-tmpl-params .modal-param-input');
  const params = [];
  let erro = false;

  inputs.forEach((input) => {
    const v = avaliarExpressao(input.value);
    if (v === null) {
      input.classList.add('celula-erro');
      erro = true;
    } else {
      input.classList.remove('celula-erro');
      params.push(v);
    }
  });

  if (erro) return;

  const nomesFormatados = params.map((p) => {
    const abs = Math.abs(p);
    if (Math.abs(abs - Math.PI) < 1e-6) return p < 0 ? '-π' : 'π';
    if (Math.abs(abs - Math.PI / 2) < 1e-6) return p < 0 ? '-π/2' : 'π/2';
    if (Math.abs(abs - Math.PI / 4) < 1e-6) return p < 0 ? '-π/4' : 'π/4';
    if (Math.abs(abs - Math.PI / 3) < 1e-6) return p < 0 ? '-π/3' : 'π/3';
    if (Math.abs(abs - Math.PI / 6) < 1e-6) return p < 0 ? '-π/6' : 'π/6';
    return (+p.toFixed(3)).toString();
  });

  estado.sequencias[estado.objetoAtivo].push({
    tipo: 'template',
    rotulo: `${tmpl.id}(${nomesFormatados.join(',')})`,
    nome: tmpl.nome,
    params,
    construir: (p) => tmpl.construir(p),
  });

  document.getElementById('modal-template').hidden = true;
  _tmplPendente = null;
  renderizarSequencia();
  marcarParaRenderizar();
}

export function registrarModalTemplate() {
  document.getElementById('modal-btn-confirmar').addEventListener('click', confirmarModalTemplate);
  document.getElementById('modal-btn-cancelar').addEventListener('click', () => {
    document.getElementById('modal-template').hidden = true;
    _tmplPendente = null;
  });
  // Enter confirma
  document.getElementById('modal-template').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmarModalTemplate();
    if (e.key === 'Escape') {
      document.getElementById('modal-template').hidden = true;
      _tmplPendente = null;
    }
  });
}

// --- Títulos dinâmicos (objeto selecionado) ---

export function atualizarTitulosObjeto() {
  const nome = estado.objetos[estado.objetoAtivo]?.nome || '';
  document.getElementById('titulo-construtor').textContent = nome ? `Construtor — ${nome}` : 'Construtor';
  document.getElementById('titulo-sequencia').textContent = nome ? `Sequência — ${nome}` : 'Sequência';
}

// Seletor explícito evita ambiguidades quando objetos começam sobrepostos.
export function renderizarSeletorObjetos() {
  const seletor = document.getElementById('seletor-objetos');
  seletor.innerHTML = '';
  seletor.hidden = estado.objetos.length <= 1;
  if (seletor.hidden) return;

  estado.objetos.forEach((obj, idx) => {
    const btn = document.createElement('button');
    btn.className = 'objeto-chip' + (idx === estado.objetoAtivo ? ' ativo' : '');
    btn.textContent = obj.nome;
    btn.type = 'button';
    btn.addEventListener('click', () => selecionarObjeto(idx));
    seletor.appendChild(btn);
  });
}

export function selecionarObjeto(idx) {
  if (idx < 0 || idx >= estado.objetos.length || idx === estado.objetoAtivo) return;
  estado.objetoAtivo = idx;
  renderizarSequencia();
  atualizarTitulosObjeto();
  renderizarSeletorObjetos();
  marcarParaRenderizar();
}

// --- Utilitário de formatação ---

function formatarMatriz(m, n) {
  let s = '';
  for (let lin = 0; lin < n; lin++) {
    for (let col = 0; col < n; col++) {
      s += (+m[col * n + lin].toFixed(3)).toString().padStart(8);
    }
    s += '\n';
  }
  return s;
}
