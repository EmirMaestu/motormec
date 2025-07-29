import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import AppRouter from './router/AppRouter'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!)

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConvexProvider client={convex}>
        <AppRouter />
      </ConvexProvider>
    </ClerkProvider>
  </StrictMode>,
)
