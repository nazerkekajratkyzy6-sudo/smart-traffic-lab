import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChoiceGroup, Hint, Explain } from '../components/common';
import { Icon } from '../components/Icon';
import { StageView, Legend } from '../components/StageView';
import { fullView, focusView } from '../components/SimCanvas';
import { ParamPanel } from '../components/ParamPanel';
import { useSimulation } from '../lib/useSimulation';
import { LEVELS, LEVEL_RATE, PACES, PACE_SPEED, Level, Pace, presetParams, congestion } from '../lib/presets';
import { ScenarioParams, ControlMode, scenarioId } from '../core/scenario';
import { useStore } from '../lib/store';
import { fmt, fmtInt, fmtTime, MODE_COLOR } from '../lib/format';
import { toCsv } from '../lib/csv';
import { downloadText, stamp } from '../lib/download';

const KIND: { v: ControlMode; t: string }[] = [
  { v: 'fixed', t: 'Қарапайым' },
  { v: 'adaptive', t: 'Ақылды' },
];

export default function City() {
  const [level, setLevel] = useState<Level>('mid');
  const [kind, setKind] = useState<ControlMode>('adaptive');
  const [pace, setPace] = useState<Pace>('normal');
  const [params, setParams] = useState<ScenarioParams>(() => presetParams('corridor', 'mid'));
  // Телефонда бүкіл көше тым ұсақ көрінеді — бір қиылыстан бастаймыз
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'J1' : 'full'));
  const setLastRun = useStore((s) => s.setLastRun);
  const addLog = useStore((s) => s.addLog);

  const sim = useSimulation(params, useMemo(() => [kind], [kind]), PACE_SPEED.city[pace], (sims) => {
    const r = sims[kind]?.result();
    if (!r) return;
    setLastRun({ source: 'city', at: new Date().toISOString(), params, results: { [kind]: r } });
    addLog({ at: new Date().toISOString(), kind: 'city', label: `Ақылды қала: ${kind === 'adaptive' ? 'ақылды' : 'қарапайым'} бағдаршам, ${LEVELS.find((l) => l.v === level)?.t.toLowerCase()} көлік` });
  }, 60);
  const s = sim.sims[kind];
  const k = s?.kpi();
  const cong = k ? congestion(k.waiting, sim.net.junctions.length) : null;
  const vb = view === 'full' ? fullView(sim.net) : focusView(sim.net, view, 58);

  const chooseLevel = (l: Level) => {
    setLevel(l);
    setParams((p) => ({ ...p, ratePerApproach: LEVEL_RATE.corridor[l] }));
  };

  const hint = !sim.started
    ? 'Баптаулар дайын. Енді «Бастау» батырмасын бас.'
    : sim.finished
      ? 'Тәжірибе аяқталды. Енді екі бағдаршамды салыстыр.'
      : sim.running
        ? 'Бағдаршамның қалай өзгеретінін және кезектерді бақыла.'
        : 'Үзіліс. «Бастау» — жалғастыру, «Қайта бастау» — басынан.';

  const seriesLen = s?.series.length ?? 0;
  const chartData = useMemo(() => (s ? s.series.map((p) => ({ t: p.t, q: p.queue })) : []), [seriesLen, s]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!s) return;
    const r = s.result();
    const rows: (string | number)[][] = [
      ['# SMART TRAFFIC LAB — Ақылды қала', 'виртуалды тәжірибе'],
      ['Сценарий ID', scenarioId(params)],
      ['Бағдаршам', kind === 'adaptive' ? 'ақылды (адаптивті)' : 'қарапайым (тұрақты)'],
      ['Seed', params.seed],
      ['Келген', r.generated],
      ['Аяқталған', r.completed],
      ['Орташа күту, с', r.avgWait],
      ['Орташа кезек', r.avgQueue],
      ['Өткізу, авт./сағ', r.throughputPerHour],
      [],
      ['t, с', 'Тоқтаған көлік', 'Желідегі көлік', 'Өткен көлік'],
      ...s.series.map((p) => [p.t, p.queue, p.active, p.completed]),
    ];
    downloadText(toCsv(rows), `city-${scenarioId(params)}-${stamp()}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Ақылды қала · виртуалды тәжірибе</div>
        <h1>Көліктер қалай қозғалады?</h1>
        <p className="lead">Үш қиылысы бар көше. Әр көліктің өз маршруты, жылдамдығы және күту уақыты бар. Бағдаршам қызыл болса — тоқтайды, жасыл болса — жүреді.</p>
      </header>

      <div className="card flat" style={{ marginBottom: 16 }}>
        <div className="settings-bar">
          <ChoiceGroup n={1} label="Көлік саны" value={level} options={LEVELS.map((l) => ({ v: l.v, t: l.t }))} onChange={chooseLevel} />
          <ChoiceGroup n={2} label="Бағдаршам түрі" value={kind} options={KIND} onChange={setKind} />
          <ChoiceGroup n={3} label="Қозғалыс жылдамдығы" value={pace} options={PACES} onChange={setPace} />
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          «Қозғалыс жылдамдығы» — тек анимацияның жылдамдығы (уақыт қаншалықты тез өтеді). Көліктердің есептелген жылдамдығы өзгермейді: қалада 50 км/сағ шегі сақталады.
        </p>
      </div>

      <div className="lab-layout">
        <div className="stack" style={{ gap: 12 }}>
          {s && (
            <StageView
              net={sim.net}
              frame={sim.frame(kind)}
              view={vb}
              title={kind === 'adaptive' ? 'Ақылды бағдаршам' : 'Қарапайым бағдаршам'}
              color={MODE_COLOR[kind]}
              t={sim.t}
              duration={params.duration}
              maxHeight={620}
              showScores={kind === 'adaptive'}
            />
          )}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="controls">
              {!sim.running ? (
                <button className={`btn btn-primary btn-xl ${!sim.started ? 'pulse' : ''}`} onClick={sim.start} disabled={sim.errors.length > 0}>
                  <Icon name="play" size={20} /> Бастау
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
            <div className="seg" role="group" aria-label="Көрініс">
              {[{ v: 'full', t: 'Бүкіл көше' }, ...sim.net.junctions.map((j) => ({ v: j.id, t: j.label }))].map((o) => (
                <button key={o.v} type="button" aria-pressed={view === o.v} onClick={() => setView(o.v)}>
                  {o.t}
                </button>
              ))}
            </div>
          </div>
          <Hint>{hint}</Hint>
          <Legend />
        </div>

        <aside className="lab-side" aria-label="Көрсеткіштер">
          <div className="big-kpis">
            <div className="big-kpi">
              <div className="k">Көлік саны</div>
              <div className="v">
                {fmtInt(k?.active)}
                <span className="u">көлік</span>
              </div>
              <div className="sub">қазір көшеде · өтті {fmtInt(k?.completed)}</div>
            </div>
            <div className="big-kpi">
              <div className="k">Орташа күту уақыты</div>
              <div className="v">
                {fmt(k?.avgWait, 1)}
                <span className="u">с</span>
              </div>
              <div className="sub">жолды аяқтаған көліктер бойынша</div>
            </div>
            <div className="big-kpi">
              <div className="k">Кептеліс деңгейі</div>
              <div className="v" style={{ fontSize: 'clamp(1.4rem, 1.1rem + 1vw, 1.9rem)' }}>
                <span className={`level ${cong?.level ?? 'low'}`}>
                  <i />
                  {cong?.label ?? '—'}
                </span>
              </div>
              <div className="sub">тоқтап тұр: {fmtInt(k?.waiting)} көлік</div>
            </div>
          </div>
          {sim.finished && (
            <div className="card tint">
              <p style={{ marginTop: 0 }}>
                <b>Тәжірибе аяқталды.</b> Нәтиже сақталды.
              </p>
              <div className="stack" style={{ gap: 8 }}>
                <Link to="/lab/signals" className="btn btn-primary">
                  Екі бағдаршамды салыстыру <Icon name="arrowR" size={16} />
                </Link>
                <Link to="/results" className="btn">
                  Нәтижелерді көру
                </Link>
              </div>
            </div>
          )}
          <Explain label="Кептеліс деңгейі қалай есептеледі?">
            Тоқтап тұрған көліктер саны барлық кіреберіс жолақтарына бөлінеді (әр қиылыста 8 жолақ). Бір жолаққа 1,5-тен аз көлік — төмен, 4-ке дейін — орташа, одан көп — жоғары.
          </Explain>
        </aside>
      </div>

      <details className="disclosure section">
        <summary>Қосымша баптаулар және толық деректер</summary>
        <div className="grid split-l">
          <ParamPanel params={params} onChange={setParams} errors={sim.errors} showModeHint />
          <div className="stack">
            <div className="row">
              <button className="btn" onClick={sim.finishNow} disabled={sim.finished || sim.errors.length > 0}>
                <Icon name="fast" size={16} /> Анимациясыз соңына дейін есептеу
              </button>
              <button className="btn" onClick={exportCsv} disabled={!s}>
                <Icon name="download" size={16} /> CSV
              </button>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Тоқтап тұрған көліктер уақыт бойынша</h3>
                <Explain>Сызық әр 10 секунд сайын көшеде қанша көлік тоқтап тұрғанын көрсетеді. Шыңдар — қызыл сигнал кезінде жиналған кезектер.</Explain>
              </div>
              <div className="chart-box sm">
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                    <CartesianGrid stroke="#e6ebf0" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${Math.round(v / 60)}`} fontSize={13} minTickGap={28} label={{ value: 'мин', position: 'insideBottomRight', offset: -2, fontSize: 12 }} />
                    <YAxis fontSize={13} allowDecimals={false} label={{ value: 'көлік', angle: -90, position: 'insideLeft', offset: 18, fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [v, 'тоқтап тұр']} labelFormatter={(v) => `t = ${fmtTime(Number(v))}`} />
                    <Line type="monotone" dataKey="q" stroke={MODE_COLOR[kind]} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3>Оқиғалар журналы</h3>
              <ul className="log">
                {(s?.log ?? []).slice(-40).reverse().map((e, i) => (
                  <li key={i} className={e.kind === 'force' ? 'force' : ''}>
                    <span>{fmtTime(e.t)}</span>
                    <span>
                      {e.junction !== '—' ? `${e.junction.replace('J', '')}-қиылыс: ` : ''}
                      {e.text}
                    </span>
                  </li>
                ))}
                {!s?.log.length && <li className="muted">Әзірге оқиға жоқ</li>}
              </ul>
            </div>
            <p className="small muted">Сценарий ID: {scenarioId(params)} · seed {params.seed}. Бірдей ID әрқашан бірдей нәтиже береді.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
