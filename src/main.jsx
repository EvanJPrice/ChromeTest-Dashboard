import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// --- THIS IS THE FIX ---
// Make sure our file is the LAST CSS import
import './index.css'
import './Dashboard.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)