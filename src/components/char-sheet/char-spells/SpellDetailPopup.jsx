import { useState, useMemo } from 'react';
import { sanitizeHtml } from '../../../services/ui/sanitize.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js'
import { getActiveBuffs } from '../../../services/combat/buffService.js'

function isFreeCastAuthorized(playerName, spellName, playerStats) {
  const raw = getRuntimeValue(playerName, '_War_God_s_Blessing_freeCast');
  if (raw && Array.isArray(raw) && raw.includes(spellName)) return true;

  const naturalRecoveryFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (naturalRecoveryFreeCast && Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.includes(spellName)) return true;

  const actions = playerStats?.automation?.actions || [];
  for (const entry of actions) {
    if (entry.type !== 'free_spell') continue;
    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    // Counter-based free casts (uses_expression)
    if (entry.uses_expression && entry.usesMax) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
      return count > 0;
    }

    if (entry.perSpellTracking) {
      const freeKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCast`;
      return !!getRuntimeValue(playerName, freeKey);
    }

    const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
    const stored = getRuntimeValue(playerName, sharedKey);
    if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  }

  return false;
}

function SpellDetailPopup({ spell, playerStats, campaignName, onClose, onCast, upcastLevels = [], playerLevel = 1 }) {
  const isCantrip = spell.level === 0;
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const isUpcastable = !isCantrip && slotDmg && Object.keys(slotDmg).length > 1;

  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, playerStats);
  const hasAnySlots = isCantrip || freeCastAuthorized || upcastLevels.some(l => l.availableSlots > 0);

  const [selectedUpcastLvl, setSelectedUpcastLvl] = useState(() => {
    const firstAvailable = upcastLevels.find(l => l.availableSlots > 0);
    return firstAvailable ? String(firstAvailable.level) : String(upcastLevels[0]?.level || spell.level);
  });

  const cantripAutoLevel = useMemo(() => {
    if (!isCantrip) return null;
    const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
    if (!dmgObj) return null;
    const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
    const applicable = levels.filter(l => l <= playerLevel);
    return applicable.length > 0 ? Math.max(...applicable) : null;
  }, [isCantrip, charDmg, slotDmg, playerLevel]);

  const handleCast = () => {
    if (!canCast) return;
    if (isCantrip) {
      const modifiedSpell = cantripAutoLevel ? { ...spell, level: cantripAutoLevel } : spell;
      onCast(modifiedSpell);
      return;
    }
    const isUpcast = isUpcastable && Number(selectedUpcastLvl) !== spell.level;
    if (isUpcast) {
      const upcastLevel = Number(selectedUpcastLvl);
      const slotKey = `spell_slots_level_${upcastLevel}`;
      const currentSlots = getRuntimeValue(playerStats.name, slotKey);
      const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
      const availableSlots = currentSlots != null ? currentSlots : maxSlots;
      if (availableSlots > 0) {
        setRuntimeValue(playerStats.name, slotKey, availableSlots - 1, campaignName);
      }
      const modifiedSpell = { ...spell, level: upcastLevel };
      onCast(modifiedSpell);
      return;
    }
    if (freeCastAuthorized) {
      const actions = playerStats?.automation?.actions || [];
      for (const entry of actions) {
        if (entry.type !== 'free_spell') continue;
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (!spells.includes(spell.name)) continue;

        // Counter-based free casts (uses_expression)
        if (entry.uses_expression && entry.usesMax) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerStats.name, freeCastCountKey) ?? entry.usesMax);
          if (count > 0) {
            setRuntimeValue(playerStats.name, freeCastCountKey, count - 1, campaignName);
          }
          break;
        }

        if (entry.perSpellTracking) {
          const usedKey = `_${entry.name.replace(/\s+/g, '_')}_${spell.name.replace(/\s+/g, '_')}_used`;
          setRuntimeValue(playerStats.name, usedKey, true, campaignName);
          break;
        }
      }
      const nrFreeCast = getRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast');
      if (nrFreeCast && Array.isArray(nrFreeCast) && nrFreeCast.includes(spell.name)) {
        setRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast', null, campaignName);
      }
    } else {
      const spellSlotKey = `spell_slots_level_${spell.level}`;
      const currentSlots = getRuntimeValue(playerStats.name, spellSlotKey);
      const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[spellSlotKey]) || 0;
      const availableSlots = currentSlots != null ? currentSlots : maxSlots;
      if (availableSlots > 0) {
        setRuntimeValue(playerStats.name, spellSlotKey, availableSlots - 1, campaignName);
      }
    }
    onCast(spell);
  };

  const isRaging = getActiveBuffs(playerStats.name, campaignName).some(b => b.name === 'Rage');
  const canCast = !isRaging && (isCantrip || (isUpcastable ? hasAnySlots : (freeCastAuthorized || (() => {
    const baseKey = `spell_slots_level_${spell.level}`;
    const stored = getRuntimeValue(playerStats.name, baseKey);
    const max = (playerStats.spellAbilities && playerStats.spellAbilities[baseKey]) || 0;
    return (stored != null ? stored : max) > 0;
  })())));

  const showUpcastSelector = isUpcastable && upcastLevels.length > 1;

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
          {!isCantrip && !showUpcastSelector && (
            <span><b>Slots Remaining:</b> {(() => {
              const baseKey = `spell_slots_level_${spell.level}`;
              const stored = getRuntimeValue(playerStats.name, baseKey);
              const max = (playerStats.spellAbilities && playerStats.spellAbilities[baseKey]) || 0;
              return stored != null ? stored : max;
            })()}</span>
          )}
        </div>
        {showUpcastSelector && (
          <div className="spell-detail-upcast">
            <p className="spell-detail-upcast-label"><i className="fa-solid fa-arrow-up"></i> Cast at Level:</p>
            {upcastLevels.map(({ level, formula, availableSlots }) => {
              const isSelected = selectedUpcastLvl === String(level);
              return (
                <label
                  key={level}
                  className={`spell-detail-upcast-level ${isSelected ? 'spell-detail-upcast-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="spellDetailUpcastLevel"
                    value={level}
                    checked={isSelected}
                    onChange={() => setSelectedUpcastLvl(String(level))}
                    disabled={availableSlots <= 0}
                  />
                  <span className="spell-detail-upcast-level-number">Level {level}</span>
                  <span className="spell-detail-upcast-formula">{formula}</span>
                  <span className="spell-detail-upcast-slots">{availableSlots} slot{availableSlots !== 1 ? 's' : ''}</span>
                </label>
              );
            })}
          </div>
        )}
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
          {freeCastAuthorized && (
            <p className="spell-detail-free-cast"><i className="fa-solid fa-bolt"></i> Free Cast — no spell slot consumed</p>
          )}
          {!canCast && !isCantrip && !freeCastAuthorized && (
          <p className="spell-detail-no-slots">No spell slots available for this level.</p>
        )}
      </div>
    </div>
  );
}

export default SpellDetailPopup;
