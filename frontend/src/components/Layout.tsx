import { ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppLayout from '@cloudscape-design/components/app-layout'
import TopNavigation from '@cloudscape-design/components/top-navigation'
import SideNavigation from '@cloudscape-design/components/side-navigation'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const { user, logout } = useAuth()
  const { mode, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [navigationOpen, setNavigationOpen] = useState(true)

  const activeHref = location.pathname

  const navItems: { type: 'link'; text: string; href: string }[] = [
    { type: 'link', text: 'Dashboard', href: '/dashboard' },
    { type: 'link', text: 'Tasks', href: '/tasks' },
    { type: 'link', text: 'CTI', href: '/cti' },
    { type: 'link', text: 'Feeds', href: '/feeds' },
    { type: 'link', text: 'Weather', href: '/weather' },
    { type: 'link', text: 'CA', href: '/ca' },
    { type: 'link', text: 'Countdown', href: '/countdown' },
  ]

  if (user?.role === 'admin') {
    navItems.push({ type: 'link', text: 'Admin', href: '/admin' })
  }

  return (
    <>
      <div id="top-navigation">
        <TopNavigation
          identity={{ href: '/dashboard', title: 'MissionControl' }}
          utilities={[
            {
              type: 'button',
              text: mode === 'dark' ? 'Light mode' : 'Dark mode',
              onClick: toggle,
            },
            {
              type: 'menu-dropdown',
              text: user?.username ?? 'Operator',
              description: user?.email ?? '',
              items: [
                { id: 'signout', text: 'Sign out' },
              ],
              onItemClick: (e) => {
                if (e.detail.id === 'signout') {
                  logout()
                  navigate('/login')
                }
              },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-navigation"
        toolsHide
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={activeHref}
            header={{ text: 'MissionControl', href: '/dashboard' }}
            items={navItems}
            onFollow={(e) => {
              e.preventDefault()
              navigate(e.detail.href)
            }}
          />
        }
        content={children}
      />
    </>
  )
}
