import { useState, useMemo } from 'react';
import { sanitizeHtml } from '../../../services/ui/sanitize.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js'
import { getActiveBuffs } from '../../../services/combat/buffService.js'

function isFreeCastAuthorized(playerName, spellName, spellLevel, playerStats, campaignName) {
  const raw = getRuntimeValue(playerName, '_War_God_s_Blessing_freeCast');
  if (raw && Array.isArray(raw) && raw.includes(spellName)) return true;

  const naturalRecoveryFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (naturalRecoveryFreeCast && Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.includes(spellName)) return true;

  const bewitchingFreeCast = getRuntimeValue(playerName, '_Bewitching_Magic_freeCast');
  if (bewitchingFreeCast && spellName === 'Misty Step') return true;

  // Spell Mastery: check runtime state for player-chosen mastery spells
  const masteryLevel1 = getRuntimeValue(playerName, '_Spell_Mastery_level1', campaignName);
  const masteryLevel2 = getRuntimeValue(playerName, '_Spell_Mastery_level2', campaignName);
  if (spellName === masteryLevel1 && spellLevel === 1) return true;
  if (spellName === masteryLevel2 && spellLevel === 2) return true;

  // Signature Spells: check runtime state for player-chosen signature spells
  const sigSpells = getRuntimeValue(playerName, '_Signature_Spells_selection', campaignName);
  if (Array.isArray(sigSpells) && sigSpells.includes(spellName) && spellLevel === 3) {
    const usedKey = `_Signature_Spells_${spellName.replace(/\s+/g, '_')}_used`;
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (!used) return true;
  }

  // Divination Savant: check runtime state for player-chosen Divination spells
  const divSpells = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
  if (Array.isArray(divSpells) && divSpells.includes(spellName)) {
    const usedKey = `_Divination_Savant_${spellName.replace(/\s+/g, '_')}_used`;
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (!used) return true;
  }

  // Phantasmal Creatures: check runtime state for free cast of Summon Beast or Summon Fey
  const hasPhantasmalCreatures = playerStats?.automation?.passives?.some(p => p.type === 'phantasmal_creatures');
  if (hasPhantasmalCreatures) {
    const summonBeast = ['Summon Beast', 'Summon Fey'];
    if (summonBeast.includes(spellName)) {
      const freeCastCountKey = `_Phantasmal_Creatures_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? 1);
      if (count > 0) return true;
    }
  }

  const actions = playerStats?.automation?.actions || [];
  for (const entry of actions) {
    if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'dragon_companion') continue;

    // Counter-based free casts (uses_expression + usesMax) — match by spell level, not name
    // This handles features like Mystic Arcanum where the spell field is a descriptive placeholder
    // (e.g. "a level 9 Warlock spell (your choice)") that never matches a real spell name.
    if (entry.uses_expression && entry.usesMax) {
      const spellField = Array.isArray(entry.spell) ? entry.spell[0] : entry.spell;
      const levelMatch = spellField ? spellField.match(/level (\d+)/) : null;
      const featureLevel = levelMatch ? parseInt(levelMatch[1], 10) : null;
      if (featureLevel !== null && featureLevel === spellLevel) {
        const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
        const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
        if (count > 0) return true;
      }
      continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

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

  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, spell.level, playerStats, campaignName);
  const hasAnySlots = isCantrip || freeCastAuthorized || upcastLevels.some(l => l.availableSlots > 0);

  const isWarlock = playerStats.class?.name === 'Warlock';
  const hasPsychicSpells = playerStats.automation?.passives?.some(p => p.type === 'psychic_spells');
  const hasSpellBreaker = playerStats.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'spell_breaker');
  const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
  const hasDamage = !!spell.damage;
  const isEnchantmentOrIllusion = () => {
    const school = (spell.school || '').toLowerCase();
    return school === 'enchantment' || school === 'illusion';
  };
  const isIllusionSpell = () => {
    const school = (spell.school || '').toLowerCase();
    return school === 'illusion';
  };
  const canChangeDamageType = isWarlock && hasPsychicSpells && hasDamage;
  const isDispelMagicAsBonusAction = hasSpellBreaker && spell.name === 'Dispel Magic';
  const [usePsychicDamage, setUsePsychicDamage] = useState(false);
  const [noVSComponents] = useState(isWarlock && hasPsychicSpells && isEnchantmentOrIllusion());
  const [noVComponents] = useState(hasImprovedIllusions && isIllusionSpell());

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
      // Spell Mastery: mark as used (at-will, so no tracking needed beyond the cast)
      const masteryLevel1 = getRuntimeValue(playerStats.name, '_Spell_Mastery_level1', campaignName);
      const masteryLevel2 = getRuntimeValue(playerStats.name, '_Spell_Mastery_level2', campaignName);
      if (spell.name === masteryLevel1 || spell.name === masteryLevel2) {
        // At-will casting, no tracking needed
      } else {
        const actions = playerStats?.automation?.actions || [];
        for (const entry of actions) {
          if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'dragon_companion') continue;

          // Counter-based free casts — match by spell level, not name
          // Must stay in sync with isFreeCastAuthorized logic above
          if (entry.uses_expression && entry.usesMax) {
            const spellField = Array.isArray(entry.spell) ? entry.spell[0] : entry.spell;
            const levelMatch = spellField ? spellField.match(/level (\d+)/) : null;
            const featureLevel = levelMatch ? parseInt(levelMatch[1], 10) : null;
            if (featureLevel !== null && featureLevel === spell.level) {
              const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
              const count = Number(getRuntimeValue(playerStats.name, freeCastCountKey) ?? entry.usesMax);
              if (count > 0) {
                setRuntimeValue(playerStats.name, freeCastCountKey, count - 1, campaignName);
              }
              break;
            }
            continue;
          }

          const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
          if (!spells.includes(spell.name)) continue;

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
        if (getRuntimeValue(playerStats.name, '_Bewitching_Magic_freeCast') && spell.name === 'Misty Step') {
          setRuntimeValue(playerStats.name, '_Bewitching_Magic_freeCast', null, campaignName);
        }

        // Signature Spells: mark as used
        const sigSpells = getRuntimeValue(playerStats.name, '_Signature_Spells_selection', campaignName);
        if (Array.isArray(sigSpells) && sigSpells.includes(spell.name) && spell.level === 3) {
          const usedKey = `_Signature_Spells_${spell.name.replace(/\s+/g, '_')}_used`;
          setRuntimeValue(playerStats.name, usedKey, true, campaignName);
        }

        // Divination Savant: mark as used
        const divSpells = getRuntimeValue(playerStats.name, '_Divination_Savant_selection', campaignName);
        if (Array.isArray(divSpells) && divSpells.includes(spell.name)) {
          const divUsedKey = `_Divination_Savant_${spell.name.replace(/\s+/g, '_')}_used`;
          setRuntimeValue(playerStats.name, divUsedKey, true, campaignName);
        }
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
    const modifiedSpell = (() => {
      let s = { ...spell };
      if (canChangeDamageType && usePsychicDamage) {
        s._psychicSpellsOverride = true;
      }
      if (isDispelMagicAsBonusAction && s.casting_time === '1 action') {
        s.casting_time = '1 bonus action';
      }
      // Phantasmal Creatures: change school to Illusion and mark HP halving
      const hasPhantasmalCreatures = playerStats.automation?.passives?.some(p => p.type === 'phantasmal_creatures');
      const summonBeastOrFey = ['Summon Beast', 'Summon Fey'];
      if (hasPhantasmalCreatures && freeCastAuthorized && summonBeastOrFey.includes(spell.name)) {
        s.school = 'Illusion';
        s._phantasmalCreatures = true;
        // Track which summon creature names to halve HP for
        const summonCreatureName = spell.name === 'Summon Beast' ? 'Bestial Spirit' : 'Fey Spirit';
        const existingCreatures = getRuntimeValue(playerStats.name, '_phantasmalCreatures_list');
        const creatureList = Array.isArray(existingCreatures) ? existingCreatures : [];
        if (!creatureList.includes(summonCreatureName)) {
          creatureList.push(summonCreatureName);
          setRuntimeValue(playerStats.name, '_phantasmalCreatures_list', creatureList, campaignName);
        }
      }
      return s;
    })();
    onCast(modifiedSpell);
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
        {canChangeDamageType && (
          <div className="spell-detail-upcast">
            <label>
              <input
                type="checkbox"
                checked={usePsychicDamage}
                onChange={() => setUsePsychicDamage(!usePsychicDamage)}
              />
              <span>Change damage type to Psychic</span>
            </label>
          </div>
        )}
        {noVSComponents && (
          <div className="spell-detail-free-cast">
            <i className="fa-solid fa-ghost"></i> No Verbal or Somatic components (Psychic Spells)
          </div>
        )}
        {noVComponents && (
          <div className="spell-detail-free-cast">
            <i className="fa-solid fa-ghost"></i> No Verbal components (Improved Illusions)
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
