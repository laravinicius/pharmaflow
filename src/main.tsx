import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CLIENT, COLORS } from '../config/branding'

document.documentElement.dataset.client = CLIENT.id;
document.documentElement.dataset.visual = CLIENT.visual.style;
for (const [key, value] of Object.entries(COLORS)) {
  const cssName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  document.documentElement.style.setProperty(`--pf-${cssName}`, value);
}
for (const [key, value] of Object.entries(CLIENT.visual)) {
  const cssName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  document.documentElement.style.setProperty(`--pf-${cssName}`, value);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
