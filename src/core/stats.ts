/** Статистика: сипаттамалық көрсеткіштер, жұптық t-тест, Уилкоксон, Шапиро–Уилк, χ², Фишер. */

export function mean(x: number[]): number {
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
}

export function sd(x: number[]): number {
  if (x.length < 2) return NaN;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
}

export function median(x: number[]): number {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// ---------- арнайы функциялар ----------
function logGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Регуляризацияланған толымсыз бета-функция I_x(a,b) */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Стьюдент үлестірімінің CDF */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = 0.5 * incBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

export function tQuantile(p: number, df: number): number {
  let lo = -1000;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function normCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26 емес, erf арқылы дәлірек
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
  // W. J. Cody жуықтауына жақын қатар/тізбек (дәлдік ~1e-12)
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  if (x < 3) {
    let sum = x;
    let term = x;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-16) break;
    }
    return sign * (2 / Math.sqrt(Math.PI)) * sum;
  }
  // үлкен x үшін тізбекті бөлшек
  let f = 0;
  for (let n = 60; n >= 1; n--) f = n / 2 / (x + f);
  const erfc = Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f);
  return sign * (1 - erfc);
}

/** Стандартты қалыпты үлестірім квантилі (Acklam) */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function chi2Sf(x: number, df: number): number {
  // P(χ² > x) = 1 − P(df/2, x/2) — толымсыз гамма
  if (x <= 0) return 1;
  return 1 - lowerGammaReg(df / 2, x / 2);
}

function lowerGammaReg(s: number, x: number): number {
  if (x < s + 1) {
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      sum += term;
      if (term < sum * 1e-15) break;
    }
    return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }
  // тізбекті бөлшек (upper)
  let b = x + 1 - s;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

// ---------- тесттер ----------
export interface Describe {
  n: number;
  mean: number;
  sd: number;
  se: number;
  median: number;
  min: number;
  max: number;
  ci95: [number, number] | null;
}

export function describe(x: number[]): Describe {
  const n = x.length;
  const m = mean(x);
  const s = sd(x);
  const se = n > 1 ? s / Math.sqrt(n) : NaN;
  const tc = n > 1 ? tQuantile(0.975, n - 1) : NaN;
  return {
    n,
    mean: m,
    sd: s,
    se,
    median: median(x),
    min: n ? Math.min(...x) : NaN,
    max: n ? Math.max(...x) : NaN,
    ci95: n > 1 && Number.isFinite(se) ? [m - tc * se, m + tc * se] : null,
  };
}

export interface PairedTTest {
  n: number;
  meanDiff: number;
  sdDiff: number;
  t: number;
  df: number;
  p: number;
  ci95: [number, number];
  cohenDz: number;
}

/** Жұптық t-тест: d_i = x_i − y_i (бір seed бойынша). */
export function pairedTTest(x: number[], y: number[]): PairedTTest | null {
  if (x.length !== y.length || x.length < 2) return null;
  const d = x.map((v, i) => v - y[i]);
  const n = d.length;
  const m = mean(d);
  const s = sd(d);
  const df = n - 1;
  const se = s / Math.sqrt(n);
  const tc = tQuantile(0.975, df);
  if (s === 0) {
    return { n, meanDiff: m, sdDiff: 0, t: m === 0 ? 0 : Infinity * Math.sign(m), df, p: m === 0 ? 1 : 0, ci95: [m, m], cohenDz: m === 0 ? 0 : Infinity };
  }
  const t = m / se;
  const p = 2 * (1 - tCdf(Math.abs(t), df));
  return { n, meanDiff: m, sdDiff: s, t, df, p: Math.min(1, Math.max(0, p)), ci95: [m - tc * se, m + tc * se], cohenDz: m / s };
}

export interface WilcoxonResult {
  n: number; // нөлдік емес айырмалар
  W: number; // оң рангтар қосындысы
  p: number;
  method: 'exact' | 'normal';
}

export function wilcoxonSignedRank(x: number[], y: number[]): WilcoxonResult | null {
  if (x.length !== y.length) return null;
  const d = x.map((v, i) => v - y[i]).filter((v) => Math.abs(v) > 1e-12);
  const n = d.length;
  if (n < 1) return { n: 0, W: 0, p: 1, method: 'exact' };
  const abs = d.map((v, i) => ({ a: Math.abs(v), s: Math.sign(v), i })).sort((p, q) => p.a - q.a);
  const ranks = new Array(n).fill(0);
  let ties = false;
  let tieCorr = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && Math.abs(abs[j + 1].a - abs[i].a) < 1e-12) j++;
    const r = (i + j + 2) / 2;
    if (j > i) {
      ties = true;
      const tc = j - i + 1;
      tieCorr += tc ** 3 - tc;
    }
    for (let k = i; k <= j; k++) ranks[k] = r;
    i = j + 1;
  }
  let wPlus = 0;
  for (let k = 0; k < n; k++) if (abs[k].s > 0) wPlus += ranks[k];
  const total = (n * (n + 1)) / 2;
  if (!ties && n <= 30) {
    // нақты үлестірім (динамикалық бағдарлама)
    const cnt = new Array(total + 1).fill(0);
    cnt[0] = 1;
    for (let r = 1; r <= n; r++) for (let s = total; s >= r; s--) cnt[s] += cnt[s - r];
    const all = 2 ** n;
    const w = Math.min(wPlus, total - wPlus);
    let cum = 0;
    for (let s = 0; s <= Math.floor(w + 1e-9); s++) cum += cnt[s];
    return { n, W: wPlus, p: Math.min(1, (2 * cum) / all), method: 'exact' };
  }
  const mu = total / 2;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieCorr / 48);
  const z = (wPlus - mu - Math.sign(wPlus - mu) * 0.5) / sigma;
  return { n, W: wPlus, p: Math.min(1, 2 * (1 - normCdf(Math.abs(z)))), method: 'normal' };
}

/** Шапиро–Уилк (Royston, 1995 жуықтауы), 3 ≤ n ≤ 5000 */
export function shapiroWilk(x: number[]): { W: number; p: number } | null {
  const n = x.length;
  if (n < 3) return null;
  const s = [...x].sort((a, b) => a - b);
  const range = s[n - 1] - s[0];
  if (range < 1e-12) return null;
  const m = Array.from({ length: n }, (_, i) => normInv((i + 1 - 0.375) / (n + 0.25)));
  const mm = m.reduce((a, b) => a + b * b, 0);
  const u = 1 / Math.sqrt(n);
  const a = new Array(n).fill(0);
  if (n === 3) {
    a[0] = -Math.SQRT1_2;
    a[2] = Math.SQRT1_2;
  } else {
    const an = m[n - 1] / Math.sqrt(mm) + 0.221157 * u - 0.147981 * u ** 2 - 2.07119 * u ** 3 + 4.434685 * u ** 4 - 2.706056 * u ** 5;
    if (n > 5) {
      const an1 = m[n - 2] / Math.sqrt(mm) + 0.042981 * u - 0.293762 * u ** 2 - 1.752461 * u ** 3 + 5.682633 * u ** 4 - 3.582633 * u ** 5;
      const phi = (mm - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) / (1 - 2 * an ** 2 - 2 * an1 ** 2);
      for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi);
      a[n - 1] = an;
      a[0] = -an;
      a[n - 2] = an1;
      a[1] = -an1;
    } else {
      const phi = (mm - 2 * m[n - 1] ** 2) / (1 - 2 * an ** 2);
      for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi);
      a[n - 1] = an;
      a[0] = -an;
    }
  }
  const xm = mean(s);
  const ssq = s.reduce((acc, v) => acc + (v - xm) ** 2, 0);
  const num = s.reduce((acc, v, i) => acc + a[i] * v, 0) ** 2;
  const W = Math.min(1, num / ssq);
  let p: number;
  if (n === 3) {
    p = Math.max(0, Math.min(1, (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75)))));
  } else if (n <= 11) {
    const gamma = 0.459 * n - 2.273;
    const w = -Math.log(gamma - Math.log(1 - W));
    const mu = 0.544 - 0.39978 * n + 0.025054 * n ** 2 - 0.0006714 * n ** 3;
    const sigma = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n ** 2 - 0.0020322 * n ** 3);
    p = 1 - normCdf((w - mu) / sigma);
  } else {
    const ln = Math.log(n);
    const w = Math.log(1 - W);
    const mu = 0.0038915 * ln ** 3 - 0.083751 * ln ** 2 - 0.31082 * ln - 1.5861;
    const sigma = Math.exp(0.0030302 * ln ** 2 - 0.082676 * ln - 0.4803);
    p = 1 - normCdf((w - mu) / sigma);
  }
  return { W, p: Math.max(0, Math.min(1, p)) };
}

export interface Chi2Result {
  chi2: number;
  df: number;
  p: number;
  expected: number[][];
  minExpected: number;
  smallExpected: boolean;
  yates: { chi2: number; p: number } | null;
}

/** Пирсонның χ² тәуелсіздік критерийі (r×c). */
export function chiSquare(table: number[][]): Chi2Result {
  const r = table.length;
  const c = table[0].length;
  const rows = table.map((row) => row.reduce((a, b) => a + b, 0));
  const cols = Array.from({ length: c }, (_, j) => table.reduce((a, row) => a + row[j], 0));
  const N = rows.reduce((a, b) => a + b, 0);
  const expected = table.map((_, i) => cols.map((cj) => (rows[i] * cj) / N));
  let chi2 = 0;
  let yc = 0;
  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++) {
      const e = expected[i][j];
      chi2 += (table[i][j] - e) ** 2 / e;
      yc += Math.max(0, Math.abs(table[i][j] - e) - 0.5) ** 2 / e;
    }
  const df = (r - 1) * (c - 1);
  const minExpected = Math.min(...expected.flat());
  return {
    chi2,
    df,
    p: chi2Sf(chi2, df),
    expected,
    minExpected,
    smallExpected: expected.flat().some((e) => e < 5),
    yates: r === 2 && c === 2 ? { chi2: yc, p: chi2Sf(yc, 1) } : null,
  };
}

function logFact(n: number): number {
  return logGamma(n + 1);
}

/** Фишердің нақты тесті 2×2 (екі жақты). */
export function fisherExact(t: number[][]): number {
  const [[a, b], [c, d]] = t;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const N = r1 + r2;
  const prob = (x: number) =>
    Math.exp(logFact(r1) + logFact(r2) + logFact(c1) + logFact(N - c1) - logFact(N) - logFact(x) - logFact(r1 - x) - logFact(c1 - x) - logFact(r2 - c1 + x));
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  const p0 = prob(a);
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const px = prob(x);
    if (px <= p0 * (1 + 1e-7)) p += px;
  }
  return Math.min(1, p);
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< 0,001';
  return p.toFixed(3).replace('.', ',');
}

/** Уэлч t-тесті (тәуелсіз екі іріктеме). */
export function welchTTest(x: number[], y: number[]) {
  if (x.length < 2 || y.length < 2) return null;
  const mx = mean(x), my = mean(y);
  const vx = sd(x) ** 2 / x.length, vy = sd(y) ** 2 / y.length;
  const se = Math.sqrt(vx + vy);
  if (se === 0) return null;
  const t = (mx - my) / se;
  const df = (vx + vy) ** 2 / (vx ** 2 / (x.length - 1) + vy ** 2 / (y.length - 1));
  const p = 2 * (1 - tCdf(Math.abs(t), df));
  const tc = tQuantile(0.975, df);
  return { t, df, p: Math.min(1, p), diff: mx - my, ci95: [mx - my - tc * se, mx - my + tc * se] as [number, number] };
}

/** Манн–Уитни U (қалыпты жуықтау, байланыс түзетуімен). */
export function mannWhitney(x: number[], y: number[]) {
  const n1 = x.length, n2 = y.length;
  if (n1 < 1 || n2 < 1) return null;
  const all = [...x.map((v) => ({ v, g: 0 })), ...y.map((v) => ({ v, g: 1 }))].sort((a, b) => a.v - b.v);
  const ranks = new Array(all.length).fill(0);
  let tie = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const r = (i + j + 2) / 2;
    const tc = j - i + 1;
    if (tc > 1) tie += tc ** 3 - tc;
    for (let k = i; k <= j; k++) ranks[k] = r;
    i = j + 1;
  }
  let r1 = 0;
  all.forEach((a, i) => { if (a.g === 0) r1 += ranks[i]; });
  const U = r1 - (n1 * (n1 + 1)) / 2;
  const N = n1 + n2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
  if (sigma === 0) return { U, p: 1 };
  const z = (U - mu - Math.sign(U - mu) * 0.5) / sigma;
  return { U, z, p: Math.min(1, 2 * (1 - normCdf(Math.abs(z)))) };
}

/** «p = 0,083» немесе «p < 0,001» */
export function pEq(p: number): string {
  if (!Number.isFinite(p)) return 'p = —';
  return p < 0.001 ? 'p < 0,001' : `p = ${fmtP(p)}`;
}
