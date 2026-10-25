import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RLegend, ErrorBar } from 'recharts';
import { Explain, Hint, NumField } from '../components/common';
import { Icon } from '../components/Icon';
import { StageView } from '../components/StageView';
import { focusView, fullView } from '../components/SimCanvas';
import { EXPERIMENTS, ExperimentDef, ExperimentResult, aggregate, planRuns, METRIC_LABELS, MetricKey } from '../core/experiments';
import { EXP_CONTENT, conclude } from '../lib/labContent';
import { useStore } from '../lib/store';
import { runInWorker, RunHandle } from '../lib/runner';
import { useSimulation } from '../lib/useSimulation';
import { PACE_SPEED } from '../lib/presets';
import { fmt, MODE_COLOR, MODE_LABEL } from '../lib/format';
import type { ControlMode } from '../core/scenario';
import NotFound from './NotFound';

const STEPS = ['Мақсат', 'Болжам', 'Тәжірибе', 'Нәтиже', 'Қорытынды'];

export default function ExperimentWizard() {
  const { expId = '' } = useParams();
  const def = EXPERIMENTS.find((e) => e.id === expId.toUpperCase());
  if (!def) return <NotFound />;
  return <Wizard key={def.id} def={def} />;
}

function Wizard({ def }: { def: ExperimentDef }) {
  const c = EXP_CONTENT[def.id];
  const nav = useNavigate();
  const wiz = useStore((s) => s.wizard[def.id]) ?? { step: 0 };
  const setWizard = useStore((s) => s.setWizard);
  const result = useStore((s) => s.experiments[def.id]);
  const setExperiment = useStore((s) => s.setExperiment);
  const addLog = useStore((s) => s.addLog);
  const step = Math.min(wiz.step, result ? 4 : 2);
  const go = (s: number) => setWizard(def.id, { ...wiz, step: s });
  const idx = EXPERIMENTS.indexOf(def);
  const next = EXPERIMENTS[idx + 1];

  // 3-қадамның баптаулары
  const [baseSeed, setBaseSeed] = useState(2026);
  const [repeats, setRepeats] = useState(def.repeats);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const handle = useRef<RunHandle | null>(null);
  const minRepeats = def.id === 'E10' ? 30 : 1;
  const repeatsOk = Number.isInteger(repeats) && repeats >= minRepeats && repeats <= 60;

  // көрнекі симулятор (бірінші нұсқа)
  const [vi, setVi] = useState(0);
  const [pm, setPm] = useState<ControlMode>(def.modes.includes('adaptive') ? 'adaptive' : 'fixed');
  const previewParams = useMemo(() => (def.kind === 'sim' ? planRuns(def, { baseSeed, repeats: 1 })[Math.min(vi, def.variants.length - 1)].params : null), [def, baseSeed, vi]);
  const modes = useMemo(() => [pm], [pm]);

  const run = async () => {
    setError('');
    setProgress([0, 1]);
    const h = runInWorker(def.id, { baseSeed, repeats: def.kind === 'routing' ? 1 : repeats }, (d, t) => setProgress([d, t]));
    handle.current = h;
    try {
      const res = await h.promise;
      setExperiment(res);
      addLog({ at: new Date().toISOString(), kind: 'experiment', label: `${def.id}: ${c.short} (${res.runs.length || res.routing?.length} есептеу)` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
      handle.current = null;
    }
  };

  return (
    <div className="page">
      <Link to="/lab" className="back-link">
        <Icon name="arrowL" size={16} /> Барлық тәжірибелер
      </Link>
      <header className="page-head">
        <div className="eyebrow">
          {idx + 1}-тәжірибе · {def.id} · виртуалды тәжірибе
        </div>
        <h1>{c.short}</h1>
        <p className="lead">{c.line}</p>
      </header>

      <ol className="stepper" aria-label="Қадамдар">
        {STEPS.map((t, i) => (
          <li key={t}>
            <button type="button" aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => go(i)} disabled={i > 2 && !result}>
              <span className="sn">{i < step ? '✓' : i + 1}</span>
              {t}
            </button>
          </li>
        ))}
      </ol>

      <div className="card">
        {step === 0 && (
          <div style={{ maxWidth: 820 }}>
            <div className="eyebrow">Қадам 1. Мақсат</div>
            <p className="big-statement">{c.goal}</p>
            <p className="muted">
              Өзгеретін шама: {def.variable}. {def.kind === 'sim' ? `Желі: ${def.base.network === 'corridor' ? 'үш қиылысты көше' : 'бір қиылыс'}.` : 'Деректер: ғылыми жұмыстағы A–B–C–D графы.'}
            </p>
          </div>
        )}

        {step === 1 && (
          <div style={{ maxWidth: 820 }}>
            <div className="eyebrow">Қадам 2. Болжам</div>
            <p className="big-statement">{c.question}</p>
            <p className="muted">Тәжірибеге дейін өз болжамыңды таңда. Соңында оны нәтижемен салыстырамыз.</p>
            <div className="option-list" role="group" aria-label="Болжам">
              {c.choices.map((ch) => (
                <button key={ch.v} type="button" className="option" aria-pressed={wiz.prediction === ch.v} onClick={() => setWizard(def.id, { ...wiz, prediction: ch.v })}>
                  <span className="radio" />
                  {ch.t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div className="eyebrow">Қадам 3. Тәжірибе</div>
            {def.kind === 'sim' && previewParams && (
              <PreviewSim def={def} params={previewParams} modes={modes} pm={pm} setPm={setPm} vi={vi} setVi={setVi} running={!!progress} />
            )}
            {def.kind === 'routing' && <p className="big-statement">A, B, C, D нүктелерінің барлық 6 жұбы үшін Дейкстра алгоритмі {def.metric === 'distance' ? 'ең қысқа' : 'ең жылдам'} жолды есептейді.</p>}
            <div className="row">
              {!progress ? (
                <button className={`btn btn-primary btn-xl ${!result ? 'pulse' : ''}`} onClick={run} disabled={!repeatsOk}>
                  <Icon name="play" size={20} /> {result ? 'Тәжірибені қайта бастау' : 'Тәжірибені бастау'}
                </button>
              ) : (
                <button className="btn btn-xl" onClick={() => handle.current?.cancel()}>
                  <Icon name="pause" size={20} /> Тоқтату
                </button>
              )}
              {result && !progress && (
                <button className="btn btn-teal btn-xl" onClick={() => go(3)}>
                  Нәтижені көру <Icon name="arrowR" size={18} />
                </button>
              )}
            </div>
            {progress && (
              <div aria-live="polite">
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress[1]} aria-valuenow={progress[0]}>
                  <div style={{ width: `${(100 * progress[0]) / Math.max(1, progress[1])}%` }} />
                </div>
                <p className="small muted" style={{ marginTop: 6 }}>
                  Есептелуде: {progress[0]} / {progress[1]} симуляция (әр нұсқа, әр бағдаршам, әр қайталау)
                </p>
              </div>
            )}
            {!progress && <Hint>{result ? 'Тәжірибе дайын. «Нәтижені көру» батырмасын бас.' : '«Тәжірибені бастау» батырмасын бас.'}</Hint>}
            {error && <div className="note bad">{error}</div>}
            {def.kind === 'sim' && (
              <details className="disclosure">
                <summary>Қосымша баптаулар</summary>
                <div className="grid g3" style={{ gap: 12, maxWidth: 720 }}>
                  <NumField label="Базалық seed" value={baseSeed} min={0} onChange={(v) => setBaseSeed(Math.round(v))} />
                  <NumField label="Қайталау саны" hint={def.id === 'E10' ? '≥ 30' : undefined} value={repeats} min={minRepeats} max={60} onChange={(v) => setRepeats(Math.round(v))} />
                </div>
                <p className="small muted">
                  Нұсқалар: {def.variants.map((v) => v.label).join(', ')}. Әр seed үшін екі бағдаршам бірдей көлік ағынымен есептеледі. Барлығы {def.variants.length * repeats * def.modes.length} симуляция. Seed: {baseSeed}…{baseSeed + Math.max(0, repeats - 1)}.
                </p>
                {!repeatsOk && <div className="note bad small">Қайталау саны {minRepeats}…60 аралығында болуы тиіс.</div>}
              </details>
            )}
          </div>
        )}

        {step === 3 && result && <ResultStep def={def} res={result} />}
        {step === 4 && result && <ConclusionStep def={def} res={result} prediction={wiz.prediction} />}

        <div className="wizard-nav">
          <button className="btn" onClick={() => (step === 0 ? nav('/lab') : go(step - 1))}>
            <Icon name="arrowL" size={16} /> Артқа
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setWizard(def.id, { step: 2, prediction: wiz.prediction });
            }}
          >
            <Icon name="reset" size={16} /> Қайта жасау
          </button>
          {step < 4 ? (
            <button className="btn btn-primary" onClick={() => go(step + 1)} disabled={step === 2 && !result}>
              Келесі қадам <Icon name="arrowR" size={16} />
            </button>
          ) : next ? (
            <Link className="btn btn-primary" to={`/lab/${next.id}`}>
              Келесі тәжірибе <Icon name="arrowR" size={16} />
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/results">
              Нәтижелерге <Icon name="arrowR" size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewSim({
  def,
  params,
  modes,
  pm,
  setPm,
  vi,
  setVi,
  running,
}: {
  def: ExperimentDef;
  params: NonNullable<ReturnType<typeof planRuns>[number]['params']>;
  modes: ControlMode[];
  pm: ControlMode;
  setPm: (m: ControlMode) => void;
  vi: number;
  setVi: (n: number) => void;
  running: boolean;
}) {
  const sim = useSimulation(params, modes, PACE_SPEED.compare.normal);
  const vb = params.network === 'corridor' ? fullView(sim.net) : focusView(sim.net, 'J1', 50);
  const s = sim.sims[pm];
  const c = EXP_CONTENT[def.id];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        {def.variants.length > 1 && (
          <div className="seg" role="group" aria-label="Нұсқа">
            {def.variants.map((v, i) => (
              <button key={v.label} type="button" aria-pressed={vi === i} onClick={() => setVi(i)}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        {def.modes.length > 1 && (
          <div className="seg" role="group" aria-label="Бағдаршам">
            {def.modes.map((m) => (
              <button key={m} type="button" aria-pressed={pm === m} onClick={() => setPm(m)}>
                {m === 'fixed' ? 'Қарапайым' : 'Ақылды'}
              </button>
            ))}
          </div>
        )}
        <span className="spacer" />
        {!sim.running ? (
          <button className="btn" onClick={sim.start}>
            <Icon name="play" size={16} /> Көрсету
          </button>
        ) : (
          <button className="btn" onClick={sim.pause}>
            <Icon name="pause" size={16} /> Тоқтату
          </button>
        )}
      </div>
      {s && <StageView net={sim.net} frame={sim.frame(pm)} view={vb} title={`Көрнекі модель: ${def.variants[vi]?.label ?? ''}`} color={MODE_COLOR[pm]} t={sim.t} duration={params.duration} maxHeight={420} />}
      <p className="small muted" style={{ margin: 0 }}>
        {c.watch} Көрнекі модель — бір нұсқаның анимациясы; «Тәжірибені бастау» барлық нұсқаларды {running ? 'қазір' : ''} фонда толық есептейді.
      </p>
    </div>
  );
}

function ResultStep({ def, res }: { def: ExperimentDef; res: ExperimentResult }) {
  const metric: MetricKey = (['avgWait', 'avgQueue', 'maxQueue', 'avgWaitSide', 'avgTravel', 'unfinished'] as MetricKey[]).includes(def.focus as MetricKey) ? (def.focus as MetricKey) : 'avgWait';
  const [m, setM] = useState<MetricKey>(metric);
  if (res.routing) {
    return (
      <div className="stack">
        <div className="eyebrow">Қадам 4. Нәтиже</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Қайдан → қайда</th>
                <th>Табылған жол</th>
                <th className="num">Қашықтық, км</th>
                <th className="num">Уақыт, мин</th>
                <th>Ең қысқа мен ең жылдам</th>
              </tr>
            </thead>
            <tbody>
              {res.routing.map((r) => (
                <tr key={r.from + r.to} className={r.differs ? 'hl' : ''}>
                  <td>
                    {r.from} → {r.to}
                  </td>
                  <td>{r.path.join('–')}</td>
                  <td className="num">{fmt(r.distance, 0)}</td>
                  <td className="num">{fmt(r.time, 0)}</td>
                  <td>{r.differs ? <span className="badge warn">әртүрлі</span> : <span className="badge ok">бірдей</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Explain label="Бұл кесте нені көрсетеді?">Әр жол — бір жұп нүкте. Көкпен белгіленген жолдарда ең қысқа маршрут пен ең жылдам маршрут әртүрлі.</Explain>
      </div>
    );
  }
  const agg = aggregate(res);
  const variants = [...new Set(agg.map((a) => a.variant))];
  const data = variants.map((v) => {
    const row: Record<string, string | number> = { variant: v };
    for (const a of agg.filter((x) => x.variant === v)) {
      row[a.mode] = Number(a.means[m].toFixed(2));
      row[`${a.mode}_e`] = Number.isFinite(a.sds[m]) ? Number(a.sds[m].toFixed(2)) : 0;
    }
    return row;
  });
  const unit = METRIC_LABELS[m].split(', ')[1] ?? '';
  return (
    <div className="stack">
      <div className="eyebrow">Қадам 4. Нәтиже</div>
      <div className="row">
        <span className="field-label">Көрсеткіш:</span>
        <div className="seg" role="group" aria-label="Көрсеткіш">
          {(['avgWait', 'avgQueue', 'maxQueue', 'throughputPerHour', 'avgTravel'] as MetricKey[]).concat(def.id === 'E05' ? ['avgWaitSide'] : def.id === 'E08' ? ['unfinished'] : []).map((k) => (
            <button key={k} type="button" aria-pressed={m === k} onClick={() => setM(k)}>
              {METRIC_LABELS[k].split(',')[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid split-r">
        <div>
          <div className="chart-box lg">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf0" vertical={false} />
                <XAxis dataKey="variant" fontSize={13} />
                <YAxis fontSize={13} label={{ value: unit, angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }} />
                <Tooltip formatter={(v: number, n: string) => [fmt(v, 1), MODE_LABEL[n as ControlMode] ?? n]} />
                <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} />
                {def.modes.map((md) => (
                  <Bar key={md} dataKey={md} fill={MODE_COLOR[md]} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    <ErrorBar dataKey={`${md}_e`} width={6} stroke="#172b4d" strokeWidth={1} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Explain>
            Әр баған — «{METRIC_LABELS[m]}» көрсеткішінің {res.repeats} қайталаудағы орташа мәні. Сұр — қарапайым бағдаршам, көк-жасыл — ақылды бағдаршам. Бағанның үстіндегі сызықша — нәтиженің қайталаулар арасында қаншалықты өзгергені (стандартты ауытқу).
          </Explain>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Нұсқа</th>
                <th>Бағдаршам</th>
                <th className="num">Күту, с</th>
                <th className="num">Кезек</th>
                <th className="num">Өтті/сағ</th>
              </tr>
            </thead>
            <tbody>
              {agg.map((a) => (
                <tr key={a.variant + a.mode}>
                  <td>{a.variant}</td>
                  <td>
                    <span className="dot" style={{ background: MODE_COLOR[a.mode] }} /> {a.mode === 'fixed' ? 'Қарапайым' : 'Ақылды'}
                  </td>
                  <td className="num">{fmt(a.means.avgWait, 1)}</td>
                  <td className="num">{fmt(a.means.avgQueue, 1)}</td>
                  <td className="num">{fmt(a.means.throughputPerHour, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted">
        {res.runs.length} симуляция · seed {res.baseSeed}…{res.baseSeed + res.repeats - 1} · {res.modelVersion}. Барлық сан симуляциядан есептелді.
      </p>
    </div>
  );
}

function ConclusionStep({ def, res, prediction }: { def: ExperimentDef; res: ExperimentResult; prediction?: string }) {
  const c = EXP_CONTENT[def.id];
  const con = useMemo(() => conclude(res), [res]);
  const pred = c.choices.find((x) => x.v === prediction);
  const ans = c.choices.find((x) => x.v === con.answer);
  return (
    <div className="stack">
      <div className="eyebrow">Қадам 5. Қорытынды</div>
      <p className="big-statement">{con.headline}</p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {con.bullets.map((b, i) => (
          <li key={i} style={{ margin: '4px 0' }}>
            {b}
          </li>
        ))}
      </ul>
      {pred ? (
        <div className={`note ${ans && pred.v === ans.v ? 'ok' : 'warn'}`}>
          <b>Сенің болжамың:</b> {pred.t}. {ans ? (pred.v === ans.v ? 'Нәтиже болжамды растады.' : `Нәтиже басқаша болды: «${ans.t}».`) : ''} Ғылымда болжамның расталмауы да — маңызды нәтиже.
        </div>
      ) : (
        <div className="note info">Болжам таңдалмаған. {ans ? `Нәтиже бойынша жауап: «${ans.t}».` : ''}</div>
      )}
      <div className="row">
        <Link to="/results" className="btn btn-primary">
          Нәтижелерге өту <Icon name="arrowR" size={16} />
        </Link>
      </div>
    </div>
  );
}
