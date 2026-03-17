import { useEffect, useState } from 'react'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import Modal from '@cloudscape-design/components/modal'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Form from '@cloudscape-design/components/form'
import Spinner from '@cloudscape-design/components/spinner'
import Link from '@cloudscape-design/components/link'
import Layout from '../components/Layout'
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

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

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newUrl.trim()) {
      setAddError('Name and URL are required')
      return
    }
    setAdding(true)
    try {
      const res = await api.post<Feed>('/api/feeds', { name: newName.trim(), url: newUrl.trim() })
      setFeeds((f) => [...f, res.data])
      setNewName('')
      setNewUrl('')
      setShowAddModal(false)
      setAddError('')
    } catch {
      setAddError('Failed to add feed')
    } finally {
      setAdding(false)
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
    <Layout>
      <ContentLayout
        header={
          <Header
            variant="h1"
            actions={
              <Button variant="primary" onClick={() => { setShowAddModal(true); setAddError('') }}>
                + Add Feed
              </Button>
            }
          >
            Intelligence Feeds
          </Header>
        }
      >
        <ColumnLayout columns={2}>
          {/* Left panel: feed list */}
          <Container header={<Header variant="h2">My Feeds</Header>}>
            <SpaceBetween size="xs">
              {feeds.length === 0 && (
                <Box color="text-body-secondary">No feeds — add one above.</Box>
              )}
              {feeds.map((feed) => (
                <div
                  key={feed._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: `1px solid ${selectedFeed?._id === feed._id ? 'var(--color-border-item-selected)' : 'var(--color-border-divider-default)'}`,
                    background: selectedFeed?._id === feed._id ? 'var(--color-background-item-selected)' : 'transparent',
                  }}
                  onClick={() => loadItems(feed)}
                >
                  <Box fontWeight={selectedFeed?._id === feed._id ? 'bold' : 'normal'}>
                    {feed.name}
                  </Box>
                  <Button
                    variant="inline-link"
                    onClick={(e) => { e.stopPropagation(); handleDelete(feed._id) }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </SpaceBetween>
          </Container>

          {/* Right panel: articles */}
          <Container header={<Header variant="h2">{selectedFeed ? selectedFeed.name : 'Articles'}</Header>}>
            {!selectedFeed && (
              <Box color="text-body-secondary">Select a feed to view articles.</Box>
            )}
            {itemsLoading && <Spinner />}
            {itemsError && <Alert type="error">{itemsError}</Alert>}
            {!itemsLoading && !itemsError && selectedFeed && items.length === 0 && (
              <Box color="text-body-secondary">No articles found.</Box>
            )}
            <SpaceBetween size="s">
              {items.map((item, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--color-border-divider-default)', paddingBottom: '0.75rem' }}>
                  <SpaceBetween size="xxs">
                    <Link href={item.link} external>
                      {item.title || '(no title)'}
                    </Link>
                    <SpaceBetween size="xs" direction="horizontal">
                      <Box variant="small" color="text-body-secondary">{selectedFeed?.name}</Box>
                      {item.published && (
                        <Box variant="small" color="text-body-secondary">{relativeTime(item.published)}</Box>
                      )}
                    </SpaceBetween>
                  </SpaceBetween>
                </div>
              ))}
            </SpaceBetween>
          </Container>
        </ColumnLayout>
      </ContentLayout>

      {/* Add feed modal */}
      <Modal
        visible={showAddModal}
        onDismiss={() => { setShowAddModal(false); setAddError('') }}
        header="Add Intelligence Feed"
        footer={
          <Box float="right">
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="normal" onClick={() => { setShowAddModal(false); setAddError('') }}>
                Cancel
              </Button>
              <Button variant="primary" loading={adding} loadingText="Adding..." onClick={handleAddFeed as any}>
                Save Feed
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <form onSubmit={handleAddFeed}>
          <Form>
            <SpaceBetween size="m">
              {addError && <Alert type="error">{addError}</Alert>}
              <FormField label="Name">
                <Input
                  value={newName}
                  onChange={({ detail }) => setNewName(detail.value)}
                  placeholder="Krebs on Security"
                />
              </FormField>
              <FormField label="Feed URL">
                <Input
                  value={newUrl}
                  onChange={({ detail }) => setNewUrl(detail.value)}
                  placeholder="https://example.com/feed.xml"
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </Modal>
    </Layout>
  )
}
