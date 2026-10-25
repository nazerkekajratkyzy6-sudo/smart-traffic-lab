import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChoiceGroup, Hint, DataBadge } from '../components/common';
import { Icon } from '../components/Icon';
import { SEED_GRAPH, dijkstra, allSimplePaths, edgeKey, pathEdges, Metric, impliedTimeMin, DijkstraStep } from '../core/graph';
import { fmt } from '../lib/format';
import { useStore } from '../lib/store';

const POS: Record<string, { x: number; y: number }> = {
  A: { x: 90, y: 185 },
  B: { x: 320, y: 70 },
  C: { x: 320, y: 232 },
  D: { x: 550, y: 185 },
};

function geom(a: string, b: string) {
  const p = POS[a];
  const q = POS[b];
  if (edgeKey(a, b) === 'A–D') {
    const c = { x: 320, y: 452 };
    return { d: `M${p.x},${p.y} Q${c.x},${c.y} ${q.x},${q.y}`, mid: { x: 0.25 * p.x + 0.5 * c.x + 0.25 * q.x, y: 0.25 * p.y + 0.5 * c.y + 0.25 * q.y } };
  }
  return { d: `M${p.x},${p.y} L${q.x},${q.y}`, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
}

const unit = (m: Metric) => (m === 'distance' ? 'км' : 'мин');

export default function RoutesLab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('distance');
  const [found, setFound] = useState(false);
  const [altIdx, setAltIdx] = useState(0);
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [log, setLog] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const addLog = useStore((s) => s.addLog);

  const ready = from && to && from !== to;
  const res = useMemo(() => (ready ? dijkstra(SEED_GRAPH, from!, to!, metric, factors) : null), [ready, from, to, metric, factors]);
  const alts = useMemo(() => {
    if (!ready) return [];
    const all = allSimplePaths(SEED_GRAPH, from!, to!, factors);
    return all.sort((a, b) => (metric === 'distance' ? a.distance - b.distance || a.time - b.time : a.time - b.time || a.distance - b.distance));
  }, [ready, from, to, factors, metric]);
  const best = res ? alts.find((a) => a.path.join() === res.path.join()) : undefined;
  const others = alts.filter((a) => a !== best);
  const alt = altIdx > 0 ? others[(altIdx - 1) % Math.max(1, others.length)] : undefined;

  const pick = (n: string) => {
    setFound(false);
    setAltIdx(0);
    setStep(0);
    if (!from || (from && to)) {
      setFrom(n);
      setTo(null);
    } else if (n !== from) setTo(n);
  };

  const hint = !from ? 'Қай жерден шығамыз? Картадан нүктені бас.' : !to ? 'Қай жерге барамыз? Екінші нүктені бас.' : !found ? 'Енді «Жолды табу» батырмасын бас.' : 'Басқа жолмен салыстырып көр.';
  const pathSet = new Set(found && res ? pathEdges(res.path) : []);
  const altSet = new Set(alt ? pathEdges(alt.path) : []);
  const curStep: DijkstraStep | undefined = res && step > 0 ? res.steps[step - 1] : undefined;
  const relaxed = new Map(curStep ? curStep.relaxed.map((r) => [r.edge, r.improved]) : []);

  const find = () => {
    if (!res) return;
    setFound(true);
    setAltIdx(0);
    addLog({ at: new Date().toISOString(), kind: 'experiment', label: `Маршрут: ${res.path.join('–')} (${metric === 'distance' ? 'ең қысқа' : 'ең жылдам'})` });
  };

  const why = () => {
    if (!res || !best) return '';
    const val = metric === 'distance' ? best.distance : best.time;
    const list = others.slice(0, 3).map((o) => `${o.path.join('–')}: ${fmt(metric === 'distance' ? o.distance : o.time, 0)} ${unit(metric)}`);
    const tie = others.filter((o) => (metric === 'distance' ? o.distance : o.time) === val);
    return `Алгоритм ${alts.length} мүмкін жолдың ішінен ${metric === 'distance' ? 'жалпы ұзындығы' : 'жалпы уақыты'} ең аз жолды таңдады: ${fmt(val, 0)} ${unit(metric)}. ${list.length ? `Басқа жолдар: ${list.join('; ')}.` : ''}${tie.length ? ` (${tie.map((t) => t.path.join('–')).join(', ')} жолы да дәл сондай — бірдей жақсы.)` : ''}`;
  };

  return (
    <div className="page">
      <Link to="/lab" className="back-link">
        <Icon name="arrowL" size={16} /> Тәжірибе жасау
      </Link>
      <header className="page-head">
        <div className="eyebrow">Маршрут зертханасы · граф теориясы</div>
        <h1>Қай жол тиімді?</h1>
        <p className="lead">Қала орталығы төрт қиылыс (A, B, C, D) және алты көше ретінде берілген. Картадан екі нүктені таңда — бағдарлама ең тиімді жолды өзі есептейді.</p>
      </header>

      <div className="grid split-r">
        <div className="card">
          <div className="card-head">
            <Hint>{hint}</Hint>
            <DataBadge />
          </div>
          <svg className="route-map" viewBox="0 0 640 340" role="group" aria-label="Жол картасы: нүктені таңдау үшін басыңыз">
            <rect x="0" y="0" width="640" height="340" rx="14" fill="#f3f6f2" />
            {SEED_GRAPH.edges.map((e) => {
              const key = edgeKey(e.source, e.target);
              const g = geom(e.source, e.target);
              const onPath = pathSet.has(key);
              const onAlt = altSet.has(key);
              const rel = relaxed.get(key);
              const f = factors[key] ?? 1;
              return (
                <g key={key}>
                  <path d={g.d} fill="none" stroke="#d8dee6" strokeWidth={20} strokeLinecap="round" />
                  <path d={g.d} fill="none" stroke="#5b6573" strokeWidth={14} strokeLinecap="round" />
                  <path d={g.d} fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="7 9" />
                  {f > 1 && <path d={g.d} fill="none" stroke="#d33a2c" strokeOpacity={0.55} strokeWidth={14} strokeLinecap="round" strokeDasharray="4 6" />}
                  {onAlt && <path d={g.d} fill="none" stroke="#e5a50a" strokeWidth={8} strokeLinecap="round" strokeDasharray="12 8" />}
                  {onPath && <path className="route-draw" d={g.d} fill="none" stroke="#1769aa" strokeWidth={8} strokeLinecap="round" />}
                  {rel !== undefined && !onPath && <path d={g.d} fill="none" stroke={rel ? '#16866d' : '#9aa7b4'} strokeWidth={6} strokeLinecap="round" />}
                  <g transform={`translate(${g.mid.x} ${g.mid.y})`}>
                    <rect x={-58} y={-14} width={116} height={28} rx={14} fill="#fff" stroke="#d9e0e8" />
                    <text textAnchor="middle" y={5} fontSize={13} fontWeight={600} fill="#33456a" fontFamily="Inter Variable, sans-serif">
                      {e.distance_km} км · {fmt(e.time_min * f, f === 1 ? 0 : 1)} мин
                    </text>
                  </g>
                </g>
              );
            })}
            {SEED_GRAPH.nodes.map((n) => {
              const p = POS[n];
              const isFrom = n === from;
              const isTo = n === to;
              const visited = curStep?.visited.includes(n);
              const d = curStep?.dist[n];
              return (
                <g
                  key={n}
                  className="node-btn"
                  transform={`translate(${p.x} ${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n} нүктесі${isFrom ? ', бастау' : isTo ? ', мақсат' : ''}`}
                  onClick={() => pick(n)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      pick(n);
                    }
                  }}
                >
                  <circle className="ring" r={30} fill={isFrom ? '#16866d' : isTo ? '#1769aa' : visited ? '#e9f2fa' : '#ffffff'} stroke={isFrom ? '#11705a' : isTo ? '#115488' : '#9aa7b4'} strokeWidth={3} />
                  <text textAnchor="middle" y={8} fontSize={24} fontWeight={750} fill={isFrom || isTo ? '#fff' : '#172b4d'} fontFamily="Inter Variable, sans-serif">
                    {n}
                  </text>
                  {(isFrom || isTo) && (
                    <text textAnchor="middle" y={-40} fontSize={13} fontWeight={700} fill={isFrom ? '#11705a' : '#115488'} fontFamily="Inter Variable, sans-serif">
                      {isFrom ? 'Бастау' : 'Мақсат'}
                    </text>
                  )}
                  {curStep && (
                    <text textAnchor="middle" y={50} fontSize={13} fontWeight={600} fill="#5b6b85" fontFamily="Inter Variable, sans-serif">
                      {d === undefined || d === Infinity ? '∞' : `${fmt(d, d % 1 ? 1 : 0)} ${unit(metric)}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="legend" style={{ marginTop: 8 }}>
            <span>
              <i style={{ background: '#1769aa' }} />
              табылған жол
            </span>
            <span>
              <i style={{ background: '#e5a50a' }} />
              салыстыратын басқа жол
            </span>
            <span>
              <i style={{ background: '#d33a2c', opacity: 0.6 }} />
              кептеліс қосылған көше
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="grid g2" style={{ gap: 12 }}>
              <div>
                <div className="field-label">Қай жерден шығамыз?</div>
                <div className="big-statement">{from ?? '—'}</div>
              </div>
              <div>
                <div className="field-label">Қай жерге барамыз?</div>
                <div className="big-statement">{to ?? '—'}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <ChoiceGroup
                label="Не маңызды?"
                value={metric}
                options={[
                  { v: 'distance', t: 'Ең қысқа (км)' },
                  { v: 'time', t: 'Ең жылдам (мин)' },
                ]}
                onChange={(m) => {
                  setMetric(m);
                  setFound(false);
                  setAltIdx(0);
                  setStep(0);
                }}
              />
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className={`btn btn-primary btn-xl ${ready && !found ? 'pulse' : ''}`} onClick={find} disabled={!ready}>
                <Icon name="route" size={20} /> Жолды табу
              </button>
              <button className="btn btn-xl" onClick={() => setAltIdx((i) => i + 1)} disabled={!found || others.length === 0}>
                Басқа жолды салыстыру
              </button>
            </div>
          </div>
          {found && res && best && (
            <div className="card" aria-live="polite">
              <div className="eyebrow">Нәтиже</div>
              <div className="big-statement" style={{ marginBottom: 10 }}>
                {res.path.join(' → ')}
              </div>
              <div className="big-kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div className="big-kpi">
                  <div className="k">Қашықтық</div>
                  <div className="v">
                    {fmt(best.distance, 0)}
                    <span className="u">км</span>
                  </div>
                </div>
                <div className="big-kpi">
                  <div className="k">Есептік уақыт</div>
                  <div className="v">
                    {fmt(best.time, 0)}
                    <span className="u">мин</span>
                  </div>
                </div>
              </div>
              <p style={{ marginTop: 12 }}>
                <b>Неге бұл жол?</b> {why()}
              </p>
              {alt && (
                <div className="note warn">
                  <b>Басқа жол: {alt.path.join(' → ')}</b> — {fmt(alt.distance, 0)} км, {fmt(alt.time, 0)} мин.{' '}
                  {alt.distance < best.distance && alt.time > best.time
                    ? `Ол ${fmt(best.distance - alt.distance, 0)} км қысқа, бірақ ${fmt(alt.time - best.time, 0)} мин ұзақ жүреміз.`
                    : alt.time < best.time && alt.distance > best.distance
                      ? `Ол ${fmt(best.time - alt.time, 0)} мин жылдам, бірақ ${fmt(alt.distance - best.distance, 0)} км ұзын.`
                      : `Таңдалған жол бұдан ${metric === 'distance' ? `${fmt(alt.distance - best.distance, 0)} км қысқа` : `${fmt(alt.time - best.time, 0)} мин жылдам`}.`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <details className="disclosure section">
        <summary>Математика қалай есептеді? (Дейкстра алгоритмі)</summary>
        {!res ? (
          <p className="muted">Алдымен картадан екі нүктені таңда.</p>
        ) : (
          <DijkstraSteps res={res} step={step} setStep={setStep} metric={metric} from={from!} to={to!} />
        )}
      </details>

      <details className="disclosure section">
        <summary>Қосымша: көшеге кептеліс қосу</summary>
        <p className="small muted">Көшенің жүріп өту уақытын көбейт — маршрут бірден жаңа құнмен қайта есептеледі (тек «Ең жылдам» режимінде әсер етеді).</p>
        <div className="stack" style={{ gap: 8, maxWidth: 560 }}>
          {SEED_GRAPH.edges.map((e) => {
            const k = edgeKey(e.source, e.target);
            const f = factors[k] ?? 1;
            return (
              <label key={k} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                <b style={{ width: 44 }}>{k}</b>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.5}
                  value={f}
                  aria-label={`${k} кептеліс коэффициенті`}
                  onChange={(ev) => {
                    const v = Number(ev.target.value);
                    setFactors((x) => ({ ...x, [k]: v }));
                    setLog((l) => [`${new Date().toLocaleTimeString('kk-KZ')}: ${k} уақыты ×${v.toFixed(1)} — маршрут қайта есептелді`, ...l].slice(0, 12));
                    setStep(0);
                  }}
                />
                <span className="small" style={{ width: 110, textAlign: 'right' }}>
                  ×{f.toFixed(1)} = {fmt(e.time_min * f, 1)} мин
                </span>
              </label>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-sm" onClick={() => setFactors({})}>
            Кептелісті алып тастау
          </button>
        </div>
        {log.length > 0 && (
          <ul className="log" style={{ marginTop: 10 }}>
            {log.map((l, i) => (
              <li key={i} style={{ display: 'block' }}>
                {l}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="disclosure section">
        <summary>Бастапқы деректер кестесі</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Көше</th>
                <th className="num">Қашықтық, км</th>
                <th className="num">Жылдамдық, км/сағ</th>
                <th className="num">Уақыт (зерттеу кестесі), мин</th>
                <th className="num">t = s / v · 60, мин</th>
              </tr>
            </thead>
            <tbody>
              {SEED_GRAPH.edges.map((e) => (
                <tr key={edgeKey(e.source, e.target)}>
                  <td>
                    {e.source}–{e.target}
                  </td>
                  <td className="num">{e.distance_km}</td>
                  <td className="num">{e.speed_kmh}</td>
                  <td className="num">{e.time_min}</td>
                  <td className="num">{fmt(impliedTimeMin(e), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Ғылыми жұмыстағы оқу графы (seed_graph.json). Мәндер — модельдік дерек, геобайланысқан өлшеу емес. Алгоритм алдында барлық салмақ теріс емес екені тексеріледі.
        </p>
      </details>
    </div>
  );
}

function DijkstraSteps({ res, step, setStep, metric, from, to }: { res: ReturnType<typeof dijkstra>; step: number; setStep: (n: number) => void; metric: Metric; from: string; to: string }) {
  const cur = step > 0 ? res.steps[step - 1] : undefined;
  const done = step >= res.steps.length;
  const u = unit(metric);
  let text: string;
  if (!cur) text = `Бастапқыда ${from} нүктесіне дейінгі қашықтық 0, қалған нүктелерге — белгісіз (∞). Карта астында әр нүктеге дейінгі ең жақсы мән жазылады.`;
  else {
    const parts = cur.relaxed.map((r) => (r.improved ? `${r.to}: ${fmt(r.candidate, 1)} ${u} — жақсырақ, жазамыз` : `${r.to}: ${fmt(r.candidate, 1)} ${u} — бұрынғысынан жақсы емес`));
    text = `${cur.index}-қадам. Әлі тексерілмеген нүктелердің ішінен мәні ең аз нүкте — ${cur.current} (${fmt(cur.currentDist, 1)} ${u}). Оның көршілерін тексереміз: ${parts.length ? parts.join('; ') : 'жаңа көрші жоқ'}.`;
    if (cur.current === to) text += ` ${to} нүктесіне жеттік — жауап табылды: ${res.path.join(' → ')}, ${fmt(res.cost, 1)} ${u}.`;
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p style={{ margin: 0 }}>
        Алгоритм әр қадамда <b>ең жақын, әлі тексерілмеген</b> нүктені таңдап, одан көршілеріне дейінгі жолды есептейді. Егер жаңа жол бұрынғыдан қысқа болса, мәнді жаңартады.
      </p>
      <div className="note info" aria-live="polite">
        {text}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Нүкте</th>
              {SEED_GRAPH.nodes.map((n) => (
                <th key={n} className="num">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ең жақсы мән, {u}</td>
              {SEED_GRAPH.nodes.map((n) => {
                const d = cur ? cur.dist[n] : n === from ? 0 : Infinity;
                return (
                  <td key={n} className="num">
                    {d === Infinity ? '∞' : fmt(d, d % 1 ? 1 : 0)}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td>Тексерілді ме?</td>
              {SEED_GRAPH.nodes.map((n) => (
                <td key={n} className="num">
                  {cur?.visited.includes(n) ? '✓' : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <Icon name="arrowL" size={16} /> Артқа
        </button>
        <button className="btn btn-primary" onClick={() => setStep(Math.min(res.steps.length, step + 1))} disabled={done}>
          Келесі қадам <Icon name="arrowR" size={16} />
        </button>
        <span className="small muted">
          {step} / {res.steps.length} қадам
        </span>
      </div>
    </div>
  );
}
