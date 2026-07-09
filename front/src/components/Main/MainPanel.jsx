import { Toolbar } from './Toolbar.jsx';
import { Banner } from './Banner.jsx';
import { StatsBar } from './StatsBar.jsx';
import { Legend } from './Legend.jsx';
import { RecommendationsBar } from './RecommendationsBar.jsx';
import { ThreeDView } from './views/ThreeDView.jsx';
import { TopView } from './views/TopView.jsx';
import { SideView } from './views/SideView.jsx';
import { TableView } from './views/TableView.jsx';

export function MainPanel({
  activeTab,
  onTabChange,
  libWarning,
  bannerType,
  bannerMessage,
  result,
  hostRef,
  autorotate,
  onToggleAutorotate,
  onResetView,
  topLayerIndex,
  onTopLayerIndexChange,
  canvasTopRef,
  topInfo,
  sideAxis,
  onSideAxisChange,
  canvasSideRef,
  leftPanelMode,
  onToggleLeftPanel,
  onOpenHistory,
}) {
  return (
    <section className="main">
      <Toolbar activeTab={activeTab} onTabChange={onTabChange} libWarning={libWarning} onOpenHistory={onOpenHistory} />

      <Banner type={bannerType} message={bannerMessage} />

      {activeTab === '3d' && <StatsBar result={result} />}

      <div className="viewwrap">
        <ThreeDView
          active={activeTab === '3d'}
          hostRef={hostRef}
          autorotate={autorotate}
          onToggleAutorotate={onToggleAutorotate}
          onResetView={onResetView}
        />
        <TopView
          active={activeTab === 'top'}
          result={result}
          layerIndex={topLayerIndex}
          onLayerIndexChange={onTopLayerIndexChange}
          canvasRef={canvasTopRef}
          info={topInfo}
        />
        <SideView active={activeTab === 'side'} axis={sideAxis} onAxisChange={onSideAxisChange} canvasRef={canvasSideRef} />
        <TableView active={activeTab === 'table'} result={result} />
      </div>

      <RecommendationsBar
        count={result?.recommendations?.length ?? 0}
        active={leftPanelMode === 'recs'}
        onClick={onToggleLeftPanel}
      />
      
      <Legend result={result} />

    </section>
  );
}
