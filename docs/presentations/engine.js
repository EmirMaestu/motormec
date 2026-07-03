/* Motor de presentación Momec — split de texto, control de escenas, morph de fondo */
(() => {
  const root = document.documentElement;
  const scenes = [...document.querySelectorAll(".scene")];
  const bar = document.getElementById("bar");
  const hint = document.getElementById("hint");

  const BG = {
    deep: { g1: "#0f2c1e", g2: "#0a1a12", glow: "rgba(120,197,28,.20)" },
    lime: { g1: "#163a1e", g2: "#0a1a12", glow: "rgba(200,241,105,.30)" },
    warm: { g1: "#2b2712", g2: "#120f09", glow: "rgba(200,241,105,.16)" },
    dark: { g1: "#0a1a12", g2: "#05100b", glow: "rgba(120,197,28,.32)" },
  };

  // Split text into animated spans (word | char), optional scatter vars
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
          const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
          s.style.setProperty("--x", (Math.cos(a) * d).toFixed(0) + "px");
          s.style.setProperty("--y", (Math.sin(a) * d).toFixed(0) + "px");
          s.style.setProperty("--r", (Math.random() * 44 - 22).toFixed(0) + "deg");
        }
      });
    });
  });

  let i = 0, timer = null, t0 = 0, dur = 0, raf = null, playing = true;

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
    cancelAnimationFrame(raf); clearTimeout(timer);
    scenes.forEach((s) => s.classList.remove("active"));
    i = (n + scenes.length) % scenes.length;
    const sc = scenes[i];
    applyBg(sc.dataset.bg);
    void sc.offsetWidth; // restart animations
    sc.classList.add("active");
    dur = +sc.dataset.dur || 5000;
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
