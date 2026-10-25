import { useState as useStateX, useMemo as useMemoX } from 'react';
import katex from 'katex';
import { Icon as IconX } from './Icon';
import type { ReactNode } from 'react';

export function PageHead({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </header>
  );
}

export function DataBadge({ kind = 'example' }: { kind?: 'example' | 'simulated' | 'hypothesis' | 'observed' }) {
  const map = {
    example: ['warn', 'Оқу мысалы / модельдік дерек'],
    simulated: ['blue', 'Симуляция нәтижесі'],
    hypothesis: ['teal', 'Гипотеза'],
    observed: ['ok', 'Бақылау (көзі көрсетілген)'],
  } as const;
  const [cls, text] = map[kind];
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function Kpi({ k, v, u }: { k: string; v: ReactNode; u?: string }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {u && <span className="u">{u}</span>}
      </div>
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  id,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  id?: string;
  disabled?: boolean;
}) {
  const invalid = !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max);
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label} {hint && <span className="hint">· {hint}</span>}
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
    </label>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}


/** Бір әрекетке бір кеңес. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="hint" role="status" aria-live="polite">
      <span className="hint-ic">
        <IconX name="arrowR" size={15} />
      </span>
      <span>{children}</span>
    </div>
  );
}

/** «Бұл график нені көрсетеді?» сияқты қысқа түсіндірме. */
export function Explain({ label = 'Бұл график нені көрсетеді?', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useStateX(false);
  return (
    <div>
      <button type="button" className="explain-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconX name="question" size={16} /> {label}
      </button>
      {open && (
        <div className="note info small" style={{ marginTop: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** KaTeX формуласы (қазақ мәтіні формуладан тыс жазылады). */
export function TeX({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemoX(() => katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: 'ignore', output: 'html' }), [tex, block]);
  return block ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Үлкен таңдау батырмалары. */
export function ChoiceGroup<T extends string>({ n, label, value, options, onChange }: { n?: number; label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="choice">
      <div className="choice-label">
        {n !== undefined && <span className="choice-num">{n}</span>}
        {label}
      </div>
      <div className="seg big" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}
