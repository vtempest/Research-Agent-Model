"use client";

import * as React from "react";

import ParticleSphereAnimation from "@/components/ui/orbiting-circles-02-utils/particalsphear";
import { cn } from "@/lib/utils";

/**
 * Three counter-rotating rings of source logos orbiting a particle globe.
 *
 * The orbiting icons are the *search engines QwkSearch actually queries*: each
 * one is the engine's own favicon, pulled live from Google's favicon service
 * by domain, so the ring stays correct as engines are added or renamed without
 * anyone having to check in a new SVG. The globe at the centre carries the
 * QwkSearch mark.
 *
 * Ring geometry is pure CSS (`rotate` keyframes on the arm, an equal and
 * opposite `rotate` on the icon so it stays upright), so nothing here runs on
 * the main thread beyond the canvas globe.
 */

/** Google's favicon service — the same one the settings engine list uses. */
export const faviconUrl = (domain: string, size = 64) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

export type OrbitIcon = {
  /** Domain to resolve a favicon for. Ignored when `src` is set. */
  domain?: string;
  /** Explicit image source — used for local assets such as the QwkSearch mark. */
  src?: string;
  alt: string;
  /** Starting position on the ring, in degrees. */
  angle: number;
};

export type Orbit = {
  /** Tailwind sizing classes for the ring's diameter. */
  size: string;
  /** Seconds for one full revolution. */
  duration: number;
  icons: OrbitIcon[];
};

/**
 * Default rings — engines from `packages/search-web-api/src/sources`, using the
 * same engine → domain mapping as `/api/search/engines`.
 */
export const DEFAULT_ORBITS: Orbit[] = [
  {
    size: "w-110 h-110 md:w-180 md:h-180",
    duration: 18,
    icons: [
      { domain: "google.com", alt: "Google", angle: -60 },
      { domain: "duckduckgo.com", alt: "DuckDuckGo", angle: 0 },
      { domain: "wikipedia.org", alt: "Wikipedia", angle: 60 },
    ],
  },
  {
    size: "w-150 h-150 md:w-220 md:h-220",
    duration: 24,
    icons: [
      { domain: "arxiv.org", alt: "arXiv", angle: 0 },
      { domain: "github.com", alt: "GitHub", angle: -90 },
      { domain: "youtube.com", alt: "YouTube", angle: 90 },
    ],
  },
  {
    size: "w-180 h-180 md:w-265 md:h-265",
    duration: 30,
    icons: [
      { domain: "news.ycombinator.com", alt: "Hacker News", angle: -60 },
      { domain: "reddit.com", alt: "Reddit", angle: 0 },
      { domain: "semanticscholar.org", alt: "Semantic Scholar", angle: 60 },
    ],
  },
];

/** One orbiting logo; falls back to a lettermark when the favicon 404s. */
function OrbitLogo({ icon }: { icon: OrbitIcon }) {
  const [errored, setErrored] = React.useState(false);
  const src = icon.src ?? (icon.domain ? faviconUrl(icon.domain) : undefined);

  if (!src || errored) {
    return (
      <span
        aria-hidden="true"
        className="text-muted-foreground flex size-6 items-center justify-center text-xs font-semibold md:size-8"
      >
        {icon.alt.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={icon.alt}
      title={icon.alt}
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className="size-6 object-contain md:size-8"
    />
  );
}

export interface OrbitingCirclesGlobeProps {
  /** Override the rings entirely. */
  orbits?: Orbit[];
  /** Logo pinned to the centre of the globe. Pass `null` for none. */
  centerLogo?: { src: string; alt: string } | null;
  className?: string;
}

export default function OrbitingCirclesGlobe({
  orbits = DEFAULT_ORBITS,
  centerLogo = { src: "/images/qwksearch-mark.png", alt: "QwkSearch" },
  className,
}: OrbitingCirclesGlobeProps) {
  return (
    <div
      className={cn(
        "relative flex h-110 w-full justify-center overflow-hidden md:h-160",
        className,
      )}
    >
      <style>{`
        @keyframes orbit-cw {
          from { transform: rotate(var(--start-angle)) }
          to   { transform: rotate(calc(var(--start-angle) + 360deg)) }
        }
        @keyframes orbit-ccw {
          from { transform: rotate(var(--start-angle)) }
          to   { transform: rotate(calc(var(--start-angle) - 360deg)) }
        }
        @keyframes counter-cw {
          from { transform: rotate(var(--counter-offset, 0deg)) }
          to   { transform: rotate(calc(var(--counter-offset, 0deg) - 360deg)) }
        }
        @keyframes counter-ccw {
          from { transform: rotate(var(--counter-offset, 0deg)) }
          to   { transform: rotate(calc(var(--counter-offset, 0deg) + 360deg)) }
        }
        @media (prefers-reduced-motion: reduce) {
          .qs-orbit-arm, .qs-orbit-icon { animation: none !important }
        }
      `}</style>

      {/* Center particle globe, with the QwkSearch mark at its core. */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 aspect-square w-75 -translate-x-1/2 translate-y-1/2 md:w-145">
        <div className="text-primary/70 h-full w-full">
          <ParticleSphereAnimation />
        </div>
        {centerLogo && (
          /* The globe's true centre sits on the container's bottom edge (it is
             translated down by half its height), so the mark is pinned to the
             middle of the *visible* dome instead of the geometric centre. */
          <img
            src={centerLogo.src}
            alt={centerLogo.alt}
            className="absolute top-[30%] left-1/2 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg md:w-28"
          />
        )}
      </div>

      {/* Orbiting rings */}
      {orbits.map((orbit, index) => {
        const isCW = index % 2 === 0;
        const orbitAnim = isCW ? "orbit-cw" : "orbit-ccw";
        const counterAnim = isCW ? "counter-cw" : "counter-ccw";

        // Mirror each icon across the ring so the spacing stays even.
        const allIcons = [
          ...orbit.icons,
          ...orbit.icons.map((ic) => ({
            ...ic,
            angle: ic.angle + 180,
          })),
        ];

        return (
          <div
            key={index}
            className={cn(
              "border-border absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border",
              orbit.size,
            )}
          >
            {allIcons.map((iconData, iconIndex) => (
              <div
                key={`${iconData.alt}-${iconIndex}`}
                className="qs-orbit-arm absolute top-0 left-1/2 -ml-8 flex h-1/2 origin-bottom flex-col items-center justify-start"
                style={
                  {
                    "--start-angle": `${iconData.angle}deg`,
                    animation: `${orbitAnim} ${orbit.duration}s linear infinite`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="qs-orbit-icon border-border bg-background relative z-10 -mt-8 rounded-full border p-3 sm:p-4"
                  style={
                    {
                      "--counter-offset": `${-iconData.angle}deg`,
                      animation: `${counterAnim} ${orbit.duration}s linear infinite`,
                    } as React.CSSProperties
                  }
                >
                  <OrbitLogo icon={iconData} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
