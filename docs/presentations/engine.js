/* Motor de presentación Momec — coreografía, transiciones cinematográficas,
 * count-up, morph de fondo. Movimiento con propósito (Apple / Google I/O style). */
(() => {
  const root = document.documentElement;
  const scenes = [...document.querySelectorAll(".scene")];
  const bar = document.getElementById("bar");
  const hint = document.getElementById("hint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BG = {
    deep: { g1: "#0f2c1e", g2: "#0a1a12", glow: "rgba(120,197,28,.20)" },
    lime: { g1: "#163a1e", g2: "#0a1a12", glow: "rgba(200,241,105,.30)" },
    warm: { g1: "#2b2712", g2: "#120f09", glow: "rgba(200,241,105,.16)" },
    dark: { g1: "#0a1a12", g2: "#05100b", glow: "rgba(120,197,28,.32)" },
  };

  /* Split text (word|char) into spans for staggered reveals */
  scenes.forEach((sc) => {
    sc.querySelectorAll("[data-split]").forEach((el) => {
      const mode = el.dataset.split;
      const scatter = el.hasAttribute("data-scatter");
      const srcNode = document.createElement("div");
      srcNode.innerHTML = el.innerHTML;
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
      })(srcNode, out);
      el.innerHTML = out.innerHTML;
      [...el.querySelectorAll("span")].forEach((s, i) => {
        s.style.setProperty("--i", i);
        if (scatter) {
          const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
          s.style.setProperty("--x", (Math.cos(a) * d).toFixed(0) + "px");
          s.style.setProperty("--y", (Math.sin(a) * d).toFixed(0) + "px");
          s.style.setProperty("--r", (Math.random() * 44 - 22).toFixed(0) + "deg");
        }
      });
    });
    /* Auto-secuencia de elementos coreografiados (orden del DOM) */
    sc.querySelectorAll("[data-anim]").forEach((el, i) => {
      if (!el.style.getPropertyValue("--seq")) el.style.setProperty("--seq", i);
    });
  });

  /* Count-up (números que suben) */
  function runCounts(sc) {
    sc.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count) || 0;
      const pre = el.dataset.pre || "", suf = el.dataset.suf || "";
      const dur = 1000, t0 = performance.now();
      if (reduce) { el.textContent = pre + target.toLocaleString("es-AR") + suf; return; }
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + Math.round(target * eased).toLocaleString("es-AR") + suf;
        if (p < 1 && sc.classList.contains("active")) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* Shared element: un teléfono persistente cuyo contenido (la app) hace
   * crossfade entre escenas → continuidad cinematográfica (no reaparece). */
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
    void img.offsetWidth;
    if (panSecs && !reduce) img.style.animation = `pan ${panSecs}s linear .4s both`;
    else img.style.objectPosition = "50% 0%";
    incoming.style.opacity = "1";
    if (outgoing && outgoing !== incoming) outgoing.style.opacity = "0";
    curLayer = incoming;
  }
  /** Ajusta el teléfono compartido según la escena (persiste entre escenas). */
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

  let i = 0, timer = null, t0 = 0, dur = 0, raf = null, playing = true, leaveT = null;

  function applyBg(name) {
    const b = BG[name] || BG.deep;
    root.style.setProperty("--g1", b.g1);
    root.style.setProperty("--g2", b.g2);
    root.style.setProperty("--glow", b.glow);
  }
  function progress() {
    const p = Math.min(1, (performance.now() - t0) / dur);
    bar.style.width = (p * 100).toFixed(2) + "%";
    if (p < 1 && playing) raf = requestAnimationFrame(progress);
  }
  function show(n) {
    cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(leaveT);
    const prev = scenes[i];
    i = (n + scenes.length) % scenes.length;
    const cur = scenes[i];
    applyBg(cur.dataset.bg);
    // Transición cinematográfica: la escena saliente se va con profundidad,
    // la entrante llega desde el fondo (crossfade + scale) — sin cortes secos.
    scenes.forEach((s) => { if (s !== cur && s !== prev) { s.classList.remove("active", "leaving"); } });
    if (prev && prev !== cur) {
      prev.classList.remove("active");
      prev.classList.add("leaving");
      leaveT = setTimeout(() => prev.classList.remove("leaving"), 700);
    }
    void cur.offsetWidth; // reinicia animaciones
    cur.classList.remove("leaving");
    cur.classList.add("active");
    syncPhone(cur);
    runCounts(cur);
    dur = +cur.dataset.dur || 5000;
    t0 = performance.now();
    if (playing) { progress(); timer = setTimeout(() => show(i + 1), dur); }
  }
  const next = () => show(i + 1), prev = () => show(i - 1);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") prev();
    else if (k === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (k === "r") show(0);
    else if (k === "p") { playing = !playing; if (playing) show(i); else { clearTimeout(timer); cancelAnimationFrame(raf); } }
  });
  document.body.addEventListener("click", next);
  if (hint) {
    setTimeout(() => (hint.style.opacity = "0"), 6000);
    document.addEventListener("mousemove", () => {
      hint.style.opacity = ".6"; clearTimeout(hint._t);
      hint._t = setTimeout(() => (hint.style.opacity = "0"), 2500);
    });
  }
  show(0);
})();
