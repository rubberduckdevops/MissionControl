import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

interface Category {
  _id: string
  name: string
}

interface CtiType {
  _id: string
  name: string
  category_id: string
}

interface CtiItem {
  _id: string
  name: string
  type_id: string
}

function PanelHeader({ title, accent = '#00d4ff' }: { title: string; accent?: string }) {
  return (
    <div
      style={{
        padding: '0.5rem 1.25rem',
        borderBottom: '1px solid #1e4470',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <span
        style={{
          color: accent,
          fontSize: '0.68rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
        }}
      >
        {title}
      </span>
    </div>
  )
}

function InlineError({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div
      style={{
        borderLeft: '3px solid #ff3a3a',
        background: 'rgba(255,58,58,0.07)',
        padding: '0.35rem 0.75rem',
        marginBottom: '0.6rem',
        color: '#ff3a3a',
        fontSize: '0.75rem',
      }}
    >
      {msg}
    </div>
  )
}

export default function CtiPage() {
  // ── Categories ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')

  // ── Types ───────────────────────────────────────────────────────────────────
  const [types, setTypes] = useState<CtiType[]>([])
  const [selectedType, setSelectedType] = useState<CtiType | null>(null)
  const [newTypeName, setNewTypeName] = useState('')
  const [typeError, setTypeError] = useState('')

  // ── Items ───────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CtiItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [itemError, setItemError] = useState('')

  // Load categories on mount
  useEffect(() => {
    api
      .get<Category[]>('/api/cti/categories')
      .then((r) => setCategories(r.data))
      .catch(() => setCategoryError('Failed to load categories'))
  }, [])

  // Load types when a category is selected
  useEffect(() => {
    if (!selectedCategory) {
      setTypes([])
      setSelectedType(null)
      return
    }
    setTypeError('')
    api
      .get<CtiType[]>(`/api/cti/types?category_id=${selectedCategory._id}`)
      .then((r) => setTypes(r.data))
      .catch(() => setTypeError('Failed to load types'))
  }, [selectedCategory])

  // Load items when a type is selected
  useEffect(() => {
    if (!selectedType) {
      setItems([])
      return
    }
    setItemError('')
    api
      .get<CtiItem[]>(`/api/cti/items?type_id=${selectedType._id}`)
      .then((r) => setItems(r.data))
      .catch(() => setItemError('Failed to load items'))
  }, [selectedType])

  // ── Category handlers ────────────────────────────────────────────────────────
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setCategoryError('')
    try {
      const r = await api.post<Category>('/api/cti/categories', { name: newCategoryName })
      setCategories((prev) => [...prev, r.data])
      setNewCategoryName('')
    } catch {
      setCategoryError('Failed to create category')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    setCategoryError('')
    try {
      await api.delete(`/api/cti/categories/${id}`)
      setCategories((prev) => prev.filter((c) => c._id !== id))
      if (selectedCategory?._id === id) setSelectedCategory(null)
    } catch {
      setCategoryError('Failed to delete category')
    }
  }

  // ── Type handlers ────────────────────────────────────────────────────────────
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory) return
    setTypeError('')
    try {
      const r = await api.post<CtiType>('/api/cti/types', {
        name: newTypeName,
        category_id: selectedCategory._id,
      })
      setTypes((prev) => [...prev, r.data])
      setNewTypeName('')
    } catch {
      setTypeError('Failed to create type')
    }
  }

  const handleDeleteType = async (id: string) => {
    setTypeError('')
    try {
      await api.delete(`/api/cti/types/${id}`)
      setTypes((prev) => prev.filter((t) => t._id !== id))
      if (selectedType?._id === id) setSelectedType(null)
    } catch {
      setTypeError('Failed to delete type')
    }
  }

  // ── Item handlers ────────────────────────────────────────────────────────────
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType) return
    setItemError('')
    try {
      const r = await api.post<CtiItem>('/api/cti/items', {
        name: newItemName,
        type_id: selectedType._id,
      })
      setItems((prev) => [...prev, r.data])
      setNewItemName('')
    } catch {
      setItemError('Failed to create item')
    }
  }

  const handleDeleteItem = async (id: string) => {
    setItemError('')
    try {
      await api.delete(`/api/cti/items/${id}`)
      setItems((prev) => prev.filter((i) => i._id !== id))
    } catch {
      setItemError('Failed to delete item')
    }
  }

  // ── Shared row style ─────────────────────────────────────────────────────────
  const rowStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.75rem',
    marginBottom: '0.3rem',
    background: selected ? 'rgba(0,212,255,0.08)' : '#0e1828',
    border: `1px solid ${selected ? '#00d4ff' : '#1e4470'}`,
    borderRadius: 3,
    cursor: 'pointer',
  })

  const nameStyle = (selected: boolean): React.CSSProperties => ({
    flex: 1,
    fontSize: '0.85rem',
    color: selected ? '#00d4ff' : '#c8ddf0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  const panelStyle: React.CSSProperties = {
    background: '#132035',
    border: '1px solid #1e4470',
    borderRadius: 4,
    overflow: 'hidden',
    flex: '1 1 260px',
    minWidth: 220,
  }

  const addForm = (
    value: string,
    setter: (v: string) => void,
    onSubmit: (e: React.FormEvent) => void,
    placeholder: string,
    disabled: boolean,
  ) => (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
      <input
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        required
        disabled={disabled}
        style={{ flex: 1, marginBottom: 0 }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{ whiteSpace: 'nowrap', padding: '0.5rem 0.875rem', fontSize: '0.75rem' }}
      >
        Add
      </button>
    </form>
  )

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
        {/* Heading */}
        <div style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '0.8rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#00d4ff',
            }}
          >
            CTI Management
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            Category → Type → Item hierarchy. Click a row to drill down.
          </p>
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)',
              marginTop: '0.5rem',
            }}
          />
        </div>

        {/* Three panels */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Categories ── */}
          <div style={panelStyle}>
            <PanelHeader title="Categories" accent="#00d4ff" />
            <div style={{ padding: '1rem' }}>
              <InlineError msg={categoryError} />
              {categories.length === 0 && (
                <p style={{ color: '#52809e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>No categories yet.</p>
              )}
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  style={rowStyle(selectedCategory?._id === cat._id)}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setSelectedType(null)
                  }}
                >
                  <span style={nameStyle(selectedCategory?._id === cat._id)}>{cat.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat._id) }}
                    style={{
                      color: '#ff3a3a',
                      borderColor: 'transparent',
                      background: 'none',
                      padding: '0.1rem 0.35rem',
                      fontSize: '0.65rem',
                    }}
                  >
                    DEL
                  </button>
                </div>
              ))}
              {addForm(newCategoryName, setNewCategoryName, handleCreateCategory, 'Category name…', false)}
            </div>
          </div>

          {/* ── Types ── */}
          <div style={{ ...panelStyle, opacity: selectedCategory ? 1 : 0.45 }}>
            <PanelHeader
              title={selectedCategory ? `Types — ${selectedCategory.name}` : 'Types'}
              accent="#f59e0b"
            />
            <div style={{ padding: '1rem' }}>
              <InlineError msg={typeError} />
              {!selectedCategory && (
                <p style={{ color: '#52809e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                  Select a category first.
                </p>
              )}
              {selectedCategory && types.length === 0 && (
                <p style={{ color: '#52809e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>No types yet.</p>
              )}
              {types.map((t) => (
                <div
                  key={t._id}
                  style={rowStyle(selectedType?._id === t._id)}
                  onClick={() => setSelectedType(t)}
                >
                  <span style={nameStyle(selectedType?._id === t._id)}>{t.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteType(t._id) }}
                    style={{
                      color: '#ff3a3a',
                      borderColor: 'transparent',
                      background: 'none',
                      padding: '0.1rem 0.35rem',
                      fontSize: '0.65rem',
                    }}
                  >
                    DEL
                  </button>
                </div>
              ))}
              {addForm(newTypeName, setNewTypeName, handleCreateType, 'Type name…', !selectedCategory)}
            </div>
          </div>

          {/* ── Items ── */}
          <div style={{ ...panelStyle, opacity: selectedType ? 1 : 0.45 }}>
            <PanelHeader
              title={selectedType ? `Items — ${selectedType.name}` : 'Items'}
              accent="#00ff9f"
            />
            <div style={{ padding: '1rem' }}>
              <InlineError msg={itemError} />
              {!selectedType && (
                <p style={{ color: '#52809e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                  Select a type first.
                </p>
              )}
              {selectedType && items.length === 0 && (
                <p style={{ color: '#52809e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>No items yet.</p>
              )}
              {items.map((item) => (
                <div key={item._id} style={rowStyle(false)}>
                  <span style={nameStyle(false)}>{item.name}</span>
                  <button
                    onClick={() => handleDeleteItem(item._id)}
                    style={{
                      color: '#ff3a3a',
                      borderColor: 'transparent',
                      background: 'none',
                      padding: '0.1rem 0.35rem',
                      fontSize: '0.65rem',
                    }}
                  >
                    DEL
                  </button>
                </div>
              ))}
              {addForm(newItemName, setNewItemName, handleCreateItem, 'Item name…', !selectedType)}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
