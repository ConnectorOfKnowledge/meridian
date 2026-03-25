/**
 * Canvas-based wind visualization.
 * Draws an animated wind compass with particle trails showing
 * wind direction and speed.
 */

interface WindCanvasOptions {
  canvas: HTMLCanvasElement;
  windSpeed: number;
  windGusts: number;
  windDirection: number; // degrees, where wind is coming FROM
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
}

const WIND_COLORS = {
  bg: 'transparent',
  compass: 'rgba(255, 255, 255, 0.06)',
  compassRing: 'rgba(255, 255, 255, 0.08)',
  cardinal: 'rgba(255, 255, 255, 0.3)',
  arrow: '#f6a623',
  arrowGlow: 'rgba(246, 166, 35, 0.3)',
  particle: 'rgba(246, 166, 35, 0.6)',
  gustParticle: 'rgba(232, 144, 26, 0.4)',
  speedText: 'rgba(255, 255, 255, 0.8)',
  unitText: 'rgba(255, 255, 255, 0.35)',
};

export function createWindCanvas({ canvas, windSpeed, windGusts, windDirection }: WindCanvasOptions): () => void {
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const parentW = parent ? parent.clientWidth : 224;
  const parentH = parent ? parent.clientHeight : 224;
  const size = Math.max(Math.min(parentW, parentH), 100);

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32;

  // Wind blows FROM windDirection, particles move in opposite direction
  const windAngleRad = ((windDirection + 180) * Math.PI) / 180;

  // Particles
  const particles: Particle[] = [];
  const maxParticles = Math.min(60, Math.round(windSpeed * 2) + 10);

  function spawnParticle() {
    // Spawn from upwind edge
    const spawnAngle = windAngleRad + Math.PI; // opposite of wind travel
    const offset = (Math.random() - 0.5) * Math.PI * 0.8;
    const spawnR = radius * 0.9;
    const x = cx + Math.cos(spawnAngle + offset) * spawnR;
    const y = cy + Math.sin(spawnAngle + offset) * spawnR;

    const isGust = Math.random() < 0.2;
    const baseSpeed = (windSpeed / 40) * 1.5 + 0.3;
    const speed = isGust ? baseSpeed * 1.5 : baseSpeed;

    particles.push({
      x,
      y,
      speed: speed * (0.7 + Math.random() * 0.6),
      alpha: 0.1 + Math.random() * 0.5,
      size: isGust ? 2 : 1 + Math.random(),
      life: 0,
      maxLife: 40 + Math.random() * 40,
    });
  }

  let animId: number;
  let targetAngle = windAngleRad;
  let currentAngle = windAngleRad;

  function draw() {
    ctx.clearRect(0, 0, size, size);

    // Smoothly animate compass direction
    const angleDiff = targetAngle - currentAngle;
    currentAngle += angleDiff * 0.05;

    // Compass circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = WIND_COLORS.compass;
    ctx.fill();
    ctx.strokeStyle = WIND_COLORS.compassRing;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner rings
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.stroke();

    // Cardinal directions
    const cardinals = ['N', 'E', 'S', 'W'];
    const cardinalAngles = [
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
    ];

    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    cardinals.forEach((label, i) => {
      const angle = cardinalAngles[i];
      const lx = cx + Math.cos(angle) * (radius + 14);
      const ly = cy + Math.sin(angle) * (radius + 14);
      ctx.fillStyle = WIND_COLORS.cardinal;
      ctx.fillText(label, lx, ly);

      // Tick marks
      const t1x = cx + Math.cos(angle) * (radius - 4);
      const t1y = cy + Math.sin(angle) * (radius - 4);
      const t2x = cx + Math.cos(angle) * (radius + 4);
      const t2y = cy + Math.sin(angle) * (radius + 4);
      ctx.beginPath();
      ctx.moveTo(t1x, t1y);
      ctx.lineTo(t2x, t2y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Minor tick marks
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) continue;
      const angle = (i * Math.PI * 2) / 16 - Math.PI / 2;
      const t1x = cx + Math.cos(angle) * (radius - 2);
      const t1y = cy + Math.sin(angle) * (radius - 2);
      const t2x = cx + Math.cos(angle) * (radius + 2);
      const t2y = cy + Math.sin(angle) * (radius + 2);
      ctx.beginPath();
      ctx.moveTo(t1x, t1y);
      ctx.lineTo(t2x, t2y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Update and draw particles
    while (particles.length < maxParticles) {
      spawnParticle();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += Math.cos(currentAngle) * p.speed;
      p.y += Math.sin(currentAngle) * p.speed;
      p.life++;

      // Fade in/out
      const lifeFrac = p.life / p.maxLife;
      const fadeAlpha = lifeFrac < 0.2
        ? lifeFrac / 0.2
        : lifeFrac > 0.7
          ? 1 - (lifeFrac - 0.7) / 0.3
          : 1;

      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      if (p.life > p.maxLife || dist > radius * 0.95) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.size > 1.5 ? WIND_COLORS.gustParticle : WIND_COLORS.particle;
      ctx.globalAlpha = p.alpha * fadeAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Direction arrow (pointing where wind is going TO)
    const arrowLen = radius * 0.55;
    const arrowTipX = cx + Math.cos(currentAngle) * arrowLen;
    const arrowTipY = cy + Math.sin(currentAngle) * arrowLen;
    const arrowBaseX = cx - Math.cos(currentAngle) * arrowLen * 0.3;
    const arrowBaseY = cy - Math.sin(currentAngle) * arrowLen * 0.3;

    // Arrow glow
    ctx.beginPath();
    ctx.moveTo(arrowBaseX, arrowBaseY);
    ctx.lineTo(arrowTipX, arrowTipY);
    ctx.strokeStyle = WIND_COLORS.arrowGlow;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrow line
    ctx.beginPath();
    ctx.moveTo(arrowBaseX, arrowBaseY);
    ctx.lineTo(arrowTipX, arrowTipY);
    ctx.strokeStyle = WIND_COLORS.arrow;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrowhead
    const headLen = 10;
    const headAngle = 0.4;
    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - headLen * Math.cos(currentAngle - headAngle),
      arrowTipY - headLen * Math.sin(currentAngle - headAngle)
    );
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - headLen * Math.cos(currentAngle + headAngle),
      arrowTipY - headLen * Math.sin(currentAngle + headAngle)
    );
    ctx.strokeStyle = WIND_COLORS.arrow;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = WIND_COLORS.arrow;
    ctx.fill();

    // Speed text in center
    ctx.font = '600 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = WIND_COLORS.speedText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(windSpeed).toString(), cx, cy - 6);

    ctx.font = '400 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = WIND_COLORS.unitText;
    ctx.textBaseline = 'top';
    ctx.fillText('mph', cx, cy + 2);

    if (windGusts > windSpeed * 1.3) {
      ctx.font = '400 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(232, 144, 26, 0.5)';
      ctx.fillText(`gusts ${Math.round(windGusts)}`, cx, cy + 16);
    }

    animId = requestAnimationFrame(draw);
  }

  draw();

  // Return cleanup function
  return () => cancelAnimationFrame(animId);
}
