import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RLegend, LabelList, ErrorBar } from 'recharts';
import { BrandMark, Icon } from '../components/Icon';
import { TeX, ChoiceGroup } from '../components/common';
import { StageView } from '../components/StageView';
import { fullView, focusView } from '../components/SimCanvas';
import { useSimulation } from '../lib/useSimulation';
import { presetParams, congestion, compareSentence, PACE_SPEED } from '../lib/presets';
import { useStore } from '../lib/store';
import { runInWorker } from '../lib/runner';
import { analyzePairs } from '../lib/analysis';
import { aggregate } from '../core/experiments';
import { SOURCE_FLOW_EXAMPLES, flowRate } from '../core/flow';
import { dijkstra, SEED_GRAPH, allSimplePaths } from '../core/graph';
import { fmt, fmtInt, MODE_COLOR } from '../lib/format';
import type { ControlMode } from '../core/scenario';

/** Проектор/ноутбук экраны: карта көрсеткіштермен бірге бір экранға сыюы үшін биіктікті шектейміз. */
function useViewportHeight() {
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900));
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

const STAGES = ['Тақырып және мақсат', 'Ақылды қала моделі', 'Бағдаршамдарды салыстыру', 'Математикалық есептеу', 'Нәтижелер мен графиктер', 'Қорытынды'];

export default function Defense() {
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0); // қайта бастау үшін кілт
  const rootRef = useRef<HTMLDivElement>(null);
  const go = useCallback((n: number) => setStage(Math.max(0, Math.min(STAGES.length - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(stage + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(stage - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, go]);

  const fullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  };
  const restart = () => {
    setRun((r) => r + 1);
    setStage(0);
  };

  return (
    <div className="defense" ref={rootRef}>
      <div className="defense-top">
        <BrandMark size={30} />
        <b>Қорғау режимі</b>
        <nav className="defense-dots" aria-label="Демонстрация кезеңдері">
          {STAGES.map((t, i) => (
            <button key={t} type="button" aria-current={stage === i ? 'step' : undefined} onClick={() => go(i)} title={t}>
              {i + 1}. <span className="dot-label">{t}</span>
            </button>
          ))}
        </nav>
        <button className="btn btn-sm" onClick={fullscreen}>
          <Icon name="fullscreen" size={16} /> Толық экран
        </button>
        <Link to="/" className="btn btn-sm btn-ghost">
          <Icon name="exit" size={16} /> Шығу
        </Link>
      </div>
      <div className="defense-body">
        <div className="defense-inner" key={run}>
          <div hidden={stage !== 0}>
            <StageTitle onNext={() => go(1)} />
          </div>
          <div hidden={stage !== 1}>
            <StageCity active={stage === 1} />
          </div>
          <div hidden={stage !== 2}>
            <StageCompare active={stage === 2} />
          </div>
          <div hidden={stage !== 3}>
            <StageMath />
          </div>
          <div hidden={stage !== 4}>
            <StageResults />
          </div>
          <div hidden={stage !== 5}>
            <StageConclusion onRestart={restart} />
          </div>
        </div>
      </div>
      <div className="defense-bottom">
        <button className="btn btn-xl" onClick={() => go(stage - 1)} disabled={stage === 0}>
          <Icon name="arrowL" size={20} /> Артқа
        </button>
        <span className="muted" style={{ margin: '0 auto' }}>
          {stage + 1} / {STAGES.length} · {STAGES[stage]}
        </span>
        <button className="btn btn-ghost" onClick={restart}>
          <Icon name="reset" size={18} /> Қайта бастау
        </button>
        <button className="btn btn-primary btn-xl" onClick={() => go(stage + 1)} disabled={stage === STAGES.length - 1}>
          Келесі <Icon name="arrowR" size={20} />
        </button>
      </div>
    </div>
  );
}

function StageTitle({ onNext }: { onNext: () => void }) {
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 1100 }}>
      <div className="eyebrow">«Зерде» ғылыми жоба · Математика және қолданбалы математика</div>
      <h1>Ақылды қала жағдайында жол қозғалысын тиімді басқарудың математикалық модельдері</h1>
      <p className="lead">Қадырбек Жанель Әділханқызы, 7 «А» сынып · Ғылыми жетекші: Ашимханова Фаруза Турсынбековна</p>
      <div className="grid g2">
        <div className="card tint">
          <div className="eyebrow">Мақсат</div>
          <p className="big-statement" style={{ margin: 0 }}>
            Жол қозғалысының компьютерлік моделін құрып, бағдаршамды адаптивті басқарудың тиімділігін тексеру.
          </p>
        </div>
        <div className="card tint">
          <div className="eyebrow">Гипотеза</div>
          <p className="big-statement" style={{ margin: 0 }}>
            Ақылды бағдаршам көлік санына қарай жұмыс істесе, көліктердің күту уақыты мен кезек азаяды.
          </p>
        </div>
      </div>
      <div>
        <button className="btn btn-primary btn-xl" onClick={onNext}>
          <Icon name="play" size={20} /> Демонстрацияны бастау
        </button>
      </div>
    </div>
  );
}

function StageCity({ active }: { active: boolean }) {
  const vh = useViewportHeight();
  const params = useMemo(() => presetParams('corridor', 'mid'), []);
  const modes = useMemo<ControlMode[]>(() => ['adaptive'], []);
  const sim = useSimulation(params, modes, 8, undefined, 90);
  useEffect(() => {
    if (!active) sim.pause();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = sim.sims.adaptive?.kpi();
  const c = k ? congestion(k.waiting, 3) : null;
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Ақылды қала моделі</h1>
      <p className="lead" style={{ margin: 0 }}>
        Үш қиылысты көше. Әр көліктің өз маршруты, жылдамдығы және күту уақыты бар; бағдаршам қызыл болса, көлік тоқтайды.
      </p>
      <div className="lab-layout">
        <StageView net={sim.net} frame={sim.frame('adaptive')} view={fullView(sim.net)} title="Ақылды бағдаршам" color={MODE_COLOR.adaptive} t={sim.t} duration={params.duration} maxHeight={Math.max(220, Math.min(560, vh - 330))} />
        <div className="lab-side">
          <button className={`btn btn-primary btn-xl ${!sim.started ? 'pulse' : ''}`} onClick={sim.running ? sim.pause : sim.start}>
            <Icon name={sim.running ? 'pause' : 'play'} size={20} /> {sim.running ? 'Тоқтату' : sim.started ? 'Жалғастыру' : 'Қозғалысты бастау'}
          </button>
          <div className="big-kpis">
            <div className="big-kpi">
              <div className="k">Көлік саны</div>
              <div className="v">{fmtInt(k?.active)}</div>
            </div>
            <div className="big-kpi">
              <div className="k">Орташа күту</div>
              <div className="v">
                {fmt(k?.avgWait, 1)}
                <span className="u">с</span>
              </div>
            </div>
            <div className="big-kpi">
              <div className="k">Кептеліс</div>
              <div className="v" style={{ fontSize: '1.6rem' }}>
                <span className={`level ${c?.level ?? 'low'}`}>
                  <i />
                  {c?.label ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageCompare({ active }: { active: boolean }) {
  const vh = useViewportHeight();
  const params = useMemo(() => presetParams('single', 'mid'), []);
  const modes = useMemo<ControlMode[]>(() => ['fixed', 'adaptive'], []);
  const setLastCompare = useStore((s) => s.setLastCompare);
  const sim = useSimulation(params, modes, PACE_SPEED.compare.fast, (sims) => {
    setLastCompare({ source: 'signals', at: new Date().toISOString(), params, results: { fixed: sims.fixed?.result(), adaptive: sims.adaptive?.result() } });
  });
  useEffect(() => {
    if (!active) sim.pause();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const kF = sim.sims.fixed?.kpi();
  const kA = sim.sims.adaptive?.kpi();
  const s = kF && kA && sim.started ? compareSentence(kF.avgWait, kA.avgWait, sim.finished) : null;
  const vb = focusView(sim.net, 'J1', 46);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Қай бағдаршам тиімді?</h1>
      <div className="row">
        <button className={`btn btn-primary btn-xl ${!sim.started ? 'pulse' : ''}`} onClick={sim.running ? sim.pause : sim.start}>
          <Icon name={sim.running ? 'pause' : 'play'} size={20} /> {sim.running ? 'Тоқтату' : sim.finished ? 'Қайта салыстыру' : sim.started ? 'Жалғастыру' : 'Салыстыруды бастау'}
        </button>
        {!sim.finished && (
          <button className="btn btn-ghost" onClick={sim.finishNow}>
            <Icon name="fast" size={16} /> Бірден есептеу
          </button>
        )}
        <span className="muted">Бірдей көлік ағыны және seed {params.seed} · 1 сағат модельдік уақыт</span>
      </div>
      <div className="compare-grid">
        {(['fixed', 'adaptive'] as const).map((m) => (
          <StageView key={m} net={sim.net} frame={sim.frame(m)} view={vb} title={m === 'fixed' ? 'Қарапайым бағдаршам' : 'Ақылды бағдаршам'} color={MODE_COLOR[m]} t={sim.t} duration={params.duration} maxHeight={Math.max(170, Math.min(420, vh - 545))} showLabels={false} />
        ))}
      </div>
      <div className="grid g4">
        {(
          [
            ['Орташа күту, с', kF?.avgWait, kA?.avgWait, 1],
            ['Өткен көліктер', kF?.completed, kA?.completed, 0],
            ['Орташа кезек', kF?.avgQueue, kA?.avgQueue, 1],
            ['Ең үлкен кезек', kF?.maxQueue, kA?.maxQueue, 0],
          ] as [string, number | undefined, number | undefined, number][]
        ).map(([n, f, a, d]) => (
          <div className="big-kpi" key={n}>
            <div className="k">{n}</div>
            <div className="v" style={{ fontSize: '1.7rem' }}>
              <span style={{ color: MODE_COLOR.fixed }}>{fmt(f, d)}</span> / <span style={{ color: MODE_COLOR.adaptive }}>{fmt(a, d)}</span>
            </div>
            <div className="sub">қарапайым / ақылды</div>
          </div>
        ))}
      </div>
      {s && <div className={`note ${s.tone} big-statement`}>{s.text}</div>}
    </div>
  );
}

function StageMath() {
  const [i, setI] = useState(1);
  const [shown, setShown] = useState(false);
  const ex = SOURCE_FLOW_EXAMPLES[i];
  const q = flowRate(ex.rho, ex.v);
  const bd = dijkstra(SEED_GRAPH, 'B', 'D', 'distance');
  const bt = dijkstra(SEED_GRAPH, 'B', 'D', 'time');
  const alts = allSimplePaths(SEED_GRAPH, 'B', 'D');
  const info = (p: string[]) => alts.find((a) => a.path.join() === p.join())!;
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Математикалық есептеу</h1>
      <div className="grid g2">
        <div className="card">
          <div className="eyebrow">Көлік ағынының теңдеуі (оқу мысалы)</div>
          <ChoiceGroup
            label="Жағдай"
            value={String(i)}
            options={[
              { v: '0', t: 'Көлік аз' },
              { v: '1', t: 'Орташа' },
              { v: '2', t: 'Көп' },
            ]}
            onChange={(v) => {
              setI(Number(v));
              setShown(false);
            }}
          />
          <div className="formula-box big" style={{ marginTop: 14 }}>
            <TeX block tex={shown ? `q = \\rho \\cdot v = ${ex.rho} \\times ${ex.v} = ${q}\\ \\tfrac{\\text{көлік}}{\\text{сағ}}` : 'q = \\rho \\cdot v'} />
          </div>
          <p className="muted">ρ — 1 км жолдағы көлік саны, v — орташа жылдамдық (км/сағ), q — 1 сағатта өтетін көлік саны.</p>
          <button className="btn btn-primary btn-xl" onClick={() => setShown(true)} disabled={shown}>
            <Icon name="formula" size={20} /> Есептеуді көрсету
          </button>
        </div>
        <div className="stack">
          <div className="card">
            <div className="eyebrow">Ақылды бағдаршамның ережесі</div>
            <div className="formula-box">
              <TeX block tex="S_i = N_i + \alpha \cdot W_i" />
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              N — кезектегі көлік саны, W — олардың орташа күтуі. Жасыл S ең үлкен бағытқа беріледі (minGreen 10 с, maxGreen 60 с, maxRed 120 с).
            </p>
          </div>
          <div className="card">
            <div className="eyebrow">Дейкстра алгоритмі: B → D</div>
            <p style={{ margin: 0 }}>
              Ең қысқа: <b>{bd.path.join('–')}</b> — {fmt(info(bd.path).distance, 0)} км, {fmt(info(bd.path).time, 0)} мин.
              <br />
              Ең жылдам: <b>{bt.path.join('–')}</b> — {fmt(info(bt.path).distance, 0)} км, {fmt(info(bt.path).time, 0)} мин.
              <br />
              <span className="muted">Ең қысқа жол әрқашан ең жылдам емес.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageResults() {
  const exp = useStore((s) => s.experiments.E10);
  const setExperiment = useStore((s) => s.setExperiment);
  const [prog, setProg] = useState<[number, number] | null>(null);
  const [err, setErr] = useState('');
  const an = useMemo(() => (exp ? analyzePairs(exp, 0, 'avgWait') : null), [exp]);
  const calc = async () => {
    setErr('');
    setProg([0, 1]);
    try {
      const res = await runInWorker('E10', { baseSeed: 2026, repeats: 30 }, (d, t) => setProg([d, t])).promise;
      setExperiment(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setProg(null);
    }
  };
  const agg = exp ? aggregate(exp) : [];
  const fx = agg.find((a) => a.mode === 'fixed');
  const ad = agg.find((a) => a.mode === 'adaptive');
  const data =
    fx && ad
      ? [
          { name: 'Орташа күту, с', fixed: +fx.means.avgWait.toFixed(1), fixed_e: +fx.sds.avgWait.toFixed(2), adaptive: +ad.means.avgWait.toFixed(1), adaptive_e: +ad.sds.avgWait.toFixed(2) },
          { name: 'Орташа кезек, көлік', fixed: +fx.means.avgQueue.toFixed(1), fixed_e: +fx.sds.avgQueue.toFixed(2), adaptive: +ad.means.avgQueue.toFixed(1), adaptive_e: +ad.sds.avgQueue.toFixed(2) },
        ]
      : [];
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Нәтижелер мен графиктер</h1>
      <p className="lead" style={{ margin: 0 }}>
        Бір тәжірибе кездейсоқ болуы мүмкін. Сондықтан екі бағдаршамды 30 түрлі кездейсоқ жағдайда (seed) салыстырдық.
      </p>
      {!exp && (
        <div className="row">
          <button className="btn btn-primary btn-xl pulse" onClick={calc} disabled={!!prog}>
            <Icon name="play" size={20} /> 30 тәжірибені есептеу
          </button>
          {prog && (
            <div style={{ minWidth: 260, flex: 1 }}>
              <div className="progress">
                <div style={{ width: `${(100 * prog[0]) / Math.max(1, prog[1])}%` }} />
              </div>
              <span className="small muted">
                {prog[0]} / {prog[1]}
              </span>
            </div>
          )}
        </div>
      )}
      {err && <div className="note bad">{err}</div>}
      {exp && fx && ad && an && (
        <div className="grid split-r">
          <div className="card">
            <div className="chart-box lg">
              <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 26, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke="#e6ebf0" vertical={false} />
                  <XAxis dataKey="name" fontSize={15} />
                  <YAxis fontSize={14} />
                  <Tooltip />
                  <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} wrapperStyle={{ fontSize: 15 }} />
                  <Bar dataKey="fixed" fill={MODE_COLOR.fixed} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    <ErrorBar dataKey="fixed_e" width={6} stroke="#172b4d" />
                    <LabelList dataKey="fixed" position="top" fontSize={15} formatter={(v: number) => fmt(v, 1)} />
                  </Bar>
                  <Bar dataKey="adaptive" fill={MODE_COLOR.adaptive} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    <ErrorBar dataKey="adaptive_e" width={6} stroke="#172b4d" />
                    <LabelList dataKey="adaptive" position="top" fontSize={15} formatter={(v: number) => fmt(v, 1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="stack">
            <div className="big-kpi">
              <div className="k">Қайталау саны</div>
              <div className="v">{an.n}</div>
            </div>
            <div className="big-kpi">
              <div className="k">Күтудің орташа айырмасы (95% сенім аралығы)</div>
              <div className="v" style={{ fontSize: '1.6rem' }}>
                {fmt(an.diff.mean, 1)} с
              </div>
              <div className="sub">{an.diff.ci95 ? `[${fmt(an.diff.ci95[0], 1)}; ${fmt(an.diff.ci95[1], 1)}] с` : ''}</div>
            </div>
            <div className={`note ${an.significant ? 'ok' : 'warn'}`}>{an.verdict}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageConclusion({ onRestart }: { onRestart: () => void }) {
  const exp = useStore((s) => s.experiments.E10);
  const cmp = useStore((s) => s.lastCompare);
  const an = useMemo(() => (exp ? analyzePairs(exp, 0, 'avgWait') : null), [exp]);
  const f = cmp?.results.fixed;
  const a = cmp?.results.adaptive;
  const s = f && a ? compareSentence(f.avgWait, a.avgWait, true) : null;
  const confirmed = an ? an.significant && an.diff.mean > 0 : null;
  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Қорытынды</h1>
      <ul className="big-statement" style={{ margin: 0, paddingLeft: 26, display: 'grid', gap: 10 }}>
        <li>Жол қозғалысының есептелетін компьютерлік моделі құрылды: көліктер, жолақтар, бағдаршам фазалары және кезектер.</li>
        <li>{s ? s.text : 'Бағдаршамдарды салыстыру әлі жүргізілмеді (3-кезең).'}</li>
        <li>
          {an
            ? `${an.n} рет қайталанған тәжірибеде: ${an.verdict}`
            : '30 рет қайталанған тәжірибе әлі есептелмеді (5-кезең).'}
        </li>
        <li>Ең қысқа жол әрқашан ең жылдам емес: B→D үшін Дейкстра алгоритмі екі түрлі жол берді.</li>
      </ul>
      {confirmed !== null && (
        <div className={`note ${confirmed ? 'ok' : 'warn'} big-statement`}>
          {confirmed ? 'Гипотеза модель шеңберінде расталды: ақылды бағдаршам күту уақытын тұрақты түрде азайтты.' : 'Гипотеза бұл модельде толық расталмады — нәтиже бағдаршам баптауларына тәуелді.'}
        </div>
      )}
      <p className="muted">Шектеу: көше — шартты схема, параметрлер — оқу баптаулары; нақты қалаға қолдану үшін далалық өлшеу қажет.</p>
      <div>
        <button className="btn btn-primary btn-xl" onClick={onRestart}>
          <Icon name="reset" size={20} /> Демонстрацияны қайта бастау
        </button>
      </div>
    </div>
  );
}
