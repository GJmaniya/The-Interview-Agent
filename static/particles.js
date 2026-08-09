(function () {
  const canvas = document.getElementById("bg-particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let particles = [];
  let mouse = { x: null, y: null };
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    // Scale count to screen area, capped for performance.
    const count = Math.min(900, Math.max(400, Math.floor((width * height) / 1800)));
    particles = Array.from({ length: count }, () => {
      const baseRadius = Math.random() * 1.8 + 0.6;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius: baseRadius,
        baseAlpha: Math.random() * 0.38 + 0.12,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * 0.015 + 0.005,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
      };
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      // Update wave phase
      p.phase += p.phaseSpeed;

      // Organic liquid sway movement
      p.x += p.vx + Math.sin(p.phase * 0.4) * 0.12;
      p.y += p.vy + Math.cos(p.phase * 0.4) * 0.12;

      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      // Pulsate size (increase/decrease) and opacity dynamically over time
      let radius = p.baseRadius + Math.sin(p.phase) * (p.baseRadius * 0.45);
      let alpha = Math.max(0.05, p.baseAlpha + Math.cos(p.phase) * 0.15);

      if (mouse.x !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = 150;
        if (dist < influence) {
          const force = (influence - dist) / influence;
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          p.x += nx * force * 2.0;
          p.y += ny * force * 2.0;
          alpha = Math.min(1, alpha + force * 0.65);
          radius = radius + force * 1.2;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function loop() {
    draw();
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });
  window.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });

  resize();
  loop(); // Reduced-motion: paints one static frame and stops (no rAF loop scheduled).
})();
