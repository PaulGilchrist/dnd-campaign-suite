import { useEffect } from 'react';
import { filterNoLootSentinel } from '../../services/items/lootGenerator.js';
import './LootRevealModal.css';

/**
 * Staged loot reveal (engagement plan Phase 6): a fresh Generate Loot lands
 * as an EVENT — the chest springs open and each line tumbles out on its own
 * beat before the Award choice. The staging is pure CSS `animation-delay`
 * (nth-child beats 1–10, then a shared tail) — zero JavaScript timers, so the
 * turn-based policy is untouched even though this is display-only anyway.
 *
 * Presentation over the existing lanes: the draft, textarea, and the two-step
 * Award confirm live in InitiativeLoot unchanged. "Award to Party" closes the
 * celebration and arms the normal confirm; "Keep editing" closes to the panel.
 */
export default function LootRevealModal({ lootEntries, totalEncounterXp, characters, onClose, onAward }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const entries = filterNoLootSentinel(lootEntries).filter((line) => String(line).trim());
  const xpPerCharacter = Math.floor((totalEncounterXp || 0) / (characters && characters.length > 0 ? characters.length : 1));

  return (
    <div className="loot-reveal-overlay" onClick={onClose}>
      <div
        className="loot-reveal"
        role="dialog"
        aria-label="Loot reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="loot-reveal-head">
          <h3><i className="fa-solid fa-box-open" aria-hidden="true"></i> Spoils of battle</h3>
          <button className="loot-reveal-close" onClick={onClose} title="Close (Esc)">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <ul className="loot-reveal-items">
          {entries.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
        {totalEncounterXp > 0 && (
          <div className="loot-reveal-xp">
            <i className="fa-solid fa-star" aria-hidden="true"></i>&nbsp;
            {totalEncounterXp.toLocaleString()} XP &middot; {xpPerCharacter.toLocaleString()} per character
          </div>
        )}
        <div className="loot-reveal-actions">
          <button className="loot-reveal-btn loot-reveal-btn-award" onClick={onAward}>
            <i className="fa-solid fa-trophy" aria-hidden="true"></i>&nbsp; Award to Party
          </button>
          <button className="loot-reveal-btn loot-reveal-btn-edit" onClick={onClose}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
