import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../services/api'

interface Feed {
  _id: string
  name: string
  url: string
  created_at: string
}

interface FeedItem {
  title: string
  link: string
  summary: string
  published: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null)
  const [items, setItems] = useState<FeedItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addError, setAddError] = useState('')

  useEffect(() => {
    api.get<Feed[]>('/api/feeds').then((res) => setFeeds(res.data)).catch(() => {})
  }, [])

  const loadItems = (feed: Feed) => {
    setSelectedFeed(feed)
    setItems([])
    setItemsError('')
    setItemsLoading(true)
    api
      .get<{ items: FeedItem[] }>(`/api/feeds/${feed._id}/items`)
      .then((res) => setItems(res.data.items))
      .catch(() => setItemsError('FEED UNAVAILABLE — could not retrieve articles'))
      .finally(() => setItemsLoading(false))
  }

  const handleAddFeed = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      setAddError('Name and URL are required')
      return
    }
    try {
      const res = await api.post<Feed>('/api/feeds', { name: newName.trim(), url: newUrl.trim() })
      setFeeds((f) => [...f, res.data])
      setNewName('')
      setNewUrl('')
      setShowAddForm(false)
      setAddError('')
    } catch {
      setAddError('Failed to add feed')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/feeds/${id}`)
      setFeeds((f) => f.filter((feed) => feed._id !== id))
      if (selectedFeed?._id === id) {
        setSelectedFeed(null)
        setItems([])
      }
    } catch {}
  }

  return (
    <>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4ff' }}>
              Intelligence Feeds
            </h1>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, #00d4ff 0%, #1e4470 60%, transparent 100%)', marginTop: '0.5rem' }} />
          </div>
          <button
            onClick={() => { setShowAddForm((v) => !v); setAddError('') }}
            style={{ fontSize: '0.72rem', letterSpacing: '0.1em', padding: '0.3rem 0.8rem', color: '#00d4ff', borderColor: '#00d4ff' }}
          >
            {showAddForm ? 'CANCEL' : '+ ADD'}
          </button>
        </div>

        {showAddForm && (
          <div
            style={{
              background: '#132035',
              border: '1px solid #1e4470',
              borderLeft: '3px solid #00d4ff',
              borderRadius: 4,
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#4a7aa7', textTransform: 'uppercase' }}>Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Krebs on Security"
                style={{ background: '#0d1b2e', border: '1px solid #1e4470', color: '#c8d8e8', padding: '0.35rem 0.5rem', fontSize: '0.82rem', borderRadius: 3 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '2 1 280px' }}>
              <label style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#4a7aa7', textTransform: 'uppercase' }}>Feed URL</label>
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                style={{ background: '#0d1b2e', border: '1px solid #1e4470', color: '#c8d8e8', padding: '0.35rem 0.5rem', fontSize: '0.82rem', borderRadius: 3 }}
              />
            </div>
            <button
              onClick={handleAddFeed}
              style={{ fontSize: '0.72rem', letterSpacing: '0.1em', padding: '0.38rem 1rem', color: '#22c55e', borderColor: '#22c55e' }}
            >
              SAVE
            </button>
            {addError && <span style={{ color: '#ff3a3a', fontSize: '0.75rem', alignSelf: 'center' }}>{addError}</span>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
          {/* Left panel: feed list */}
          <div
            style={{
              background: '#132035',
              border: '1px solid #1e4470',
              borderLeft: '3px solid #00d4ff',
              borderRadius: 4,
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#4a7aa7', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              My Feeds
            </div>
            {feeds.length === 0 ? (
              <p style={{ color: '#52809e', fontSize: '0.72rem', letterSpacing: '0.05em', margin: 0 }}>NO FEEDS — add one above</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {feeds.map((feed) => (
                  <div
                    key={feed._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.5rem',
                      borderRadius: 3,
                      cursor: 'pointer',
                      background: selectedFeed?._id === feed._id ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                      border: selectedFeed?._id === feed._id ? '1px solid rgba(0, 212, 255, 0.2)' : '1px solid transparent',
                    }}
                    onClick={() => loadItems(feed)}
                  >
                    <span
                      style={{
                        color: selectedFeed?._id === feed._id ? '#00d4ff' : '#c8d8e8',
                        fontSize: '0.8rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {feed.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(feed._id) }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#52809e',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '0 0.2rem',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      title="Remove feed"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: articles */}
          <div
            style={{
              background: '#132035',
              border: '1px solid #1e4470',
              borderLeft: '3px solid #00d4ff',
              borderRadius: 4,
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#4a7aa7', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              {selectedFeed ? selectedFeed.name : 'Articles'}
            </div>
            {!selectedFeed && (
              <p style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.08em', margin: 0 }}>
                SELECT A FEED to view articles
              </p>
            )}
            {itemsLoading && (
              <p style={{ color: '#00d4ff', fontSize: '0.8rem', letterSpacing: '0.1em', margin: 0 }}>LOADING…</p>
            )}
            {itemsError && (
              <div
                style={{
                  borderLeft: '3px solid #ff3a3a',
                  background: 'rgba(255, 58, 58, 0.07)',
                  padding: '0.5rem 0.75rem',
                  color: '#ff3a3a',
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em',
                }}
              >
                {itemsError}
              </div>
            )}
            {!itemsLoading && !itemsError && selectedFeed && items.length === 0 && (
              <p style={{ color: '#52809e', fontSize: '0.75rem', letterSpacing: '0.08em', margin: 0 }}>NO ARTICLES FOUND</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{ padding: '0.75rem 0', borderBottom: '1px solid #1a2f4a' }}
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#c8d8e8', fontSize: '0.85rem', textDecoration: 'none', display: 'block', marginBottom: '0.25rem' }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#00d4ff')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#c8d8e8')}
                  >
                    {item.title || '(no title)'}
                  </a>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: '#4a7aa7', fontSize: '0.68rem', letterSpacing: '0.06em' }}>
                      {selectedFeed?.name}
                    </span>
                    {item.published && (
                      <span style={{ color: '#52809e', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                        {relativeTime(item.published)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
