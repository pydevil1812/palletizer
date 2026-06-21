export function RecommendationsBar({ count, active, onClick }) {
  return (
    <button type="button" className={`recsbar${active ? ' active' : ''}`} onClick={onClick}>
      {active ? (
        '← Back to parameters'
      ) : (
        <>
          💡 Recommendations
          {count > 0 && <span className="reccount">{count}</span>}
        </>
      )}
    </button>
  );
}
