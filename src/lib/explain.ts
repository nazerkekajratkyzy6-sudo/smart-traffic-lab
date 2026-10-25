/** Ережеге негізделген түсіндірмелер: тек есептелген метрикалар негізінде, генеративті модельсіз. */
import type { LastRun } from './store';
import type { SimResult } from '../core/engine';
import { improvementPct } from '../core/engine';
import { entryRate } from '../core/demand';
import { SAT_FLOW_PER_LANE } from '../core/network';
import type { PairedAnalysis } from './analysis';
import { fmt, MODE_LABEL } from './format';
import { pEq } from '../core/stats';

export interface Answer {
  title: string;
  bullets: string[];
  conclusion: string;
}

export type QuestionId = 'why' | 'which' | 'formula' | 'trust';

export const QUESTIONS: { id: QuestionId; text: string }[] = [
  { id: 'why', text: 'Неліктен кептеліс пайда болды?' },
  { id: 'which', text: 'Қай модель тиімді?' },
  { id: 'formula', text: 'Формула нені білдіреді?' },
  { id: 'trust', text: 'Нәтижеге сенуге бола ма?' },
];

export interface ExplainContext {
  run: LastRun | null;
  analysis: PairedAnalysis | null;
  analysisLabel?: string;
}

function mainResult(run: LastRun): [keyof typeof MODE_LABEL, SimResult] | null {
  if (run.results.fixed) return ['fixed', run.results.fixed];
  if (run.results.adaptive) return ['adaptive', run.results.adaptive];
  return null;
}

/** Тұрақты цикл үшін қанығу дәрежесі x = сұраныс / өткізу қабілеті (жолақ бойынша, Вебстер стилінде). */
export function saturation(run: LastRun) {
  const p = run.params;
  const C = 2 * (p.fixed.green + p.fixed.greenLeft) + 4 * (p.signal.yellow + p.signal.allRed);
  const capThrough = (SAT_FLOW_PER_LANE * p.fixed.green) / C;
  const capLeft = (SAT_FLOW_PER_LANE * p.fixed.greenLeft) / C;
  const rows = (['main', 'side'] as const).map((k) => {
    const q = entryRate(p, k) * (p.profile === 'peak' ? p.peakFactor : 1);
    const sh = k === 'main' ? p.turnMain : p.turnSide;
    const sum = sh.L + sh.T + sh.R || 1;
    const qT = (q * (sh.T + sh.R)) / sum;
    const qL = (q * sh.L) / sum;
    return { kind: k, q, xThrough: qT / capThrough, xLeft: qL / capLeft };
  });
  return { C, capThrough, capLeft, rows };
}

export function explain(q: QuestionId, ctx: ExplainContext): Answer | null {
  const run = ctx.run;
  if (q === 'why') {
    if (!run) return null;
    const mr = mainResult(run)!;
    const r = mr[1];
    const p = run.params;
    const sat = saturation(run);
    const bullets: string[] = [];
    for (const row of sat.rows)
      bullets.push(
        `${row.kind === 'main' ? 'Негізгі' : 'Қосалқы'} көше: келу ${fmt(row.q, 0)} авт./сағ${p.profile === 'peak' ? ' (шың кезінде)' : ''}; тұрақты циклде (C = ${fmt(sat.C, 0)} с) қанығу дәрежесі x ≈ ${fmt(row.xThrough, 2)} (тура/оңға), ${fmt(row.xLeft, 2)} (солға).`,
      );
    bullets.push(`${MODE_LABEL[mr[0]]} режим: орташа кезек ${fmt(r.avgQueue, 1)} авт., ең үлкен кезек ${r.maxQueue} авт., аяқталмаған сапар ${r.unfinished} (${fmt((100 * r.unfinished) / Math.max(1, r.generated), 1)}%).`);
    if (r.perJunction.length > 1) {
      const worst = [...r.perJunction].sort((a, b) => b.avgQueue - a.avgQueue)[0];
      bullets.push(`Ең жүктелген: ${worst.id} (орташа кезек ${fmt(worst.avgQueue, 1)}, шың ${worst.maxQueue}).`);
    }
    if (p.truckShare > 0) bullets.push(`Негізгі көшеде ${Math.round(p.truckShare * 100)}% баяу жүк көлігі (${p.truckSpeedKmh} км/сағ, ұзындығы 12 м): олар үдеуі баяу, кезекте көбірек орын алады.`);
    if (p.arrivals === 'poisson') bullets.push('Келу кездейсоқ (Пуассон): орташа сұраныс өткізу қабілетінен аз болса да, қысқа уақыттық топтасулар уақытша кезек тудырады.');
    if (r.overloaded) bullets.push('Желідегі көлік саны шектен асты — симуляция қауіпсіз тоқтатылды.');
    const maxX = Math.max(...sat.rows.map((x) => Math.max(x.xThrough, x.xLeft)));
    let conclusion: string;
    if (maxX > 1) conclusion = `Негізгі себеп: кем дегенде бір бағытта сұраныс тұрақты циклдің өткізу қабілетінен асады (x ≈ ${fmt(maxX, 2)} > 1), сондықтан кезек уақыт бойынша өседі.`;
    else if (maxX > 0.85) conclusion = `Жүйе өткізу қабілетіне жақын жұмыс істейді (x ≈ ${fmt(maxX, 2)}): кездейсоқ ауытқулар ұзақ кезек тудырады.`;
    else if (r.avgQueue > 5) conclusion = 'Сұраныс өткізу қабілетінен аз, кезек негізінен қызыл сигнал кезіндегі күту мен бұрылыс фазаларына байланысты.';
    else conclusion = 'Бұл сценарийде тұрақты кептеліс байқалмайды; кезектер қысқа және циклдік.';
    return { title: 'Неліктен кептеліс пайда болды?', bullets, conclusion };
  }
  if (q === 'which') {
    const bullets: string[] = [];
    let conclusion = '';
    if (run?.results.fixed && run.results.adaptive) {
      const f = run.results.fixed;
      const a = run.results.adaptive;
      const imp = improvementPct(f.avgWait, a.avgWait);
      bullets.push(`Соңғы салыстыру (seed ${run.params.seed}, бірдей ${f.generated} келу): орташа күту ${fmt(f.avgWait, 1)} с → ${fmt(a.avgWait, 1)} с${imp !== null ? `, өзгеріс ${fmt(imp, 1)}%` : ''}.`);
      bullets.push(`Орташа кезек ${fmt(f.avgQueue, 1)} → ${fmt(a.avgQueue, 1)} авт.; өткізу ${fmt(f.throughputPerHour, 0)} → ${fmt(a.throughputPerHour, 0)} авт./сағ; аяқталмаған ${f.unfinished} → ${a.unfinished}.`);
      bullets.push(`Негізгі/қосалқы көше күтуі: тұрақты ${fmt(f.avgWaitMain, 1)}/${fmt(f.avgWaitSide, 1)} с, адаптивті ${fmt(a.avgWaitMain, 1)}/${fmt(a.avgWaitSide, 1)} с.`);
      conclusion = 'Бір seed-тегі салыстыру — бір кездейсоқ іске асу ғана; статистикалық қорытынды үшін көп қайталау қажет.';
    } else if (run) bullets.push('Соңғы симуляция бір режимде орындалған. Салыстыру үшін «Бағдаршам зертханасы» бетінде «Салыстыру» режимін таңдаңыз.');
    if (ctx.analysis) {
      const an = ctx.analysis;
      bullets.push(`${ctx.analysisLabel ?? 'Тәжірибе'}: n = ${an.n} жұп, айырма орташасы ${fmt(an.diff.mean, 2)}${an.diff.ci95 ? ` (95% СА [${fmt(an.diff.ci95[0], 2)}; ${fmt(an.diff.ci95[1], 2)}])` : ''}, негізгі критерий ${an.pPrimary !== null ? pEq(an.pPrimary) : "p = —"}.`);
      conclusion = an.verdict;
    }
    if (!bullets.length) return null;
    return { title: 'Қай модель тиімді?', bullets, conclusion: conclusion || 'Қорытынды үшін екі режимді бірдей seed-пен салыстыру қажет.' };
  }
  if (q === 'formula') {
    const bullets = [
      'q = ρ·v: ағын (авт./сағ) тығыздық (авт./км) пен жылдамдықтың (км/сағ) көбейтіндісі. Мысалы ρ = 80, v = 30 → q = 2400 авт./сағ. Жолақ санын бөлек көрсету керек.',
      'v(ρ) = v_free·(1 − ρ/ρ_jam): тығыздық артқанда жылдамдық сызықты кемиді деген гипотеза; ағын ρ = ρ_jam/2 нүктесінде максимумға жетеді.',
      'S_i = N_i + α·W_i: адаптивті бағдаршам фазаның «қажеттілігін» кезектегі көлік саны мен олардың орташа күтуінен есептейді. α үлкен болса, ұзақ күткен бағыттар басымдық алады.',
      'Жақсару % = (W_fixed − W_adaptive)/W_fixed·100%: тек бірдей сұраныс пен seed кезінде мағыналы.',
      'Дейкстра: әр қадамда ең аз d бар келмеген түйін таңдалып, көршілерінің d мәндері жаңартылады; салмақтар теріс болмауы тиіс.',
    ];
    const ad = run?.results.adaptive;
    if (ad && run) bullets.push(`Соңғы адаптивті іске қосуда α = ${run.params.adaptive.alpha}, minGreen = ${run.params.adaptive.minGreen} с, maxGreen = ${run.params.adaptive.maxGreen} с; ${ad.perJunction[0].id} қиылысында ${ad.perJunction[0].switches} фаза ауысуы болды.`);
    return { title: 'Формула нені білдіреді?', bullets, conclusion: 'Формулалар — модельдің құрамдас бөлігі; олардың параметрлері нақты өлшеулермен калибрленуі тиіс.' };
  }
  if (q === 'trust') {
    const bullets: string[] = [];
    if (run) {
      const res = [run.results.fixed, run.results.adaptive].filter(Boolean) as SimResult[];
      const viol = res.reduce((a, r) => a + r.conflictViolations + r.redViolations, 0);
      bullets.push(viol === 0 ? 'Қауіпсіздік инварианттары сақталды: қақтығысатын фазалар бір мезгілде қиылыста болмады, қызылға өту тіркелмеді.' : `Инвариант бұзылуы тіркелді (${viol}) — модельді тексеру қажет.`);
      for (const r of res) {
        const sh = r.unfinished / Math.max(1, r.generated);
        if (sh > 0.1) bullets.push(`${MODE_LABEL[r.mode]}: аяқталмаған сапар ${fmt(sh * 100, 1)}% — орташа күту тек аяқталғандар бойынша есептелген, нақты күту жоғары болуы мүмкін.`);
        if (r.overloaded) bullets.push(`${MODE_LABEL[r.mode]}: симуляция жүктеме шегінен асып тоқтады.`);
      }
      bullets.push(`Бір іске қосу = бір seed (${run.params.seed}). Нәтиже кездейсоқ келу тізбегіне тәуелді.`);
    }
    if (ctx.analysis) bullets.push(`Жұптық талдау: n = ${ctx.analysis.n}. ${ctx.analysis.cautions.join(' ')}`);
    bullets.push('Модель калибрленбеген: желі — шартты схема, параметрлер — оқу баптаулары, Меркі қаласының нақты өлшеулері емес.');
    return { title: 'Нәтижеге сенуге бола ма?', bullets, conclusion: 'Нәтиже модель ішіндегі салыстыру ретінде сенімді (қайталанады, бірдей сұраныс); нақты қала туралы қорытынды үшін далалық бақылау қажет.' };
  }
  return null;
}

/** LLM-ге жіберілетін ықшам контекст (жеке деректерсіз). */
export function compactContext(ctx: ExplainContext) {
  const pick = (r?: SimResult) =>
    r && {
      mode: r.mode,
      generated: r.generated,
      completed: r.completed,
      unfinished: r.unfinished,
      avgWait: r.avgWait,
      avgQueue: r.avgQueue,
      maxQueue: r.maxQueue,
      throughputPerHour: r.throughputPerHour,
      avgTravel: r.avgTravel,
      overloaded: r.overloaded,
    };
  return {
    params: ctx.run
      ? {
          network: ctx.run.params.network,
          seed: ctx.run.params.seed,
          duration: ctx.run.params.duration,
          ratePerApproach: ctx.run.params.ratePerApproach,
          mainShare: ctx.run.params.mainShare,
          profile: ctx.run.params.profile,
          truckShare: ctx.run.params.truckShare,
          fixed: ctx.run.params.fixed,
          adaptive: ctx.run.params.adaptive,
        }
      : null,
    fixed: pick(ctx.run?.results.fixed),
    adaptive: pick(ctx.run?.results.adaptive),
    paired: ctx.analysis
      ? { n: ctx.analysis.n, meanDiff: ctx.analysis.diff.mean, ci95: ctx.analysis.diff.ci95, test: ctx.analysis.primary, p: ctx.analysis.pPrimary, significant: ctx.analysis.significant }
      : null,
  };
}
