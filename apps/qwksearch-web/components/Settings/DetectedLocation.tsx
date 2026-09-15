'use client';

import { useCallback, useEffect, useState } from 'react';
import grab from 'grab-url';
import { Loader2, MapPin, RefreshCw } from 'lucide-react';
import { AnchorTitle } from './anchors';

interface ClientLocation {
  ip: string | null;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  source: 'edge' | 'ipapi' | 'none';
}

const ANCHOR_ID = 'search-detectedLocation';

const formatPlace = (location: ClientLocation) =>
  [location.city, location.region, location.country ?? location.countryCode]
    .filter(Boolean)
    .join(', ');

const formatCoordinates = (location: ClientLocation) =>
  typeof location.latitude === 'number' && typeof location.longitude === 'number'
    ? `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
    : null;

/**
 * Read-only card showing the city the server geolocated the current request
 * to. This is the location the homepage weather widget falls back to when
 * "Weather Locations" is left blank, so it lives alongside that setting.
 */
const DetectedLocation = () => {
  const [location, setLocation] = useState<ClientLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setFailed(false);
    try {
      const data = await grab('geolocation');
      // grab resolves with the body even on HTTP errors, so an error payload
      // ({ message }) would otherwise be rendered as a location.
      if (!data || typeof data.source !== 'string') {
        throw new Error(data?.message ?? 'Invalid geolocation response.');
      }
      setLocation(data as ClientLocation);
    } catch (error) {
      console.error('Error fetching detected location:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const place = location ? formatPlace(location) : '';
  const coordinates = location ? formatCoordinates(location) : null;

  return (
    <section
      id={ANCHOR_ID}
      className="scroll-mt-4 rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm text-black dark:text-white">
            <AnchorTitle anchorId={ANCHOR_ID}>Detected Location</AnchorTitle>
          </h4>
          <p className="text-[11px] text-black/50 dark:text-white/50">
            The city we infer from your IP address. Used to auto-detect your
            weather location when &ldquo;Weather Locations&rdquo; is blank.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLocation}
          disabled={isLoading}
          title="Re-check location"
          aria-label="Re-check location"
          className="shrink-0 rounded-lg p-1.5 text-black/50 transition duration-200 hover:bg-light-200 active:scale-95 disabled:opacity-50 dark:text-white/50 dark:hover:bg-dark-200"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-4">
        {isLoading && !location ? (
          <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
            <Loader2 size={14} className="animate-spin" />
            <span>Detecting your location…</span>
          </div>
        ) : failed ? (
          <p className="text-xs text-black/50 dark:text-white/50">
            Couldn&apos;t detect your location right now.
          </p>
        ) : place ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-black/40 dark:text-white/40" />
              <span className="text-sm text-black dark:text-white">{place}</span>
            </div>
            <p className="text-[11px] text-black/50 dark:text-white/50">
              {[
                location?.timezone,
                coordinates,
                location?.ip ? `IP ${location.ip}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p className="text-xs text-black/50 dark:text-white/50">
            No city could be resolved for your IP address
            {location?.ip ? ` (${location.ip})` : ''}. Set a location manually
            under &ldquo;Weather Locations&rdquo; below.
          </p>
        )}
      </div>
    </section>
  );
};

export default DetectedLocation;
