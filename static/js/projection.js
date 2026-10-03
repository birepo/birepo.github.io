/* Contact-projection results section: aggregate rates, static figure with SVG overlays,
   a synchronized three-view 3-D explorer, and the failure gallery.
   Data: files/projection/figure.json (rates, figure, fails) and explorer_<task>.json (meshes + cases).
   Requires three.js r128 (global THREE) for the explorer; everything else is plain DOM. */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.dataset.base) || './files/projection/';
  const MODES = ['random', 'normal', 'wrench'];
  const MODE_LABEL = { random: 'Random', normal: 'Normal', wrench: 'Wrench-guided (ours)' };
  // long label on wide screens, short one on phones (CSS toggles the spans)
  const modeHeader = m => m === 'wrench'
    ? '<span class="cp-long">Wrench-guided (ours)</span><span class="cp-short">Ours</span>' : MODE_LABEL[m];
  const MODE_SHORT = { random: 'Random', normal: 'Normal', wrench: 'Ours' };
  const TASKS = ['push', 'rotate', 'flip'];
  const TASK_TITLE = { push: 'Pushing', rotate: 'Rotating', flip: 'Flipping' };
  const SVG = 'http://www.w3.org/2000/svg';

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fetchJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });

  // ── outcome caption: vector check / cross + text ───────────────────────────
  function caption(cap) {
    const c = el('div', 'cp-cap ' + (cap.ok ? 'is-ok' : 'is-bad'));
    const s = svgEl('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' });
    s.appendChild(svgEl('path', { d: cap.ok ? 'M2 11 L7.5 17 L18 3' : 'M3 3 L17 17 M3 17 L17 3' }));
    c.appendChild(s);
    c.appendChild(document.createTextNode(cap.text));
    return c;
  }

  // ── a static panel: transparent render + SVG overlay in 0..1000 units ─────
  function panel(image, items, ours) {
    const p = el('div', 'cp-panel' + (ours ? ' is-ours' : ''));
    const img = el('img'); img.src = BASE + image; img.alt = ''; img.loading = 'lazy'; p.appendChild(img);
    const s = svgEl('svg', { viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    for (const it of items) {
      if (it.kind === 'poly') {
        s.appendChild(svgEl('polygon', { points: it.pts.map(q => q.join(',')).join(' '), fill: it.color, opacity: it.alpha }));
      } else if (it.kind === 'line') {
        s.appendChild(svgEl('polyline', { points: it.pts.map(q => q.join(',')).join(' '), fill: 'none', stroke: it.color,
          'stroke-width': it.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      } else if (it.kind === 'marker') {
        const stroke = it.visible ? '#fff' : it.color, fill = it.visible ? it.color : '#fff', sw = it.visible ? 7 : 11;
        if (it.shape === 'o') s.appendChild(svgEl('circle', { cx: it.x, cy: it.y, r: it.r, fill, stroke, 'stroke-width': sw }));
        else s.appendChild(svgEl('rect', { x: it.x - it.r, y: it.y - it.r, width: 2 * it.r, height: 2 * it.r, fill, stroke, 'stroke-width': sw }));
      }
    }
    p.appendChild(s);
    return p;
  }

  // ── aggregate rates ────────────────────────────────────────────────────────
  function renderRates(root, rates) {
    root.innerHTML = '';
    for (const t of TASKS) {
      const r = rates[t];
      const card = el('div', 'cp-rate');
      card.appendChild(el('h4', null, TASK_TITLE[t]));
      for (const m of MODES) {
        const bar = el('div', 'cp-bar is-' + (m === 'wrench' ? 'ours' : m));
        bar.appendChild(el('span', 'lbl', MODE_SHORT[m]));
        const trk = el('div', 'trk'); const fil = el('div', 'fil'); fil.style.width = r[m].pct + '%'; trk.appendChild(fil); bar.appendChild(trk);
        bar.appendChild(el('span', 'val', r[m].pct.toFixed(0) + '%'));
        card.appendChild(bar);
      }
      root.appendChild(card);
    }
  }

  // ── static figure ──────────────────────────────────────────────────────────
  function renderFigure(root, figure) {
    root.innerHTML = '';
    // interleave the two groups row by row: push A, push B, rotate A, rotate B, ...
    const nrows = figure.groups[0].rows.length;
    for (let r = 0; r < nrows; r++) {
      for (const g of figure.groups) {
        const row = g.rows[r];
        const b = el('div', 'cp-block');
        b.appendChild(el('div', 'hdr', '<b>' + row.title + '</b><span>' + row.object + ' · ' + row.goal + '</span>'));
        const cols = el('div', 'cols');
        for (const pn of row.panels) {
          const ours = pn.mode === 'wrench';
          const col = el('div', 'col' + (ours ? ' is-ours' : ''));
          col.appendChild(el('h5', null, modeHeader(pn.mode)));
          col.appendChild(panel(row.image, pn.items, ours));
          col.appendChild(caption(pn.caption));
          cols.appendChild(col);
        }
        b.appendChild(cols);
        root.appendChild(b);
      }
    }
  }

  // ── failure gallery ────────────────────────────────────────────────────────
  function renderFails(root, fails) {
    root.innerHTML = '';
    const mark = ok => '<i class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓' : '✗') + '</i>';
    // data-only="mug, bin, …" narrows the gallery to those objects, in that order
    const only = (root.dataset.only || '').split(',').map(s => s.trim()).filter(Boolean);
    const shown = only.length ? only.map(o => fails.find(f => f.object === o)).filter(Boolean) : fails;
    for (const f of shown) {
      const c = el('div', 'cp-fail');
      c.appendChild(el('div', 'hdr', f.title + ' <span>· ' + f.object + ' · ' + f.goal + '</span>'));
      c.appendChild(panel(f.image, f.items, true));
      c.appendChild(caption(f.caption));
      c.appendChild(el('div', 'base', 'baselines: random ' + mark(f.baselines.random) + ' &nbsp; normal ' + mark(f.baselines.normal)));
      root.appendChild(c);
    }
  }

  // ── 3-D explorer ───────────────────────────────────────────────────────────
  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  function geometry(m) {
    const vb = b64(m.v), q = new Uint16Array(vb.buffer, 0, vb.byteLength / 2), pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i += 3) { pos[i] = m.b[0] + q[i] * m.s; pos[i + 1] = m.b[1] + q[i + 1] * m.s; pos[i + 2] = m.b[2] + q[i + 2] * m.s; }
    const fb = b64(m.f);
    const idx = m.fw === 2 ? new Uint16Array(fb.buffer, 0, fb.byteLength / 2) : new Uint32Array(fb.buffer, 0, fb.byteLength / 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }

  const COL = { A: 0x1f5fbf, B: 0xe0741a, goal: 0x555555 };
  const V3 = a => new THREE.Vector3(a[0], a[1], a[2]);

  // solid arrow: cylinder shaft + cone head, tip at b
  function arrowMesh(a, b, color, span, scale, onTop) {
    scale = scale || 1;
    const A = V3(a), B = V3(b), dir = B.clone().sub(A), len = dir.length(); dir.normalize();
    const hl = Math.min(span * 0.055 * scale, len * 0.6), hr = span * 0.02 * scale, sr = span * 0.008 * scale;
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color });
    // contact arrows point into the object, so they are drawn over it (like the 2-D overlay)
    if (onTop) { mat.depthTest = false; mat.depthWrite = false; g.renderOrder = 5; }
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    if (len - hl > 1e-6) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, len - hl, 12), mat);
      shaft.position.copy(A.clone().add(dir.clone().multiplyScalar((len - hl) / 2))); shaft.quaternion.copy(q); g.add(shaft);
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(hr, hl, 16), mat);
    head.position.copy(B.clone().sub(dir.clone().multiplyScalar(hl / 2))); head.quaternion.copy(q); g.add(head);
    return g;
  }

  // arc (goal glyph): tube along the points + cone at the end
  function arcMesh(pts, color, span, tick) {
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color });
    const P = pts.map(V3), curve = new THREE.CatmullRomCurve3(P);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, span * 0.0065, 8, false), mat));
    const n = P.length, tipDir = P[n - 1].clone().sub(P[n - 3]).normalize();
    const hl = span * 0.05, head = new THREE.Mesh(new THREE.ConeGeometry(span * 0.02, hl, 16), mat);
    head.position.copy(P[n - 1].clone().add(tipDir.clone().multiplyScalar(hl / 2 - span * 0.005)));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir); g.add(head);
    if (tick) {
      const T0 = V3(tick[0]), T1 = V3(tick[1]), d = T1.clone().sub(T0), L = d.length();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.0065, span * 0.0065, L, 8), mat);
      c.position.copy(T0.clone().add(d.multiplyScalar(0.5))); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(c);
    }
    return g;
  }

  function shadowPlane(bbox, span) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d'), gr = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv);
    const w = (bbox[1][0] - bbox[0][0]) * 1.7, h = (bbox[1][1] - bbox[0][1]) * 1.7;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set((bbox[0][0] + bbox[1][0]) / 2, (bbox[0][1] + bbox[1][1]) / 2, bbox[0][2] - 0.0008);
    return m;
  }

  function buildExplorer(root) {
    const tabs = el('div', 'cp-tabs'), objects = el('div', 'cp-objects'), caseLine = el('div', 'cp-case'),
      views = el('div', 'cp-views'), hint = el('div', 'cp-hint'), loading = el('div', 'cp-loading', 'Loading 3-D models…');
    hint.innerHTML = '<span>Drag to orbit — the three views stay synchronized.</span>';
    const reset = el('button', null, 'Reset view'); hint.appendChild(reset);
    root.append(tabs, objects, caseLine, loading, views, hint);
    views.hidden = true;

    const bundles = {}, view = [], state = { task: 'push', caseIdx: 0, bundle: null, dirty: true };
    const orbit = { theta: 0, phi: 1, dist: 1, target: new THREE.Vector3() };
    let home = null;

    for (const m of MODES) {
      const v = el('div', 'cp-view' + (m === 'wrench' ? ' is-ours' : ''));
      v.appendChild(el('h5', null, modeHeader(m)));
      const stage = el('div', 'stage'); v.appendChild(stage);
      const capHolder = el('div'); v.appendChild(capHolder);
      views.appendChild(v);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      stage.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 40); camera.up.set(0, 0, 1);
      // lights ride with the camera so the shading stays consistent while orbiting
      const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(-0.45, 0.55, 0.9);
      const fill = new THREE.DirectionalLight(0xffffff, 0.22); fill.position.set(0.7, 0.1, 0.4);
      camera.add(key, fill); scene.add(camera); scene.add(new THREE.AmbientLight(0xffffff, 0.42));
      const content = new THREE.Group(); scene.add(content);
      view.push({ mode: m, stage, capHolder, renderer, scene, camera, content });
    }

    function clear(g) {
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      while (g.children.length) g.remove(g.children[0]);
    }

    function resize() {
      for (const v of view) {
        const w = v.stage.clientWidth || 300;
        v.renderer.setSize(w, w, false); v.camera.aspect = 1; v.camera.updateProjectionMatrix();
      }
      state.dirty = true;
    }

    function render() {
      if (!state.dirty) return;
      state.dirty = false;
      const d = orbit.dist, sp = Math.sin(orbit.phi);
      for (const v of view) {
        v.camera.position.set(orbit.target.x + d * sp * Math.cos(orbit.theta), orbit.target.y + d * sp * Math.sin(orbit.theta),
          orbit.target.z + d * Math.cos(orbit.phi));
        v.camera.lookAt(orbit.target);
        v.renderer.render(v.scene, v.camera);
      }
    }
    (function loop() { requestAnimationFrame(loop); render(); })();

    function showCase() {
      const b = state.bundle, c = b.cases[state.caseIdx];
      caseLine.innerHTML = '<b>' + c.name + '</b> · ' + TASK_TITLE[state.task].toLowerCase() + ' ' + c.goal;
      const geo = geometry(b.meshes[c.mesh]);
      const bb = c.bbox, span = c.span;
      for (const v of view) {
        clear(v.content);
        v.content.add(new THREE.Mesh(geo.clone(), new THREE.MeshLambertMaterial({ color: 0xb3afa6, side: THREE.DoubleSide })));
        v.content.add(shadowPlane(bb, span));
        const gg = c.goal_geom;
        v.content.add(gg.kind === 'arrow' ? arrowMesh(gg.a, gg.b, COL.goal, span, 1.1) : arcMesh(gg.pts, COL.goal, span, gg.tick));
        const rec = c.modes[v.mode];
        for (const p of rec.pts) {
          const col = COL[p.role];
          const mk = p.role === 'A' ? new THREE.Mesh(new THREE.SphereGeometry(span * 0.024, 24, 16), new THREE.MeshLambertMaterial({ color: col }))
                                    : new THREE.Mesh(new THREE.BoxGeometry(span * 0.038, span * 0.038, span * 0.038), new THREE.MeshLambertMaterial({ color: col }));
          mk.position.set(p.p[0], p.p[1], p.p[2]);
          mk.renderOrder = 6;                 // after the on-top arrows, still depth-tested against the mesh
          v.content.add(mk);
          v.content.add(arrowMesh(p.arrow[0], p.arrow[1], col, span, 1, true));
        }
        v.capHolder.innerHTML = ''; v.capHolder.appendChild(caption({ ok: rec.ok, text: rec.caption }));
      }
      geo.dispose();
      home = { theta: c.azim * Math.PI / 180, phi: (90 - c.elev) * Math.PI / 180, dist: span * 1.75,
               target: new THREE.Vector3((bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2, (bb[0][2] + bb[1][2]) / 2) };
      goHome();
      [...objects.children].forEach((btn, i) => btn.classList.toggle('is-active', i === state.caseIdx));
    }

    function goHome() { orbit.theta = home.theta; orbit.phi = home.phi; orbit.dist = home.dist; orbit.target.copy(home.target); state.dirty = true; }
    reset.addEventListener('click', goHome);

    function showTask(t) {
      state.task = t;
      [...tabs.children].forEach(btn => btn.classList.toggle('is-active', btn.dataset.task === t));
      if (bundles[t]) { state.bundle = bundles[t]; state.caseIdx = 0; buildObjects(); showCase(); return; }
      loading.hidden = false; views.hidden = true; objects.innerHTML = ''; caseLine.innerHTML = '';
      fetchJSON(BASE + 'explorer_' + t + '.json').then(b => {
        bundles[t] = b;
        if (state.task !== t) return;
        state.bundle = b; state.caseIdx = 0;
        loading.hidden = true; views.hidden = false;
        buildObjects(); resize(); showCase();
      }).catch(e => { loading.textContent = 'Could not load the 3-D models (' + e.message + ').'; });
    }

    function buildObjects() {
      objects.innerHTML = '';
      state.bundle.cases.forEach((c, i) => {
        const btn = el('button'); btn.type = 'button'; btn.title = c.label;
        const img = el('img'); img.src = BASE + c.thumb; img.alt = c.name; btn.appendChild(img);
        btn.appendChild(el('span', null, c.name));
        btn.addEventListener('click', () => { state.caseIdx = i; showCase(); });
        objects.appendChild(btn);
      });
    }

    for (const t of TASKS) {
      const btn = el('button', null, TASK_TITLE[t]); btn.type = 'button'; btn.dataset.task = t;
      btn.addEventListener('click', () => showTask(t));
      tabs.appendChild(btn);
    }

    // shared orbit: dragging any view moves all three
    let drag = null;
    for (const v of view) {
      const cv = v.renderer.domElement;
      cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => {
        if (!drag) return;
        orbit.theta -= (e.clientX - drag.x) * 0.009;
        orbit.phi = Math.max(0.08, Math.min(Math.PI / 2 + 0.35, orbit.phi - (e.clientY - drag.y) * 0.009));
        drag = { x: e.clientX, y: e.clientY }; state.dirty = true;
      });
      const up = () => { drag = null; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    }
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(views);
    showTask('push');
  }

  // ── boot ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const ratesEl = document.getElementById('cp-rates'), figEl = document.getElementById('cp-figure'),
      failEl = document.getElementById('cp-fails'), expEl = document.getElementById('cp-explorer');
    fetchJSON(BASE + 'figure.json').then(d => {
      if (ratesEl) renderRates(ratesEl, d.rates);
      if (figEl) renderFigure(figEl, d.figure);
      if (failEl) renderFails(failEl, d.fails);
    }).catch(e => { if (figEl) figEl.textContent = 'Could not load figure data (' + e.message + ').'; });
    if (expEl) {
      if (!window.THREE) { expEl.innerHTML = '<div class="cp-loading">three.js is not loaded.</div>'; return; }
      // build the explorer only when it scrolls near the viewport
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); buildExplorer(expEl); }
      }, { rootMargin: '300px 0px' });
      io.observe(expEl);
    }
  });
})();
