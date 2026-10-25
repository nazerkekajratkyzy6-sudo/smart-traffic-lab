/** Қазақ тіліндегі A4 PDF ғылыми есеп (jsPDF + енгізілген DejaVu Sans қаріпі). */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { LastRun } from './store';
import type { ExperimentResult } from '../core/experiments';
import { aggregate, EXPERIMENTS } from '../core/experiments';
import type { PairedAnalysis } from './analysis';
import type { SimResult } from '../core/engine';
import { improvementPct } from '../core/engine';
import { MODEL_VERSION, ALGO_VERSION } from '../core/version';
import { scenarioId } from '../core/scenario';
import { pEq } from '../core/stats';
import { fmt, MODE_LABEL } from './format';

export interface ReportInput {
  run: LastRun | null;
  exp: ExperimentResult | null;
  analysis: PairedAnalysis | null;
  includeAuthor: boolean;
  url: string;
}

const W = 210;
const H = 297;
const M = 18;
const CW = W - 2 * M;
const BLUE: [number, number, number] = [15, 95, 168];
const TEAL: [number, number, number] = [14, 127, 120];
const GREY: [number, number, number] = [107, 122, 140];
const INK: [number, number, number] = [28, 37, 48];
const MODE_RGB = { fixed: GREY, adaptive: TEAL };

async function loadFont(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Қаріп жүктелмеді: ${url}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

class Doc {
  d: jsPDF;
  y = M;
  page = 1;
  constructor(d: jsPDF) {
    this.d = d;
  }
  ensure(h: number) {
    if (this.y + h > H - M - 8) {
      this.footer();
      this.d.addPage();
      this.page++;
      this.y = M;
    }
  }
  footer() {
    const d = this.d;
    d.setFont('DejaVu', 'normal');
    d.setFontSize(8);
    d.setTextColor(...GREY);
    d.text(`SMART TRAFFIC LAB · ${MODEL_VERSION}`, M, H - 10);
    d.text(`${this.page}`, W - M, H - 10, { align: 'right' });
  }
  h1(t: string, width = CW) {
    this.ensure(14);
    this.d.setFont('DejaVu', 'bold');
    this.d.setFontSize(17);
    this.d.setTextColor(...INK);
    const lines = this.d.splitTextToSize(t, width);
    this.d.text(lines, M, this.y + 6);
    this.y += 7.5 * lines.length + 3;
  }
  h2(t: string) {
    this.ensure(14);
    this.y += 3;
    this.d.setFont('DejaVu', 'bold');
    this.d.setFontSize(12.5);
    this.d.setTextColor(...BLUE);
    this.d.text(t, M, this.y + 5);
    this.y += 9;
  }
  p(t: string, size = 10, color: [number, number, number] = INK, bold = false) {
    this.d.setFont('DejaVu', bold ? 'bold' : 'normal');
    this.d.setFontSize(size);
    this.d.setTextColor(...color);
    const lines: string[] = this.d.splitTextToSize(t, CW);
    const lh = size * 0.47;
    for (const ln of lines) {
      this.ensure(lh + 1);
      this.d.text(ln, M, this.y + lh);
      this.y += lh;
    }
    this.y += 2;
  }
  bullet(t: string) {
    this.d.setFont('DejaVu', 'normal');
    this.d.setFontSize(10);
    this.d.setTextColor(...INK);
    const lines: string[] = this.d.splitTextToSize(t, CW - 6);
    lines.forEach((ln, i) => {
      this.ensure(5.5);
      if (i === 0) this.d.text('•', M + 1, this.y + 4.7);
      this.d.text(ln, M + 6, this.y + 4.7);
      this.y += 4.7;
    });
    this.y += 1;
  }
  table(head: string[], rows: (string | number)[][], widths?: number[], alignRight: boolean[] = []) {
    const d = this.d;
    const ws = widths ?? head.map(() => CW / head.length);
    const fs = 8.6;
    d.setFontSize(fs);
    const rowH = (cells: (string | number)[], bold: boolean) => {
      d.setFont('DejaVu', bold ? 'bold' : 'normal');
      return Math.max(...cells.map((c, i) => (d.splitTextToSize(String(c), ws[i] - 3) as string[]).length)) * 3.9 + 2.6;
    };
    const draw = (cells: (string | number)[], bold: boolean, fill?: [number, number, number]) => {
      const h = rowH(cells, bold);
      this.ensure(h);
      let x = M;
      if (fill) {
        d.setFillColor(...fill);
        d.rect(M, this.y, CW, h, 'F');
      }
      d.setFont('DejaVu', bold ? 'bold' : 'normal');
      d.setFontSize(fs);
      d.setTextColor(...INK);
      cells.forEach((c, i) => {
        const lines = d.splitTextToSize(String(c), ws[i] - 3) as string[];
        lines.forEach((ln, k) => {
          if (alignRight[i]) d.text(ln, x + ws[i] - 1.5, this.y + 4.2 + k * 3.9, { align: 'right' });
          else d.text(ln, x + 1.5, this.y + 4.2 + k * 3.9);
        });
        x += ws[i];
      });
      d.setDrawColor(223, 229, 236);
      d.line(M, this.y + h, M + CW, this.y + h);
      this.y += h;
    };
    draw(head, true, [241, 244, 248]);
    rows.forEach((r) => draw(r, false));
    this.y += 4;
  }
  barChart(title: string, groups: string[], series: { name: string; color: [number, number, number]; values: number[] }[], unit: string) {
    const d = this.d;
    const h = 62;
    this.ensure(h + 12);
    d.setFont('DejaVu', 'bold');
    d.setFontSize(10);
    d.setTextColor(...INK);
    d.text(title, M, this.y + 4);
    const top = this.y + 8;
    const left = M + 12;
    const width = CW - 14;
    const ch = h - 18;
    const max = Math.max(1e-9, ...series.flatMap((s) => s.values.filter(Number.isFinite)));
    const nice = niceMax(max);
    d.setDrawColor(223, 229, 236);
    d.setFont('DejaVu', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...GREY);
    for (let i = 0; i <= 4; i++) {
      const yy = top + ch - (ch * i) / 4;
      d.line(left, yy, left + width, yy);
      d.text(fmt((nice * i) / 4, nice < 10 ? 1 : 0), left - 2, yy + 1.2, { align: 'right' });
    }
    const gw = width / groups.length;
    const bw = Math.min(14, (gw * 0.7) / series.length);
    groups.forEach((g, gi) => {
      const gx = left + gi * gw + (gw - bw * series.length) / 2;
      series.forEach((s, si) => {
        const v = s.values[gi];
        if (!Number.isFinite(v)) return;
        const bh = (ch * v) / nice;
        d.setFillColor(...s.color);
        d.rect(gx + si * bw, top + ch - bh, bw - 1, bh, 'F');
        d.setTextColor(...INK);
        d.setFontSize(6.8);
        d.text(fmt(v, v < 10 ? 1 : 0), gx + si * bw + (bw - 1) / 2, top + ch - bh - 1, { align: 'center' });
      });
      d.setFontSize(7.5);
      d.setTextColor(...GREY);
      d.text(d.splitTextToSize(g, gw - 2) as string[], left + gi * gw + gw / 2, top + ch + 4, { align: 'center' });
    });
    // аңыз
    let lx = left;
    series.forEach((s) => {
      d.setFillColor(...s.color);
      d.rect(lx, top + ch + 10, 3, 3, 'F');
      d.setTextColor(...INK);
      d.setFontSize(7.5);
      d.text(s.name, lx + 4.5, top + ch + 12.6);
      lx += d.getTextWidth(s.name) + 12;
    });
    d.setTextColor(...GREY);
    d.text(unit, left + width, top + ch + 12.6, { align: 'right' });
    this.y += h + 6;
  }
  lineChart(title: string, series: { name: string; color: [number, number, number]; pts: { t: number; v: number }[] }[]) {
    const d = this.d;
    const h = 58;
    this.ensure(h + 8);
    d.setFont('DejaVu', 'bold');
    d.setFontSize(10);
    d.setTextColor(...INK);
    d.text(title, M, this.y + 4);
    const top = this.y + 8;
    const left = M + 12;
    const width = CW - 14;
    const ch = h - 20;
    const tMax = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p.t)));
    const vMax = niceMax(Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p.v))));
    d.setDrawColor(223, 229, 236);
    d.setFont('DejaVu', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(...GREY);
    for (let i = 0; i <= 4; i++) {
      const yy = top + ch - (ch * i) / 4;
      d.line(left, yy, left + width, yy);
      d.text(fmt((vMax * i) / 4, 0), left - 2, yy + 1.2, { align: 'right' });
    }
    for (let i = 0; i <= 6; i++) d.text(`${Math.round((tMax * i) / 6 / 60)}`, left + (width * i) / 6, top + ch + 4, { align: 'center' });
    d.text('мин', left + width, top + ch + 8, { align: 'right' });
    series.forEach((s) => {
      d.setDrawColor(...s.color);
      d.setLineWidth(0.5);
      for (let i = 1; i < s.pts.length; i++) {
        const a = s.pts[i - 1];
        const b = s.pts[i];
        d.line(left + (width * a.t) / tMax, top + ch - (ch * a.v) / vMax, left + (width * b.t) / tMax, top + ch - (ch * b.v) / vMax);
      }
    });
    d.setLineWidth(0.2);
    let lx = left;
    series.forEach((s) => {
      d.setFillColor(...s.color);
      d.rect(lx, top + ch + 9, 3, 3, 'F');
      d.setTextColor(...INK);
      d.text(s.name, lx + 4.5, top + ch + 11.6);
      lx += d.getTextWidth(s.name) + 12;
    });
    this.y += h + 6;
  }
}

function niceMax(x: number) {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

function resultRows(results: SimResult[]) {
  const lab: [string, (r: SimResult) => string][] = [
    ['Келген көлік', (r) => String(r.generated)],
    ['Аяқталған сапар', (r) => String(r.completed)],
    ['Аяқталмаған (желіде/кезекте)', (r) => `${r.unfinished} (күту ${fmt(r.unfinishedAvgWait, 1)} с)`],
    ['Орташа күту, с', (r) => fmt(r.avgWait, 2)],
    ['Негізгі / қосалқы көше күтуі, с', (r) => `${fmt(r.avgWaitMain, 1)} / ${fmt(r.avgWaitSide, 1)}`],
    ['Орташа кезек, авт.', (r) => fmt(r.avgQueue, 2)],
    ['Ең үлкен кезек, авт.', (r) => String(r.maxQueue)],
    ['Өткізу, авт./сағ', (r) => fmt(r.throughputPerHour, 0)],
    ['Орташа сапар уақыты, с', (r) => fmt(r.avgTravel, 1)],
    ['Жүктеме шегінен асты', (r) => (r.overloaded ? 'иә' : 'жоқ')],
  ];
  return lab.map(([k, f]) => [k, ...results.map(f)]);
}

export async function buildReport(inp: ReportInput): Promise<Blob> {
  const d = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const [reg, bold] = await Promise.all([loadFont(`${import.meta.env.BASE_URL}fonts/DejaVuSans-sub.ttf`), loadFont(`${import.meta.env.BASE_URL}fonts/DejaVuSans-Bold-sub.ttf`)]);
  d.addFileToVFS('DejaVuSans.ttf', reg);
  d.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  d.addFileToVFS('DejaVuSans-Bold.ttf', bold);
  d.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  d.setFont('DejaVu', 'normal');
  d.setProperties({ title: 'SMART TRAFFIC LAB — ғылыми есеп', subject: 'Жол қозғалысын математикалық модельдеу', creator: 'SMART TRAFFIC LAB' });
  const doc = new Doc(d);
  const now = new Date();

  // тақырып блогы
  d.setFillColor(...BLUE);
  d.rect(0, 0, W, 6, 'F');
  doc.y = 14;
  const hasQr = /^https:\/\/\S+$/.test(inp.url.trim());
  doc.p('SMART TRAFFIC LAB · Ақылды қаланың математикалық зертханасы', 9, BLUE, true);
  doc.h1('Ғылыми есеп: жол қозғалысын басқарудың математикалық модельдерін компьютерлік тексеру', hasQr ? CW - 32 : CW);
  doc.p('Зерттеу тақырыбы: «Ақылды қала жағдайында жол қозғалысын тиімді басқарудың математикалық модельдері»', 10);
  if (inp.includeAuthor) doc.p('Орындаған: Қадырбек Жанель Әділханқызы, 7 «А» сынып. Ғылыми жетекші: Ашимханова Фаруза Турсынбековна.', 10);
  doc.p(`Күні: ${now.toLocaleDateString('kk-KZ')} ${now.toLocaleTimeString('kk-KZ')} · Модель: ${MODEL_VERSION} · Алгоритмдер: ${ALGO_VERSION.fixed}; ${ALGO_VERSION.adaptive}`, 8.5, GREY);

  let qrDrawn = false;
  if (hasQr) {
    try {
      const data = await QRCode.toDataURL(inp.url.trim(), { margin: 1, width: 256 });
      d.addImage(data, 'PNG', W - M - 24, 12, 24, 24);
      d.setFontSize(6.5);
      d.setTextColor(...GREY);
      d.text('Жарияланған нұсқа', W - M - 12, 39, { align: 'center' });
      qrDrawn = true;
    } catch {
      qrDrawn = false;
    }
  }
  if (qrDrawn && doc.y < 42) doc.y = 42;

  doc.h2('1. Мақсаты және гипотеза');
  doc.p('Мақсаты — жол қозғалысының қайталанатын компьютерлік моделін құрып, бағдаршамды адаптивті басқарудың тиімділігі туралы гипотезаны бірдей сұраныс жағдайында тексеру.');
  doc.p('Гипотеза: егер бағдаршамды басқаруда адаптивті ереже қолданылса, тұрақты циклмен салыстырғанда орташа күту уақыты мен кезек ұзындығы азаяды.');

  doc.h2('2. Әдістеме');
  [
    'Қадамдық микросимуляция (Δt қадамы), шартты жол желісі: бір қиылыс немесе негізгі көшедегі үш қиылысты дәліз. Әр кіреберісте 2 жолақ: солға бұрылу және тура/оңға.',
    'Көліктер келуі — бекітілген seed бар Пуассон ағыны (немесе тұрақты аралық); жүру — қауіпсіз арақашықтықты сақтайтын көлік соңынан еру моделі, жылдамдық және өткізу шектеулері бар.',
    'Тұрақты басқару: 4 фазалы цикл (тура/оңға және солға бұрылу фазалары), сары және «бәрі қызыл» аралықтары.',
    'Адаптивті басқару: әр фаза үшін S_i = N_i + α·W_i; minGreen өткен соң ең үлкен S бар фазаға ауысу; maxGreen және maxRed шектеулері аштықтан қорғайды.',
    'Қауіпсіздік: қақтығысатын фазалардың көліктері қиылыста бір мезгілде болмайды; қызылда стоп-сызықтан өтуге болмайды.',
    'Салыстыру: екі режим бір seed пен бірдей келу оқиғаларымен тәуелсіз ядроларда орындалады; көп seed кезінде жұптық айырмалар талданады.',
    'Метрикалар: орташа күту = аяқталған сапарлардағы қозғалыссыз уақыт / аяқталған сапар саны; кезек — уақыт бойынша орташа; өткізу — сағатына аяқталған сапар.',
  ].forEach((b) => doc.bullet(b));

  const p = inp.run?.params ?? inp.exp?.runs[0]?.params;
  if (p) {
    doc.h2('3. Бастапқы параметрлер');
    doc.table(
      ['Параметр', 'Мәні'],
      [
        ['Желі', p.network === 'corridor' ? 'үш қиылысты дәліз (шартты)' : 'бір қиылыс (шартты)'],
        ['Seed', inp.exp ? `${inp.exp.baseSeed} … ${inp.exp.baseSeed + inp.exp.repeats - 1} (${inp.exp.repeats} қайталау)` : String(p.seed)],
        ['Ұзақтығы / қадам Δt', `${p.duration} с / ${p.dt} с`],
        ['Қарқындылық (бір кіру бағытына)', `${p.ratePerApproach} авт./сағ; негізгі/қосалқы үлесі ${Math.round(p.mainShare * 100)}/${Math.round((1 - p.mainShare) * 100)}`],
        ['Сұраныс профилі / келу моделі', `${p.profile === 'peak' ? `шың ×${p.peakFactor}` : 'біркелкі'} / ${p.arrivals === 'poisson' ? 'Пуассон' : 'тұрақты аралық'}`],
        ['Жүк көліктері', `${Math.round(p.truckShare * 100)}%, ${p.truckSpeedKmh} км/сағ`],
        ['Тұрақты цикл', `жасыл ${p.fixed.green} с, солға ${p.fixed.greenLeft} с, сары ${p.signal.yellow} с, бәрі қызыл ${p.signal.allRed} с`],
        ['Адаптивті', `α = ${p.adaptive.alpha}, minGreen ${p.adaptive.minGreen} с, maxGreen ${p.adaptive.maxGreen} с, maxRed ${p.adaptive.maxRed} с, детектор ${p.adaptive.detector} м`],
        ['Сценарий ID', inp.run ? scenarioId(inp.run.params) : (inp.exp?.runs[0]?.scenarioId ?? '—')],
      ],
      [62, CW - 62],
    );
  }

  doc.h2('4. Нәтижелер');
  doc.p('Дерек түрі: симуляция нәтижесі (модельдік). Бастапқы зерттеудегі кестелік мәндер бұл бөлімге енгізілмеген.', 8.5, GREY);
  if (inp.run) {
    const res = (['fixed', 'adaptive'] as const).filter((m) => inp.run!.results[m]).map((m) => inp.run!.results[m]!) as SimResult[];
    doc.p(`4.1. Интерактивті іске қосу (${inp.run.source === 'city' ? 'Ақылды қала' : 'Бағдаршам зертханасы'}, ${new Date(inp.run.at).toLocaleString('kk-KZ')})`, 10, INK, true);
    doc.table(['Көрсеткіш', ...res.map((r) => MODE_LABEL[r.mode])], resultRows(res), [80, ...res.map(() => (CW - 80) / res.length)], [false, true, true]);
    if (res.length === 2) {
      const imp = improvementPct(res[0].avgWait, res[1].avgWait);
      if (imp !== null) doc.p(`Күтуді жақсарту (бір seed, бірдей сұраныс): (W_fixed − W_adaptive)/W_fixed·100% = ${fmt(imp, 1)}%. Бір іске асу статистикалық қорытындыға жеткіліксіз.`, 9);
      doc.barChart(
        'Режимдерді салыстыру',
        ['Орташа күту, с', 'Орташа кезек, авт.', 'Ең үлкен кезек'],
        res.map((r) => ({ name: MODE_LABEL[r.mode], color: MODE_RGB[r.mode], values: [r.avgWait, r.avgQueue, r.maxQueue] })),
        '',
      );
    }
    doc.lineChart(
      'Тоқтаған көліктер саны уақыт бойынша',
      res.map((r) => ({ name: MODE_LABEL[r.mode], color: MODE_RGB[r.mode], pts: r.series.map((s) => ({ t: s.t, v: s.queue })) })),
    );
  }
  if (inp.exp && !inp.exp.routing) {
    const def = EXPERIMENTS.find((e) => e.id === inp.exp!.experiment);
    const agg = aggregate(inp.exp);
    doc.p(`4.2. Тәжірибе ${inp.exp.experiment} «${inp.exp.title}» — ${inp.exp.runs.length} симуляция (${new Date(inp.exp.createdAt).toLocaleString('kk-KZ')})`, 10, INK, true);
    if (def) doc.p(def.description, 9);
    doc.table(
      ['Нұсқа', 'Режим', 'n', 'Күту, с (орт. ± SD)', 'Кезек', 'Өткізу/сағ', 'Аяқталмаған'],
      agg.map((a) => [a.variant, MODE_LABEL[a.mode], a.n, `${fmt(a.means.avgWait, 1)} ± ${fmt(a.sds.avgWait, 1)}`, fmt(a.means.avgQueue, 1), fmt(a.means.throughputPerHour, 0), fmt(a.means.unfinished, 0)]),
      [32, 24, 10, 36, 22, 25, CW - 149],
      [false, false, true, true, true, true, true],
    );
    const variants = [...new Set(agg.map((a) => a.variant))];
    const modes = [...new Set(agg.map((a) => a.mode))];
    doc.barChart(
      'Орташа күту уақыты нұсқалар бойынша',
      variants,
      modes.map((m) => ({ name: MODE_LABEL[m], color: MODE_RGB[m], values: variants.map((v) => agg.find((a) => a.variant === v && a.mode === m)?.means.avgWait ?? NaN) })),
      'с',
    );
  }
  if (inp.exp?.routing) {
    doc.p(`4.2. Тәжірибе ${inp.exp.experiment} «${inp.exp.title}» (граф — оқу мысалы)`, 10, INK, true);
    doc.table(
      ['Жұп', 'Маршрут', 'Қашықтық, км', 'Уақыт, мин', 'Қысқа ≠ жылдам'],
      inp.exp.routing.map((r) => [`${r.from}→${r.to}`, r.path.join('–'), fmt(r.distance, 1), fmt(r.time, 1), r.differs ? `иә (${r.shortestByDistance.join('–')} / ${r.fastestByTime.join('–')})` : 'жоқ']),
      [18, 32, 26, 24, CW - 100],
    );
  }
  if (!inp.run && !inp.exp) doc.p('Нәтиже таңдалмаған.');

  doc.h2('5. Статистикалық талдау');
  const an = inp.analysis;
  if (an && inp.exp) {
    doc.table(
      ['Көрсеткіш', 'Мәні'],
      [
        ['Жұптар саны (seed)', String(an.n)],
        ['Тұрақты: орташа ± SD', `${fmt(an.fixed.mean, 2)} ± ${fmt(an.fixed.sd, 2)}`],
        ['Адаптивті: орташа ± SD', `${fmt(an.adaptive.mean, 2)} ± ${fmt(an.adaptive.sd, 2)}`],
        ['Айырма (тұрақты − адаптивті): орташа, 95% СА', `${fmt(an.diff.mean, 2)}; ${an.diff.ci95 ? `[${fmt(an.diff.ci95[0], 2)}; ${fmt(an.diff.ci95[1], 2)}]` : '—'}`],
        ['Жұптық t-тест', an.t ? `t = ${fmt(an.t.t, 3)}, df = ${an.t.df}, ${pEq(an.t.p)}` : '—'],
        ['Уилкоксон', an.w ? `W⁺ = ${fmt(an.w.W, 1)}, ${pEq(an.w.p)}` : '—'],
        ['Шапиро–Уилк (айырмалар)', an.normal ? `W = ${fmt(an.normal.W, 3)}, ${pEq(an.normal.p)}` : '—'],
        ['Негізгі критерий', an.primary === 'paired-t' ? 'жұптық t-тест' : an.primary === 'wilcoxon' ? 'Уилкоксон' : '—'],
      ],
      [80, CW - 80],
    );
    an.cautions.forEach((c) => doc.bullet(c));
  } else doc.p('Жұптық көп seed-ті талдау таңдалмаған. Бір іске қосу негізінде статистикалық маңыздылық туралы қорытынды жасалмайды.');
  doc.p('Бастапқы зерттеудегі 2×2 кесте ([[1,2],[3,0]]) бойынша қайта есептеу: Пирсон χ² = 3,00, p ≈ 0,083; күтілетін жиіліктер 5-тен кіші, Фишердің нақты тесті p = 0,40. Бұл кесте байланыстың статистикалық дәлелі бола алмайды.', 9);

  doc.h2('6. Шектеулер');
  [
    'Жол желісі — шартты схема, Меркі қаласының нақты картасы емес; параметрлер (жылдамдық, бұрылыс үлесі, қанығу ағыны) — оқу баптаулары, калибрленбеген.',
    'Жаяу жүргіншілер, қоғамдық көлік, жол-көлік оқиғалары, жолақ ауыстыру модельденбеген.',
    'Бастапқы зерттеудегі кестелік мәндер — оқу мысалы; олар симулятордың нәтижесі ретінде пайдаланылмайды.',
    'Симулятор нақты жол инфрақұрылымын басқармайды және оған команда жібермейді.',
  ].forEach((b) => doc.bullet(b));

  doc.h2('7. Қорытынды');
  if (an) doc.p(an.verdict);
  else if (inp.run?.results.fixed && inp.run.results.adaptive) {
    const f = inp.run.results.fixed;
    const a = inp.run.results.adaptive;
    doc.p(
      `Бір seed-пен жүргізілген салыстыруда орташа күту ${fmt(f.avgWait, 1)} с (тұрақты) және ${fmt(a.avgWait, 1)} с (адаптивті) болды. Бұл — бір кездейсоқ іске асудың нәтижесі; гипотезаны статистикалық тексеру үшін көп seed-ті тәжірибе (E10) қажет.`,
    );
  } else doc.p('Қорытынды жасау үшін екі режимді салыстыратын нәтиже қажет.');
  doc.p('Есептегі барлық сандар осы бағдарламада есептелген және сценарий ID арқылы қайта шығарылады.', 8.5, GREY);
  doc.footer();
  return d.output('blob');
}
