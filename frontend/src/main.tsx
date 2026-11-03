import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppTooltip } from './components/ui/AppTooltip'
import './index.css'
import { applyTheme, getCurrentTheme } from './lib/themes'

// Apply the saved colour theme before React paints, so there is no flash.
applyTheme(getCurrentTheme())
document.documentElement.classList.add('theme-transition')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AppTooltip />
  </React.StrictMode>
)
