import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'devextreme/dist/css/dx.light.css'
import { loadMessages, locale } from 'devextreme/localization'
import esMessages from 'devextreme/localization/messages/es.json'
import './index.css'
import { AuthProvider } from './auth/AuthContext.jsx'
import App from './App.jsx'

// Textos de DevExtreme en español, con números y fechas al estilo de Perú (punto decimal).
loadMessages(esMessages)
locale('es-PE')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
