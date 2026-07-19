import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard, EmptyState } from '../components/ui.jsx'
import RecipeStatusBadge from '../components/RecipeStatusBadge.jsx'
import RecipeFormModal from '../components/RecipeFormModal.jsx'
import { dateLong, time } from '../utils/format.js'
import { canModify } from '../config/permissions.js'
import { IconKitchen, IconClock, IconCheck, IconMenuBook, IconPlus, IconEdit, IconTrash } from '../components/Icons.jsx'

// A single recipe card. When the viewer may approve (Admin) and the recipe is
// still pending, it shows inline Approve/Reject actions — so approvals happen
// right here, no separate Dashboard section needed. Reject requires a reason.
function RecipeCard({ recipe: r, canApprove, canEdit, canDelete, onApprove, onReject, onEdit, onDelete }) {
  const t = useT()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const isPending = r.status === 'pending'

  const confirmReject = () => {
    if (!reason.trim()) return
    onReject(r.id, reason.trim())
    setRejecting(false)
    setReason('')
  }

  const confirmDelete = () => {
    if (!deleteReason.trim()) return
    onDelete(r.id, deleteReason.trim())
    setDeleting(false)
    setDeleteReason('')
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-cream">{r.menuItemName}</p>
          <p className="mt-0.5 text-xs text-cream-dim">
            {t('kitchen.by')} {r.createdBy} · {time(r.createdAt)}
          </p>
        </div>
        <RecipeStatusBadge status={r.status} />
      </div>

      <div className="mt-3 rounded-xl border border-ink-line bg-ink-soft p-3">
        <p className="mb-1.5 text-xs uppercase tracking-widest text-cream-dim">{t('kitchen.ingredients')}</p>
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
        <p className="mt-3 text-xs text-rose-300">{t('kitchen.rejectedLabel')}: {r.rejectReason}</p>
      )}

      {/* Approve/Reject — Admin only, pending recipes only. */}
      {canApprove && isPending && (
        rejecting ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('kitchen.reasonPh')}
              className="input flex-1"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={confirmReject}
                disabled={!reason.trim()}
                className="rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
              >
                {t('kitchen.confirmReject')}
              </button>
              <button
                onClick={() => {
                  setRejecting(false)
                  setReason('')
                }}
                className="btn-ghost px-4 py-2.5 text-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button onClick={() => onApprove(r.id)} className="btn-gold flex-1 px-4 py-2 text-sm">
              ✓ {t('kitchen.approve')}
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="btn-ghost flex-1 px-4 py-2 text-sm"
            >
              ✕ {t('kitchen.reject')}
            </button>
          </div>
        )
      )}

      {/* Edit (Kitchen) / Delete (Admin). Editing sends the recipe back to
          pending for re-approval; deleting is Admin-only and needs a reason. */}
      {(canEdit || canDelete) && (
        deleting ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-ink-line pt-3 sm:flex-row">
            <input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder={t('kitchen.deleteReasonPh')}
              className="input flex-1"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={!deleteReason.trim()}
                className="rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
              >
                {t('kitchen.confirmDelete')}
              </button>
              <button
                onClick={() => {
                  setDeleting(false)
                  setDeleteReason('')
                }}
                className="btn-ghost px-4 py-2.5 text-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2 border-t border-ink-line pt-3">
            {canEdit && (
              <button onClick={() => onEdit(r)} className="btn-ghost flex-1 px-4 py-2 text-sm">
                <IconEdit size={14} /> {t('kitchen.editRecipe')}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeleting(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                <IconTrash size={14} /> {t('common.delete')}
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default function Kitchen() {
  const { recipes, createRecipe, updateRecipe, deleteRecipe, approveRecipe, rejectRecipe, menu, inventory, user } = useApp()
  const t = useT()
  const [showModal, setShowModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)

  // Only Kitchen staff create recipes. Admin/Manager have 'view' access to this
  // dashboard (to watch recipe status) but must not see the create control —
  // Admin's job is Approve/Reject, Manager's is neither.
  const canCreate = user ? canModify(user.role, 'recipeCreate') : false
  // Editing is authoring, so it rides the same gate as create (Kitchen).
  const canEdit = canCreate
  // Admin approves/rejects pending recipes right on this page.
  const canApprove = user ? canModify(user.role, 'recipeApproval') : false
  // Delete is destructive → Admin only (stricter than authoring).
  const canDelete = user?.role === 'Admin'

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
      <PageHeader title={t('kitchen.title')} subtitle={dateLong()}>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-gold">
            <IconPlus size={18} /> {t('kitchen.createRecipe')}
          </button>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconClock} label={t('kitchen.pendingApproval')} value={counts.pending} sub={t('kitchen.awaitingAdmin')} />
        <StatCard icon={IconCheck} label={t('kitchen.approved')} value={counts.approved} sub={t('kitchen.liveForDeduction')} />
        <StatCard icon={IconMenuBook} label={t('kitchen.totalRecipes')} value={recipes.length} sub={t('kitchen.allStatuses')} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={IconKitchen}
          title={t('kitchen.noRecipes')}
          hint={
            canCreate
              ? t('kitchen.hintCreate')
              : canApprove
                ? t('kitchen.hintApprove')
                : t('kitchen.hintView')
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              canApprove={canApprove}
              canEdit={canEdit}
              canDelete={canDelete}
              onApprove={approveRecipe}
              onReject={rejectRecipe}
              onEdit={setEditingRecipe}
              onDelete={deleteRecipe}
            />
          ))}
        </div>
      )}

      {(showModal || editingRecipe) && canCreate && (
        <RecipeFormModal
          menu={menu}
          inventory={inventory}
          existingRecipes={recipes}
          editingRecipe={editingRecipe}
          onSave={async (data) => {
            if (editingRecipe) {
              await updateRecipe(editingRecipe.id, { ingredients: data.ingredients })
            } else {
              await createRecipe(data)
            }
            setShowModal(false)
            setEditingRecipe(null)
          }}
          onClose={() => {
            setShowModal(false)
            setEditingRecipe(null)
          }}
        />
      )}
    </div>
  )
}
