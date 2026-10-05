/* Real-world rollouts: pick an object and a primitive, watch every trial we ran side by side.
   Reads the object list from .rw-objects in index.html, where data-push / data-rot / data-flip hold the
   run file names for that primitive, pipe-separated. Each trial keeps its own <video> once opened, hidden
   rather than replaced, so switching never blanks a player or shifts the page. */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.dataset.base) || './files/video/realworld_exp/';
  const root = document.getElementById('rw-gallery');
  if (!root) return;
  const RATE = 2; // trials play at 2x so a 25 s rollout reads quickly

  const PRIMS = [
    { key: 'push', folder: 'pushing', label: 'Pushing' },
    { key: 'rot', folder: 'rotating', label: 'Rotating' },
    { key: 'flip', folder: 'flipping', label: 'Flipping' },
  ];

  const list = d => (d || '').split('|').map(x => x.trim()).filter(Boolean);
  const objects = [...root.querySelectorAll('.rw-objects li')].map(li => ({
    name: li.dataset.name,
    runs: { push: list(li.dataset.push), rot: list(li.dataset.rot), flip: list(li.dataset.flip) },
  }));
  if (!objects.length) return;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  // folder and file names contain spaces, so encode each segment
  const url = (obj, prim, file) =>
    BASE + prim.folder + '/' + encodeURIComponent(obj.name) + '/' + encodeURIComponent(file);

  // ── controls: object dropdown, then one button per primitive ───────────────
  const picker = el('div', 'rw-picker');
  const select = document.createElement('select');
  select.id = 'rw-object';
  objects.forEach((o, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = o.name;
    select.appendChild(opt);
  });
  const label = el('label', null, 'Object');
  label.setAttribute('for', 'rw-object');
  picker.append(label, select);

  const tabs = el('div', 'rw-tabs');
  const grid = el('div', 'rw-grid');
  root.prepend(picker, tabs, grid);

  let objIdx = 0;
  let prim = PRIMS[0];
  let inView = false;
  const players = new Map(); // "objectIndex|primKey|file" -> <video>

  function player(obj, p, file) {
    const id = objects.indexOf(obj) + '|' + p.key + '|' + file;
    let v = players.get(id);
    if (!v) {
      v = document.createElement('video');
      v.className = 'video-rounded';
      v.src = url(obj, p, file);
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.controls = true;
      v.preload = 'metadata';
      v.playbackRate = RATE;
      // the rate is reset whenever the element loads media, so set it again each time
      v.addEventListener('loadedmetadata', () => { v.playbackRate = RATE; });
      players.set(id, v);
    }
    return v;
  }

  function show() {
    const obj = objects[objIdx];
    const runs = obj.runs[prim.key];
    // keep one cell per trial; cells are reused so the row never collapses
    while (grid.children.length < runs.length) {
      const cell = el('div', 'rw-cell');
      cell.appendChild(el('div', 'stage'));
      cell.appendChild(el('div', 'rw-trial'));
      grid.appendChild(cell);
    }
    while (grid.children.length > runs.length) grid.lastChild.remove();

    players.forEach(v => { if (v.isConnected) v.pause(); });

    runs.forEach((file, i) => {
      const cell = grid.children[i];
      const stage = cell.querySelector('.stage');
      const v = player(obj, prim, file);
      if (v.parentElement !== stage) {
        stage.innerHTML = '';
        stage.appendChild(v);
      }
      if (inView) v.play().catch(() => {});
      cell.querySelector('.rw-trial').textContent = 'Trial ' + (i + 1);
    });

    [...tabs.children].forEach(b => b.classList.toggle('is-active', b.dataset.prim === prim.key));
  }

  for (const p of PRIMS) {
    const btn = el('button', null, p.label);
    btn.type = 'button';
    btn.dataset.prim = p.key;
    btn.addEventListener('click', () => { prim = p; show(); });
    tabs.appendChild(btn);
  }
  select.addEventListener('change', () => { objIdx = Number(select.value); show(); });

  // play only while the gallery is on screen
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    grid.querySelectorAll('video').forEach(v => {
      inView ? v.play().catch(() => {}) : v.pause();
    });
  }, { rootMargin: '200px 0px' }).observe(root);

  show();
})();
