import { useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { getConnection, runQuery } from '../utils/duckdb'

ModuleRegistry.registerModules([AllCommunityModule])

export default function Analyze({ datasets }) {
  const tableNames = Object.keys(datasets)

  const defaultQuery = tableNames.length > 0
    ? `SELECT * FROM "${tableNames[0]}" LIMIT 100`
    : `SELECT * FROM "table_name" LIMIT 100`

  const [query,       setQuery]       = useState(defaultQuery)
  const [results,     setResults]     = useState([])
  const [error,       setError]       = useState('')
  const [running,     setRunning]     = useState(false)
  const [dbReady,     setDbReady]     = useState(false)

  // pre-warm DuckDB so the first query isn't slow
  useEffect(() => {
    getConnection().then(() => setDbReady(true)).catch(() => {})
  }, [])

  // update default query when first table loads
  useEffect(() => {
    if (tableNames.length > 0) {
      setQuery(q => q === `SELECT * FROM "table_name" LIMIT 100`
        ? `SELECT * FROM "${tableNames[0]}" LIMIT 100`
        : q)
    }
  }, [tableNames.join(',')])

  async function handleRun() {
    if (!query.trim()) return
    setRunning(true); setError('')
    try {
      const rows = await runQuery(query)
      setResults(rows)
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRun()
  }

  const colDefs = results.length > 0
    ? Object.keys(results[0]).map(field => ({ field, filter: true, sortable: true, resizable: true }))
    : []

  return (
    <div className="page analyze-page">
      <div className="analyze-header">
        <h2>Analyze</h2>
        {!dbReady && <span className="db-status">Initializing DuckDB…</span>}
        {dbReady  && <span className="db-status ready">DuckDB ready</span>}
      </div>

      {tableNames.length > 0 && (
        <div className="tables-reference">
          <span className="ref-label">Tables:</span>
          {tableNames.map(name => (
            <code
              key={name}
              className="table-chip"
              onClick={() => setQuery(`SELECT * FROM "${name}" LIMIT 100`)}
              title="Click to query this table"
            >
              {name}
            </code>
          ))}
        </div>
      )}

      <div className="query-area">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder={`SELECT * FROM "table_name" LIMIT 100`}
          spellCheck={false}
        />
        <button onClick={handleRun} disabled={running || !dbReady}>
          {running ? 'Running…' : 'Run Query'}
        </button>
      </div>
      <p className="hint" style={{ margin: 0, fontSize: '0.8rem' }}>Ctrl+Enter to run</p>

      {error && <p className="error">{error}</p>}

      {!error && results.length > 0 && (
        <>
          <p className="result-count">{results.length.toLocaleString()} row{results.length !== 1 ? 's' : ''} returned</p>
          <div className="grid-container ag-theme-alpine-dark">
            <AgGridReact
              rowData={results}
              columnDefs={colDefs}
              pagination={true}
              paginationPageSize={50}
            />
          </div>
        </>
      )}

      {!error && results.length === 0 && !running && (
        <p className="hint">
          {tableNames.length > 0
            ? 'Write a SQL query and click Run. Use double-quoted table names, e.g. "users".'
            : 'No data loaded yet. Visit the Data Load page first.'}
        </p>
      )}
    </div>
  )
}
