import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard, EmptyState } from '../components/ui.jsx'
import RecipeStatusBadge from '../components/RecipeStatusBadge.jsx'
import RecipeFormModal from '../components/RecipeFormModal.jsx'
import { dateLong, time } from '../utils/format.js'
import { canModify } from '../config/permissions.js'
import { IconKitchen, IconClock, IconCheck, IconMenuBook, IconPlus } from '../components/Icons.jsx'

// A single recipe card. When the viewer may approve (Admin) and the recipe is
// still pending, it shows inline Approve/Reject actions — so approvals happen
// right here, no separate Dashboard section needed. Reject requires a reason.
function RecipeCard({ recipe: r, canApprove, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const isPending = r.status === 'pending'

  const confirmReject = () => {
    if (!reason.trim()) return
    onReject(r.id, reason.trim())
    setRejecting(false)
    setReason('')
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-cream">{r.menuItemName}</p>
          <p className="mt-0.5 text-xs text-cream-dim">
            By {r.createdBy} · {time(r.createdAt)}
          </p>
        </div>
        <RecipeStatusBadge status={r.status} />
      </div>

      <div className="mt-3 rounded-xl border border-ink-line bg-ink-soft p-3">
        <p className="mb-1.5 text-xs uppercase tracking-widest text-cream-dim">Ingredients</p>
        <ul className="space-y-1 text-sm text-cream">
          {r.ingredients.map((ing) => (
            <li key={ing.id} className="flex justify-between">
              <span className="text-cream-dim">{ing.itemName}</span>
              <span>
                {ing.quantity} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {r.status === 'rejected' && r.rejectReason && (
        <p className="mt-3 text-xs text-rose-300">Rejected: {r.rejectReason}</p>
      )}

      {/* Approve/Reject — Admin only, pending recipes only. */}
      {canApprove && isPending && (
        rejecting ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection…"
              className="input flex-1"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={confirmReject}
                disabled={!reason.trim()}
                className="rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => {
                  setRejecting(false)
                  setReason('')
                }}
                className="btn-ghost px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button onClick={() => onApprove(r.id)} className="btn-gold flex-1 px-4 py-2 text-sm">
              ✓ Approve
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="btn-ghost flex-1 px-4 py-2 text-sm"
            >
              ✕ Reject
            </button>
          </div>
        )
      )}
    </div>
  )
}

export default function Kitchen() {
  const { recipes, createRecipe, approveRecipe, rejectRecipe, menu, inventory, user } = useApp()
  const [showModal, setShowModal] = useState(false)

  // Only Kitchen staff create recipes. Admin/Manager have 'view' access to this
  // dashboard (to watch recipe status) but must not see the create control —
  // Admin's job is Approve/Reject, Manager's is neither.
  const canCreate = user ? canModify(user.role, 'recipeCreate') : false
  // Admin approves/rejects pending recipes right on this page.
  const canApprove = user ? canModify(user.role, 'recipeApproval') : false

  const counts = recipes.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    { pending: 0, approved: 0, rejected: 0 },
  )

  // Newest first.
  const sorted = [...recipes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div>
      <PageHeader title="Kitchen Dashboard" subtitle={dateLong()}>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-gold">
            <IconPlus size={18} /> Create Recipe
          </button>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconClock} label="Pending Approval" value={counts.pending} sub="Awaiting Admin" />
        <StatCard icon={IconCheck} label="Approved" value={counts.approved} sub="Live for deduction" />
        <StatCard icon={IconMenuBook} label="Total Recipes" value={recipes.length} sub="All statuses" />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={IconKitchen}
          title="No recipes yet"
          hint={
            canCreate
              ? 'Create your first recipe to define which inventory ingredients a menu item uses. Once an Admin approves it, orders auto-deduct stock.'
              : canApprove
                ? 'Waiting for Kitchen staff to submit a recipe. Once submitted, it will appear here for your review and approval.'
                : 'Waiting for Kitchen staff to submit a recipe. Recipes are created by Kitchen and approved by Admin.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              canApprove={canApprove}
              onApprove={approveRecipe}
              onReject={rejectRecipe}
            />
          ))}
        </div>
      )}

      {showModal && canCreate && (
        <RecipeFormModal
          menu={menu}
          inventory={inventory}
          existingRecipes={recipes}
          onSave={(data) => {
            createRecipe(data)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
