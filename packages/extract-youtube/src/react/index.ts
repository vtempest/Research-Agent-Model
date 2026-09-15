/**
 * @fileoverview Entry point for `extract-youtube/react` — the UI half of the
 * package: a popout transcript modal and a floating, persistent YouTube
 * player. Kept separate from the main entry so consumers who only want the
 * transcript-fetching API never pull in React, and vice versa.
 */

export { YouTubeTranscriptModal } from './YouTubeTranscriptModal';
export type { YouTubeTranscriptModalProps } from './YouTubeTranscriptModal';

export { FloatingYouTubePlayer } from './player/FloatingYouTubePlayer';
export type {
  FloatingYouTubePlayerProps,
  PlayerControlContext,
} from './player/FloatingYouTubePlayer';

export {
  youtubePlayer,
  usePlayerState,
  getPlayerState,
  sendPlayerCommand,
} from './player/playerStore';
export type { PlayerVideo, PlayerState, PlayOptions } from './player/playerStore';

export {
  buildEmbedUrl,
  watchUrl,
  thumbnailUrl,
  describePlayerError,
} from './player/youtubeEmbed';

export { loadTranscript, useTranscript, formatTime } from './transcript';
export type { TranscriptSnippet, TranscriptSource, TranscriptResponse } from './transcript';

export { groupIntoSentences } from './sentences';
