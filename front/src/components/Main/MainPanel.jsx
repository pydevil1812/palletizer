import { Toolbar } from './Toolbar.jsx';
import { Banner } from './Banner.jsx';
import { StatsBar } from './StatsBar.jsx';
import { Legend } from './Legend.jsx';
import { Recommendations } from './Recommendations.jsx';
import { ThreeDView } from './views/ThreeDView.jsx';
import { TopView } from './views/TopView.jsx';
import { SideView } from './views/SideView.jsx';
import { TableView } from './views/TableView.jsx';

export function MainPanel({
  activeTab,
  onTabChange,
  onExportPdf,
  onExportXlsx,
  onPrint,
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
}) {
  return (
    <section className="main">
      <Toolbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onExportPdf={onExportPdf}
        onExportXlsx={onExportXlsx}
        onPrint={onPrint}
        libWarning={libWarning}
      />

      <Banner type={bannerType} message={bannerMessage} />

      <StatsBar result={result} />

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

      <Legend result={result} />

      <Recommendations result={result} />
    </section>
  );
}
