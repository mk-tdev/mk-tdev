'use strict';
(() => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const domains = {
    ai: { labels: ['LangGraph', 'MCP', 'RAG & memory'], description: 'Agents, retrieval, memory, and tools. Connected with intent.', hue: 211, shape: 0 },
    frontend: { labels: ['React & Next.js', 'TypeScript', 'Microfrontends'], description: 'Thoughtful interfaces. Scalable architecture. Human experience.', hue: 195, shape: 1 },
    cloud: { labels: ['AWS', 'Kubernetes', 'FastAPI'], description: 'Cloud architecture, observable services, and reliable delivery.', hue: 222, shape: 2 }
  };
  const scene = document.getElementById('scene');
  const canvas = document.getElementById('constellation');
  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.getElementById('motion');
  let domain = domains.ai;
  let paused = reducedMotion.matches;
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let width = 500, height = 470;
  let yaw = .35, pitch = -.3;
  let drag = null;
  let blend = 1;
  let previousShape = 0;
  let currentHue = domain.hue;
  const TAU = Math.PI * 2;
  const particles = [];
  // Three distinct forms, all represented as real 3D coordinates.
  // A torus knot for connected agents, a layered sphere for interfaces,
  // and a helical structure for cloud platforms.
  for (let i = 0; i < 1450; i++) {
    const t = i / 1450 * TAU;
    const band = (i * .61803398875 % 1) * TAU;
    const tube = .20;
    const r = 1.05 + .37 * Math.cos(3 * t);
    const knot = [r * Math.cos(2 * t) + tube * Math.cos(band) * Math.cos(2 * t), r * Math.sin(2 * t) + tube * Math.cos(band) * Math.sin(2 * t), .43 * Math.sin(3 * t) + tube * Math.sin(band)];
    const y = 1 - 2 * (i + .5) / 1450;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * 2.39996323;
    const sphere = [1.25 * radius * Math.cos(angle), 1.25 * y, 1.25 * radius * Math.sin(angle)];
    const level = (i % 5) / 4;
    const helix = [Math.cos(t * 4 + level * .35) * (1 - level * .12), (level - .5) * 1.8 + .09 * Math.sin(t * 16), Math.sin(t * 4 + level * .35) * (1 - level * .12)];
    particles.push({ shapes: [knot, sphere, helix], size: .5 + ((i * 37) % 100) / 100, brightness: .4 + ((i * 19) % 60) / 100 });
  }
  function project(x, y, z) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rx = x * cy + z * sy;
    const rz = z * cy - x * sy;
    const ry = y * cp - rz * sp;
    const depth = y * sp + rz * cp;
    const perspective = 4.6 / (4.6 + depth);
    const scale = Math.min(width * .29, height * .34);
    return { x: width * .5 + rx * scale * perspective, y: height * .49 + ry * scale * perspective, z: depth, scale: perspective };
  }
  function draw(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .04) : 0;
    lastTime = time;
    if (!paused && !drag) yaw += dt * .13;
    blend = Math.min(1, blend + dt * 1.2);
    currentHue += (domain.hue - currentHue) * Math.min(1, dt * 4);
    ctx.clearRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * .5, height * .49, 0, width * .5, height * .49, Math.min(width, height) * .52);
    glow.addColorStop(0, `hsla(${currentHue}, 65%, 48%, .11)`);
    glow.addColorStop(.65, `hsla(${currentHue}, 65%, 40%, .04)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    // Fine orbital paths establish depth around the denser core.
    for (let orbit = 0; orbit < 3; orbit++) {
      ctx.beginPath();
      for (let j = 0; j <= 160; j++) {
        const a = j / 160 * TAU;
        let x = Math.cos(a) * 1.67, y = Math.sin(a) * 1.67, z = 0;
        if (orbit === 1) { z = y * .94; y *= .34; }
        if (orbit === 2) { z = x * .8; x *= .6; }
        const p = project(x, y, z);
        if (!j) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = `hsla(${currentHue - orbit * 6}, 50%, 72%, ${orbit === 0 ? .18 : .10})`;
      ctx.lineWidth = .6;
      ctx.stroke();
    }
    const ease = blend * blend * (3 - 2 * blend);
    const points = particles.map((particle) => {
      const a = particle.shapes[previousShape], b = particle.shapes[domain.shape];
      const p = project(a[0] + (b[0] - a[0]) * ease, a[1] + (b[1] - a[1]) * ease, a[2] + (b[2] - a[2]) * ease);
      return { ...p, size: particle.size, brightness: particle.brightness };
    });
    // Neighbour links make the knot read as a connected system, rather than stars.
    ctx.lineWidth = .45;
    for (let i = 0; i < points.length; i += 3) {
      const a = points[i], b = points[(i + 13) % points.length];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 35) {
        ctx.strokeStyle = `hsla(${currentHue}, 65%, 75%, ${.12 * (1 - distance / 35)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    points.sort((a, b) => b.z - a.z);
    points.forEach(p => {
      const front = (1.8 - p.z) / 3.6;
      ctx.fillStyle = `hsla(${currentHue + p.z * 7}, ${65 - front * 15}%, ${60 + front * 30}%, ${.22 + front * .7})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.scale * (1 + front * .55), 0, TAU); ctx.fill();
    });
    // Satellite nodes sit on the same 3D orbits and cast a soft luminous halo.
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      const p = project(Math.cos(a) * 1.67, Math.sin(a) * 1.5, Math.sin(a * 2) * .4);
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 15 * p.scale);
      halo.addColorStop(0, `hsla(${currentHue - 10}, 85%, 90%, .9)`);
      halo.addColorStop(.13, `hsla(${currentHue}, 75%, 75%, .6)`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, 15 * p.scale, 0, TAU); ctx.fill();
    }
    frame = 0;
    if (visible && !document.hidden && (!paused || blend < 1 || Math.abs(domain.hue - currentHue) > 1)) requestDraw();
  }
  function requestDraw() { if (!frame && ctx) frame = requestAnimationFrame(draw); }
  function resize() {
    const bounds = scene.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); requestDraw();
  }
  function updateMotion() {
    motion.setAttribute('aria-pressed', String(paused));
    motion.setAttribute('aria-label', paused ? 'Resume constellation rotation' : 'Pause constellation rotation');
    motion.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
    lastTime = 0; requestDraw();
  }
  document.querySelectorAll('[data-domain]').forEach(button => button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    document.querySelectorAll('[data-domain]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    previousShape = domain.shape; domain = domains[button.dataset.domain];
    blend = reducedMotion.matches ? 1 : 0;
    if (reducedMotion.matches) currentHue = domain.hue;
    ['label-a', 'label-b', 'label-c'].forEach((id, i) => { document.getElementById(id).textContent = domain.labels[i]; });
    document.getElementById('scene-description').textContent = domain.description;
    requestDraw();
  }));
  motion.addEventListener('click', () => { paused = !paused; updateMotion(); });
  reducedMotion.addEventListener('change', event => { paused = event.matches; updateMotion(); });
  scene.addEventListener('keydown', event => {
    if (event.target !== scene || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .15;
    if (event.key === 'ArrowRight') yaw += .15;
    if (event.key === 'ArrowUp') pitch = Math.max(-1.2, pitch - .15);
    if (event.key === 'ArrowDown') pitch = Math.min(1.2, pitch + .15);
    requestDraw();
  });
  scene.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    drag = { x: event.clientX, y: event.clientY };
    scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove', event => {
    if (!drag) return;
    yaw += (event.clientX - drag.x) * .008;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (event.clientY - drag.y) * .006));
    drag = { x: event.clientX, y: event.clientY }; requestDraw();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => scene.addEventListener(name, () => { drag = null; requestDraw(); }));
  if (ctx) {
    new ResizeObserver(resize).observe(scene);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; lastTime = 0; if (visible) requestDraw(); }).observe(scene);
    document.addEventListener('visibilitychange', () => { lastTime = 0; if (!document.hidden) requestDraw(); });
    updateMotion(); resize();
  } else {
    scene.setAttribute('aria-label', 'Engineering skills across AI systems, frontend, and cloud platforms.');
    motion.hidden = true;
  }
  const lab = document.getElementById('hackathon-lab');
  document.getElementById('close-lab').addEventListener('click', () => {
    const summary = lab.querySelector('summary');
    lab.open = false;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  const projects = {
    screen: { title: 'ScreenStitcher', description: 'A browser extension for capturing multiple screen regions and composing them into a single, shareable PDF.', details: ['Capture the regions that matter across multiple screenshots.', 'Combine captures into one PDF for sharing and reference.'] },
    traffic: { title: 'TrafficLens', description: 'A developer-focused browser extension for inspecting Fetch and XHR network activity.', details: ['Track pending and completed network requests during frontend development.', 'Understand application traffic without losing the context of the page.'] },
  };
  const dialog = document.getElementById('project-dialog');
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const project = projects[button.dataset.project];
    document.getElementById('dialog-title').textContent = project.title;
    document.getElementById('dialog-description').textContent = project.description;
    const list = document.createElement('ul');
    project.details.forEach(detail => { const item = document.createElement('li'); item.textContent = detail; list.append(item); });
    document.getElementById('dialog-details').replaceChildren(list);
    dialog.showModal(); document.body.classList.add('dialog-open');
  }));
  const close = () => dialog.close();
  document.getElementById('close-dialog').addEventListener('click', close);
  document.getElementById('dialog-done').addEventListener('click', close);
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) close(); });
})();
