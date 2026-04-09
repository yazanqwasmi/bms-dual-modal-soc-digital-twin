import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

const rootElement = document.getElementById('root')

function renderFatal(message) {
  if (!rootElement) return
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#e0e0e0;padding:24px;font-family:Inter,system-ui,sans-serif;">
      <div style="max-width:720px;width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,71,87,0.35);border-radius:16px;padding:24px;">
        <h2 style="margin:0 0 12px 0;color:#ff6b6b;">Dashboard failed to initialize</h2>
        <p style="margin:0 0 8px 0;color:rgba(255,255,255,0.8);">${message}</p>
        <p style="margin:0;color:rgba(255,255,255,0.6);font-size:13px;">Try a hard refresh. If the issue persists, open browser devtools and check console errors.</p>
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  if (event?.error) {
    renderFatal(event.error.message || 'Unknown runtime error')
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  const message = typeof reason === 'string' ? reason : (reason?.message || 'Unhandled promise rejection')
  renderFatal(message)
})

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (error) {
  renderFatal(error?.message || 'Bootstrap error')
}
