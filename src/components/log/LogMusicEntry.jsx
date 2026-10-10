import { formatTimestamp } from './log-utils.js';

export function MusicEntry({ entry }) {
  const moodLabel = entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : 'Music';
  return (
    <div className="log-entry log-music">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-music"></i></span>
        <span className="log-name">{moodLabel}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      {entry.message && (
        <div className="log-music-details">
          <span>{entry.message}</span>
        </div>
      )}
    </div>
  );
}
