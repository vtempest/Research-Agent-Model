/**
 * @fileoverview "Up next" strip under the video, showing what the queue holds.
 */

'use client';

import { ListVideo } from 'lucide-react';
import type { PlayerVideo } from './playerStore';

export function PlayerQueue({ queue }: { queue: PlayerVideo[] }) {
  if (queue.length === 0) return null;

  return (
    <div className="eytp-queue">
      <div className="eytp-queue-heading">
        <ListVideo size={11} />
        <span>Up next</span>
      </div>
      <p className="eytp-queue-next">{queue[0].title ?? queue[0].videoId}</p>
      {queue.length > 1 && <p className="eytp-queue-rest">+{queue.length - 1} more in queue</p>}
    </div>
  );
}
