import { obterFase, totalFases } from '../js/fases.js';
import {
  escala2x2, cisalhamento2x2, escala2D, translacao2D, rotacao2D, cisalhamento2D,
  escala3D, translacao3D, rotacaoX, rotacaoY, rotacaoZ,
  multiplicarSequencia, matrizesSaoIguais,
} from '../js/matrizes.js';

const seq = (n, ...matrizes) => multiplicarSequencia(matrizes, n);

const solucoes = [
  [escala2x2(2, 2)],
  [escala2x2(2.5, 0.8)],
  [cisalhamento2x2(0.7, 0)],
  [translacao2D(0.4, 0.3)],
  [rotacao2D(Math.PI / 4)],
  [seq(3, rotacao2D(Math.PI / 4), translacao2D(0.3, 0.2))],
  [seq(3, cisalhamento2D(1.3, 0), escala2D(1.5, 0.55), translacao2D(-0.55, 0.48))],
  [seq(4, escala3D(1.5, 1.5, 1.5), translacao3D(1.1, 0.4, -0.5))],
  [seq(4, rotacaoX(Math.PI / 4), rotacaoY(Math.PI / 6), translacao3D(0.7, 0.3, 0))],
  [seq(4, rotacaoZ(Math.PI / 3), translacao3D(0.6, 0.5, 0))],
  [seq(4, rotacaoX(Math.PI / 4), translacao3D(0.9, 0.3, 0))],
  [seq(4, escala3D(1.2, 0.8, 1), rotacaoZ(Math.PI / 6), translacao3D(0.8, -0.5, 0.2))],
  [seq(4, escala3D(0.8, 1.2, 0.8), rotacaoY(-Math.PI / 6), rotacaoX(Math.PI / 3), translacao3D(-0.7, 0.5, 0.9))],
  [rotacao2D(Math.PI / 4), rotacao2D(Math.PI / 4)],
  [translacao2D(-0.2, 0.3), translacao2D(0.35, -0.2)],
  null, // Fase 16 possui duas combinações válidas verificadas separadamente.
  [translacao3D(-0.65, 0, 0), translacao3D(0.65, 0, 0)],
  [rotacaoY(Math.PI / 4), translacao3D(0.5, 0, 0)],
  [translacao3D(-0.6, 0.3, 0), translacao3D(0, -0.3, 0.2), translacao3D(0.6, 0.3, -0.2)],
  [translacao3D(1.15, 1, -0.2)],
];

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

exigir(totalFases() === 20, `Esperadas 20 fases; encontradas ${totalFases()}.`);
exigir(solucoes.length === totalFases(), 'A tabela de soluções deve cobrir todas as fases.');

for (let idx = 0; idx < totalFases(); idx++) {
  const fase = obterFase(idx);
  const n = fase.dimensao;
  exigir([2, 3, 4].includes(n), `Fase ${idx + 1}: dimensão inválida.`);
  exigir(fase.objetos.length > 0, `Fase ${idx + 1}: nenhum objeto.`);

  if (idx === 15) {
    exigir(fase.combosValidos?.length === 2, 'Fase 16: devem existir duas combinações válidas.');
    const esperadas = [
      [
        translacao2D(0.5, -0.25),
        seq(3, rotacao2D(Math.PI / 2), translacao2D(-0.25, -0.4)),
      ],
      [
        seq(3, rotacao2D(Math.PI / 2), translacao2D(0.25, 0.5)),
        translacao2D(-0.4, 0.25),
      ],
    ];
    esperadas.forEach((combo, c) => combo.forEach((matriz, o) =>
      exigir(matrizesSaoIguais(matriz, fase.combosValidos[c][o], 3),
        `Fase 16: combinação ${c + 1}, objeto ${o + 1} divergiu.`)));
  } else {
    const esperadas = solucoes[idx];
    exigir(esperadas.length === fase.objetos.length, `Fase ${idx + 1}: quantidade de respostas incorreta.`);
    esperadas.forEach((matriz, objIdx) => {
      const alvo = fase.matrizAlvoObjetos ? fase.matrizAlvoObjetos[objIdx] : fase.matrizAlvo;
      exigir(alvo?.length === n * n, `Fase ${idx + 1}: matriz-alvo malformada.`);
      exigir(matrizesSaoIguais(matriz, alvo, n),
        `Fase ${idx + 1}, objeto ${objIdx + 1}: solução não coincide com o alvo.`);
    });
  }

  console.log(`✓ Fase ${String(idx + 1).padStart(2, '0')} — ${fase.nome}`);
}

const hierarquia = obterFase(17);
exigir(hierarquia.ehHierarquia && hierarquia.objetos[1].pai === 0,
  'Fase 18: vínculo pai-filho ausente.');
const final = obterFase(19);
exigir(final.isFinal && final.modo3D && final.visual?.preset === 'final-title',
  'Fase 20 deve ser o final 3D texturizado.');

console.log('\nTodas as 20 fases foram validadas com sucesso.');
