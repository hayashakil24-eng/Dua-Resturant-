import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import { navForRole } from './config/nav.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import POS from './pages/POS.jsx'
import Orders from './pages/Orders.jsx'
import Inventory from './pages/Inventory.jsx'
import Attendance from './pages/Attendance.jsx'
import Payroll from './pages/Payroll.jsx'
import Accounting from './pages/Accounting.jsx'
import Reports from './pages/Reports.jsx'
import KitchenDisplay from './pages/KitchenDisplay.jsx'
import Billing from './pages/Billing.jsx'

// Guards a route: must be logged in and role must allow the path.
// `fullscreen` renders the page without the sidebar/header Layout (used by KDS).
function Protected({ path, children, fullscreen }) {
  const { user } = useApp()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  const allowedNavs = navForRole(user.role)
  const allowed = allowedNavs.some((n) => n.to === path)

  if (!allowed) {
    if (allowedNavs.length > 0) {
      return <Navigate to={allowedNavs[0].to} replace />
    }
    return <Navigate to="/login" replace />
  }
  return fullscreen ? children : <Layout>{children}</Layout>
}

export default function App() {
  const { user } = useApp()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected path="/"><Dashboard /></Protected>} />
      <Route path="/pos" element={<Protected path="/pos"><POS /></Protected>} />
      <Route path="/orders" element={<Protected path="/orders"><Orders /></Protected>} />
      <Route path="/inventory" element={<Protected path="/inventory"><Inventory /></Protected>} />
      <Route
        path="/attendance"
        element={<Protected path="/attendance"><Attendance /></Protected>}
      />
      <Route path="/payroll" element={<Protected path="/payroll"><Payroll /></Protected>} />
      <Route path="/accounting" element={<Protected path="/accounting"><Accounting /></Protected>} />
      <Route path="/reports" element={<Protected path="/reports"><Reports /></Protected>} />
      <Route path="/kds" element={<Protected path="/kds" fullscreen><KitchenDisplay /></Protected>} />
      <Route path="/billing" element={<Protected path="/billing"><Billing /></Protected>} />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
