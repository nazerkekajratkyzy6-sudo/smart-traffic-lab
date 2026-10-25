import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter, ReferenceLine, ZAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { DataBadge } from './common';
import { Icon } from './Icon';
import { useStore, Observation } from '../lib/store';
import { analyzePairs, pairedExperiments, variantsOf } from '../lib/analysis';
import { METRIC_KEYS, METRIC_LABELS, MetricKey } from '../core/experiments';
import { chiSquare, fisherExact, fmtP, describe, welchTTest, mannWhitney, shapiroWilk } from '../core/stats';
import { fmt, MODE_COLOR } from '../lib/format';
import { parseCsv, parseNum, toCsv } from '../lib/csv';
import { downloadText } from '../lib/download';

export function PairedSection() {
  const all = useStore((s) => s.experiments);
  const list = pairedExperiments(all);
  const [expId, setExpId] = useState<string>('');
  const res = list.find((e) => e.experiment === expId) ?? list.find((e) => e.experiment === 'E10') ?? list[0];
  const variants = res ? variantsOf(res) : [];
  const [vi, setVi] = useState(0);
  const [metric, setMetric] = useState<MetricKey>('avgWait');
  const vIdx = variants.some(([i]) => i === vi) ? vi : (variants[0]?.[0] ?? 0);
  const an = useMemo(() => (res ? analyzePairs(res, vIdx, metric) : null), [res, vIdx, metric]);

  if (!res)
    return (
      <section>
        <div className="card tint">
          <h3>Жұптық деректер әлі жоқ</h3>
          <p className="small">
            <Link to="/lab/E10">10-тәжірибені</Link> (30 қайталау) немесе <Link to="/lab/E02">2-тәжірибені</Link> жасаңыз.
          </p>
        </div>
      </section>
    );

  const hist = (() => {
    if (!an || !an.diffs.length) return [];
    const mn = Math.min(...an.diffs);
    const mx = Math.max(...an.diffs);
    const bins = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(an.diffs.length))));
    const w = (mx - mn) / bins || 1;
    const out = Array.from({ length: bins }, (_, i) => ({ x: `${fmt(mn + i * w, 1)}…${fmt(mn + (i + 1) * w, 1)}`, c: 0 }));
    for (const d of an.diffs) out[Math.min(bins - 1, Math.floor((d - mn) / w))].c++;
    return out;
  })();
  const scatter = an ? an.seeds.map((s, i) => ({ seed: s, d: Number(an.diffs[i].toFixed(3)) })) : [];

  const exportPairs = () => {
    if (!an) return;
    const rows: (string | number)[][] = [['Тәжірибе', res.experiment], ['Нұсқа', variants.find(([i]) => i === vIdx)?.[1] ?? ''], ['Көрсеткіш', METRIC_LABELS[metric]], [], ['Seed', 'Тұрақты', 'Адаптивті', 'Айырма (тұрақты − адаптивті)']];
    const val = (s: number, mode: 'fixed' | 'adaptive') => (res.runs.find((r) => r.seed === s && r.mode === mode && r.variantIndex === vIdx)?.result[metric] as number | undefined) ?? '';
    an.seeds.forEach((s, i) => rows.push([s, val(s, 'fixed'), val(s, 'adaptive'), an.diffs[i]]));
    rows.push([], ['n', an.n], ['Айырма орташасы', an.diff.mean], ['SD', an.diff.sd], ['95% СА төмен', an.diff.ci95?.[0] ?? ''], ['95% СА жоғары', an.diff.ci95?.[1] ?? ''], ['t', an.t?.t ?? ''], ['df', an.t?.df ?? ''], ['p (t-тест)', an.t?.p ?? ''], ['p (Уилкоксон)', an.w?.p ?? ''], ['Шапиро–Уилк W', an.normal?.W ?? ''], ['Шапиро–Уилк p', an.normal?.p ?? ''], ['Қорытынды', an.verdict]);
    downloadText(toCsv(rows), `stats-${res.experiment}-${metric}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <section aria-labelledby="pair-h">
      <div className="card">
        <div className="grid g3" style={{ gap: 10 }}>
          <label className="field">
            <span>Тәжірибе</span>
            <select value={res.experiment} onChange={(e) => setExpId(e.target.value)}>
              {list.map((e) => (
                <option key={e.experiment} value={e.experiment}>
                  {e.experiment} · {e.title} ({e.repeats} seed)
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Нұсқа</span>
            <select value={vIdx} onChange={(e) => setVi(Number(e.target.value))}>
              {variants.map(([i, l]) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Көрсеткіш</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {METRIC_KEYS.filter((k) => k !== 'generated').map((k) => (
                <option key={k} value={k}>
                  {METRIC_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {an && (
        <>
          <div className="grid g4" style={{ marginTop: 16 }}>
            <div className="kpi">
              <div className="k">Жұптар саны n</div>
              <div className="v">{an.n}</div>
            </div>
            <div className="kpi">
              <div className="k">Тұрақты: орташа ± SD</div>
              <div className="v" style={{ fontSize: '1.05rem' }}>
                {fmt(an.fixed.mean, 2)} ± {fmt(an.fixed.sd, 2)}
              </div>
            </div>
            <div className="kpi">
              <div className="k">Адаптивті: орташа ± SD</div>
              <div className="v" style={{ fontSize: '1.05rem' }}>
                {fmt(an.adaptive.mean, 2)} ± {fmt(an.adaptive.sd, 2)}
              </div>
            </div>
            <div className="kpi">
              <div className="k">Орташалар бойынша жақсару</div>
              <div className="v" style={{ fontSize: '1.05rem' }}>
                {an.improvementOfMeans === null ? '—' : `${fmt(an.improvementOfMeans, 1)}%`}
              </div>
            </div>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Критерийлер</h3>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <tr>
                      <td>Айырма d = тұрақты − адаптивті: орташа</td>
                      <td className="num">{fmt(an.diff.mean, 3)}</td>
                    </tr>
                    <tr>
                      <td>95% сенім аралығы (t, df = {an.n - 1})</td>
                      <td className="num">{an.diff.ci95 ? `[${fmt(an.diff.ci95[0], 3)}; ${fmt(an.diff.ci95[1], 3)}]` : '—'}</td>
                    </tr>
                    <tr className={an.primary === 'paired-t' ? 'hl' : ''}>
                      <td>Жұптық t-тест: t, p</td>
                      <td className="num">{an.t ? `${fmt(an.t.t, 3)}; ${fmtP(an.t.p)}` : '—'}</td>
                    </tr>
                    <tr className={an.primary === 'wilcoxon' ? 'hl' : ''}>
                      <td>Уилкоксон ({an.w?.method === 'exact' ? 'нақты' : 'қалыпты жуықтау'}): W⁺, p</td>
                      <td className="num">{an.w ? `${fmt(an.w.W, 1)}; ${fmtP(an.w.p)}` : '—'}</td>
                    </tr>
                    <tr>
                      <td>Шапиро–Уилк (айырмалардың қалыптылығы): W, p</td>
                      <td className="num">{an.normal ? `${fmt(an.normal.W, 3)}; ${fmtP(an.normal.p)}` : '—'}</td>
                    </tr>
                    <tr>
                      <td>Әсер өлшемі Коэн d_z</td>
                      <td className="num">{an.t ? fmt(an.t.cohenDz, 2) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                Негізгі критерий: қалыптылық болжамы бұзылмаса — жұптық t-тест, әйтпесе — Уилкоксон. Маңыздылық деңгейі α = 0,05.
              </p>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Қорытынды</h3>
                <span className={`badge ${an.significant ? 'ok' : 'warn'}`}>{an.significant ? 'критерий өтті' : 'критерий өтпеді'}</span>
              </div>
              <p>{an.verdict}</p>
              {an.cautions.map((c) => (
                <div key={c} className="note warn small" style={{ marginBottom: 6 }}>
                  {c}
                </div>
              ))}
              <button className="btn btn-sm" onClick={exportPairs} style={{ marginTop: 6 }}>
                <Icon name="download" size={15} /> CSV: жұптар және критерийлер
              </button>
            </div>
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Айырмалар гистограммасы</h3>
              <div className="chart-box sm">
                <ResponsiveContainer>
                  <BarChart data={hist} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e6ebf0" vertical={false} />
                    <XAxis dataKey="x" fontSize={10} interval={0} angle={-25} height={44} textAnchor="end" />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, 'жиілік']} />
                    <Bar dataKey="c" fill={MODE_COLOR.adaptive} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3>Әр seed бойынша айырма</h3>
              <div className="chart-box sm">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#e6ebf0" />
                    <XAxis dataKey="seed" type="number" domain={['dataMin', 'dataMax']} fontSize={12} name="seed" />
                    <YAxis dataKey="d" type="number" fontSize={12} name="d" />
                    <ZAxis range={[40, 40]} />
                    <ReferenceLine y={0} stroke="#9aa7b4" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={scatter} fill={MODE_COLOR.adaptive} isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function SourceChiSection() {
  const table = [
    [1, 2],
    [3, 0],
  ];
  const r = chiSquare(table);
  const fp = fisherExact(table);
  return (
    <section aria-labelledby="chi-h">
      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <h3>Жиілік кестесі (PDF, 2.5.3)</h3>
            <DataBadge />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Төмен кептеліс</th>
                  <th className="num">Жоғары кептеліс</th>
                  <th className="num">Барлығы</th>
                </tr>
              </thead>
              <tbody>
                {['Тұрақты жүйе', 'Адаптивті жүйе'].map((nm, i) => (
                  <tr key={nm}>
                    <td>{nm}</td>
                    <td className="num">
                      {table[i][0]} <span className="muted">(E = {fmt(r.expected[i][0], 2)})</span>
                    </td>
                    <td className="num">
                      {table[i][1]} <span className="muted">(E = {fmt(r.expected[i][1], 2)})</span>
                    </td>
                    <td className="num">{table[i][0] + table[i][1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            E — күтілетін жиілік = (жол қосындысы × баған қосындысы) / N, N = 6.
          </p>
        </div>
        <div className="card">
          <h3>Қайта есептеу нәтижесі</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td>Пирсон χ², df = {r.df}</td>
                  <td className="num">
                    {fmt(r.chi2, 2)}; p = {fmtP(r.p)}
                  </td>
                </tr>
                <tr>
                  <td>Йейтс түзетуімен χ²</td>
                  <td className="num">
                    {fmt(r.yates!.chi2, 2)}; p = {fmtP(r.yates!.p)}
                  </td>
                </tr>
                <tr>
                  <td>Фишердің нақты тесті (екі жақты)</td>
                  <td className="num">p = {fmtP(fp)}</td>
                </tr>
                <tr>
                  <td>Ең кіші күтілетін жиілік</td>
                  <td className="num">{fmt(r.minExpected, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="note warn" style={{ marginTop: 12 }}>
            <p>
              Бастапқы жұмыста χ² = 4,80 және p ≈ 0,028 көрсетілген, бірақ осы кесте бойынша Пирсон χ² = {fmt(r.chi2, 2)}, p ≈ {fmtP(r.p)}. Барлық күтілетін жиілік 5-тен кіші (N = 6), сондықтан χ² жуықтауы сенімсіз; Фишердің нақты тесті p = {fmtP(fp)} береді.
            </p>
            <p>Демек, бұл кесте негізінде басқару түрі мен кептеліс арасындағы байланыс статистикалық дәлелденді деп айтуға болмайды. Сенімді қорытынды үшін көп қайталаулы симуляция (E10) немесе көлемді бақылау деректері қажет.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ObservationsSection() {
  const obs = useStore((s) => s.observations);
  const add = useStore((s) => s.addObservation);
  const remove = useStore((s) => s.removeObservation);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const importNow = () => {
    if (!source.trim()) {
      setMsg({ ok: false, t: 'Деректер көзін көрсетіңіз (кім, қашан, қай жерде өлшеді).' });
      return;
    }
    const rows = parseCsv(text);
    const out: Observation['rows'] = [];
    const bad: number[] = [];
    rows.forEach((r, i) => {
      if (r.length < 2) return;
      const g = r[0].trim().toLowerCase();
      const v = parseNum(r[1]);
      const group = ['fixed', 'тұрақты', 'фиксированный', '1'].includes(g) ? 'fixed' : ['adaptive', 'адаптивті', 'адаптивный', '2'].includes(g) ? 'adaptive' : null;
      if (i === 0 && !group) return; // тақырып жолы
      if (!group || !Number.isFinite(v) || v < 0) bad.push(i + 1);
      else out.push({ group, value: v });
    });
    if (bad.length) {
      setMsg({ ok: false, t: `Қате жолдар: ${bad.slice(0, 10).join(', ')}. Формат: топ;мән (топ — тұрақты/адаптивті, мән ≥ 0).` });
      return;
    }
    if (!out.some((o) => o.group === 'fixed') || !out.some((o) => o.group === 'adaptive')) {
      setMsg({ ok: false, t: 'Екі топтың да деректері қажет.' });
      return;
    }
    add({ id: `OBS-${Date.now().toString(36).toUpperCase()}`, source: source.trim(), note: note.trim(), createdAt: new Date().toISOString(), rows: out });
    setMsg({ ok: true, t: `${out.length} бақылау импортталды.` });
    setText('');
  };

  return (
    <section aria-labelledby="obs-h">
      <div className="grid g2">
        <div className="card">
          <p className="small muted">
            Нақты өлшеулер (мысалы, қиылыстағы күту уақыты, с) тек көзі көрсетілгенде қабылданады. Бақылаулар симуляция нәтижелерімен араласпайды және тәуелсіз іріктемелер ретінде талданады (Уэлч t-тесті, Манн–Уитни).
          </p>
          <label className="field">
            <span>Деректер көзі *</span>
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="мыс.: оқушы бақылауы, 2026-10-20, 08:00–09:00, қиылыс атауы" />
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Ескерту</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="өлшеу әдісі, құрал" />
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            <span>CSV (топ;мән)</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'топ;мән\nтұрақты;58\nадаптивті;34'} />
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={importNow} disabled={!text.trim()}>
              <Icon name="upload" size={15} /> Импорттау
            </button>
            <label className="btn btn-sm">
              Файл таңдау
              <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => setText((await e.target.files?.[0]?.text()) ?? '')} />
            </label>
          </div>
          {msg && (
            <div className={`note ${msg.ok ? 'ok' : 'bad'} small`} style={{ marginTop: 8 }} role="status">
              {msg.t}
            </div>
          )}
        </div>
        <div className="stack">
          {obs.length === 0 && <div className="card tint small">Импортталған бақылау жоқ.</div>}
          {obs.map((o) => {
            const f = o.rows.filter((r) => r.group === 'fixed').map((r) => r.value);
            const a = o.rows.filter((r) => r.group === 'adaptive').map((r) => r.value);
            const df = describe(f);
            const da = describe(a);
            const w = welchTTest(f, a);
            const mw = mannWhitney(f, a);
            const nf = shapiroWilk(f);
            const na = shapiroWilk(a);
            return (
              <div className="card" key={o.id}>
                <div className="card-head">
                  <div>
                    <DataBadge kind="observed" /> <span className="mono small">{o.id}</span>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => remove(o.id)} aria-label="Өшіру">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                <p className="small">
                  <b>Көзі:</b> {o.source}
                  {o.note && ` · ${o.note}`}
                </p>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr>
                        <td>Тұрақты: n, орташа ± SD</td>
                        <td className="num">
                          {df.n}; {fmt(df.mean, 2)} ± {fmt(df.sd, 2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Адаптивті: n, орташа ± SD</td>
                        <td className="num">
                          {da.n}; {fmt(da.mean, 2)} ± {fmt(da.sd, 2)}
                        </td>
                      </tr>
                      <tr>
                        <td>Уэлч t-тесті: p; айырманың 95% СА</td>
                        <td className="num">{w ? `${fmtP(w.p)}; [${fmt(w.ci95[0], 2)}; ${fmt(w.ci95[1], 2)}]` : '—'}</td>
                      </tr>
                      <tr>
                        <td>Манн–Уитни: p</td>
                        <td className="num">{mw ? fmtP(mw.p) : '—'}</td>
                      </tr>
                      <tr>
                        <td>Шапиро–Уилк p (тұрақты / адаптивті)</td>
                        <td className="num">
                          {nf ? fmtP(nf.p) : '—'} / {na ? fmtP(na.p) : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {df.n < 10 || da.n < 10 ? 'Іріктеме кіші — нәтиже бағдарлық сипатта. ' : ''}
                  {w && w.p < 0.05 ? 'Айырмашылық α = 0,05 деңгейінде маңызды, бірақ бақылау жағдайлары бірдей болғанын тексеріңіз.' : 'Айырмашылық α = 0,05 деңгейінде маңызды емес немесе бағалау мүмкін емес.'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
