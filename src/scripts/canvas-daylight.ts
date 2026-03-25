/**
 * Canvas-based daylight arc visualization.
 * Shows sunrise/sunset as a beautiful arc with the sun's
 * current position, golden hour markers, and time labels.
 */

interface DaylightOptions {
  canvas: HTMLCanvasElement;
  sunrise: Date;
  sunset: Date;
  now?: Date;
}

const DAYLIGHT_COLORS = {
  arcDay: '#f6a623',
  arcNight: 'rgba(255, 255, 255, 0.06)',
  horizon: 'rgba(255, 255, 255, 0.08)',
  sun: '#f6d623',
  sunGlow: 'rgba(246, 214, 35, 0.3)',
  moon: '#d4c8b5',
  moonGlow: 'rgba(212, 200, 181, 0.15)',
  goldenHour: 'rgba(246, 166, 35, 0.15)',
  label: 'rgba(255, 255, 255, 0.4)',
  timeLabel: 'rgba(255, 255, 255, 0.6)',
};

export function drawDaylightArc({ canvas, sunrise, sunset, now }: DaylightOptions): void {
  const currentTime = now || new Date();
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  const cw = rect.width;
  const ch = rect.height;

  // Layout
  const horizonY = ch * 0.72;
  const arcRadius = Math.min(cw * 0.4, ch * 0.55);
  const cx = cw / 2;

  // Time calculations
  const sunriseMs = sunrise.getTime();
  const sunsetMs = sunset.getTime();
  const dayLength = sunsetMs - sunriseMs;
  const nowMs = currentTime.getTime();
  const isDay = nowMs >= sunriseMs && nowMs <= sunsetMs;

  // Sun position along arc (0 = sunrise, 1 = sunset)
  let sunProgress: number;
  if (nowMs < sunriseMs) {
    sunProgress = 0;
  } else if (nowMs > sunsetMs) {
    sunProgress = 1;
  } else {
    sunProgress = (nowMs - sunriseMs) / dayLength;
  }

  // Clear
  ctx.clearRect(0, 0, cw, ch);

  // Horizon line
  ctx.beginPath();
  ctx.moveTo(cx - arcRadius - 30, horizonY);
  ctx.lineTo(cx + arcRadius + 30, horizonY);
  ctx.strokeStyle = DAYLIGHT_COLORS.horizon;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Golden hour regions (first and last ~45 min of daylight)
  const goldenDuration = 45 * 60 * 1000; // 45 minutes
  const morningGoldenEnd = Math.min(goldenDuration / dayLength, 0.15);
  const eveningGoldenStart = Math.max(1 - goldenDuration / dayLength, 0.85);

  // Morning golden hour
  ctx.beginPath();
  ctx.arc(cx, horizonY, arcRadius, Math.PI, Math.PI + morningGoldenEnd * Math.PI, false);
  ctx.strokeStyle = DAYLIGHT_COLORS.goldenHour;
  ctx.lineWidth = 8;
  ctx.stroke();

  // Evening golden hour
  ctx.beginPath();
  ctx.arc(cx, horizonY, arcRadius, Math.PI + eveningGoldenStart * Math.PI, 2 * Math.PI, false);
  ctx.strokeStyle = DAYLIGHT_COLORS.goldenHour;
  ctx.lineWidth = 8;
  ctx.stroke();

  // Night arc (below horizon, subtle)
  ctx.beginPath();
  ctx.arc(cx, horizonY, arcRadius * 0.6, 0, Math.PI, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Day arc background (full)
  ctx.beginPath();
  ctx.arc(cx, horizonY, arcRadius, Math.PI, 2 * Math.PI, false);
  ctx.strokeStyle = DAYLIGHT_COLORS.arcNight;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Day arc progress (animated portion)
  if (isDay) {
    const progressAngle = Math.PI + sunProgress * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, horizonY, arcRadius, Math.PI, progressAngle, false);
    ctx.strokeStyle = DAYLIGHT_COLORS.arcDay;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (nowMs > sunsetMs) {
    // Full arc after sunset
    ctx.beginPath();
    ctx.arc(cx, horizonY, arcRadius, Math.PI, 2 * Math.PI, false);
    ctx.strokeStyle = DAYLIGHT_COLORS.arcDay;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Sun/Moon position
  const bodyAngle = Math.PI + sunProgress * Math.PI;
  const bodyX = cx + Math.cos(bodyAngle) * arcRadius;
  const bodyY = horizonY + Math.sin(bodyAngle) * arcRadius;

  if (isDay) {
    // Sun glow
    const sunGradient = ctx.createRadialGradient(bodyX, bodyY, 0, bodyX, bodyY, 20);
    sunGradient.addColorStop(0, DAYLIGHT_COLORS.sunGlow);
    sunGradient.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, 20, 0, Math.PI * 2);
    ctx.fillStyle = sunGradient;
    ctx.fill();

    // Sun body
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, 6, 0, Math.PI * 2);
    ctx.fillStyle = DAYLIGHT_COLORS.sun;
    ctx.fill();

    // Sun rays
    for (let i = 0; i < 8; i++) {
      const rayAngle = (i * Math.PI * 2) / 8;
      const r1 = 9;
      const r2 = 13;
      ctx.beginPath();
      ctx.moveTo(bodyX + Math.cos(rayAngle) * r1, bodyY + Math.sin(rayAngle) * r1);
      ctx.lineTo(bodyX + Math.cos(rayAngle) * r2, bodyY + Math.sin(rayAngle) * r2);
      ctx.strokeStyle = DAYLIGHT_COLORS.sun;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    // Moon (show at a fixed position below horizon for night)
    const moonX = cx;
    const moonY = horizonY + arcRadius * 0.3;

    const moonGradient = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 16);
    moonGradient.addColorStop(0, DAYLIGHT_COLORS.moonGlow);
    moonGradient.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
    ctx.fillStyle = moonGradient;
    ctx.fill();

    // Moon crescent
    ctx.beginPath();
    ctx.arc(moonX, moonY, 5, 0, Math.PI * 2);
    ctx.fillStyle = DAYLIGHT_COLORS.moon;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + 2, moonY - 1, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#141210';
    ctx.fill();
  }

  // Sunrise label
  const sunriseX = cx - arcRadius;
  ctx.font = '500 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = DAYLIGHT_COLORS.timeLabel;
  ctx.fillText(formatTime(sunrise), sunriseX, horizonY + 10);
  ctx.font = '400 9px Inter, system-ui, sans-serif';
  ctx.fillStyle = DAYLIGHT_COLORS.label;
  ctx.fillText('sunrise', sunriseX, horizonY + 26);

  // Sunset label
  const sunsetX = cx + arcRadius;
  ctx.font = '500 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = DAYLIGHT_COLORS.timeLabel;
  ctx.fillText(formatTime(sunset), sunsetX, horizonY + 10);
  ctx.font = '400 9px Inter, system-ui, sans-serif';
  ctx.fillStyle = DAYLIGHT_COLORS.label;
  ctx.fillText('sunset', sunsetX, horizonY + 26);

  // Solar noon label (top of arc)
  ctx.font = '400 9px Inter, system-ui, sans-serif';
  ctx.fillStyle = DAYLIGHT_COLORS.label;
  ctx.textBaseline = 'bottom';
  const noonTime = new Date((sunriseMs + sunsetMs) / 2);
  ctx.fillText(formatTime(noonTime), cx, horizonY - arcRadius - 8);

  // Day length label
  const dayHours = Math.floor(dayLength / 3600000);
  const dayMinutes = Math.floor((dayLength % 3600000) / 60000);
  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.fillStyle = DAYLIGHT_COLORS.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${dayHours}h ${dayMinutes}m daylight`, cx, horizonY + 10);

  // Time remaining
  if (isDay) {
    const remaining = sunsetMs - nowMs;
    const remH = Math.floor(remaining / 3600000);
    const remM = Math.floor((remaining % 3600000) / 60000);
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(246, 166, 35, 0.6)';
    ctx.fillText(`${remH}h ${remM}m until sunset`, cx, horizonY + 26);
  } else if (nowMs < sunriseMs) {
    const until = sunriseMs - nowMs;
    const untilH = Math.floor(until / 3600000);
    const untilM = Math.floor((until % 3600000) / 60000);
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(212, 200, 181, 0.5)';
    ctx.fillText(`${untilH}h ${untilM}m until sunrise`, cx, horizonY + 26);
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
}

export function setupDaylightCanvas(canvas: HTMLCanvasElement, sunrise: Date, sunset: Date): () => void {
  const draw = () => drawDaylightArc({ canvas, sunrise, sunset });
  draw();

  // Redraw every minute for the moving sun
  const interval = setInterval(draw, 60000);
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas.parentElement || canvas);

  return () => {
    clearInterval(interval);
    ro.disconnect();
  };
}
