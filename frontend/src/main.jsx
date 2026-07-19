import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { discoverAndSetBase } from './api/client.js'
import './index.css'

function render() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

// Must resolve (found or not) before the app's first fetch — AppContext's
// session-restore effect calls the API on mount, so the LAN server's real
// address (if discovered) has to be set before React ever renders.
discoverAndSetBase().finally(render)
