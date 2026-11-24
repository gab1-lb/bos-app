/* Icônes du jeu d'origine BOS (legacy/app.js, objet P). */
const P = {
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  layers: '<path d="m3 7 9-4 9 4-9 5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  activity: '<path d="M2 12h4l3-7 5 14 3-8 2 1h3"/>',
  file: '<path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7m-7 4h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
  chart: '<path d="M3 3v18h18M7 16v-4m5 4V8m5 8V5"/>',
  inbox: '<path d="m3 14 4-9h10l4 9v5H3zM3 14h6l1 2h4l1-2h6"/>',
  coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 4 16 4 16 0V6M4 11v5c0 4 16 4 16 0v-5"/>',
  percent: '<path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  scale: '<path d="M12 3v17m-5 1h10M3 7l9-2 9 2M5 7l-3 7h6zM19 7l-3 7h6z"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  building: '<path d="M4 21V8l9-5v18m0-12h7v12M2 21h20M7 10h2m-2 4h2m-2 4h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  flag: '<path d="M5 21V4c4-4 9 4 14 0v9c-6 4-10-4-14 0"/>',
  settings: '<path d="M3 7h5m5 0h8M3 17h11m5 0h2"/><circle cx="10" cy="7" r="2.5"/><circle cx="16" cy="17" r="2.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  list: '<path d="m3 6 1 1 2-3m2 2h13M3 12h2m3 0h13M3 18h2m3 0h13"/>',
  home: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name] }} />;
}

export function Logo() {
  return (
    <svg viewBox="0 0 36 34" aria-hidden="true">
      <path fill="#3e6cfa" d="M1 28 8 8h7L8 28zM12 28 21 3h7l-9 25zM23 28l6-16h7l-6 16z" />
    </svg>
  );
}
