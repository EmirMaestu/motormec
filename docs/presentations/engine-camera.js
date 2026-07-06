/* Motor de cámara Momec — presentación espacial (Prezi-style, pero cinematográfico).
 * Un lienzo gigante (#world) con escenas colocadas en x/y/rotación; la "cámara"
 * es un transform sobre el mundo: vuela entre escenas con pull-back (zoom out
 * a mitad de vuelo), rotación compensada y aterrizaje suave. La coreografía de
 * cada escena arranca cuando la cámara está llegando (var --arr). */
(() => {
  const world = document.getElementById("world");
  const scenes = [...world.querySelectorAll(".scene")];
  const bar = document.getElementById("bar");
  const hint = document.getElementById("hint");
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BG = {
    deep: { g1: "#0f2c1e", g2: "#0a1a12", glow: "rgba(120,197,28,.20)" },
    lime: { g1: "#163a1e", g2: "#0a1a12", glow: "rgba(200,241,105,.30)" },
    warm: { g1: "#2b2712", g2: "#120f09", glow: "rgba(200,241,105,.16)" },
    dark: { g1: "#0a1a12", g2: "#05100b", glow: "rgba(120,197,28,.32)" },
  };
  const applyBg = (n) => {
    const b = BG[n] || BG.deep;
    root.style.setProperty("--g1", b.g1);
    root.style.setProperty("--g2", b.g2);
    root.style.setProperty("--glow", b.glow);
  };

  /* --- Colocar escenas en el lienzo --- */
  const geo = new Map();
  scenes.forEach((sc) => {
    const w = +sc.dataset.w, h = +sc.dataset.h || Math.round((w * 9) / 16);
    const x = +sc.dataset.x, y = +sc.dataset.y, rot = +sc.dataset.rot || 0;
    Object.assign(sc.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    sc.style.transform = `rotate(${rot}deg)`;
    geo.set(sc, { x, y, w, h, rot, cx: x + w / 2, cy: y + h / 2 });
  });

  /* --- Camino punteado que conecta las escenas (la "ruta" del recorrido) --- */
  (() => {
    const pts = scenes.filter((s) => !s.classList.contains("bare")).map((s) => {
      const g = geo.get(s);
      return { x: g.cx, y: g.cy };
    });
    if (pts.length < 2) return;
    const PAD = 400;
    const minX = Math.min(...pts.map((p) => p.x)) - PAD, minY = Math.min(...pts.map((p) => p.y)) - PAD;
    const maxX = Math.max(...pts.map((p) => p.x)) + PAD, maxY = Math.max(...pts.map((p) => p.y)) + PAD;
    const q = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    let d = `M${q[0].x} ${q[0].y}`;
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[i - 1] || q[i], p1 = q[i], p2 = q[i + 1], p3 = q[i + 2] || p2;
      d += `C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", maxX - minX);
    svg.setAttribute("height", maxY - minY);
    svg.style.cssText = `position:absolute;left:${minX}px;top:${minY}px;pointer-events:none;overflow:visible`;
    svg.innerHTML = `<path d="${d}" fill="none" stroke="#c8f169" stroke-opacity=".13" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 34"/>`;
    world.prepend(svg);
  })();

  /* --- Split de texto (palabra/letra) para reveals coreografiados --- */
  scenes.forEach((sc) => {
    sc.querySelectorAll("[data-split]").forEach((el) => {
      const mode = el.dataset.split;
      const scatter = el.hasAttribute("data-scatter");
      const src = document.createElement("div");
      src.innerHTML = el.innerHTML;
      const out = document.createElement("span");
      (function build(node, dst) {
        node.childNodes.forEach((n) => {
          if (n.nodeType === 3) {
            const units = mode === "char" ? [...n.textContent] : n.textContent.split(/(\s+)/);
            units.forEach((u) => {
              if (u.trim() === "") { dst.appendChild(document.createTextNode(u)); return; }
              const s = document.createElement("span");
              s.textContent = u;
              dst.appendChild(s);
            });
          } else {
            const c = n.cloneNode(false);
            dst.appendChild(c);
            build(n, c);
          }
        });
      })(src, out);
      el.innerHTML = out.innerHTML;
      [...el.querySelectorAll("span")].forEach((s, i) => {
        s.style.setProperty("--i", i);
        if (scatter) {
          const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 130;
          s.style.setProperty("--x", (Math.cos(a) * d).toFixed(0) + "px");
          s.style.setProperty("--y", (Math.sin(a) * d).toFixed(0) + "px");
          s.style.setProperty("--r", (Math.random() * 44 - 22).toFixed(0) + "deg");
        }
      });
    });
    sc.querySelectorAll("[data-anim]").forEach((el, i) => {
      if (!el.style.getPropertyValue("--seq")) el.style.setProperty("--seq", i);
    });
  });

  /* --- Count-up --- */
  function runCounts(sc) {
    sc.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count) || 0;
      const pre = el.dataset.pre || "", suf = el.dataset.suf || "";
      if (reduce) { el.textContent = pre + target.toLocaleString("es-AR") + suf; return; }
      const dur = 1000, t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = pre + Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("es-AR") + suf;
        if (p < 1 && sc.classList.contains("active")) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* --- Shared element: teléfono persistente (overlay); crossfade de pantalla --- */
  const sphone = document.getElementById("sphone");
  let curLayer = null;
  function setScreen(src, panSecs) {
    if (!sphone) return;
    const layers = sphone.querySelectorAll(".layer");
    const incoming = curLayer === layers[0] ? layers[1] : layers[0];
    const outgoing = curLayer;
    const img = incoming.querySelector("img");
    if (img.getAttribute("src") !== src) img.src = src;
    img.style.animation = "none";
    img.style.transform = "translateY(0)";
    void img.offsetWidth;
    if (panSecs && !reduce) img.style.animation = `pan ${panSecs}s linear .4s both`;
    incoming.style.opacity = "1";
    if (outgoing && outgoing !== incoming) outgoing.style.opacity = "0";
    curLayer = incoming;
  }
  function syncPhone(scene) {
    if (!sphone) return;
    if (scene.dataset.screen) {
      sphone.classList.toggle("pdf", scene.hasAttribute("data-pdf"));
      sphone.classList.add("on");
      setScreen(scene.dataset.screen, parseFloat(scene.dataset.pan) || 0);
    } else {
      sphone.classList.remove("on");
    }
  }

  /* --- Cámara --- */
  const EASE = "cubic-bezier(.45,.05,.35,1)";
  function cam(sc) {
    const g = geo.get(sc);
    const k = Math.min(innerWidth / g.w, innerHeight / g.h);
    return { k, rot: g.rot, cx: g.cx, cy: g.cy };
  }
  const tf = (c) =>
    `translate(${innerWidth / 2}px, ${innerHeight / 2}px) scale(${c.k}) rotate(${-c.rot}deg) translate(${-c.cx}px, ${-c.cy}px)`;

  let i = 0, flight = null, timer = null, raf = null, playing = true, t0 = 0, dur = 0;
  let camNow = null; // cámara "actual" (destino del último vuelo o interpolada)

  function currentCam() {
    if (flight && flight.playState === "running" && flight._from && flight._to) {
      const t = Math.min(1, (flight.currentTime || 0) / flight._dur);
      const a = flight._from, b = flight._to;
      return {
        k: a.k + (b.k - a.k) * t, rot: a.rot + (b.rot - a.rot) * t,
        cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t,
      };
    }
    return camNow;
  }

  function fly(to) {
    const A = currentCam(), B = cam(to);
    if (flight) { flight.cancel(); flight = null; }
    if (!A || reduce) {
      world.style.transform = tf(B);
      camNow = B;
      return 0;
    }
    const dist = Math.hypot(B.cx - A.cx, B.cy - A.cy);
    const durMs = Math.min(2400, 700 + dist * 0.1);
    // Pull-back: a mitad de vuelo la cámara se aleja (cuanto más lejos, más se aleja)
    const dip = dist > 900 ? Math.max(0.35, 1 - dist / 14000) : 0.82;
    const mid = {
      k: Math.min(A.k, B.k) * dip,
      rot: (A.rot + B.rot) / 2,
      cx: (A.cx + B.cx) / 2,
      cy: (A.cy + B.cy) / 2,
    };
    world.style.transform = tf(A);
    flight = world.animate(
      [
        { transform: tf(A), easing: "cubic-bezier(.5,0,.4,1)" },
        { transform: tf(mid), offset: 0.52, easing: "cubic-bezier(.55,0,.3,1)" },
        { transform: tf(B) },
      ],
      { duration: durMs, fill: "forwards" },
    );
    flight._from = A; flight._to = B; flight._dur = durMs;
    flight.onfinish = () => {
      world.style.transform = tf(B);
      try { flight.cancel(); } catch { /* ya cancelado */ }
      flight = null;
    };
    camNow = B;
    return durMs;
  }

  function progress() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    bar.style.width = (p * 100).toFixed(2) + "%";
    if (p < 1 && playing) raf = requestAnimationFrame(progress);
  }

  function show(n) {
    clearTimeout(timer); cancelAnimationFrame(raf);
    bar.style.width = "0%";
    const prev = scenes[i];
    i = (n + scenes.length) % scenes.length;
    const cur = scenes[i];
    applyBg(cur.dataset.bg);

    if (prev && prev !== cur) { prev.classList.remove("active"); prev.classList.add("played"); }
    cur.classList.remove("played");

    const flightMs = fly(cur);
    const arr = Math.round(flightMs * 0.55); // la coreografía arranca llegando
    cur.style.setProperty("--arr", arr + "ms");
    void cur.offsetWidth;
    cur.classList.add("active");
    setTimeout(() => { if (scenes[i] === cur) runCounts(cur); }, arr);
    setTimeout(() => { if (scenes[i] === cur) syncPhone(cur); }, Math.round(flightMs * 0.4));

    dur = +cur.dataset.dur || 5000;
    t0 = performance.now() + flightMs;
    if (playing) {
      raf = requestAnimationFrame(progress);
      timer = setTimeout(() => show(i + 1), flightMs + dur);
    }
  }
  const next = () => show(i + 1), prev = () => show(i - 1);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") prev();
    else if (k === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (k === "r") { scenes.forEach((s) => s.classList.remove("played", "active")); show(0); }
    else if (k === "p") { playing = !playing; if (playing) show(i); else { clearTimeout(timer); cancelAnimationFrame(raf); } }
  });
  document.body.addEventListener("click", next);
  addEventListener("resize", () => { if (!flight) { camNow = cam(scenes[i]); world.style.transform = tf(camNow); } });

  if (hint) {
    setTimeout(() => (hint.style.opacity = "0"), 6000);
    document.addEventListener("mousemove", () => {
      hint.style.opacity = ".6"; clearTimeout(hint._t);
      hint._t = setTimeout(() => (hint.style.opacity = "0"), 2500);
    });
  }
  show(0);
})();
