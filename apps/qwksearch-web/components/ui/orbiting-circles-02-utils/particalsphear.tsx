"use client";

import * as React from "react";

/**
 * Rotating particle globe rendered on a `<canvas>`.
 *
 * Dependency-free (no three.js / animation runtime) so it can sit in the
 * marketing hero without adding weight to the first-load bundle. Points are
 * distributed with a Fibonacci sphere, spun around the Y axis, and projected
 * with a cheap perspective divide — depth drives both radius and alpha so the
 * far side of the globe reads as "behind" the near side.
 *
 * Colours come from the element's inherited `color` (i.e. `currentColor`), so
 * the globe follows the active theme: put `text-primary`/`text-foreground` on
 * a parent to re-tint it.
 */
export interface ParticleSphereAnimationProps {
  /** Number of particles. Lower it on dense pages. */
  count?: number;
  /** Seconds for one full revolution. */
  duration?: number;
  /** Sphere radius as a fraction of the canvas' smaller side. */
  radiusRatio?: number;
  className?: string;
}

/** Evenly spaced points on a unit sphere (golden-angle spiral). */
function fibonacciSphere(count: number) {
  const points: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring });
  }

  return points;
}

export default function ParticleSphereAnimation({
  count = 900,
  duration = 26,
  radiusRatio = 0.42,
  className,
}: ParticleSphereAnimationProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const points = fibonacciSphere(count);
    // Fixed tilt so the pole never points straight at the viewer.
    const tilt = -0.35;
    const sinTilt = Math.sin(tilt);
    const cosTilt = Math.cos(tilt);

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width || canvas.clientWidth;
      height = rect.height || canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (angle: number) => {
      if (!width || !height) return;

      // `currentColor` — re-read each frame so theme switches are picked up.
      ctx.clearRect(0, 0, width, height);
      const color = getComputedStyle(canvas).color || "rgb(120,120,120)";
      ctx.fillStyle = color;

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * radiusRatio;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      for (const point of points) {
        // Spin around Y, then tilt around X.
        const x = point.x * cos - point.z * sin;
        const z0 = point.x * sin + point.z * cos;
        const y = point.y * cosTilt - z0 * sinTilt;
        const z = point.y * sinTilt + z0 * cosTilt;

        // Perspective: z = 1 is nearest the viewer, z = -1 the far side.
        const scale = 1 / (2.2 - z);
        const px = cx + x * radius * scale * 2.2;
        const py = cy + y * radius * scale * 2.2;
        const depth = (z + 1) / 2;

        ctx.globalAlpha = 0.12 + depth * 0.68;
        ctx.beginPath();
        ctx.arc(px, py, 0.5 + depth * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    resize();

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Static frame only — still legible, no motion.
      draw(0);
      const observer = new ResizeObserver(() => {
        resize();
        draw(0);
      });
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      draw((((now - start) / 1000) % duration) * ((Math.PI * 2) / duration));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [count, duration, radiusRatio]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "h-full w-full"}
    />
  );
}
