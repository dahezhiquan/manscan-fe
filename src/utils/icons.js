export function iconPath(name) {
  const icons = {
    grid: `
      <rect x="3" y="3" width="7" height="7" rx="1.6"/>
      <rect x="14" y="3" width="7" height="7" rx="1.6"/>
      <rect x="3" y="14" width="7" height="7" rx="1.6"/>
      <rect x="14" y="14" width="7" height="7" rx="1.6"/>
    `,
    shield: `
      <path d="M12 3.5 18.5 6v6c0 4.2-2.7 7.8-6.5 9-3.8-1.2-6.5-4.8-6.5-9V6L12 3.5Z"/>
      <path d="M12 8v5.2"/>
      <circle cx="12" cy="16.3" r="1"/>
    `,
    scan: `
      <path d="M8 4H5.8A1.8 1.8 0 0 0 4 5.8V8"/>
      <path d="M16 4h2.2A1.8 1.8 0 0 1 20 5.8V8"/>
      <path d="M8 20H5.8A1.8 1.8 0 0 1 4 18.2V16"/>
      <path d="M16 20h2.2a1.8 1.8 0 0 0 1.8-1.8V16"/>
    `,
    stack: `
      <ellipse cx="12" cy="6.2" rx="7" ry="2.7"/>
      <path d="M5 6.2v5.2c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7V6.2"/>
      <path d="M5 11.4v5.2c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7v-5.2"/>
    `,
    server: `
      <rect x="4" y="5" width="16" height="5.5" rx="1.8"/>
      <rect x="4" y="13.5" width="16" height="5.5" rx="1.8"/>
      <path d="M8 8h.01M8 16.5h.01"/>
    `,
    chart: `
      <path d="M5 19V9"/>
      <path d="M12 19V5"/>
      <path d="M19 19v-7"/>
      <path d="M4 19h16"/>
    `,
    editor: `
      <rect x="4.5" y="4.5" width="15" height="15" rx="2"/>
      <path d="M8 8.5h8M8 12h8M8 15.5h5"/>
    `,
    history: `
      <path d="M4.5 12A7.5 7.5 0 1 0 7 6.5"/>
      <path d="M4.5 5.5v4h4"/>
      <path d="M12 8v4l2.8 1.8"/>
    `,
    leaderboard: `
      <path d="M6 17V9"/>
      <path d="M12 17V6"/>
      <path d="M18 17v-4"/>
      <path d="M4 17h16"/>
      <path d="m12 4 1 1.6 1.8.3-.9 1.4.2 1.7-1.6-.8-1.6.8.2-1.7-.9-1.4 1.8-.3L12 4Z"/>
    `,
    library: `
      <path d="M5.5 4.5v15"/>
      <path d="M9.5 4.5v15"/>
      <path d="M13.5 4.5v15"/>
      <path d="M17.5 4.5v15"/>
      <path d="M4 19.5h15"/>
    `,
    doc: `
      <rect x="6" y="3.5" width="12" height="17" rx="2"/>
      <path d="M9 8.5h6M9 12h6M9 15.5h4"/>
    `,
    lock: `
      <rect x="5" y="11" width="14" height="9" rx="2"/>
      <path d="M8 11V8a4 4 0 1 1 8 0v3"/>
    `,
    plug: `
      <path d="M9 4v5M15 4v5"/>
      <path d="M7 9h10v2a5 5 0 0 1-5 5v4"/>
    `,
    gear: `
      <circle cx="12" cy="12" r="3.3"/>
      <path d="m12 3 1 2.3 2.6.5.6 2.5 2 1.7-1 2.3 1 2.3-2 1.7-.6 2.5-2.6.5L12 21l-1-2.3-2.6-.5-.6-2.5-2-1.7 1-2.3-1-2.3 2-1.7.6-2.5 2.6-.5L12 3Z"/>
    `,
    help: `
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.5 9.2a2.7 2.7 0 0 1 5 .9c0 2-2.5 2.4-2.5 4"/>
      <circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>
    `,
    logout: `
      <path d="M10 6H6.8A1.8 1.8 0 0 0 5 7.8v8.4A1.8 1.8 0 0 0 6.8 18H10"/>
      <path d="M13 8.5 17 12l-4 3.5"/>
      <path d="M9 12h8"/>
    `
  }

  return icons[name] ?? ''
}
