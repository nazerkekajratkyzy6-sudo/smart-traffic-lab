/** Он тәжірибенің оқушыға арналған мәтіндері және нәтижеден құрылатын қорытынды. */
import { ExperimentResult, aggregate, AggregateRow } from '../core/experiments';
import { analyzePairs } from './analysis';
import { fmt } from './format';
import { pEq } from '../core/stats';

export interface Choice {
  v: string;
  t: string;
}

export interface ExpContent {
  id: string;
  short: string; // карточкадағы атау
  line: string; // бір жолдық сипаттама
  goal: string; // 1-қадам
  question: string; // 2-қадам
  choices: Choice[];
  watch: string; // 3-қадамдағы кеңес
}

export const EXP_CONTENT: Record<string, ExpContent> = {
  E01: {
    id: 'E01',
    short: 'Көлік көбейсе не болады?',
    line: '100, 300, 600, 900 көлік/сағ — кезек қалай өседі',
    goal: 'Қиылысқа келетін көлік саны артқанда кезек ұзындығы мен күту уақыты қалай өзгеретінін анықтаймыз. Тәжірибе екі бағдаршамда да жүргізіледі.',
    question: 'Көлік саны 100-ден 900-ге дейін өссе, кезек қалай өзгереді?',
    choices: [
      { v: 'linear', t: 'Біртіндеп, бірқалыпты өседі' },
      { v: 'jump', t: 'Бір шектен кейін күрт өседі' },
      { v: 'same', t: 'Іс жүзінде өзгермейді' },
    ],
    watch: 'Көлік көбейгенде қызыл сигнал алдындағы кезекке қара.',
  },
  E02: {
    id: 'E02',
    short: 'Екі бағдаршамды салыстыру',
    line: 'Бірдей көлік ағынында қай бағдаршам жақсы',
    goal: 'Қарапайым (тұрақты) және ақылды (адаптивті) бағдаршамды бірдей жағдайда салыстырамыз: көліктер саны, уақыты және кездейсоқ оқиғалар бірдей.',
    question: 'Қай бағдаршамда көліктер азырақ күтеді?',
    choices: [
      { v: 'adaptive', t: 'Ақылды бағдаршамда' },
      { v: 'fixed', t: 'Қарапайым бағдаршамда' },
      { v: 'same', t: 'Айырмашылық болмайды' },
    ],
    watch: 'Ақылды бағдаршам бос бағытқа жасылды ұзақ ұстай ма — соны бақыла.',
  },
  E03: {
    id: 'E03',
    short: 'Жасыл қанша секунд болуы керек?',
    line: 'Қарапайым бағдаршам: жасыл 15 / 30 / 45 / 60 с',
    goal: 'Қарапайым бағдаршамда жасыл сигналдың ұзақтығын өзгертіп, күту уақытына әсерін анықтаймыз.',
    question: 'Жасыл сигнал қандай болғанда көліктер ең аз күтеді?',
    choices: [
      { v: 'shorter', t: 'Қысқа жасыл (15 с)' },
      { v: 'middle', t: 'Орташа жасыл (30–45 с)' },
      { v: 'longer', t: 'Ұзын жасыл (60 с)' },
    ],
    watch: 'Жасыл ұзарғанда басқа бағыттағы көліктер қанша күтетініне назар аудар.',
  },
  E04: {
    id: 'E04',
    short: 'Таңертеңгі қарбалас',
    line: 'Шың кезінде үш қиылысты көше қалай жұмыс істейді',
    goal: 'Таңертеңгі шың кезінде (көлік саны уақытша екі есе өседі) үш қиылысты көшеде қай бағдаршам кезекті жақсырақ ұстайтынын тексереміз.',
    question: 'Қарбалас уақытта қай бағдаршамда ең үлкен кезек кішірек болады?',
    choices: [
      { v: 'adaptive', t: 'Ақылды бағдаршамда' },
      { v: 'fixed', t: 'Қарапайым бағдаршамда' },
      { v: 'same', t: 'Бірдей болады' },
    ],
    watch: 'Шың кезінде кезектің қай қиылыста көбірек жиналатынын бақыла.',
  },
  E05: {
    id: 'E05',
    short: 'Негізгі және қосалқы көше',
    line: 'Ағын 50/50 және 80/20 болғанда әділдік',
    goal: 'Негізгі көшеде көлік әлдеқайда көп (80/20) болғанда қосалқы көшедегі көліктердің күтуі қалай өзгеретінін анықтаймыз.',
    question: 'Ағын 80/20 болғанда қосалқы көшедегі көліктер негізгі көшедегілерден көбірек күте ме?',
    choices: [
      { v: 'yes', t: 'Иә, көбірек күтеді' },
      { v: 'no', t: 'Жоқ, азырақ немесе бірдей' },
    ],
    watch: 'Қосалқы көшедегі (жоғары-төмен) кезектерге қара.',
  },
  E06: {
    id: 'E06',
    short: 'Ең қысқа жол',
    line: 'Дейкстра алгоритмі: қашықтығы ең аз маршрут',
    goal: 'A, B, C, D нүктелері арасындағы барлық жұп үшін ең қысқа жолды (километр бойынша) Дейкстра алгоритмімен табамыз.',
    question: 'Ең қысқа жол әрқашан ең жылдам жол бола ма?',
    choices: [
      { v: 'yes', t: 'Иә, әрқашан' },
      { v: 'no', t: 'Жоқ, кейде басқа жол жылдамырақ' },
    ],
    watch: 'Әр жұп үшін алгоритм қай жолды таңдағанына қара.',
  },
  E07: {
    id: 'E07',
    short: 'Ең жылдам жол',
    line: 'Дейкстра алгоритмі: уақыты ең аз маршрут',
    goal: 'Әр жолдың жылдамдығын ескеріп, уақыты ең аз маршрутты табамыз және оны ең қысқа маршрутпен салыстырамыз.',
    question: 'Ең жылдам жол әрқашан ең қысқа жол бола ма?',
    choices: [
      { v: 'yes', t: 'Иә, әрқашан' },
      { v: 'no', t: 'Жоқ, кейде ұзын жол жылдамырақ' },
    ],
    watch: 'Жылдамдығы жоғары жол ұзын болса да ұтымды бола ма?',
  },
  E08: {
    id: 'E08',
    short: 'Жол көтере алмаса',
    line: '700 / 850 / 1000 көлік/сағ — шамадан тыс жүктеме',
    goal: 'Қиылыстың өткізу қабілетіне жақын және одан асатын ағынды тексереміз: үлгермеген көліктер бөлек есептеледі.',
    question: 'Көлік ағыны қиылыстың мүмкіндігінен асса не болады?',
    choices: [
      { v: 'queue', t: 'Кезек тоқтамай өседі, көліктер үлгермейді' },
      { v: 'ok', t: 'Бағдаршам бәрін өткізіп үлгереді' },
    ],
    watch: 'Жол шетіндегі «+N» белгісі — желіге кіре алмай күтіп тұрған көліктер.',
  },
  E09: {
    id: 'E09',
    short: 'Жүк көліктері',
    line: 'Баяу транзиттік жүк көліктері: 0 / 15 / 30 %',
    goal: 'Негізгі көшедегі баяу (35 км/сағ) жүк көліктерінің барлық көліктің сапар уақытына әсерін анықтаймыз.',
    question: 'Жүк көліктері көбейсе, көліктердің орташа сапар уақыты арта ма?',
    choices: [
      { v: 'yes', t: 'Иә, артады' },
      { v: 'no', t: 'Жоқ, өзгермейді' },
    ],
    watch: 'Ұзын жасыл-көк жүк көліктерінің артындағы көліктерге қара.',
  },
  E10: {
    id: 'E10',
    short: '30 рет қайталау',
    line: 'Нәтиже кездейсоқ емес екенін статистикамен тексеру',
    goal: 'Екі бағдаршамды 30 түрлі кездейсоқ жағдайда (seed) салыстырып, айырмашылық тұрақты ма, жоқ па — статистикамен тексереміз.',
    question: 'Ақылды бағдаршамның нәтижесі кездейсоқ па, әлде қайталана ма?',
    choices: [
      { v: 'stable', t: '30 тәжірибеде де қайталанады' },
      { v: 'random', t: 'Кездейсоқ болуы мүмкін' },
    ],
    watch: 'Бір тәжірибенің нәтижесі кездейсоқ болуы мүмкін — сондықтан 30 рет қайталаймыз.',
  },
};

export interface Conclusion {
  headline: string;
  bullets: string[];
  answer: string | null; // нәтиже бойынша дұрыс жауап (choices.v)
}

const modeName = { fixed: 'қарапайым', adaptive: 'ақылды' } as const;

function rows(res: ExperimentResult) {
  return aggregate(res);
}
function get(a: AggregateRow[], variantIndex: number, mode: 'fixed' | 'adaptive') {
  return a.find((r) => r.variantIndex === variantIndex && r.mode === mode);
}

export function conclude(res: ExperimentResult): Conclusion {
  const id = res.experiment;
  if (res.routing) {
    const diff = res.routing.filter((r) => r.differs);
    const bullets = res.routing.map((r) => `${r.from} → ${r.to}: ${r.path.join('–')} (${fmt(r.distance, 0)} км, ${fmt(r.time, 0)} мин)`);
    if (diff.length) bullets.push(`Айырмашылық: ${diff.map((r) => `${r.from}→${r.to} үшін ең қысқа ${r.shortestByDistance.join('–')}, ал ең жылдам ${r.fastestByTime.join('–')}`).join('; ')}.`);
    return {
      headline: diff.length ? `${diff.length} жұпта ең қысқа жол мен ең жылдам жол әртүрлі болды.` : 'Барлық жұпта ең қысқа жол ең жылдам жолмен сәйкес келді.',
      bullets,
      answer: diff.length ? 'no' : 'yes',
    };
  }
  const a = rows(res);
  const nVar = new Set(a.map((r) => r.variantIndex)).size;
  const bullets: string[] = [];
  let headline = '';
  let answer: string | null = null;
  if (id === 'E01') {
    for (const m of ['fixed', 'adaptive'] as const) {
      const qs = Array.from({ length: nVar }, (_, i) => get(a, i, m)?.means.avgQueue ?? NaN);
      bullets.push(`${modeName[m][0].toUpperCase() + modeName[m].slice(1)} бағдаршам: орташа кезек ${qs.map((q) => fmt(q, 1)).join(' → ')} көлік.`);
    }
    const qf = Array.from({ length: nVar }, (_, i) => get(a, i, 'fixed')?.means.avgQueue ?? 0);
    const growthEarly = (qf[1] + 0.5) / (qf[0] + 0.5);
    const growthLate = (qf[nVar - 1] + 0.5) / (qf[nVar - 2] + 0.5);
    const total = (qf[nVar - 1] + 0.5) / (qf[0] + 0.5);
    answer = total < 1.5 ? 'same' : growthLate > 1.5 * growthEarly ? 'jump' : 'linear';
    headline = answer === 'jump' ? 'Көлік саны белгілі бір шектен асқанда кезек күрт өседі: қиылыс барлық көлікті өткізіп үлгермейді.' : answer === 'linear' ? 'Көлік саны артқан сайын кезек бірқалыпты өседі.' : 'Бұл аралықта кезек іс жүзінде өзгермеді.';
  } else if (id === 'E03') {
    const ws = Array.from({ length: nVar }, (_, i) => get(a, i, 'fixed')?.means.avgWait ?? Infinity);
    const best = ws.indexOf(Math.min(...ws));
    const labels = [15, 30, 45, 60];
    ws.forEach((w, i) => bullets.push(`Жасыл ${labels[i] ?? '?'} с: орташа күту ${fmt(w, 1)} с.`));
    answer = best === 0 ? 'shorter' : best === nVar - 1 ? 'longer' : 'middle';
    headline = `Бұл модельде көліктер жасыл ${labels[best]} с болғанда ең аз күтті (${fmt(ws[best], 1)} с).`;
    bullets.push('Тым ұзын жасыл басқа бағыттарды ұзақ күттіреді, тым қысқа жасыл кезекті тазартып үлгермейді.');
  } else if (id === 'E05') {
    const v = nVar - 1;
    for (const m of ['fixed', 'adaptive'] as const) {
      const r = get(a, v, m);
      if (r) bullets.push(`80/20, ${modeName[m]} бағдаршам: негізгі көше ${fmt(r.means.avgWaitMain, 1)} с, қосалқы көше ${fmt(r.means.avgWaitSide, 1)} с.`);
    }
    const r0 = get(a, v, 'fixed');
    const r1 = get(a, v, 'adaptive');
    const sideMore = [r0, r1].filter(Boolean).filter((r) => r!.means.avgWaitSide > r!.means.avgWaitMain).length;
    answer = sideMore >= 1 ? 'yes' : 'no';
    headline = answer === 'yes' ? 'Негізгі көше ағыны басым болғанда қосалқы көшедегі көліктер көбірек күтті.' : 'Қосалқы көшедегі көліктер негізгі көшедегілерден көп күткен жоқ.';
    bullets.push('Ақылды бағдаршамда maxRed шектеуі қосалқы көшенің шексіз күтуіне жол бермейді.');
  } else if (id === 'E08') {
    const v = nVar - 1;
    for (let i = 0; i < nVar; i++)
      for (const m of ['fixed', 'adaptive'] as const) {
        const r = get(a, i, m);
        if (r) bullets.push(`${r.variant}, ${modeName[m]}: үлгермеген ${fmt(r.means.unfinished, 0)} көлік, келген ${fmt(r.means.generated, 0)}.`);
      }
    const r = get(a, v, 'adaptive') ?? get(a, v, 'fixed');
    const share = r ? r.means.unfinished / Math.max(1, r.means.generated) : 0;
    answer = share > 0.1 ? 'queue' : 'ok';
    headline = answer === 'queue' ? `Ең үлкен ағында көліктердің ${fmt(share * 100, 0)}% жолдан өтіп үлгермеді — кезек тоқтамай өседі.` : 'Барлық нұсқада бағдаршам көліктердің басым бөлігін өткізді.';
  } else if (id === 'E09') {
    for (const m of ['fixed', 'adaptive'] as const) {
      const ts = Array.from({ length: nVar }, (_, i) => get(a, i, m)?.means.avgTravel ?? NaN);
      bullets.push(`${modeName[m][0].toUpperCase() + modeName[m].slice(1)} бағдаршам: орташа сапар ${ts.map((x) => fmt(x, 0)).join(' → ')} с.`);
    }
    const f0 = get(a, 0, 'fixed')?.means.avgTravel ?? 0;
    const f2 = get(a, nVar - 1, 'fixed')?.means.avgTravel ?? 0;
    answer = f2 > f0 * 1.05 ? 'yes' : 'no';
    headline = answer === 'yes' ? 'Баяу жүк көліктері көбейгенде барлық көліктің сапар уақыты артты.' : 'Жүк көліктерінің үлесі сапар уақытын айтарлықтай өзгертпеді.';
  } else {
    // E02, E04, E10 — екі режимді салыстыру
    const vi = id === 'E04' ? nVar - 1 : 0;
    const metric = id === 'E04' ? 'maxQueue' : 'avgWait';
    const f = get(a, vi, 'fixed');
    const ad = get(a, vi, 'adaptive');
    if (f && ad) {
      const unit = metric === 'avgWait' ? 'с' : 'көлік';
      bullets.push(`Қарапайым бағдаршам: ${fmt(f.means[metric], 1)} ${unit}; ақылды бағдаршам: ${fmt(ad.means[metric], 1)} ${unit} (${f.n} қайталау орташасы).`);
      const pct = f.means[metric] > 0 ? ((f.means[metric] - ad.means[metric]) / f.means[metric]) * 100 : 0;
      const an = analyzePairs(res, vi, metric);
      if (an && an.n >= 2) bullets.push(`Статистика: ${an.n} жұп, ${an.primary === 'paired-t' ? 'жұптық t-тест' : 'Уилкоксон критерийі'}, ${an.pPrimary !== null ? pEq(an.pPrimary) : 'p = —'}. ${an.significant ? 'Айырмашылық кездейсоқ емес (α = 0,05).' : 'Айырмашылықты кездейсоқ деп те түсіндіруге болады.'}`);
      const better = Math.abs(pct) < 2 ? 'same' : pct > 0 ? 'adaptive' : 'fixed';
      if (id === 'E10') {
        answer = an?.significant ? 'stable' : 'random';
        headline = an?.significant
          ? `${an?.n ?? 30} қайталауда ақылды бағдаршамның ${pct > 0 ? 'артықшылығы' : 'кемшілігі'} тұрақты қайталанды: орташа күту ${fmt(Math.abs(pct), 0)}%-ға ${pct > 0 ? 'аз' : 'көп'}.`
          : 'Айырмашылық статистикалық тексерістен өтпеді — оны кездейсоқ деп те түсіндіруге болады.';
      } else {
        answer = better;
        headline =
          better === 'same'
            ? 'Екі бағдаршамның нәтижесі іс жүзінде бірдей болды.'
            : better === 'adaptive'
              ? `Бұл тәжірибеде ақылды бағдаршам ${metric === 'avgWait' ? 'күту уақытын' : 'ең үлкен кезекті'} ${fmt(pct, 0)}%-ға азайтты.`
              : `Бұл тәжірибеде ақылды бағдаршам ${metric === 'avgWait' ? 'күту уақытын' : 'ең үлкен кезекті'} ${fmt(-pct, 0)}%-ға арттырды — қарапайым бағдаршам тиімдірек болды.`;
      }
    }
  }
  bullets.push('Бұл — виртуалды тәжірибе: шартты көше және оқу баптаулары, нақты қаланың өлшеуі емес.');
  return { headline, bullets, answer };
}
