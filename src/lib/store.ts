import { create } from 'zustand';
import type { SimResult } from '../core/engine';
import type { ExperimentResult } from '../core/experiments';
import type { ScenarioParams } from '../core/scenario';
import { load, save, clearAllStorage } from './storage';

export interface LastRun {
  source: 'city' | 'signals';
  at: string;
  params: ScenarioParams;
  results: { fixed?: SimResult; adaptive?: SimResult };
}

export interface Observation {
  id: string;
  source: string;
  note: string;
  createdAt: string;
  rows: { group: 'fixed' | 'adaptive'; value: number }[];
}

export interface LogEntry {
  at: string;
  kind: 'city' | 'compare' | 'experiment';
  label: string;
}

export interface WizardState {
  step: number;
  prediction?: string;
}

interface State {
  lastRun: LastRun | null;
  lastCompare: LastRun | null;
  log: LogEntry[];
  wizard: Record<string, WizardState>;
  setLastCompare: (r: LastRun) => void;
  addLog: (e: LogEntry) => void;
  setWizard: (id: string, w: WizardState) => void;
  experiments: Record<string, ExperimentResult>;
  observations: Observation[];
  setLastRun: (r: LastRun) => void;
  setExperiment: (r: ExperimentResult) => void;
  removeExperiment: (id: string) => void;
  addObservation: (o: Observation) => void;
  removeObservation: (id: string) => void;
  clearAll: () => void;
}

export const useStore = create<State>((set, get) => ({
  lastRun: load<LastRun | null>('lastRun', null),
  lastCompare: load<LastRun | null>('lastCompare', null),
  log: load<LogEntry[]>('log', []),
  wizard: load<Record<string, WizardState>>('wizard', {}),
  setLastCompare: (r) => {
    set({ lastCompare: r });
    save('lastCompare', r);
  },
  addLog: (e) => {
    const log = [e, ...get().log].slice(0, 200);
    set({ log });
    save('log', log);
  },
  setWizard: (id, w) => {
    const wizard = { ...get().wizard, [id]: w };
    set({ wizard });
    save('wizard', wizard);
  },
  experiments: load<Record<string, ExperimentResult>>('experiments', {}),
  observations: load<Observation[]>('observations', []),
  setLastRun: (r) => {
    set({ lastRun: r });
    save('lastRun', r);
  },
  setExperiment: (r) => {
    const experiments = { ...get().experiments, [r.experiment]: r };
    set({ experiments });
    if (!save('experiments', experiments)) {
      // Сақтау орны жетпесе — уақыт қатарларынсыз сақтаймыз
      const slim = Object.fromEntries(Object.entries(experiments).map(([k, v]) => [k, { ...v, series: undefined }]));
      save('experiments', slim);
    }
  },
  removeExperiment: (id) => {
    const experiments = { ...get().experiments };
    delete experiments[id];
    set({ experiments });
    save('experiments', experiments);
  },
  addObservation: (o) => {
    const observations = [...get().observations, o];
    set({ observations });
    save('observations', observations);
  },
  removeObservation: (id) => {
    const observations = get().observations.filter((o) => o.id !== id);
    set({ observations });
    save('observations', observations);
  },
  clearAll: () => {
    clearAllStorage();
    set({ lastRun: null, lastCompare: null, log: [], wizard: {}, experiments: {}, observations: [] });
  },
}));
