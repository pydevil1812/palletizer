import { useEffect, useMemo, useRef, useState } from 'react';
import { usePalletConfig } from './hooks/usePalletConfig.js';
import { useStackResult } from './hooks/useStackResult.js';
import { useThreeScene } from './hooks/useThreeScene.js';
import { CanvasTopRenderer } from './services/CanvasTopRenderer.js';
import { CanvasSideRenderer } from './services/CanvasSideRenderer.js';
import { ExportService } from './services/ExportService.js';
import { Header } from './components/Header/Header.jsx';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { MainPanel } from './components/Main/MainPanel.jsx';
import './styles/palletizer.css';

export default function App() {
  const config = usePalletConfig();
  const stack = useStackResult();

  const [activeTab, setActiveTab] = useState('3d');
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

  // Initial render: compute the default example layout immediately, like the
  // original app did on DOMContentLoaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    stack.compute(config.state);
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

  const applyImportedConfig = (next) => {
    if (next.additional?.enabled) setAdditionalOpenSignal((s) => s + 1);
    stack.compute(next);
  };

  const handleCompute = () => stack.compute(config.state);
  const handleResetExample = () => applyImportedConfig(config.loadExample());
  const handleLoadJson = (json) => applyImportedConfig(config.loadFromJSON(json));
  const handleSaveJson = () => ExportService.exportJson(config.toPalletConfig());

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
      <Header onLoad={handleLoadJson} onSave={handleSaveJson} onCompute={handleCompute} />
      <div className="layout">
        <Sidebar
          config={config}
          onResetExample={handleResetExample}
          onCompute={handleCompute}
          additionalOpenSignal={additionalOpenSignal}
        />
        <MainPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportPdf={handleExportPdf}
          onExportXlsx={handleExportXlsx}
          onPrint={handlePrint}
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
        />
      </div>
      <div id="printArea" ref={printAreaRef}></div>
    </>
  );
}
