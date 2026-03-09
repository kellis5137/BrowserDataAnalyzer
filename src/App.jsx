import { useState } from 'react'
import Home from './pages/Home'
import DataLoad from './pages/DataLoad'
import Analyze from './pages/Analyze'
import './App.css'

const PAGES = ['home', 'dataload', 'analyze']
const NAV_LABELS = { home: 'Home', dataload: 'Data Load', analyze: 'Analyze' }

export default function App() {
  const [page, setPage] = useState('home')
  // datasets: { [tableName]: { rows: [], filename: string } }
  const [datasets, setDatasets] = useState({})

  function handleDataLoaded(tableName, rows, filename) {
    setDatasets(prev => ({ ...prev, [tableName]: { rows, filename } }))
  }

  function handleDataRemoved(tableName) {
    setDatasets(prev => {
      const next = { ...prev }
      delete next[tableName]
      return next
    })
  }

  return (
    <div className="app">
      <nav className="navbar">
        {PAGES.map(p => (
          <button
            key={p}
            className={`nav-btn ${page === p ? 'active' : ''}`}
            onClick={() => setPage(p)}
          >
            {NAV_LABELS[p]}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {page === 'home'     && <Home onNavigate={setPage} />}
        {page === 'dataload' && (
          <DataLoad
            datasets={datasets}
            onDataLoaded={handleDataLoaded}
            onDataRemoved={handleDataRemoved}
          />
        )}
        {page === 'analyze'  && <Analyze datasets={datasets} />}
      </main>
    </div>
  )
}
