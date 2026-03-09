import { useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { getConnection, runQueryPage } from '../utils/duckdb'

ModuleRegistry.registerModules([AllCommunityModule])

export default function Analyze({ datasets }) {
  const tableNames = Object.keys(datasets)

  const defaultQuery = tableNames.length > 0
    ? `SELECT * FROM "${tableNames[0]}"`
    : `SELECT * FROM "table_name"`

  const [query,       setQuery]       = useState(defaultQuery)
  const [rows,        setRows]        = useState([])
  const [totalRows,   setTotalRows]   = useState(0)
  const [page,        setPage]        = useState(0)
  const pageSize                      = 50

  const [error,       setError]       = useState('')
  const [running,     setRunning]     = useState(false)
  const [dbReady,     setDbReady]     = useState(false)
  const [sortModel, setSortModel] = useState([])
  const [selectedCol, setSelectedCol] = useState('')
  const [selectedSort, setSelectedSort] = useState('asc')

  // pre-warm DuckDB so the first query isn't slow
  useEffect(() => {
    getConnection().then(() => setDbReady(true)).catch(() => {})
  }, [])

  // update default query when first table loads
  useEffect(() => {
    if (tableNames.length > 0) {
      setQuery(q => q === `SELECT * FROM "table_name"`
        ? `SELECT * FROM "${tableNames[0]}"`
        : q)
    }
  }, [tableNames.join(',')])

  // whenever the query text changes, reset to first page (will execute on user edits/clicks too)
  useEffect(() => {
    setPage(0)
    setSortModel([])
    setSelectedCol('')
  }, [query])

  useEffect(() => {
    if (selectedCol) {
      const newSortModel = [{ colId: selectedCol, sort: selectedSort }]
      setSortModel(newSortModel)
      handleRun(0, newSortModel)
    }
  }, [selectedCol, selectedSort])

  async function handleRun(newPage = 0, sort = sortModel) {
    if (!query.trim()) return
    // coerce page to a sane number
    newPage = Number(newPage)
    if (!Number.isFinite(newPage) || newPage < 0) newPage = 0

    setRunning(true); setError('')
    try {
      let fullSql = query
      if (sort.length > 0) {
        const orderBy = sort.map(s => `"${s.colId.replace(/"/g, '""')}" ${s.sort.toUpperCase()}`).join(', ')
        fullSql += ` ORDER BY ${orderBy}`
      }
      const { rows, total } = await runQueryPage(fullSql, newPage, pageSize)
      setRows(rows)
      setTotalRows(total)
      setPage(newPage)
    } catch (err) {
      setError(err.message)
      setRows([])
      setTotalRows(0)
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRun()
  }

  const colDefs = rows.length > 0
    ? Object.keys(rows[0]).map(field => ({ field, filter: true, sortable: false, resizable: true }))
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
              onClick={() => {
                const q = `SELECT * FROM "${name}"`
                setQuery(q)
                handleRun(0)
              }}
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
          placeholder={`SELECT * FROM "table_name"`}
          spellCheck={false}
        />
        <button onClick={handleRun} disabled={running || !dbReady}>
          {running ? 'Running…' : 'Run Query'}
        </button>
      </div>
      <p className="hint" style={{ margin: 0, fontSize: '0.8rem' }}>Ctrl+Enter to run</p>

      {error && <p className="error">{error}</p>}

      {!error && rows.length > 0 && (
        <>
          <p className="result-count">
            {rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows
          </p>
          <div className="pager">
            <button onClick={() => handleRun(Math.max(page - 1, 0), sortModel)} disabled={page === 0}>
              ‹ Prev
            </button>
            <span>
              Page {page + 1} of {Math.ceil(totalRows / pageSize)}
            </span>
            {Math.ceil(totalRows / pageSize) > 1 && (
              <select
                value={page + 1}
                onChange={e => handleRun(parseInt(e.target.value) - 1, sortModel)}
                style={{ marginLeft: '10px', marginRight: '10px' }}
              >
                {Array.from({ length: Math.ceil(totalRows / pageSize) }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>
                    Go to page {p}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => handleRun(page + 1, sortModel)}
              disabled={(page + 1) * pageSize >= totalRows}
            >
              Next ›
            </button>
          </div>
          {rows.length > 0 && (
            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)}>
                <option value="">-- Select Column --</option>
                {Object.keys(rows[0]).map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <select value={selectedSort} onChange={e => setSelectedSort(e.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          )}
          <div className="grid-container ag-theme-alpine-dark">
            <AgGridReact
              rowData={rows}
              columnDefs={colDefs}
            />
          </div>
        </>
      )}

      {!error && rows.length === 0 && !running && (
        <p className="hint">
          {tableNames.length > 0
            ? 'Write a SQL query and click Run. Use double-quoted table names, e.g. "users".'
            : 'No data loaded yet. Visit the Data Load page first.'}
        </p>
      )}
    </div>
  )
}
