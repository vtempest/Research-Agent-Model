/**
 * @fileoverview localStorage persistence for the floating player: the widget
 * survives a page reload still playing the same video at the same spot, and
 * every video the user watched keeps its own resume position for a day.
 *
 * Every function is best-effort — private-mode browsers and full quotas throw
 * on both reads and writes, and a player that can't remember where it was is
 * far better than one that crashes.
 */

import type { PlayerVideo } from './playerStore';

/** Default `storageKey`; the per-video position map lives under `<key>:positions`. */
export const DEFAULT_STORAGE_KEY = 'floating-youtube-player';

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STORED_VIDEOS = 50;

export interface PersistedPlayerState {
  video: PlayerVideo;
  isMinimized: boolean;
  playbackRate: number;
  queue: PlayerVideo[];
  /** Seconds into the video. */
  savedTime: number;
  /** Unix ms. */
  savedAt: number;
}

interface StoredPosition {
  savedTime: number;
  savedAt: number;
}

function positionsKey(storageKey: string): string {
  return `${storageKey}:positions`;
}

export function savePlayerState(storageKey: string, snapshot: Omit<PersistedPlayerState, 'savedAt'>): void {
  try {
    const toSave: PersistedPlayerState = { ...snapshot, savedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(toSave));
    saveVideoPosition(storageKey, snapshot.video.videoId, snapshot.savedTime);
  } catch {
    // ignore quota / private-mode errors
  }
}

export function loadPlayerState(storageKey: string): PersistedPlayerState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PersistedPlayerState;
    if (!saved?.video?.videoId || Date.now() - saved.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function clearPlayerState(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

/** Remember how far into `videoId` the viewer got. */
export function saveVideoPosition(storageKey: string, videoId: string, savedTime: number): void {
  try {
    const raw = localStorage.getItem(positionsKey(storageKey));
    let positions: Record<string, StoredPosition> = raw ? JSON.parse(raw) : {};

    positions[videoId] = { savedTime, savedAt: Date.now() };

    // Keep only the most recent entries so this never grows without bound.
    const entries = Object.entries(positions);
    if (entries.length > MAX_STORED_VIDEOS) {
      positions = Object.fromEntries(
        entries.sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, MAX_STORED_VIDEOS),
      );
    }

    localStorage.setItem(positionsKey(storageKey), JSON.stringify(positions));
  } catch {
    // ignore quota / private-mode errors
  }
}

/** The remembered position for `videoId`, or null if there isn't a fresh one. */
export function loadVideoPosition(storageKey: string, videoId: string): number | null {
  try {
    const raw = localStorage.getItem(positionsKey(storageKey));
    if (!raw) return null;

    const positions: Record<string, StoredPosition> = JSON.parse(raw);
    const position = positions[videoId];
    if (!position) return null;

    if (Date.now() - position.savedAt > MAX_AGE_MS) {
      delete positions[videoId];
      localStorage.setItem(positionsKey(storageKey), JSON.stringify(positions));
      return null;
    }

    return position.savedTime;
  } catch {
    return null;
  }
}
