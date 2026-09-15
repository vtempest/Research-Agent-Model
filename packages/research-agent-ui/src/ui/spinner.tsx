/**
 * @fileoverview `Spinner` — the shadcn/ui-style loading component from the
 * GRAB-URL loading-animations set, with eight variants. Every variant draws
 * with `currentColor` and sizes off a single `size` prop, so a text-color
 * utility class is all it takes to restyle one.
 */
'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

/** Every look `Spinner` can draw. */
export const SPINNER_VARIANTS = [
  'default',
  'circle',
  'pinwheel',
  'circle-filled',
  'ellipsis',
  'ring',
  'bars',
  'infinite',
] as const;

/** One of the eight names in {@link SPINNER_VARIANTS}. */
export type SpinnerVariant = (typeof SPINNER_VARIANTS)[number];

export interface SpinnerProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Which animation to draw. Defaults to the rotating spokes. */
  variant?: SpinnerVariant;
  /** Width and height in pixels. */
  size?: number;
}

/** The lemniscate the `infinite` variant traces. */
const INFINITY_LOOP =
  'M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z';

/**
 * Spins a group about the middle of the 24×24 viewBox. `transform-box` is set
 * explicitly because an SVG child's default box is the element's own bounds in
 * older engines, which would swing an arc around its own centre instead.
 */
const SPIN_ABOUT_CENTRE: React.CSSProperties = {
  transformBox: 'view-box',
  transformOrigin: 'center',
};

/** The eight spokes of the default variant, drawn faintest last so it reads as rotating. */
const SPOKES: Array<[number, number, number, number]> = [
  [12, 2, 12, 6],
  [16.24, 7.76, 19.07, 4.93],
  [18, 12, 22, 12],
  [16.24, 16.24, 19.07, 19.07],
  [12, 18, 12, 22],
  [4.93, 19.07, 7.76, 16.24],
  [2, 12, 6, 12],
  [4.93, 4.93, 7.76, 7.76],
];

/**
 * Draws the body of one variant inside the shared 24×24 viewBox.
 *
 * @param variant - Which look to draw
 * @returns {React.ReactNode} The variant's SVG children
 */
const renderVariant = (variant: SpinnerVariant): React.ReactNode => {
  switch (variant) {
    case 'circle':
      return (
        <g className="animate-spin" style={SPIN_ABOUT_CENTRE}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </g>
      );

    case 'pinwheel':
      return (
        <g className="animate-spin" style={SPIN_ABOUT_CENTRE}>
          <path d="M22 12a1 1 0 0 1-10 0 1 1 0 0 0-10 0" />
          <path d="M7 20.7a1 1 0 1 1 5-8.7 1 1 0 1 0 5-8.6" />
          <path d="M7 3.3a1 1 0 1 1 5 8.6 1 1 0 1 0 5 8.6" />
          <circle cx="12" cy="12" r="10" />
        </g>
      );

    case 'circle-filled':
      return (
        <>
          <circle cx="12" cy="12" r="9" opacity="0.2" />
          <g className="animate-spin" style={SPIN_ABOUT_CENTRE}>
            <path d="M21 12a9 9 0 0 0-9-9" />
          </g>
        </>
      );

    case 'ellipsis':
      return (
        <g fill="currentColor" stroke="none">
          {[4, 12, 20].map((cx, index) => (
            <circle key={cx} cx={cx} cy="12" r="2.5">
              <animate
                attributeName="cy"
                values="12;7.5;12"
                keyTimes="0;0.5;1"
                dur="1.2s"
                begin={`${index * 0.16}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      );

    case 'ring':
      return (
        <>
          {[0, -0.8].map((begin) => (
            <circle key={begin} cx="12" cy="12" r="2">
              <animate
                attributeName="r"
                values="2;11"
                dur="1.6s"
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0"
                dur="1.6s"
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </>
      );

    case 'bars':
      return (
        <g fill="currentColor" stroke="none">
          {[2.5, 10, 17.5].map((x, index) => (
            <rect key={x} x={x} y="8" width="4" height="8" rx="1.5">
              <animate
                attributeName="height"
                values="8;18;8"
                keyTimes="0;0.5;1"
                dur="1.1s"
                begin={`${index * 0.18}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values="8;3;8"
                keyTimes="0;0.5;1"
                dur="1.1s"
                begin={`${index * 0.18}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </g>
      );

    case 'infinite':
      return (
        <>
          <path d={INFINITY_LOOP} opacity="0.2" />
          {/* `pathLength` normalises the loop to 100 units, so the dash and its
              travel are expressed as percentages rather than measured lengths. */}
          <path d={INFINITY_LOOP} pathLength="100" strokeDasharray="25 75">
            <animate
              attributeName="stroke-dashoffset"
              values="100;0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
        </>
      );

    default:
      return (
        <g className="animate-spin" style={SPIN_ABOUT_CENTRE}>
          {SPOKES.map(([x1, y1, x2, y2], index) => (
            <line
              key={`${x1}-${y1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              opacity={1 - index * 0.1}
            />
          ))}
        </g>
      );
  }
};

/**
 * One loading animation, drawn in the current text color.
 *
 * @example
 * ```tsx
 * <Spinner />
 * <Spinner variant="circle" size={48} />
 * <Spinner variant="bars" className="text-primary" />
 * ```
 *
 * @returns {JSX.Element} The rendered spinner
 */
const Spinner = ({
  variant = 'default',
  size = 24,
  className,
  ...props
}: SpinnerProps) => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('shrink-0', className)}
    {...props}
  >
    {renderVariant(variant)}
  </svg>
);

export default Spinner;
export { Spinner };
