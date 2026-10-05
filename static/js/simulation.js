/* Simulation results: one evaluation episode rolled out by both policies, side by side.
   Reads the episode list from .sim-episodes in index.html, then builds the primitive tabs,
   the object dots and the two players. Every episode keeps its own <video>, hidden until it is
   picked, so switching never clears a player and the page never jumps. */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.dataset.base) || './files/video/simulation/';
  const root = document.getElementById('sim-compare');
  if (!root) return;

  const episodes = [...root.querySelectorAll('.sim-episodes li')].map(li => ({
    task: li.dataset.task,
    name: li.textContent.trim(),
    sides: [
      { key: 'ours', label: 'BiREPO (ours)', src: li.dataset.ours, cap: li.dataset.oursCap, ok: li.dataset.oursOk === 'true' },
      { key: 'base', label: 'DP3', src: li.dataset.base, cap: li.dataset.baseCap, ok: li.dataset.baseOk === 'true' },
    ],
  }));
  if (!episodes.length) return;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  const tasks = [...new Set(episodes.map(e => e.task))];
  const tabs = el('div', 'sim-tabs');
  const dots = el('div', 'sim-dots');
  const caseLine = el('p', 'sim-case');
  const grid = el('div', 'sim-grid');
  root.prepend(tabs, dots, caseLine, grid);

  // one column per policy; each holds every episode's player, only the active one shown
  const sides = episodes[0].sides.map(s => {
    const col = el('div', 'sim-side' + (s.key === 'ours' ? ' is-ours' : ''));
    col.appendChild(el('h5', null, s.label));
    const stage = el('div', 'stage');
    col.appendChild(stage);
    const cap = el('div', 'sim-cap');
    col.appendChild(cap);
    grid.appendChild(col);
    return { key: s.key, stage, cap, players: new Map() };
  });

  let task = tasks[0];
  let index = 0;
  let inView = false;

  const shown = () => episodes.filter(e => e.task === task);

  // a player is created the first time its episode is opened, then kept
  function player(side, ep) {
    let v = side.players.get(ep);
    if (!v) {
      const spec = ep.sides.find(s => s.key === side.key);
      v = document.createElement('video');
      v.className = 'video-rounded';
      v.src = BASE + spec.src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.controls = true;
      v.preload = 'metadata';
      side.stage.appendChild(v);
      side.players.set(ep, v);
    }
    return v;
  }

  function show() {
    const ep = shown()[index];
    caseLine.innerHTML = '<b>' + ep.name + '</b> &middot; ' + ep.task.toLowerCase();
    for (const side of sides) {
      const spec = ep.sides.find(s => s.key === side.key);
      const active = player(side, ep);
      side.players.forEach(v => {
        const on = v === active;
        v.hidden = !on;
        if (!on) v.pause();
      });
      if (inView) active.play().catch(() => {});
      side.cap.className = 'sim-cap ' + (spec.ok ? 'is-ok' : 'is-bad');
      side.cap.innerHTML = (spec.ok ? '&#10003; ' : '&#10007; ') + spec.cap;
    }
    [...dots.children].forEach((d, i) => {
      d.classList.toggle('is-active', i === index);
      d.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  }

  function buildDots() {
    dots.innerHTML = '';
    shown().forEach((ep, i) => {
      const dot = el('button', 'sim-dot');
      dot.type = 'button';
      dot.title = ep.name;
      dot.setAttribute('aria-label', ep.name);
      dot.addEventListener('click', () => { if (i !== index) { index = i; show(); } });
      dots.appendChild(dot);
    });
  }

  function showTask(t) {
    task = t;
    index = 0;
    [...tabs.children].forEach(b => b.classList.toggle('is-active', b.dataset.task === t));
    buildDots();
    show();
  }

  for (const t of tasks) {
    const btn = el('button', null, t);
    btn.type = 'button';
    btn.dataset.task = t;
    btn.addEventListener('click', () => showTask(t));
    tabs.appendChild(btn);
  }

  // play only while the section is on screen
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    for (const side of sides) {
      side.players.forEach(v => { if (!v.hidden) inView ? v.play().catch(() => {}) : v.pause(); });
    }
  }, { rootMargin: '200px 0px' }).observe(root);

  showTask(tasks[0]);
})();
