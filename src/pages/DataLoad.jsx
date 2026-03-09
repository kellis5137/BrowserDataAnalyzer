import { useRef, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { registerTableFromCSV, dropTable } from '../utils/duckdb'

ModuleRegistry.registerModules([AllCommunityModule])

function parseCSV(text) {
  const rows    = text.trim().split('\n')
  const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return rows.slice(1).map(row => {
    const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function toTableName(filename) {
  return filename.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_')
}

function TablePreview({ tableName, dataset, onRemove }) {
  const [expanded, setExpanded] = useState(true)

  const colDefs = dataset.rows.length > 0
    ? Object.keys(dataset.rows[0]).map(field => ({ field, filter: true, sortable: true }))
    : []

  return (
    <div className="table-card">
      <div className="table-card-header">
        <div className="table-card-title">
          <span className="table-name-badge">{tableName}</span>
          <span className="table-meta">{dataset.filename} — {dataset.rows.length.toLocaleString()} rows</span>
        </div>
        <div className="table-card-actions">
          <button className="btn-secondary" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button className="btn-danger" onClick={() => onRemove(tableName)}>Remove</button>
        </div>
      </div>

      {expanded && (
        <div className="grid-container ag-theme-alpine-dark">
          <AgGridReact
            rowData={dataset.rows}
            columnDefs={colDefs}
            pagination={true}
            paginationPageSize={25}
          />
        </div>
      )}
    </div>
  )
}

function fmt(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

function StorageMeter({ refresh }) {
  const [quota, setQuota] = useState(null)

  useEffect(() => {
    navigator.storage.estimate().then(setQuota)
  }, [refresh])

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

  function refreshStorage() { setStorageRefresh(n => n + 1) }

  function handleFiles(e) {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        const csvText   = evt.target.result
        const rows      = parseCSV(csvText)
        const tableName = toTableName(file.name)
        await registerTableFromCSV(tableName, csvText)
        onDataLoaded(tableName, rows, file.name)
        refreshStorage()
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
            <span className="filename">{tableNames.length} table{tableNames.length !== 1 ? 's' : ''} loaded</span>
          )}
        </div>
      </div>

      <StorageMeter refresh={storageRefresh} />

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
