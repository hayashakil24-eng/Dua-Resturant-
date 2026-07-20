import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import { navForRole, landingForRole } from './config/nav.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import PendingApproval from './pages/PendingApproval.jsx'
import Approvals from './pages/Approvals.jsx'
import Dashboard from './pages/Dashboard.jsx'
import POS from './pages/POS.jsx'
import Orders from './pages/Orders.jsx'
import Tables from './pages/Tables.jsx'
import MenuManagement from './pages/MenuManagement.jsx'
import DepartmentManagement from './pages/DepartmentManagement.jsx'
import Inventory from './pages/Inventory.jsx'
import Attendance from './pages/Attendance.jsx'
import Employees from './pages/Employees.jsx'
import Payroll from './pages/Payroll.jsx'
import Accounting from './pages/Accounting.jsx'
import ReceivablesManagement from './pages/ReceivablesManagement.jsx'
import HandoverApprovals from './pages/HandoverApprovals.jsx'
import Reports from './pages/Reports.jsx'
import Closing from './pages/Closing.jsx'
import KitchenDisplay from './pages/KitchenDisplay.jsx'
import Kitchen from './pages/Kitchen.jsx'
import Billing from './pages/Billing.jsx'
import Settings from './pages/Settings.jsx'

// Guards a route: must be logged in and role must allow the path.
// `fullscreen` renders the page without the sidebar/header Layout (used by KDS).
function Protected({ path, children, fullscreen }) {
  const { user } = useApp()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  // A self-signup account awaiting Admin review has role 'Pending' and thus
  // an empty navForRole([]) — without this explicit case it would fall
  // through to the "no allowed nav items" branch below and redirect to
  // /login, whose own `user ? <Navigate to="/"/> : <Login/>` sends it right
  // back to "/" (-> Protected -> /login -> ...), an infinite redirect loop.
  if (user.role === 'Pending') return <Navigate to="/pending-approval" replace />

  const allowedNavs = navForRole(user.role)
  const allowed = allowedNavs.some((n) => n.to === path)

  if (!allowed) {
    if (allowedNavs.length > 0) {
      // Land on a page that actually has a sidebar (never the fullscreen KDS),
      // so the role can navigate onward from there.
      return <Navigate to={landingForRole(user.role)} replace />
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
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route
        path="/pending-approval"
        element={user?.role === 'Pending' ? <PendingApproval /> : <Navigate to={user ? '/' : '/login'} replace />}
      />
      <Route path="/" element={<Protected path="/"><Dashboard /></Protected>} />
      <Route path="/pos" element={<Protected path="/pos"><POS /></Protected>} />
      <Route path="/orders" element={<Protected path="/orders"><Orders /></Protected>} />
      <Route path="/tables" element={<Protected path="/tables"><Tables /></Protected>} />
      <Route path="/menu" element={<Protected path="/menu"><MenuManagement /></Protected>} />
      <Route path="/departments" element={<Protected path="/departments"><DepartmentManagement /></Protected>} />
      <Route path="/inventory" element={<Protected path="/inventory"><Inventory /></Protected>} />
      <Route
        path="/attendance"
        element={<Protected path="/attendance"><Attendance /></Protected>}
      />
      <Route path="/employees" element={<Protected path="/employees"><Employees /></Protected>} />
      <Route path="/approvals" element={<Protected path="/approvals"><Approvals /></Protected>} />
      <Route path="/payroll" element={<Protected path="/payroll"><Payroll /></Protected>} />
      <Route path="/accounting" element={<Protected path="/accounting"><Accounting /></Protected>} />
      <Route path="/receivables" element={<Protected path="/receivables"><ReceivablesManagement /></Protected>} />
      <Route path="/handovers" element={<Protected path="/handovers"><HandoverApprovals /></Protected>} />
      <Route path="/reports" element={<Protected path="/reports"><Reports /></Protected>} />
      <Route path="/closing" element={<Protected path="/closing"><Closing /></Protected>} />
      <Route path="/kitchen" element={<Protected path="/kitchen"><Kitchen /></Protected>} />
      <Route path="/kds" element={<Protected path="/kds" fullscreen><KitchenDisplay /></Protected>} />
      <Route path="/billing" element={<Protected path="/billing"><Billing /></Protected>} />
      <Route path="/settings" element={<Protected path="/settings"><Settings /></Protected>} />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
