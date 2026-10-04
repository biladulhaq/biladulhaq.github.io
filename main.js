/* ==========================================================================
   bilad.support · interactions
   Vanilla JS, no dependencies. Every moving part respects
   prefers-reduced-motion and pauses when it is off screen.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = (kind) => ({
    get(key) { try { return window[kind].getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window[kind].setItem(key, value); } catch (e) { /* storage blocked */ } },
  });
  const local = store('localStorage');
  const session = store('sessionStorage');

  const EMAIL = 'bilad900@gmail.com';
  const IN_SERVICE = new Date(2022, 11, 1); // first IT support role started Dec 2022

  window.__biladReady = true;

  // Calls fn once, the first time el scrolls into view.
  function onVisible(el, fn, threshold = 0.25) {
    if (!el) return;
    if (!hasIO) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold });
    io.observe(el);
  }

  // Returns a function that resolves once el is on screen. Looping demos await it
  // so they pause while scrolled away.
  function visibilityGate(el) {
    let visible = !hasIO;
    let waiting = [];
    if (hasIO && el) {
      new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) { waiting.forEach((resolve) => resolve()); waiting = []; }
      }, { threshold: 0.15 }).observe(el);
    }
    return () => (visible ? Promise.resolve() : new Promise((resolve) => waiting.push(resolve)));
  }

  function calendarDiff(from, to) {
    let y = to.getFullYear() - from.getFullYear();
    let m = to.getMonth() - from.getMonth();
    let d = to.getDate() - from.getDate();
    if (d < 0) { m -= 1; d += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
    if (m < 0) { y -= 1; m += 12; }
    return { y, m, d };
  }

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------- theme: night shift / day shift ---------- */
  function applyTheme(theme, { save = false, announce = false } = {}) {
    const day = theme === 'light';
    root.setAttribute('data-theme', day ? 'light' : 'dark');
    if (save) local.set('bilad-theme', day ? 'light' : 'dark');
    const btn = $('#theme-toggle');
    if (btn) {
      $('.theme-toggle__label', btn).textContent = day ? 'Day shift' : 'Night shift';
      btn.setAttribute('aria-label', day
        ? 'Day shift (light theme). Switch to night shift'
        : 'Night shift (dark theme). Switch to day shift');
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', day ? '#F3F5F9' : '#0A1020');
    window.dispatchEvent(new Event('themechange'));
    if (announce) toast(day ? 'Day shift: lights on' : 'Night shift: lights down');
  }
  const toggleTheme = () => applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', { save: true, announce: true });

  function initTheme() {
    applyTheme(root.getAttribute('data-theme'));
    $('#theme-toggle')?.addEventListener('click', toggleTheme);
  }

  /* ---------- nav ---------- */
  function initNav() {
    const nav = $('.nav');
    const burger = $('#nav-burger');
    const links = $$('.nav__links a');
    if (!nav) return;

    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      burger?.setAttribute('aria-expanded', String(open));
      burger?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    burger?.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- page-to-page transitions ---------- */
  const PAGES = [
    { file: 'index.html', alias: ['home', 'index', '~', '..', '\\', '/'] },
    { file: 'about.html', alias: ['about'] },
    { file: 'impact.html', alias: ['impact'] },
    { file: 'skills.html', alias: ['skills'] },
    { file: 'experience.html', alias: ['experience', 'education'] },
    { file: 'desk.html', alias: ['desk', 'live-desk'] },
    { file: 'after-hours.html', alias: ['after-hours', 'afterhours', 'hobbies'] },
    { file: 'contact.html', alias: ['contact'] },
  ];

  function go(href) {
    if (root.classList.contains('is-leaving')) return;
    if (reduceMotion) { window.location.href = href; return; }
    const name = href.split('/').pop().split('?')[0].split('#')[0] || 'index.html';
    const route = document.createElement('div');
    route.className = 'route';
    route.setAttribute('aria-hidden', 'true');
    route.innerHTML = `<span class="route__bar"></span><span class="route__chip">PS&gt; Start-Process ${esc(name)}</span>`;
    document.body.appendChild(route);
    root.classList.add('is-leaving');
    setTimeout(() => { window.location.href = href; }, 380);
  }

  function initPageTransitions() {
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !/\.html$/i.test(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      go(url.href);
    });
    // Coming back with the browser's Back button can restore a frozen "leaving" page.
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      root.classList.remove('is-leaving');
      $$('.route').forEach((r) => r.remove());
    });
  }

  /* ---------- scroll progress + timeline fill ---------- */
  function initScrollEffects() {
    const bar = $('.progress span');
    const timeline = $('.timeline');
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = root.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      if (timeline) {
        const r = timeline.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (window.innerHeight * 0.65 - r.top) / r.height));
        timeline.style.setProperty('--p', p.toFixed(3));
      }
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ---------- boot screen ---------- */
  const BOOT_LINES = [
    { text: 'BILAD-BIOS v3.10 · (C) 2022-2026 Muhammad Bilad Ul Haq', cls: 'dim' },
    { tag: 'OK', text: 'Detected role: IT Support Specialist' },
    { tag: 'OK', text: 'Face ID verified: Muhammad Bilad Ul Haq' },
    { tag: 'OK', text: 'Memory check: 3+ years of help desk experience' },
    { tag: 'OK', text: 'Started Active Directory services' },
    { tag: 'OK', text: 'Connected to Microsoft 365 tenant' },
    { tag: 'OK', text: 'Network up: LAN/WAN, DNS, DHCP, VPN' },
    { tag: 'OK', text: 'Loaded ITIL v4 service management' },
    { tag: 'WAIT', text: 'Installing update: CompTIA Network+ (N10-009)' },
    { text: 'All systems operational. Welcome, visitor.', cls: 'accent' },
  ];

  function runBoot() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'overlay boot';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<div class="boot__screen"><div class="boot__log"></div><p class="boot__skip">Press any key or tap to skip</p></div>';
      document.body.appendChild(overlay);
      root.classList.remove('booting');
      document.body.style.overflow = 'hidden';

      const log = $('.boot__log', overlay);
      let index = 0;
      let timer = 0;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener('keydown', finish);
        overlay.removeEventListener('pointerdown', finish);
        overlay.classList.add('is-done');
        document.body.style.overflow = '';
        setTimeout(() => overlay.remove(), 600);
        resolve();
      };
      const next = () => {
        if (index >= BOOT_LINES.length) { timer = setTimeout(finish, 520); return; }
        const line = BOOT_LINES[index++];
        const row = document.createElement('span');
        row.className = `boot__line ${line.cls || ''}`;
        const tag = line.tag
          ? `<b class="boot__tag boot__tag--${line.tag.toLowerCase()}">[${line.tag === 'OK' ? '  OK  ' : ' WAIT '}]</b> `
          : '';
        row.innerHTML = tag + esc(line.text);
        log.appendChild(row);
        timer = setTimeout(next, index === 1 ? 300 : rand(90, 170));
      };

      window.addEventListener('keydown', finish);
      overlay.addEventListener('pointerdown', finish);
      timer = setTimeout(next, 220);
    });
  }

  /* ---------- hero: name decrypt + role typer ---------- */
  function scramble(el, duration) {
    const finalText = el.dataset.text || (el.dataset.text = el.textContent);
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>';
    const start = performance.now();
    return new Promise((resolve) => {
      let done = false;
      // Safety net: if animation frames stall (background tab), still land on the real name.
      setTimeout(() => {
        if (done) return;
        done = true;
        el.textContent = finalText;
        resolve();
      }, duration + 600);
      const frame = (now) => {
        if (done) return;
        const p = Math.min(1, (now - start) / duration);
        const settled = Math.floor(p * finalText.length);
        let out = '';
        for (let i = 0; i < finalText.length; i++) {
          const ch = finalText[i];
          if (i < settled || ch === ' ') { out += ch; continue; }
          const g = glyphs[Math.floor(Math.random() * glyphs.length)];
          out += ch === ch.toLowerCase() ? g.toLowerCase() : g;
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame);
        else { done = true; el.textContent = finalText; resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  function heroIntro() {
    root.classList.remove('is-ready');
    void root.offsetWidth; // restart the CSS rise animations on reboot
    root.classList.add('is-ready');
    if (reduceMotion) return;
    setTimeout(() => scanPhoto(), 900);
    $$('[data-scramble]').forEach((el, i) => setTimeout(() => scramble(el, 850 + i * 350), 180 + i * 160));
  }

  let rolesStarted = false;
  function initRoles() {
    const el = $('#role-text');
    if (!el || reduceMotion || rolesStarted) return;
    rolesStarted = true;
    const roles = [
      'IT Support Specialist',
      'Help desk & desktop support',
      'Microsoft 365 & Active Directory',
      'Network troubleshooter',
      'ITIL incident management',
      'Website builder, after hours',
      'AI explorer, after hours',
    ];
    let i = 0;
    (async () => {
      await sleep(2600);
      for (;;) {
        let text = el.textContent;
        while (text.length) {
          text = text.slice(0, -1);
          el.textContent = text;
          await sleep(22);
        }
        i = (i + 1) % roles.length;
        const next = roles[i];
        for (let c = 1; c <= next.length; c++) {
          el.textContent = next.slice(0, c);
          await sleep(rand(38, 75));
        }
        await sleep(2200);
      }
    })();
  }

  /* ---------- hero: live clock, uptime, barcode, tilt ---------- */
  function initClock() {
    const timeEl = $('#local-time');
    const upEl = $('#uptime');
    let fmt = null;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) { fmt = null; }
    const tick = () => {
      const now = new Date();
      if (timeEl && fmt) timeEl.textContent = fmt.format(now);
      if (upEl) {
        const d = calendarDiff(IN_SERVICE, now);
        upEl.textContent = `${d.y}y ${pad(d.m)}m ${pad(d.d)}d ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }
    };
    tick();
    setInterval(tick, 1000);
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initBarcode() {
    const el = $('#barcode');
    if (!el) return;
    const code = el.dataset.code || 'BLD';
    let seed = 7;
    for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 44; i++) {
      const bar = document.createElement('i');
      bar.style.width = `${1 + Math.floor(next() * 3)}px`;
      bar.style.marginRight = `${1 + Math.floor(next() * 3)}px`;
      frag.appendChild(bar);
    }
    el.appendChild(frag);
  }

  function initTilt() {
    const card = $('#tag-card');
    if (!card || !finePointer || reduceMotion) return;
    const inner = $('.tag-card__inner', card);
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--ry', `${(px * 12).toFixed(2)}deg`);
      inner.style.setProperty('--rx', `${(-py * 12).toFixed(2)}deg`);
      inner.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------- hero: ID photo biometric scan ---------- */
  let scanPhoto = () => {};
  function initScanPhoto() {
    const box = $('#scan-photo');
    if (!box) return;
    const img = $('.scan-photo__img', box);
    const canvas = $('.scan-photo__pixels', box);
    const matchEl = $('#face-match');
    const access = $('#ident-access');
    if (reduceMotion) return; // keep the finished, verified state

    // Low-res copy of the photo, cropped the same way object-fit: cover crops the <img>.
    const drawPixels = () => {
      const ctx = canvas.getContext('2d');
      const n = 22;
      canvas.width = n;
      canvas.height = n;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, n, n);
    };
    if (img.complete && img.naturalWidth) drawPixels();
    else img.addEventListener('load', drawPixels, { once: true });

    const setAccess = (ok) => {
      access.className = `ident__access ident__access--${ok ? 'ok' : 'wait'}`;
      $('span', access).textContent = ok ? 'Access granted' : 'Verifying...';
      if (ok) {
        void access.offsetWidth;
        access.classList.add('is-pop');
      }
    };
    const countMatch = (duration) => {
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        matchEl.textContent = (99.8 * (1 - Math.pow(1 - p, 3))).toFixed(1);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => { matchEl.textContent = '99.8'; }, duration + 200);
    };

    let running = false;
    scanPhoto = async () => {
      if (running) return;
      running = true;
      box.classList.remove('is-done', 'is-scanning', 'is-sweep');
      box.classList.add('is-armed');
      setAccess(false);
      matchEl.textContent = '0.0';
      void box.offsetWidth;
      box.classList.add('is-scanning');
      countMatch(1800);
      await sleep(1850);
      box.classList.remove('is-armed', 'is-scanning');
      box.classList.add('is-done');
      setAccess(true);
      running = false;
    };

    // Pixelated and waiting until the hero intro starts the first scan.
    box.classList.add('is-armed');
    setAccess(false);
    matchEl.textContent = '0.0';

    box.addEventListener('click', () => {
      if (running) return;
      scanPhoto();
      toast('Re-scanning identity...');
    });

    // Light idle sweep every few seconds while the hero is on screen.
    let heroVisible = true;
    if (hasIO) {
      new IntersectionObserver((entries) => { heroVisible = entries[0].isIntersecting; }).observe(box);
    }
    setInterval(() => {
      if (running || document.hidden || !heroVisible || !box.classList.contains('is-done')) return;
      box.classList.remove('is-sweep');
      void box.offsetWidth;
      box.classList.add('is-sweep');
      setTimeout(() => box.classList.remove('is-sweep'), 1600);
    }, 9000);
  }

  /* ---------- hero: network of nodes passing packets ---------- */
  function initNetwork() {
    const canvas = $('#net-canvas');
    const hero = $('#hero');
    if (!canvas || !canvas.getContext || !hero) return;
    const ctx = canvas.getContext('2d');
    const LINK = 140;
    const MOUSE_LINK = 190;
    let W = 0;
    let H = 0;
    let nodes = [];
    let packets = [];
    let ripples = [];
    let raf = 0;
    let last = 0;
    let spawnClock = 0;
    let inView = true;
    let colors = {};
    const mouse = { x: 0, y: 0, on: false };

    const readColors = () => {
      const cs = getComputedStyle(root);
      colors = {
        node: cs.getPropertyValue('--net-node').trim() || '150, 175, 220',
        a: cs.getPropertyValue('--net-a').trim() || '255, 181, 71',
        b: cs.getPropertyValue('--net-b').trim() || '61, 220, 151',
      };
    };

    const seedNodes = () => {
      const count = Math.round(Math.max(26, Math.min(85, (W * H) / 15000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rand(-9, 9),
        vy: rand(-9, 9),
        r: rand(1.2, 2.4),
        hub: Math.random() < 0.1,
      }));
      packets = [];
      ripples = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthChanged = Math.abs(rect.width - W) > 1;
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (widthChanged || !nodes.length) seedNodes();
      if (!raf) draw();
    };

    const neighbours = (i) => {
      const a = nodes[i];
      const out = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = a.x - nodes[j].x;
        const dy = a.y - nodes[j].y;
        if (dx * dx + dy * dy < LINK * LINK) out.push(j);
      }
      return out;
    };

    const spawn = () => {
      const from = Math.floor(Math.random() * nodes.length);
      const near = neighbours(from);
      if (!near.length) return;
      packets.push({
        from, to: pick(near), t: 0,
        speed: rand(90, 170),
        hops: randInt(2, 6),
        c: Math.random() < 0.72 ? 'a' : 'b',
      });
    };

    const update = (dt) => {
      const s = dt / 1000;
      for (const n of nodes) {
        n.x += n.vx * s;
        n.y += n.vy * s;
        if (n.x < 0 || n.x > W) { n.vx *= -1; n.x = Math.max(0, Math.min(W, n.x)); }
        if (n.y < 0 || n.y > H) { n.vy *= -1; n.y = Math.max(0, Math.min(H, n.y)); }
        if (mouse.on) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110 && d2 > 1) {
            const d = Math.sqrt(d2);
            const push = ((110 - d) / 110) * 60 * s;
            n.x += (dx / d) * push;
            n.y += (dy / d) * push;
          }
        }
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const a = nodes[p.from];
        const b = nodes[p.to];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > LINK * 1.3) { packets.splice(i, 1); continue; }
        p.t += (p.speed * s) / Math.max(dist, 1);
        if (p.t >= 1) {
          p.hops -= 1;
          const near = neighbours(p.to).filter((k) => k !== p.from);
          if (p.hops > 0 && near.length) {
            p.from = p.to;
            p.to = pick(near);
            p.t = 0;
          } else {
            ripples.push({ x: b.x, y: b.y, r: 2, life: 0.9, c: p.c });
            packets.splice(i, 1);
          }
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 30 * s;
        r.life -= 1.2 * s;
        if (r.life <= 0) ripples.splice(i, 1);
      }
      spawnClock += dt;
      if (spawnClock > 230 && packets.length < 24) { spawnClock = 0; spawn(); }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // Links, bucketed by strength so each bucket is one stroke call.
      const buckets = [[], [], [], []];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const k = Math.min(3, Math.floor((1 - Math.sqrt(d2) / LINK) * 4));
            buckets[k].push(a, b);
          }
        }
      }
      ctx.lineWidth = 1;
      buckets.forEach((seg, k) => {
        if (!seg.length) return;
        ctx.strokeStyle = `rgba(${colors.node}, ${0.05 + k * 0.06})`;
        ctx.beginPath();
        for (let s = 0; s < seg.length; s += 2) {
          ctx.moveTo(seg[s].x, seg[s].y);
          ctx.lineTo(seg[s + 1].x, seg[s + 1].y);
        }
        ctx.stroke();
      });

      if (mouse.on) {
        ctx.strokeStyle = `rgba(${colors.a}, 0.5)`;
        for (const n of nodes) {
          const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (d < MOUSE_LINK) {
            ctx.globalAlpha = 1 - d / MOUSE_LINK;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = `rgba(${colors.node}, 0.6)`;
      ctx.beginPath();
      for (const n of nodes) {
        ctx.moveTo(n.x + n.r, n.y);
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = `rgba(${colors.node}, 0.45)`;
      for (const n of nodes) if (n.hub) ctx.strokeRect(n.x - 4.5, n.y - 4.5, 9, 9);

      for (const r of ripples) {
        ctx.strokeStyle = `rgba(${colors[r.c]}, ${Math.max(0, r.life) * 0.6})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const p of packets) {
        const a = nodes[p.from];
        const b = nodes[p.to];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const tail = Math.max(0, p.t - 0.3);
        const tx = a.x + (b.x - a.x) * tail;
        const ty = a.y + (b.y - a.y) * tail;
        const c = colors[p.c];
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, `rgba(${c}, 0)`);
        grad.addColorStop(1, `rgba(${c}, 0.9)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = `rgba(${c}, 0.2)`;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${c}, 1)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 1;
    };

    const frame = (now) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || reduceMotion || !inView || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    readColors();
    resize();
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
    window.addEventListener('themechange', () => { readColors(); if (!raf) draw(); });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (hasIO) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }).observe(hero);
    }
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.on = true;
      });
      hero.addEventListener('pointerleave', () => { mouse.on = false; });
    }
    start();
  }

  /* ---------- marquee ---------- */
  function initMarquee() {
    $$('.marquee__track').forEach((track) => {
      Array.from(track.children).forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
    });
  }

  /* ---------- reveal, counters, typed eyebrows ---------- */
  function initReveal() {
    $$('.chips').forEach((list) => $$('li', list).forEach((li, i) => li.style.setProperty('--i', i)));
    const targets = $$('.reveal');
    if (!hasIO) { targets.forEach((t) => t.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((t) => io.observe(t));
  }

  function initCounters() {
    $$('[data-chip-count]').forEach((el) => {
      const card = el.closest('.skill-card');
      const n = card ? $$('.chips li', card).length : 0;
      if (n) el.textContent = String(n);
    });
    const els = $$('[data-count]');
    if (reduceMotion || !hasIO) return;
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const duration = 1500;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    els.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  function initEyebrows() {
    if (reduceMotion || !hasIO) return;
    $$('[data-type]').forEach((el) => {
      const full = el.textContent;
      const prefix = 'PS> ';
      if (!full.startsWith(prefix)) return;
      el.textContent = prefix;
      el.classList.add('is-typing');
      onVisible(el, async () => {
        await sleep(200);
        for (let i = prefix.length + 1; i <= full.length; i++) {
          el.textContent = full.slice(0, i);
          await sleep(rand(28, 60));
        }
        await sleep(900);
        el.classList.remove('is-typing');
      }, 0.9);
    });
  }

  /* ---------- pointer niceties ---------- */
  function initPointerEffects() {
    if (!finePointer) return;
    $$('.spotlight').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
    if (reduceMotion) return;
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${(x * 0.18).toFixed(1)}px, ${(y * 0.3).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- job durations ---------- */
  function initDurations() {
    const now = new Date();
    $$('[data-from]').forEach((el) => {
      const [fy, fm] = el.dataset.from.split('-').map(Number);
      let ty = now.getFullYear();
      let tm = now.getMonth() + 1;
      if (el.dataset.to) [ty, tm] = el.dataset.to.split('-').map(Number);
      const months = (ty - fy) * 12 + (tm - fm) + 1;
      const y = Math.floor(months / 12);
      const m = months % 12;
      const parts = [];
      if (y) parts.push(`${y} yr${y > 1 ? 's' : ''}`);
      if (m) parts.push(`${m} mo${m > 1 ? 's' : ''}`);
      if (parts.length) el.textContent = parts.join(' ');
    });
  }

  /* ---------- PowerShell terminal ---------- */
  function initTerminal() {
    const term = $('#terminal');
    if (!term) return;
    const out = $('#term-out');
    const body = $('#term-body');
    const form = $('#term-form');
    const input = $('#term-input');
    const history = [];
    let historyIndex = 0;
    let busy = false;

    const scrollDown = () => { body.scrollTop = body.scrollHeight; };
    const print = (html, cls = '') => {
      const row = document.createElement('div');
      row.className = `term-row ${cls}`;
      row.innerHTML = html;
      out.appendChild(row);
      scrollDown();
      return row;
    };
    const echo = (cmd) => print(`<span class="term-ps">PS C:\\Users\\visitor&gt;</span> <span class="term-cmd">${esc(cmd)}</span>`);

    const commands = {};
    const aliases = {};
    const define = (name, alias, desc, fn, hidden = false) => {
      const key = name.toLowerCase();
      commands[key] = { name, desc, fn, hidden };
      aliases[key] = key;
      alias.forEach((a) => { aliases[a.toLowerCase()] = key; });
    };
    const visibleNames = () => Object.values(commands).filter((c) => !c.hidden).map((c) => c.name);

    define('help', ['?', 'get-help', 'man'], 'Show this list', () => {
      const rows = Object.values(commands)
        .filter((c) => !c.hidden)
        .map((c) => `  <span class="t-y">${c.name.padEnd(18)}</span>${esc(c.desc)}`);
      return { cls: 'pre', html: `Available commands:\n\n${rows.join('\n')}\n\n<span class="t-dim">Tab completes a command. Up and down arrows browse history.</span>` };
    });

    define('whoami', [], 'Who is Bilad?', () => (
      `bilad-pc\\bilad\n\n<b>Muhammad Bilad Ul Haq</b>\nIT Support Specialist · Khobar, Dammam, KSA\n3+ years of help desk and desktop support in Saudi Arabia and Pakistan.\nNow on-site at Sinopec Petroleum (via EFFC), supporting 55+ users.`
    ));

    define('Get-Skills', ['skills'], 'Skills by category', () => ({
      cls: 'pre',
      html: `<span class="t-dim">Category                Highlights\n--------                ----------</span>
Help desk &amp; desktop     Tier 1/2, deskside + remote, onboarding
ITSM &amp; ITIL             ServiceNow, Jira SM, SLA, RCA, KB + SOPs
Microsoft &amp; endpoints   Windows 10/11, AD, GPO, M365, Intune
Networking &amp; security   TCP/IP, DNS, DHCP, VPN, MFA, patching
Assets &amp; licensing      Lifecycle, SAM, M365 licensing
Scripting &amp; docs        PowerShell, CMD/batch, documentation`,
    }));

    define('Get-Experience', ['experience', 'get-history', 'jobs'], 'Work history', () => ({
      cls: 'pre',
      html: `<span class="t-y">Jan 2025 - Present</span>   IT Support Specialist
                     EFFC, on-site at Sinopec Petroleum · Riyadh
                     55+ users · 95%+ SLA · 150+ assets · 2 staff supervised

<span class="t-y">Dec 2022 - Jan 2025</span>  IT Support, Tier 1
                     Abacus Consulting · Pakistan
                     130+ users · 30+ tickets/week · 70%+ first-contact fix`,
    }));

    define('Get-Education', ['education', 'get-credential', 'certs'], 'Degree and certification', () => (
      `<b>BSc Information Technology</b> · University of the Punjab, Pakistan\nMajor: Networking and Programming\n\n<span class="t-y">CompTIA Network+ (N10-009)</span> · preparing for the exam <span class="t-dim">[########----] installing</span>`
    ));

    define('Get-Languages', ['languages'], 'Spoken languages', () => ({
      cls: 'pre',
      html: `English   [####-]  Professional working proficiency
Urdu      [#####]  Native
Arabic    [###--]  Conversational, supports Arabic-speaking users`,
    }));

    define('Get-Hobbies', ['hobbies', 'after-hours'], 'What I do after hours', () => (
      `<span class="t-y">1.</span> Building websites with HTML, CSS and JavaScript\n<span class="t-y">2.</span> Exploring AI tools for scripting, docs and troubleshooting\n\nMore: <a href="after-hours.html">after-hours.html</a>`
    ));

    define('Get-Contact', ['contact'], 'How to reach me', () => (
      `Email     <a href="mailto:${EMAIL}">${EMAIL}</a>\nPhone     <a href="tel:+966562775409">+966 56 277 5409</a>\nLinkedIn  <a href="https://www.linkedin.com/in/bilad-ul-haq-8737a3341" target="_blank" rel="noopener">linkedin.com/in/bilad-ul-haq</a>`
    ));

    define('Test-Connection', ['ping'], 'Check if Bilad is reachable', async () => {
      print('Pinging bilad.support [10.0.0.7] with 32 bytes of data:');
      const times = [];
      for (let i = 0; i < 4; i++) {
        await sleep(reduceMotion ? 0 : 420);
        const t = randInt(8, 24);
        times.push(t);
        print(`Reply from 10.0.0.7: bytes=32 time=${t}ms TTL=128`);
      }
      await sleep(reduceMotion ? 0 : 300);
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      print(`\nPing statistics for 10.0.0.7:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)\n    Average = ${avg}ms\n\n<span class="t-g">Bilad is online.</span> Fastest route: <a href="mailto:${EMAIL}">${EMAIL}</a>`);
      return null;
    });

    define('Get-Date', ['date', 'time'], 'Current time in Khobar', () => {
      try {
        return new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' (Khobar, AST)';
      } catch (e) {
        return new Date().toString();
      }
    });

    define('neofetch', ['systeminfo'], 'System summary', () => {
      const d = calendarDiff(IN_SERVICE, new Date());
      const art = [
        '<span class="t-c">  .-----------------.  </span>',
        '<span class="t-c">  |  .-----------.  |  </span>',
        '<span class="t-c">  |  |  </span><span class="t-y">&gt;_</span><span class="t-c">       |  |  </span>',
        '<span class="t-c">  |  |           |  |  </span>',
        '<span class="t-c">  |  \'-----------\'  |  </span>',
        '<span class="t-c">  \'-------. .-------\'  </span>',
        '<span class="t-c">       ___| |___       </span>',
        '<span class="t-c">      \'---------\'      </span>',
      ];
      const info = [
        '<span class="t-y">visitor</span>@<span class="t-y">bilad</span>',
        '-------------',
        `<span class="t-y">Role</span>    IT Support Specialist`,
        `<span class="t-y">Base</span>    Khobar, Dammam, KSA`,
        `<span class="t-y">Uptime</span>  ${d.y} years, ${d.m} months`,
        `<span class="t-y">Stack</span>   Windows, M365, AD, ITIL v4`,
        `<span class="t-y">Shell</span>   PowerShell`,
        `<span class="t-y">Langs</span>   English, Urdu, Arabic`,
      ];
      return { cls: 'pre', html: art.map((line, i) => `${line}  ${info[i] || ''}`).join('\n') };
    });

    define('ipconfig', [], 'Network configuration', () => ({
      cls: 'pre',
      html: `Windows IP Configuration

Ethernet adapter Visitor:

   Connection-specific DNS Suffix  . : bilad.support
   IPv4 Address. . . . . . . . . . . : 127.0.0.1 <span class="t-dim">(there's no place like home)</span>
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : <a href="contact.html">contact.html</a>`,
    }));

    define('gpupdate', [], 'Refresh group policy', async () => {
      print('Updating policy...');
      await sleep(reduceMotion ? 0 : 900);
      print('\nComputer Policy update has completed successfully.\n<span class="t-g">User Policy update has completed successfully.</span>');
      return null;
    });

    define('cv', ['resume', 'get-cv'], 'Open my CV (PDF)', () => {
      window.open('cv.pdf', '_blank', 'noopener');
      return 'Opening cv.pdf in a new tab...';
    });

    define('hire', ['start-hiring', 'new-ticket'], 'Open a P1 ticket to hire me', () => {
      setTimeout(() => go('contact.html?priority=P1'), 700);
      return '<span class="t-g">Creating P1 ticket...</span> Opening contact.html.';
    });

    define('ls', ['dir', 'get-childitem', 'gci'], 'List the pages on this site', () => {
      const date = new Date().toLocaleDateString('en-GB');
      const rows = PAGES.map((p) => `-a----        ${date}     09:00         <a href="${p.file}">${p.file}</a>`);
      return {
        cls: 'pre',
        html: `\n    Directory: C:\\bilad.support\n\nMode                 LastWriteTime         Name\n----                 -------------         ----\n${rows.join('\n')}\n\n<span class="t-dim">Open one with cd, for example:</span> <span class="t-y">cd skills</span>`,
      };
    });

    define('cd', ['set-location', 'chdir', 'open'], 'Open a page, e.g. cd skills', (args) => {
      const raw = (args[0] || '').toLowerCase().replace(/^\.[\\/]/, '').replace(/\.html$/, '');
      if (!raw) return 'C:\\bilad.support';
      const page = PAGES.find((p) => p.alias.includes(raw) || p.file === `${raw}.html`);
      if (!page) {
        return { cls: 't-err', html: `cd : Cannot find path 'C:\\bilad.support\\${esc(args[0])}' because it does not exist.\nType <span class="t-y">ls</span> to see the pages.` };
      }
      setTimeout(() => go(page.file), 500);
      return `Opening <span class="t-y">${page.file}</span>...`;
    });

    define('theme', ['toggle-theme'], 'Switch night shift / day shift', () => {
      toggleTheme();
      return `Theme set to ${root.getAttribute('data-theme') === 'light' ? 'day shift (light)' : 'night shift (dark)'}.`;
    });

    define('Restart-Computer', ['reboot', 'restart'], 'Turn it off and on again', async () => {
      for (const n of [3, 2, 1]) {
        print(`Restarting in ${n}...`, 't-y');
        await sleep(reduceMotion ? 0 : 500);
      }
      reboot();
      return null;
    });

    define('history', ['h'], 'Commands you have run', () => (
      history.length ? history.map((c, i) => `  ${String(i + 1).padStart(3)}  ${esc(c)}`).join('\n') : 'No history yet.'
    ));

    define('clear', ['cls', 'clear-host'], 'Clear the screen', () => { out.innerHTML = ''; return null; });

    define('exit', ['logout', 'quit'], 'Close the session', () => (
      'This session cannot close while a ticket is still open. Try <span class="t-y">hire</span>.'
    ));

    define('Stop-Computer', ['bsod', 'shutdown'], 'Do not run this', () => { setTimeout(bsod, 300); return '<span class="t-err">Warning: that was a bad idea.</span>'; }, true);
    define('Get-Coffee', ['coffee'], 'Refuel', () => 'Error 418: I\'m a teapot. Try chai instead.', true);

    async function run(raw) {
      const cmd = raw.trim();
      echo(cmd);
      if (!cmd) return;
      history.push(cmd);
      historyIndex = history.length;
      const [head, ...args] = cmd.split(/\s+/);
      const lower = head.toLowerCase();
      if (lower === 'sudo') {
        print(`sudo : The term 'sudo' is not recognized. This is PowerShell, not Linux.\nNice try though. Try <span class="t-y">hire</span> instead.`, 't-err');
        return;
      }
      const key = aliases[lower];
      if (!key) {
        print(`${esc(head)} : The term '${esc(head)}' is not recognized as the name of a cmdlet, function, script file, or operable program.\nType <span class="t-y">help</span> to see what's available.`, 't-err');
        return;
      }
      busy = true;
      try {
        const result = await commands[key].fn(args);
        if (result && typeof result === 'object') print(result.html, result.cls);
        else if (result) print(result);
      } finally {
        busy = false;
      }
    }

    async function typeAndRun(cmd) {
      if (busy) return;
      busy = true;
      input.value = '';
      for (const ch of cmd) {
        input.value += ch;
        await sleep(reduceMotion ? 0 : 40);
      }
      await sleep(reduceMotion ? 0 : 140);
      input.value = '';
      busy = false;
      await run(cmd);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) return;
      const value = input.value;
      input.value = '';
      run(value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex -= 1; input.value = history[historyIndex]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < history.length - 1) { historyIndex += 1; input.value = history[historyIndex]; }
        else { historyIndex = history.length; input.value = ''; }
      } else if (e.key === 'Tab') {
        const value = input.value.trim().toLowerCase();
        if (!value) return; // let Tab move focus as usual
        e.preventDefault();
        const matches = visibleNames().filter((n) => n.toLowerCase().startsWith(value));
        if (matches.length === 1) input.value = `${matches[0]} `;
        else if (matches.length > 1) print(matches.join('   '), 't-dim');
      } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
        e.preventDefault();
        out.innerHTML = '';
      }
    });

    body.addEventListener('click', () => {
      if (!window.getSelection().toString()) input.focus({ preventScroll: true });
    });
    $$('[data-cmd]', term).forEach((btn) => btn.addEventListener('click', () => typeAndRun(btn.dataset.cmd)));

    $$('[data-win]', term).forEach((btn) => btn.addEventListener('click', () => {
      const action = btn.dataset.win;
      if (action === 'min') {
        term.classList.toggle('is-min');
        term.classList.remove('is-max');
      } else if (action === 'max') {
        term.classList.toggle('is-max');
        term.classList.remove('is-min');
        scrollDown();
      } else {
        term.classList.remove('is-min');
        term.classList.remove('is-shake');
        void term.offsetWidth;
        term.classList.add('is-shake');
        print('Access denied: this window is load-bearing. Try <span class="t-y">exit</span> if you dare.', 't-err');
      }
    }));

    // Introduce itself the first time it scrolls into view.
    onVisible(term, async () => {
      await sleep(600);
      if (history.length) return;
      await typeAndRun('whoami');
    }, 0.5);
  }

  /* ---------- live service desk simulation ---------- */
  function initDesk() {
    const list = $('#tickets');
    const section = $('#desk');
    if (!list || !section) return;
    const el = {
      resolved: $('#d-resolved'),
      open: $('#d-open'),
      avg: $('#d-avg'),
      you: $('#d-you'),
      msg: $('#d-msg'),
      pause: $('#desk-pause'),
    };

    const TEMPLATES = [
      { type: 'INC', title: 'Outlook keeps asking for a password', cat: 'Microsoft 365', fix: 'Cleared cached credentials and rebuilt the Outlook profile' },
      { type: 'INC', title: 'Account locked out after the weekend', cat: 'Active Directory', fix: 'Unlocked the account, reset the password, confirmed MFA' },
      { type: 'RITM', title: 'New joiner: laptop and Microsoft 365 account', cat: 'Onboarding', fix: 'Imaged the laptop, created the account, assigned a license' },
      { type: 'INC', title: 'VPN will not connect from home', cat: 'Network', fix: 'Updated the VPN client and re-imported the profile' },
      { type: 'INC', title: 'Printer offline in the admin office', cat: 'Printers', fix: 'Cleared the spooler and re-mapped the print queue' },
      { type: 'INC', title: 'Teams microphone not detected', cat: 'Microsoft 365', fix: 'Reset the audio device and updated the driver' },
      { type: 'INC', title: 'Wi-Fi keeps dropping in the meeting room', cat: 'Network', fix: 'Moved the access point channel; link is stable' },
      { type: 'RITM', title: 'BitLocker recovery key needed', cat: 'Security', fix: 'Verified identity and retrieved the key from AD' },
      { type: 'INC', title: 'OneDrive stuck on "Processing changes"', cat: 'Microsoft 365', fix: 'Reset the OneDrive client; sync resumed' },
      { type: 'RITM', title: 'Install engineering software', cat: 'Software', fix: 'Packaged and deployed the approved version' },
      { type: 'RITM', title: 'Leaver: disable account and recover laptop', cat: 'Active Directory', fix: 'Disabled the account; laptop back in stock' },
      { type: 'INC', title: 'Shared drive not reachable', cat: 'Network', fix: 'Fixed a stale DNS record and flushed the cache' },
      { type: 'RITM', title: 'Shared mailbox access for Finance', cat: 'Exchange Online', fix: 'Granted Full Access and Send As permissions' },
      { type: 'INC', title: 'PC very slow after an update', cat: 'Desktop', fix: 'Removed startup bloat and rolled back a bad driver' },
      { type: 'RITM', title: 'Asset tags for four new monitors', cat: 'Assets', fix: 'Tagged the monitors and updated the register' },
      { type: 'INC', title: 'Second screen not detected', cat: 'Hardware', fix: 'Replaced the DisplayPort cable; screen detected' },
    ];
    const DEPTS = ['Finance', 'HSE', 'Site engineering', 'HR', 'Procurement', 'Admin office', 'Operations', 'Warehouse', 'Management'];
    const PRIORITIES = [
      { p: 1, label: 'P1 Critical', weight: 0.06, mins: [4, 15] },
      { p: 2, label: 'P2 High', weight: 0.22, mins: [8, 30] },
      { p: 3, label: 'P3 Moderate', weight: 0.47, mins: [12, 55] },
      { p: 4, label: 'P4 Low', weight: 0.25, mins: [15, 90] },
    ];
    const STATES = { new: 'New', progress: 'In progress', resolved: 'Resolved' };
    const TICK = 250;

    let seq = randInt(10200, 10900);
    const tickets = [];
    const stats = { resolved: 0, minutes: 0, you: 0 };
    let visible = false;
    let paused = false;
    let spawnIn = 1800;

    const pickPriority = () => {
      let r = Math.random();
      for (const p of PRIORITIES) { r -= p.weight; if (r <= 0) return p; }
      return PRIORITIES[2];
    };

    const setState = (t, state) => {
      t.state = state;
      const node = $('.state', t.el);
      node.className = `state state--${state}`;
      $('.state__txt', node).textContent = STATES[state];
    };

    const bump = (valueEl) => {
      const box = valueEl?.closest('.desk-stat');
      if (!box) return;
      box.classList.remove('is-bump');
      void box.offsetWidth;
      box.classList.add('is-bump');
    };

    const updateStats = () => {
      const open = tickets.filter((t) => t.state !== 'resolved').length;
      el.resolved.textContent = String(stats.resolved);
      el.open.textContent = String(open);
      el.avg.textContent = stats.resolved ? `${Math.round(stats.minutes / stats.resolved)} min` : '--';
      el.you.textContent = String(stats.you);
    };

    const youMessage = () => {
      const n = stats.you;
      if (n >= 10) return 'Ten assists. You are officially on the rota.';
      if (n >= 5) return 'Five assists. Bilad would happily train you.';
      if (n >= 3) return 'Three tickets closed. You are a natural.';
      if (n >= 1) return 'Nice fix. Ticket closed inside SLA.';
      return 'Press Assist on any open ticket.';
    };

    const remove = (t) => {
      const i = tickets.indexOf(t);
      if (i > -1) tickets.splice(i, 1);
      t.el.classList.add('is-leaving');
      setTimeout(() => t.el.remove(), 420);
    };

    const resolve = (t, byVisitor) => {
      if (t.state === 'resolved') return;
      setState(t, 'resolved');
      t.resolvedFor = 0;
      t.el.classList.add('is-resolved');
      const fix = $('.ticket__fix', t.el);
      $('span', fix).textContent = `${t.fix} · ${t.mins} min`;
      fix.hidden = false;
      stats.resolved += 1;
      stats.minutes += t.mins;
      bump(el.resolved);
      if (byVisitor) {
        stats.you += 1;
        bump(el.you);
        el.msg.textContent = youMessage();
        const plus = document.createElement('span');
        plus.className = 'plus';
        plus.textContent = '+1';
        t.el.appendChild(plus);
        setTimeout(() => plus.remove(), 1000);
      }
      updateStats();
    };

    const render = (t) => {
      const li = document.createElement('li');
      li.className = 'ticket';
      li.innerHTML = `
        <span class="ticket__id">${t.id}</span>
        <div class="ticket__main">
          <p class="ticket__title">${esc(t.title)}</p>
          <p class="ticket__meta">${esc(t.dept)} · ${esc(t.cat)}</p>
          <p class="ticket__fix" hidden><svg class="i" aria-hidden="true"><use href="#i-check"/></svg><span></span></p>
        </div>
        <span class="prio prio--${t.prio.p}">${t.prio.label}</span>
        <div class="ticket__state">
          <span class="state state--new"><i aria-hidden="true"></i><span class="state__txt">New</span></span>
          <button class="assist" type="button" aria-label="Assist with ${esc(t.title)}">Assist</button>
        </div>
        <span class="ticket__bar" aria-hidden="true"><span></span></span>`;
      $('.assist', li).addEventListener('click', () => resolve(t, true));
      return li;
    };

    const create = (age = 0) => {
      const onBoard = new Set(tickets.map((t) => t.title));
      const pool = TEMPLATES.filter((tpl) => !onBoard.has(tpl.title));
      const tpl = pick(pool.length ? pool : TEMPLATES);
      const prio = pickPriority();
      const t = {
        ...tpl,
        id: `${tpl.type}${pad(seq++, 7)}`,
        dept: pick(DEPTS),
        prio,
        age,
        newFor: rand(1200, 2600),
        work: rand(4000, 8500),
        mins: randInt(prio.mins[0], prio.mins[1]),
        state: 'new',
        resolvedFor: 0,
      };
      t.el = render(t);
      t.bar = $('.ticket__bar span', t.el);
      list.prepend(t.el);
      tickets.unshift(t);
      return t;
    };

    const advance = (t, ms) => {
      t.age += ms;
      if (t.state === 'new' && t.age >= t.newFor) setState(t, 'progress');
      if (t.state === 'progress') {
        const p = Math.min(1, (t.age - t.newFor) / t.work);
        t.bar.style.transform = `scaleX(${p.toFixed(3)})`;
        if (p >= 1) resolve(t, false);
      } else if (t.state === 'resolved') {
        t.resolvedFor += ms;
      }
    };

    const tick = () => {
      if (!visible || paused || document.hidden) return;
      tickets.slice().forEach((t) => advance(t, TICK));
      // Keep the board tidy: drop the oldest resolved tickets.
      const resolved = tickets.filter((t) => t.state === 'resolved');
      if (tickets.length > 6 && resolved.length) remove(resolved.pop());
      for (let i = resolved.length - 1; i >= 0 && tickets.length > 4; i--) {
        if (resolved[i].resolvedFor > 12000) remove(resolved[i]);
      }
      spawnIn -= TICK;
      if (spawnIn <= 0) {
        const open = tickets.filter((t) => t.state !== 'resolved').length;
        if (open < 4) create();
        spawnIn = rand(2200, 3800);
      }
      updateStats();
    };

    // Open in a realistic working state: one resolved, one in progress, two new.
    const seedTicket = (fraction) => {
      const t = create();
      advance(t, t.newFor + t.work * fraction);
      return t;
    };
    seedTicket(1.05);
    seedTicket(0.55);
    create();
    create();
    stats.resolved = 0;
    stats.minutes = 0;
    tickets.filter((t) => t.state === 'resolved').forEach((t) => { stats.resolved += 1; stats.minutes += t.mins; });
    updateStats();

    if (hasIO) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.15 }).observe(section);
    } else {
      visible = true;
    }
    setInterval(tick, TICK);

    el.pause?.addEventListener('click', () => {
      paused = !paused;
      el.pause.setAttribute('aria-pressed', String(paused));
      $('span', el.pause).textContent = paused ? 'Resume' : 'Pause';
    });
  }

  /* ---------- after hours: website builder demo ---------- */
  function initBuilder() {
    const code = $('#builder-code');
    const preview = $('#builder-preview');
    if (!code || !preview) return;
    const parts = $$('[data-step]', preview);
    const LINES = [
      { step: 1, seg: [['<', 'p'], ['nav', 't'], [' class', 'a'], ['=', 'p'], ['"top"', 's'], ['>', 'p']] },
      { step: 2, seg: [['<', 'p'], ['h1', 't'], ['>', 'p'], ['Hello, Khobar', 'x'], ['</', 'p'], ['h1', 't'], ['>', 'p']] },
      { step: 3, seg: [['<', 'p'], ['a', 't'], [' class', 'a'], ['=', 'p'], ['"btn"', 's'], ['>', 'p'], ['Start', 'x'], ['</', 'p'], ['a', 't'], ['>', 'p']] },
      { step: 4, seg: [['<', 'p'], ['div', 't'], [' class', 'a'], ['=', 'p'], ['"cards"', 's'], ['>', 'p'], ['...', 'x'], ['</', 'p'], ['div', 't'], ['>', 'p']] },
      { step: 5, seg: [['<', 'p'], ['footer', 't'], ['>', 'p'], ['© 2026', 'x'], ['</', 'p'], ['footer', 't'], ['>', 'p']] },
      { step: 6, seg: [['.btn', 'k'], [' { ', 'p'], ['animation', 'a'], [': ', 'p'], ['pulse 2s', 's'], [' }', 'p']] },
    ];
    const writeLine = (line) => {
      const row = document.createElement('div');
      row.className = 'code-line';
      code.appendChild(row);
      return row;
    };
    const segSpan = (row, cls) => {
      const span = document.createElement('span');
      span.className = `c-${cls}`;
      row.appendChild(span);
      return span;
    };
    const showStep = (step) => {
      parts.forEach((p) => { if (Number(p.dataset.step) <= step) p.classList.add('on'); });
      if (step >= 6) preview.classList.add('is-live');
    };

    if (reduceMotion) {
      LINES.forEach((line) => {
        const row = writeLine(line);
        line.seg.forEach(([text, cls]) => { segSpan(row, cls).textContent = text; });
      });
      showStep(6);
      return;
    }

    const whenVisible = visibilityGate(preview.closest('.hobby'));
    (async () => {
      for (;;) {
        code.innerHTML = '';
        parts.forEach((p) => p.classList.remove('on'));
        preview.classList.remove('is-live');
        await sleep(500);
        for (const line of LINES) {
          await whenVisible();
          const row = writeLine(line);
          for (const [text, cls] of line.seg) {
            const span = segSpan(row, cls);
            for (const ch of text) {
              span.textContent += ch;
              await sleep(rand(22, 55));
            }
          }
          showStep(line.step);
          await sleep(320);
        }
        await sleep(3600);
      }
    })();
  }

  /* ---------- after hours: AI chat demo ---------- */
  function initChat() {
    const log = $('#chat-log');
    if (!log) return;
    const CONVOS = [
      {
        q: 'Write a PowerShell one-liner to list users who have not logged in for 90 days.',
        a: [
          { type: 'text', value: 'Here you go. It needs the ActiveDirectory module:' },
          { type: 'code', value: 'Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly |\n  Select-Object Name, LastLogonDate |\n  Sort-Object LastLogonDate' },
          { type: 'text', value: 'Review the list before disabling anything.' },
        ],
      },
      {
        q: 'What does "The trust relationship between this workstation and the primary domain failed" mean?',
        a: [
          { type: 'text', value: 'The PC has lost its secure channel with the domain controller. From an elevated PowerShell:' },
          { type: 'code', value: 'Test-ComputerSecureChannel -Repair -Credential (Get-Credential)' },
          { type: 'text', value: 'If that fails, rejoin the machine to the domain.' },
        ],
      },
      {
        q: 'Draft a KB article title for Outlook password prompts.',
        a: [
          { type: 'text', value: 'Suggested title and summary:' },
          { type: 'code', value: 'KB0042 · Outlook keeps asking for a password (Microsoft 365)\nFix: clear cached credentials in Credential Manager,\nthen rebuild the Outlook profile.' },
        ],
      },
    ];
    const bubble = (who) => {
      const div = document.createElement('div');
      div.className = `msg msg--${who}`;
      log.appendChild(div);
      return div;
    };
    const renderStatic = (convo) => {
      log.innerHTML = '';
      bubble('user').textContent = convo.q;
      const ai = bubble('ai');
      convo.a.forEach((part) => {
        const node = document.createElement(part.type === 'code' ? 'pre' : 'p');
        node.textContent = part.value;
        ai.appendChild(node);
      });
    };

    if (reduceMotion) { renderStatic(CONVOS[0]); return; }

    const whenVisible = visibilityGate(log.closest('.hobby'));
    (async () => {
      let i = 0;
      for (;;) {
        await whenVisible();
        const convo = CONVOS[i % CONVOS.length];
        i += 1;
        log.innerHTML = '';
        await sleep(400);
        const q = bubble('user');
        for (const ch of convo.q) {
          q.textContent += ch;
          await sleep(rand(14, 32));
        }
        await sleep(450);
        const ai = bubble('ai');
        ai.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
        await sleep(1100);
        ai.innerHTML = '';
        for (const part of convo.a) {
          const node = document.createElement(part.type === 'code' ? 'pre' : 'p');
          ai.appendChild(node);
          if (part.type === 'code') {
            for (const ch of part.value) {
              node.textContent += ch;
              await sleep(9);
            }
          } else {
            const words = part.value.split(' ');
            for (let w = 0; w < words.length; w++) {
              node.textContent += (w ? ' ' : '') + words[w];
              await sleep(rand(30, 70));
            }
          }
          await sleep(250);
        }
        await sleep(4200);
      }
    })();
  }

  /* ---------- contact: copy buttons + ticket form ---------- */
  function initContact() {
    $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await copyText(btn.dataset.copy);
      toast(ok ? `Copied ${btn.dataset.copy}` : 'Copy failed. Select the text and copy it instead.');
    }));

    const form = $('#ticket-form');
    if (!form) return;
    const number = `INC${pad(randInt(10000, 99999), 7)}`;
    $('#ticket-no').textContent = number;
    const status = $('#form-status');

    // The terminal's "hire" command arrives here as contact.html?priority=P1
    const wanted = new URLSearchParams(window.location.search).get('priority');
    if (wanted && /^P[1-4]$/.test(wanted)) {
      $('#t-priority').value = wanted;
      setTimeout(() => $('#t-name')?.focus(), 500);
    }

    const setError = (input, message) => {
      const field = input.closest('.field');
      const err = $('.field__err', field);
      field.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      err.textContent = message || '';
      err.hidden = !message;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#t-name');
      const email = $('#t-email');
      const message = $('#t-message');
      const priority = $('#t-priority');
      const subject = $('#t-subject');

      const checks = [
        [name, name.value.trim() ? '' : 'Add your name so I know who to reply to.'],
        [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Enter an email address like name@company.com.'],
        [message, message.value.trim() ? '' : 'Add a short description of the request.'],
      ];
      checks.forEach(([input, msg]) => setError(input, msg));
      const firstBad = checks.find(([, msg]) => msg);
      if (firstBad) { firstBad[0].focus(); return; }

      const prioText = priority.options[priority.selectedIndex].text;
      const subjectLine = `[${number}] ${subject.value.trim() || prioText} · from ${name.value.trim()}`;
      const bodyText = `Priority: ${prioText}\nCaller: ${name.value.trim()} <${email.value.trim()}>\n\n${message.value.trim()}\n\n(Sent from the ticket form on Bilad's portfolio)`;
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(bodyText)}`;

      form.classList.remove('is-logged');
      void form.offsetWidth;
      form.classList.add('is-logged');
      status.textContent = `Ticket ${number} is ready. Your email app should open with it filled in; press Send there. If nothing opens, email ${EMAIL} directly.`;
      status.hidden = false;
    });
  }

  /* ---------- ambient section backgrounds ---------- */
  function initBackgroundFx() {
    const layers = $$('.bg-fx');
    if (!layers.length || reduceMotion) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
      return node;
    };
    const narrow = () => window.innerWidth < 700;
    const GLYPHS = {
      code: ['</>', '{ }', '01', '10', '>_', '#', '=>', '[ ]', '$', '&&', '0x1F', 'ping', 'DNS', 'TCP', 'GPO', '::1'],
      ai: ['</>', '{ }', 'AI', '>_', '*', '+', '01', '=>', 'fn()', '.js', '.css', 'prompt', '++', '[ ]', 'LLM', '<div>'],
    };

    const buildGlyphs = (layer) => {
      layer.innerHTML = '';
      const set = GLYPHS[layer.dataset.set] || GLYPHS.code;
      const count = narrow() ? 7 : Number(layer.dataset.fxCount || 16);
      layer.style.setProperty('--h', `${layer.offsetHeight + 80}px`);
      for (let i = 0; i < count; i++) {
        const glyph = document.createElement('span');
        const hot = Math.random() < 0.2;
        const t = rand(16, 30);
        glyph.className = `fx-glyph${hot ? ' fx-glyph--hot' : ''}`;
        glyph.textContent = pick(set);
        glyph.style.cssText = [
          `--x:${rand(2, 94).toFixed(1)}%`,
          `--s:${rand(0.7, 1.15).toFixed(2)}rem`,
          `--t:${t.toFixed(1)}s`,
          `--dl:${(-rand(0, t)).toFixed(1)}s`,
          `--dx:${rand(-40, 40).toFixed(0)}px`,
          `--o:${hot ? 0.32 : rand(0.08, 0.18).toFixed(2)}`,
        ].join(';');
        layer.appendChild(glyph);
      }
    };

    const buildCircuit = (layer) => {
      layer.innerHTML = '';
      const w = layer.offsetWidth;
      const h = layer.offsetHeight;
      if (!w || !h) return;
      const svg = svgEl('svg', { class: 'fx-circuit', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none' });
      const count = narrow() ? 6 : Number(layer.dataset.fxCount || 12);
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        let x = dir === 1 ? -4 : w + 4;
        let y = rand(0.04, 0.96) * h;
        const pts = [[x, y]];
        const segments = randInt(2, 4);
        for (let k = 0; k < segments; k++) {
          x += dir * rand(50, Math.max(80, Math.min(240, w * 0.18)));
          pts.push([x, y]);
          if (k < segments - 1) {
            const dy = rand(20, 70) * (Math.random() < 0.5 ? -1 : 1);
            x += dir * Math.abs(dy); // 45° bend, like a PCB trace
            y += dy;
            pts.push([x, y]);
          }
        }
        const d = `M${pts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L')}`;
        let len = 0;
        for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        svg.appendChild(svgEl('path', { class: 'fx-trace', d }));
        const [ex, ey] = pts[pts.length - 1];
        svg.appendChild(svgEl('circle', { class: 'fx-pad', cx: ex.toFixed(1), cy: ey.toFixed(1), r: 3.5 }));
        if (Math.random() < 0.75) {
          const t = rand(3.5, 7);
          const pulse = svgEl('path', { class: `fx-pulse${Math.random() < 0.3 ? ' fx-pulse--ok' : ''}`, d });
          pulse.setAttribute('stroke-dasharray', `26 ${Math.round(len + 52)}`);
          pulse.style.cssText = `--end:${-Math.round(len)}px;--t:${t.toFixed(1)}s;--dl:${(-rand(0, t)).toFixed(1)}s`;
          svg.appendChild(pulse);
        }
      }
      layer.appendChild(svg);
    };

    let legendTimer = 0;
    const buildGraph = (layer) => {
      layer.innerHTML = '';
      clearInterval(legendTimer);
      const W = Math.round(layer.offsetWidth);
      const h = layer.offsetHeight;
      if (!W || !h) return;
      // Sums of sines with whole cycles per width repeat exactly every W px,
      // so sliding the 2W-wide drawing left by half loops without a seam.
      const steps = Math.max(1, Math.round(W / 6));
      const series = (base, terms) => {
        const waves = terms.map(([amp, cycles]) => ({ amp, cycles, phase: rand(0, Math.PI * 2) }));
        const pts = [];
        for (let k = 0; k <= steps * 2; k++) {
          const x = (k * W) / steps;
          let y = base;
          waves.forEach(({ amp, cycles, phase }) => { y += amp * Math.sin((2 * Math.PI * cycles * x) / W + phase); });
          pts.push([x, Math.max(4, Math.min(h - 2, y))]);
        }
        return pts;
      };
      const rx = series(h * 0.58, [[h * 0.14, 2], [h * 0.08, 5], [h * 0.05, 11], [h * 0.025, 23]]);
      const tx = series(h * 0.8, [[h * 0.06, 3], [h * 0.04, 7], [h * 0.02, 17]]);
      const line = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
      const svg = svgEl('svg', { class: 'fx-graph__svg', viewBox: `0 0 ${W * 2} ${h}`, preserveAspectRatio: 'none' });
      const defs = svgEl('defs', {});
      const grad = svgEl('linearGradient', { id: 'fx-graph-fill', x1: '0', y1: '0', x2: '0', y2: '1' });
      grad.appendChild(svgEl('stop', { offset: '0', class: 'fx-stop-a' }));
      grad.appendChild(svgEl('stop', { offset: '1', class: 'fx-stop-b' }));
      defs.appendChild(grad);
      svg.appendChild(defs);
      svg.appendChild(svgEl('path', { class: 'fx-graph__area', d: `${line(rx)} L${W * 2} ${h} L0 ${h} Z` }));
      svg.appendChild(svgEl('path', { class: 'fx-graph__rx', d: line(rx) }));
      svg.appendChild(svgEl('path', { class: 'fx-graph__tx', d: line(tx) }));
      const loop = Math.max(18, W / 22); // seconds per loop, about 22px a second
      svg.style.setProperty('--t', `${loop.toFixed(1)}s`);
      layer.style.setProperty('--grid-t', `${((loop * 40) / W).toFixed(2)}s`);
      layer.appendChild(svg);

      const legend = document.createElement('div');
      legend.className = 'fx-graph__legend';
      legend.innerHTML = '<span>Ethernet</span><span><i class="tx"></i>S <b>1.2</b> Mbps</span><span><i></i>R <b>8.4</b> Mbps</span>';
      layer.appendChild(legend);
      const [send, recv] = $$('b', legend);
      legendTimer = setInterval(() => {
        if (!layer.classList.contains('fx-on') || document.hidden) return;
        send.textContent = rand(0.4, 3.2).toFixed(1);
        recv.textContent = rand(2, 24).toFixed(1);
      }, 1000);
    };

    const builders = { glyphs: buildGlyphs, circuit: buildCircuit, graph: buildGraph };
    const build = () => layers.forEach((layer) => builders[layer.dataset.fx]?.(layer));
    build();

    let lastWidth = window.innerWidth;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (Math.abs(window.innerWidth - lastWidth) < 60) return;
        lastWidth = window.innerWidth;
        build();
      }, 250);
    });

    // Only animate the layers that are on screen.
    if (hasIO) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.target.classList.toggle('fx-on', entry.isIntersecting));
      }, { rootMargin: '120px 0px' });
      layers.forEach((layer) => io.observe(layer));
    } else {
      layers.forEach((layer) => layer.classList.add('fx-on'));
    }
  }

  /* ---------- turn it off and on again ---------- */
  let rebooting = false;
  async function reboot() {
    if (rebooting) return;
    rebooting = true;
    const crt = document.createElement('div');
    crt.className = 'overlay crt';
    crt.setAttribute('aria-hidden', 'true');
    crt.innerHTML = '<div class="crt__top"></div><div class="crt__bottom"></div><div class="crt__line"></div>';
    document.body.appendChild(crt);
    void crt.offsetWidth;
    crt.classList.add('is-off');
    await sleep(reduceMotion ? 50 : 1050);
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = '';
    const booted = runBoot();
    crt.remove();
    await booted;
    heroIntro();
    rebooting = false;
  }

  /* ---------- blue screen easter egg (Konami code) ---------- */
  function bsod() {
    if ($('.bsod')) return;
    const overlay = document.createElement('div');
    overlay.className = 'overlay bsod';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-label', 'Joke blue screen. Press any key to close.');
    overlay.innerHTML = `
      <div class="bsod__inner">
        <p class="bsod__face">:(</p>
        <p class="bsod__msg">Your visitor ran into a problem and needs to restart. Just kidding. Bilad already fixed it.</p>
        <p class="bsod__pct"><span class="bsod__num">0</span>% complete</p>
        <div class="bsod__foot">
          <canvas width="21" height="21"></canvas>
          <div>
            <p>For more information about this issue and possible fixes, contact ${EMAIL}</p>
            <p>If you call a support person, give them this info:<br>Stop code: HAVE_YOU_TRIED_TURNING_IT_OFF_AND_ON_AGAIN</p>
          </div>
        </div>
        <p class="bsod__hint">Press any key or click to continue</p>
      </div>`;
    document.body.appendChild(overlay);

    // A pretend QR code: three finder squares plus random modules.
    const qr = $('canvas', overlay).getContext('2d');
    qr.fillStyle = '#0078D7';
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) if (Math.random() < 0.45) qr.fillRect(x, y, 1, 1);
    }
    [[0, 0], [14, 0], [0, 14]].forEach(([x, y]) => {
      qr.fillStyle = '#FFFFFF'; qr.fillRect(x, y, 7, 7);
      qr.fillStyle = '#0078D7'; qr.fillRect(x, y, 7, 7);
      qr.fillStyle = '#FFFFFF'; qr.fillRect(x + 1, y + 1, 5, 5);
      qr.fillStyle = '#0078D7'; qr.fillRect(x + 2, y + 2, 3, 3);
    });

    const num = $('.bsod__num', overlay);
    let pct = 0;
    let closed = false;
    const counter = setInterval(() => {
      pct = Math.min(100, pct + randInt(3, 11));
      num.textContent = String(pct);
      if (pct >= 100) { clearInterval(counter); setTimeout(close, 1400); }
    }, 220);
    function close() {
      if (closed) return;
      closed = true;
      clearInterval(counter);
      window.removeEventListener('keydown', close);
      overlay.remove();
      toast('Back online. Nothing was harmed.');
    }
    setTimeout(() => {
      window.addEventListener('keydown', close);
      overlay.addEventListener('click', close);
    }, 400);
  }

  function initEasterEggs() {
    const code = 'arrowup,arrowup,arrowdown,arrowdown,arrowleft,arrowright,arrowleft,arrowright,b,a';
    let keys = [];
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      keys.push((e.key || '').toLowerCase());
      if (keys.length > 10) keys.shift();
      if (keys.join(',') === code) { keys = []; bsod(); }
    });
    $('#reboot-btn')?.addEventListener('click', reboot);

    const baseTitle = document.title;
    document.addEventListener('visibilitychange', () => {
      document.title = document.hidden ? 'Ticket still open... come back' : baseTitle;
    });

    console.log(
      '%c bilad.support %c Curious how this works? Have a look around. Hiring? ' + EMAIL,
      'background:#FFB547;color:#1C1203;font-weight:700;padding:4px 8px;border-radius:3px',
      'padding:4px 6px'
    );
    console.log('Psst: try the Konami code on the page (up up down down left right left right B A).');
  }

  /* ---------- start ---------- */
  initTheme();
  initNav();
  initPageTransitions();
  initBackgroundFx();
  initScrollEffects();
  initMarquee();
  initBarcode();
  initClock();
  initDurations();
  initReveal();
  initCounters();
  initEyebrows();
  initPointerEffects();
  initTilt();
  initScanPhoto();
  initNetwork();
  initTerminal();
  initDesk();
  initBuilder();
  initChat();
  initContact();
  initEasterEggs();

  const firstVisit = !session.get('bilad-booted');
  if (firstVisit && !reduceMotion) {
    session.set('bilad-booted', '1');
    runBoot().then(() => { heroIntro(); initRoles(); });
  } else {
    root.classList.remove('booting');
    heroIntro();
    initRoles();
  }
})();
