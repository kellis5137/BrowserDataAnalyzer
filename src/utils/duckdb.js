import * as duckdb from '@duckdb/duckdb-wasm'

let _db   = null
let _conn = null
let _initPromise = null

// ── init ──────────────────────────────────────────────────────────────────────

export async function getConnection() {
  if (_conn) return _conn
  if (_initPromise) { await _initPromise; return _conn }

  _initPromise = (async () => {
    const bundles = duckdb.getJsDelivrBundles()
    const bundle  = await duckdb.selectBundle(bundles)

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    )

    const worker = new Worker(workerUrl)
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
    _db = new duckdb.AsyncDuckDB(logger, worker)
    await _db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null)
    URL.revokeObjectURL(workerUrl)
    _conn = await _db.connect()
  })()

  await _initPromise
  return _conn
}

// ── table management ──────────────────────────────────────────────────────────

export async function registerTableFromCSV(tableName, csvText) {
  const conn     = await getConnection()
  const fileName = `${tableName}.csv`
  await _db.registerFileText(fileName, csvText)
  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`)
  await conn.query(
    `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${fileName}', header = true)`
  )
}

export async function dropTable(tableName) {
  const conn = await getConnection()
  await conn.query(`DROP TABLE IF EXISTS "${tableName}"`)
}

// ── querying ──────────────────────────────────────────────────────────────────

export async function runQuery(sql) {
  const conn   = await getConnection()
  const result = await conn.query(sql)
  return arrowToRows(result)
}

// executes the given SQL with pagination applied in the database;
// returns an object with the current page of rows and the total count
export async function runQueryPage(sql, page = 0, pageSize = 50) {
  const conn = await getConnection()

  // ensure numeric inputs; protect against NaN/strings
  page = Number(page)
  if (!Number.isFinite(page) || page < 0) page = 0
  pageSize = Number(pageSize)
  if (!Number.isFinite(pageSize) || pageSize <= 0) pageSize = 50

  // wrap the provided SQL so that COUNT(*) respects filters/joins/etc
  const countSql = `SELECT COUNT(*) AS cnt FROM (${sql})`;
  const countRes = await conn.query(countSql);
  const total = arrowToRows(countRes)[0].cnt;

  const offset = page * pageSize;
  const pageSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
  const pageRes = await conn.query(pageSql);
  const rows = arrowToRows(pageRes);

  return { rows, total };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function arrowToRows(table) {
  const fields = table.schema.fields.map(f => f.name)
  const rows   = []
  for (let i = 0; i < table.numRows; i++) {
    const row = {}
    for (const name of fields) {
      const col = table.getChild(name)
      const val = col ? col.get(i) : null
      // BigInt → number so AG Grid can sort/filter normally
      row[name] = typeof val === 'bigint' ? Number(val) : val
    }
    rows.push(row)
  }
  return rows
}
