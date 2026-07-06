// Lightweight inline stroke icons (no external dependency)
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const Icon = ({ path, size = 20, ...rest }) => (
  <svg {...base} width={size} height={size} {...rest}>
    {path}
  </svg>
)

export const IconDashboard = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    }
  />
)

export const IconPOS = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </>
    }
  />
)

export const IconOrders = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M9 4h6a2 2 0 0 1 2 2v0h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1v0a2 2 0 0 1 2-2Z" />
        <path d="M9 4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1" />
        <path d="M8 12h8M8 16h5" />
      </>
    }
  />
)

export const IconAttendance = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 20a5 5 0 0 1 10 0" />
        <path d="M15 11l2 2 4-4" />
      </>
    }
  />
)

export const IconReceipt = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>
    }
  />
)

export const IconLogout = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M15 12H4M10 7l-5 5 5 5" />
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      </>
    }
  />
)

export const IconCash = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </>
    }
  />
)

export const IconTable = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 9h18M4 9l1 11M20 9l-1 11M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
      </>
    }
  />
)

export const IconUsers = (p) => (
  <Icon
    {...p}
    path={
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5M17 20a6 6 0 0 0-2-4.5" />
      </>
    }
  />
)

export const IconTrend = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M21 7v5h-5" />
      </>
    }
  />
)

export const IconPlus = (p) => <Icon {...p} path={<path d="M12 5v14M5 12h14" />} />
export const IconMinus = (p) => <Icon {...p} path={<path d="M5 12h14" />} />
export const IconTrash = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      </>
    }
  />
)
export const IconSearch = (p) => (
  <Icon {...p} path={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>} />
)
export const IconPrint = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M6 9V3h12v6" />
        <rect x="4" y="9" width="16" height="8" rx="2" />
        <path d="M8 17h8v4H8z" />
      </>
    }
  />
)
export const IconMenu = (p) => (
  <Icon {...p} path={<><path d="M4 6h16M4 12h16M4 18h16" /></>} />
)
export const IconClose = (p) => (
  <Icon {...p} path={<><path d="M6 6l12 12M18 6L6 18" /></>} />
)
export const IconCheck = (p) => <Icon {...p} path={<path d="M5 12l5 5L20 6" />} />
export const IconClock = (p) => (
  <Icon {...p} path={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
)
