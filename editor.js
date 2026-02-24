if (!localStorage.getItem('canvas_visited')) {
  window.location.replace('index.html');
}
// ═══════════════════════════════════════════════════════════════
//  CANVAS DESIGN ENGINE — editor.js
// ═══════════════════════════════════════════════════════════════

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const area    = document.getElementById('canvas-area');
let aspectLocked   = false;
let aspectRatio    = null;

// ── Engine State ───────────────────────────────────────────────
let elements    = [];
let selected    = null;
let camera      = { x: 0, y: 0, scale: 1 };
let currentTool = 'select';
let undoStack   = [];
let redoStack   = [];
let showGrid    = true;
let idCounter   = 1;


// ── Font Registry ──────────────────────────────────────────────
const BUILTIN_FONTS = [
  'DM Sans',
  'DM Mono',
  'Georgia',
  'Arial',
  'Playfair Display',
  'Bebas Neue',
  'Lobster',
  'Oswald',
  'Raleway'
];

let importedFonts = []; // { name, url } added by user at runtime


// ── Project Storage ────────────────────────────────────────────
const STORAGE_KEY = 'canvas_projects';
let   currentProjectId = null;

// Drawing
let drawing          = false;
let drawPreviewState = null;

// Drag
let dragging   = false;
let dragOffset = null;

// Resize / Rotate
let resizing     = false;
let resizeHandle = null;
let resizeStart  = null;

// Pan
let panning  = false;
let panStart = null;

// Pinch
let activePointers = {};
let pinchDist      = 0;

// ── Canvas Resize ──────────────────────────────────────────────
function resizeCanvas() {
  const r = area.getBoundingClientRect();
  canvas.width  = r.width;
  canvas.height = r.height;
}

resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
});

// ── Coord Conversion ───────────────────────────────────────────
function screenToWorld(sx, sy) {
  return {
    x: (sx - camera.x) / camera.scale,
    y: (sy - camera.y) / camera.scale
  };
}

function getCanvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ── Element Factory ────────────────────────────────────────────
const PALETTE = ['#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function createElement(type, x, y, w, h) {
  const color = PALETTE[idCounter % PALETTE.length];
  const el = {
    id: idCounter++,
    type,
    x, y, w, h,
    rotation:    0,
    fillColor:   color,
    fillOpacity: 100,
    strokeColor: '#1a1917',
    strokeWidth: 0,
    strokeStyle: 'solid',
    radius:      0,
    visible:     true
  };

  if (type === 'text') {
    el.fillColor   = '#1a1917';
    el.text        = 'Text';
    el.fontSize    = 20;
    el.fontWeight  = '400';
    el.fontFamily  = 'DM Sans';
    el.textAlign   = 'left';
    el.w = 160;
    el.h = 30;
  }
  if (type === 'line') {
    el.strokeWidth = 2;
    el.strokeColor = color;
    el.fillColor   = color;
  }
  return el;
}

// ── Hit Detection ──────────────────────────────────────────────
function hitTest(wx, wy) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.visible) continue;

    const hw = el.w / 2, hh = el.h / 2;
    const cx = el.x + hw, cy = el.y + hh;
    const dx = wx - cx, dy = wy - cy;
    const cos = Math.cos(-el.rotation), sin = Math.sin(-el.rotation);
    const lx  = dx * cos - dy * sin + hw;
    const ly  = dx * sin + dy * cos + hh;

    if (el.type === 'ellipse') {
      const rx = el.w / 2, ry = el.h / 2;
      if (((lx - rx) / rx) ** 2 + ((ly - ry) / ry) ** 2 <= 1) return el;
    } else if (el.type === 'line') {
      const tol = Math.max(8, (el.strokeWidth + 4));
      if (lx >= -tol && lx <= el.w + tol && Math.abs(ly - el.h / 2) <= tol) return el;
    } else {
      if (lx >= 0 && lx <= el.w && ly >= 0 && ly <= el.h) return el;
    }
  }
  return null;
}

// ── Handle System ──────────────────────────────────────────────
const HANDLES  = ['nw','n','ne','e','se','s','sw','w'];
const HANDLE_S = 8;

function getHandlePos(el, handle) {
  const hw = el.w / 2, hh = el.h / 2;
  const cx = el.x + hw, cy = el.y + hh;
  const map = {
    nw: [-hw,-hh], n:[0,-hh], ne:[hw,-hh],
    e:[hw,0], se:[hw,hh], s:[0,hh], sw:[-hw,hh], w:[-hw,0]
  };
  const [rx, ry] = map[handle];
  const cos = Math.cos(el.rotation), sin = Math.sin(el.rotation);
  return {
    x: cx + rx * cos - ry * sin,
    y: cy + rx * sin + ry * cos
  };
}

function hitHandle(el, wx, wy) {
  const r = (HANDLE_S / 2 + 4) / camera.scale;
  for (const h of HANDLES) {
    const p = getHandlePos(el, h);
    if (Math.hypot(wx - p.x, wy - p.y) <= r) return h;
  }
  return null;
}

function getRotationHandlePos(el) {
  const np = getHandlePos(el, 'n');
  const dist = 20 / camera.scale;
  const cos = Math.cos(el.rotation), sin = Math.sin(el.rotation);
  return { x: np.x - sin * dist, y: np.y - cos * dist };
}

// ── Render Loop ────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.scale, camera.scale);

  if (showGrid) drawGrid();

  elements.forEach(el => {
    if (!el.visible) return;
    drawElement(ctx, el);
  });

  if (selected) drawSelection(selected);
  if (drawing && drawPreviewState) drawPreview();

  ctx.restore();
  requestAnimationFrame(render);
}

function drawElement(c, el) {
  c.save();
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  c.translate(cx, cy);
  c.rotate(el.rotation);
  c.translate(-el.w / 2, -el.h / 2);
  c.globalAlpha = el.fillOpacity / 100;

  switch (el.type) {
    case 'rect':
      c.fillStyle = el.fillColor;
      if (el.radius > 0) { roundRect(c, 0, 0, el.w, el.h, el.radius); c.fill(); }
      else c.fillRect(0, 0, el.w, el.h);
      if (el.strokeWidth > 0) {
        c.strokeStyle = el.strokeColor;
        c.lineWidth   = el.strokeWidth;
        applyDash(c, el);
        if (el.radius > 0) { roundRect(c, 0, 0, el.w, el.h, el.radius); c.stroke(); }
        else c.strokeRect(0, 0, el.w, el.h);
        c.setLineDash([]);
      }
      break;

    case 'ellipse':
      c.fillStyle = el.fillColor;
      c.beginPath();
      c.ellipse(el.w/2, el.h/2, el.w/2, el.h/2, 0, 0, Math.PI * 2);
      c.fill();
      if (el.strokeWidth > 0) {
        c.strokeStyle = el.strokeColor;
        c.lineWidth   = el.strokeWidth;
        applyDash(c, el);
        c.beginPath();
        c.ellipse(el.w/2, el.h/2, el.w/2, el.h/2, 0, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
      break;

    case 'triangle':
      c.fillStyle = el.fillColor;
      c.beginPath();
      c.moveTo(el.w/2, 0);
      c.lineTo(el.w, el.h);
      c.lineTo(0, el.h);
      c.closePath();
      c.fill();
      if (el.strokeWidth > 0) {
        c.strokeStyle = el.strokeColor;
        c.lineWidth   = el.strokeWidth;
        applyDash(c, el);
        c.stroke();
        c.setLineDash([]);
      }
      break;

    case 'line':
      c.strokeStyle = el.fillColor;
      c.lineWidth   = el.strokeWidth || 2;
      c.lineCap     = 'round';
      applyDash(c, el);
      c.beginPath();
      c.moveTo(0, el.h / 2);
      c.lineTo(el.w, el.h / 2);
      c.stroke();
      c.setLineDash([]);
      break;

    case 'text':
      c.fillStyle    = el.fillColor;
      c.font         = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
      c.textAlign    = el.textAlign;
      c.textBaseline = 'middle';
      const tx = el.textAlign === 'center' ? el.w/2 : el.textAlign === 'right' ? el.w : 0;
      c.fillText(el.text, tx, el.h / 2);
      break;

    case 'image':
      if (el._img) {
        c.drawImage(el._img, 0, 0, el.w, el.h);
        if (el.strokeWidth > 0) {
          c.strokeStyle = el.strokeColor;
          c.lineWidth   = el.strokeWidth;
          c.strokeRect(0, 0, el.w, el.h);
        }
      }
      break;
  }

  c.globalAlpha = 1;
  c.restore();
}

function applyDash(c, el) {
  if (el.strokeStyle === 'dashed') c.setLineDash([el.strokeWidth * 4, el.strokeWidth * 3]);
  else if (el.strokeStyle === 'dotted') c.setLineDash([el.strokeWidth, el.strokeWidth * 2]);
  else c.setLineDash([]);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawGrid() {
  const step   = 24;
  const left   = -camera.x / camera.scale;
  const top    = -camera.y / camera.scale;
  const right  = left + canvas.width / camera.scale;
  const bottom = top  + canvas.height / camera.scale;

  ctx.strokeStyle = '#dedad4';
  ctx.lineWidth   = 0.5 / camera.scale;
  ctx.setLineDash([]);

  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }

  // Origin marker
  ctx.strokeStyle = '#c4c0b8';
  ctx.lineWidth   = 1 / camera.scale;
  const arm = 12 / camera.scale;
  ctx.beginPath(); ctx.moveTo(-arm, 0); ctx.lineTo(arm, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -arm); ctx.lineTo(0, arm); ctx.stroke();
}

function drawSelection(el) {
  ctx.save();
  const cx = el.x + el.w/2, cy = el.y + el.h/2;
  ctx.translate(cx, cy);
  ctx.rotate(el.rotation);
  ctx.translate(-el.w/2, -el.h/2);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth   = 1.5 / camera.scale;
  ctx.setLineDash([]);
  const pad = 1 / camera.scale;
  ctx.strokeRect(-pad, -pad, el.w + pad*2, el.h + pad*2);
  ctx.restore();

  // Handles
  const hs = HANDLE_S / camera.scale;
  HANDLES.forEach(h => {
    const p = getHandlePos(el, h);
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth   = 1.5 / camera.scale;
    ctx.fillRect(p.x - hs/2, p.y - hs/2, hs, hs);
    ctx.strokeRect(p.x - hs/2, p.y - hs/2, hs, hs);
  });

  // Rotation handle
  const np = getHandlePos(el, 'n');
  const rp = getRotationHandlePos(el);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth   = 1 / camera.scale;
  ctx.beginPath(); ctx.moveTo(np.x, np.y); ctx.lineTo(rp.x, rp.y); ctx.stroke();
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(rp.x, rp.y, 5 / camera.scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPreview() {
  const { type, sx, sy, current } = drawPreviewState;
  const dx = current.x - sx, dy = current.y - sy;
  if (!dx || !dy) return;

  const rx = Math.min(sx, current.x);
  const ry = Math.min(sy, current.y);
  const rw = Math.abs(dx);
  const rh = Math.abs(dy);

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.fillStyle   = 'rgba(99,102,241,0.12)';
  ctx.lineWidth   = 1.5 / camera.scale;
  ctx.setLineDash([5 / camera.scale, 4 / camera.scale]);

  if (type === 'rect') {
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(rx + rw/2, ry + rh/2, rw/2, rh/2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(rx + rw/2, ry);
    ctx.lineTo(rx + rw, ry + rh);
    ctx.lineTo(rx, ry + rh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'line') {
    ctx.setLineDash([]);
    ctx.strokeStyle = PALETTE[idCounter % PALETTE.length];
    ctx.lineWidth   = 2 / camera.scale;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ── Pointer Events ─────────────────────────────────────────────
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };

  if (Object.keys(activePointers).length === 2) {
    panning  = false;
    dragging = false;
    resizing = false;
    return;
  }

  const sp = getCanvasPos(e);
  const wp = screenToWorld(sp.x, sp.y);

  if (currentTool === 'hand') {
    panning  = true;
    panStart = { mx: e.clientX, my: e.clientY, cx: camera.x, cy: camera.y };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (currentTool === 'select') {
    if (selected) {
      // Resize handles
      const h = hitHandle(selected, wp.x, wp.y);
      if (h) {
        resizing     = true;
        resizeHandle = h;
        resizeStart  = {
          x: wp.x, y: wp.y,
          ex: selected.x, ey: selected.y,
          ew: selected.w, eh: selected.h
        };
        saveUndo();
        return;
      }

      // Rotation handle
      const rp = getRotationHandlePos(selected);
      if (Math.hypot(wp.x - rp.x, wp.y - rp.y) <= 10 / camera.scale) {
        resizing    = 'rotate';
        resizeStart = { rot: selected.rotation };
        const cx = selected.x + selected.w/2, cy = selected.y + selected.h/2;
        resizeStart.cx = cx; resizeStart.cy = cy;
        saveUndo();
        return;
      }
    }

    const hit = hitTest(wp.x, wp.y);
    if (hit) {
      selected    = hit;
      dragging    = true;
      dragOffset  = { x: wp.x - hit.x, y: wp.y - hit.y };
      saveUndo();
      updatePanel();
    } else {
      selected = null;
      updatePanel();
    }
    return;
  }

  // Drawing tools
  if (['rect','ellipse','line','triangle'].includes(currentTool)) {
    drawing          = true;
    drawPreviewState = { type: currentTool, sx: wp.x, sy: wp.y, current: { ...wp } };
    return;
  }

  if (currentTool === 'text') {
    openTextDialog(null, wp.x, wp.y);
    return;
  }
});

canvas.addEventListener('pointermove', e => {
  activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };

  // Pinch zoom
  const ptrs = Object.values(activePointers);
  if (ptrs.length === 2) {
    const d = Math.hypot(ptrs[0].x - ptrs[1].x, ptrs[0].y - ptrs[1].y);
    if (pinchDist) {
      const factor = d / pinchDist;
      const mx = (ptrs[0].x + ptrs[1].x) / 2;
      const my = (ptrs[0].y + ptrs[1].y) / 2;
      const r = canvas.getBoundingClientRect();
      zoomAt(mx - r.left, my - r.top, factor);
    }
    pinchDist = d;
    return;
  }

  const sp = getCanvasPos(e);
  const wp = screenToWorld(sp.x, sp.y);

  document.getElementById('status-cursor').textContent = `x: ${Math.round(wp.x)}  y: ${Math.round(wp.y)}`;

  if (panning) {
    camera.x = panStart.cx + (e.clientX - panStart.mx);
    camera.y = panStart.cy + (e.clientY - panStart.my);
    return;
  }

  if (resizing === 'rotate' && selected) {
    const angle = Math.atan2(wp.y - resizeStart.cy, wp.x - resizeStart.cx) + Math.PI / 2;
    selected.rotation = angle;
    updatePanel();
    return;
  }

  if (resizing && selected && resizeStart) {
    const dx = wp.x - resizeStart.x;
    const dy = wp.y - resizeStart.y;
    const h  = resizeHandle;
    const { ex, ey, ew, eh } = resizeStart;
    if (h.includes('e')) selected.w = Math.max(8, ew + dx);
    if (h.includes('s')) selected.h = Math.max(8, eh + dy);
    if (h.includes('w')) { selected.x = ex + dx; selected.w = Math.max(8, ew - dx); }
    if (h.includes('n')) { selected.y = ey + dy; selected.h = Math.max(8, eh - dy); }
    updatePanel();
    return;
  }

  if (dragging && selected) {
    selected.x = wp.x - dragOffset.x;
    selected.y = wp.y - dragOffset.y;
    updatePanel();
    return;
  }

  if (drawing && drawPreviewState) {
    drawPreviewState.current = { ...wp };
    return;
  }

  // Cursor
  updateCursor(wp);
});

canvas.addEventListener('pointerup', e => {
  delete activePointers[e.pointerId];
  pinchDist = 0;

  if (drawing && drawPreviewState) {
    const { sx, sy, current, type } = drawPreviewState;
    const MIN = 4 / camera.scale;

    if (type === 'line') {
      const dx = current.x - sx, dy = current.y - sy;
      if (Math.hypot(dx, dy) > MIN) {
        const el = createElement('line',
          Math.min(sx, current.x), Math.min(sy, current.y),
          Math.abs(dx), Math.abs(dy)
        );
        elements.push(el);
        selected = el;
        saveUndo();
        updatePanel();
      }
    } else {
      const dx = current.x - sx, dy = current.y - sy;
      if (Math.abs(dx) > MIN && Math.abs(dy) > MIN) {
        const el = createElement(type,
          Math.min(sx, current.x), Math.min(sy, current.y),
          Math.abs(dx), Math.abs(dy)
        );
        elements.push(el);
        selected = el;
        saveUndo();
        updatePanel();
      }
    }

    drawing          = false;
    drawPreviewState = null;
    setTool('select');
    return;
  }

  if (panning) canvas.style.cursor = 'grab';
  panning      = false;
  dragging     = false;
  resizing     = false;
  resizeHandle = null;
  resizeStart  = null;
});

// ── Wheel Zoom ─────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const sp     = getCanvasPos(e);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomAt(sp.x, sp.y, factor);
}, { passive: false });

function zoomAt(sx, sy, factor) {
  const prev   = camera.scale;
  camera.scale = Math.max(0.04, Math.min(40, camera.scale * factor));
  camera.x     = sx - (sx - camera.x) * (camera.scale / prev);
  camera.y     = sy - (sy - camera.y) * (camera.scale / prev);
  document.getElementById('zoom-label').textContent = Math.round(camera.scale * 100) + '%';
}

// ── Cursor Logic ───────────────────────────────────────────────
function updateCursor(wp) {
  if (currentTool === 'hand') { canvas.style.cursor = 'grab'; return; }
  if (['rect','ellipse','line','triangle','text'].includes(currentTool)) {
    canvas.style.cursor = 'crosshair'; return;
  }
  if (currentTool === 'select' && selected) {
    const h = hitHandle(selected, wp.x, wp.y);
    const cursors = {
      nw:'nw-resize', n:'n-resize', ne:'ne-resize',
      e:'e-resize',  se:'se-resize', s:'s-resize',
      sw:'sw-resize', w:'w-resize'
    };
    if (h) { canvas.style.cursor = cursors[h]; return; }
    const rp = getRotationHandlePos(selected);
    if (Math.hypot(wp.x - rp.x, wp.y - rp.y) <= 10 / camera.scale) {
      canvas.style.cursor = 'grab'; return;
    }
    canvas.style.cursor = hitTest(wp.x, wp.y) ? 'move' : 'default';
    return;
  }
  canvas.style.cursor = 'default';
}

// ── Context Menu ───────────────────────────────────────────────
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const sp  = getCanvasPos(e);
  const wp  = screenToWorld(sp.x, sp.y);
  const hit = hitTest(wp.x, wp.y);
  if (hit) { selected = hit; updatePanel(); }

  if (selected) {
    const m = document.getElementById('ctx-menu');
    m.style.left    = e.clientX + 'px';
    m.style.top     = e.clientY + 'px';
    m.style.display = 'block';
  }
});

document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#ctx-menu')) hideCtxMenu();
});

function hideCtxMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
}


document.getElementById('ctx-front').addEventListener('click', () => {
  if (!selected) return;
  const i = elements.indexOf(selected);
  if (i < elements.length - 1) { elements.splice(i, 1); elements.push(selected); }
  updateLayers(); hideCtxMenu();
});

document.getElementById('ctx-back').addEventListener('click', () => {
  if (!selected) return;
  const i = elements.indexOf(selected);
  if (i > 0) { elements.splice(i, 1); elements.unshift(selected); }
  updateLayers(); hideCtxMenu();
});

document.getElementById('ctx-duplicate').addEventListener('click', () => {
  duplicateSelected(); hideCtxMenu();
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  deleteSelected(); hideCtxMenu();
});

// ── Double-click (text edit) ───────────────────────────────────
canvas.addEventListener('dblclick', e => {
  const sp  = getCanvasPos(e);
  const wp  = screenToWorld(sp.x, sp.y);
  const hit = hitTest(wp.x, wp.y);
  if (hit && hit.type === 'text') {
    selected = hit;
    updatePanel();
    openTextDialog(hit);
  }
});

// ── Keyboard ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.key === 'Delete' || e.key === 'Backspace')     deleteSelected();
  if (e.key === 'v' || e.key === 'V')                  setTool('select');
  if (e.key === 'h' || e.key === 'H')                  setTool('hand');
  if (e.key === 'r' || e.key === 'R')                  setTool('rect');
  if (e.key === 'e' || e.key === 'E')                  setTool('ellipse');
  if (e.key === 'l' || e.key === 'L')                  setTool('line');
  if (e.key === 't' || e.key === 'T')                  setTool('text');
  if (e.key === 'i' || e.key === 'I')                  document.getElementById('image-input').click();
  if (e.key === 'Escape')                              { selected = null; setTool('select'); updatePanel(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z')      { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd')      { e.preventDefault(); duplicateSelected(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomIn(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '-')      { e.preventDefault(); zoomOut(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '0')      { e.preventDefault(); resetZoom(); }
  if (e.key === ']' && selected)                       ctxFront();
  if (e.key === '[' && selected)                       ctxBack();

  // Arrow nudge
  if (selected) {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); selected.x -= step; updatePanel(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); selected.x += step; updatePanel(); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); selected.y -= step; updatePanel(); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); selected.y += step; updatePanel(); }
  }
});

function ctxFront() {
  if (!selected) return;
  const i = elements.indexOf(selected);
  if (i < elements.length - 1) { elements.splice(i, 1); elements.push(selected); }
  updateLayers();
}
function ctxBack() {
  if (!selected) return;
  const i = elements.indexOf(selected);
  if (i > 0) { elements.splice(i, 1); elements.unshift(selected); }
  updateLayers();
}

// ── Tool System ────────────────────────────────────────────────
function setTool(t) {
  currentTool = t;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tool-' + t);
  if (btn) btn.classList.add('active');
  document.getElementById('status-tool').textContent = t.charAt(0).toUpperCase() + t.slice(1);

  if (t === 'hand') canvas.style.cursor = 'grab';
  else if (['rect','ellipse','line','triangle','text'].includes(t)) canvas.style.cursor = 'crosshair';
  else canvas.style.cursor = 'default';
}

// Toolbar buttons
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'image') {
      document.getElementById('image-input').click();
    } else {
      setTool(tool);
    }
  });
});

document.getElementById('tool-delete').addEventListener('click', deleteSelected);

// ── Operations ─────────────────────────────────────────────────
function deleteSelected() {
  if (!selected) return;
  saveUndo();
  elements = elements.filter(e => e !== selected);
  selected = null;
  updatePanel();
}

function duplicateSelected() {
  if (!selected) return;
  saveUndo();
  const copy = JSON.parse(JSON.stringify(selected));
  copy.id  = idCounter++;
  copy.x  += 16;
  copy.y  += 16;
  if (selected._img) copy._img = selected._img;
  elements.push(copy);
  selected = copy;
  updatePanel();
}

// ── Undo / Redo ────────────────────────────────────────────────
function serializeState() {
  return JSON.stringify({
    els: elements.map(e => { const c = { ...e }; delete c._img; return c; }),
    sid: selected?.id
  });
}

function saveUndo() {
  undoStack.push(serializeState());
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
}

function restoreFromSerial(serial) {
  const s = JSON.parse(serial);
  elements = s.els.map(e => {
    if (e.type === 'image' && e._imgSrc) {
      const img = new Image();
      img.src = e._imgSrc;
      e._img = img;
    }
    return e;
  });
  selected = elements.find(e => e.id === s.sid) || null;
  updatePanel();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(serializeState());
  restoreFromSerial(undoStack.pop());
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(serializeState());
  restoreFromSerial(redoStack.pop());
}

// ── Zoom Controls ──────────────────────────────────────────────
function zoomIn()  { zoomAt(canvas.width/2, canvas.height/2, 1.25); }
function zoomOut() { zoomAt(canvas.width/2, canvas.height/2, 0.8); }

function resetZoom() {
  camera.scale = 1;
  camera.x     = canvas.width / 4;
  camera.y     = canvas.height / 4;
  document.getElementById('zoom-label').textContent = '100%';
}

function fitAll() {
  if (!elements.length) { resetZoom(); return; }
  const xs = elements.flatMap(e => [e.x, e.x + e.w]);
  const ys = elements.flatMap(e => [e.y, e.y + e.h]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const mw = Math.max(...xs) - mx, mh = Math.max(...ys) - my;
  const pad = 80;
  camera.scale = Math.min((canvas.width - pad*2) / mw, (canvas.height - pad*2) / mh, 4);
  camera.x     = pad - mx * camera.scale;
  camera.y     = pad - my * camera.scale;
  document.getElementById('zoom-label').textContent = Math.round(camera.scale * 100) + '%';
}

// ── Image Upload ───────────────────────────────────────────────
document.getElementById('image-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img   = new Image();
    img.onload  = () => {
      const aspect = img.width / img.height;
      const w      = Math.min(400, img.width);
      const h      = w / aspect;
      const wp     = screenToWorld(canvas.width/2, canvas.height/2);
      const el     = createElement('image', wp.x - w/2, wp.y - h/2, w, h);
      el._img      = img;
      elements.push(el);
      selected = el;
      saveUndo();
      updatePanel();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

// ── Dialogs ────────────────────────────────────────────────────
// NEW FILE
document.getElementById('btn-new').addEventListener('click', () => {
  document.getElementById('new-dialog').classList.remove('hidden');
});
document.getElementById('new-close').addEventListener('click', () => {
  document.getElementById('new-dialog').classList.add('hidden');
});
document.getElementById('new-cancel').addEventListener('click', () => {
  document.getElementById('new-dialog').classList.add('hidden');
});
document.getElementById('new-confirm').addEventListener('click', () => {
  elements = []; selected = null;
  camera   = { x: 0, y: 0, scale: 1 };
  undoStack = []; redoStack = [];
  currentProjectId = null;
  updatePanel();
  document.getElementById('new-dialog').classList.add('hidden');
});

// EXPORT
function openExportDialog() {
  document.getElementById('export-dialog').classList.remove('hidden');
}
document.getElementById('btn-export-open').addEventListener('click',  openExportDialog);
document.getElementById('btn-export-open2').addEventListener('click', openExportDialog);
document.getElementById('export-close').addEventListener('click',  () => document.getElementById('export-dialog').classList.add('hidden'));
document.getElementById('export-cancel').addEventListener('click', () => document.getElementById('export-dialog').classList.add('hidden'));

document.getElementById('export-confirm').addEventListener('click', () => {
  const fmt   = document.getElementById('export-format').value;
  const scale = parseFloat(document.getElementById('export-scale').value);
  const bg    = document.getElementById('export-bg').value;
  doExport(fmt, scale, bg);
  document.getElementById('export-dialog').classList.add('hidden');
});

// TEXT DIALOG
let textDialogTarget = null;
let textDialogPos    = null;

function openTextDialog(el, wx, wy) {
  textDialogTarget = el;
  textDialogPos    = el ? null : { x: wx, y: wy };
  const input = document.getElementById('text-dialog-input');
  input.value = el ? el.text : '';
  document.getElementById('text-dialog').classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

document.getElementById('text-dialog-close').addEventListener('click',  () => document.getElementById('text-dialog').classList.add('hidden'));
document.getElementById('text-dialog-cancel').addEventListener('click', () => document.getElementById('text-dialog').classList.add('hidden'));
document.getElementById('text-dialog-confirm').addEventListener('click', () => {
  const val = document.getElementById('text-dialog-input').value.trim();
  if (!val) { document.getElementById('text-dialog').classList.add('hidden'); return; }

  if (textDialogTarget) {
    textDialogTarget.text = val;
    remeasureText(textDialogTarget);
  } else if (textDialogPos) {
    const el = createElement('text', textDialogPos.x, textDialogPos.y, 160, 30);
    el.text  = val;
    remeasureText(el);
    elements.push(el);
    selected = el;
    saveUndo();
    updatePanel();
    setTool('select');
  }
  document.getElementById('text-dialog').classList.add('hidden');
});

document.getElementById('text-dialog-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('text-dialog-confirm').click();
});

// Close dialogs on backdrop click
['export-dialog','new-dialog','text-dialog'].forEach(id => {
  document.getElementById(id).addEventListener('pointerdown', e => {
    if (e.target === document.getElementById(id)) {
      document.getElementById(id).classList.add('hidden');
    }
  });
});

function remeasureText(el) {
  ctx.font = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
  el.w     = Math.max(60, ctx.measureText(el.text).width + 16);
  el.h     = el.fontSize * 1.5;
}

// ── Export Engine ──────────────────────────────────────────────
function doExport(fmt, scale, bg) {
  if (!elements.length) { alert('Nothing to export.'); return; }

  const xs = elements.flatMap(e => [e.x, e.x + e.w]);
  const ys = elements.flatMap(e => [e.y, e.y + e.h]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const mw = Math.max(...xs) - mx, mh = Math.max(...ys) - my;
  const pad = 40;

  const tmp  = document.createElement('canvas');
  tmp.width  = (mw + pad*2) * scale;
  tmp.height = (mh + pad*2) * scale;
  const tc   = tmp.getContext('2d');

  if (bg === 'white') {
    tc.fillStyle = '#ffffff';
    tc.fillRect(0, 0, tmp.width, tmp.height);
  }

  tc.save();
  tc.scale(scale, scale);
  tc.translate(pad - mx, pad - my);

  elements.forEach(el => {
    if (!el.visible) return;
    drawElement(tc, el);
  });

  tc.restore();

  const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
  const link = document.createElement('a');
  link.download = `canvas-export.${fmt}`;
  link.href     = tmp.toDataURL(mime, 0.95);
  link.click();
}

// ── Panel Controls ─────────────────────────────────────────────
// Section toggles
document.querySelectorAll('.sec-header').forEach(header => {
  header.addEventListener('click', () => {
    const name  = header.dataset.section;
    const body  = document.getElementById('body-' + name);
    const arrow = header.querySelector('.sec-arrow');
    const open  = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    arrow.classList.toggle('closed', open);
  });
});

// Topbar button wiring
document.getElementById('btn-undo').addEventListener('click',     undo);
document.getElementById('btn-redo').addEventListener('click',     redo);
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
document.getElementById('btn-zoom-in').addEventListener('click',  zoomIn);
document.getElementById('zoom-label').addEventListener('click',   resetZoom);
document.getElementById('btn-fit').addEventListener('click',      fitAll);
document.getElementById('btn-grid').addEventListener('click', () => {
  showGrid = !showGrid;
  document.getElementById('btn-grid').classList.toggle('active', showGrid);
});

// Mobile panel toggle
const panelEl    = document.getElementById('panel');
const overlayEl  = document.getElementById('mobile-overlay');
document.getElementById('btn-panel-toggle').addEventListener('click', () => {
  panelEl.classList.toggle('panel-open');
  overlayEl.classList.toggle('active');
});
overlayEl.addEventListener('click', () => {
  panelEl.classList.remove('panel-open');
  overlayEl.classList.remove('active');
});

// ── Panel Prop Inputs ──────────────────────────────────────────
function bindPropInput(id, apply) {
  document.getElementById(id).addEventListener('change', apply);
}

function applyDesignProps() {
  if (!selected) return;
  
  const newX = parseFloat(document.getElementById('prop-x').value);
  const newY = parseFloat(document.getElementById('prop-y').value);
  let newW = parseFloat(document.getElementById('prop-w').value);
  let newH = parseFloat(document.getElementById('prop-h').value);
  const minW = parseFloat(document.getElementById('prop-minw').value) || 0;
  const minH = parseFloat(document.getElementById('prop-minh').value) || 0;
  const maxW = parseFloat(document.getElementById('prop-maxw').value) || Infinity;
  const maxH = parseFloat(document.getElementById('prop-maxh').value) || Infinity;
  
  // Aspect constraint
  const aspect = document.getElementById('prop-aspect').value;
  if (aspect === 'lock' && aspectRatio) {
    newH = newW / aspectRatio;
  } else if (aspect === '1:1') {
    newH = newW;
  } else if (aspect === '16:9') {
    newH = newW * (9 / 16);
  } else if (aspect === '4:3') {
    newH = newW * (3 / 4);
  } else if (aspect === '3:2') {
    newH = newW * (2 / 3);
  } else if (aspect === '9:16') {
    newH = newW * (16 / 9);
  }
  
  // Clamp to min/max
  newW = Math.max(minW || 1, Math.min(maxW, newW || selected.w));
  newH = Math.max(minH || 1, Math.min(maxH, newH || selected.h));
  
  if (!isNaN(newX)) selected.x = newX;
  if (!isNaN(newY)) selected.y = newY;
  selected.w = newW;
  selected.h = newH;
  selected.rotation = (parseFloat(document.getElementById('prop-rot').value) || 0) * Math.PI / 180;
  selected.radius = parseFloat(document.getElementById('prop-radius').value) || 0;
  
  updatePreview();
}

['prop-x','prop-y','prop-w','prop-h','prop-rot','prop-radius'].forEach(id => {
  bindPropInput(id, applyDesignProps);
});

document.getElementById('prop-scale').addEventListener('change', () => {
  if (!selected) return;
  if (!selected._origW) { selected._origW = selected.w; selected._origH = selected.h; }
  const pct = parseFloat(document.getElementById('prop-scale').value) / 100 || 1;
  selected.w = selected._origW * pct;
  selected.h = selected._origH * pct;
  updatePanel();
});

document.getElementById('btn-replace-image').addEventListener('click', () => {
  document.getElementById('image-input').click();
});

document.getElementById('image-fit').addEventListener('change', () => {
  if (!selected || selected.type !== 'image') return;
  selected.imageFit = document.getElementById('image-fit').value;
});

document.getElementById('image-opacity').addEventListener('change', () => {
  if (!selected || selected.type !== 'image') return;
  selected.fillOpacity = parseFloat(document.getElementById('image-opacity').value) || 100;
  updatePanel();
});

// Fill
document.getElementById('fill-color-picker').addEventListener('input', e => {
  if (!selected) return;
  selected.fillColor = e.target.value;
  document.getElementById('fill-hex').value = e.target.value;
  document.getElementById('fill-swatch').style.background = e.target.value;
});
document.getElementById('fill-hex').addEventListener('change', e => {
  if (!selected || !/^#[0-9a-fA-F]{6}$/.test(e.target.value)) return;
  selected.fillColor = e.target.value;
  document.getElementById('fill-color-picker').value = e.target.value;
  document.getElementById('fill-swatch').style.background = e.target.value;
});
document.getElementById('fill-opacity').addEventListener('input', e => {
  if (!selected) return;
  selected.fillOpacity = parseInt(e.target.value);
  document.getElementById('fill-opacity-val').textContent = e.target.value + '%';
});

// Stroke
document.getElementById('stroke-color-picker').addEventListener('input', e => {
  if (!selected) return;
  selected.strokeColor = e.target.value;
  document.getElementById('stroke-hex').value = e.target.value;
  document.getElementById('stroke-swatch').style.background = e.target.value;
});
document.getElementById('stroke-hex').addEventListener('change', e => {
  if (!selected || !/^#[0-9a-fA-F]{6}$/.test(e.target.value)) return;
  selected.strokeColor = e.target.value;
  document.getElementById('stroke-color-picker').value = e.target.value;
  document.getElementById('stroke-swatch').style.background = e.target.value;
});
document.getElementById('stroke-width').addEventListener('change', () => {
  if (!selected) return;
  selected.strokeWidth = parseFloat(document.getElementById('stroke-width').value) || 0;
});
document.getElementById('stroke-style').addEventListener('change', () => {
  if (!selected) return;
  selected.strokeStyle = document.getElementById('stroke-style').value;
});

// Text
['text-content','text-size','text-weight','text-align','text-font'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    if (!selected || selected.type !== 'text') return;
    selected.text       = document.getElementById('text-content').value || 'Text';
    selected.fontSize   = parseInt(document.getElementById('text-size').value) || 20;
    selected.fontWeight = document.getElementById('text-weight').value;
    selected.textAlign  = document.getElementById('text-align').value;
    selected.fontFamily = document.getElementById('text-font').value;
    remeasureText(selected);
    updatePanel();
  });
});

function updatePreview() {
  const pc     = document.getElementById('preview-canvas');
  const empty  = document.getElementById('preview-empty');
  const wrap   = document.getElementById('preview-wrap');
  const meta   = document.getElementById('preview-meta');
  const imgSec = document.getElementById('sec-image');

  if (!selected) {
    empty.style.display  = '';
    wrap.style.display   = 'none';
    imgSec.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  wrap.style.display  = '';

  const pctx = pc.getContext('2d');
  const pw   = pc.width  = 236;
  const ph   = pc.height = 160;

  // Checkerboard background
  for (let xi = 0; xi < pw; xi += 10)
    for (let yi = 0; yi < ph; yi += 10) {
      pctx.fillStyle = (xi/10 + yi/10) % 2 === 0 ? '#f5f4f2' : '#eceae6';
      pctx.fillRect(xi, yi, 10, 10);
    }

  // Fit element into preview box
  const pad = 20;
  const sc  = Math.min((pw - pad*2) / selected.w, (ph - pad*2) / selected.h, 2);
  const ox  = (pw - selected.w * sc) / 2;
  const oy  = (ph - selected.h * sc) / 2;

  pctx.save();
  pctx.translate(ox + (selected.w * sc) / 2, oy + (selected.h * sc) / 2);
  pctx.rotate(selected.rotation);
  pctx.scale(sc, sc);
  pctx.translate(-selected.w / 2, -selected.h / 2);
  pctx.globalAlpha = selected.fillOpacity / 100;
  drawElement(pctx, { ...selected, x: 0, y: 0 });
  pctx.globalAlpha = 1;
  pctx.restore();

  // Meta tags
  meta.innerHTML = `
    <span class="preview-tag">${Math.round(selected.w)} × ${Math.round(selected.h)}</span>
    <span class="preview-tag">${selected.type}</span>
    <span class="preview-tag">${Math.round(selected.rotation * 180 / Math.PI)}°</span>
    ${selected.fillOpacity < 100 ? `<span class="preview-tag">${selected.fillOpacity}% opacity</span>` : ''}
  `;

  // Image panel
  const isImg = selected.type === 'image';
  imgSec.style.display = isImg ? '' : 'none';
  if (isImg && selected._img) {
    document.getElementById('image-preview-img').src          = selected._img.src;
    document.getElementById('image-preview-img').style.objectFit = selected.imageFit || 'cover';
    document.getElementById('image-preview-info').textContent =
      `${selected._img.naturalWidth} × ${selected._img.naturalHeight}px  ·  ${Math.round(selected.w)} × ${Math.round(selected.h)} on canvas`;
    document.getElementById('image-fit').value     = selected.imageFit || 'cover';
    document.getElementById('image-opacity').value = selected.fillOpacity;
  }
}

// ── Panel Update ───────────────────────────────────────────────
function updatePanel() {
  const el  = selected;
  const dis = !el;

  // Design inputs
  ['prop-x','prop-y','prop-w','prop-h','prop-rot','prop-radius'].forEach(id => {
    document.getElementById(id).disabled = dis;
  });

  if (el) {
    document.getElementById('prop-x').value      = Math.round(el.x);
    document.getElementById('prop-y').value      = Math.round(el.y);
    document.getElementById('prop-w').value      = Math.round(el.w);
    document.getElementById('prop-h').value      = Math.round(el.h);
    document.getElementById('prop-rot').value    = Math.round(el.rotation * 180 / Math.PI);
    document.getElementById('prop-radius').value = el.radius || 0;

    // Fill
    document.getElementById('fill-color-picker').value           = el.fillColor;
    document.getElementById('fill-hex').value                    = el.fillColor;
    document.getElementById('fill-swatch').style.background      = el.fillColor;
    document.getElementById('fill-hex').disabled                 = false;
    document.getElementById('fill-opacity').disabled             = false;
    document.getElementById('fill-opacity').value                = el.fillOpacity;
    document.getElementById('fill-opacity-val').textContent      = el.fillOpacity + '%';

    // Stroke
    document.getElementById('stroke-color-picker').value         = el.strokeColor;
    document.getElementById('stroke-hex').value                  = el.strokeColor;
    document.getElementById('stroke-swatch').style.background    = el.strokeColor;
    document.getElementById('stroke-hex').disabled               = false;
    document.getElementById('stroke-width').disabled             = false;
    document.getElementById('stroke-width').value                = el.strokeWidth;
    document.getElementById('stroke-style').disabled             = false;
    document.getElementById('stroke-style').value                = el.strokeStyle || 'solid';

// Enable dimension controls
document.getElementById('prop-minw').disabled   = false;
document.getElementById('prop-minh').disabled   = false;
document.getElementById('prop-maxw').disabled   = false;
document.getElementById('prop-maxh').disabled   = false;
document.getElementById('prop-aspect').disabled = false;
document.getElementById('prop-scale').disabled  = false;
document.getElementById('prop-scale').value     = 100;

// Store aspect ratio when selection changes
aspectRatio = el.w / el.h;

    // Text section
    const isText = el.type === 'text';
    document.getElementById('sec-text').style.display = isText ? '' : 'none';
    if (isText) {
      document.getElementById('text-content').value = el.text;
      document.getElementById('text-size').value    = el.fontSize;
      document.getElementById('text-weight').value  = el.fontWeight;
      document.getElementById('text-align').value   = el.textAlign;
      const triggerPreview = document.getElementById('font-trigger-preview');
if (triggerPreview && el.type === 'text') {
  triggerPreview.textContent = el.fontFamily || 'DM Sans';
  triggerPreview.style.fontFamily = `'${el.fontFamily || 'DM Sans'}'`;
}
    }

    document.getElementById('status-selected').textContent = `${el.type} #${el.id}`;
  } else {
    // Disable fill/stroke when nothing selected
    document.getElementById('fill-hex').disabled       = true;
    document.getElementById('fill-opacity').disabled   = true;
    document.getElementById('stroke-hex').disabled     = true;
    document.getElementById('stroke-width').disabled   = true;
    document.getElementById('stroke-style').disabled   = true;
    document.getElementById('sec-text').style.display  = 'none';
    document.getElementById('status-selected').textContent = 'No selection';
    document.getElementById('prop-minw').disabled   = true;
document.getElementById('prop-minh').disabled   = true;
document.getElementById('prop-maxw').disabled   = true;
document.getElementById('prop-maxh').disabled   = true;
document.getElementById('prop-aspect').disabled = true;
document.getElementById('prop-scale').disabled  = true;
  }

  updateLayers();
  document.getElementById('elem-count').textContent =
    elements.length + ' object' + (elements.length === 1 ? '' : 's');
    
    updatePreview()
}



// ── Layers ─────────────────────────────────────────────────────
const TYPE_ICONS = {
  rect:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  ellipse:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="10"/></svg>`,
  triangle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
  line:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>`,
  text:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  image:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
};

const EYE_ON  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function updateLayers() {
  const list = document.getElementById('layers-list');

  if (!elements.length) {
    list.innerHTML = `<div class="empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <p>No layers yet.<br/>Draw something to start.</p>
    </div>`;
    return;
  }

  list.innerHTML = [...elements].reverse().map(el => `
    <div class="layer-item ${selected === el ? 'selected' : ''}" data-id="${el.id}">
      <div class="layer-thumb" style="background:${el.type === 'text' || el.type === 'line' ? 'transparent;border:1px solid #e2dfd9' : el.fillColor};"></div>
      <span class="layer-icon">${TYPE_ICONS[el.type] || ''}</span>
      <span class="layer-name">${el.type === 'text' ? (el.text.slice(0, 16) || 'Text') : el.type + ' ' + el.id}</span>
      <span class="layer-vis" data-vis-id="${el.id}">${el.visible ? EYE_ON : EYE_OFF}</span>
    </div>
  `).join('');

  // Events
  list.querySelectorAll('.layer-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.layer-vis')) return;
      const id = parseInt(item.dataset.id);
      selected = elements.find(e => e.id === id) || null;
      updatePanel();
    });
  });

  list.querySelectorAll('.layer-vis').forEach(vis => {
    vis.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(vis.dataset.visId);
      const el = elements.find(e => e.id === id);
      if (el) { el.visible = !el.visible; updateLayers(); }
    });
  });
}

// ── Splash Screen ──────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
  }, 2200);
});

// ── Font Dropdown Builder ──────────────────────────────────────
// ── Font Picker ────────────────────────────────────────────────
let fontPickerSelected = null;

function buildFontPickerList() {
  const search = (document.getElementById('font-search')?.value || '').toLowerCase();
  const builtinEl = document.getElementById('font-picker-builtin');
  const importedEl = document.getElementById('font-picker-imported');
  const importedLabel = document.getElementById('font-picker-imported-label');
  
  const currentFont = selected?.fontFamily || 'DM Sans';
  
  function makeItem(fontName) {
    if (search && !fontName.toLowerCase().includes(search)) return '';
    const isActive = fontName === fontPickerSelected;
    return `
      <div class="font-picker-item ${isActive ? 'active' : ''}" data-font="${fontName}">
        <span class="font-picker-sample" style="font-family:'${fontName}'">${fontName}</span>
        <span class="font-picker-name">${fontName}</span>
        <svg class="font-picker-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;
  }
  
  builtinEl.innerHTML = BUILTIN_FONTS.map(makeItem).join('');
  importedEl.innerHTML = importedFonts.map(f => makeItem(f.name)).join('');
  importedLabel.style.display = importedFonts.length ? '' : 'none';
  
  // Click events
  document.querySelectorAll('.font-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      fontPickerSelected = item.dataset.font;
      // Update trigger preview live
      const preview = document.getElementById('font-trigger-preview');
      if (preview) {
        preview.textContent = fontPickerSelected;
        preview.style.fontFamily = `'${fontPickerSelected}'`;
      }
      buildFontPickerList();
    });
  });
}

function openFontPicker() {
  fontPickerSelected = selected?.fontFamily || 'DM Sans';
  document.getElementById('font-picker-dialog').classList.remove('hidden');
  document.getElementById('font-search').value = '';
  buildFontPickerList();
  setTimeout(() => document.getElementById('font-search').focus(), 50);
}

// Trigger button
document.getElementById('font-picker-trigger').addEventListener('click', openFontPicker);

// Search
document.getElementById('font-search').addEventListener('input', buildFontPickerList);

// Close / Cancel
document.getElementById('font-picker-close').addEventListener('click', () => {
  document.getElementById('font-picker-dialog').classList.add('hidden');
});
document.getElementById('font-picker-cancel').addEventListener('click', () => {
  document.getElementById('font-picker-dialog').classList.add('hidden');
});

// Backdrop click
document.getElementById('font-picker-dialog').addEventListener('pointerdown', e => {
  if (e.target === document.getElementById('font-picker-dialog'))
    document.getElementById('font-picker-dialog').classList.add('hidden');
});

// Confirm
document.getElementById('font-picker-confirm').addEventListener('click', () => {
  if (!selected || selected.type !== 'text' || !fontPickerSelected) return;
  selected.fontFamily = fontPickerSelected;
  remeasureText(selected);
  updatePanel();
  document.getElementById('font-picker-dialog').classList.add('hidden');
});

// Import button inside picker
document.getElementById('btn-import-font2').addEventListener('click', () => {
  document.getElementById('font-file-input').click();
});

// ── Font Import ────────────────────────────────────────────────
document.getElementById('btn-import-font').addEventListener('click', () => {
  document.getElementById('font-file-input').click();
});

document.getElementById('font-file-input').addEventListener('change', e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  let loaded = 0;

  files.forEach(file => {
    const name = file.name
      .replace(/\.(ttf|otf|woff|woff2)$/i, '')  // strip extension
      .replace(/[-_]/g, ' ')                      // dashes/underscores → spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase → spaces
      .trim();

    const reader = new FileReader();
    reader.onload = ev => {
      const url      = ev.target.result;
      const fontFace = new FontFace(name, `url(${url})`);

      fontFace.load().then(loadedFace => {
        document.fonts.add(loadedFace);

        // Avoid duplicates
        if (!importedFonts.find(f => f.name === name)) {
          importedFonts.push({ name, url });
        }

        loaded++;
        if (loaded === files.length) {
        //here  buildFontDropdown();
        buildFontPickerList()
          showToast(`${loaded} font${loaded > 1 ? 's' : ''} imported`);

          // Auto-apply to selected text element
          if (selected && selected.type === 'text') {
            selected.fontFamily = name;
            remeasureText(selected);
            updatePanel();
          }
        }
      }).catch(() => {
        showToast(`Failed to load "${name}"`);
      });
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
});

// ── Init ───────────────────────────────────────────────────────
function init() {
  // Starter elements
  const r = createElement('rect', 60, 60, 160, 100);
  r.radius = 12;
  elements.push(r);

  const el = createElement('ellipse', 260, 60, 110, 110);
  el.fillColor = '#f43f5e';
  elements.push(el);

  const t = createElement('text', 60, 200, 260, 32);
  t.text      = 'Double-click to edit text';
  t.fillColor = '#1a1917';
  t.fontSize  = 15;
  elements.push(t);

  updatePanel();
  setTool('select');
  render();
  
}
// ═══════════════════════════════════════════════════════════════
//  PROJECT SAVE / LOAD
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  PROJECT SAVE / LOAD
// ═══════════════════════════════════════════════════════════════

function getAllProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function generateThumb(projectElements) {
  const tmp  = document.createElement('canvas');
  tmp.width  = 300;
  tmp.height = 200;
  const tc   = tmp.getContext('2d');

  tc.fillStyle = '#f5f4f2';
  tc.fillRect(0, 0, 300, 200);

  if (!projectElements.length) return tmp.toDataURL();

  const xs = projectElements.flatMap(e => [e.x, e.x + e.w]);
  const ys = projectElements.flatMap(e => [e.y, e.y + e.h]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const mw = Math.max(...xs) - mx, mh = Math.max(...ys) - my;

  const pad = 20;
  const sc  = Math.min((300 - pad*2) / mw, (200 - pad*2) / mh, 2);
  const ox  = (300 - mw * sc) / 2 - mx * sc;
  const oy  = (200 - mh * sc) / 2 - my * sc;

  tc.save();
  tc.translate(ox, oy);
  tc.scale(sc, sc);

  projectElements.forEach(el => {
    if (!el.visible) return;
    // Skip images in thumbnail (no _img reference in serialized data)
    if (el.type === 'image') {
      tc.fillStyle = '#e2dfd9';
      tc.fillRect(el.x, el.y, el.w, el.h);
      return;
    }
    drawElement(tc, el);
  });

  tc.restore();
  return tmp.toDataURL();
}

function saveCurrentProject(name) {
  const projects = getAllProjects();
  const serial = elements.map(e => {
  const c = { ...e };
  if (e._img && e._img.src) c._imgSrc = e._img.src;
  delete c._img;
  return c;
});
  const thumb    = generateThumb(serial);
  const now      = new Date();

  if (currentProjectId) {
    // Overwrite existing
    const idx = projects.findIndex(p => p.id === currentProjectId);
    if (idx !== -1) {
      projects[idx].elements      = serial;
projects[idx].importedFonts = importedFonts;
projects[idx].thumb         = thumb;
projects[idx].updatedAt     = now.toISOString();
projects[idx].name          = name || projects[idx].name;
      saveProjects(projects);
      showToast(`"${projects[idx].name}" saved`);
      renderProjectsGrid();
      return;
    }
  }

  // New project
  const project = {
  id: Date.now().toString(),
  name: name || 'Untitled Project',
  elements: serial,
  importedFonts: importedFonts,
  thumb,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
};

  projects.unshift(project);
  saveProjects(projects);
  currentProjectId = project.id;
  showToast(`"${project.name}" saved`);
  renderProjectsGrid();
}

function loadProject(id) {
  const projects = getAllProjects();
  const project  = projects.find(p => p.id === id);
  if (!project) return;

  elements         = project.elements;
  ccurrentProjectId = project.id;
  // Restore imported fonts
if (project.importedFonts && project.importedFonts.length) {
  importedFonts = project.importedFonts;
  importedFonts.forEach(f => {
    if (!document.fonts.check(`12px "${f.name}"`)) {
      const fontFace = new FontFace(f.name, `url(${f.url})`);
      fontFace.load().then(lf => document.fonts.add(lf));
    }
  });
  
}
selected = null;

elements = project.elements.map(el => {
  if (el.type === 'image' && el._imgSrc) {
    const img = new Image();
    img.src = el._imgSrc;
    el._img = img;
  }
  return el;
});

  updatePanel();
  fitAll();
  document.getElementById('projects-dialog').classList.add('hidden');
  showToast(`"${project.name}" loaded`);
}

function deleteProject(id) {
  let projects = getAllProjects();
  const proj   = projects.find(p => p.id === id);
  projects     = projects.filter(p => p.id !== id);
  saveProjects(projects);
  if (currentProjectId === id) currentProjectId = null;
  showToast(`"${proj?.name || 'Project'}" deleted`);
  renderProjectsGrid();
}


function renderProjectsGrid() {
  const grid    = document.getElementById('projects-grid');
  const search  = document.getElementById('projects-search').value.toLowerCase();
  let projects  = getAllProjects();

  if (search) {
    projects = projects.filter(p => p.name.toLowerCase().includes(search));
  }

  if (!projects.length) {
    grid.innerHTML = `
      <div class="projects-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <p>No saved projects yet.<br/>Save your current canvas to get started.</p>
      </div>
    `;
    return;
  }

  if (!projects.length) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.style.display = '';
    return;
  }

  

  grid.innerHTML = projects.map(p => {
    const date    = new Date(p.updatedAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const count   = p.elements?.length || 0;
    const active  = p.id === currentProjectId ? 'style="border-color:#2563eb;"' : '';

    return `
      <div class="project-card" data-id="${p.id}" ${active}>
        <img class="project-thumb" src="${p.thumb}" alt="${p.name}" />
        <div class="project-info">
          <div class="project-name" title="${p.name}">${p.name}</div>
          <div class="project-date">${dateStr}</div>
          <div class="project-count">${count} object${count === 1 ? '' : 's'}</div>
        </div>
        <div class="project-actions">
          <button class="project-action-btn load" data-load="${p.id}" title="Load">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 12 5 19 12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
          </button>
          <button class="project-action-btn del" data-del="${p.id}" title="Delete">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Events
  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('dblclick', () => loadProject(card.dataset.id));
  });
  grid.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); loadProject(btn.dataset.load); });
  });
  grid.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this project? This cannot be undone.')) {
        deleteProject(btn.dataset.del);
      }
    });
  });
}

// ── Toast ──────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Projects Dialog Wiring ─────────────────────────────────────
document.getElementById('btn-projects').addEventListener('click', () => {
  renderProjectsGrid();
  document.getElementById('projects-dialog').classList.remove('hidden');
});

document.getElementById('projects-close').addEventListener('click', () => {
  document.getElementById('projects-dialog').classList.add('hidden');
});

document.getElementById('projects-dialog').addEventListener('pointerdown', e => {
  if (e.target === document.getElementById('projects-dialog'))
    document.getElementById('projects-dialog').classList.add('hidden');
});

document.getElementById('projects-search').addEventListener('input', renderProjectsGrid);

// Save Current button inside dialog
document.getElementById('btn-save-project').addEventListener('click', () => {
  document.getElementById('projects-dialog').classList.add('hidden');
  openSaveNameDialog();
});

// Save Name Dialog
function openSaveNameDialog() {
  const projects = getAllProjects();
  const existing = currentProjectId ? projects.find(p => p.id === currentProjectId) : null;
  const input    = document.getElementById('savename-input');
  input.value    = existing ? existing.name : '';
  input.placeholder = 'My Project…';
  document.getElementById('savename-dialog').classList.remove('hidden');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

document.getElementById('savename-close').addEventListener('click', () => {
  document.getElementById('savename-dialog').classList.add('hidden');
});
document.getElementById('savename-cancel').addEventListener('click', () => {
  document.getElementById('savename-dialog').classList.add('hidden');
});
document.getElementById('savename-confirm').addEventListener('click', () => {
  const name = document.getElementById('savename-input').value.trim() || 'Untitled Project';
  document.getElementById('savename-dialog').classList.add('hidden');
  saveCurrentProject(name);
});
document.getElementById('savename-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('savename-confirm').click();
});

// Keyboard shortcut Ctrl+S
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const projects = getAllProjects();
    const existing = projects.find(p => p.id === currentProjectId);
    if (existing) {
      // Quick-save over existing
      saveCurrentProject(existing.name);
    } else {
      // First time — ask for name
      openSaveNameDialog();
    }
  }
});
init();
