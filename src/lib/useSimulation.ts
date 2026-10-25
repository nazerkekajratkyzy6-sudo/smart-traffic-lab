/**
 * Симуляцияны анимациямен басқару: ядро тұрақты Δt қадаммен есептейді,
 * экран кадрлары арасындағы позициялар интерполяцияланады.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Simulation, VehiclePose } from '../core/engine';
import { buildNetwork, Network } from '../core/network';
import { generateDemand } from '../core/demand';
import { ScenarioParams, ControlMode, validateParams } from '../core/scenario';
import type { SimFrame } from '../components/SimCanvas';

export interface SimController {
  net: Network;
  sims: Partial<Record<ControlMode, Simulation>>;
  modes: ControlMode[];
  running: boolean;
  finished: boolean;
  started: boolean;
  t: number;
  errors: string[];
  start: () => void;
  pause: () => void;
  reset: () => void;
  finishNow: () => void;
  frame: (m: ControlMode) => SimFrame;
  version: number;
}

export function useSimulation(
  params: ScenarioParams,
  modes: ControlMode[],
  speed: number,
  onFinish?: (sims: Partial<Record<ControlMode, Simulation>>) => void,
  warmup = 0,
): SimController {
  const net = useMemo(() => buildNetwork({ kind: params.network }), [params.network]);
  const errors = useMemo(() => validateParams(params), [params]);
  const simsRef = useRef<Partial<Record<ControlMode, Simulation>>>({});
  const prevRef = useRef<Partial<Record<ControlMode, Map<number, VehiclePose>>>>({});
  const accRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const doneRef = useRef(false);
  const finishCb = useRef(onFinish);
  finishCb.current = onFinish;
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [version, setVersion] = useState(0);
  const modesKey = modes.join(',');

  const build = useCallback(() => {
    simsRef.current = {};
    prevRef.current = {};
    accRef.current = 0;
    doneRef.current = false;
    if (errors.length) return;
    const events = generateDemand(net, params); // екі режим — бірдей сұраныс
    for (const m of modesKey.split(',') as ControlMode[]) {
      const sim = new Simulation(params, m, events, net);
      if (warmup > 0) sim.runFor(warmup); // көрнекі режим: көше бос болмауы үшін алдын ала есептеу
      simsRef.current[m] = sim;
    }
    setStarted(false);
    setVersion((v) => v + 1);
  }, [params, modesKey, net, errors.length, warmup]);

  useEffect(() => {
    setRunning(false);
    build();
  }, [build]);

  const notifyDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    finishCb.current?.(simsRef.current);
  }, []);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTs.current = null;
      return;
    }
    const loop = (ts: number) => {
      const prevTs = lastTs.current ?? ts;
      lastTs.current = ts;
      const real = Math.min(0.1, (ts - prevTs) / 1000);
      const list = Object.entries(simsRef.current) as [ControlMode, Simulation][];
      if (!list.length) return;
      const dt = list[0][1].p.dt;
      accRef.current += real * speed;
      let steps = 0;
      while (accRef.current >= dt && steps < 600) {
        const last = accRef.current - dt < dt;
        for (const [m, s] of list) {
          if (s.finished) continue;
          if (last) {
            const map = new Map<number, VehiclePose>();
            for (const p of s.poses()) map.set(p.id, p);
            prevRef.current[m] = map;
          }
          s.step();
        }
        accRef.current -= dt;
        steps++;
      }
      if (steps >= 600) accRef.current = 0;
      setVersion((v) => v + 1);
      if (list.every(([, s]) => s.finished)) {
        setRunning(false);
        accRef.current = 0;
        notifyDone();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, speed, notifyDone]);

  const list = Object.values(simsRef.current) as Simulation[];
  const finished = list.length > 0 && list.every((s) => s.finished);

  return {
    net,
    sims: simsRef.current,
    modes,
    running,
    finished,
    started,
    t: list[0]?.t ?? 0,
    errors,
    version,
    start: () => {
      if (errors.length) return;
      if (finished) build();
      setStarted(true);
      setRunning(true);
    },
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      build();
    },
    finishNow: () => {
      setRunning(false);
      for (const s of list) s.run();
      accRef.current = 0;
      prevRef.current = {};
      setStarted(true);
      setVersion((v) => v + 1);
      notifyDone();
    },
    frame: (m) => {
      const s = simsRef.current[m];
      if (!s) return { poses: [], alpha: 1, views: [] };
      const dt = s.p.dt;
      return {
        poses: s.poses(),
        prev: running ? prevRef.current[m] : undefined,
        alpha: running ? Math.min(1, accRef.current / dt) : 1,
        views: s.junctionViews(),
        backlog: s.backlogCounts(),
      };
    },
  };
}
