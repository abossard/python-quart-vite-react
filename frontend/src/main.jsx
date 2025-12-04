import { FluentProvider } from '@fluentui/react-components'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { grabitTheme } from './theme'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <FluentProvider theme={grabitTheme}>
        <App />
      </FluentProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
