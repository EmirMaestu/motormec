import { useState } from 'react'
import './App.css'
import Layout from './components/layout'
import Dashboard from './components/pages/dashboard'
import Vehicles from './components/pages/vehicles'
import Finance from './components/pages/finance'
import Reports from './components/pages/reports'
import StockManagement from './stock-management'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'vehicles':
        return <Vehicles />
      case 'finance':
        return <Finance />
      case 'reports':
        return <Reports />
      case 'stock':
        return <StockManagement />
      default:
        return <Dashboard />
    }
  }

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  )
}

export default App
