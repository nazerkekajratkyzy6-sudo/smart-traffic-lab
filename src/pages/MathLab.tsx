import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell } from 'recharts';
import { ChoiceGroup, Hint, DataBadge, TeX, Explain } from '../components/common';
import { Icon } from '../components/Icon';
import { FlowSection, GreenshieldsSection, PoissonSection, AdaptiveSection, MetricsSection } from '../components/MathSections';
import { SOURCE_FLOW_EXAMPLES, flowRate } from '../core/flow';
import { fmt } from '../lib/format';

type Sc = 'low' | 'mid' | 'high';
const SC: { v: Sc; t: string; idx: number; note: string }[] = [
  { v: 'low', t: 'Көлік аз', idx: 0, note: 'Көлік аз — жол бос, көліктер жылдам жүреді.' },
  { v: 'mid', t: 'Көлік орташа', idx: 1, note: 'Көлік көбейді — жылдамдық біршама төмендеді.' },
  { v: 'high', t: 'Көлік көп', idx: 2, note: 'Көлік өте көп — кептеліс, жылдамдық күрт төмендеді.' },
];

export default function MathLab() {
  const [sc, setSc] = useState<Sc>('mid');
  const [shown, setShown] = useState(0); // көрсетілген қадамдар саны (0–3)
  const s = SC.find((x) => x.v === sc)!;
  const ex = SOURCE_FLOW_EXAMPLES[s.idx];
  const q = flowRate(ex.rho, ex.v);
  const headway = q > 0 ? 3600 / q : Infinity;
  const chart = SC.map((x) => ({ name: x.t, q: flowRate(SOURCE_FLOW_EXAMPLES[x.idx].rho, SOURCE_FLOW_EXAMPLES[x.idx].v), v: x.v }));

  return (
    <div className="page">
      <Link to="/lab" className="back-link">
        <Icon name="arrowL" size={16} /> Тәжірибе жасау
      </Link>
      <header className="page-head">
        <div className="eyebrow">Математика зертханасы</div>
        <h1>Көлік қозғалысын есептейік</h1>
        <p className="lead">Жолдан бір сағатта қанша көлік өтеді? Оны көліктің тығыздығы мен жылдамдығы арқылы есептеуге болады.</p>
      </header>

      <div className="grid split-r">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <ChoiceGroup
                n={1}
                label="Жағдайды таңда"
                value={sc}
                options={SC.map((x) => ({ v: x.v, t: x.t }))}
                onChange={(v) => {
                  setSc(v);
                  setShown(0);
                }}
              />
              <DataBadge />
            </div>
            <p className="muted" style={{ margin: '0 0 14px' }}>
              {s.note} Мәндер ғылыми жұмыстағы оқу мысалынан алынды.
            </p>
            <div className="big-kpis">
              <div className="big-kpi">
                <div className="k">Көлік тығыздығы</div>
                <div className="v">
                  {ex.rho}
                  <span className="u">көлік/км</span>
                </div>
              </div>
              <div className="big-kpi">
                <div className="k">Орташа жылдамдық</div>
                <div className="v">
                  {ex.v}
                  <span className="u">км/сағ</span>
                </div>
              </div>
              <div className="big-kpi">
                <div className="k">Көлік ағыны</div>
                <div className="v">
                  {shown >= 3 ? fmt(q, 0) : '?'}
                  <span className="u">көлік/сағ</span>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              {shown < 3 ? (
                <button className={`btn btn-primary btn-xl ${shown === 0 ? 'pulse' : ''}`} onClick={() => setShown((n) => n + 1)}>
                  <Icon name="formula" size={20} /> {shown === 0 ? 'Есептеуді көрсету' : 'Келесі қадам'}
                </button>
              ) : (
                <button className="btn btn-xl" onClick={() => setShown(0)}>
                  <Icon name="reset" size={20} /> Қайта есептеу
                </button>
              )}
            </div>
          </div>
          {shown === 0 && <Hint>«Есептеуді көрсету» батырмасын бас.</Hint>}
          <div className="calc-steps" aria-live="polite">
            {shown >= 1 && (
              <div className="calc-step">
                <span className="sn">1</span>
                <div>
                  <h3>Белгілер нені білдіреді?</h3>
                  <div className="formula-box" style={{ marginBottom: 10 }}>
                    <TeX block tex="q = \rho \cdot v" />
                  </div>
                  <div className="symbols">
                    <TeX tex="\rho" />
                    <span>(«ро») — тығыздық: 1 км жолда қанша көлік бар, көлік/км</span>
                    <TeX tex="v" />
                    <span>— көліктердің орташа жылдамдығы, км/сағ</span>
                    <TeX tex="q" />
                    <span>— ағын: жолдың бір нүктесінен 1 сағатта қанша көлік өтеді, көлік/сағ</span>
                  </div>
                </div>
              </div>
            )}
            {shown >= 2 && (
              <div className="calc-step">
                <span className="sn">2</span>
                <div>
                  <h3>Сандарды қоямыз</h3>
                  <div className="formula-box">
                    <TeX block tex={`q = ${ex.rho}\\ \\tfrac{\\text{көлік}}{\\text{км}} \\times ${ex.v}\\ \\tfrac{\\text{км}}{\\text{сағ}}`} />
                  </div>
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    Бірліктер: км қысқарады, көлік/сағ қалады.
                  </p>
                </div>
              </div>
            )}
            {shown >= 3 && (
              <div className="calc-step">
                <span className="sn">3</span>
                <div>
                  <h3>Жауап</h3>
                  <div className="formula-box big">
                    <TeX block tex={`q = ${q}\\ \\tfrac{\\text{көлік}}{\\text{сағ}}`} />
                  </div>
                  <p style={{ margin: '8px 0 0' }}>
                    Яғни жолдың бір нүктесінен шамамен әр <b>{fmt(headway, 1)} секунд</b> сайын бір көлік өтеді (3600 : {q}). Ғылыми жұмыстағы кестеде де q = {ex.q} — нәтиже сәйкес келді.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Үш жағдайдағы ағын</h3>
            <Explain>
              Әр баған — бір сағатта жолдан өтетін көлік саны (q = ρ · v). Көлік ең көп болғанда ағын ең үлкен емес: жылдамдық тым төмендегендіктен жол азырақ көлік өткізеді. Бұл — кептелістің математикалық белгісі.
            </Explain>
          </div>
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf0" vertical={false} />
                <XAxis dataKey="name" fontSize={13} />
                <YAxis fontSize={13} label={{ value: 'көлік/сағ', angle: -90, position: 'insideLeft', offset: 8, fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v, 0)} көлік/сағ`, 'q']} />
                <Bar dataKey="q" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {chart.map((c) => (
                    <Cell key={c.v} fill={c.v === sc ? '#1769aa' : '#b9cde3'} />
                  ))}
                  <LabelList dataKey="q" position="top" fontSize={13} formatter={(v: number) => fmt(v, 0)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="small muted">Мәндер — ғылыми жұмыстағы оқу мысалы. Нақты көшеде олар өлшеу арқылы тексерілуі керек.</p>
        </div>
      </div>

      <h2 className="section">Тереңірек зерттеу</h2>
      <div className="stack">
        <details className="disclosure">
          <summary>Өз мәндеріңмен есепте (жолақ санымен)</summary>
          <FlowSection />
        </details>
        <details className="disclosure">
          <summary>Жылдамдық пен тығыздық қалай байланысты? (гипотеза)</summary>
          <GreenshieldsSection />
        </details>
        <details className="disclosure">
          <summary>Көліктер кездейсоқ келеді: Пуассон үлестірімі</summary>
          <PoissonSection />
        </details>
        <details className="disclosure">
          <summary>Ақылды бағдаршамның формуласы: S = N + α·W</summary>
          <AdaptiveSection />
        </details>
        <details className="disclosure">
          <summary>Тиімділікті қалай өлшейміз?</summary>
          <MetricsSection />
        </details>
      </div>
    </div>
  );
}
