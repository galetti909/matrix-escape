# Gabarito explicado — Matrix Escape

Este arquivo acompanha a versão validada das 20 fases. As matrizes abaixo são exibidas por linhas, como aparecem no construtor, embora internamente o WebGL as armazene em column-major.

## Como ler uma sequência

Os itens são aplicados de cima para baixo. Para:

```text
Rotação → Escala → Translação
```

a matriz final é:

```text
Mfinal = T × S × R
p' = Mfinal × p
```

A matriz mais à direita age primeiro sobre o ponto.

---

## Fase 1 — Escala uniforme

**Conceito:** uma escala 2D multiplica X e Y pelos elementos da diagonal.

**No construtor:** altere os dois valores da diagonal de `1` para `2`, adicione à sequência e verifique.

```text
2  0
0  2
```

Todo ponto `(x,y)` vira `(2x,2y)`, dobrando largura e altura sem deformar o quadrado.

## Fase 2 — Escala não uniforme

**Conceito:** X e Y podem ter fatores diferentes.

**Template:** `escala(2.5, 0.8)`.

```text
2.5  0
0    0.8
```

O quadrado fica 2,5 vezes mais largo e com 80% da altura original.

## Fase 3 — Cisalhamento

**Conceito:** o novo X depende também de Y: `x' = x + 0.7y`.

```text
1  0.7
0  1
```

Y permanece igual; cada linha horizontal é deslocada proporcionalmente à sua altura.

## Fase 4 — Translação homogênea

**Conceito:** a terceira coordenada homogênea permite representar deslocamento em matriz.

```text
1  0  0.4
0  1  0.3
0  0  1
```

O ponto recebe `+0.4` em X e `+0.3` em Y.

## Fase 5 — Rotação de 45°

**Conceito:** `R(θ) = [[cosθ,-sinθ],[sinθ,cosθ]]`.

```text
cos(π/4)  -sin(π/4)  0
sin(π/4)   cos(π/4)  0
0           0         1
```

Aproximação:

```text
0.7071  -0.7071  0
0.7071   0.7071  0
0        0       1
```

O sinal negativo fica na primeira linha, segunda coluna; inverter os sinais produz rotação de `-45°`.

## Fase 6 — Composição 2D em dois passos

**Sequência:**

1. `rot(π/4)`
2. `transl(0.3, 0.2)`

```text
M = T × R

0.7071  -0.7071  0.3
0.7071   0.7071  0.2
0        0       1
```

O quadrado gira ao redor da origem e só depois é deslocado. Trocar a ordem também rotacionaria o vetor de translação e não coincidiria com o alvo.

## Fase 7 — Composição 2D em três passos

**Sequência:**

1. `cis(1.3)`
2. `escala(1.5, 0.55)`
3. `transl(-0.55, 0.48)`

```text
M = T × S × C

1.5  1.95  -0.55
0    0.55   0.48
0    0      1
```

O cisalhamento cria a inclinação, a escala altera as proporções e a translação posiciona o resultado.

---

## Fase 8 — Escala e translação 3D

**Sequência conceitual:** escala uniforme e depois translação. Nesta fase a matriz pode ser digitada diretamente no construtor.

```text
M = T × S

1.5  0    0    1.1
0    1.5  0    0.4
0    0    1.5 -0.5
0    0    0    1
```

A diagonal escala X/Y/Z; a quarta coluna desloca o cubo sem ter seus valores multiplicados pela escala.

## Fase 9 — Rotação em X e Y

**Sequência:**

1. `rotX(π/4)` — pode ser construída manualmente;
2. `rotY(π/6)` — pode ser construída manualmente;
3. `transl3d(0.7, 0.3, 0)`.

```text
M = T × Ry × Rx

 0.8660   0.3536   0.3536  0.7
 0        0.7071  -0.7071  0.3
-0.5      0.6124   0.6124  0
 0        0        0       1
```

Rx mistura Y/Z; Ry mistura X/Z. A translação ocorre por último.

## Fase 10 — Rotação em Z

**Sequência:**

1. `rotZ(π/3)` — construa a rotação de 60°;
2. `transl3d(0.6, 0.5, 0)`.

```text
0.5    -0.8660  0  0.6
0.8660  0.5     0  0.5
0       0       1  0
0       0       0  1
```

A submatriz superior esquerda é a mesma rotação usada em 2D; Z permanece inalterado.

## Fase 11 — Composição 3D em dois passos

**Sequência:**

1. `rotX(π/4)`
2. `transl3d(0.9, 0.3, 0)`

```text
1  0       0       0.9
0  0.7071 -0.7071  0.3
0  0.7071  0.7071  0
0  0       0       1
```

Somente esta ordem coincide com o alvo exibido.

## Fase 12 — Composição 3D em três passos

**Sequência:**

1. `escala3d(1.2, 0.8, 1)`
2. `rotZ(π/6)`
3. `transl3d(0.8, -0.5, 0.2)`

```text
M = T × Rz × S

1.0392  -0.4     0  0.8
0.6      0.6928  0 -0.5
0        0       1  0.2
0        0       0  1
```

A escala é não uniforme; por isso largura e altura respondem de forma diferente à rotação.

## Fase 13 — Composição 3D livre

**Sequência:**

1. `escala3d(0.8, 1.2, 0.8)`
2. `rotY(-π/6)`
3. `rotX(π/3)`
4. `transl3d(-0.7, 0.5, 0.9)`

```text
M = T × Rx × Ry × S

 0.6928  0       -0.4    -0.7
-0.3464  0.6     -0.6     0.5
 0.2     1.0392   0.3464  0.9
 0       0        0       1
```

Esta fase reúne escala não uniforme, duas rotações em eixos diferentes e posicionamento final.

---

## Fase 14 — Dois objetos com a mesma transformação

Selecione cada objeto pelos chips e aplique `rot(π/4)` aos dois.

```text
0.7071  -0.7071  0
0.7071   0.7071  0
0        0       1
```

Cada objeto mantém sua própria sequência, mesmo que as duas respostas sejam iguais.

## Fase 15 — Dois objetos com transformações diferentes

**Quadrado A:** `transl(-0.2, 0.3)`.

```text
1  0 -0.2
0  1  0.3
0  0  1
```

**Quadrado B:** `transl(0.35, -0.2)`.

```text
1  0  0.35
0  1 -0.2
0  0  1
```

Use os chips para alternar entre A e B sem perder as sequências.

## Fase 16 — Encaixe da cruz

Existem duas distribuições corretas.

### Solução A

- Barra A: `transl(0.5, -0.25)`.
- Barra B: `rot(π/2) → transl(-0.25, -0.4)`.

```text
Barra A                 Barra B
1  0  0.5              0 -1 -0.25
0  1 -0.25             1  0 -0.4
0  0  1                0  0  1
```

### Solução B

- Barra A: `rot(π/2) → transl(0.25, 0.5)`.
- Barra B: `transl(-0.4, 0.25)`.

```text
Barra A                 Barra B
0 -1  0.25             1  0 -0.4
1  0  0.5              0  1  0.25
0  0  1                0  0  1
```

Uma barra forma o eixo horizontal e a outra é girada 90° para formar o eixo vertical.

---

## Fase 17 — Dois cubos no espaço

**Cubo A:** `transl3d(-0.65, 0, 0)`.

**Cubo B:** `transl3d(0.65, 0, 0)`.

```text
Cubo A                         Cubo B
1 0 0 -0.65                   1 0 0  0.65
0 1 0  0                      0 1 0  0
0 0 1  0                      0 0 1  0
0 0 0  1                      0 0 0  1
```

## Fase 18 — Hierarquia pai-filho

**Pai:** `rotY(π/4)`.

```text
 0.7071  0  0.7071  0
 0       1  0       0
-0.7071  0  0.7071  0
 0       0  0       1
```

**Filho, em coordenadas locais:** `transl3d(0.5, 0, 0)`.

```text
1 0 0 0.5
0 1 0 0
0 0 1 0
0 0 0 1
```

A matriz mundial do filho é `Mpai × Mfilho`. Portanto, sua translação local também acompanha a rotação do pai.

## Fase 19 — Três peças

**Peça A:** `transl3d(-0.6, 0.3, 0)`.

```text
1 0 0 -0.6
0 1 0  0.3
0 0 1  0
0 0 0  1
```

**Peça B:** `transl3d(0, -0.3, 0.2)`.

```text
1 0 0  0
0 1 0 -0.3
0 0 1  0.2
0 0 0  1
```

**Peça C:** `transl3d(0.6, 0.3, -0.2)`.

```text
1 0 0  0.6
0 1 0  0.3
0 0 1 -0.2
0 0 0  1
```

## Fase 20 — Portal: Computação Gráfica

**Conceitos visuais:** textura procedural, UV, iluminação Phong, especular, Fresnel, emissividade e transparência.

**Template:** `transl3d(1.15, 1, -0.2)`.

```text
1  0  0  1.15
0  1  0  1
0  0  1 -0.2
0  0  0  1
```

A placa já possui forma, textura e orientação corretas. Ela precisa apenas ser deslocada até o portal holográfico.

---

## Verificação automática

As respostas deste arquivo são verificadas contra as definições reais das fases com:

```bash
node scripts/validar-fases.mjs
```

