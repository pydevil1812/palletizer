/* =====================================================================
   PALLETIZATION ENGINE  (faithful JS port of palletizer/packer.py)
   All linear units mm, weights kg.
   ===================================================================== */

function generateOrientations(box, flags){
  const start = ['L','W','H'];
  const swapX = a => [a[0], a[2], a[1]];   // swap Y<->Z
  const swapY = a => [a[2], a[1], a[0]];   // swap X<->Z
  const swapZ = a => [a[1], a[0], a[2]];   // swap X<->Y
  const gens = [];
  if (flags.allow_rotate_x) gens.push(swapX);
  if (flags.allow_rotate_y) gens.push(swapY);
  if (flags.allow_rotate_z) gens.push(swapZ);

  const key = a => a.join('');
  const seen = new Map(); seen.set(key(start), start);
  let frontier = [start];
  while (frontier.length){
    const nxt = [];
    for (const st of frontier){
      for (const g of gens){
        const c = g(st), k = key(c);
        if (!seen.has(k)){ seen.set(k, c); nxt.push(c); }
      }
    }
    frontier = nxt;
  }
  const dims = {L:box.length, W:box.width, H:box.height};
  const out = [];
  for (const a of seen.values()){
    out.push({dx:dims[a[0]], dy:dims[a[1]], dz:dims[a[2]],
              label:`${a[0]}-x,${a[1]}-y,${a[2]}-z`});
  }
  return out;
}

function grid(L, W, a, b){
  if (a <= 0 || b <= 0) return [0,0];
  return [Math.floor(L/a), Math.floor(W/b)];
}

function gridPlusStrip(L, W, a, b, allowSwap){
  const [nx, ny] = grid(L, W, a, b);
  const rects = [];
  for (let i=0;i<nx;i++) for (let j=0;j<ny;j++) rects.push([i*a, j*b, a, b]);
  const usedX = nx*a, usedY = ny*b, remX = L-usedX, remY = W-usedY;

  let bestExtra = [];
  if (allowSwap && remX >= b && b > 0){
    const ny2 = Math.floor(W/a), nx2 = Math.floor(remX/b);
    const extra = [];
    for (let i=0;i<nx2;i++) for (let j=0;j<ny2;j++) extra.push([usedX+i*b, j*a, b, a]);
    if (extra.length > bestExtra.length) bestExtra = extra;
  }
  if (allowSwap && remY >= a && a > 0){
    const nx3 = Math.floor(L/b), ny3 = Math.floor(remY/a);
    const extra = [];
    for (let i=0;i<nx3;i++) for (let j=0;j<ny3;j++) extra.push([i*b, usedY+j*a, b, a]);
    if (extra.length > bestExtra.length) bestExtra = extra;
  }
  return rects.concat(bestExtra);
}

function packRectangle(L, W, a, b, allowSwap){
  const cands = [gridPlusStrip(L, W, a, b, allowSwap)];
  if (allowSwap) cands.push(gridPlusStrip(L, W, b, a, allowSwap));
  return cands.reduce((m,c)=> c.length > m.length ? c : m);
}

function stackLayers(cfg){
  const box = cfg.box, pallet = cfg.pallet, add = cfg.additional;
  const orientations = generateOrientations(box, cfg.orientation_flags);
  let z = pallet.deck_height, wUsed = 0;
  const layers = [];
  let idx = 0, limiting = 'pattern';
  const maxIter = 1000;

  while (idx < maxIter){
    const useSpacer = add && add.enabled && add.use_spacers && idx > 0;
    const spacerH = useSpacer ? add.spacer_thickness_mm : 0;
    const spacerW = useSpacer ? add.spacer_weight_kg : 0;
    const remH = cfg.max_stack_height - z - spacerH;
    const remW = pallet.load_capacity - wUsed - spacerW;
    if (remH <= 0){ limiting = 'height'; break; }
    if (remW <= 0){ limiting = 'weight'; break; }

    let best = null;
    for (const o of orientations){
      if (o.dz > remH || o.dz <= 0) continue;
      let rects = packRectangle(pallet.length, pallet.width, o.dx, o.dy,
                                cfg.orientation_flags.allow_rotate_z);
      let count = rects.length;
      if (count === 0) continue;
      let lw = count * box.weight;
      if (lw > remW){
        const maxByW = box.weight > 0 ? Math.floor(remW / box.weight) : count;
        if (maxByW <= 0) continue;
        rects = rects.slice(0, maxByW); count = maxByW; lw = count * box.weight;
      }
      if (best === null || count > best.count) best = {orient:o, rects, count, weight:lw};
    }
    if (!best || best.count === 0){
      // nothing more fits in the remaining height: height-limited
      limiting = idx === 0 ? 'pattern' : 'height';
      break;
    }
    z += spacerH; wUsed += spacerW;
    layers.push({index:idx, z_start:z,
      dim_x:best.orient.dx, dim_y:best.orient.dy, dim_z:best.orient.dz,
      orientation:best.orient.label, rects:best.rects, weight:best.weight});
    z += best.orient.dz; wUsed += best.weight; idx++;
  }
  return finalize(cfg, layers, z, wUsed, limiting);
}

function finalize(cfg, layers, zCursor, weightUsed, limiting){
  const box = cfg.box, pallet = cfg.pallet, add = cfg.additional;
  const footprintArea = pallet.length * pallet.width;
  const boxVolume = box.length * box.width * box.height;

  const placed = [];
  let bid = 1;
  for (const layer of layers){
    for (const r of layer.rects){
      placed.push({box_id:bid, layer:layer.index, x:r[0], y:r[1], z:layer.z_start,
        dim_x:r[2], dim_y:r[3], dim_z:layer.dim_z, orientation:layer.orientation});
      bid++;
    }
  }
  const totalBoxes = placed.length;

  // Accessories whose mass is NOT already in the load weight. Spacer mass is
  // folded into weightUsed by stackLayers, so it is excluded here to avoid
  // double counting; only film + corner posts are added on top.
  let accessoriesWeight = 0;
  if (add && add.enabled){
    if (add.use_film)   accessoriesWeight += add.film_weight_kg;
    if (add.use_corner) accessoriesWeight += add.corner_post_weight_kg;
  }

  const totalWeight = weightUsed;           // boxes + spacers (matches engine)
  const totalHeight = zCursor;
  const usedStackHeight = Math.max(totalHeight - pallet.deck_height, 1e-9);

  let footprintFill = 0;
  if (layers.length){
    footprintFill = layers.reduce((s,l)=>
      s + (l.rects.length * (l.dim_x*l.dim_y)) / footprintArea, 0) / layers.length * 100;
  }
  const volumeFill = (footprintArea * usedStackHeight) > 0
    ? (totalBoxes * boxVolume) / (footprintArea * usedStackHeight) * 100 : 0;
  const heightUtil = cfg.max_stack_height > 0 ? totalHeight / cfg.max_stack_height * 100 : 0;
  const weightUtil = pallet.load_capacity > 0 ? totalWeight / pallet.load_capacity * 100 : 0;

  const recommendations = buildRecommendations(cfg, layers, totalHeight, totalWeight);

  return {cfg, layers, placed, totalBoxes, totalWeight, totalHeight,
    footprintFill, volumeFill, heightUtil, weightUtil, recommendations,
    accessoriesWeight, grossWeight: totalWeight + accessoriesWeight,
    limiting};
}

function buildRecommendations(cfg, layers, totalHeight, totalWeight){
  const recs = [];
  const box = cfg.box, pallet = cfg.pallet;
  if (!layers.length){
    recs.push("No box orientation fits the pallet footprint together with the allowed "
      + "stack height/weight. Check box dimensions against the pallet footprint and deck "
      + "height, or relax the orientation flags.");
    return recs;
  }
  const bottom = layers[0];
  const [nx, ny] = grid(pallet.length, pallet.width, bottom.dim_x, bottom.dim_y);
  const T = 0.15;
  const r0 = v => Math.round(v);

  if (nx > 0){
    const remX = pallet.length - nx*bottom.dim_x;
    const target = pallet.length / (nx+1);
    const red = bottom.dim_x - target;
    if (red > 0 && red <= bottom.dim_x*T){
      const note = remX > 1 ? `, reclaiming the ${r0(remX)} mm currently left over` : '';
      recs.push(`Reducing the box dimension along pallet length (now ${r0(bottom.dim_x)} mm) `
        + `by ~${r0(red)} mm (to ~${r0(target)} mm) would fit one more column per layer `
        + `(${nx+1} instead of ${nx})${note}.`);
    }
  }
  if (ny > 0){
    const remY = pallet.width - ny*bottom.dim_y;
    const target = pallet.width / (ny+1);
    const red = bottom.dim_y - target;
    if (red > 0 && red <= bottom.dim_y*T){
      const note = remY > 1 ? `, reclaiming the ${r0(remY)} mm currently left over` : '';
      recs.push(`Reducing the box dimension along pallet width (now ${r0(bottom.dim_y)} mm) `
        + `by ~${r0(red)} mm (to ~${r0(target)} mm) would fit one more row per layer `
        + `(${ny+1} instead of ${ny})${note}.`);
    }
  }
  const n = layers.length;
  const avgDz = layers.reduce((s,l)=>s+l.dim_z,0)/n;
  const availForLayers = cfg.max_stack_height - pallet.deck_height;
  const targetDz = availForLayers/(n+1);
  const redH = avgDz - targetDz;
  if (redH > 0 && redH <= avgDz*T){
    recs.push(`Reducing box height by ~${r0(redH)} mm (to ~${r0(targetDz)} mm) would allow an `
      + `extra layer (${n+1} instead of ${n}) within the ${r0(cfg.max_stack_height)} mm max height.`);
  }
  const wHead = pallet.load_capacity - totalWeight;
  const hHead = cfg.max_stack_height - totalHeight;
  if (hHead < avgDz && wHead > box.weight*5){
    recs.push(`The stack is height-limited: ${r0(wHead)} kg of load capacity `
      + `(${Math.round(wHead/pallet.load_capacity*100)}% of capacity) is unused. A taller `
      + `allowed stack would let this pallet carry meaningfully more boxes.`);
  } else if (wHead < box.weight && hHead > avgDz){
    recs.push(`The stack is weight-limited: ${r0(hHead)} mm of allowed height is unused because `
      + `load capacity (${r0(pallet.load_capacity)} kg) is nearly reached. Lighter boxes or a `
      + `higher-capacity pallet would use the remaining height.`);
  }
  const avgFill = layers.reduce((s,l)=>s + l.rects.length*(l.dim_x*l.dim_y),0)
                  / (n * pallet.length*pallet.width);
  if (avgFill < 0.75){
    const f = cfg.orientation_flags;
    const disabled = [];
    if (!f.allow_rotate_x) disabled.push('tip onto side (X)');
    if (!f.allow_rotate_y) disabled.push('tip onto end (Y)');
    if (!f.allow_rotate_z) disabled.push('rotate footprint (Z)');
    if (disabled.length){
      recs.push(`Average footprint fill per layer is ${Math.round(avgFill*100)}%, below the 75% `
        + `rule-of-thumb. These orientations are disabled and could be reviewed if the box can `
        + `safely be reoriented: ${disabled.join(', ')}.`);
    } else {
      recs.push(`Average footprint fill per layer is ${Math.round(avgFill*100)}% even with all `
        + `rotations allowed. The footprint doesn't divide evenly into the pallet — revisit box `
        + `length/width, or consider an interlocking pattern (not modeled by this version).`);
    }
  }
  return recs;
}

/* =====================================================================
   UI STATE + GLUE
   ===================================================================== */
const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value);
let RESULT = null;

function readConfig(){
  return {
    box: {
      name: $('box_name').value || 'Box',
      length: num('box_length'), width: num('box_width'),
      height: num('box_height'), weight: num('box_weight'),
    },
    pallet: {
      name: $('pallet_name').value || 'Pallet',
      length: num('pallet_length'), width: num('pallet_width'),
      deck_height: num('pallet_deck'), load_capacity: num('pallet_cap'),
    },
    max_stack_height: num('max_height'),
    orientation_flags: {
      allow_rotate_x: $('rot_x').checked,
      allow_rotate_y: $('rot_y').checked,
      allow_rotate_z: $('rot_z').checked,
    },
    additional: {
      enabled: $('add_enabled').checked,
      use_spacers: $('add_spacers').checked,
      spacer_thickness_mm: num('spacer_thickness') || 0,
      spacer_weight_kg: num('spacer_weight') || 0,
      use_corner: $('add_corner').checked,
      corner_post_weight_kg: num('corner_weight') || 0,
      use_film: $('add_film').checked,
      film_weight_kg: num('film_weight') || 0,
    },
  };
}

function applyConfig(c){
  if (!c) return;
  const b=c.box||{}, p=c.pallet||{}, o=c.orientation_flags||{};
  // accept both this app's schema and the Python CLI schema (additional_elements)
  const a=c.additional || c.additional_elements || {};
  if (b.name!=null) $('box_name').value=b.name;
  if (b.length!=null) $('box_length').value=b.length;
  if (b.width!=null) $('box_width').value=b.width;
  if (b.height!=null) $('box_height').value=b.height;
  if (b.weight!=null) $('box_weight').value=b.weight;
  if (p.name!=null) $('pallet_name').value=p.name;
  if (p.length!=null) $('pallet_length').value=p.length;
  if (p.width!=null) $('pallet_width').value=p.width;
  if (p.deck_height!=null) $('pallet_deck').value=p.deck_height;
  if (p.load_capacity!=null) $('pallet_cap').value=p.load_capacity;
  if (c.max_stack_height!=null) $('max_height').value=c.max_stack_height;
  $('rot_x').checked=!!o.allow_rotate_x;
  $('rot_y').checked=!!o.allow_rotate_y;
  $('rot_z').checked=o.allow_rotate_z!==false;
  $('add_enabled').checked=!!a.enabled;
  $('add_spacers').checked=!!a.use_spacers;
  if (a.spacer_thickness_mm!=null) $('spacer_thickness').value=a.spacer_thickness_mm;
  if (a.spacer_weight_kg!=null) $('spacer_weight').value=a.spacer_weight_kg;
  $('add_corner').checked=!!a.use_corner_posts || !!a.use_corner;
  if (a.corner_post_weight_kg!=null) $('corner_weight').value=a.corner_post_weight_kg;
  $('add_film').checked=!!a.use_film;
  if (a.film_weight_kg!=null) $('film_weight').value=a.film_weight_kg;
  if (a.enabled) $('addCard').open = true;
}

function configToJSON(c){
  // export in the Python-CLI-compatible schema
  return {
    box: {name:c.box.name, length:c.box.length, width:c.box.width, height:c.box.height, weight:c.box.weight},
    pallet: {name:c.pallet.name, length:c.pallet.length, width:c.pallet.width,
             deck_height:c.pallet.deck_height, load_capacity:c.pallet.load_capacity},
    max_stack_height: c.max_stack_height,
    orientation_flags: c.orientation_flags,
    additional_elements: {
      enabled:c.additional.enabled, use_spacers:c.additional.use_spacers,
      spacer_thickness_mm:c.additional.spacer_thickness_mm, spacer_weight_kg:c.additional.spacer_weight_kg,
      use_corner_posts:c.additional.use_corner, corner_post_weight_kg:c.additional.corner_post_weight_kg,
      use_film:c.additional.use_film, film_weight_kg:c.additional.film_weight_kg,
    },
  };
}

function validate(c){
  const errs=[];
  const pos=(v,n)=>{ if(!(v>0)) errs.push(n+' must be greater than 0'); };
  pos(c.box.length,'Box length'); pos(c.box.width,'Box width'); pos(c.box.height,'Box height');
  if(!(c.box.weight>=0)) errs.push('Box weight must be ≥ 0');
  pos(c.pallet.length,'Pallet length'); pos(c.pallet.width,'Pallet width');
  if(!(c.pallet.deck_height>=0)) errs.push('Deck height must be ≥ 0');
  pos(c.pallet.load_capacity,'Load capacity');
  pos(c.max_stack_height,'Max stack height');
  if(c.max_stack_height<=c.pallet.deck_height) errs.push('Max stack height must exceed deck height');
  return errs;
}

function compute(){
  const c = readConfig();
  const errs = validate(c);
  const banner = $('banner');
  if (errs.length){
    banner.className='banner err';
    banner.textContent='Please fix: '+errs.join('; ');
    return;
  }
  banner.className='banner'; banner.textContent='';
  const res = stackLayers(c);
  RESULT = res;

  if (res.totalBoxes === 0){
    banner.className='banner warn';
    banner.textContent='No boxes could be placed with these inputs. See recommendations below.';
  }
  renderStats(res);
  renderLegend(res);
  buildTopLayerSelect(res);
  drawTop();
  drawSide();
  buildTable(res);
  renderRecs(res);
  build3D(res);
}

/* ---------------- stats ---------------- */
function fmt(n, d=0){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:d, minimumFractionDigits:d}); }

function renderStats(res){
  const perLayer = res.layers.map(l=>l.rects.length);
  const limitLabel = {height:'height-limited', weight:'weight-limited', pattern:'footprint-limited'}[res.limiting] || '—';
  const accNote = res.accessoriesWeight>0 ? ` <small>incl. ${fmt(res.accessoriesWeight,1)} film/posts</small>` : '';
  const html = [
    ['Boxes total', fmt(res.totalBoxes)],
    ['Layers', fmt(res.layers.length)],
    ['Boxes / layer', perLayer.length? `${perLayer[0]} <small>${perLayer.join('·')}</small>` : '0'],
    ['Footprint fill', fmt(res.footprintFill,1)+' <small>%</small>'],
    ['Volume fill', fmt(res.volumeFill,1)+' <small>%</small>'],
    ['Total height', fmt(res.totalHeight)+' <small>mm</small>'],
    ['Gross weight', fmt(res.grossWeight,1)+' <small>kg</small>'+accNote],
    ['Capacity used', fmt(res.weightUtil,0)+' <small>%</small>'],
    ['Limiting', `<span style="font-size:13px">${limitLabel}</span>`],
  ].map(([k,v])=>`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  $('stats').innerHTML = html;
}

/* ---------------- colours ---------------- */
function layerColor(i, n){
  const hue = n<=1 ? 205 : (i/(n)) * 300;
  return `hsl(${hue.toFixed(0)},70%,58%)`;
}
function renderLegend(res){
  const n=res.layers.length;
  if(!n){ $('legend').innerHTML='<span class="muted">No layers</span>'; return; }
  const items=res.layers.map((l,i)=>
    `<span class="sw"><span class="box" style="background:${layerColor(i,n)}"></span>L${i+1} · ${l.rects.length} · z=${fmt(l.z_start)}–${fmt(l.z_start+l.dim_z)}mm</span>`).join('');
  $('legend').innerHTML = items;
}

/* ---------------- 2D top view ---------------- */
function buildTopLayerSelect(res){
  const sel=$('topLayer'); sel.innerHTML='';
  res.layers.forEach((l,i)=>{
    const opt=document.createElement('option');
    opt.value=i; opt.textContent=`Layer ${i+1} (${l.rects.length} boxes)`;
    sel.appendChild(opt);
  });
  sel.value = res.layers.length? res.layers.length-1 : 0; // default top layer
}

function fitScale(canvas, W, H, pad){
  const sw=(canvas.width-2*pad)/W, sh=(canvas.height-2*pad)/H;
  return Math.min(sw,sh);
}

function drawTop(){
  const cv=$('canvasTop'), ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  if(!RESULT || !RESULT.layers.length){ ctx.fillStyle='#5b6a7d'; ctx.font='14px system-ui'; ctx.fillText('No layout',20,30); return; }
  const li=Math.min(parseInt($('topLayer').value)||0, RESULT.layers.length-1);
  const layer=RESULT.layers[li];
  const P=RESULT.cfg.pallet, pad=46;
  const s=fitScale(cv,P.length,P.width,pad);
  const ox=(cv.width-P.length*s)/2, oy=(cv.height-P.width*s)/2;

  // pallet outline
  ctx.fillStyle='#2a2014'; ctx.strokeStyle='#6b5331'; ctx.lineWidth=2;
  ctx.fillRect(ox,oy,P.length*s,P.width*s); ctx.strokeRect(ox,oy,P.length*s,P.width*s);

  // boxes of this layer
  const col=layerColor(li,RESULT.layers.length);
  ctx.lineWidth=1.5;
  let idBase=RESULT.placed.findIndex(b=>b.layer===layer.index)+1; // 1-based id of first box in layer
  layer.rects.forEach((r,k)=>{
    const x=ox+r[0]*s, y=oy+r[1]*s, w=r[2]*s, h=r[3]*s;
    ctx.fillStyle=col; ctx.globalAlpha=.85; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1;
    ctx.strokeStyle='#0c1118'; ctx.strokeRect(x,y,w,h);
    if(w>22 && h>16){
      ctx.fillStyle='#06121f'; ctx.font='11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(idBase+k, x+w/2, y+h/2);
    }
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  // axes labels
  ctx.fillStyle='#93a4b8'; ctx.font='12px system-ui';
  ctx.fillText('← length '+fmt(P.length)+' mm →', ox, oy-14);
  ctx.save(); ctx.translate(ox-16, oy+P.width*s/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.fillText('width '+fmt(P.width)+' mm', 0,0); ctx.restore();

  $('topInfo').textContent = `${layer.rects.length} boxes · orientation ${layer.orientation} · z = ${fmt(layer.z_start)} mm`;
}

/* ---------------- 2D side view (elevation, projects all boxes) ---------------- */
function drawSide(){
  const cv=$('canvasSide'), ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  if(!RESULT || !RESULT.layers.length){ ctx.fillStyle='#5b6a7d'; ctx.font='14px system-ui'; ctx.fillText('No layout',20,30); return; }
  const P=RESULT.cfg.pallet, axis=$('sideAxis').value;
  const baseW = axis==='length' ? P.length : P.width;
  const totalH = RESULT.cfg.max_stack_height;
  const pad=46;
  const s=fitScale(cv, baseW, totalH, pad);
  const ox=(cv.width-baseW*s)/2;
  const oy=cv.height-pad;             // floor line at bottom
  const Y = mm => oy - mm*s;          // height -> screen y

  // max-height guide
  ctx.strokeStyle='#3a2f17'; ctx.setLineDash([5,4]); ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(ox,Y(totalH)); ctx.lineTo(ox+baseW*s,Y(totalH)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='#e7a13a'; ctx.font='11px system-ui';
  ctx.fillText('max '+fmt(totalH)+' mm', ox, Y(totalH)-4);

  // pallet deck
  ctx.fillStyle='#2a2014'; ctx.strokeStyle='#6b5331'; ctx.lineWidth=2;
  ctx.fillRect(ox, Y(P.deck_height), baseW*s, P.deck_height*s);
  ctx.strokeRect(ox, Y(P.deck_height), baseW*s, P.deck_height*s);

  // boxes projected onto (base axis, height)
  const n=RESULT.layers.length;
  ctx.lineWidth=1;
  RESULT.placed.forEach(b=>{
    const along = axis==='length' ? b.x : b.y;
    const dlen  = axis==='length' ? b.dim_x : b.dim_y;
    const x=ox+along*s, w=dlen*s, h=b.dim_z*s, y=Y(b.z+b.dim_z);
    ctx.fillStyle=layerColor(b.layer,n); ctx.globalAlpha=.55; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1;
    ctx.strokeStyle='#0c1118'; ctx.strokeRect(x,y,w,h);
  });

  ctx.fillStyle='#93a4b8'; ctx.font='12px system-ui';
  ctx.fillText((axis==='length'?'length ':'width ')+fmt(baseW)+' mm', ox, oy+22);
  ctx.save(); ctx.translate(ox-18, (Y(0)+Y(totalH))/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.fillText('height (mm)', 0,0); ctx.restore(); ctx.textAlign='left';
}

/* ---------------- table ---------------- */
function buildTable(res){
  const t=$('boxTable');
  const head=`<thead><tr>
    <th>#</th><th>Layer</th><th>X</th><th>Y</th><th>Z</th>
    <th>Dim X</th><th>Dim Y</th><th>Dim Z</th><th class="l">Orientation</th><th>kg</th>
  </tr></thead>`;
  const rows=res.placed.map(b=>`<tr>
    <td>${b.box_id}</td><td>${b.layer+1}</td>
    <td>${fmt(b.x)}</td><td>${fmt(b.y)}</td><td>${fmt(b.z)}</td>
    <td>${fmt(b.dim_x)}</td><td>${fmt(b.dim_y)}</td><td>${fmt(b.dim_z)}</td>
    <td class="l">${b.orientation}</td><td>${fmt(res.cfg.box.weight,1)}</td>
  </tr>`).join('');
  t.innerHTML=head+'<tbody>'+rows+'</tbody>';
}

/* ---------------- recommendations ---------------- */
function renderRecs(res){
  const body=$('recsBody'), count=$('recsCount');
  const n=res.recommendations.length;
  count.textContent = n ? n : '';
  // stays collapsed by default — user opens it via the arrow
  if(!n){ body.textContent='No adjustments suggested — the layout looks efficient.'; return; }
  body.innerHTML='<ul>'+res.recommendations.map(r=>`<li>${r}</li>`).join('')+'</ul>';
}

/* =====================================================================
   3D VIEW  (Three.js + OrbitControls)
   ===================================================================== */
let three = null;   // {scene,camera,renderer,controls,group,raf}
const SCALE = 0.01; // mm -> scene units (1200mm -> 12)

function init3D(){
  const host=$('view3d');
  if (typeof THREE === 'undefined' || !THREE.OrbitControls){
    host.innerHTML='<div style="padding:24px;color:#e7a13a">3D library could not load '
      +'(no internet?). The 2D Top/Side views and the table still work fully.</div>';
    return false;
  }
  const w=host.clientWidth||800, h=host.clientHeight||500;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0c1118);
  const camera=new THREE.PerspectiveCamera(45, w/h, 0.1, 5000);
  const renderer=new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(w,h); host.innerHTML=''; host.appendChild(renderer.domElement);

  const controls=new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.08;

  scene.add(new THREE.AmbientLight(0xffffff,.65));
  const dir=new THREE.DirectionalLight(0xffffff,.8); dir.position.set(40,80,30); scene.add(dir);
  const dir2=new THREE.DirectionalLight(0x88aaff,.25); dir2.position.set(-30,20,-40); scene.add(dir2);

  const group=new THREE.Group(); scene.add(group);

  three={scene,camera,renderer,controls,group,host,autorot:false};
  // keep the canvas matched to its container at all times (handles late
  // layout, the recommendations panel toggling, window/sidebar resizes)
  if (window.ResizeObserver){
    new ResizeObserver(()=>resize3D()).observe(host);
  }
  function loop(){
    three.raf=requestAnimationFrame(loop);
    if(three.autorot) group.rotation.y+=0.0035;
    controls.update(); renderer.render(scene,camera);
  }
  loop();
  window.addEventListener('resize',resize3D);
  return true;
}

function resize3D(){
  if(!three) return;
  const w=three.host.clientWidth, h=three.host.clientHeight;
  if(!w||!h) return;
  three.camera.aspect=w/h; three.camera.updateProjectionMatrix(); three.renderer.setSize(w,h);
}

function build3D(res){
  if(!three){ if(!init3D()) return; }
  if(!three) return;
  const g=three.group;
  while(g.children.length) g.remove(g.children[0]);
  g.rotation.set(0,0,0);
  if(!res || !res.layers.length){ return; }

  const P=res.cfg.pallet;
  const cx=P.length/2, cz=P.width/2;   // centre the pallet on origin
  const S=SCALE;

  // pallet deck slab
  const deckGeo=new THREE.BoxGeometry(P.length*S, Math.max(P.deck_height,20)*S, P.width*S);
  const deckMat=new THREE.MeshLambertMaterial({color:0x6b5331});
  const deck=new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, P.deck_height*S/2, 0);
  g.add(deck);
  const deckEdges=new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo),
    new THREE.LineBasicMaterial({color:0x3a2c18}));
  deckEdges.position.copy(deck.position); g.add(deckEdges);

  const n=res.layers.length;
  const drawEdges = res.placed.length <= 600;
  const gap=2; // mm visual gap
  res.placed.forEach(b=>{
    const dx=Math.max(b.dim_x-gap,1), dy=Math.max(b.dim_y-gap,1), dz=Math.max(b.dim_z-gap,1);
    const geo=new THREE.BoxGeometry(dx*S, dz*S, dy*S); // note: y(up)=dim_z, z(depth)=dim_y
    const col=new THREE.Color(layerColor(b.layer,n));
    const mat=new THREE.MeshLambertMaterial({color:col});
    const m=new THREE.Mesh(geo,mat);
    m.position.set(
      (b.x + b.dim_x/2 - cx)*S,
      (b.z + b.dim_z/2)*S,
      (b.y + b.dim_y/2 - cz)*S
    );
    g.add(m);
    if(drawEdges){
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({color:0x0c1118}));
      e.position.copy(m.position); g.add(e);
    }
  });

  // ground grid
  const gridSize=Math.max(P.length,P.width)*S*1.8;
  const gh=new THREE.GridHelper(gridSize, 18, 0x2b384a, 0x1a2533);
  gh.position.y=0; g.add(gh);

  resetView3D();
}

function resetView3D(){
  if(!three || !RESULT) return;
  const P=RESULT.cfg.pallet, S=SCALE;
  const span=Math.max(P.length,P.width,RESULT.totalHeight)*S;
  const d=span*1.7;
  three.camera.position.set(d*0.9, d*0.8, d*1.0);
  three.controls.target.set(0, RESULT.totalHeight*S/2, 0);
  three.controls.update();
}

function get3DPng(){
  if(!three) return null;
  three.renderer.render(three.scene, three.camera);
  try{ return three.renderer.domElement.toDataURL('image/png'); }catch(e){ return null; }
}
function canvasPng(id){ try{ return $(id).toDataURL('image/png'); }catch(e){ return null; } }

/* =====================================================================
   TABS
   ===================================================================== */
const PANES={'3d':'pane-3d','top':'pane-top','side':'pane-side','table':'pane-table'};
function showView(v){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $('pane-3d').classList.toggle('active', v==='3d');
  $('pane-top').classList.toggle('active', v==='top');
  $('pane-side').classList.toggle('active', v==='side');
  $('pane-table').classList.toggle('active', v==='table');
  if(v==='3d') setTimeout(resize3D,30);
  if(v==='top') drawTop();
  if(v==='side') drawSide();
}

/* =====================================================================
   EXPORTS
   ===================================================================== */
function summaryRows(res){
  const c=res.cfg;
  return [
    ['Box', `${c.box.name}  ${fmt(c.box.length)}×${fmt(c.box.width)}×${fmt(c.box.height)} mm, ${fmt(c.box.weight,1)} kg`],
    ['Pallet', `${c.pallet.name}  ${fmt(c.pallet.length)}×${fmt(c.pallet.width)} mm, deck ${fmt(c.pallet.deck_height)} mm, cap ${fmt(c.pallet.load_capacity)} kg`],
    ['Max stack height (mm)', fmt(c.max_stack_height)],
    ['Boxes total', fmt(res.totalBoxes)],
    ['Layers', fmt(res.layers.length)],
    ['Boxes per layer', res.layers.map(l=>l.rects.length).join(', ')],
    ['Footprint fill (%)', fmt(res.footprintFill,1)],
    ['Volume fill (%)', fmt(res.volumeFill,1)],
    ['Total height (mm)', fmt(res.totalHeight)+`  (${fmt(res.heightUtil,0)}% of max)`],
    ['Load weight boxes+spacers (kg)', fmt(res.totalWeight,1)+`  (${fmt(res.weightUtil,0)}% of capacity)`],
    ['Accessories film+posts (kg)', fmt(res.accessoriesWeight,1)],
    ['Total gross weight (kg)', fmt(res.grossWeight,1)],
    ['Limiting factor', res.limiting],
  ];
}

function downloadBlob(blob, name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

function exportJSON(){
  const c=readConfig();
  const blob=new Blob([JSON.stringify(configToJSON(c),null,2)],{type:'application/json'});
  downloadBlob(blob,'pallet_config.json');
}

function exportXlsx(){
  if(!RESULT){ alert('Run a calculation first.'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel library not available (offline).'); return; }
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Metric','Value'],...summaryRows(RESULT)]),'Summary');
  const layerAoA=[['Layer','Boxes','z start (mm)','Dim X','Dim Y','Dim Z','Orientation','Weight (kg)'],
    ...RESULT.layers.map((l,i)=>[i+1,l.rects.length,Math.round(l.z_start),l.dim_x,l.dim_y,l.dim_z,l.orientation,Math.round(l.weight*10)/10])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(layerAoA),'Layers');
  const boxAoA=[['#','Layer','X','Y','Z','Dim X','Dim Y','Dim Z','Orientation','Weight (kg)'],
    ...RESULT.placed.map(b=>[b.box_id,b.layer+1,Math.round(b.x),Math.round(b.y),Math.round(b.z),
      b.dim_x,b.dim_y,b.dim_z,b.orientation,RESULT.cfg.box.weight])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(boxAoA),'Boxes');
  if(RESULT.recommendations.length)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Recommendations'],...RESULT.recommendations.map(r=>[r])]),'Recommendations');
  XLSX.writeFile(wb,'pallet_report.xlsx');
}

function exportPdf(){
  if(!RESULT){ alert('Run a calculation first.'); return; }
  if(!window.jspdf){ alert('PDF library not available (offline).'); return; }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const M=40, PW=doc.internal.pageSize.getWidth();
  doc.setFontSize(17); doc.text('Pallet Loading Report',M,46);
  doc.setFontSize(10); doc.setTextColor(110);
  doc.text(new Date().toLocaleString(),M,62); doc.setTextColor(0);

  doc.autoTable({startY:76, head:[['Metric','Value']], body:summaryRows(RESULT),
    styles:{fontSize:9}, headStyles:{fillColor:[40,55,75]}, margin:{left:M,right:M}});

  let y=doc.lastAutoTable.finalY+18;
  if(RESULT.recommendations.length){
    doc.setFontSize(12); doc.text('Recommendations',M,y); y+=6;
    doc.autoTable({startY:y, body:RESULT.recommendations.map((r,i)=>[`${i+1}. ${r}`]),
      styles:{fontSize:9,cellPadding:4}, theme:'plain', margin:{left:M,right:M}});
    y=doc.lastAutoTable.finalY+10;
  }

  // images
  const imgs=[['3D view',get3DPng()],['Top view',canvasPng('canvasTop')],['Side view',canvasPng('canvasSide')]];
  imgs.forEach(([label,data])=>{
    if(!data) return;
    const props=doc.getImageProperties(data);
    const w=PW-2*M, h=w*props.height/props.width;
    if(y+h+24>doc.internal.pageSize.getHeight()-M){ doc.addPage(); y=46; }
    doc.setFontSize(12); doc.text(label,M,y); y+=8;
    doc.addImage(data,'PNG',M,y,w,h); y+=h+22;
  });

  doc.addPage();
  doc.setFontSize(12); doc.text('Box coordinates',M,46);
  doc.autoTable({startY:60,
    head:[['#','Layer','X','Y','Z','Dim X','Dim Y','Dim Z','Orientation','kg']],
    body:RESULT.placed.map(b=>[b.box_id,b.layer+1,Math.round(b.x),Math.round(b.y),Math.round(b.z),
      b.dim_x,b.dim_y,b.dim_z,b.orientation,RESULT.cfg.box.weight]),
    styles:{fontSize:7.5}, headStyles:{fillColor:[40,55,75]}, margin:{left:M,right:M}});

  doc.save('pallet_report.pdf');
}

function printReport(){
  if(!RESULT){ alert('Run a calculation first.'); return; }
  const sum=summaryRows(RESULT).map(([k,v])=>`<tr><td class="l">${k}</td><td>${v}</td></tr>`).join('');
  const recs=RESULT.recommendations.length
    ? '<h2>Recommendations</h2><ul>'+RESULT.recommendations.map(r=>`<li>${r}</li>`).join('')+'</ul>' : '';
  const img=(label,data)=> data?`<h2>${label}</h2><img src="${data}"/>`:'';
  const boxRows=RESULT.placed.map(b=>`<tr><td>${b.box_id}</td><td>${b.layer+1}</td>
    <td>${Math.round(b.x)}</td><td>${Math.round(b.y)}</td><td>${Math.round(b.z)}</td>
    <td>${b.dim_x}</td><td>${b.dim_y}</td><td>${b.dim_z}</td><td class="l">${b.orientation}</td>
    <td>${RESULT.cfg.box.weight}</td></tr>`).join('');
  $('printArea').innerHTML=`
    <h1>Pallet Loading Report</h1>
    <div style="color:#555">${new Date().toLocaleString()}</div>
    <h2>Summary</h2><table>${sum}</table>
    ${recs}
    ${img('3D view',get3DPng())}
    ${img('Top view',canvasPng('canvasTop'))}
    ${img('Side view',canvasPng('canvasSide'))}
    <h2>Box coordinates</h2>
    <table><thead><tr><th>#</th><th>Layer</th><th>X</th><th>Y</th><th>Z</th>
      <th>Dim X</th><th>Dim Y</th><th>Dim Z</th><th class="l">Orientation</th><th>kg</th></tr></thead>
      <tbody>${boxRows}</tbody></table>`;
  window.print();
}

/* =====================================================================
   WIRING
   ===================================================================== */
const EXAMPLE={
  box:{name:'Carton A',length:400,width:300,height:250,weight:8.5},
  pallet:{name:'EUR pallet (1200x800)',length:1200,width:800,deck_height:150,load_capacity:700},
  max_stack_height:1800,
  orientation_flags:{allow_rotate_x:false,allow_rotate_y:false,allow_rotate_z:true},
  additional_elements:{enabled:true,use_spacers:true,spacer_thickness_mm:5,spacer_weight_kg:0.3,
    use_corner_posts:false,corner_post_weight_kg:0,use_film:true,film_weight_kg:1.2},
};

function wire(){
  $('btnCompute').onclick=compute;
  $('btnCompute2').onclick=compute;
  $('btnExample').onclick=()=>{ applyConfig(EXAMPLE); compute(); };
  $('btnSave').onclick=exportJSON;
  $('btnLoad').onclick=()=>$('fileInput').click();
  $('fileInput').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ applyConfig(JSON.parse(rd.result)); compute(); }
      catch(err){ alert('Could not read JSON: '+err.message); } };
    rd.readAsText(f); e.target.value='';
  };
  $('tabs').addEventListener('click',e=>{ if(e.target.dataset.view) showView(e.target.dataset.view); });
  $('topLayer').onchange=drawTop;
  $('sideAxis').onchange=drawSide;
  $('btnReset').onclick=resetView3D;
  $('btnAutorot').onclick=()=>{ if(three){ three.autorot=!three.autorot;
    $('btnAutorot').style.borderColor=three.autorot?'#36c08a':''; } };
  $('btnPdf').onclick=exportPdf;
  $('btnXlsx').onclick=exportXlsx;
  $('btnPrint').onclick=printReport;

  // library availability hint
  const missing=[];
  if(typeof THREE==='undefined'||!THREE.OrbitControls) missing.push('3D (Three.js)');
  if(typeof XLSX==='undefined') missing.push('Excel');
  if(!window.jspdf) missing.push('PDF');
  if(missing.length){
    const w=$('libwarn'); w.style.display='block';
    w.textContent='Offline: '+missing.join(', ')+' unavailable. Top/Side views, table and Print still work.';
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  wire();
  compute();          // show the example result immediately
  showView('3d');
});
