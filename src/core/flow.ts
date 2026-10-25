/** Көлік ағынының негізгі теңдеуі және тәуелділіктер. */

export interface FlowInput {
  density: number; // ρ, авт./км (бір жолаққа немесе барлық жолаққа — lanesMode қараңыз)
  speed: number; // v, км/сағ
  lanes?: number; // жолақ саны (тығыздық бір жолаққа берілсе)
  densityPerLane?: boolean;
}

export interface FlowResult {
  q: number; // авт./сағ (барлық жолақ)
  qPerLane: number;
  lanes: number;
}

export function assertNonNegative(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new Error(`${name}: сан емес`);
  if (v < 0) throw new Error(`${name}: теріс мән рұқсат етілмейді`);
}

/** q = ρ · v. Бірліктер: [авт./км]·[км/сағ] = [авт./сағ]. */
export function flowRate(density: number, speed: number): number {
  assertNonNegative('ρ', density);
  assertNonNegative('v', speed);
  return density * speed;
}

export function flow(input: FlowInput): FlowResult {
  const lanes = Math.max(1, Math.round(input.lanes ?? 1));
  const q1 = flowRate(input.density, input.speed);
  if (input.densityPerLane) return { q: q1 * lanes, qPerLane: q1, lanes };
  return { q: q1, qPerLane: q1 / lanes, lanes };
}

/** Гипотеза (Гриншилдс): v(ρ) = v_free · max(0, 1 − ρ/ρ_jam). Өлшеммен ауыстырылмайды. */
export function greenshieldsSpeed(rho: number, vFree: number, rhoJam: number): number {
  assertNonNegative('ρ', rho);
  assertNonNegative('v_free', vFree);
  if (!(rhoJam > 0)) throw new Error('ρ_jam > 0 болуы тиіс');
  return vFree * Math.max(0, 1 - rho / rhoJam);
}

export function greenshieldsFlow(rho: number, vFree: number, rhoJam: number): number {
  return rho * greenshieldsSpeed(rho, vFree, rhoJam);
}

/** Гриншилдс моделіндегі максимал ағын: q_max = v_free·ρ_jam/4, ρ = ρ_jam/2 нүктесінде. */
export function greenshieldsCapacity(vFree: number, rhoJam: number) {
  return { qMax: (vFree * rhoJam) / 4, rhoCrit: rhoJam / 2, vCrit: vFree / 2 };
}

/** Пуассон: P(k) = λ^k e^{-λ} / k! (λ — интервалдағы орташа көлік саны). */
export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  assertNonNegative('λ', lambda);
  let logP = -lambda + k * Math.log(lambda || 1e-300);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  if (lambda === 0) return k === 0 ? 1 : 0;
  return Math.exp(logP);
}

/** Бастапқы зерттеудегі оқу мысалдары (модельдік дерек). */
export const SOURCE_FLOW_EXAMPLES = [
  { rho: 40, v: 50, q: 2000 },
  { rho: 80, v: 30, q: 2400 },
  { rho: 120, v: 15, q: 1800 },
] as const;

export const SOURCE_WAIT_EXAMPLES = {
  fixed: [60, 55, 70],
  adaptive: [35, 30, 40],
} as const;
