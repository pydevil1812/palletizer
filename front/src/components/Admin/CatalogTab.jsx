import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { CatalogApiService } from '../../services/CatalogApiService.js';
import { ExportService } from '../../services/ExportService.js';
import { useLang } from '../../i18n/LangContext.jsx';

// Column order shared by the Excel/CSV export and import for each catalog.
const PALLET_COLUMNS = ['name', 'length', 'width', 'deck_height', 'load_capacity'];
const BOX_COLUMNS = ['sku', 'name', 'length', 'width', 'height', 'weight'];

function exportRows(rows, columns, baseName, format) {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c]))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Catalog');
  XLSX.writeFile(wb, `${baseName}.${format}`, format === 'csv' ? { bookType: 'csv' } : undefined);
}

async function parseImportFile(file, columns) {
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  // Keep only the known columns so extra spreadsheet columns are ignored.
  return rows.map((r) => {
    const out = {};
    for (const c of columns) if (r[c] !== '') out[c] = r[c];
    return out;
  });
}

// Templates are exported/imported as JSON ({name, config} or an array of
// those) rather than spreadsheet rows, since `config` is a nested object.
async function parseTemplatesFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((item, i) => {
    const name = (item && item.name || '').trim();
    const config = item && item.config;
    if (!name || !config || typeof config !== 'object') {
      throw new Error(`Row ${i + 1}: expected an object with "name" and "config"`);
    }
    return { name, config };
  });
}

function ImportExportBar({ rows, columns, baseName, onImport, t }) {
  const fileRef = useRef(null);
  const [replace, setReplace] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    onImport(await parseImportFile(file, columns), replace);
  };

  return (
    <div className="admin-row-actions" style={{ alignItems: 'center', gap: 8 }}>
      <button className="ghost" style={{ fontSize: 11 }} onClick={() => exportRows(rows, columns, baseName, 'xlsx')}>
        ⤒ Excel
      </button>
      <button className="ghost" style={{ fontSize: 11 }} onClick={() => exportRows(rows, columns, baseName, 'csv')}>
        ⤒ CSV
      </button>
      <button className="ghost" style={{ fontSize: 11 }} onClick={() => fileRef.current.click()}>
        ⤓ {t('adminCatalog.import')}
      </button>
      <label className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        {t('adminCatalog.replaceOnImport')}
      </label>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}

function EditorRow({ fields, draft, setDraft, onSave, onCancel, t }) {
  return (
    <div style={{ background: 'var(--panel2)', padding: '12px 16px', borderRadius: 6, marginBottom: 12 }}>
      <div className="admin-pw-row" style={{ flexWrap: 'wrap' }}>
        {fields.map((f) => (
          <input
            key={f.key}
            type={f.number ? 'number' : 'text'}
            placeholder={f.label}
            title={f.label}
            value={draft[f.key]}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            style={{ flex: 1, minWidth: 110 }}
          />
        ))}
        <button className="primary" onClick={onSave}>{t('admin.save')}</button>
        <button className="ghost" onClick={onCancel}>{t('admin.cancel')}</button>
      </div>
    </div>
  );
}

function useCatalogSection(listFn) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setRows(await listFn());
    } catch (err) {
      setError(err.message);
    }
  }, [listFn]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, setError, load };
}

function draftToNumbers(draft, numberKeys) {
  const out = { ...draft };
  for (const k of numberKeys) out[k] = parseFloat(out[k]);
  return out;
}

// ── Pallets ───────────────────────────────────────────────────────────────────

function PalletsSection() {
  const { t } = useLang();
  const { rows, error, setError, load } = useCatalogSection(CatalogApiService.listPallets);
  const [draft, setDraft] = useState(null); // {id?, name, length, ...}

  const fields = [
    { key: 'name', label: t('adminCatalog.colName') },
    { key: 'length', label: t('pallet.length'), number: true },
    { key: 'width', label: t('pallet.width'), number: true },
    { key: 'deck_height', label: t('pallet.deckHeight'), number: true },
    { key: 'load_capacity', label: t('pallet.loadCapacity'), number: true },
  ];

  const save = async () => {
    setError('');
    const body = draftToNumbers(draft, ['length', 'width', 'deck_height', 'load_capacity']);
    try {
      if (draft.id != null) await CatalogApiService.updatePallet(draft.id, body);
      else await CatalogApiService.createPallet(body);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(t('adminCatalog.confirmDeletePallet', { name: row.name }))) return;
    try {
      await CatalogApiService.deletePallet(row.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const doImport = async (importedRows, replace) => {
    setError('');
    try {
      const res = await CatalogApiService.importPallets(importedRows, replace);
      alert(t('adminCatalog.importDone', { n: res.imported }));
      await load();
    } catch (err) {
      setError(t('adminCatalog.importFailed') + err.message);
    }
  };

  return (
    <>
      {error && <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <ImportExportBar rows={rows} columns={PALLET_COLUMNS} baseName="pallets_catalog" onImport={doImport} t={t} />
        <button
          className="primary"
          style={{ fontSize: 12, padding: '4px 12px' }}
          onClick={() => setDraft({ name: '', length: '', width: '', deck_height: 145, load_capacity: 1500 })}
        >
          {t('adminCatalog.addPallet')}
        </button>
      </div>
      {draft && <EditorRow fields={fields} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} t={t} />}
      <div className="admin-table-wrap">
        <table className="boxes">
          <thead>
            <tr>
              <th className="l">{t('adminCatalog.colName')}</th>
              <th>{t('pallet.length')}</th>
              <th>{t('pallet.width')}</th>
              <th>{t('pallet.deckHeight')}</th>
              <th>{t('pallet.loadCapacity')}</th>
              <th className="l">{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="l">
                  {row.name}
                  {!!row.is_standard && (
                    <span className="muted" style={{ fontSize: 10, marginLeft: 6 }}>{t('adminCatalog.standard')}</span>
                  )}
                </td>
                <td>{row.length}</td>
                <td>{row.width}</td>
                <td>{row.deck_height}</td>
                <td>{row.load_capacity}</td>
                <td className="l">
                  <div className="admin-row-actions">
                    <button className="ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setDraft({ ...row })}>
                      {t('adminCatalog.edit')}
                    </button>
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)' }}
                      onClick={() => remove(row)}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="l muted">{t('adminCatalog.noPallets')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Boxes / SKU ───────────────────────────────────────────────────────────────

function BoxesSection() {
  const { t } = useLang();
  const { rows, error, setError, load } = useCatalogSection(CatalogApiService.listBoxes);
  const [draft, setDraft] = useState(null);

  const fields = [
    { key: 'sku', label: t('adminCatalog.colSku') },
    { key: 'name', label: t('adminCatalog.colName') },
    { key: 'length', label: t('box.length'), number: true },
    { key: 'width', label: t('box.width'), number: true },
    { key: 'height', label: t('box.height'), number: true },
    { key: 'weight', label: t('box.weight'), number: true },
  ];

  const save = async () => {
    setError('');
    const body = draftToNumbers(draft, ['length', 'width', 'height', 'weight']);
    try {
      if (draft.id != null) await CatalogApiService.updateBox(draft.id, body);
      else await CatalogApiService.createBox(body);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(t('adminCatalog.confirmDeleteBox', { name: row.name }))) return;
    try {
      await CatalogApiService.deleteBox(row.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const doImport = async (importedRows, replace) => {
    setError('');
    try {
      const res = await CatalogApiService.importBoxes(importedRows, replace);
      alert(t('adminCatalog.importDone', { n: res.imported }));
      await load();
    } catch (err) {
      setError(t('adminCatalog.importFailed') + err.message);
    }
  };

  return (
    <>
      {error && <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <ImportExportBar rows={rows} columns={BOX_COLUMNS} baseName="boxes_catalog" onImport={doImport} t={t} />
        <button
          className="primary"
          style={{ fontSize: 12, padding: '4px 12px' }}
          onClick={() => setDraft({ sku: '', name: '', length: '', width: '', height: '', weight: 0 })}
        >
          {t('adminCatalog.addBox')}
        </button>
      </div>
      {draft && <EditorRow fields={fields} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} t={t} />}
      <div className="admin-table-wrap">
        <table className="boxes">
          <thead>
            <tr>
              <th className="l">{t('adminCatalog.colSku')}</th>
              <th className="l">{t('adminCatalog.colName')}</th>
              <th>{t('box.length')}</th>
              <th>{t('box.width')}</th>
              <th>{t('box.height')}</th>
              <th>{t('box.weight')}</th>
              <th className="l">{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="l">{row.sku || '–'}</td>
                <td className="l">{row.name}</td>
                <td>{row.length}</td>
                <td>{row.width}</td>
                <td>{row.height}</td>
                <td>{row.weight}</td>
                <td className="l">
                  <div className="admin-row-actions">
                    <button className="ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setDraft({ ...row })}>
                      {t('adminCatalog.edit')}
                    </button>
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)' }}
                      onClick={() => remove(row)}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="l muted">{t('adminCatalog.noBoxes')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Templates ─────────────────────────────────────────────────────────────────

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'template';
}

function TemplatesSection() {
  const { t } = useLang();
  const { rows, error, setError, load } = useCatalogSection(CatalogApiService.listTemplates);
  const fileRef = useRef(null);

  const remove = async (row) => {
    if (!window.confirm(t('adminCatalog.confirmDeleteTemplate', { name: row.name }))) return;
    try {
      await CatalogApiService.deleteTemplate(row.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportOne = async (row) => {
    setError('');
    try {
      const config = await CatalogApiService.getTemplateConfig(row.id);
      const blob = new Blob([JSON.stringify({ name: row.name, config }, null, 2)], { type: 'application/json' });
      ExportService.downloadBlob(blob, `${safeFileName(row.name)}.json`);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportAll = async () => {
    setError('');
    try {
      const list = await Promise.all(
        rows.map(async (row) => ({ name: row.name, config: await CatalogApiService.getTemplateConfig(row.id) })),
      );
      const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
      ExportService.downloadBlob(blob, 'templates_catalog.json');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const items = await parseTemplatesFile(file);
      for (const item of items) await CatalogApiService.createTemplate(item.name, item.config);
      alert(t('adminCatalog.importDone', { n: items.length }));
      await load();
    } catch (err) {
      setError(t('adminCatalog.importFailed') + err.message);
    }
  };

  return (
    <>
      {error && <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>{error}</div>}
      <p className="muted" style={{ fontSize: 12 }}>{t('adminCatalog.templatesHint')}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div className="admin-row-actions" style={{ alignItems: 'center', gap: 8 }}>
          <button className="ghost" style={{ fontSize: 11 }} onClick={exportAll} disabled={!rows.length}>
            ⤒ {t('adminCatalog.exportAll')}
          </button>
          <button className="ghost" style={{ fontSize: 11 }} onClick={() => fileRef.current.click()}>
            ⤓ {t('adminCatalog.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="boxes">
          <thead>
            <tr>
              <th className="l">{t('adminCatalog.colName')}</th>
              <th className="l">{t('admin.colCreated')}</th>
              <th className="l">{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="l">{row.name}</td>
                <td className="l">{row.created_at}</td>
                <td className="l">
                  <div className="admin-row-actions">
                    <button className="ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => exportOne(row)}>
                      {t('adminCatalog.exportOne')}
                    </button>
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)' }}
                      onClick={() => remove(row)}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="l muted">{t('adminCatalog.noTemplates')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CatalogTab() {
  const { t } = useLang();
  const [section, setSection] = useState('pallets');
  const sections = [
    ['pallets', t('adminCatalog.subPallets')],
    ['boxes', t('adminCatalog.subBoxes')],
    ['templates', t('adminCatalog.subTemplates')],
  ];

  return (
    <>
      <div className="admin-tabs-bar" style={{ marginBottom: 12 }}>
        {sections.map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab${section === key ? ' active' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'pallets' && <PalletsSection />}
      {section === 'boxes' && <BoxesSection />}
      {section === 'templates' && <TemplatesSection />}
    </>
  );
}
