/** Бағдаршамды басқарудың екі алгоритмі: тұрақты цикл және адаптивті S_i = N_i + α·W_i. */
import { ScenarioParams, ControlMode } from './scenario';

export type Stage = 'green' | 'yellow' | 'allred';

export interface PhaseSense {
  N: number; // кезектегі көліктер саны
  W: number; // орташа күту, с
}

export interface SignalEvent {
  t: number;
  junction: string;
  text: string;
  kind: 'phase' | 'force' | 'info';
}

export interface SignalState {
  phase: number;
  stage: Stage;
  stageTime: number;
  next: number;
  lastGreenEnd: number[];
  greenTime: number[]; // әр фазаның жалпы жасыл уақыты
  lastScores?: number[];
  switches: number;
}

export interface Controller {
  mode: ControlMode;
  state: SignalState;
  update(t: number, dt: number, sense: () => PhaseSense[], log: (e: SignalEvent) => void): void;
}

const PHASES_N = 4;

function baseState(): SignalState {
  return {
    phase: 0,
    stage: 'green',
    stageTime: 0,
    next: 1,
    lastGreenEnd: new Array(PHASES_N).fill(0),
    greenTime: new Array(PHASES_N).fill(0),
    switches: 0,
  };
}

/** Сары → бәрі қызыл → келесі фазаның жасылы (ортақ ауысу логикасы). */
function advanceClearance(
  s: SignalState,
  t: number,
  p: ScenarioParams,
  jid: string,
  log: (e: SignalEvent) => void,
): void {
  if (s.stage === 'yellow' && s.stageTime >= p.signal.yellow - 1e-9) {
    if (p.signal.allRed > 0) {
      s.stage = 'allred';
      s.stageTime = 0;
      return;
    }
    s.stage = 'allred';
    s.stageTime = p.signal.allRed;
  }
  if (s.stage === 'allred' && s.stageTime >= p.signal.allRed - 1e-9) {
    s.phase = s.next;
    s.stage = 'green';
    s.stageTime = 0;
    s.switches++;
    log({ t, junction: jid, kind: 'phase', text: `${s.phase + 1}-фаза жасыл` });
  }
}

function startYellow(s: SignalState, t: number, next: number): void {
  s.lastGreenEnd[s.phase] = t;
  s.stage = 'yellow';
  s.stageTime = 0;
  s.next = next;
}

export function createController(mode: ControlMode, p: ScenarioParams, jid: string): Controller {
  const state = baseState();
  if (mode === 'fixed') {
    const greens = [p.fixed.green, p.fixed.greenLeft, p.fixed.green, p.fixed.greenLeft];
    return {
      mode,
      state,
      update(t, dt, _sense, log) {
        const s = state;
        s.stageTime += dt;
        if (s.stage === 'green') {
          s.greenTime[s.phase] += dt;
          if (s.stageTime >= greens[s.phase] - 1e-9) startYellow(s, t + dt, (s.phase + 1) % PHASES_N);
        } else advanceClearance(s, t + dt, p, jid, log);
      },
    };
  }
  const a = p.adaptive;
  return {
    mode,
    state,
    update(t, dt, sense, log) {
      const s = state;
      s.stageTime += dt;
      if (s.stage !== 'green') {
        advanceClearance(s, t + dt, p, jid, log);
        return;
      }
      s.greenTime[s.phase] += dt;
      if (s.stageTime < a.minGreen - 1e-9) return;
      const sn = sense();
      const scores = sn.map((x) => x.N + a.alpha * x.W);
      s.lastScores = scores;
      const now = t + dt;
      const clearance = p.signal.yellow + p.signal.allRed;
      // 1) Аштықтан қорғау: maxRed шегіне жеткен, сұранысы бар фаза
      let starving = -1;
      let starveRed = -1;
      for (let i = 0; i < PHASES_N; i++) {
        if (i === s.phase || sn[i].N <= 0) continue;
        const red = now - s.lastGreenEnd[i];
        if (red >= a.maxRed - clearance && red > starveRed) {
          starving = i;
          starveRed = red;
        }
      }
      // ең жоғары S бар басқа фаза
      let best = -1;
      for (let i = 0; i < PHASES_N; i++) {
        if (i === s.phase || sn[i].N <= 0) continue;
        if (best < 0 || scores[i] > scores[best]) best = i;
      }
      if (starving >= 0 && starving !== s.phase) {
        startYellow(s, now, starving);
        log({ t: now, junction: jid, kind: 'force', text: `maxRed: ${starving + 1}-фаза кезексіз беріледі (қызыл ${Math.round(starveRed)} с)` });
        return;
      }
      if (s.stageTime >= a.maxGreen - 1e-9) {
        if (best >= 0) {
          startYellow(s, now, best);
          log({ t: now, junction: jid, kind: 'force', text: `maxGreen (${a.maxGreen} с) → ${best + 1}-фаза` });
        }
        return;
      }
      if (best >= 0 && scores[best] > scores[s.phase]) {
        startYellow(s, now, best);
        log({
          t: now,
          junction: jid,
          kind: 'info',
          text: `S${best + 1}=${scores[best].toFixed(1)} > S${s.phase + 1}=${scores[s.phase].toFixed(1)} → ауысу`,
        });
      }
    },
  };
}

/** Қозғалыс күйі: берілген фаза үшін */
export function phaseLight(s: SignalState, phase: number): 'green' | 'yellow' | 'red' {
  if (s.phase !== phase) return 'red';
  if (s.stage === 'green') return 'green';
  if (s.stage === 'yellow') return 'yellow';
  return 'red';
}
