/**
 * Canvas-based temperature visualization.
 * Draws a smooth, beautiful temperature curve with gradient fill,
 * precipitation overlay, and time markers.
 */

import type { HourlyForecast } from './weather-api';

interface TempCanvasOptions {
  canvas: HTMLCanvasElement;
  hourly: HourlyForecast[];
  hours?: number; // Number of hours to display (default 48)
}

const COLORS = {
  bg: '#141210',
  grid: 'rgba(255, 255, 255, 0.04)',
  gridLabel: 'rgba(255, 255, 255, 0.25)',
  tempLine: '#f6a623',
  feelsLine: 'rgba(246, 166, 35, 0.3)',
  precipBar: 'rgba(96, 180, 211, 0.5)',
  precipFill: 'rgba(96, 180, 211, 0.15)',
  now: 'rgba(246, 166, 35, 0.6)',
  night: 'rgba(0, 0, 0, 0.15)',
  text: 'rgba(255, 255, 255, 0.5)',
};

function getTemperatureColor(temp: number): string {
  // Cold to hot gradient
  if (temp <= 20) return '#60b4d3'; // Blue
  if (temp <= 32) return '#7bb8d3'; // Light blue
  if (temp <= 50) return '#7bc67e'; // Green
  if (temp <= 70) return '#d4c840'; // Yellow-green
  if (temp <= 85) return '#f6a623'; // Amber
  if (temp <= 95) return '#e87040'; // Orange
  return '#e85a4f'; // Red
}

export function drawTemperatureCanvas({ canvas, hourly, hours = 48 }: TempCanvasOptions): void {
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

  // Slice data to desired hours
  const data = hourly.slice(0, hours);
  if (data.length === 0) return;

  // Layout
  const pad = { top: 28, right: 16, bottom: 40, left: 44 };
  const plotW = cw - pad.left - pad.right;
  const plotH = ch - pad.top - pad.bottom;

  // Temp range
  const temps = data.map(d => d.temperature);
  const feels = data.map(d => d.feelsLike);
  const allTemps = [...temps, ...feels];
  const minT = Math.floor(Math.min(...allTemps) / 5) * 5 - 5;
  const maxT = Math.ceil(Math.max(...allTemps) / 5) * 5 + 5;
  const tRange = maxT - minT;

  // Helper: data index to x position
  const xAt = (i: number) => pad.left + (i / (data.length - 1)) * plotW;
  // Helper: temperature to y position
  const yAt = (t: number) => pad.top + (1 - (t - minT) / tRange) * plotH;

  // Clear
  ctx.clearRect(0, 0, cw, ch);

  // Draw night regions
  data.forEach((d, i) => {
    if (!d.isDay && i < data.length - 1) {
      const x1 = xAt(i);
      const x2 = xAt(i + 1);
      ctx.fillStyle = COLORS.night;
      ctx.fillRect(x1, pad.top, x2 - x1, plotH);
    }
  });

  // Horizontal grid lines
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let t = minT; t <= maxT; t += 10) {
    const y = yAt(t);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cw - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = COLORS.gridLabel;
    ctx.fillText(`${t}\u00B0`, pad.left - 6, y);
  }

  // Time labels on bottom
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelEvery = data.length <= 24 ? 3 : 6;
  data.forEach((d, i) => {
    if (i % labelEvery === 0) {
      const x = xAt(i);
      const hour = d.time.getHours();
      const ampm = hour >= 12 ? 'p' : 'a';
      const h12 = hour % 12 || 12;
      const label = `${h12}${ampm}`;

      // Day boundary marker
      if (hour === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Day name
        const dayName = d.time.toLocaleDateString('en-US', { weekday: 'short' });
        ctx.fillStyle = 'rgba(246, 166, 35, 0.5)';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillText(dayName, x + 20, pad.top + plotH + 20);
      }

      ctx.fillStyle = COLORS.text;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(label, x, pad.top + plotH + 6);
    }
  });

  // Precipitation probability bars (background layer)
  const maxPrecipProb = 100;
  data.forEach((d, i) => {
    if (d.precipitationProbability > 5) {
      const x = xAt(i);
      const barH = (d.precipitationProbability / maxPrecipProb) * plotH * 0.3;
      const barW = plotW / data.length;

      ctx.fillStyle = COLORS.precipFill;
      ctx.fillRect(x - barW / 2, pad.top + plotH - barH, barW, barH);
    }
  });

  // Smooth curve helper using cardinal spline
  function drawSmoothLine(points: { x: number; y: number }[], tension: number = 0.3) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  // Feels-like line (subtle background)
  const feelsPoints = data.map((d, i) => ({ x: xAt(i), y: yAt(d.feelsLike) }));
  drawSmoothLine(feelsPoints);
  ctx.strokeStyle = COLORS.feelsLine;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Temperature gradient fill
  const tempPoints = data.map((d, i) => ({ x: xAt(i), y: yAt(d.temperature) }));
  drawSmoothLine(tempPoints);
  ctx.lineTo(xAt(data.length - 1), pad.top + plotH);
  ctx.lineTo(xAt(0), pad.top + plotH);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  gradient.addColorStop(0, 'rgba(246, 166, 35, 0.12)');
  gradient.addColorStop(1, 'rgba(246, 166, 35, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Temperature line with varying color
  for (let i = 0; i < tempPoints.length - 1; i++) {
    const segGrad = ctx.createLinearGradient(
      tempPoints[i].x, 0, tempPoints[i + 1].x, 0
    );
    segGrad.addColorStop(0, getTemperatureColor(data[i].temperature));
    segGrad.addColorStop(1, getTemperatureColor(data[i + 1].temperature));

    ctx.beginPath();
    ctx.moveTo(tempPoints[i].x, tempPoints[i].y);

    const p0 = tempPoints[Math.max(0, i - 1)];
    const p1 = tempPoints[i];
    const p2 = tempPoints[i + 1];
    const p3 = tempPoints[Math.min(tempPoints.length - 1, i + 2)];
    const tension = 0.3;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    ctx.strokeStyle = segGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // "Now" marker line
  const now = new Date();
  const nowIndex = data.findIndex(d => d.time > now);
  if (nowIndex > 0) {
    const prevTime = data[nowIndex - 1].time.getTime();
    const nextTime = data[nowIndex].time.getTime();
    const frac = (now.getTime() - prevTime) / (nextTime - prevTime);
    const nowX = xAt(nowIndex - 1 + frac);

    ctx.strokeStyle = COLORS.now;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(nowX, pad.top);
    ctx.lineTo(nowX, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Now" label
    ctx.fillStyle = 'rgba(246, 166, 35, 0.7)';
    ctx.font = '500 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOW', nowX, pad.top - 6);
  }

  // Precipitation probability text for significant chances
  data.forEach((d, i) => {
    if (d.precipitationProbability >= 40 && i % (labelEvery * 2) === 0) {
      const x = xAt(i);
      ctx.fillStyle = COLORS.precipBar;
      ctx.font = '500 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${d.precipitationProbability}%`, x, pad.top + plotH - 4);
    }
  });
}

/**
 * Setup resize observer for responsive canvas
 */
export function setupTemperatureCanvas(canvas: HTMLCanvasElement, hourly: HourlyForecast[], hours?: number): () => void {
  const draw = () => drawTemperatureCanvas({ canvas, hourly, hours });
  draw();

  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas.parentElement || canvas);

  return () => ro.disconnect();
}
