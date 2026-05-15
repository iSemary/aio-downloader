import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PrivateRoute } from '@/components/PrivateRoute'
import AnalyzePage from '@/pages/Analyze'
import BulkAddPage from '@/pages/BulkAdd'
import DashboardPage from '@/pages/Dashboard'
import DownloadsPage from '@/pages/Downloads'
import GdriveCallbackPage from '@/pages/GdriveCallback'
import GrabberPage from '@/pages/Grabber'
import HistoryPage from '@/pages/History'
import JobDetailPage from '@/pages/JobDetail'
import LoginPage from '@/pages/Login'
import PlaylistsPage from '@/pages/Playlists'
import QueuePage from '@/pages/Queue'
import RegisterPage from '@/pages/Register'
import SettingsPage from '@/pages/Settings'
import SitesManagerPage from '@/pages/SitesManager'
import StoragePage from '@/pages/Storage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/bulk-add" element={<BulkAddPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/grabber" element={<GrabberPage />} />
          <Route path="/sites" element={<SitesManagerPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
