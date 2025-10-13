import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PublicViewer from './components/PublicViewer/PublicViewer.jsx'

createRoot(document.getElementById('public-viewer-root')).render(
  <StrictMode>
    <PublicViewer />
  </StrictMode>,
)