import { Suspense, lazy, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, Link, Navigate } from 'react-router-dom';
import { BrandMark, Icon, IconName } from './components/Icon';
import { MODEL_VERSION } from './core/version';

const Home = lazy(() => import('./pages/Home'));
const City = lazy(() => import('./pages/City'));
const Lab = lazy(() => import('./pages/Lab'));
const SignalsLab = lazy(() => import('./pages/SignalsLab'));
const RoutesLab = lazy(() => import('./pages/RoutesLab'));
const MathLab = lazy(() => import('./pages/MathLab'));
const ExperimentWizard = lazy(() => import('./pages/ExperimentWizard'));
const Results = lazy(() => import('./pages/Results'));
const About = lazy(() => import('./pages/About'));
const Defense = lazy(() => import('./pages/Defense'));
const NotFound = lazy(() => import('./pages/NotFound'));

export const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Басты бет', icon: 'home' },
  { to: '/city', label: 'Ақылды қала', icon: 'city' },
  { to: '/lab', label: 'Тәжірибе жасау', icon: 'flask' },
  { to: '/results', label: 'Нәтижелер', icon: 'chart' },
  { to: '/about', label: 'Жоба туралы', icon: 'info' },
];

const TITLES: Record<string, string> = {
  '/city': 'Ақылды қала',
  '/lab': 'Тәжірибе жасау',
  '/lab/signals': 'Қай бағдаршам тиімді?',
  '/lab/routes': 'Қай жол тиімді?',
  '/lab/math': 'Көлік қозғалысын есептейік',
  '/results': 'Нәтижелер',
  '/about': 'Жоба туралы',
  '/defense': 'Қорғау режимі',
};

export default function App() {
  const loc = useLocation();
  const isDefense = loc.pathname.startsWith('/defense');
  useEffect(() => {
    window.scrollTo(0, 0);
    const t = TITLES[loc.pathname];
    document.title = t ? `${t} — SMART TRAFFIC LAB` : 'SMART TRAFFIC LAB — Ақылды қаланың математикалық зертханасы';
  }, [loc.pathname]);

  const routes = (
    <Suspense fallback={<div className="page muted">Жүктелуде…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/city" element={<City />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/lab/signals" element={<SignalsLab />} />
        <Route path="/lab/routes" element={<RoutesLab />} />
        <Route path="/lab/math" element={<MathLab />} />
        <Route path="/lab/:expId" element={<ExperimentWizard />} />
        <Route path="/results" element={<Results />} />
        <Route path="/about" element={<About />} />
        <Route path="/defense" element={<Defense />} />
        {/* ескі сілтемелер */}
        <Route path="/signals" element={<Navigate to="/lab/signals" replace />} />
        <Route path="/routes" element={<Navigate to="/lab/routes" replace />} />
        <Route path="/models" element={<Navigate to="/lab/math" replace />} />
        <Route path="/experiments" element={<Navigate to="/lab" replace />} />
        <Route path="/statistics" element={<Navigate to="/results" replace />} />
        <Route path="/assistant" element={<Navigate to="/results" replace />} />
        <Route path="/reports" element={<Navigate to="/results" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );

  if (isDefense) return <main id="content">{routes}</main>;

  return (
    <>
      <a className="skip-link" href="#content">
        Мазмұнға өту
      </a>
      <header className="site-header">
        <div className="site-header-in">
          <Link to="/" className="brand" aria-label="SMART TRAFFIC LAB — басты бет">
            <BrandMark size={34} />
            <div>
              <b>SMART TRAFFIC LAB</b>
              <span>Ақылды қаланың математикалық зертханасы</span>
            </div>
          </Link>
          <nav className="topnav" aria-label="Негізгі бөлімдер">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                <Icon name={n.icon} size={18} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/defense" className="btn btn-teal btn-sm defense-btn">
            <Icon name="fullscreen" size={16} /> Қорғау<span className="hide-sm"> режимі</span>
          </Link>
        </div>
      </header>
      <main id="content" tabIndex={-1}>
        {routes}
      </main>
      <footer className="site-foot">
        <span>«Ақылды қала жағдайында жол қозғалысын тиімді басқарудың математикалық модельдері» · Қадырбек Жанель, 7 «А»</span>
        <span>Шартты схема, нақты қала картасы емес · {MODEL_VERSION}</span>
      </footer>
      <nav className="tabbar" aria-label="Бөлімдер">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <Icon name={n.icon} size={21} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
