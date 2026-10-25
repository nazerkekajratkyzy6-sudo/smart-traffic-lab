/** Жұптық салыстыру және қорытынды мәтіні — Статистика, AI зерттеуші және PDF есеп үшін ортақ ереже. */
import { describe, pairedTTest, wilcoxonSignedRank, shapiroWilk, Describe, PairedTTest, WilcoxonResult, pEq } from '../core/stats';
import { ExperimentResult, MetricKey, METRIC_LABELS, pairs } from '../core/experiments';
import { fmt } from './format';

export const LOWER_BETTER: Record<MetricKey, boolean> = {
  avgWait: true,
  avgWaitMain: true,
  avgWaitSide: true,
  maxWait: true,
  avgQueue: true,
  maxQueue: true,
  throughputPerHour: false,
  avgTravel: true,
  completed: false,
  unfinished: true,
  generated: false,
};

export interface PairedAnalysis {
  metric: MetricKey;
  n: number;
  seeds: number[];
  fixed: Describe;
  adaptive: Describe;
  diff: Describe;
  diffs: number[];
  t: PairedTTest | null;
  w: WilcoxonResult | null;
  normal: { W: number; p: number } | null;
  primary: 'paired-t' | 'wilcoxon' | null;
  pPrimary: number | null;
  significant: boolean;
  improvementOfMeans: number | null;
  verdict: string;
  cautions: string[];
}

export function analyzePairs(res: ExperimentResult, variantIndex: number, metric: MetricKey): PairedAnalysis | null {
  const pr = pairs(res, variantIndex, metric);
  if (pr.length === 0) return null;
  const fx = pr.map((p) => p.fixed);
  const ad = pr.map((p) => p.adaptive);
  const diffs = pr.map((p) => p.diff);
  const n = pr.length;
  const t = pairedTTest(fx, ad);
  const w = wilcoxonSignedRank(fx, ad);
  const normal = n >= 3 ? shapiroWilk(diffs) : null;
  const cautions: string[] = [];
  let primary: PairedAnalysis['primary'] = null;
  let pPrimary: number | null = null;
  if (n >= 2 && t) {
    if (normal && normal.p < 0.05) {
      primary = 'wilcoxon';
      pPrimary = w?.p ?? null;
      cautions.push(`Айырмалар қалыпты үлестірілмеген болуы мүмкін (Шапиро–Уилк ${pEq(normal.p)}), сондықтан негізгі критерий — Уилкоксон.`);
    } else {
      primary = 'paired-t';
      pPrimary = t.p;
      if (!normal) cautions.push('Қалыптылықты тексеру үшін n жеткіліксіз (n < 3) немесе айырмалар бірдей.');
    }
  }
  if (n < 10) cautions.push(`Жұптар саны аз (n = ${n}); E10 сияқты ≥ 30 қайталау ұсынылады.`);
  if (res.runs.some((r) => r.variantIndex === variantIndex && r.result.overloaded)) cautions.push('Кейбір қайталауларда жүктеме шегінен асып, симуляция ерте тоқтады — нәтиже толық емес.');
  if (res.runs.some((r) => r.variantIndex === variantIndex && r.result.unfinished > 0.1 * Math.max(1, r.result.generated)))
    cautions.push('Аяқталмаған сапарлар үлесі 10%-дан жоғары — орташа күту тек аяқталғандар бойынша, сондықтан төмен бағалануы мүмкін.');
  const significant = pPrimary !== null && pPrimary < 0.05;
  const fd = describe(fx);
  const adesc = describe(ad);
  const dd = describe(diffs);
  const lower = LOWER_BETTER[metric];
  const improvementOfMeans = fd.mean !== 0 && Number.isFinite(fd.mean) ? ((lower ? fd.mean - adesc.mean : adesc.mean - fd.mean) / Math.abs(fd.mean)) * 100 : null;
  const label = METRIC_LABELS[metric];
  const better = lower ? dd.mean > 0 : dd.mean < 0;
  const testName = primary === 'paired-t' ? 'жұптық t-тест' : primary === 'wilcoxon' ? 'Уилкоксонның таңбалы рангтар критерийі' : '';
  let verdict: string;
  if (n < 2 || pPrimary === null) verdict = `Қорытынды жасауға деректер жеткіліксіз (n = ${n}).`;
  else if (significant)
    verdict = `Модель шеңберінде (n = ${n} жұп, бірдей seed пен сұраныс) «${label}» бойынша ${better ? 'ақылды (адаптивті) бағдаршам тиімдірек' : 'қарапайым (тұрақты) бағдаршам тиімдірек'}: айырманың орташасы ${fmt(dd.mean, 2)} (95% СА ${dd.ci95 ? `[${fmt(dd.ci95[0], 2)}; ${fmt(dd.ci95[1], 2)}]` : '—'}), ${testName}, ${pEq(pPrimary)} (маңыздылық деңгейі α = 0,05). Бұл — калибрленбеген симуляцияның нәтижесі; нақты қалаға тікелей көшірілмейді.`;
  else verdict = `«${label}» бойынша айырмашылық статистикалық маңызды емес (${testName}, ${pEq(pPrimary)}, α = 0,05). Бұл деректер негізінде «дәлелденді» деп айтуға болмайды.`;
  return { metric, n, seeds: pr.map((p) => p.seed), fixed: fd, adaptive: adesc, diff: dd, diffs, t, w, normal, primary, pPrimary, significant, improvementOfMeans, verdict, cautions };
}

export function pairedExperiments(all: Record<string, ExperimentResult>) {
  return Object.values(all)
    .filter((e) => e.runs.some((r) => r.mode === 'fixed') && e.runs.some((r) => r.mode === 'adaptive'))
    .sort((a, b) => a.experiment.localeCompare(b.experiment));
}

export function variantsOf(res: ExperimentResult) {
  const m = new Map<number, string>();
  for (const r of res.runs) m.set(r.variantIndex, r.variant);
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}
