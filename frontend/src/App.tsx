import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { AppHeader } from './components/AppHeader'
import { DashboardHome } from './components/DashboardHome'
import { NormalizationLab } from './components/NormalizationLab'
import { DataQuestView } from './components/DataQuestView'
import { AcademyView } from './components/AcademyView'
import { GamesView } from './components/GamesView'
import { LeaderboardView } from './components/LeaderboardView'
import { GlossaryPanel } from './components/GlossaryPanel'
import { ProjectsView } from './components/ProjectsView'
import { NormalizerEngineView } from './components/NormalizerEngineView'
import { ReportsView } from './components/ReportsView'
import { HistoryView } from './components/HistoryView'
import { SettingsView } from './components/SettingsView'
import { SandboxView } from './components/SandboxView'

import { Landing } from './components/Landing'
import { RegisterPromptModal } from './components/RegisterPromptModal'
import { AuthModal } from './components/AuthModal'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ToastProvider } from './components/Toast'
import { SkipLink } from './components/SkipLink'
import { SrAnnouncer } from './components/SrAnnouncer'
import { useAuthStore } from './store/authStore'
import type { ViewType } from './types'
import axiosInstance from './services/api'
import { fetchUserInsights } from './services/insights'
import './index.css'

const VIEW_TOKENS: ViewType[] = [
  'dashboard',
  'projects',
  'normalization',
  'validator',
  'academy',
  'dataquest',
  'games',
  'leaderboard',
  'glossary',
  'reports',
  'history',
  'settings',
  'sandbox',
]

function readInitialView(): ViewType {
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  const hash = window.location.hash.replace(/^#/, '').trim()
  const query = new URLSearchParams(window.location.search).get('view')?.trim() ?? ''
  const token = (hash || query || '').toLowerCase()

  if (VIEW_TOKENS.includes(token as ViewType)) {
    return token as ViewType
  }

  try {
    const lastView = localStorage.getItem('dataquest:last_view') as ViewType | null
    if (lastView && VIEW_TOKENS.includes(lastView)) {
      return lastView
    }
  } catch {
    // ignore storage errors
  }

  return 'dashboard'
}

function App() {
  const { isAuthenticated, isGuest, user, restoreGuestUser, setUser, logout } = useAuthStore()
  const [currentView, setCurrentView] = useState<ViewType>(() => readInitialView())
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [blockedFeature, setBlockedFeature] = useState<'quests' | 'ranking' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bootstrapping, setBootstrapping] = useState(true)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const guest = localStorage.getItem('guest_user')

    const hydrate = async () => {
      try {
        if (guest) {
          restoreGuestUser()
        }

        if (token) {
          const response = await axiosInstance.get('/auth/me')
          if (response.data?.user) {
            setUser(response.data.user, token)
            const insights = await fetchUserInsights(response.data.user.id)
            setNotificationCount(insights.recommendations.length)
            try {
              const lastView = localStorage.getItem('dataquest:last_view') as ViewType | null
              if (lastView) {
                setCurrentView(lastView)
              }
            } catch {
              // ignore storage errors
            }
          }
        } else {
          setNotificationCount(0)
        }
      } catch {
        logout()
      } finally {
        setBootstrapping(false)
      }
    }

    void hydrate()
  }, [logout, restoreGuestUser, setUser])

  useEffect(() => {
    try {
      localStorage.setItem('dataquest:last_view', currentView)
    } catch {
      // ignore storage errors
    }

    if (typeof window !== 'undefined') {
      const nextHash = `#${currentView}`
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
      }
    }
  }, [currentView])

  // Redirect to dashboard if user tries to access protected feature as guest
  useEffect(() => {
    if (isGuest && (currentView === 'dataquest' || currentView === 'leaderboard')) {
      setBlockedFeature(currentView === 'dataquest' ? 'quests' : 'ranking')
      setShowRegisterPrompt(true)
      setCurrentView('dashboard')
    }
  }, [currentView, isGuest])

  useEffect(() => {
    if (!user || !isAuthenticated) {
      setNotificationCount(0)
      return
    }

    let mounted = true
    const loadNotifications = async () => {
      try {
        const insights = await fetchUserInsights(user.id)
        if (mounted) {
          setNotificationCount(insights.recommendations.length)
        }
      } catch {
        if (mounted) setNotificationCount(0)
      }
    }

    void loadNotifications()

    return () => {
      mounted = false
    }
  }, [isAuthenticated, user?.id])

  // Show landing if not authenticated and not guest
  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <LoadingSpinner text="Restaurando sesión..." />
      </div>
    )
  }

  if (!isAuthenticated && !isGuest) {
    return <Landing />
  }

  const renderView = () => {
    // Prevent guests from accessing protected views
    if (isGuest && (currentView === 'dataquest' || currentView === 'leaderboard')) {
      return <DashboardHome onNavigate={setCurrentView} searchQuery={searchQuery} />
    }

    switch (currentView) {
      case 'dashboard':     return <DashboardHome onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'projects':      return <ProjectsView onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'normalization': return <NormalizerEngineView onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'validator':     return <NormalizationLab onNavigate={setCurrentView} />
      case 'academy':       return <AcademyView />
      case 'dataquest':     return <DataQuestView onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'games':         return <GamesView onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'leaderboard':   return <LeaderboardView />
      case 'glossary':      return <GlossaryPanel onNavigate={setCurrentView} />
      case 'reports':       return <ReportsView onNavigate={setCurrentView} />
      case 'history':       return <HistoryView onNavigate={setCurrentView} searchQuery={searchQuery} />
      case 'settings':      return <SettingsView onNavigate={setCurrentView} />
      case 'sandbox':       return <SandboxView onNavigate={setCurrentView} />
      default:              return <DashboardHome onNavigate={setCurrentView} searchQuery={searchQuery} />
    }
  }

  return (
    <>
      <SkipLink />
      <SrAnnouncer />
      <ToastProvider />

      <div className="flex min-h-screen bg-slate-100">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          onOpenAuthModal={() => setShowAuthModal(true)}
        />
        <main id="main-content" className="main-content flex-1" tabIndex={-1}>
          <AppHeader
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchSubmit={() => {
              if (currentView !== 'projects') {
                setCurrentView('projects')
              }
            }}
            notificationCount={notificationCount}
            onOpenHelp={() => setCurrentView('glossary')}
            onOpenNotifications={() => setCurrentView('reports')}
            onOpenProfile={() => setCurrentView('settings')}
          />
          <div className="animate-fade-in" key={currentView}>
            {renderView()}
          </div>
        </main>
      </div>

      {/* Register Prompt Modal */}
      <RegisterPromptModal
        isOpen={showRegisterPrompt}
        feature={blockedFeature || 'quests'}
        onClose={() => setShowRegisterPrompt(false)}
        onRegister={() => {
          setShowRegisterPrompt(false)
          setShowAuthModal(true)
        }}
      />

      {/* Auth Modal (Login / Register) */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  )
}

export default App
