/**
 * @fileoverview Chat "thinking" loader that shows a different animation every
 * time it mounts, picked at random from the GRAB-URL spinner set
 * (`grab-url/animations` plus the eight `<Spinner>` variants) and the quantum
 * orbital sphere.
 */
'use client';

import { useEffect, useState } from 'react';
import QuantumWaveOrbital from 'quantum-sphere-loading-icon/react';
import { cn } from '../../lib/utils';
import Spinner from '../../ui/spinner';
import {
  QUANTUM_SPHERE_ANIMATION,
  getRandomLoadingAnimation,
  getSpinnerVariant,
  renderLoadingAnimation,
} from './loading-animations';

interface RandomLoadingAnimationProps {
  /** Width and height of the spinners, in pixels. */
  size?: number;
  /** Extra classes for the centering wrapper. */
  className?: string;
}

/**
 * Renders one randomly chosen loading animation.
 *
 * The pick happens in an effect rather than during render so server and client
 * markup match; until it lands the wrapper renders empty at its final height,
 * which keeps the surrounding layout from shifting.
 *
 * @returns {JSX.Element} The rendered loader
 */
const RandomLoadingAnimation = ({
  size = 140,
  className,
}: RandomLoadingAnimationProps) => {
  const [animation, setAnimation] = useState<string | null>(null);

  useEffect(() => {
    setAnimation(getRandomLoadingAnimation());
  }, []);

  const spinnerVariant = animation ? getSpinnerVariant(animation) : undefined;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex items-center justify-center w-full h-[200px]', className)}
    >
      {animation === QUANTUM_SPHERE_ANIMATION ? (
        <QuantumWaveOrbital autoRandomize={true} />
      ) : spinnerVariant ? (
        <Spinner
          variant={spinnerVariant}
          size={size}
          className="text-muted-foreground"
        />
      ) : animation ? (
        <div
          className="flex items-center justify-center"
          // Static markup from `grab-url/animations`, not user content.
          dangerouslySetInnerHTML={{
            __html: renderLoadingAnimation(animation, size),
          }}
        />
      ) : null}
    </div>
  );
};

export default RandomLoadingAnimation;
