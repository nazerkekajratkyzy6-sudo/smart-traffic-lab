import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RLegend, LabelList } from 'recharts';
import { ChoiceGroup, Hint, Explain } from '../components/common';
import { Icon } from '../components/Icon';
import { StageView, Legend } from '../components/StageView';
import { focusView } from '../components/SimCanvas';
import { ParamPanel } from '../components/ParamPanel';
import { useSimulation } from '../lib/useSimulation';
import { LEVELS, LEVEL_RATE, PACES, PACE_SPEED, Level, Pace, presetParams, compareSentence } from '../lib/presets';
import { ScenarioParams, ControlMode, scenarioId } from '../core/scenario';
import { useStore } from '../lib/store';
import { fmt, fmtInt, MODE_COLOR } from '../lib/format';
import type { Kpi } from '../core/engine';

const MODES: ControlMode[] = ['fixed', 'adaptive'];
const NAME = { fixed: 'Қарапайым бағдаршам', adaptive: 'Ақылды бағдаршам' } as const;
const STEPS = ['Көлік саны', 'Салыстыру', 'Нәтиже'];

export default function SignalsLab() {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level>('mid');
  const [pace, setPace] = useState<Pace>('normal');
  const [params, setParams] = useState<ScenarioParams>(() => presetParams('single', 'mid'));
  const [phoneView, setPhoneView] = useState<ControlMode>('adaptive');
  const setLastCompare = useStore((s) => s.setLastCompare);
  const setLastRun = useStore((s) => s.setLastRun);
  const addLog = useStore((s) => s.addLog);

  const sim = useSimulation(params, MODES, PACE_SPEED.compare[pace], (sims) => {
    const run = { source: 'signals' as const, at: new Date().toISOString(), params, results: { fixed: sims.fixed?.result(), adaptive: sims.adaptive?.result() } };
    setLastCompare(run);
    setLastRun(run);
    addLog({ at: run.at, kind: 'compare', label: `Бағдаршамдарды салыстыру: ${LEVELS.find((l) => l.v === level)?.t.toLowerCase()} көлік, seed ${params.seed}` });
  });

  const chooseLevel = (l: Level) => {
    setLevel(l);
    setParams((p) => ({ ...p, ratePerApproach: LEVEL_RATE.single[l] }));
  };
  const kF = sim.sims.fixed?.kpi();
  const kA = sim.sims.adaptive?.kpi();
  const vb = focusView(sim.net, 'J1', 48);
  const sentence = kF && kA ? compareSentence(kF.avgWait, kA.avgWait, sim.finished) : null;

  return (
    <div className="page">
      <Link to="/lab" className="back-link">
        <Icon name="arrowL" size={16} /> Тәжірибе жасау
      </Link>
      <header className="page-head">
        <div className="eyebrow">Бағдаршамдар зертханасы · Қадам {step + 1}/3</div>
        <h1>Қай бағдаршам тиімді?</h1>
        <p className="lead">Екі бағдаршамның жұмысын салыстырып көр. Қайсысы көліктерді жылдамырақ өткізетінін анықта.</p>
      </header>

      <ol className="stepper" aria-label="Қадамдар">
        {STEPS.map((t, i) => (
          <li key={t}>
            <button type="button" aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)} disabled={i === 2 && !sim.finished}>
              <span className="sn">{i < step ? '✓' : i + 1}</span>
              {t}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="card" style={{ maxWidth: 760 }}>
          <ChoiceGroup n={1} label="Көлік санын таңда" value={level} options={LEVELS.map((l) => ({ v: l.v, t: l.t }))} onChange={chooseLevel} />
          <p className="muted" style={{ margin: '12px 0 0' }}>
            {LEVELS.find((l) => l.v === level)?.d}: әр бағыттан сағатына {LEVEL_RATE.single[level]} көлік келеді. Платформа қалған параметрлерді өзі қояды.
          </p>
          <div className="wizard-nav">
            <span />
            <button className="btn btn-primary btn-xl pulse" onClick={() => setStep(1)}>
              Жалғастыру <Icon name="arrowR" size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="controls">
              {!sim.running ? (
                <button className={`btn btn-primary btn-xl ${!sim.started ? 'pulse' : ''}`} onClick={sim.start} disabled={sim.errors.length > 0}>
                  <Icon name="play" size={20} /> {sim.started && !sim.finished ? 'Жалғастыру' : 'Салыстыруды бастау'}
                </button>
              ) : (
                <button className="btn btn-primary btn-xl" onClick={sim.pause}>
                  <Icon name="pause" size={20} /> Тоқтату
                </button>
              )}
              <button className="btn btn-xl" onClick={sim.reset}>
                <Icon name="reset" size={20} /> Қайта бастау
              </button>
            </div>
            <ChoiceGroup label="Қозғалыс жылдамдығы" value={pace} options={PACES} onChange={setPace} />
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <Hint>
              {!sim.started ? '«Салыстыруды бастау» батырмасын бас.' : sim.finished ? 'Дайын! «Нәтижені көру» батырмасын бас.' : sim.running ? 'Екі қиылыстағы кезектерді салыстыр.' : 'Үзіліс. Жалғастыру үшін батырманы бас.'}
            </Hint>
            {!sim.finished && (
              <button className="btn btn-ghost" onClick={sim.finishNow}>
                <Icon name="fast" size={16} /> Анимациясыз бірден есептеу
              </button>
            )}
            {sim.finished && (
              <button className="btn btn-teal btn-xl pulse" onClick={() => setStep(2)}>
                Нәтижені көру <Icon name="arrowR" size={18} />
              </button>
            )}
          </div>
          <div className="seg phone-only" role="group" aria-label="Қай бағдаршамды көрсету" style={{ marginBottom: 10 }}>
            {MODES.map((m) => (
              <button key={m} type="button" aria-pressed={phoneView === m} onClick={() => setPhoneView(m)}>
                {NAME[m]}
              </button>
            ))}
          </div>
          <div className="compare-grid phone-toggle">
            {MODES.map((m) => (
              <div key={m} className={`compare-pane ${phoneView === m ? 'show' : ''}`}>
                <StageView net={sim.net} frame={sim.frame(m)} view={vb} title={NAME[m]} color={MODE_COLOR[m]} t={sim.t} duration={params.duration} maxHeight={460} showLabels={false} />
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Екі модель бірдей көлік ағынымен ({sim.sims.fixed?.events.length ?? 0} көлік) және бірдей seed ({params.seed}) арқылы іске қосылады: айырмашылық тек бағдаршамның жұмысынан туындайды.
          </p>
          <Legend />
          <div className="section">
            <MetricsTable kF={kF} kA={kA} />
            {sentence && <div className={`note ${sentence.tone}`} style={{ marginTop: 12, fontSize: '1.05rem' }}>{sentence.text}</div>}
          </div>
          <details className="disclosure section">
            <summary>Қосымша баптаулар</summary>
            <ParamPanel params={params} onChange={setParams} errors={sim.errors} showModeHint />
          </details>
        </>
      )}

      {step === 2 && kF && kA && (
        <ResultStep kF={kF} kA={kA} sentence={sentence} seed={params.seed} id={scenarioId(params)} onRedo={() => { sim.reset(); setStep(1); }} />
      )}
    </div>
  );
}

function MetricsTable({ kF, kA }: { kF?: Kpi; kA?: Kpi }) {
  if (!kF || !kA) return null;
  const pct = (a: number, b: number) => (a > 0 ? `${fmt(((b - a) / a) * 100, 0)}%` : '—');
  const rows: [string, number, number, number, string, boolean][] = [
    ['Орташа күту уақыты', kF.avgWait, kA.avgWait, 1, 'с', true],
    ['Өткен көліктер саны', kF.completed, kA.completed, 0, 'көлік', false],
    ['Орташа кезек ұзындығы', kF.avgQueue, kA.avgQueue, 1, 'көлік', true],
    ['Ең үлкен кезек', kF.maxQueue, kA.maxQueue, 0, 'көлік', true],
  ];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Көрсеткіш</th>
            <th className="num">
              <span className="dot" style={{ background: MODE_COLOR.fixed }} /> Қарапайым
            </th>
            <th className="num">
              <span className="dot" style={{ background: MODE_COLOR.adaptive }} /> Ақылды
            </th>
            <th className="num">Өзгеріс</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, f, a, d, u]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="num">
                {d ? fmt(f, d) : fmtInt(f)} {u}
              </td>
              <td className="num">
                {d ? fmt(a, d) : fmtInt(a)} {u}
              </td>
              <td className="num">{pct(f, a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultStep({ kF, kA, sentence, seed, id, onRedo }: { kF: Kpi; kA: Kpi; sentence: ReturnType<typeof compareSentence> | null; seed: number; id: string; onRedo: () => void }) {
  const data = useMemo(
    () => [
      { name: 'Орташа күту, с', fixed: Number(kF.avgWait.toFixed(1)), adaptive: Number(kA.avgWait.toFixed(1)) },
      { name: 'Орташа кезек, көлік', fixed: Number(kF.avgQueue.toFixed(1)), adaptive: Number(kA.avgQueue.toFixed(1)) },
    ],
    [kF, kA],
  );
  return (
    <div className="stack">
      {sentence && <div className={`note ${sentence.tone} big-statement`}>{sentence.text}</div>}
      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <h3>Салыстыру</h3>
            <Explain>Сұр бағандар — қарапайым бағдаршам, көк-жасыл — ақылды бағдаршам. Баған неғұрлым аласа болса, көліктер соғұрлым аз күтеді және кезек қысқа.</Explain>
          </div>
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 22, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf0" vertical={false} />
                <XAxis dataKey="name" fontSize={13} />
                <YAxis fontSize={13} />
                <Tooltip formatter={(v: number, n: string) => [fmt(v, 1), n === 'fixed' ? 'Қарапайым' : 'Ақылды']} />
                <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} />
                <Bar dataKey="fixed" fill={MODE_COLOR.fixed} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="fixed" position="top" fontSize={13} formatter={(v: number) => fmt(v, 1)} />
                </Bar>
                <Bar dataKey="adaptive" fill={MODE_COLOR.adaptive} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="adaptive" position="top" fontSize={13} formatter={(v: number) => fmt(v, 1)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="stack">
          <MetricsTable kF={kF} kA={kA} />
          <div className="note warn small">
            Бұл бір тәжірибенің нәтижесі (seed {seed}, ID {id}). Нәтиже кездейсоқ емес екенін дәлелдеу үшін 10-тәжірибені (30 рет қайталау) жаса.
          </div>
          <div className="row">
            <button className="btn" onClick={onRedo}>
              <Icon name="reset" size={16} /> Қайта жасау
            </button>
            <Link to="/lab/E10" className="btn">
              30 рет қайталау
            </Link>
            <Link to="/results" className="btn btn-primary">
              Нәтижелерге өту <Icon name="arrowR" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
