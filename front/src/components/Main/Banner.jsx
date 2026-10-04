export function Banner({ type, message }) {
  if (!type) return <div className="banner" />;
  return <div className={`banner ${type}`}>{message}</div>;
}
