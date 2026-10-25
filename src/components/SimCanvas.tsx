/**
 * Canvas 2D визуализациясы. Барлық координаттар симуляция ядросынан келеді (метр).
 * Қадамдар арасындағы позициялар сызықтық интерполяцияланады — көліктер «секірмейді».
 */
import { useEffect, useRef, useState } from 'react';
import type { Network, RoadSegment, Side } from '../core/network';
import { HEADING, LANE_WIDTH, rightNormal } from '../core/network';
import type { JunctionView, VehiclePose } from '../core/engine';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SimFrame {
  poses: VehiclePose[];
  prev?: Map<number, VehiclePose>;
  alpha: number;
  views: JunctionView[];
  backlog?: Record<string, number>;
}

const ROAD_W = 2 * LANE_WIDTH;
const WALK = 3.2;
const SIG = { green: '#1f9d55', yellow: '#e5a50a', red: '#d33a2c' } as const;
const CAR_COLORS = ['#f4f5f6', '#c8cdd3', '#8b949d', '#2e3a48', '#1d4f86', '#74302f', '#d9d3c5', '#3d6a59', '#e9eaeb', '#4b5563'];

export function fullView(net: Network, pad = 14): ViewBox {
  if (net.junctions.length > 1) {
    // дәліз: шеткі қиылыстардан 95 м — көше үлкенірек көрінеді
    const x0 = net.junctions[0].center.x - 95;
    const x1 = net.junctions[net.junctions.length - 1].center.x + 95;
    return { x: x0, y: -118, w: x1 - x0, h: 236 };
  }
  const b = net.bounds;
  return { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + 2 * pad, h: b.maxY - b.minY + 2 * pad };
}

export function focusView(net: Network, jid: string, r = 60): ViewBox {
  const j = net.junctionById[jid];
  return { x: j.center.x - r * 1.6, y: j.center.y - r, w: r * 3.2, h: r * 2 };
}

function at(link: RoadSegment, s: number, off: number) {
  const d = HEADING[link.heading];
  const rn = rightNormal(link.heading);
  return { x: link.a.x + d.x * s + rn.x * off, y: link.a.y + d.y * s + rn.y * off };
}

function hash(n: number) {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

function quad(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Статикалық қабат: жер, кварталдар, тротуар, асфальт, таңбалар. */
function drawStatic(ctx: CanvasRenderingContext2D, net: Network, world: ViewBox, showLabels: boolean, fontPx: number) {
  ctx.fillStyle = '#eef2ec';
  ctx.fillRect(world.x, world.y, world.w, world.h);

  // кварталдар
  const edge = ROAD_W + WALK;
  const xs = [world.x - 50, ...net.junctions.map((j) => j.center.x), world.x + world.w + 50];
  const ys: [number, number][] = [
    [world.y - 50, -edge],
    [edge, world.y + world.h + 50],
  ];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] + (i === 0 ? 0 : edge);
    const x1 = xs[i + 1] - (i === xs.length - 2 ? 0 : edge);
    if (x1 - x0 < 8) continue;
    for (const [y0, y1] of ys) {
      ctx.fillStyle = '#e4e9e1';
      roundRect(ctx, x0, y0, x1 - x0, y1 - y0, 3);
      ctx.fill();
      // ғимараттар — көшеге қараған жолақ бойымен
      const nearY = y0 < 0 ? y1 - 4 : y0 + 4;
      const depthDir = y0 < 0 ? -1 : 1;
      let bx = x0 + 6;
      let k = 0;
      while (bx < x1 - 14) {
        const h = hash(Math.round(x0 * 7 + bx * 3 + (y0 < 0 ? 1 : 2) * 101 + k));
        const bw = 14 + (h % 18);
        const bd = 12 + ((h >>> 5) % 16);
        if (bx + bw > x1 - 6) break;
        const top = depthDir < 0 ? nearY - bd : nearY;
        ctx.fillStyle = 'rgba(40,60,80,0.10)';
        ctx.fillRect(bx + 1.2, top + 1.6, bw, bd);
        ctx.fillStyle = (h >>> 9) % 3 === 0 ? '#f7f9fb' : (h >>> 9) % 3 === 1 ? '#eef2f6' : '#f3f1ec';
        ctx.fillRect(bx, top, bw, bd);
        ctx.strokeStyle = '#d3dae2';
        ctx.lineWidth = 0.35;
        ctx.strokeRect(bx, top, bw, bd);
        ctx.strokeStyle = '#e2e7ec';
        ctx.beginPath();
        ctx.moveTo(bx + 2, top + bd / 2);
        ctx.lineTo(bx + bw - 2, top + bd / 2);
        ctx.stroke();
        bx += bw + 3 + ((h >>> 13) % 5);
        k++;
      }
    }
  }
  // тротуарлар
  for (const l of net.links) {
    quad(ctx, [at(l, -2, ROAD_W), at(l, l.length + 2, ROAD_W), at(l, l.length + 2, ROAD_W + WALK), at(l, -2, ROAD_W + WALK)]);
    ctx.fillStyle = '#dde3e9';
    ctx.fill();
  }
  // ағаштар (тротуар бойымен, қиылыстардан алыс)
  for (const l of net.links) {
    for (let s = 10; s < l.length - 22; s += 17) {
      const p = at(l, s, ROAD_W + WALK + 2.2);
      if (net.junctions.some((j) => Math.abs(j.center.x - p.x) < 24 && Math.abs(j.center.y - p.y) < 24)) continue;
      ctx.fillStyle = 'rgba(40,70,40,0.12)';
      ctx.beginPath();
      ctx.arc(p.x + 0.6, p.y + 0.8, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (hash(Math.round(p.x * 13 + p.y)) & 1) === 0 ? '#a9c8a0' : '#9dbf95';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // асфальт
  ctx.fillStyle = '#4f5965';
  for (const l of net.links) {
    quad(ctx, [at(l, -0.5, 0), at(l, l.length + 0.5, 0), at(l, l.length + 0.5, ROAD_W), at(l, -0.5, ROAD_W)]);
    ctx.fill();
  }
  for (const j of net.junctions) {
    ctx.fillStyle = '#dde3e9';
    ctx.fillRect(j.center.x - j.half - WALK, j.center.y - j.half - WALK, 2 * (j.half + WALK), 2 * (j.half + WALK));
    ctx.fillStyle = '#4b5561';
    roundRect(ctx, j.center.x - j.half, j.center.y - j.half, 2 * j.half, 2 * j.half, 1.5);
    ctx.fill();
    // қиылысқа кіретін асфальт жалғасы
    ctx.fillStyle = '#4f5965';
    ctx.fillRect(j.center.x - j.half - WALK - 1, j.center.y - ROAD_W, WALK + 1.2, 2 * ROAD_W);
    ctx.fillRect(j.center.x + j.half - 0.2, j.center.y - ROAD_W, WALK + 1.2, 2 * ROAD_W);
    ctx.fillRect(j.center.x - ROAD_W, j.center.y - j.half - WALK - 1, 2 * ROAD_W, WALK + 1.2);
    ctx.fillRect(j.center.x - ROAD_W, j.center.y + j.half - 0.2, 2 * ROAD_W, WALK + 1.2);
  }
  // таңбалар
  for (const l of net.links) {
    // ось — қос сары сызық
    ctx.strokeStyle = '#e9c650';
    ctx.lineWidth = 0.16;
    for (const o of [0.14, -0.14]) {
      const a = at(l, 0, o + 0.14);
      const b = at(l, l.length, o + 0.14);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // жолақ бөлгіш
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.16;
    ctx.setLineDash([3, 4.5]);
    const a1 = at(l, 0, LANE_WIDTH);
    const b1 = at(l, Math.max(0, l.length - (l.isExit ? 0 : 20)), LANE_WIDTH);
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!l.isExit) {
      const b2 = at(l, l.length, LANE_WIDTH);
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
      // стоп-сызық
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.45;
      const s1 = at(l, l.length - 0.25, 0.25);
      const s2 = at(l, l.length - 0.25, ROAD_W - 0.1);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      // бағыт көрсеткіштері
      const ang = Math.atan2(HEADING[l.heading].y, HEADING[l.heading].x);
      for (const [lane, kind] of [
        [0, 'L'],
        [1, 'TR'],
      ] as const) {
        const p = at(l, l.length - 9, (lane + 0.5) * LANE_WIDTH);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.28;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (kind === 'L') {
          ctx.moveTo(-3, 0);
          ctx.lineTo(0.4, 0);
          ctx.quadraticCurveTo(1.4, 0, 1.4, -1.3);
          ctx.moveTo(0.6, -0.6);
          ctx.lineTo(1.4, -1.5);
          ctx.lineTo(2.2, -0.6);
        } else {
          ctx.moveTo(-3, 0);
          ctx.lineTo(2, 0);
          ctx.moveTo(1, -0.8);
          ctx.lineTo(2, 0);
          ctx.lineTo(1, 0.8);
          ctx.moveTo(-0.3, 0);
          ctx.quadraticCurveTo(0.8, 0, 0.8, 1.3);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  // жаяу жүргінші өткелдері
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (const j of net.junctions) {
    for (const side of ['N', 'E', 'S', 'W'] as Side[]) {
      if (!j.inLinks[side]) continue;
      const out = HEADING[side];
      const across = { x: -out.y, y: out.x };
      const inner = j.half - 3.6;
      const outer = j.half - 0.6;
      for (let k = -6; k <= 6; k++) {
        const o = k * 1.05;
        if (Math.abs(o) > ROAD_W - 0.4) continue;
        const c = { x: j.center.x + out.x * ((inner + outer) / 2) + across.x * o, y: j.center.y + out.y * ((inner + outer) / 2) + across.y * o };
        const len = outer - inner;
        const w = 0.55;
        ctx.fillRect(c.x - (out.x !== 0 ? len / 2 : w / 2), c.y - (out.y !== 0 ? len / 2 : w / 2), out.x !== 0 ? len : w, out.y !== 0 ? len : w);
      }
    }
  }
  if (showLabels) {
    ctx.font = `600 ${fontPx}px "Inter Variable", "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    for (const j of net.junctions) {
      const t = j.label;
      const w = ctx.measureText(t).width;
      const x = j.center.x + j.half + WALK + 3;
      const y = j.center.y - j.half - WALK - fontPx * 1.1;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, x - fontPx * 0.5, y - fontPx * 0.75, w + fontPx, fontPx * 1.5, fontPx * 0.4);
      ctx.fill();
      ctx.fillStyle = '#172b4d';
      ctx.fillText(t, x, y);
    }
  }
}

function lighten(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function drawVehicle(ctx: CanvasRenderingContext2D, v: VehiclePose, x: number, y: number, ang: number, kL: number, kW: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(kL, kW);
  const L = v.len;
  const W = 1.84;
  // көлеңке
  ctx.fillStyle = 'rgba(15,25,35,0.22)';
  roundRect(ctx, -L + 0.25, -W / 2 + 0.3, L, W, 0.6);
  ctx.fill();
  if (v.type === 'truck') {
    // тіркеме
    ctx.fillStyle = '#f2f4f6';
    roundRect(ctx, -L, -W / 2 - 0.1, L - 2.9, W + 0.2, 0.3);
    ctx.fill();
    ctx.strokeStyle = '#b9c2cc';
    ctx.lineWidth = 0.12;
    ctx.stroke();
    ctx.fillStyle = '#16866d';
    ctx.fillRect(-L + 0.6, -W / 2 + 0.25, L - 4.1, 0.22);
    // кабина
    ctx.fillStyle = '#1769aa';
    roundRect(ctx, -2.7, -W / 2, 2.7, W, 0.45);
    ctx.fill();
    ctx.fillStyle = '#22303d';
    ctx.fillRect(-0.95, -W / 2 + 0.2, 0.55, W - 0.4);
  } else {
    const col = CAR_COLORS[hash(v.id) % CAR_COLORS.length];
    ctx.fillStyle = col;
    roundRect(ctx, -L, -W / 2, L, W, 0.7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,40,0.25)';
    ctx.lineWidth = 0.08;
    ctx.stroke();
    // жел әйнегі, төбе, артқы әйнек
    ctx.fillStyle = '#25303b';
    quad(ctx, [
      { x: -0.85, y: -W / 2 + 0.22 },
      { x: -0.85, y: W / 2 - 0.22 },
      { x: -1.55, y: W / 2 - 0.3 },
      { x: -1.55, y: -W / 2 + 0.3 },
    ]);
    ctx.fill();
    ctx.fillStyle = lighten(col, 0.12);
    ctx.fillRect(-3.15, -W / 2 + 0.3, 1.6, W - 0.6);
    ctx.fillStyle = '#2c3843';
    ctx.fillRect(-3.75, -W / 2 + 0.32, 0.55, W - 0.64);
    // фаралар
    ctx.fillStyle = '#fff4d1';
    ctx.fillRect(-0.18, -W / 2 + 0.15, 0.16, 0.42);
    ctx.fillRect(-0.18, W / 2 - 0.57, 0.16, 0.42);
  }
  // тежегіш шамдары: тоқтағанда жарқын
  ctx.fillStyle = v.stopped ? '#e5352a' : '#8a2a22';
  ctx.fillRect(-L, -W / 2 + 0.12, 0.16, 0.4);
  ctx.fillRect(-L, W / 2 - 0.52, 0.16, 0.4);
  ctx.restore();
}

function drawSignals(ctx: CanvasRenderingContext2D, net: Network, views: JunctionView[], k: number) {
  for (const jv of views) {
    const j = net.junctionById[jv.id];
    for (const side of Object.keys(jv.lights) as Side[]) {
      const lid = j.inLinks[side]!;
      const l = net.linkById[lid];
      const [left, thr] = jv.lights[side];
      // стоп-сызықтағы күй (жолақ бойынша)
      for (const [lane, st] of [
        [0, left],
        [1, thr],
      ] as const) {
        const s1 = at(l, l.length - 0.9, lane * LANE_WIDTH + 0.35);
        const s2 = at(l, l.length - 0.9, (lane + 1) * LANE_WIDTH - 0.35);
        ctx.strokeStyle = SIG[st];
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // бағдаршам бастары (тротуарда)
      const ang = Math.atan2(HEADING[l.heading].y, HEADING[l.heading].x);
      for (const [idx, st] of [
        [0, thr],
        [1, left],
      ] as const) {
        const p = at(l, l.length - 1.2 - idx * 3.4 * Math.min(k, 1.6), ROAD_W + 1.5 + 0.6 * (k - 1));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.scale(Math.min(k, 1.8), Math.min(k, 1.8));
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        roundRect(ctx, -1.45, -0.45, 3.1, 1.15, 0.35);
        ctx.fill();
        ctx.fillStyle = '#1f262e';
        roundRect(ctx, -1.6, -0.6, 3.1, 1.15, 0.35);
        ctx.fill();
        const lamps: ['red' | 'yellow' | 'green', number][] = [
          ['green', -0.75],
          ['yellow', -0.05],
          ['red', 0.65],
        ];
        for (const [c, lx] of lamps) {
          const on = st === c;
          if (on) {
            ctx.fillStyle = SIG[c];
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            ctx.arc(lx, -0.02, 0.62, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = on ? SIG[c] : '#3a434d';
          ctx.beginPath();
          ctx.arc(lx, -0.02, 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        if (idx === 1) {
          // солға бұрылу басы — кішкене көрсеткі
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.1;
          ctx.beginPath();
          ctx.moveTo(1.15, 0.2);
          ctx.lineTo(1.15, -0.25);
          ctx.lineTo(1.0, -0.12);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function SimCanvas({
  net,
  frame,
  view,
  title,
  showLabels = true,
  maxHeight = 640,
}: {
  net: Network;
  frame: SimFrame;
  view: ViewBox;
  title: string;
  showLabels?: boolean;
  maxHeight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const height = width ? Math.round(Math.min(maxHeight, (width * view.h) / view.w)) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const scale = Math.min(width / view.w, height / view.h);
    const world: ViewBox = {
      x: view.x - (width / scale - view.w) / 2,
      y: view.y - (height / scale - view.h) / 2,
      w: width / scale,
      h: height / scale,
    };
    const fontPx = Math.max(3.2, 12 / scale);
    const key = `${width}x${height}@${dpr}|${view.x},${view.y},${view.w},${view.h}|${showLabels}|${net.kind}`;
    if (!staticRef.current || staticRef.current.key !== key) {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const octx = off.getContext('2d')!;
      octx.setTransform(dpr * scale, 0, 0, dpr * scale, -world.x * dpr * scale, -world.y * dpr * scale);
      drawStatic(octx, net, world, showLabels, fontPx);
      staticRef.current = { key, canvas: off };
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticRef.current.canvas, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -world.x * dpr * scale, -world.y * dpr * scale);
    // ірі масштабта көрнекілік үшін үлкейту
    const k = Math.max(1, Math.min(2.6, 13 / (4.5 * scale)));
    drawSignals(ctx, net, frame.views, k);
    const { prev, alpha } = frame;
    for (const v of frame.poses) {
      let x = v.x;
      let y = v.y;
      let a = v.angle;
      const p = prev?.get(v.id);
      if (p && alpha < 1) {
        const dist = Math.hypot(v.x - p.x, v.y - p.y);
        if (dist < 30) {
          x = p.x + (v.x - p.x) * alpha;
          y = p.y + (v.y - p.y) * alpha;
          a = lerpAngle(p.angle, v.angle, alpha);
        }
      }
      if (x < world.x - 20 || x > world.x + world.w + 20 || y < world.y - 20 || y > world.y + world.h + 20) continue;
      drawVehicle(ctx, v, x, y, a, k, Math.min(k, 1.55));
    }
    if (frame.backlog) {
      ctx.font = `600 ${fontPx}px "Inter Variable", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const id of net.entries) {
        const n = frame.backlog[id] ?? 0;
        if (!n) continue;
        const l = net.linkById[id];
        const p = at(l, Math.max(6, 0.06 * l.length), ROAD_W + WALK + fontPx * 1.4);
        if (p.x < world.x || p.x > world.x + world.w || p.y < world.y || p.y > world.y + world.h) continue;
        const t = `+${n}`;
        const w = ctx.measureText(t).width + fontPx;
        ctx.fillStyle = '#9a5b00';
        roundRect(ctx, p.x - w / 2, p.y - fontPx * 0.75, w, fontPx * 1.5, fontPx * 0.75);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(t, p.x, p.y + fontPx * 0.05);
      }
      ctx.textAlign = 'start';
    }
  });

  return (
    <div ref={wrapRef} className="sim-canvas-wrap">
      <canvas ref={canvasRef} role="img" aria-label={title} style={{ width: width || '100%', height: height || 240, display: 'block' }} />
    </div>
  );
}
