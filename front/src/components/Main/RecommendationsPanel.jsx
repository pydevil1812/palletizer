/**
 * Shown in the left column instead of <Sidebar> while leftPanelMode === 'recs'
 * (toggled by RecommendationsBar). Reuses the `.sidebar` class so the column
 * keeps the same width/colors and the layout doesn't jump when swapping.
 */
export function RecommendationsPanel({ result }) {
  const recs = result?.recommendations ?? null;

  return (
    <aside className="sidebar recspanel">
      <div className="card">
        <h2>Recommendations</h2>
        {recs === null && <p className="muted">Run a calculation to see recommendations.</p>}
        {recs && recs.length === 0 && <p className="muted">No adjustments suggested — the layout looks efficient.</p>}
        {recs && recs.length > 0 && (
          <ul className="recs-ul">
            {recs.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
