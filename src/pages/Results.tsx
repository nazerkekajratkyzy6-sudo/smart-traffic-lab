import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RLegend, LineChart, Line, LabelList, ErrorBar } from 'recharts';
import { Explain, Hint } from '../components/common';
import { Icon } from '../components/Icon';
import { PairedSection, SourceChiSection, ObservationsSection } from '../components/StatsSections';
import { useStore } from '../lib/store';
import { EXPERIMENTS, aggregate, METRIC_KEYS, METRIC_LABELS } from '../core/experiments';
import { EXP_CONTENT, conclude } from '../lib/labContent';
import { analyzePairs } from '../lib/analysis';
import { compareSentence } from '../lib/presets';
import { QUESTIONS, QuestionId, explain, Answer, compactContext } from '../lib/explain';
import { fmt, fmtInt, fmtTime, MODE_COLOR, MODE_LABEL } from '../lib/format';
import { downloadBlob, downloadJson, downloadText, stamp } from '../lib/download';
import { toCsv } from '../lib/csv';
import { scenarioId } from '../core/scenario';
import { MODEL_VERSION } from '../core/version';
import type { ControlMode } from '../core/scenario';

export default function Results() {
  const experiments = useStore((s) => s.experiments);
  const lastCompare = useStore((s) => s.lastCompare);
  const lastRun = useStore((s) => s.lastRun);
  const log = useStore((s) => s.log);
  const doneIds = EXPERIMENTS.filter((e) => experiments[e.id]).map((e) => e.id);
  const compares = log.filter((l) => l.kind === 'compare').length;
  const e10 = experiments.E10 ?? experiments.E02;
  const pairedAn = useMemo(() => (e10 ? analyzePairs(e10, 0, 'avgWait') : null), [e10]);
  const [expSel, setExpSel] = useState<string>('');
  const selRes = experiments[expSel] ?? experiments[doneIds[doneIds.length - 1]];

  const f = lastCompare?.results.fixed;
  const a = lastCompare?.results.adaptive;
  const sentence = f && a ? compareSentence(f.avgWait, a.avgWait, true) : null;

  // ---- PDF ----
  const [author, setAuthor] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const urlValid = url.trim() === '' || /^https:\/\/\S+$/.test(url.trim());
  const pdf = async () => {
    setBusy(true);
    setErr('');
    try {
      const { buildReport } = await import('../lib/pdf');
      const exp = experiments.E10 ?? (selRes && !selRes.routing ? selRes : null);
      const an = exp && !exp.routing && exp.runs.some((r) => r.mode === 'fixed') && exp.runs.some((r) => r.mode === 'adaptive') ? analyzePairs(exp, 0, 'avgWait') : null;
      const blob = await buildReport({ run: lastCompare ?? lastRun, exp: exp ?? null, analysis: an, includeAuthor: author, url: urlValid ? url : '' });
      downloadBlob(blob, `SMART-TRAFFIC-LAB-esep-${stamp()}.pdf`);
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveAll = () => {
    downloadJson({ app: 'SMART TRAFFIC LAB', modelVersion: MODEL_VERSION, savedAt: new Date().toISOString(), data_type: 'simulated', lastCompare, lastRun, experiments, log }, `SMART-TRAFFIC-LAB-natizheler-${stamp()}.json`);
    const rows: (string | number)[][] = [['# SMART TRAFFIC LAB', MODEL_VERSION, 'виртуалды тәжірибелер (simulated)']];
    if (f && a && lastCompare) {
      rows.push([], ['# Бағдаршамдарды салыстыру', scenarioId(lastCompare.params), `seed ${lastCompare.params.seed}`], ['Бағдаршам', ...METRIC_KEYS.map((k) => METRIC_LABELS[k])]);
      rows.push(['Қарапайым', ...METRIC_KEYS.map((k) => f[k] as number)], ['Ақылды', ...METRIC_KEYS.map((k) => a[k] as number)]);
    }
    for (const id of doneIds) {
      const r = experiments[id];
      if (r.routing) {
        rows.push([], [`# ${id}`, EXP_CONTENT[id].short], ['Қайдан', 'Қайда', 'Жол', 'км', 'мин']);
        for (const x of r.routing) rows.push([x.from, x.to, x.path.join('-'), x.distance, x.time]);
        continue;
      }
      rows.push([], [`# ${id}`, EXP_CONTENT[id].short, `${r.runs.length} симуляция`], ['Нұсқа', 'Бағдаршам', 'Қайталау', 'Seed', 'ID', ...METRIC_KEYS.map((k) => METRIC_LABELS[k])]);
      for (const x of r.runs) rows.push([x.variant, MODE_LABEL[x.mode], x.repeat, x.seed, x.scenarioId, ...METRIC_KEYS.map((k) => x.result[k] as number)]);
    }
    downloadText(toCsv(rows), `SMART-TRAFFIC-LAB-natizheler-${stamp()}.csv`, 'text/csv;charset=utf-8');
  };

  const hasAny = !!lastCompare || doneIds.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Нәтижелер</div>
        <h1>Менің зерттеу нәтижелерім</h1>
        <p className="lead">Барлық сан симуляциядан есептелді. Әр графиктің жанында оны қалай түсіндіруге болатыны жазылған.</p>
      </header>

      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn btn-primary" onClick={saveAll} disabled={!hasAny}>
          <Icon name="save" size={18} /> Нәтижені сақтау
        </button>
        <button className="btn btn-teal" onClick={pdf} disabled={!hasAny || busy}>
          <Icon name="report" size={18} /> {busy ? 'PDF дайындалуда…' : 'PDF жүктеу'}
        </button>
        <Link to="/lab/signals" className="btn">
          <Icon name="reset" size={18} /> Қайта салыстыру
        </Link>
      </div>
      {err && <div className="note bad" style={{ marginBottom: 12 }}>{err}</div>}
      {!hasAny && (
        <div className="card tint" style={{ marginBottom: 18 }}>
          <Hint>Әзірге нәтиже жоқ. Алдымен екі бағдаршамды салыстыр.</Hint>
          <div className="row" style={{ marginTop: 12 }}>
            <Link to="/lab/signals" className="btn btn-primary btn-xl">
              Салыстыруды бастау <Icon name="arrowR" size={18} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid g4">
        <div className="big-kpi">
          <div className="k">Орындалған тәжірибелер</div>
          <div className="v">
            {doneIds.length}
            <span className="u">/ 10</span>
          </div>
          <div className="sub">салыстырулар: {compares}</div>
        </div>
        <div className="big-kpi">
          <div className="k">Орташа күту: қарапайым</div>
          <div className="v">
            {fmt(f?.avgWait, 1)}
            <span className="u">с</span>
          </div>
          <div className="sub">соңғы салыстыру</div>
        </div>
        <div className="big-kpi">
          <div className="k">Орташа күту: ақылды</div>
          <div className="v">
            {fmt(a?.avgWait, 1)}
            <span className="u">с</span>
          </div>
          <div className="sub">соңғы салыстыру</div>
        </div>
        <div className="big-kpi">
          <div className="k">Өткізу қабілеті</div>
          <div className="v" style={{ fontSize: 'clamp(1.3rem, 1rem + 1vw, 1.8rem)' }}>
            {fmtInt(f?.throughputPerHour)} / {fmtInt(a?.throughputPerHour)}
          </div>
          <div className="sub">көлік/сағ · қарапайым / ақылды</div>
        </div>
      </div>

      {f && a && lastCompare && (
        <section className="section">
          <h2>Бағдаршамдарды салыстыру</h2>
          {sentence && <div className={`note ${sentence.tone} big-statement`} style={{ marginBottom: 14 }}>{sentence.text}</div>}
          <div className="grid g2">
            <div className="card">
              <div className="card-head">
                <h3>Күту және кезек</h3>
                <Explain>
                  Бағандар екі бағдаршамды салыстырады: орташа күту уақыты (секунд) және орташа кезек (көлік). Баған аласа болса — жақсы. Екі модель бірдей көлік ағынымен (seed {lastCompare.params.seed}) есептелді.
                </Explain>
              </div>
              <div className="chart-box">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      { name: 'Орташа күту, с', fixed: +f.avgWait.toFixed(1), adaptive: +a.avgWait.toFixed(1) },
                      { name: 'Орташа кезек, көлік', fixed: +f.avgQueue.toFixed(1), adaptive: +a.avgQueue.toFixed(1) },
                      { name: 'Ең үлкен кезек, көлік', fixed: f.maxQueue, adaptive: a.maxQueue },
                    ]}
                    margin={{ top: 22, right: 8, left: -6, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#e6ebf0" vertical={false} />
                    <XAxis dataKey="name" fontSize={13} interval={0} />
                    <YAxis fontSize={13} />
                    <Tooltip formatter={(v: number, n: string) => [fmt(v, 1), MODE_LABEL[n as ControlMode]]} />
                    <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} />
                    <Bar dataKey="fixed" fill={MODE_COLOR.fixed} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="fixed" position="top" fontSize={12} formatter={(v: number) => fmt(v, v < 10 ? 1 : 0)} />
                    </Bar>
                    <Bar dataKey="adaptive" fill={MODE_COLOR.adaptive} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      <LabelList dataKey="adaptive" position="top" fontSize={12} formatter={(v: number) => fmt(v, v < 10 ? 1 : 0)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Кезек уақыт бойынша</h3>
                <Explain>Көлденең ось — уақыт (минут), тік ось — тоқтап тұрған көліктер саны. Сызық төмен болса, кептеліс аз. Тістер — қызыл сигнал кезіндегі кезектер.</Explain>
              </div>
              <div className="chart-box">
                <ResponsiveContainer>
                  <LineChart data={f.series.map((p, i) => ({ t: p.t, fixed: p.queue, adaptive: a.series[i]?.queue }))} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                    <CartesianGrid stroke="#e6ebf0" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${Math.round(v / 60)}`} fontSize={13} minTickGap={28} label={{ value: 'мин', position: 'insideBottomRight', offset: -2, fontSize: 12 }} />
                    <YAxis fontSize={13} allowDecimals={false} />
                    <Tooltip formatter={(v: number, n: string) => [v, MODE_LABEL[n as ControlMode]]} labelFormatter={(v) => `t = ${fmtTime(Number(v))}`} />
                    <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} />
                    <Line dataKey="fixed" stroke={MODE_COLOR.fixed} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line dataKey="adaptive" stroke={MODE_COLOR.adaptive} dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {pairedAn && e10 && (
        <section className="section">
          <h2>Нәтиже кездейсоқ емес пе?</h2>
          <div className={`note ${pairedAn.significant ? 'ok' : 'warn'}`}>
            <b>{e10.experiment === 'E10' ? '10-тәжірибе' : '2-тәжірибе'} ({pairedAn.n} қайталау):</b> {pairedAn.verdict}
          </div>
        </section>
      )}

      {doneIds.length > 0 && selRes && (
        <section className="section">
          <h2>Тәжірибелер</h2>
          <div className="grid split-r">
            <div className="card">
              <div className="card-head">
                <label className="field" style={{ minWidth: 240 }}>
                  <span>Тәжірибе</span>
                  <select value={selRes.experiment} onChange={(e) => setExpSel(e.target.value)}>
                    {doneIds.map((id) => (
                      <option key={id} value={id}>
                        {EXPERIMENTS.findIndex((x) => x.id === id) + 1}. {EXP_CONTENT[id].short}
                      </option>
                    ))}
                  </select>
                </label>
                {!selRes.routing && <Explain>Әр баған — орташа күту уақытының (секунд) барлық қайталаудағы орташасы. Сызықша — қайталаулар арасындағы шашырау. Сұр — қарапайым, көк-жасыл — ақылды бағдаршам.</Explain>}
              </div>
              {selRes.routing ? (
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {selRes.routing.map((r) => (
                        <tr key={r.from + r.to} className={r.differs ? 'hl' : ''}>
                          <td>
                            {r.from} → {r.to}
                          </td>
                          <td>{r.path.join('–')}</td>
                          <td className="num">{fmt(r.distance, 0)} км</td>
                          <td className="num">{fmt(r.time, 0)} мин</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ExpChart res={selRes} />
              )}
            </div>
            <div className="card tint">
              <div className="eyebrow">Қорытынды</div>
              <p className="big-statement" style={{ fontSize: '1.15rem' }}>
                {conclude(selRes).headline}
              </p>
              <Link to={`/lab/${selRes.experiment}`} className="btn btn-sm">
                Тәжірибені ашу
              </Link>
            </div>
          </div>
          <div className="table-wrap section" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тәжірибе</th>
                  <th>Негізгі нәтиже</th>
                  <th className="num">Есептеу</th>
                </tr>
              </thead>
              <tbody>
                {doneIds.map((id) => (
                  <tr key={id}>
                    <td className="num">{EXPERIMENTS.findIndex((x) => x.id === id) + 1}</td>
                    <td>{EXP_CONTENT[id].short}</td>
                    <td>{conclude(experiments[id]).headline}</td>
                    <td className="num">{experiments[id].runs.length || experiments[id].routing?.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section stack">
        <details className="disclosure">
          <summary>Нәтижені түсіндір (ережеге негізделген көмекші)</summary>
          <AssistantBlock />
        </details>
        <details className="disclosure">
          <summary>Статистикалық тексеріс: жұптық салыстыру</summary>
          <PairedSection />
        </details>
        <details className="disclosure">
          <summary>Ғылыми жұмыстағы χ² есебін қайта тексеру</summary>
          <SourceChiSection />
        </details>
        <details className="disclosure">
          <summary>Нақты бақылауларды қосу (көзі көрсетілген CSV)</summary>
          <ObservationsSection />
        </details>
        <details className="disclosure">
          <summary>PDF есеп баптаулары</summary>
          <div className="stack" style={{ maxWidth: 560 }}>
            <label className="check">
              <input type="checkbox" checked={author} onChange={(e) => setAuthor(e.target.checked)} /> Автор мен жетекшінің аты-жөнін көрсету
            </label>
            <label className="field">
              <span>
                Жарияланған сайт сілтемесі <span className="hint">· QR-код тек нақты https сілтеме болса қосылады</span>
              </span>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…vercel.app" aria-invalid={!urlValid} />
            </label>
            <p className="small muted" style={{ margin: 0 }}>
              Есепке соңғы салыстыру және 10-тәжірибе (болмаса — таңдалған тәжірибе) енеді: әдістеме, параметрлер, seed, кестелер, графиктер, шектеулер және қорытынды.
            </p>
          </div>
        </details>
        {log.length > 0 && (
          <details className="disclosure">
            <summary>Жасалған жұмыстар тізімі ({log.length})</summary>
            <ul className="log">
              {log.map((l, i) => (
                <li key={i} style={{ gridTemplateColumns: '140px 1fr' }}>
                  <span>{new Date(l.at).toLocaleString('kk-KZ')}</span>
                  <span>{l.label}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function ExpChart({ res }: { res: NonNullable<ReturnType<typeof useStore.getState>['experiments'][string]> }) {
  const agg = aggregate(res);
  const variants = [...new Set(agg.map((a) => a.variant))];
  const modes = [...new Set(agg.map((a) => a.mode))];
  const data = variants.map((v) => {
    const row: Record<string, string | number> = { variant: v };
    for (const a of agg.filter((x) => x.variant === v)) {
      row[a.mode] = +a.means.avgWait.toFixed(1);
      row[`${a.mode}_e`] = Number.isFinite(a.sds.avgWait) ? +a.sds.avgWait.toFixed(1) : 0;
    }
    return row;
  });
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#e6ebf0" vertical={false} />
          <XAxis dataKey="variant" fontSize={13} />
          <YAxis fontSize={13} label={{ value: 'күту, с', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }} />
          <Tooltip formatter={(v: number, n: string) => [fmt(v, 1), MODE_LABEL[n as ControlMode] ?? n]} />
          <RLegend formatter={(v) => (v === 'fixed' ? 'Қарапайым' : 'Ақылды')} />
          {modes.map((m) => (
            <Bar key={m} dataKey={m} fill={MODE_COLOR[m]} radius={[6, 6, 0, 0]} isAnimationActive={false}>
              <ErrorBar dataKey={`${m}_e`} width={6} stroke="#172b4d" strokeWidth={1} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssistantBlock() {
  const run = useStore((s) => s.lastCompare ?? s.lastRun);
  const experiments = useStore((s) => s.experiments);
  const exp = experiments.E10 ?? experiments.E02;
  const analysis = useMemo(() => (exp ? analyzePairs(exp, 0, 'avgWait') : null), [exp]);
  const [answers, setAnswers] = useState<{ q: QuestionId; a: Answer | null; llm?: string; llmErr?: string }[]>([]);
  const ctx = { run, analysis, analysisLabel: exp ? `${exp.experiment} «${exp.title}»` : undefined };
  const [llm, setLlm] = useState<'unknown' | 'on' | 'off'>('unknown');
  const [useLlm, setUseLlm] = useState(false);
  const checkLlm = async () => {
    try {
      const r = await fetch('/api/assistant', { headers: { accept: 'application/json' } });
      const j = r.ok && (r.headers.get('content-type') ?? '').includes('application/json') ? await r.json() : { enabled: false };
      setLlm(j.enabled ? 'on' : 'off');
    } catch {
      setLlm('off');
    }
  };
  const ask = async (q: QuestionId) => {
    const a = explain(q, ctx);
    setAnswers((l) => [{ q, a }, ...l.filter((x) => x.q !== q)]);
    if (!(useLlm && llm === 'on' && a)) return;
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: QUESTIONS.find((x) => x.id === q)!.text, context: compactContext(ctx) }) });
      const j = await r.json();
      setAnswers((l) => l.map((x) => (x.q === q ? { ...x, llm: r.ok ? j.text : undefined, llmErr: r.ok ? undefined : j.error ?? 'Қате' } : x)));
    } catch {
      setAnswers((l) => l.map((x) => (x.q === q ? { ...x, llmErr: 'Серверге қосылу мүмкін болмады' } : x)));
    }
  };
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Жауаптар тек есептелген сандар бойынша алдын ала жазылған ережелермен құрылады — генеративті модель қолданылмайды.
      </p>
      <div className="row">
        {QUESTIONS.map((q) => (
          <button key={q.id} className="btn btn-sm" onClick={() => ask(q.id)}>
            <Icon name="bulb" size={16} /> {q.text}
          </button>
        ))}
      </div>
      <div className="row small">
        {llm === 'unknown' && (
          <button className="btn btn-sm btn-ghost" onClick={checkLlm}>
            Серверлік тілдік модель (LLM) бар-жоғын тексеру
          </button>
        )}
        {llm === 'off' && <span className="muted">LLM қосылмаған (Vercel-де ANTHROPIC_API_KEY орнатылмаған). Барлық жауап жергілікті ережелерден.</span>}
        {llm === 'on' && (
          <label className="check">
            <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} /> Қосымша LLM түсіндірмесін сұрау
          </label>
        )}
      </div>
      {answers.map(({ q, a, llm: llmText, llmErr }) => (
        <div className="card flat" key={q}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>{QUESTIONS.find((x) => x.id === q)!.text}</h3>
            <span className="badge teal">Ережеге негізделген түсіндірме</span>
          </div>
          {a ? (
            <>
              <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                {a.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <div className="note info">
                <b>Қорытынды:</b> {a.conclusion}
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Деректер жоқ. Алдымен <Link to="/lab/signals">салыстыруды</Link> жаса.
            </p>
          )}
          {llmText && (
            <div className="note warn" style={{ marginTop: 10 }}>
              <span className="badge warn">Генеративті мәтін (LLM) — сандық есептеу емес</span>
              <p style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{llmText}</p>
            </div>
          )}
          {llmErr && <p className="small" style={{ color: 'var(--red)' }}>LLM: {llmErr}</p>}
        </div>
      ))}
    </div>
  );
}
