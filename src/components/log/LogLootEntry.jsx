import { formatTimestamp } from './log-utils.js';

export function LootEntry({ entry }) {
   return (
      <div className="log-entry log-loot">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-coins"></i></span>
          <span className="log-name">Loot &amp; XP Awarded</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-loot-details">
           {entry.xpPerChar > 0 && (
             <span className="log-loot-xp">
               <i className="fas fa-star"></i>&nbsp;{entry.xpPerChar.toLocaleString()} XP per character
             </span>
            )}
          {entry.lootItems && entry.lootItems.length > 0 && (
            <ul className="log-loot-items">
              {entry.lootItems.map((item, i) => (
                <li key={i} className="log-loot-item">{item}</li>
                 ))}
              </ul>
            )}
        </div>
      </div>
     );
   }
