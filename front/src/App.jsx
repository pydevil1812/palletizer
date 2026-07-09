import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePalletConfig } from './hooks/usePalletConfig.js';
import { useStackResult } from './hooks/useStackResult.js';
import { useThreeScene } from './hooks/useThreeScene.js';
import { useHistory } from './hooks/useHistory.js';
import { useTheme } from './hooks/useTheme.js';
import { useAuth } from './hooks/useAuth.js';
import { useCatalog } from './hooks/useCatalog.js';
import { CatalogApiService } from './services/CatalogApiService.js';
import { useLang } from './i18n/LangContext.jsx';
import { formatError, formatRecommendation } from './i18n/messages.js';
import { CanvasTopRenderer } from './services/CanvasTopRenderer.js';
import { CanvasSideRenderer } from './services/CanvasSideRenderer.js';
import { ExportService } from './services/ExportService.js';
import { ConfigSerializer } from './domain/ConfigSerializer.js';
import { Header } from './components/Header/Header.jsx';
import { HistoryModal } from './components/Header/HistoryModal.jsx';
import { CompareModal } from './components/Header/CompareModal.jsx';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { MainPanel } from './components/Main/MainPanel.jsx';
import { RecommendationsPanel } from './components/Main/RecommendationsPanel.jsx';
import { LoginPage } from './components/Auth/LoginPage.jsx';
import { AdminPage } from './components/Admin/AdminPage.jsx';
import './styles/palletizer.css';

export default function App() {
  const { t, lang } = useLang();
  const auth = useAuth();
  const config = usePalletConfig();
  const stack = useStackResult();
  const history = useHistory();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('3d');
  const [leftPanel, setLeftPanel] = useState('params');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  // 'manual' = free-form inputs; 'template' = pick boxes/pallets from the
  // admin-managed catalogs. Persisted per browser.
  const [inputMode, setInputMode] = useState(
    () => localStorage.getItem('palletizer_input_mode') || 'manual',
  );
  const [topLayerIndex, setTopLayerIndex] = useState(0);
  const [sideAxis, setSideAxis] = useState('length');
  const [topInfo, setTopInfo] = useState(null);
  const [additionalOpenSignal, setAdditionalOpenSignal] = useState(0);

  // Callback ref: React calls this with the DOM element when it mounts/unmounts.
  // Feeding a state variable to useThreeScene means its effect re-runs whenever
  // the 3D host element appears in the DOM (e.g. after login).
  const [hostEl, setHostEl] = useState(null);
  const hostRef = useCallback((el) => setHostEl(el), []);

  const canvasTopRef = useRef(null);
  const canvasSideRef = useRef(null);
  const printAreaRef = useRef(null);

  const threeScene = useThreeScene(hostEl, theme);
  // Reload the catalogs whenever template mode becomes active again (e.g.
  // after the admin edited them in the admin panel).
  const catalog = useCatalog(auth.isLoggedIn && inputMode === 'template' && !adminOpen);

  const changeInputMode = (mode) => {
    setInputMode(mode);
    localStorage.setItem('palletizer_input_mode', mode);
  };
  const topRenderer = useMemo(() => new CanvasTopRenderer(), []);
  const sideRenderer = useMemo(() => new CanvasSideRenderer(), []);

  const runCompute = async (rawState, { record = true } = {}) => {
    const variants = await stack.compute(rawState);
    if (record && variants && auth.session) {
      const result = variants[0].result;
      const exportJson = ConfigSerializer.toExportJSON(config.toPalletConfig(rawState));
      history.save({
        config: exportJson,
        summary: {
          total_boxes: result.totalBoxes,
          layers: result.layers.length,
          fill_pct: result.volumeFill,
          height_mm: result.totalHeight,
          weight_kg: result.totalWeight,
        },
        variant: variants[0].name,
      });
    }
    return variants;
  };

  // Run the default example layout once the user is authenticated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (auth.isLoggedIn) {
      runCompute(config.state, { record: false });
    }
  }, [auth.isLoggedIn]);

  useEffect(() => {
    if (stack.result) setTopLayerIndex(stack.result.layers.length ? stack.result.layers.length - 1 : 0);
  }, [stack.result]);

  useEffect(() => {
    if (!canvasTopRef.current) return;
    setTopInfo(topRenderer.draw(canvasTopRef.current, stack.result, topLayerIndex, t));
  }, [stack.result, topLayerIndex, topRenderer, t, lang]);

  useEffect(() => {
    if (!canvasSideRef.current) return;
    sideRenderer.draw(canvasSideRef.current, stack.result, sideAxis, t);
  }, [stack.result, sideAxis, sideRenderer, t, lang]);

  useEffect(() => {
    if (threeScene.ready) threeScene.build(stack.result);
  }, [stack.result, threeScene.ready, threeScene]);

  useEffect(() => {
    if (activeTab !== '3d') return undefined;
    const t = setTimeout(() => threeScene.resize(), 30);
    return () => clearTimeout(t);
  }, [activeTab, threeScene]);

  const applyImportedConfig = async (next, { record = true } = {}) => {
    if (next.additional?.enabled) setAdditionalOpenSignal((s) => s + 1);
    await runCompute(next, { record });
  };

  const handleCompute = () => runCompute(config.state);
  const handleResetExample = () => applyImportedConfig(config.loadExample());
  const handleLoadJson = (json) => applyImportedConfig(config.loadFromJSON(json));
  const handleSaveJson = () => ExportService.exportJson(config.toPalletConfig());

  const handleApplyTemplate = async (templateId) => {
    try {
      const cfg = await CatalogApiService.getTemplateConfig(templateId);
      await applyImportedConfig(config.loadFromJSON(cfg), { record: false });
    } catch (err) {
      alert(t('catalog.templateLoadFailed') + err.message);
    }
  };

  const handleSaveTemplate = async () => {
    const name = window.prompt(t('catalog.templateNamePrompt'));
    if (!name || !name.trim()) return;
    try {
      await CatalogApiService.createTemplate(
        name.trim(),
        ConfigSerializer.toExportJSON(config.toPalletConfig()),
      );
      catalog.refresh();
      alert(t('catalog.templateSaved'));
    } catch (err) {
      alert(t('catalog.templateSaveFailed') + err.message);
    }
  };

  const handleOpenHistory = () => setHistoryOpen(true);
  const handleCloseHistory = () => setHistoryOpen(false);
  const handleToggleCompare = (id) => {
    setCompareIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return cur;
      return [...cur, id];
    });
  };
  const handleOpenCompare = () => {
    setCompareOpen(true);
    setHistoryOpen(false);
  };
  const handleCloseCompare = () => {
    setCompareOpen(false);
    setCompareIds([]);
  };
  const handleOpenSelectedHistory = async () => {
    if (history.selectedId == null) return;
    const cfg = await history.getConfig(history.selectedId);
    if (cfg) {
      applyImportedConfig(config.loadFromJSON(cfg), { record: false });
      setHistoryOpen(false);
    }
  };

  const toggleLeftPanel = () => setLeftPanel((p) => (p === 'recs' ? 'params' : 'recs'));

  const collectImages = () => ({
    threeD: threeScene.getPng(),
    top: canvasTopRef.current ? canvasTopRef.current.toDataURL('image/png') : null,
    side: canvasSideRef.current ? canvasSideRef.current.toDataURL('image/png') : null,
  });

  const localizedResult = () => ({
    ...stack.result,
    recommendations: stack.result.recommendations.map((r) => formatRecommendation(t, r)),
  });

  const handleExportPdf = () => {
    if (!stack.result) { alert(t('app.runCalcFirst')); return; }
    ExportService.exportPdf(localizedResult(), collectImages());
  };
  const handleExportXlsx = () => {
    if (!stack.result) { alert(t('app.runCalcFirst')); return; }
    ExportService.exportXlsx(localizedResult());
  };
  const handlePrint = () => {
    if (!stack.result) { alert(t('app.runCalcFirst')); return; }
    ExportService.print(printAreaRef.current, localizedResult(), collectImages());
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!auth.isLoggedIn) {
    return <LoginPage onLogin={auth.login} />;
  }

  // ── Admin panel ────────────────────────────────────────────────────────────
  if (adminOpen) {
    return (
      <AdminPage
        currentUsername={auth.session.username}
        onBack={() => setAdminOpen(false)}
      />
    );
  }

  let bannerType = null;
  let bannerMessage = '';
  if (stack.errors.length) {
    bannerType = 'err';
    bannerMessage = t('app.fixErrors') + stack.errors.map((e) => formatError(t, e)).join('; ');
  } else if (stack.result && stack.result.totalBoxes === 0) {
    bannerType = 'warn';
    bannerMessage = t('app.noBoxes');
  }

  const libWarning = threeScene.ready
    ? null
    : t('app.noWebGL');

  return (
    <>
      <Header
        onLoad={handleLoadJson}
        onSave={handleSaveJson}
        onCompute={handleCompute}
        onExportPdf={handleExportPdf}
        onExportXlsx={handleExportXlsx}
        onPrint={handlePrint}
        theme={theme}
        onToggleTheme={toggleTheme}
        inputMode={inputMode}
        onChangeInputMode={changeInputMode}
        onSaveTemplate={handleSaveTemplate}
        isComputing={stack.isComputing}
        username={auth.session.username}
        isAdmin={auth.isAdmin}
        onLogout={auth.logout}
        onOpenAdmin={() => setAdminOpen(true)}
      />
      <div className="layout">
        {leftPanel === 'params' ? (
          <Sidebar
            config={config}
            onResetExample={handleResetExample}
            onCompute={handleCompute}
            additionalOpenSignal={additionalOpenSignal}
            inputMode={inputMode}
            catalog={catalog}
            onApplyTemplate={handleApplyTemplate}
          />
        ) : (
          <RecommendationsPanel result={stack.result} />
        )}
        <MainPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          libWarning={libWarning}
          bannerType={bannerType}
          bannerMessage={bannerMessage}
          result={stack.result}
          hostRef={hostRef}
          autorotate={threeScene.autorotate}
          onToggleAutorotate={threeScene.toggleAutorotate}
          onResetView={threeScene.resetView}
          topLayerIndex={topLayerIndex}
          onTopLayerIndexChange={setTopLayerIndex}
          canvasTopRef={canvasTopRef}
          topInfo={topInfo}
          sideAxis={sideAxis}
          onSideAxisChange={setSideAxis}
          onOpenHistory={handleOpenHistory}
          canvasSideRef={canvasSideRef}
          leftPanelMode={leftPanel}
          onToggleLeftPanel={toggleLeftPanel}
        />
      </div>
      <div id="printArea" ref={printAreaRef}></div>

      <HistoryModal
        open={historyOpen}
        entries={history.entries}
        loading={history.loading}
        error={history.error}
        selectedId={history.selectedId}
        onSelect={history.select}
        onRemoveOne={history.removeOne}
        onClearAll={history.clearAll}
        onOpenSelected={handleOpenSelectedHistory}
        onClose={handleCloseHistory}
        onRefresh={history.refresh}
        isAdmin={auth.isAdmin}
        compareIds={compareIds}
        onToggleCompare={handleToggleCompare}
        onOpenCompare={handleOpenCompare}
      />

      <CompareModal
        open={compareOpen}
        ids={compareIds}
        historyRows={history.entries}
        onClose={handleCloseCompare}
        theme={theme}
      />
    </>
  );
}
