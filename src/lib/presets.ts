/** Дайын баптаулар: бала сандарды енгізбей-ақ тәжірибе жасай алады. */
import { DEFAULT_PARAMS, ScenarioParams, mergeParams, NetworkKind } from '../core/scenario';

export type Level = 'low' | 'mid' | 'high';
export type Pace = 'slow' | 'normal' | 'fast';

export const LEVELS: { v: Level; t: string; d: string }[] = [
  { v: 'low', t: 'Аз', d: 'еркін көше' },
  { v: 'mid', t: 'Орташа', d: 'әдеттегі күн' },
  { v: 'high', t: 'Көп', d: 'қарбалас уақыт' },
];

/** авт./сағ бір кіру бағытына — виртуалды тәжірибе баптаулары, өлшеу емес */
export const LEVEL_RATE: Record<NetworkKind, Record<Level, number>> = {
  single: { low: 150, mid: 300, high: 480 },
  corridor: { low: 120, mid: 240, high: 380 },
};

export const PACES: { v: Pace; t: string }[] = [
  { v: 'slow', t: 'Баяу' },
  { v: 'normal', t: 'Қалыпты' },
  { v: 'fast', t: 'Жылдам' },
];

/** Анимация жылдамдығы: экрандағы 1 секундқа келетін модельдік секунд */
export const PACE_SPEED: Record<'city' | 'compare', Record<Pace, number>> = {
  city: { slow: 2, normal: 6, fast: 15 },
  compare: { slow: 6, normal: 20, fast: 60 },
};

export function presetParams(network: NetworkKind, level: Level, over: Partial<ScenarioParams> = {}): ScenarioParams {
  return mergeParams(DEFAULT_PARAMS, { network, ratePerApproach: LEVEL_RATE[network][level], seed: 2026, duration: 3600, ...over });
}

export type CongestionLevel = 'low' | 'mid' | 'high';

/** Кептеліс деңгейі: тоқтап тұрған көліктер саны / кіреберіс жолақтар саны (әр қиылыста 8). */
export function congestion(waiting: number, junctions: number): { level: CongestionLevel; label: string; perLane: number } {
  const perLane = waiting / Math.max(1, junctions * 8);
  if (perLane < 1.5) return { level: 'low', label: 'Төмен', perLane };
  if (perLane < 4) return { level: 'mid', label: 'Орташа', perLane };
  return { level: 'high', label: 'Жоғары', perLane };
}

/** Тұрақты мен адаптивті күтуін салыстыратын адал сөйлем (тек есептелген сандар). */
export function compareSentence(wFixed: number, wAdaptive: number, finished: boolean): { text: string; tone: 'ok' | 'warn' | 'info' } {
  if (!(wFixed > 0)) return { text: 'Салыстыру үшін әлі деректер жеткіліксіз — бірнеше көлік қиылыстан өтуі керек.', tone: 'info' };
  const pct = ((wFixed - wAdaptive) / wFixed) * 100;
  const p = Math.abs(pct).toFixed(0);
  const pre = finished ? 'Бұл тәжірибеде' : 'Әзірге (тәжірибе аяқталмады)';
  if (Math.abs(pct) < 2) return { text: `${pre} екі бағдаршамның күту уақыты іс жүзінде бірдей (айырма ${p}%).`, tone: 'info' };
  if (pct > 0) return { text: `${pre} ақылды бағдаршам күту уақытын ${p}%-ға азайтты.`, tone: 'ok' };
  return { text: `${pre} ақылды бағдаршам күту уақытын ${p}%-ға арттырды — бұл жағдайда қарапайым бағдаршам тиімдірек болды.`, tone: 'warn' };
}
