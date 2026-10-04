export function fmt(n, decimals = 0) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
