import { useRef, useState, useEffect, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { registerTableFromCSV, dropTable, runQueryPage } from '../utils/duckdb'

ModuleRegistry.registerModules([AllCommunityModule])

function toTableName(filename) {
  return filename.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_')
}

function TablePreview({ tableName, dataset, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    handleRun(0)
  }, [handleRun])

  const handleRun = useCallback(async (newPage = 0) => {
    if (!tableName) return
    newPage = Number(newPage)
    if (!Number.isFinite(newPage) || newPage < 0) newPage = 0

    setLoading(true)
    setError('')
    try {
      const query = `SELECT * FROM "${tableName}"`
      const { rows: fetchedRows, total } = await runQueryPage(query, newPage, pageSize)
      setRows(fetchedRows)
      setTotalRows(total)
      setPage(newPage)
    } catch (err) {
      setError(err.message)
      setRows([])
      setTotalRows(0)
    } finally {
      setLoading(false)
    }
  }, [tableName])

  const colDefs = rows.length > 0
    ? Object.keys(rows[0]).map(field => ({ field, filter: true, sortable: true }))
    : []

  return (
    <div className="table-card">
      <div className="table-card-header">
        <div className="table-card-title">
          <span className="table-name-badge">{tableName}</span>
          <span className="table-meta">{dataset.filename} — {totalRows.toLocaleString()} rows</span>
        </div>
        <div className="table-card-actions">
          <button className="btn-secondary" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button className="btn-danger" onClick={() => onRemove(tableName)}>Remove</button>
        </div>
      </div>

      {expanded && (
        <>
          {error && <p className="error">{error}</p>}
          {!error && totalRows > 0 && (
            <>
              <p className="result-count">
                {rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows
              </p>
              <div className="pager">
                <button onClick={() => handleRun(Math.max(page - 1, 0))} disabled={page === 0 || loading}>
                  ‹ Prev
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(totalRows / pageSize)}
                </span>
                {Math.ceil(totalRows / pageSize) > 1 && (
                  <select
                    value={page + 1}
                    onChange={e => handleRun(parseInt(e.target.value) - 1)}
                    style={{ marginLeft: '10px', marginRight: '10px' }}
                    disabled={loading}
                  >
                    {Array.from({ length: Math.ceil(totalRows / pageSize) }, (_, i) => i + 1).map(p => (
                      <option key={p} value={p}>
                        Go to page {p}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => handleRun(page + 1)}
                  disabled={(page + 1) * pageSize >= totalRows || loading}
                >
                  Next ›
                </button>
              </div>
            </>
          )}
          <div className="grid-container ag-theme-alpine-dark">
            <AgGridReact
              rowData={rows}
              columnDefs={colDefs}
            />
          </div>
          {loading && <p className="hint">Loading...</p>}
        </>
      )}
    </div>
  )
}

function fmt(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

function StorageMeter({ quota }) {
  // if the caller has already fetched an estimate we just render it; otherwise
  // nothing is shown (parent may perform its own fetch/effect)
  if (!quota) return null

  const pct  = Math.min((quota.usage / quota.quota) * 100, 100)
  const used  = fmt(quota.usage)
  const total = fmt(quota.quota)
  const free  = fmt(quota.quota - quota.usage)
  const color = pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : '#34d399'

  return (
    <div className="storage-meter">
      <div className="storage-meter-bar">
        <div className="storage-meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="storage-meter-labels">
        <span>{used} used</span>
        <span style={{ color }}>{free} free</span>
        <span className="storage-meter-total">of {total}</span>
      </div>
    </div>
  )
}

export default function DataLoad({ datasets, onDataLoaded, onDataRemoved }) {
  const fileInputRef = useRef(null)
  const [storageRefresh, setStorageRefresh] = useState(0)
  const [quota, setQuota] = useState(null)
  const [uploadError, setUploadError] = useState('')

  function refreshStorage() { setStorageRefresh(n => n + 1) }

  // estimate storage whenever datasets change or explicit refresh is triggered
  useEffect(() => {
    navigator.storage.estimate().then(setQuota)
  }, [storageRefresh, datasets])

  function handleFiles(e) {
    setUploadError('')
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        try {
          const csvText   = evt.target.result
          const tableName = toTableName(file.name)
          await registerTableFromCSV(tableName, csvText)
          onDataLoaded(tableName, [], file.name)
          refreshStorage()
        } catch (err) {
          setUploadError(`Failed to load ${file.name}: ${err.message}`)
        }
      }
      reader.readAsText(file)
    })
    e.target.value = ''
  }

  async function handleRemoveTable(tableName) {
    await dropTable(tableName)
    onDataRemoved(tableName)
    refreshStorage()
  }

  const tableNames = Object.keys(datasets)

  return (
    <div className="page dataload-page">
      <div className="page-header">
        <h2>Load Data</h2>
        <div className="upload-area">
          <input ref={fileInputRef} type="file" accept=".csv" multiple onChange={handleFiles} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current.click()}>+ Upload CSV</button>
          {tableNames.length > 0 && (
            <span className="filename">
              {tableNames.length} table{tableNames.length !== 1 ? 's' : ''} loaded
              {quota && (
                <> – {fmt(quota.quota - quota.usage)} free</>
              )}
            </span>
          )}
        </div>
      </div>

      {uploadError && <p className="error">{uploadError}</p>}

      <StorageMeter quota={quota} />

      {tableNames.length === 0 && (
        <p className="hint">Upload one or more CSV files. Each file becomes a DuckDB table.</p>
      )}

      <div className="tables-list">
        {tableNames.map(name => (
          <TablePreview
            key={name}
            tableName={name}
            dataset={datasets[name]}
            onRemove={handleRemoveTable}
          />
        ))}
      </div>
    </div>
  )
}
