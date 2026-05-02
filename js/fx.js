// Lightweight particle/sparkle system used across the canvas.
window.FX = (function () {
  const TILE = 48;
  const list = [];
  // Drifting decorative clouds (filled at first call to drawClouds).
  let clouds = null;

  function spawn(p) {
    list.push({
      x: p.x, y: p.y,
      vx: p.vx ?? (Math.random() - 0.5) * 0.6,
      vy: p.vy ?? -Math.random() * 0.8 - 0.2,
      life: 0,
      maxLife: p.maxLife ?? 700,
      size: p.size ?? 3,
      color: p.color ?? "#ffe06b",
      kind: p.kind ?? "spark",
    });
  }

  function burst(x, y, color, n = 8, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 0.8 + Math.random() * 1.2;
      spawn({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.4,
        size: 2 + Math.random() * (opts.size || 3),
        color, maxLife: opts.maxLife || 600,
        kind: opts.kind || "spark",
      });
    }
  }

  function ambient(x, y) {
    spawn({
      x: x + (Math.random() - 0.5) * 4,
      y: y,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.2 - Math.random() * 0.3,
      size: 1 + Math.random() * 2,
      color: "rgba(255,225,140,0.9)",
      maxLife: 1200,
      kind: "twinkle",
    });
  }

  function tick(dtMs) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dtMs;
      p.x += p.vx * (dtMs / 16);
      p.y += p.vy * (dtMs / 16);
      p.vy += 0.04 * (dtMs / 16);
      if (p.life >= p.maxLife) list.splice(i, 1);
    }
  }

  function render(ctx) {
    for (const p of list) {
      const t = p.life / p.maxLife;
      const a = 1 - t;
      ctx.globalAlpha = a;
      if (p.kind === "twinkle") {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255," + (a * 0.7) + ")";
        ctx.fillRect(p.x - 0.5, p.y - p.size, 1, p.size * 2);
        ctx.fillRect(p.x - p.size, p.y - 0.5, p.size * 2, 1);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, frame, width, height) {
    if (!clouds) {
      clouds = [];
      for (let i = 0; i < 6; i++) {
        clouds.push({
          x: Math.random() * width,
          y: 8 + Math.random() * 60,
          w: 70 + Math.random() * 80,
          speed: 0.08 + Math.random() * 0.18,
          alpha: 0.18 + Math.random() * 0.16,
        });
      }
    }
    for (const c of clouds) {
      c.x -= c.speed;
      if (c.x + c.w < -50) c.x = width + 30;
      ctx.fillStyle = `rgba(255,255,255,${c.alpha})`;
      ctx.beginPath();
      ctx.ellipse(c.x,         c.y,      c.w * 0.35, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + 24,    c.y - 4,  c.w * 0.30, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - 18,    c.y + 2,  c.w * 0.25, 9,  0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawStars(ctx, frame, width) {
    // soft top-of-canvas star sparkle band
    for (let i = 0; i < 14; i++) {
      const x = (i * 71 + frame * 0.2) % width;
      const y = 20 + ((i * 31) % 40);
      const a = 0.35 + 0.35 * Math.sin(frame * 0.05 + i);
      ctx.fillStyle = `rgba(255,240,180,${a})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  return { spawn, burst, ambient, tick, render, drawClouds, drawStars, _list: list };
})();
