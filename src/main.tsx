import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './lib/store'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/home.css'
import './styles/builder.css'
import './styles/responses.css'
import './styles/logic.css'
import './styles/notifications.css'
import './styles/design.css'
import './styles/public.css'
import './styles/extras.css'
import './styles/flows.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <App />
        </StoreProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
