export default function Home({ onNavigate }) {
  return (
    <div className="page home-page">
      <h1>Browser Data Analyzer</h1>
      <p className="subtitle">Load, query, and analyze your data with SQL and interactive grids.</p>
      <div className="home-actions">
        <button onClick={() => onNavigate('dataload')}>Load Data</button>
        <button onClick={() => onNavigate('analyze')}>Analyze</button>
      </div>
    </div>
  )
}
