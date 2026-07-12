import { useState, useMemo } from 'react';
import { sanitizeHtml } from '../../../services/ui/sanitize.js';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js'
import { getOverchannelNecroticDamage } from '../../../services/automation/handlers/class-wizard/overchannelHandler.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addConcentration, breakConcentration } from '../../../services/combat/concentration/concentrationService.js';
import * as storageService from '../../../services/ui/storage.js';

function isFreeCastAuthorized(playerName, spellName, spellLevel, playerStats, campaignName) {
  const naturalRecoveryFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (naturalRecoveryFreeCast && Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.includes(spellName)) return true;

  const bewitchingFreeCast = getRuntimeValue(playerName, '_Bewitching_Magic_freeCast');
  if (bewitchingFreeCast && spellName === 'Misty Step') return true;

  // Spell Mastery: check runtime state for player-chosen mastery spells
  const masteryLevel1 = getRuntimeValue(playerName, 'SpellMastery_level1', campaignName);
  const masteryLevel2 = getRuntimeValue(playerName, 'SpellMastery_level2', campaignName);
  if (spellName === masteryLevel1 && spellLevel === 1) return true;
  if (spellName === masteryLevel2 && spellLevel === 2) return true;

  // Signature Spells: check runtime state for player-chosen signature spells
  const sigSpells = getRuntimeValue(playerName, 'SignatureSpells_selection', campaignName);
  if (Array.isArray(sigSpells) && sigSpells.includes(spellName) && spellLevel === 3) {
    const usedKey = `SignatureSpells_${spellName.replace(/\s+/g, '_')}_used`;
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
    if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'misty_wanderer' && entry.type !== 'dragon_companion') continue;

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
      else if (featureLevel === null) {
        // Counter-based free cast with real spell name (e.g. Favored Enemy)
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (spells.includes(spellName)) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
          if (count > 0) return true;
        }
      }
      if (featureLevel !== null) continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    if (entry.perSpellTracking) {
      const freeKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCast`;
      const usedKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_used`;
      const hasFreeCast = !!getRuntimeValue(playerName, freeKey);
      const isUsed = !!getRuntimeValue(playerName, usedKey);
      return hasFreeCast && !isUsed;
    }

    const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
    const stored = getRuntimeValue(playerName, sharedKey);
    if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  }

  const wgbActive = getRuntimeValue(playerName, '_War_Gods_Blessing_active');
  if (wgbActive && ['Shield of Faith', 'Spiritual Weapon'].includes(spellName)) return true;

  const bonusActions = playerStats?.automation?.bonusActions || [];
  for (const entry of bonusActions) {
    if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'misty_wanderer' && entry.type !== 'dragon_companion') continue;

    if (entry.uses_expression && entry.usesMax) {
      const spellField = Array.isArray(entry.spell) ? entry.spell[0] : entry.spell;
      const levelMatch = spellField ? spellField.match(/level (\d+)/) : null;
      const featureLevel = levelMatch ? parseInt(levelMatch[1], 10) : null;
      if (featureLevel !== null && featureLevel === spellLevel) {
        const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
        const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
        if (count > 0) return true;
      }
      else if (featureLevel === null) {
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (spells.includes(spellName)) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
          if (count > 0) return true;
        }
      }
      if (featureLevel !== null) continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    if (entry.perSpellTracking) {
      const freeKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCast`;
      const usedKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_used`;
      const hasFreeCast = !!getRuntimeValue(playerName, freeKey);
      const isUsed = !!getRuntimeValue(playerName, usedKey);
      return hasFreeCast && !isUsed;
    }

    const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
    const stored = getRuntimeValue(playerName, sharedKey);
    if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  }

  const mantleActive = getRuntimeValue(playerName, 'activeBuffs');
  const mantleBuffs = Array.isArray(mantleActive) ? mantleActive : [];
  if (mantleBuffs.some(b => b.name === 'Mantle of Majesty') && spellName === 'Command') return true;

  const specialActions = playerStats?.automation?.specialActions || [];
  for (const entry of specialActions) {
    if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'misty_wanderer' && entry.type !== 'dragon_companion') continue;

    if (entry.uses_expression && entry.usesMax) {
      const spellField = Array.isArray(entry.spell) ? entry.spell[0] : entry.spell;
      const levelMatch = spellField ? spellField.match(/level (\d+)/) : null;
      const featureLevel = levelMatch ? parseInt(levelMatch[1], 10) : null;
      if (featureLevel !== null && featureLevel === spellLevel) {
        const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
        const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
        if (count > 0) return true;
      }
      else if (featureLevel === null) {
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (spells.includes(spellName)) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
          if (count > 0) return true;
        }
      }
      if (featureLevel !== null) continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    if (entry.perSpellTracking) {
      const freeKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCast`;
      const usedKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_used`;
      const hasFreeCast = !!getRuntimeValue(playerName, freeKey);
      const isUsed = !!getRuntimeValue(playerName, usedKey);
      return hasFreeCast && !isUsed;
    }

    const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
    const stored = getRuntimeValue(playerName, sharedKey);
    if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  }

  return false;
}

function cleanupBuffsByName(casterName, buffName, campaignName) {
  const cs = getCombatSummary(campaignName);
  if (!cs || !cs.creatures) return;
  for (const creature of cs.creatures) {
    const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
    if (!Array.isArray(buffs)) continue;
    const filtered = buffs.filter(b => b.name !== buffName);
    if (filtered.length !== buffs.length) {
      setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
    }
  }
}

function SpellDetailPopup({ spell, playerStats, campaignName, onClose, onCast, upcastLevels = [], playerLevel = 1 }) {
  const isCantrip = spell.level === 0;
  const slotDmg = spell.damage?.damage_at_slot_level;
  const healAtSlotLevel = spell.heal_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const isUpcastable = !isCantrip && ((slotDmg && Object.keys(slotDmg).length > 1) || (healAtSlotLevel && Object.keys(healAtSlotLevel).length > 1));

  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, spell.level, playerStats, campaignName);
  const hasAnySlots = isCantrip || freeCastAuthorized || upcastLevels.some(l => l.availableSlots > 0);

  const isWarlock = playerStats.class?.name === 'Warlock';
  const hasPsychicSpells = playerStats.automation?.passives?.some(p => p.type === 'psychic_spells');
  const hasSpellBreaker = playerStats.automation?.passives?.some(p => p.type === 'spell_breaker');
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

   const hasOverchannelPassive = playerStats?.automation?.passives?.some(p => p.type === 'overchannel');
   const isOverchannelApplicable = hasOverchannelPassive && hasDamage && spell.level >= 1 && spell.level <= 5;
   const [useOverchannel, setUseOverchannel] = useState(false);
    const overchannelUseTrigger = useRuntimeValue(playerStats.name, 'Overchannel_useCount', campaignName);
    const overchannelUseCount = useMemo(() => {
      if (!isOverchannelApplicable) return 0;
      const value = overchannelUseTrigger ?? 0;
      return value;
   }, [isOverchannelApplicable, playerStats.name, campaignName, overchannelUseTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextOverchannelUse = overchannelUseCount + 1;
  const overchannelDamage = useMemo(() => {
    if (!isOverchannelApplicable || !useOverchannel) return null;
    const damage = getOverchannelNecroticDamage(spell.level, nextOverchannelUse);
    return damage;
  }, [isOverchannelApplicable, useOverchannel, spell.level, nextOverchannelUse]);

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
    const metaCtx = { overchannel: useOverchannel };
    if (isDispelMagicAsBonusAction) {
      const profBonus = Math.floor((playerStats.level - 1) / 4 + 2);
      metaCtx.dispelAbilityCheckBonus = profBonus;
    }

    // --- Concentration and WGB management ---
    const isWgbActive = getRuntimeValue(playerStats.name, '_War_Gods_Blessing_active');
    const isWgbSpell = isWgbActive && ['Shield of Faith', 'Spiritual Weapon'].includes(spell.name);

    let shouldSetConcentration = false;
    let oldConcentrationSpell = null;

    if (!isWgbSpell && spell.concentration) {
      const cs = getCombatSummary(campaignName);
      if (cs) {
        const creature = cs.creatures.find(c => c.name === playerStats.name);
        if (creature && creature.concentration && creature.concentration.spell !== spell.name) {
          oldConcentrationSpell = creature.concentration.spell;
          breakConcentration(cs, playerStats.name);
          storageService.default.set('combatSummary', cs, campaignName);
          shouldSetConcentration = true;
        } else if (!creature?.concentration) {
          shouldSetConcentration = true;
        }
      }
    }
    // --- End concentration management ---

    if (isCantrip) {
      const modifiedSpell = cantripAutoLevel ? { ...spell, level: cantripAutoLevel, baseLevel: 0 } : { ...spell, baseLevel: 0 };
      onCast(modifiedSpell, metaCtx);
      return;
    }
    const isUpcast = isUpcastable && Number(selectedUpcastLvl) !== spell.level;

    let effectiveSpellLevel = spell.level;

    if (isWgbSpell && spell.name === 'Spiritual Weapon') {
      cleanupBuffsByName(playerStats.name, 'Shield of Faith', campaignName);
    } else if (isUpcast) {
      const upcastLevel = Number(selectedUpcastLvl);
      effectiveSpellLevel = upcastLevel;
      const slotKey = `spell_slots_level_${upcastLevel}`;
      const currentSlots = getRuntimeValue(playerStats.name, slotKey);
      const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
      const availableSlots = currentSlots != null ? currentSlots : maxSlots;
      if (availableSlots > 0) {
        setRuntimeValue(playerStats.name, slotKey, availableSlots - 1, campaignName);
      }
    } else if (freeCastAuthorized) {
      // Spell Mastery: mark as used (at-will, so no tracking needed beyond the cast)
      const masteryLevel1 = getRuntimeValue(playerStats.name, 'SpellMastery_level1', campaignName);
      const masteryLevel2 = getRuntimeValue(playerStats.name, 'SpellMastery_level2', campaignName);
      if (spell.name === masteryLevel1 || spell.name === masteryLevel2) {
        // At-will casting, no tracking needed
      } else {
        // Decrement counter-based free cast (single source of truth — must stay in sync with isFreeCastAuthorized)
        const allActions = [
          ...(playerStats?.automation?.actions || []),
          ...(playerStats?.automation?.bonusActions || []),
          ...(playerStats?.automation?.specialActions || []),
        ];
        for (const entry of allActions) {
          if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'misty_wanderer' && entry.type !== 'dragon_companion') continue;
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
            else if (featureLevel === null) {
              const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
              if (spells.includes(spell.name)) {
                const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
                const count = Number(getRuntimeValue(playerStats.name, freeCastCountKey) ?? entry.usesMax);
                if (count > 0) {
                  setRuntimeValue(playerStats.name, freeCastCountKey, count - 1, campaignName);
                }
                break;
              }
            }
            if (featureLevel !== null) continue;
          }
          const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
          if (!spells.includes(spell.name)) continue;
          if (entry.perSpellTracking) {
            const usedKey = `_${entry.name.replace(/\s+/g, '_')}_${spell.name.replace(/\s+/g, '_')}_used`;
            setRuntimeValue(playerStats.name, usedKey, true, campaignName);
            const entrySpells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
            for (const s of entrySpells) {
              const freeKey = `_${entry.name.replace(/\s+/g, '_')}_${s.replace(/\s+/g, '_')}_freeCast`;
              setRuntimeValue(playerStats.name, freeKey, null, campaignName);
            }
            break;
          }
        }

        const favoredEnemyCount = getRuntimeValue(playerStats.name, '_Favored_Enemy_freeCastCount');
        if (favoredEnemyCount != null) {
          const newCount = Number(favoredEnemyCount);
          if (newCount >= 0) {
            setRuntimeValue(playerStats.name, 'favoredEnemyUses', newCount, campaignName);
          }
        }
        const nrFreeCast = getRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast');
        if (nrFreeCast && Array.isArray(nrFreeCast) && nrFreeCast.includes(spell.name)) {
          setRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast', null, campaignName);
          setRuntimeValue(playerStats.name, 'naturalRecoveryFreeCastUsed', true, campaignName);
        }
        if (getRuntimeValue(playerStats.name, '_Bewitching_Magic_freeCast') && spell.name === 'Misty Step') {
          setRuntimeValue(playerStats.name, '_Bewitching_Magic_freeCast', null, campaignName);
        }

        // Signature Spells: mark as used
        const sigSpells = getRuntimeValue(playerStats.name, 'SignatureSpells_selection', campaignName);
        if (Array.isArray(sigSpells) && sigSpells.includes(spell.name) && spell.level === 3) {
          const usedKey = `SignatureSpells_${spell.name.replace(/\s+/g, '_')}_used`;
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

    // Cleanup old concentration buffs from all creatures
    if (oldConcentrationSpell) {
      cleanupBuffsByName(playerStats.name, oldConcentrationSpell, campaignName);
    }

    // Set new concentration on combat summary
    if (shouldSetConcentration) {
      const cs = getCombatSummary(campaignName);
      if (cs) {
        const targetName = spell.name === "Hunter's Mark"
          ? (cs.creatures.find(c => c.name === playerStats.name)?.targetName || null)
          : null;
        addConcentration(cs, playerStats.name, spell.name, 10, targetName);
        storageService.default.set('combatSummary', cs, campaignName);
      }
    }

    // Hunter's Mark: also store as activeBuff so character sheet shows it
    if (shouldSetConcentration && spell.name === "Hunter's Mark") {
      const existingBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
      const newBuffs = Array.isArray(existingBuffs) ? [...existingBuffs, { name: "Hunter's Mark", effect: 'hunters_mark_concentration', duration: 'concentration' }] : [{ name: "Hunter's Mark", effect: 'hunters_mark_concentration', duration: 'concentration' }];
      setRuntimeValue(playerStats.name, 'activeBuffs', newBuffs, campaignName);
    }

    const modifiedSpell = (() => {
      let s = effectiveSpellLevel !== spell.level
        ? { ...spell, level: effectiveSpellLevel, baseLevel: spell.level }
        : { ...spell };
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
    onCast(modifiedSpell, metaCtx);
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
          {spell.school && <span><b>School:</b> {spell.school}</span>}
          {spell.area_of_effect && <span><b>Area:</b> {spell.area_of_effect.type || spell.area_of_effect.shape}{spell.area_of_effect.size ? ` - ${spell.area_of_effect.size}` : ''}</span>}
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
              const resolvedFormula = formula.replace(/\bMOD\b/g, String(playerStats.spellAbilities?.modifier || 0));
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
                  <span className="spell-detail-upcast-formula">{resolvedFormula}</span>
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
        {isOverchannelApplicable && (
          <div className="spell-detail-upcast">
            <label>
              <input
                type="checkbox"
                checked={useOverchannel}
                onChange={() => setUseOverchannel(!useOverchannel)}
              />
              <span>Overchannel (Maximize Damage)&nbsp;</span>
            </label>
            {overchannelDamage && overchannelDamage.expression && (
              <div className="spell-detail-overchannel-warning">
                <i className="fa-solid fa-skull"></i> Warning: Using Overchannel this time (use #{nextOverchannelUse}) will deal <strong>{overchannelDamage.expression}</strong> Necrotic damage to you (ignores resistance/immunity). First use deals no damage.
              </div>
            )}
            {overchannelDamage === 0 && useOverchannel && (
              <div className="spell-detail-overchannel-info">
                <i className="fa-solid fa-shield-halved"></i> First use: no necrotic damage
              </div>
            )}
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
