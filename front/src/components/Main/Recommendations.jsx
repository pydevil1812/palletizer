export function Recommendations({ result }) {
  const recs = result?.recommendations ?? null;

  return (
    <details className="recs" id="recs">
      <summary>
        Recommendations
        <span className="reccount">{recs && recs.length ? recs.length : ''}</span>
      </summary>
      <div id="recsBody">
        {recs === null && 'Run a calculation to see recommendations.'}
        {recs && recs.length === 0 && 'No adjustments suggested — the layout looks efficient.'}
        {recs && recs.length > 0 && (
          <ul>
            {recs.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
