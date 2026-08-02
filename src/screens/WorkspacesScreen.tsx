import { Building2, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '../components/AdminTopbar'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { WorkspaceInfo } from '../lib/store'

export default function WorkspacesScreen() {
  const { workspaces, activeWorkspaceId, switchWorkspace, refreshWorkspaces } = useStore()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void refreshWorkspaces()
  }, [refreshWorkspaces])

  useEffect(() => {
    if (creating) nameRef.current?.focus()
  }, [creating])

  const list = workspaces.filter(
    (w) => search === '' || (w.businessName || w.name).includes(search),
  )

  async function create() {
    const name = newName.trim()
    if (!name) return
    const ws = (await api.createWorkspace({ name, businessName: name })) as WorkspaceInfo
    await refreshWorkspaces()
    switchWorkspace(ws.id)
    setNewName('')
    setCreating(false)
  }

  async function saveEdit(id: string) {
    const name = editName.trim()
    if (!name) return
    await api.updateWorkspaceById(id, { name, businessName: name })
    await refreshWorkspaces()
    setEditId(null)
  }

  async function remove(id: string) {
    if (workspaces.length <= 1) {
      window.alert('לא ניתן למחוק את העסק האחרון')
      return
    }
    if (!window.confirm('למחוק את העסק? הטפסים והתבניות שלו יוסרו.')) return
    try {
      await api.deleteWorkspace(id)
      await refreshWorkspaces()
    } catch {
      window.alert('מחיקה נכשלה')
    }
  }

  return (
    <div className="admin-shell">
      <AdminTopbar search={search} onSearch={setSearch} searchPlaceholder="חיפוש עסק…" />
      <main className="page-body">
        <div className="home-title-row">
          <h1>העסקים שלי</h1>
          <span className="count-chip">{workspaces.length} עסקים</span>
          <div className="title-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> עסק חדש
            </button>
          </div>
        </div>

        {creating && (
          <div className="ws-create card">
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="שם העסק"
            />
            <button type="button" className="btn btn-primary" onClick={create}>
              יצירה
            </button>
            <button type="button" className="btn" onClick={() => setCreating(false)}>
              ביטול
            </button>
          </div>
        )}

        <div className="ws-grid">
          {list.map((w) => (
            <div key={w.id} className={w.id === activeWorkspaceId ? 'ws-card active' : 'ws-card'}>
              <div className="ws-head">
                <span className="icon-tile">
                  <Building2 size={18} />
                </span>
                {editId === w.id ? (
                  <input
                    className="ws-edit-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(w.id)}
                  />
                ) : (
                  <div className="ws-name">{w.businessName || w.name}</div>
                )}
              </div>
              <div className="ws-meta muted">{w.ownerEmail}</div>
              <div className="ws-foot">
                {w.id === activeWorkspaceId ? (
                  <span className="ws-badge">
                    <Check size={14} /> פעיל
                  </span>
                ) : (
                  <button type="button" className="btn" onClick={() => switchWorkspace(w.id)}>
                    מעבר לעסק
                  </button>
                )}
                <div className="ws-actions">
                  {editId === w.id ? (
                    <button type="button" className="icon-btn" title="שמירה" onClick={() => saveEdit(w.id)}>
                      <Check size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      title="שינוי שם"
                      onClick={() => {
                        setEditId(w.id)
                        setEditName(w.businessName || w.name)
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button type="button" className="icon-btn danger" title="מחיקה" onClick={() => remove(w.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
