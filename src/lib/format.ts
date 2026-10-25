/** Қазақстандық жазу: ондық бөлгіш — үтір, мың бөлгіш — бос орын. */
function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function fmt(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(digits);
  const [i, d] = s.split('.');
  const neg = x < 0 && Number(s) !== 0 ? '−' : '';
  return neg + group(i) + (d ? ',' + d : '');
}

export function fmtInt(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return fmt(Math.round(x), 0);
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
}

export const MODE_LABEL = { fixed: 'Қарапайым', adaptive: 'Ақылды' } as const;
export const MODE_COLOR = { fixed: '#6b7a8c', adaptive: '#0e7f9b' } as const;
