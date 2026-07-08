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
export const IconInventory = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z" />
        <path d="M3 7l9 4 9-4M12 11v10" />
      </>
    }
  />
)
export const IconAlert = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M12 3l9 16H3L12 3Z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    }
  />
)
export const IconWallet = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0" />
        <path d="M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3" />
        <path d="M21 11h-4a2 2 0 0 0 0 4h4v-4Z" />
      </>
    }
  />
)
export const IconChart = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" rx="0.5" />
        <rect x="12" y="8" width="3" height="10" rx="0.5" />
        <rect x="17" y="5" width="3" height="13" rx="0.5" />
      </>
    }
  />
)
export const IconTrendDown = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M3 7l6 6 4-4 8 8" />
        <path d="M21 17v-5h-5" />
      </>
    }
  />
)
export const IconCalendar = (p) => (
  <Icon
    {...p}
    path={
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </>
    }
  />
)
export const IconEdit = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
        <path d="M13.5 6.5l3 3" />
      </>
    }
  />
)
export const IconMenuBook = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M12 6c-1.5-1.2-3.5-2-6-2v13c2.5 0 4.5.8 6 2 1.5-1.2 3.5-2 6-2V4c-2.5 0-4.5.8-6 2Z" />
        <path d="M12 6v13" />
      </>
    }
  />
)
export const IconReport = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" />
      </>
    }
  />
)
export const IconWhatsApp = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" />
        <path d="M9 8.5c.2 2 1.4 3.5 3.3 4.6.9.5 1.6.6 2 .1l.6-.8-1.8-1.1-.7.6c-.7-.4-1.3-1-1.7-1.7l.6-.7-1.1-1.8-.8.5c-.3.2-.4.5-.7 0Z" />
      </>
    }
  />
)
export const IconKitchen = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M6 12a4 4 0 1 1 1.2-7.8 4.5 4.5 0 0 1 9.6 0A4 4 0 1 1 18 12" />
        <path d="M7 12h10v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6Z" />
        <path d="M10 16h4" />
      </>
    }
  />
)
export const IconRefresh = (p) => (
  <Icon
    {...p}
    path={
      <>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 4v5h-5" />
      </>
    }
  />
)
