import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { Hint } from '../components/common';
import { EXPERIMENTS } from '../core/experiments';
import { EXP_CONTENT } from '../lib/labContent';
import { useStore } from '../lib/store';

const LABS: { to: string; icon: IconName; t: string; d: string; teal?: boolean }[] = [
  { to: '/lab/signals', icon: 'signal', t: 'Қай бағдаршам тиімді?', d: 'Екі бағдаршамды бірдей көлік ағынымен қатар іске қосып салыстыр.' },
  { to: '/lab/routes', icon: 'route', t: 'Қай жол тиімді?', d: 'Картадан екі нүктені таңда — Дейкстра алгоритмі ең тиімді жолды табады.', teal: true },
  { to: '/lab/math', icon: 'formula', t: 'Көлік қозғалысын есептейік', d: 'q = ρ · v формуласын қадамдап есепте.' },
];

export default function Lab() {
  const done = useStore((s) => s.experiments);
  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Тәжірибе жасау</div>
        <h1>Не зерттейміз?</h1>
        <p className="lead">Зертхананы немесе дайын тәжірибені таңда. Барлық баптау алдын ала жасалған — тек батырманы бас.</p>
      </header>
      <Hint>Бастау үшін зертхананы немесе тәжірибені таңда.</Hint>

      <h2 className="section">Зертханалар</h2>
      <div className="lab-cards">
        {LABS.map((l) => (
          <Link key={l.to} to={l.to} className="q-card">
            <span className={`ic-box ${l.teal ? 'teal' : ''}`}>
              <Icon name={l.icon} size={22} />
            </span>
            <b>{l.t}</b>
            <span>{l.d}</span>
            <span className="go">
              Ашу <Icon name="arrowR" size={16} />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="section">10 ғылыми тәжірибе</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Әр тәжірибе 5 қадамнан тұрады: мақсат → болжам → тәжірибе → нәтиже → қорытынды.
      </p>
      <div className="exp-cards">
        {EXPERIMENTS.map((e, i) => {
          const c = EXP_CONTENT[e.id];
          const isDone = !!done[e.id];
          return (
            <Link key={e.id} to={`/lab/${e.id}`} className={`exp-card ${isDone ? 'done' : ''}`}>
              <span className="n">{isDone ? '✓' : i + 1}</span>
              <b>{c.short}</b>
              <span>{c.line}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
