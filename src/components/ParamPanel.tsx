import { useRef, useState } from 'react';
import { NumField, Seg } from './common';
import { Icon } from './Icon';
import { DEFAULT_PARAMS, ScenarioParams, mergeParams, parseScenarioJson, fromExampleJson, scenarioId, DeepPartial } from '../core/scenario';
import example from '../../materials/scenario_example.json';
import { MODEL_VERSION } from '../core/version';
import { downloadJson } from '../lib/download';

export const PRESETS: { id: string; label: string; over: DeepPartial<ScenarioParams> }[] = [
  { id: 'example', label: 'Мысал сценарий (scenario_example.json)', over: {} },
  { id: 'low', label: 'Төмен ағын — 100 авт./сағ', over: { ratePerApproach: 100 } },
  { id: 'mid', label: 'Орташа ағын — 300 авт./сағ', over: { ratePerApproach: 300 } },
  { id: 'peak', label: 'Таңертеңгі шың (×2)', over: { ratePerApproach: 250, profile: 'peak', peakFactor: 2 } },
  { id: 'asym', label: 'Асимметрия 80/20', over: { ratePerApproach: 300, mainShare: 0.8 } },
  { id: 'trucks', label: 'Транзиттік жүк көліктері 30%', over: { ratePerApproach: 250, truckShare: 0.3 } },
  { id: 'stress', label: 'Стресс-тест — 850 авт./сағ', over: { ratePerApproach: 850, duration: 1800 } },
];

export function presetParams(id: string, network: ScenarioParams['network']): ScenarioParams {
  const base = mergeParams(fromExampleJson(example as Record<string, unknown>), { network });
  const pr = PRESETS.find((p) => p.id === id);
  return pr ? mergeParams(base, pr.over) : base;
}

export function ParamPanel({
  params,
  onChange,
  errors,
  showModeHint,
}: {
  params: ScenarioParams;
  onChange: (p: ScenarioParams) => void;
  errors: string[];
  showModeHint?: boolean;
}) {
  const [preset, setPreset] = useState('example');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (over: DeepPartial<ScenarioParams>) => onChange(mergeParams(params, over));
  const p = params;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const raw = JSON.parse(text);
      const isExample = raw && typeof raw === 'object' && 'duration_seconds' in raw;
      const res = isExample ? { params: fromExampleJson(raw), errors: [] as string[] } : parseScenarioJson(raw);
      if (res.params) {
        onChange({ ...res.params, network: p.network });
        setImportMsg(`Сценарий жүктелді: ${scenarioId(res.params)}`);
      } else setImportMsg(`Импорт қатесі: ${res.errors.join('; ')}`);
    } catch (e) {
      setImportMsg(`JSON оқылмады: ${e instanceof Error ? e.message : ''}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card">
        <h3>Сценарий</h3>
        <label className="field">
          <span>Дайын баптау</span>
          <select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              onChange(presetParams(e.target.value, p.network));
            }}
          >
            {PRESETS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid g2" style={{ marginTop: 10, gap: 10 }}>
          <NumField label="Seed" value={p.seed} min={0} step={1} onChange={(v) => set({ seed: Math.round(v) })} />
          <NumField label="Ұзақтығы, с" value={p.duration} min={60} max={10800} step={60} onChange={(v) => set({ duration: v })} />
          <NumField label="Қадам Δt, с" value={p.dt} min={0.2} max={1} step={0.1} onChange={(v) => set({ dt: v })} />
          <NumField label="Көлік шегі" value={p.maxVehicles} min={100} max={5000} step={100} onChange={(v) => set({ maxVehicles: v })} />
        </div>
      </div>

      <div className="card">
        <h3>Ағын генераторы</h3>
        <div className="stack" style={{ gap: 10 }}>
          <NumField label="Қарқындылық" hint="авт./сағ бір бағытқа" value={p.ratePerApproach} min={0} max={2000} step={50} onChange={(v) => set({ ratePerApproach: v })} />
          <label className="field">
            <span>
              Негізгі көше үлесі: <b className="mono">{Math.round(p.mainShare * 100)}/{Math.round((1 - p.mainShare) * 100)}</b>
            </span>
            <input type="range" min={0.1} max={0.9} step={0.05} value={p.mainShare} onChange={(e) => set({ mainShare: Number(e.target.value) })} aria-label="Негізгі көше үлесі" />
          </label>
          <div className="field">
            <span className="field-label">Келу моделі</span>
            <Seg label="Келу моделі" value={p.arrivals} onChange={(v) => set({ arrivals: v })} options={[{ v: 'poisson', t: 'Пуассон' }, { v: 'regular', t: 'Тұрақты аралық' }]} />
          </div>
          <div className="field">
            <span className="field-label">Сұраныс профилі</span>
            <Seg label="Сұраныс профилі" value={p.profile} onChange={(v) => set({ profile: v })} options={[{ v: 'uniform', t: 'Біркелкі' }, { v: 'peak', t: 'Шың' }]} />
          </div>
          {p.profile === 'peak' && <NumField label="Шың коэффициенті" value={p.peakFactor} min={1} max={4} step={0.1} onChange={(v) => set({ peakFactor: v })} />}
          <label className="field">
            <span>
              Транзиттік жүк көліктері: <b className="mono">{Math.round(p.truckShare * 100)}%</b>
            </span>
            <input type="range" min={0} max={0.6} step={0.05} value={p.truckShare} onChange={(e) => set({ truckShare: Number(e.target.value) })} aria-label="Жүк көліктерінің үлесі" />
          </label>
          <details className="disclosure">
            <summary>Бұрылыс үлестері</summary>
            <div className="grid g3" style={{ gap: 8 }}>
              <NumField label="Негізгі: солға" value={p.turnMain.L} min={0} step={0.05} onChange={(v) => set({ turnMain: { L: v } })} />
              <NumField label="тура" value={p.turnMain.T} min={0} step={0.05} onChange={(v) => set({ turnMain: { T: v } })} />
              <NumField label="оңға" value={p.turnMain.R} min={0} step={0.05} onChange={(v) => set({ turnMain: { R: v } })} />
              <NumField label="Қосалқы: солға" value={p.turnSide.L} min={0} step={0.05} onChange={(v) => set({ turnSide: { L: v } })} />
              <NumField label="тура" value={p.turnSide.T} min={0} step={0.05} onChange={(v) => set({ turnSide: { T: v } })} />
              <NumField label="оңға" value={p.turnSide.R} min={0} step={0.05} onChange={(v) => set({ turnSide: { R: v } })} />
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Үлестер қалыпқа келтіріледі (қосындысы 1 болмаса да болады).
            </p>
          </details>
        </div>
      </div>

      <div className="card">
        <h3>Бағдаршам баптаулары</h3>
        {showModeHint && <p className="small muted">Екі режимнің параметрлері — оқу баптаулары, норматив емес.</p>}
        <div className="field-label" style={{ marginBottom: 6 }}>
          Тұрақты цикл
        </div>
        <div className="grid g2" style={{ gap: 8 }}>
          <NumField label="Жасыл (тура), с" value={p.fixed.green} min={5} max={120} onChange={(v) => set({ fixed: { green: v } })} />
          <NumField label="Жасыл (солға), с" value={p.fixed.greenLeft} min={5} max={90} onChange={(v) => set({ fixed: { greenLeft: v } })} />
          <NumField label="Сары, с" value={p.signal.yellow} min={2} max={6} onChange={(v) => set({ signal: { yellow: v } })} />
          <NumField label="Бәрі қызыл, с" value={p.signal.allRed} min={0} max={5} onChange={(v) => set({ signal: { allRed: v } })} />
        </div>
        <div className="field-label" style={{ margin: '12px 0 6px' }}>
          Адаптивті: S<sub>i</sub> = N<sub>i</sub> + α·W<sub>i</sub>
        </div>
        <div className="grid g2" style={{ gap: 8 }}>
          <NumField label="α, 1/с" value={p.adaptive.alpha} min={0} max={5} step={0.05} onChange={(v) => set({ adaptive: { alpha: v } })} />
          <NumField label="minGreen, с" value={p.adaptive.minGreen} min={5} max={60} onChange={(v) => set({ adaptive: { minGreen: v } })} />
          <NumField label="maxGreen, с" value={p.adaptive.maxGreen} min={10} max={180} onChange={(v) => set({ adaptive: { maxGreen: v } })} />
          <NumField label="maxRed, с" value={p.adaptive.maxRed} min={30} max={300} onChange={(v) => set({ adaptive: { maxRed: v } })} />
          <NumField label="Детектор, м" value={p.adaptive.detector} min={0} max={120} onChange={(v) => set({ adaptive: { detector: v } })} />
        </div>
      </div>

      <div className="card">
        <div className="row">
          <button
            className="btn btn-sm"
            onClick={() => downloadJson({ id: scenarioId(p), modelVersion: MODEL_VERSION, data_type: 'simulated', createdAt: new Date().toISOString(), params: p }, `scenario-${scenarioId(p)}.json`)}
          >
            <Icon name="download" size={16} /> JSON
          </button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Импорт
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => onChange({ ...DEFAULT_PARAMS, network: p.network })}>
            Әдепкі
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          ID: <span className="mono">{scenarioId(p)}</span>
        </p>
        {importMsg && (
          <p className="small" role="status" style={{ margin: '6px 0 0' }}>
            {importMsg}
          </p>
        )}
      </div>
      {errors.length > 0 && (
        <div className="note bad" role="alert">
          <b>Енгізу қатесі:</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
