import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

function bestSet(items, getter) {
  const ok = items.filter((i) => i.status === 'ok');
  if (!ok.length) return new Set();
  const max = Math.max(...ok.map(getter));
  return new Set(ok.filter((i) => getter(i) === max).map((i) => i.id));
}

function Cell({ item, best, render }) {
  if (item.status !== 'ok') return <td>–</td>;
  return <td className={best?.has(item.id) ? 'cmp-best' : ''}>{render(item.result)}</td>;
}

export function CompareTable({ items }) {
  const { t } = useLang();
  if (!items.length) return null;

  const bestBoxes = bestSet(items, (i) => i.result.totalBoxes);
  const bestFootprint = bestSet(items, (i) => i.result.footprintFill);
  const bestVolume = bestSet(items, (i) => i.result.volumeFill);

  return (
    <table className="boxes cmp-table">
      <thead>
        <tr>
          <th className="l"></th>
          {items.map((item) => (
            <th key={item.id} className="l">
              {item.label || item.id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="l">{t('compare.rowBoxSize')}</td>
          {items.map((item) => (
            <td key={item.id}>
              {item.status === 'ok' && item.config?.box
                ? `${fmt(item.config.box.length)}×${fmt(item.config.box.width)}×${fmt(item.config.box.height)}`
                : '–'}
            </td>
          ))}
        </tr>
        <tr>
          <td className="l">{t('compare.rowPallet')}</td>
          {items.map((item) => (
            <td key={item.id}>{item.status === 'ok' ? item.config?.pallet?.name ?? '–' : '–'}</td>
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.boxesTotal')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} best={bestBoxes} render={(r) => fmt(r.totalBoxes)} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.layers')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} render={(r) => fmt(r.layers.length)} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.boxesPerLayer')}</td>
          {items.map((item) => (
            <Cell
              key={item.id}
              item={item}
              render={(r) => (r.boxesPerLayer.length ? r.boxesPerLayer.join('·') : '0')}
            />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.footprintFill')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} best={bestFootprint} render={(r) => `${fmt(r.footprintFill, 1)}%`} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.volumeFill')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} best={bestVolume} render={(r) => `${fmt(r.volumeFill, 1)}%`} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.totalHeight')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} render={(r) => `${fmt(r.totalHeight)} mm`} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.grossWeight')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} render={(r) => `${fmt(r.grossWeight, 1)} kg`} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.capacityUsed')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} render={(r) => `${fmt(r.weightUtil, 0)}%`} />
          ))}
        </tr>
        <tr>
          <td className="l">{t('stats.limiting')}</td>
          {items.map((item) => (
            <Cell key={item.id} item={item} render={(r) => t(`stats.limitingReasons.${r.limiting}`)} />
          ))}
        </tr>
      </tbody>
    </table>
  );
}
