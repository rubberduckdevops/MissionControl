import { useEffect, useState } from 'react'
import ContentLayout from '@cloudscape-design/components/content-layout'
import Header from '@cloudscape-design/components/header'
import Container from '@cloudscape-design/components/container'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Input from '@cloudscape-design/components/input'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import Alert from '@cloudscape-design/components/alert'
import Layout from '../components/Layout'
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

export default function CtiPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')

  const [types, setTypes] = useState<CtiType[]>([])
  const [selectedType, setSelectedType] = useState<CtiType | null>(null)
  const [newTypeName, setNewTypeName] = useState('')
  const [typeError, setTypeError] = useState('')

  const [items, setItems] = useState<CtiItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [itemError, setItemError] = useState('')

  useEffect(() => {
    api
      .get<Category[]>('/api/cti/categories')
      .then((r) => setCategories(r.data))
      .catch(() => setCategoryError('Failed to load categories'))
  }, [])

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

  return (
    <Layout>
      <ContentLayout header={<Header variant="h1">CTI Management</Header>}>
        <Box variant="p" color="text-body-secondary">
          Category → Type → Item hierarchy. Click a row to drill down.
        </Box>
        <ColumnLayout columns={3} variant="default">
          {/* Categories */}
          <Container header={<Header variant="h2">Categories</Header>}>
            <SpaceBetween size="s">
              {categoryError && <Alert type="error">{categoryError}</Alert>}
              {categories.length === 0 && (
                <Box color="text-body-secondary">No categories yet.</Box>
              )}
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: `1px solid ${selectedCategory?._id === cat._id ? 'var(--color-border-item-selected)' : 'var(--color-border-divider-default)'}`,
                    background: selectedCategory?._id === cat._id ? 'var(--color-background-item-selected)' : 'transparent',
                  }}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setSelectedType(null)
                  }}
                >
                  <Box
                    fontWeight={selectedCategory?._id === cat._id ? 'bold' : 'normal'}
                  >
                    {cat.name}
                  </Box>
                  <Button
                    variant="inline-link"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat._id) }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              <form onSubmit={handleCreateCategory}>
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    value={newCategoryName}
                    onChange={({ detail }) => setNewCategoryName(detail.value)}
                    placeholder="Category name…"
                  />
                  <Button variant="primary" formAction="submit" disabled={!newCategoryName.trim()}>
                    Add
                  </Button>
                </SpaceBetween>
              </form>
            </SpaceBetween>
          </Container>

          {/* Types */}
          <div style={{ opacity: selectedCategory ? 1 : 0.5 }}>
            <Container
              header={
                <Header variant="h2">
                  {selectedCategory ? `Types — ${selectedCategory.name}` : 'Types'}
                </Header>
              }
            >
              <SpaceBetween size="s">
                {typeError && <Alert type="error">{typeError}</Alert>}
                {!selectedCategory && (
                  <Box color="text-body-secondary">Select a category first.</Box>
                )}
                {selectedCategory && types.length === 0 && (
                  <Box color="text-body-secondary">No types yet.</Box>
                )}
                {types.map((t) => (
                  <div
                    key={t._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: `1px solid ${selectedType?._id === t._id ? 'var(--color-border-item-selected)' : 'var(--color-border-divider-default)'}`,
                      background: selectedType?._id === t._id ? 'var(--color-background-item-selected)' : 'transparent',
                    }}
                    onClick={() => setSelectedType(t)}
                  >
                    <Box fontWeight={selectedType?._id === t._id ? 'bold' : 'normal'}>
                      {t.name}
                    </Box>
                    <Button
                      variant="inline-link"
                      onClick={(e) => { e.stopPropagation(); handleDeleteType(t._id) }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                <form onSubmit={handleCreateType}>
                  <SpaceBetween size="xs" direction="horizontal">
                    <Input
                      value={newTypeName}
                      onChange={({ detail }) => setNewTypeName(detail.value)}
                      placeholder="Type name…"
                      disabled={!selectedCategory}
                    />
                    <Button
                      variant="primary"
                      formAction="submit"
                      disabled={!selectedCategory || !newTypeName.trim()}
                    >
                      Add
                    </Button>
                  </SpaceBetween>
                </form>
              </SpaceBetween>
            </Container>
          </div>

          {/* Items */}
          <div style={{ opacity: selectedType ? 1 : 0.5 }}>
            <Container
              header={
                <Header variant="h2">
                  {selectedType ? `Items — ${selectedType.name}` : 'Items'}
                </Header>
              }
            >
              <SpaceBetween size="s">
                {itemError && <Alert type="error">{itemError}</Alert>}
                {!selectedType && (
                  <Box color="text-body-secondary">Select a type first.</Box>
                )}
                {selectedType && items.length === 0 && (
                  <Box color="text-body-secondary">No items yet.</Box>
                )}
                {items.map((item) => (
                  <div
                    key={item._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-divider-default)',
                    }}
                  >
                    <Box>{item.name}</Box>
                    <Button
                      variant="inline-link"
                      onClick={() => handleDeleteItem(item._id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                <form onSubmit={handleCreateItem}>
                  <SpaceBetween size="xs" direction="horizontal">
                    <Input
                      value={newItemName}
                      onChange={({ detail }) => setNewItemName(detail.value)}
                      placeholder="Item name…"
                      disabled={!selectedType}
                    />
                    <Button
                      variant="primary"
                      formAction="submit"
                      disabled={!selectedType || !newItemName.trim()}
                    >
                      Add
                    </Button>
                  </SpaceBetween>
                </form>
              </SpaceBetween>
            </Container>
          </div>
        </ColumnLayout>
      </ContentLayout>
    </Layout>
  )
}
