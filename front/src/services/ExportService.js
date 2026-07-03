import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ConfigSerializer } from '../domain/ConfigSerializer.js';
import { fmt } from '../utils/format.js';
import { PT_SANS_REGULAR_BASE64, PT_SANS_BOLD_BASE64 } from './fonts/PTSans.js';

// jsPDF's built-in fonts (Helvetica etc.) only cover WinAnsi glyphs, so Cyrillic
// text (recommendations, translated labels) renders as garbled symbols unless a
// Unicode-capable font is embedded. PT Sans covers Latin+Cyrillic.
function registerPdfFont(doc) {
  doc.addFileToVFS('PTSans-Regular.ttf', PT_SANS_REGULAR_BASE64);
  doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
  doc.addFileToVFS('PTSans-Bold.ttf', PT_SANS_BOLD_BASE64);
  doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold');
  doc.setFont('PTSans', 'normal');
}

/**
 * All "turn a StackResult into a downloadable artifact" concerns (JSON config,
 * Excel workbook, PDF report, print view), kept out of the React components so
 * those stay focused on rendering. `images` is { threeD, top, side } — PNG data
 * URLs captured from the live views by the caller, since only the component
 * layer holds refs to the canvases.
 */
export class ExportService {
  static summaryRows(result) {
    const c = result.config;
    return [
      ['Box', `${c.box.name}  ${fmt(c.box.length)}×${fmt(c.box.width)}×${fmt(c.box.height)} mm, ${fmt(c.box.weight, 1)} kg`],
      [
        'Pallet',
        `${c.pallet.name}  ${fmt(c.pallet.length)}×${fmt(c.pallet.width)} mm, deck ${fmt(c.pallet.deckHeight)} mm, cap ${fmt(c.pallet.loadCapacity)} kg`,
      ],
      ['Max stack height (mm)', fmt(c.maxStackHeight)],
      ['Boxes total', fmt(result.totalBoxes)],
      ['Layers', fmt(result.layers.length)],
      ['Boxes per layer', result.boxesPerLayer.join(', ')],
      ['Footprint fill (%)', fmt(result.footprintFill, 1)],
      ['Volume fill (%)', fmt(result.volumeFill, 1)],
      ['Total height (mm)', fmt(result.totalHeight) + `  (${fmt(result.heightUtil, 0)}% of max)`],
      ['Load weight boxes+spacers (kg)', fmt(result.totalWeight, 1) + `  (${fmt(result.weightUtil, 0)}% of capacity)`],
      ['Accessories film+posts (kg)', fmt(result.accessoriesWeight, 1)],
      ['Total gross weight (kg)', fmt(result.grossWeight, 1)],
      ['Limiting factor', result.limiting],
    ];
  }

  static downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  static exportJson(config) {
    const json = ConfigSerializer.toExportJSON(config);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, 'pallet_config.json');
  }

  static exportXlsx(result) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Metric', 'Value'], ...this.summaryRows(result)]),
      'Summary'
    );
    const layerAoA = [
      ['Layer', 'Boxes', 'z start (mm)', 'Dim X', 'Dim Y', 'Dim Z', 'Orientation', 'Weight (kg)'],
      ...result.layers.map((l, i) => [
        i + 1,
        l.boxCount,
        Math.round(l.zStart),
        l.dimX,
        l.dimY,
        l.dimZ,
        l.orientation,
        Math.round(l.weight * 10) / 10,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(layerAoA), 'Layers');
    const boxAoA = [
      ['#', 'Layer', 'X', 'Y', 'Z', 'Dim X', 'Dim Y', 'Dim Z', 'Orientation', 'Weight (kg)'],
      ...result.placed.map((b) => [
        b.boxId,
        b.layer + 1,
        Math.round(b.x),
        Math.round(b.y),
        Math.round(b.z),
        b.dimX,
        b.dimY,
        b.dimZ,
        b.orientation,
        result.config.box.weight,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(boxAoA), 'Boxes');
    if (result.recommendations.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([['Recommendations'], ...result.recommendations.map((r) => [r])]),
        'Recommendations'
      );
    }
    XLSX.writeFile(wb, 'pallet_report.xlsx');
  }

  static exportPdf(result, images) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    registerPdfFont(doc);
    const M = 40;
    const PW = doc.internal.pageSize.getWidth();
    doc.setFontSize(17);
    doc.text('Pallet Loading Report', M, 46);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(new Date().toLocaleString(), M, 62);
    doc.setTextColor(0);

    doc.autoTable({
      startY: 76,
      head: [['Metric', 'Value']],
      body: this.summaryRows(result),
      styles: { font: 'PTSans', fontSize: 9 },
      headStyles: { font: 'PTSans', fillColor: [40, 55, 75] },
      margin: { left: M, right: M },
    });

    let y = doc.lastAutoTable.finalY + 18;
    if (result.recommendations.length) {
      doc.setFont('PTSans', 'normal');
      doc.setFontSize(12);
      doc.text('Recommendations', M, y);
      y += 6;
      doc.autoTable({
        startY: y,
        body: result.recommendations.map((r, i) => [`${i + 1}. ${r}`]),
        styles: { font: 'PTSans', fontSize: 9, cellPadding: 4 },
        theme: 'plain',
        margin: { left: M, right: M },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    const imgs = [
      ['3D view', images.threeD],
      ['Top view', images.top],
      ['Side view', images.side],
    ];
    imgs.forEach(([label, data]) => {
      if (!data) return;
      const props = doc.getImageProperties(data);
      const w = PW - 2 * M;
      const h = (w * props.height) / props.width;
      if (y + h + 24 > doc.internal.pageSize.getHeight() - M) {
        doc.addPage();
        y = 46;
      }
      doc.setFont('PTSans', 'normal');
      doc.setFontSize(12);
      doc.text(label, M, y);
      y += 8;
      doc.addImage(data, 'PNG', M, y, w, h);
      y += h + 22;
    });

    doc.addPage();
    doc.setFont('PTSans', 'normal');
    doc.setFontSize(12);
    doc.text('Box coordinates', M, 46);
    doc.autoTable({
      startY: 60,
      head: [['#', 'Layer', 'X', 'Y', 'Z', 'Dim X', 'Dim Y', 'Dim Z', 'Orientation', 'kg']],
      body: result.placed.map((b) => [
        b.boxId,
        b.layer + 1,
        Math.round(b.x),
        Math.round(b.y),
        Math.round(b.z),
        b.dimX,
        b.dimY,
        b.dimZ,
        b.orientation,
        result.config.box.weight,
      ]),
      styles: { font: 'PTSans', fontSize: 7.5 },
      headStyles: { font: 'PTSans', fillColor: [40, 55, 75] },
      margin: { left: M, right: M },
    });

    doc.save('pallet_report.pdf');
  }

  static buildPrintHtml(result, images) {
    const sum = this.summaryRows(result)
      .map(([k, v]) => `<tr><td class="l">${k}</td><td>${v}</td></tr>`)
      .join('');
    const recs = result.recommendations.length
      ? '<h2>Recommendations</h2><ul>' + result.recommendations.map((r) => `<li>${r}</li>`).join('') + '</ul>'
      : '';
    const img = (label, data) => (data ? `<h2>${label}</h2><img src="${data}"/>` : '');
    const boxRows = result.placed
      .map(
        (b) => `<tr><td>${b.boxId}</td><td>${b.layer + 1}</td>
      <td>${Math.round(b.x)}</td><td>${Math.round(b.y)}</td><td>${Math.round(b.z)}</td>
      <td>${b.dimX}</td><td>${b.dimY}</td><td>${b.dimZ}</td><td class="l">${b.orientation}</td>
      <td>${result.config.box.weight}</td></tr>`
      )
      .join('');
    return `
    <h1>Pallet Loading Report</h1>
    <div style="color:#555">${new Date().toLocaleString()}</div>
    <h2>Summary</h2><table>${sum}</table>
    ${recs}
    ${img('3D view', images.threeD)}
    ${img('Top view', images.top)}
    ${img('Side view', images.side)}
    <h2>Box coordinates</h2>
    <table><thead><tr><th>#</th><th>Layer</th><th>X</th><th>Y</th><th>Z</th>
      <th>Dim X</th><th>Dim Y</th><th>Dim Z</th><th class="l">Orientation</th><th>kg</th></tr></thead>
      <tbody>${boxRows}</tbody></table>`;
  }

  static print(printAreaEl, result, images) {
    if (!printAreaEl) return;
    printAreaEl.innerHTML = this.buildPrintHtml(result, images);
    window.print();
  }
}
