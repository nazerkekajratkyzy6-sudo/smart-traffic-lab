import type { SVGProps } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  city: 'M3 21h18M5 21V8l6-3v16M11 21V10l8 3v8M8 10v.01M8 14v.01M8 18v.01M15 15v.01M15 18v.01',
  signal: 'M9 2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 7v.01M12 11v.01M12 15v.01M12 20v2',
  formula: 'M4 6h8M4 12h5M4 18h8M15 6l5 12M20 6l-5 12',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  flask: 'M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  report: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  reset: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  fast: 'M4 5v14l8-7zM12 5v14l8-7z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17l9-10',
  alert: 'M12 3 2 20h20zM12 10v4M12 17v.01',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  step: 'M5 5v14M9 5l10 7-10 7z',
 arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  exit: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  car: 'M5 16h14M6 16l1.5-5h9L18 16M5 16v3h2v-2M19 16v3h-2v-2M8 13.5h.01M16 13.5h.01',
  question: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17v.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0f5fa8" />
      <rect x="24" y="9" width="16" height="46" rx="8" fill="#fff" />
      <circle cx="32" cy="19" r="4.6" fill="#c8372b" />
      <circle cx="32" cy="32" r="4.6" fill="#e5a50a" />
      <circle cx="32" cy="45" r="4.6" fill="#1d8a4c" />
    </svg>
  );
}
