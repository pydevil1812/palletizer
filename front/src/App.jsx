import { useEffect, useMemo, useRef, useState } from 'react';
import { usePalletConfig } from './hooks/usePalletConfig.js';
import { useStackResult } from './hooks/useStackResult.js';
import { useThreeScene } from './hooks/useThreeScene.js';
import { useHistory } from './hooks/useHistory.js';
import { useTheme } from './hooks/useTheme.js';
import { CanvasTopRenderer } from './services/CanvasTopRenderer.js';
import { CanvasSideRenderer } from './services/CanvasSideRenderer.js';
import { ExportService } from './services/ExportService.js';
import { ConfigSerializer } from './domain/ConfigSerializer.js';
import { Header } from './components/Header/Header.jsx';
import { HistoryModal } from './components/Header/HistoryModal.jsx';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { MainPanel } from './components/Main/MainPanel.jsx';
import { RecommendationsPanel } from './components/Main/RecommendationsPanel.jsx';
import './styles/palletizer.css';

export default function App() {
  const config = usePalletConfig();
  const stack = useStackResult();
  const history = useHistory();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('3d');
  const [leftPanel, setLeftPanel] = useState('params'); // 'params' | 'recs'
  const [historyOpen, setHistoryOpen] = useState(false);
  const [topLayerIndex, setTopLayerIndex] = useState(0);
  const [sideAxis, setSideAxis] = useState('length');
  const [topInfo, setTopInfo] = useState(null);
  const [additionalOpenSignal, setAdditionalOpenSignal] = useState(0);

  const hostRef = useRef(null);
  const canvasTopRef = useRef(null);
  const canvasSideRef = useRef(null);
  const printAreaRef = useRef(null);

  const threeScene = useThreeScene(hostRef);
  const topRenderer = useMemo(() => new CanvasTopRenderer(), []);
  const sideRenderer = useMemo(() => new CanvasSideRenderer(), []);

  // Computes the layout and, unless told otherwise, records the query in the
  // history backend — mirrors the desktop app's compute(record=True) default
  // (record=False is used when reloading a config from history, so reopening
  // an old query doesn't keep re-appending itself).
  const runCompute = async (rawState, { record = true } = {}) => {
    const variants = await stack.compute(rawState);
    if (record && variants) {
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

  // Initial render: compute the default example layout immediately, like the
  // original app did on DOMContentLoaded. Not recorded, matching the desktop
  // app's startup compute(record=False).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    runCompute(config.state, { record: false });
  }, []);

  // A fresh result always defaults the Top view to the topmost layer.
  useEffect(() => {
    if (stack.result) setTopLayerIndex(stack.result.layers.length ? stack.result.layers.length - 1 : 0);
  }, [stack.result]);

  // All views are kept in sync on every result change, not just the active
  // tab — matches the original, which redraws everything on each compute()
  // so exports always capture an up-to-date snapshot regardless of which
  // tab is currently visible.
  useEffect(() => {
    if (!canvasTopRef.current) return;
    setTopInfo(topRenderer.draw(canvasTopRef.current, stack.result, topLayerIndex));
  }, [stack.result, topLayerIndex, topRenderer]);

  useEffect(() => {
    if (!canvasSideRef.current) return;
    sideRenderer.draw(canvasSideRef.current, stack.result, sideAxis);
  }, [stack.result, sideAxis, sideRenderer]);

  useEffect(() => {
    if (threeScene.ready) threeScene.build(stack.result);
  }, [stack.result, threeScene.ready, threeScene]);

  // The 3D pane is display:none while another tab is active, so its
  // container has stale dimensions until it becomes visible again.
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

  const handleOpenHistory = () => setHistoryOpen(true);
  const handleCloseHistory = () => setHistoryOpen(false);
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

  const handleExportPdf = () => {
    if (!stack.result) {
      alert('Run a calculation first.');
      return;
    }
    ExportService.exportPdf(stack.result, collectImages());
  };
  const handleExportXlsx = () => {
    if (!stack.result) {
      alert('Run a calculation first.');
      return;
    }
    ExportService.exportXlsx(stack.result);
  };
  const handlePrint = () => {
    if (!stack.result) {
      alert('Run a calculation first.');
      return;
    }
    ExportService.print(printAreaRef.current, stack.result, collectImages());
  };

  let bannerType = null;
  let bannerMessage = '';
  if (stack.errors.length) {
    bannerType = 'err';
    bannerMessage = 'Please fix: ' + stack.errors.join('; ');
  } else if (stack.result && stack.result.totalBoxes === 0) {
    bannerType = 'warn';
    bannerMessage = 'No boxes could be placed with these inputs. See recommendations below.';
  }

  const libWarning = threeScene.ready
    ? null
    : '3D view unavailable (WebGL not supported). Top/Side views, table and Print still work.';

  return (
    <>
      <Header
        onLoad={handleLoadJson}
        onSave={handleSaveJson}
        onCompute={handleCompute}
        onExportPdf={handleExportPdf}
        onExportXlsx={handleExportXlsx}
        onPrint={handlePrint}
        onOpenHistory={handleOpenHistory}
        theme={theme}
        onToggleTheme={toggleTheme}
        variants={stack.variants}
        variantIndex={stack.variantIndex}
        onSelectVariant={stack.selectVariant}
        isComputing={stack.isComputing}
      />
      <div className="layout">
        {leftPanel === 'params' ? (
          <Sidebar
            config={config}
            onResetExample={handleResetExample}
            onCompute={handleCompute}
            additionalOpenSignal={additionalOpenSignal}
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
      />
    </>
  );
}
