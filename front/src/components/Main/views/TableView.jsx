import { fmt } from '../../../utils/format.js';
import { useLang } from '../../../i18n/LangContext.jsx';

export function TableView({ active, result }) {
  const { t } = useLang();
  const placed = result?.placed ?? [];
  const boxWeight = result?.config?.box?.weight ?? 0;

  return (
    <div className={`tablewrap${active ? ' active' : ''}`}>
      <table className="boxes">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('table.layer')}</th>
            <th>X</th>
            <th>Y</th>
            <th>Z</th>
            <th>{t('table.dimX')}</th>
            <th>{t('table.dimY')}</th>
            <th>{t('table.dimZ')}</th>
            <th className="l">{t('table.orientation')}</th>
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
