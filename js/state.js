// Estado centralizado do jogo — nenhum módulo mantém estado próprio silencioso

export const estado = {
  // Fase atual (0-indexed)
  faseAtual: 0,

  // Índice do objeto selecionado no canvas (múltiplos objetos nos mundos 3 e 4)
  objetoAtivo: 0,

  // Templates desbloqueados: { id, nome, params, construir(params) }
  templatesDesbloqueados: [],

  // Matrizes salvas pelo jogador na fase atual: { rotulo, valores }
  matrizesSalvas: [],

  // Sequência de transformações do objeto ativo: { tipo, fonte, valores, params }
  // tipo: 'salva' | 'template'
  sequencias: [[]],

  // Flag para o game loop saber que precisa redesenhar
  precisaRenderizar: true,

  // Célula do grid de matriz atualmente selecionada
  celulaAtiva: null,

  // Valores atuais no construtor de matriz (como strings, pois o usuário digita expressões)
  valoresConstrutor: [],

  // Dimensão da matriz na fase atual (2, 3 ou 4)
  dimensaoMatriz: 3,

  // Indica se a fase está em modo 3D
  modo3D: false,

  // Objetos da fase atual — cada um tem: { nome, vertices, cor, sequencia, matrizFinal }
  // Populado por fases.js ao carregar uma fase
  objetos: [],

  // Fase sendo exibida (dados de fases.js)
  dadosFase: null,

  // Fases completadas (Set de índices)
  fasesCompletas: new Set(),

  // Pan da câmera 2D (offset em NDC aplicado após transformação)
  panX: 0,
  panY: 0,

  // Órbita da câmera 3D (ângulos esféricos)
  orbitTheta: Math.PI * 0.25,
  orbitPhi: Math.PI * 0.15,

  // CG: estado curto de feedback compartilhado pelos shaders 2D e 3D.
  // O tempo fica centralizado para que a animação visual não altere a lógica das fases.
  feedback: {
    modo: 0, // 0 = neutro, 1 = acerto, -1 = erro
    inicio: 0,
    duracao: 0,
  },
};

// Reinicia o estado da sessão de jogo sem apagar progresso persistente
export function reiniciarFase() {
  estado.objetoAtivo = 0;
  estado.matrizesSalvas = [];
  estado.sequencias = estado.objetos.map(() => []);
  estado.celulaAtiva = null;
  estado.valoresConstrutor = [];
  estado.feedback = { modo: 0, inicio: 0, duracao: 0 };
  estado.precisaRenderizar = true;
}

// Garante que sequencias tenha uma entrada para cada objeto
export function sincronizarSequencias() {
  while (estado.sequencias.length < estado.objetos.length) {
    estado.sequencias.push([]);
  }
}
