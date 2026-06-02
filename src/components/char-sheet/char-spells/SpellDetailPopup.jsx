
import React from 'react'
import { sanitizeHtml } from '../../../services/sanitize.js';
import { setRuntimeValue } from '../../../hooks/useRuntimeState.js'

function SpellDetailPopup({ spell, playerStats, campaignName, onClose, onCast }) {
  const isCantrip = spell.level === 0;
  const spellSlotKey = `spell_slots_level_${spell.level}`;
  const currentSlots = (() => {
    const stored = (playerStats.spellAbilities && playerStats.spellAbilities[spellSlotKey]) || 0;
    return stored;
  })();

  const canCast = isCantrip || currentSlots > 0;

  const handleCast = () => {
    if (!canCast) return;
    if (!isCantrip) {
      setRuntimeValue(playerStats.name, spellSlotKey, currentSlots - 1, campaignName);
    }
    onCast(spell);
  };

  return (
    <div className="spell-detail-popup">
      <div className="spell-detail-content">
        <h3 dangerouslySetInnerHTML={{ __html: sanitizeHtml(spell.name) }} />
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(spell.description) ? spell.description.join('') : spell.description || '') }} />
        <div className="spell-detail-meta">
          <span><b>Level:</b> {isCantrip ? 'Cantrip' : spell.level}</span>
          <span><b>Casting Time:</b> {spell.casting_time || '—'}</span>
          <span><b>Range:</b> {spell.range || '—'}</span>
          <span><b>Duration:</b> {spell.duration || '—'}</span>
          {!isCantrip && <span><b>Slots Remaining:</b> {currentSlots}</span>}
        </div>
        <div className="spell-detail-actions">
          <button
            className="char-btn"
            onClick={handleCast}
            disabled={!canCast}
          >
            <i className="fa-solid fa-wand-magic"></i> Cast Spell
          </button>
          <button className="char-btn char-btn-secondary" onClick={onClose}>
            <i className="fa-solid fa-times"></i> Close
          </button>
        </div>
        {!canCast && !isCantrip && (
          <p className="spell-detail-no-slots">No spell slots available for this level.</p>
        )}
      </div>
    </div>
  );
}

export default SpellDetailPopup;
