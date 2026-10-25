import { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ReferenceDot } from 'recharts';
import { DataBadge, NumField } from './common';
import { flow, greenshieldsSpeed, greenshieldsCapacity, poissonPmf, SOURCE_FLOW_EXAMPLES, SOURCE_WAIT_EXAMPLES, flowRate } from '../core/flow';
import { mean } from '../core/stats';
import { improvementPct } from '../core/engine';
import { fmt } from '../lib/format';

export function FlowSection() {
  const [rho, setRho] = useState(80);
  const [v, setV] = useState(30);
  const [lanes, setLanes] = useState(1);
  const [perLane, setPerLane] = useState(true);
  let res: ReturnType<typeof flow> | null = null;
  let err = '';
  try {
    res = flow({ density: rho, speed: v, lanes, densityPerLane: perLane });
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <section aria-labelledby="flow-h">
      <div className="grid g2">
        <div className="card">
          <p>
            <span className="formula">q = ρ · v</span>
          </p>
          <p className="small muted">
            q — қарқындылық [авт./сағ], ρ — тығыздық [авт./км], v — орташа жылдамдық [км/сағ]. Бірлік тексерісі: [авт./км] × [км/сағ] = [авт./сағ].
          </p>
          <div className="grid g3" style={{ gap: 10 }}>
            <NumField label="ρ, авт./км" value={rho} min={0} onChange={setRho} />
            <NumField label="v, км/сағ" value={v} min={0} onChange={setV} />
            <NumField label="Жолақ саны" value={lanes} min={1} max={6} onChange={(x) => setLanes(Math.max(1, Math.round(x || 1)))} />
          </div>
          <label className="check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={perLane} onChange={(e) => setPerLane(e.target.checked)} /> Тығыздық бір жолаққа берілген
          </label>
          <div style={{ marginTop: 14 }} aria-live="polite">
            {err ? (
              <div className="note bad">{err}</div>
            ) : (
              res && (
                <div className="kpis">
                  <div className="kpi">
                    <div className="k">Жалпы ағын q</div>
                    <div className="v">
                      {fmt(res.q, 0)}
                      <span className="u">авт./сағ</span>
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="k">Бір жолаққа</div>
                    <div className="v">
                      {fmt(res.qPerLane, 0)}
                      <span className="u">авт./сағ</span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Бастапқы зерттеудегі сценарийлер</h3>
            <DataBadge />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">ρ, авт./км</th>
                  <th className="num">v, км/сағ</th>
                  <th className="num">q (PDF)</th>
                  <th className="num">q = ρ·v</th>
                  <th>Тексеріс</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_FLOW_EXAMPLES.map((e) => {
                  const q = flowRate(e.rho, e.v);
                  return (
                    <tr key={e.rho}>
                      <td className="num">{e.rho}</td>
                      <td className="num">{e.v}</td>
                      <td className="num">{e.q}</td>
                      <td className="num">{q}</td>
                      <td>{q === e.q ? <span className="badge ok">сәйкес</span> : <span className="badge bad">сәйкес емес</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Жолақ саны бастапқы кестеде көрсетілмеген, сондықтан q бір жолаққа немесе бүкіл қимаға қатысты екенін ажырату керек. Тығыздық артқанда ағын алдымен өсіп, кейін азаяды — бұл төмендегі гипотезамен тексеріледі.
          </p>
        </div>
      </div>
    </section>
  );
}

export function GreenshieldsSection() {
  const [vFree, setVFree] = useState(60);
  const [rhoJam, setRhoJam] = useState(150);
  const valid = vFree >= 0 && rhoJam > 0;
  const data = useMemo(() => {
    if (!valid) return [];
    const out: { rho: number; v: number; q: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const rho = (rhoJam * i) / 60;
      const v = greenshieldsSpeed(rho, vFree, rhoJam);
      out.push({ rho: Math.round(rho * 10) / 10, v: Math.round(v * 10) / 10, q: Math.round(rho * v) });
    }
    return out;
  }, [vFree, rhoJam, valid]);
  const cap = valid ? greenshieldsCapacity(vFree, rhoJam) : null;
  const pts = SOURCE_FLOW_EXAMPLES.map((e) => ({ rho: e.rho, src: e.v }));
  return (
    <section aria-labelledby="gs-h">
      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <span className="formula">v(ρ) = v_free · max(0, 1 − ρ/ρ_jam)</span>
            <DataBadge kind="hypothesis" />
          </div>
          <p className="small muted">
            Гриншилдс моделі — өңделетін гипотеза. Ол өлшеулерді алмастырмайды: параметрлерді нақты бақылаумен калибрлеу қажет.
          </p>
          <div className="grid g2" style={{ gap: 10 }}>
            <NumField label="v_free, км/сағ" value={vFree} min={0} onChange={setVFree} />
            <NumField label="ρ_jam, авт./км" value={rhoJam} min={1} onChange={setRhoJam} />
          </div>
          {cap && (
            <div className="kpis" style={{ marginTop: 12 }}>
              <div className="kpi">
                <div className="k">Максимал ағын q_max = v_free·ρ_jam/4</div>
                <div className="v">
                  {fmt(cap.qMax, 0)}
                  <span className="u">авт./сағ</span>
                </div>
              </div>
              <div className="kpi">
                <div className="k">Кризистік тығыздық ρ_jam/2</div>
                <div className="v">
                  {fmt(cap.rhoCrit, 0)}
                  <span className="u">авт./км</span>
                </div>
              </div>
            </div>
          )}
          <p className="small" style={{ marginTop: 12 }}>
            Нүктелер — бастапқы PDF-тегі үш сценарий (ρ, v). Олар гипотезаға «дәлел» емес: тек салыстыру үшін көрсетілген.
          </p>
        </div>
        <div className="card">
          <h3>v(ρ) және q(ρ)</h3>
          <div className="chart-box" style={{ height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                <CartesianGrid stroke="#e6ebf0" />
                <XAxis dataKey="rho" type="number" domain={[0, rhoJam]} fontSize={12} label={{ value: 'ρ, авт./км', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                <YAxis yAxisId="v" fontSize={12} />
                <YAxis yAxisId="q" orientation="right" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line yAxisId="v" dataKey="v" name="v(ρ), км/сағ" stroke="#0f5fa8" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line yAxisId="q" dataKey="q" name="q(ρ), авт./сағ" stroke="#0e7f78" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Scatter yAxisId="v" data={pts} dataKey="src" name="PDF мысалы (v)" fill="#b77900" />
                {cap && <ReferenceDot yAxisId="q" x={Math.round(cap.rhoCrit * 10) / 10} y={cap.qMax} r={4} fill="#0e7f78" stroke="#fff" />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PoissonSection() {
  const [rate, setRate] = useState(300);
  const [interval, setIntervalSec] = useState(60);
  const lambda = Math.max(0, (rate * interval) / 3600);
  const kMax = Math.max(8, Math.ceil(lambda + 4 * Math.sqrt(lambda + 1)));
  const data = Array.from({ length: kMax + 1 }, (_, k) => ({ k, p: Number((poissonPmf(k, lambda) * 100).toFixed(2)) }));
  const p0 = poissonPmf(0, lambda);
  return (
    <section aria-labelledby="ps-h">
      <div className="grid g2">
        <div className="card">
          <p>
            <span className="formula">P(k) = λ^k · e^(−λ) / k!,&nbsp; λ = q · Δt</span>
          </p>
          <p className="small muted">Симуляцияда келулер Пуассон ағыны ретінде генерацияланады (аралықтар экспоненциал үлестірілген); шың профилінде — біртекті емес ағын (thinning әдісі).</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <NumField label="q, авт./сағ" value={rate} min={0} onChange={setRate} />
            <NumField label="Δt, с" value={interval} min={1} onChange={setIntervalSec} />
          </div>
          <p style={{ marginTop: 12 }}>
            λ = {fmt(lambda, 2)} көлік / аралық. Аралықта бірде-бір көлік келмеу ықтималдығы: <b>{fmt(p0 * 100, 1)}%</b>.
          </p>
        </div>
        <div className="card">
          <h3>P(k), %</h3>
          <div className="chart-box sm">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf0" vertical={false} />
                <XAxis dataKey="k" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'P(k)']} labelFormatter={(k) => `k = ${k}`} />
                <Bar dataKey="p" fill="#0f5fa8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdaptiveSection() {
  const [alpha, setAlpha] = useState(0.1);
  const [rows, setRows] = useState([
    { N: 6, W: 25 },
    { N: 2, W: 40 },
    { N: 3, W: 10 },
    { N: 0, W: 0 },
  ]);
  const [cur, setCur] = useState(0);
  const [elapsed, setElapsed] = useState(15);
  const minGreen = 10;
  const maxGreen = 60;
  const S = rows.map((r) => r.N + alpha * r.W);
  let best = -1;
  S.forEach((s, i) => {
    if (i !== cur && rows[i].N > 0 && (best < 0 || s > S[best])) best = i;
  });
  let decision: string;
  if (elapsed < minGreen) decision = `minGreen (${minGreen} с) әлі өтпеген — ${cur + 1}-фаза жалғасады.`;
  else if (elapsed >= maxGreen && best >= 0) decision = `maxGreen (${maxGreen} с) — міндетті түрде ${best + 1}-фазаға ауысу.`;
  else if (best >= 0 && S[best] > S[cur]) decision = `S${best + 1} = ${fmt(S[best], 1)} > S${cur + 1} = ${fmt(S[cur], 1)} → сары 3 с, бәрі қызыл 1 с, содан кейін ${best + 1}-фаза.`;
  else decision = `Басқа фазаның S мәні үлкен емес — ${cur + 1}-фаза жалғасады.`;
  return (
    <section aria-labelledby="ad-h">
      <div className="card">
        <p>
          <span className="formula">
            S<sub>i</sub> = N<sub>i</sub> + α · W<sub>i</sub>
          </span>{' '}
          <span className="small muted">&nbsp;N — кезектегі көлік [авт.], W — орташа күту [с], α — [авт./с] салмақ коэффициенті, сонда S өлшемі — [авт.]</span>
        </p>
        <div className="row" style={{ gap: 14, marginBottom: 12 }}>
          <div style={{ width: 140 }}>
            <NumField label="α" value={alpha} min={0} step={0.05} onChange={setAlpha} />
          </div>
          <div style={{ width: 160 }}>
            <NumField label="Жасыл жанғалы, с" value={elapsed} min={0} onChange={setElapsed} />
          </div>
          <label className="field" style={{ width: 170 }}>
            <span>Ағымдағы фаза</span>
            <select value={cur} onChange={(e) => setCur(Number(e.target.value))}>
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>
                  {i + 1}-фаза
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Фаза</th>
                <th>N, авт.</th>
                <th>W, с</th>
                <th className="num">S = N + αW</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i === best && S[best] > S[cur] && elapsed >= minGreen ? 'hl' : ''}>
                  <td>
                    {i + 1}-фаза {i === cur && <span className="badge ok">жасыл</span>}
                  </td>
                  <td style={{ width: 120 }}>
                    <input type="number" min={0} value={r.N} aria-label={`N${i + 1}`} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, N: Math.max(0, Number(e.target.value)) } : x)))} />
                  </td>
                  <td style={{ width: 120 }}>
                    <input type="number" min={0} value={r.W} aria-label={`W${i + 1}`} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, W: Math.max(0, Number(e.target.value)) } : x)))} />
                  </td>
                  <td className="num">{fmt(S[i], 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note info" style={{ marginTop: 12 }} aria-live="polite">
          {decision}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Шектеулер (оқу баптаулары, норматив емес): minGreen = 10 с, maxGreen = 60 с, maxRed = 120 с, сары = 3 с, бәрі қызыл = 1 с. Сұранысы бар фаза maxRed шегіне жетсе, кезексіз беріледі — аштық болмайды. Алгоритм тексеруден бұрын «оңтайлы» деп жарияланбайды.
        </p>
      </div>
    </section>
  );
}

export function MetricsSection() {
  const fx = SOURCE_WAIT_EXAMPLES.fixed as readonly number[];
  const ad = SOURCE_WAIT_EXAMPLES.adaptive as readonly number[];
  const mf = mean([...fx]);
  const ma = mean([...ad]);
  return (
    <section aria-labelledby="mt-h">
      <div className="grid g2">
        <div className="card">
          <h3>Анықтамалар</h3>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              <b>Орташа күту</b> = аяқталған сапарлардағы қозғалыссыз (v &lt; 0,5 м/с) уақыт қосындысы / аяқталған сапар саны. Аяқталмаған сапарлар бөлек көрсетіледі.
            </li>
            <li>
              <b>Орташа кезек</b> — тоқтаған көліктер санының уақыт бойынша орташасы; <b>ең үлкен кезек</b> — шың мәні.
            </li>
            <li>
              <b>Өткізу (throughput)</b> — модельдік уақыттың бір сағатына шаққандағы аяқталған сапарлар.
            </li>
            <li>
              <b>Орташа сапар уақыты</b> — тек аяқталған сапарлар бойынша (кіру кезегіндегі күту қоса).
            </li>
            <li>
              <b>Жақсару пайызы</b> = (W<sub>fixed</sub> − W<sub>adaptive</sub>) / W<sub>fixed</sub> · 100%, тек W<sub>fixed</sub> &gt; 0 болғанда, бірдей сұраныс пен seed кезінде.
            </li>
          </ul>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Бастапқы кесте: күту уақыты</h3>
            <DataBadge />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Қиылыс</th>
                  <th className="num">Тұрақты, с</th>
                  <th className="num">Адаптивті, с</th>
                </tr>
              </thead>
              <tbody>
                {fx.map((v, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="num">{v}</td>
                    <td className="num">{ad[i]}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Орташа (есептелді)</b>
                  </td>
                  <td className="num">{fmt(mf, 1)}</td>
                  <td className="num">{fmt(ma, 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Формула бойынша: {fmt(improvementPct(mf, ma) ?? NaN, 1)}%. Бұл — бастапқы мысал, симулятордың нәтижесі емес; симулятордағы KPI тек модельден есептеледі. n = 3 бақылау статистикалық қорытынды үшін жеткіліксіз.
          </p>
        </div>
      </div>
    </section>
  );
}
