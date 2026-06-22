// Operações matriciais manuais — parte central do propósito educativo do projeto
// Todas as matrizes são Float32Array em ordem column-major para compatibilidade com WebGL

// --- Utilitários básicos ---

export function identidade3() {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
}

export function identidade4() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

// Multiplica duas matrizes NxN (ordem column-major)
export function multiplicar(A, B, n) {
  const C = new Float32Array(n * n);
  for (let col = 0; col < n; col++) {
    for (let lin = 0; lin < n; lin++) {
      let soma = 0;
      for (let k = 0; k < n; k++) {
        // A é column-major: A[k*n + lin], B é column-major: B[col*n + k]
        soma += A[k * n + lin] * B[col * n + k];
      }
      C[col * n + lin] = soma;
    }
  }
  return C;
}

// Compõe uma lista na ordem visual de aplicação.
// Se a sequência é [A, B, C], A age primeiro e a matriz final é C × B × A.
export function multiplicarSequencia(matrizes, n) {
  if (matrizes.length === 0) {
    if (n === 2) return new Float32Array([1, 0, 0, 1]); // identidade 2×2
    return n === 3 ? identidade3() : identidade4();
  }
  let resultado = n === 2
    ? new Float32Array([1, 0, 0, 1])
    : n === 3 ? identidade3() : identidade4();
  for (const matriz of matrizes) {
    // Pré-multiplicação: a nova transformação age depois das anteriores.
    resultado = multiplicar(matriz, resultado, n);
  }
  return resultado;
}

// --- Matrizes 2D (3×3 homogêneas, column-major) ---

export function escala2D(sx, sy) {
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    0,  0, 1,
  ]);
}

export function translacao2D(tx, ty) {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    tx, ty, 1,
  ]);
}

export function rotacao2D(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new Float32Array([
    c, s, 0,
    -s, c, 0,
    0,  0, 1,
  ]);
}

export function cisalhamento2D(kx, ky) {
  return new Float32Array([
    1, ky, 0,
    kx, 1, 0,
    0,  0, 1,
  ]);
}

// Matriz 2×2 pura (sem coordenadas homogêneas) — usada no mundo 1 fases 1-3
export function escala2x2(sx, sy) {
  return new Float32Array([sx, 0, 0, sy]);
}

export function cisalhamento2x2(kx, ky) {
  return new Float32Array([1, ky, kx, 1]);
}

export function multiplicar2x2(A, B) {
  return new Float32Array([
    A[0]*B[0] + A[2]*B[1],  A[1]*B[0] + A[3]*B[1],
    A[0]*B[2] + A[2]*B[3],  A[1]*B[2] + A[3]*B[3],
  ]);
}

// --- Matrizes 3D (4×4 homogêneas, column-major) ---

export function escala3D(sx, sy, sz) {
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ]);
}

export function translacao3D(tx, ty, tz) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1,
  ]);
}

export function rotacaoX(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new Float32Array([
    1, 0,  0, 0,
    0, c,  s, 0,
    0, -s, c, 0,
    0, 0,  0, 1,
  ]);
}

export function rotacaoY(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1,  0, 0,
    s, 0,  c, 0,
    0, 0,  0, 1,
  ]);
}

export function rotacaoZ(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new Float32Array([
    c,  s, 0, 0,
    -s, c, 0, 0,
    0,  0, 1, 0,
    0,  0, 0, 1,
  ]);
}

// Câmera lookAt — gera view matrix em column-major para WebGL
export function lookAt(eye, center, up) {
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const norm = (v) => { const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); return [v[0]/l,v[1]/l,v[2]/l]; };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

  const f = norm(sub(center, eye));
  const s = norm(cross(f, up));
  const u = cross(s, f);

  return new Float32Array([
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
  ]);
}

// Perspectiva simples para o modo 3D
export function perspectiva(fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad / 2);
  const rangeInv = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

// Converte uma matriz 3×3 para Float32Array (caso já seja uma array JS normal)
export function paraFloat32(valores, n) {
  return new Float32Array(valores.slice(0, n * n));
}

// Verifica se duas matrizes são "iguais" dentro de uma tolerância
export function matrizesSaoIguais(A, B, n, tolerancia = 1e-4) {
  for (let i = 0; i < n * n; i++) {
    if (Math.abs(A[i] - B[i]) > tolerancia) return false;
  }
  return true;
}

// Avalia uma string de expressão matemática de forma segura
// Aceita símbolos visuais (π, sin(, cos(, √() além das formas JS
export function avaliarExpressao(str) {
  if (str === null || str === undefined || str === '') return null;
  try {
    const limpa = String(str)
      .replace(/π/g, 'Math.PI')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(')
      .replace(/√\(/g, 'Math.sqrt(')
      // 'e' isolado como constante de Euler, não parte de palavras
      .replace(/\be\b/g, 'Math.E');
    // eslint-disable-next-line no-new-func
    const fn = new Function('Math', `"use strict"; return (${limpa});`);
    const resultado = fn(Math);
    if (typeof resultado !== 'number' || !isFinite(resultado)) return null;
    return resultado;
  } catch {
    return null;
  }
}
