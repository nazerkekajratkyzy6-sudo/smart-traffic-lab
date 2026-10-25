import { useState } from 'react';
import { PageHead, DataBadge } from '../components/common';
import { Icon } from '../components/Icon';
import { useStore } from '../lib/store';
import { MODEL_VERSION, ALGO_VERSION } from '../core/version';

const MATERIALS = [
  ['SOURCE_RESEARCH.pdf', 'Бастапқы ғылыми жоба (PDF, 39 бет)'],
  ['TECHNICAL_SPEC.docx', 'Техникалық тапсырма (Word)'],
  ['TECHNICAL_SPEC.md', 'Техникалық тапсырма (Markdown)'],
  ['seed_graph.json', 'Оқу графы A–B–C–D'],
  ['scenario_example.json', 'Мысал сценарий параметрлері'],
  ['experiment_plan.csv', '10 тәжірибе жоспары'],
];

export default function About() {
  const clearAll = useStore((s) => s.clearAll);
  const [cleared, setCleared] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="page">
      <PageHead eyebrow="10 · Жоба туралы" title="SMART TRAFFIC LAB — Ақылды қаланың математикалық зертханасы" lead="Зерттеу гипотезасын қайталанатын компьютерлік модельде тексеруге арналған оқу симуляторы." />
      <div className="grid g2">
        <div className="card">
          <h3>Жоба паспорты</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><td>Тақырыбы</td><td>«Ақылды қала жағдайында жол қозғалысын тиімді басқарудың математикалық модельдері»</td></tr>
                <tr><td>Оқушы</td><td>Қадырбек Жанель Әділханқызы, 7 «А» сынып</td></tr>
                <tr><td>Ғылыми жетекші</td><td>Ашимханова Фаруза Турсынбековна, математика пәнінің мұғалімі</td></tr>
                <tr><td>Бағыты</td><td>Жаратылыстану-математикалық; «Математика және қолданбалы математика» секциясы</td></tr>
                <tr><td>Нұсқа</td><td className="mono">{MODEL_VERSION} · {ALGO_VERSION.fixed} · {ALGO_VERSION.adaptive}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Мақсаты және гипотеза</h3>
          <p>
            <b>Мақсаты:</b> жол қозғалысының қайталанатын компьютерлік моделін құрып, адаптивті басқарудың тиімділігі туралы гипотезаны тексеру.
          </p>
          <p>
            <b>Гипотеза:</b> егер жол қозғалысын басқаруда математикалық модельдер мен адаптивті басқару әдістері қолданылса, көлік кептелістерін азайтуға және қозғалыс тиімділігін арттыруға болады.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Әдістер: математикалық модельдеу, граф теориясы (Дейкстра), ықтималдық (Пуассон ағыны), статистика (жұптық салыстыру), компьютерлік эксперимент.
          </p>
        </div>
      </div>

      <div className="grid g3 section">
        <div className="card tint">
          <h3>Деректер туралы</h3>
          <p className="small">
            <DataBadge /> — бастапқы PDF-тегі кестелер (граф, ағын сценарийлері, күту уақыты). Олар оқу мысалы ретінде көрсетіледі және симулятор нәтижелерінің орнына қолданылмайды.
          </p>
          <p className="small" style={{ margin: 0 }}>
            <DataBadge kind="simulated" /> — тек осы бағдарламада есептелген сандар.
          </p>
        </div>
        <div className="card tint">
          <h3>Шектеулер</h3>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Карта — шартты схема, Меркі қаласының нақты картасы емес.</li>
            <li>Параметрлер калибрленбеген; жаяу жүргіншілер мен жолақ ауыстыру модельденбеген.</li>
            <li>Нақты координаттар, сілтемелер және далалық бақылаулар бөлек расталуы тиіс.</li>
          </ul>
        </div>
        <div className="card tint">
          <h3>Қауіпсіздік және құпиялылық</h3>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Жарнама, трекер, жасырын сыртқы сұраныс жоқ.</li>
            <li>Деректер тек осы браузерде (localStorage) сақталады.</li>
            <li>Нақты жол инфрақұрылымына ешқандай басқару командасы жіберілмейді.</li>
            <li>Жүктелгеннен кейін офлайн жұмыс істейді (PWA).</li>
          </ul>
        </div>
      </div>

      <div className="grid g2 section">
        <div className="card">
          <h3>Жоба материалдары</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {MATERIALS.map(([f, t]) => (
              <li key={f} style={{ margin: '4px 0' }}>
                <a href={`${import.meta.env.BASE_URL}materials/${f}`} download={f.endsWith('.pdf') ? undefined : f} target={f.endsWith('.pdf') ? '_blank' : undefined} rel="noreferrer">
                  {t}
                </a>{' '}
                <span className="mono small muted">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Сақталған деректер</h3>
          <p className="small muted">Тәжірибе нәтижелері, соңғы іске қосу және импортталған бақылаулар осы құрылғыда сақталады. Тазалау қайтарылмайды — қажет болса, алдымен CSV/JSON экспорттаңыз.</p>
          {!confirming ? (
            <button className="btn" onClick={() => { setConfirming(true); setCleared(false); }}>
              <Icon name="trash" size={16} /> Деректерді тазалау
            </button>
          ) : (
            <div className="row" role="group" aria-label="Тазалауды растау">
              <span className="small">Барлық сақталған деректер өшіріледі. Жалғастыру керек пе?</span>
              <button className="btn btn-sm btn-primary" onClick={() => { clearAll(); setCleared(true); setConfirming(false); }}>Иә, өшіру</button>
              <button className="btn btn-sm" onClick={() => setConfirming(false)}>Болдырмау</button>
            </div>
          )}
          {cleared && (
            <p className="small" role="status" style={{ marginTop: 8 }}>
              Деректер өшірілді.
            </p>
          )}
          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            PDF қаріпі: DejaVu Sans (еркін лицензия, <a href={`${import.meta.env.BASE_URL}fonts/LICENSE-DejaVu.txt`}>мәтіні</a>). Интерфейс қаріпі: Inter (SIL OFL); формулалар: KaTeX (MIT).
          </p>
        </div>
      </div>
    </div>
  );
}
