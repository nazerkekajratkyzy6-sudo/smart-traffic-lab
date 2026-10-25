/** Excel үшін CSV: UTF-8 BOM, бөлгіш ';' және ондық үтір (KZ/RU локаль) немесе ',' және нүкте. */
export type CsvStyle = 'excel-kz' | 'standard';

export function toCsv(rows: (string | number | boolean | null | undefined)[][], style: CsvStyle = 'excel-kz'): string {
  const sep = style === 'excel-kz' ? ';' : ',';
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return '';
    let s: string;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '';
      s = String(Math.round(v * 10000) / 10000);
      if (style === 'excel-kz') s = s.replace('.', ',');
    } else s = String(v);
    if (s.includes(sep) || /["\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}

/** Қарапайым CSV оқу: бөлгішті автоматты анықтайды. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/)[0] ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) && first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export function parseNum(s: string): number {
  return Number(String(s).trim().replace(/\s/g, '').replace(',', '.'));
}
