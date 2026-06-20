import { fmt } from '../../../utils/format.js';

export function TableView({ active, result }) {
  const placed = result?.placed ?? [];
  const boxWeight = result?.config?.box?.weight ?? 0;

  return (
    <div className={`tablewrap${active ? ' active' : ''}`}>
      <table className="boxes">
        <thead>
          <tr>
            <th>#</th>
            <th>Layer</th>
            <th>X</th>
            <th>Y</th>
            <th>Z</th>
            <th>Dim X</th>
            <th>Dim Y</th>
            <th>Dim Z</th>
            <th className="l">Orientation</th>
            <th>kg</th>
          </tr>
        </thead>
        <tbody>
          {placed.map((b) => (
            <tr key={b.boxId}>
              <td>{b.boxId}</td>
              <td>{b.layer + 1}</td>
              <td>{fmt(b.x)}</td>
              <td>{fmt(b.y)}</td>
              <td>{fmt(b.z)}</td>
              <td>{fmt(b.dimX)}</td>
              <td>{fmt(b.dimY)}</td>
              <td>{fmt(b.dimZ)}</td>
              <td className="l">{b.orientation}</td>
              <td>{fmt(boxWeight, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
