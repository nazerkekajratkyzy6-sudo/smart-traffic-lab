import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { SimCanvas, focusView } from '../components/SimCanvas';
import { useSimulation } from '../lib/useSimulation';
import { presetParams } from '../lib/presets';
import { fmt } from '../lib/format';

const QUESTIONS: { to: string; icon: IconName; t: string; d: string; teal?: boolean }[] = [
  { to: '/city', icon: 'car', t: 'Көліктер қалай қозғалады?', d: 'Үш қиылысты көшеде әр көліктің жылдамдығы, маршруты және күтуі есептеледі.' },
  { to: '/lab/signals', icon: 'signal', t: 'Ақылды бағдаршам қалай жұмыс істейді?', d: 'Қарапайым және ақылды бағдаршамды бірдей көлік ағынымен салыстыр.', teal: true },
  { to: '/lab/routes', icon: 'route', t: 'Ең тиімді жолды қалай табамыз?', d: 'Картадан екі нүктені таңда — Дейкстра алгоритмі жолды есептейді.' },
];

function HeroSim() {
  const params = useMemo(() => presetParams('single', 'mid', { ratePerApproach: 360, seed: 7 }), []);
  const modes = useMemo(() => ['adaptive' as const], []);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sim = useSimulation(params, modes, 3, undefined, 150);
  const [auto, setAuto] = useState(!reduce);
  useEffect(() => {
    if (auto && !sim.started) sim.start();
  }, [auto, sim.started]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = sim.sims.adaptive;
  const k = s?.kpi();
  const jv = s?.junctionViews()[0];
  return (
    <div className="stage hero-stage">
      <SimCanvas net={sim.net} frame={sim.frame('adaptive')} view={focusView(sim.net, 'J1', 46)} title="Ақылды бағдаршамы бар қиылыстың тірі симуляциясы" maxHeight={520} showLabels={false} />
      <div className="stage-foot" style={{ justifyContent: 'space-between' }}>
        <span>
          Тірі симуляция · ақылды бағдаршам · {jv ? `${jv.phase + 1}-фаза` : ''}
        </span>
        <span className="num">
          кезекте {k?.waiting ?? 0} көлік · өтті {k?.completed ?? 0} · орташа күту {fmt(k?.avgWait, 1)} с
        </span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            if (sim.running) {
              sim.pause();
              setAuto(false);
            } else {
              setAuto(true);
              sim.start();
            }
          }}
          aria-label={sim.running ? 'Анимацияны тоқтату' : 'Анимацияны қосу'}
        >
          <Icon name={sim.running ? 'pause' : 'play'} size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="page">
      <section className="home-hero">
        <div className="eyebrow">SMART TRAFFIC LAB · Ақылды қаланың математикалық зертханасы</div>
        <h1>Ақылды қаладағы көлік қозғалысын зерттейік!</h1>
        <p className="lead">Бағдаршамдарды басқарып, көлік кептелісін азайтып, ең тиімді жолды табамыз.</p>
        <HeroSim />
        <div className="hero-actions">
          <Link to="/city" className="btn btn-primary btn-xl pulse">
            <Icon name="play" size={20} /> Зерттеуді бастау
          </Link>
          <Link to="/about" className="btn btn-xl">
            <Icon name="info" size={20} /> Жобамен танысу
          </Link>
        </div>
        <p className="small muted">Шартты көше схемасы. Барлық көрсеткіш симуляциядан есептеледі.</p>
      </section>

      <section className="section">
        <div className="q-cards">
          {QUESTIONS.map((q) => (
            <Link key={q.to} to={q.to} className="q-card">
              <span className={`ic-box ${q.teal ? 'teal' : ''}`}>
                <Icon name={q.icon} size={22} />
              </span>
              <b>{q.t}</b>
              <span>{q.d}</span>
              <span className="go">
                Зерттеу <Icon name="arrowR" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section card tint">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow">Ғылыми жоба · «Зерде»</div>
            <h3 style={{ marginBottom: 4 }}>«Ақылды қала жағдайында жол қозғалысын тиімді басқарудың математикалық модельдері»</h3>
            <p className="muted" style={{ margin: 0 }}>
              Орындаған: Қадырбек Жанель, 7 «А» сынып. Жетекші: Ашимханова Ф. Т.
            </p>
          </div>
          <Link to="/defense" className="btn btn-teal btn-xl">
            <Icon name="fullscreen" size={20} /> Қорғау режимі
          </Link>
        </div>
      </section>
    </div>
  );
}
