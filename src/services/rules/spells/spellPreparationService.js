import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import * as storageService from '../../../services/ui/storage.js';
import { isPsionicSpell, hasPsionicSorcery } from './metamagicRules.js';
import { addEntry } from '../../ui/logService.js';

function isFreeCastAuthorized(playerName, spellName, spellLevel, playerStats, campaignName) {
  const naturalRecoveryFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (naturalRecoveryFreeCast && Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.includes(spellName)) return true;

  const bewitchingFreeCast = getRuntimeValue(playerName, '_Bewitching_Magic_freeCast');
  if (bewitchingFreeCast && spellName === 'Misty Step') return true;

  // CLA-234: Path of the Wild Heart ritual-only grants (Nature Speaker → Commune with
  // Nature; Animal Speaker → Beast Sense / Speak with Animals). Spell entries are stamped
  // _ritualOnly by spellCalc2024; the feature text carries no once-per-day limit, so the
  // ritual cast is always authorized and never consumes a spell slot.
  const spellEntry = playerStats?.spellAbilities?.spells?.find(s => s.name === spellName);
  if (spellEntry?._ritualOnly) return true;
  // CLA-356: Telekinetic Master (Psi Warrior lv18) — "Always have Telekinesis prepared.
  // Cast without spell slot." Unlimited slotless free cast (no uses limit in the feature
  // text), so it is always authorized and never consumes a spell slot (CLA-234 pattern).
  if (spellEntry?._telekineticMasterFreeCast) return true;

  const masteryLevel1 = getRuntimeValue(playerName, 'SpellMastery_level1', campaignName);
  const masteryLevel2 = getRuntimeValue(playerName, 'SpellMastery_level2', campaignName);
  if (spellName === masteryLevel1 && spellLevel === 1) return true;
  if (spellName === masteryLevel2 && spellLevel === 2) return true;

  const sigSpells = getRuntimeValue(playerName, 'SignatureSpells_selection', campaignName);
  if (Array.isArray(sigSpells) && sigSpells.includes(spellName) && spellLevel === 3) {
    const usedKey = `SignatureSpells_${spellName.replace(/\s+/g, '_')}_used`;
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (!used) return true;
  }

  const divSpells = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
  if (Array.isArray(divSpells) && divSpells.includes(spellName)) {
    const usedKey = `_Divination_Savant_${spellName.replace(/\s+/g, '_')}_used`;
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (!used) return true;
  }

  const arcanums = playerStats?.class?.arcanums || [];
  if (arcanums.includes(spellName)) {
    // CLA-231: the counter is keyed by the cast spell's own level — a lv7 arcanum
    // consumes mysticArcanumLevel7, never a lower-level arcanum's counter.
    if (spellLevel < 6 || spellLevel > 9) return false;
    const count = Number(getRuntimeValue(playerName, `mysticArcanumLevel${spellLevel}`) ?? 1);
    return count > 0;
  }

  // CLA-252: Phantasmal Creatures — one free cast PER SPELL per Long Rest. Keyed per spell;
  // null counter means fresh (usesMax available); Long Rest resets the keys to null to re-arm.
  const phantasmalPassive = playerStats?.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  if (phantasmalPassive && (phantasmalPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Phantasmal_Creatures_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = phantasmalPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    const count = stored != null ? Number(stored) : usesMax;
    if (count > 0) return true;
  }

  // CLA-308: Shadow Arts (2024 Warrior of Shadow lv3) — slotless free casts of the
  // major's spell list (Darkness, Darkvision, Pass Without Trace, Silence), one free
  // cast PER SPELL per Long Rest. Counters keyed per spell; null = fresh/re-armed.
  // No spell slot is ever consulted for these — they are always cast "without
  // expending spell slots" and Wisdom (stamped by spellCalc2024) is the ability.
  const shadowArtsPassive = playerStats?.automation?.passives?.find(p => p.type === 'shadow_arts');
  if (shadowArtsPassive && (shadowArtsPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = shadowArtsPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    const count = stored != null ? Number(stored) : usesMax;
    if (count > 0) return true;
  }

  const actions = playerStats?.automation?.actions || [];
  for (const entry of actions) {
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

    // FT-070: per-spell-tracking free_spell entries (e.g. Shadow Touched's Shadow Magic:
    // chosen spell + Invisibility) keep one free cast PER SPELL per Long Rest, keyed
    // per spell (CLA-308 _Shadow_Arts_<Spell>_freeCastCount naming). Null = fresh.
    // Checked BEFORE the generic uses/recharge branch so a multi-spell entry can never
    // share one feature-keyed counter between its spells.
    if (entry.perSpellTracking) {
      if (!spells.includes(spellName)) continue;
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const count = stored != null ? Number(stored) : (entry.usesMax ?? entry.uses ?? 1);
      return count > 0;
    }

    if (spells.includes(spellName) && entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count > 0) return true;
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

    // FT-070: per-spell free-cast counters (see actions scan above).
    if (entry.perSpellTracking) {
      if (!spells.includes(spellName)) continue;
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const count = stored != null ? Number(stored) : (entry.usesMax ?? entry.uses ?? 1);
      return count > 0;
    }

    if (spells.includes(spellName) && entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count > 0) return true;
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

    // FT-070: per-spell free-cast counters (see actions scan above).
    if (entry.perSpellTracking) {
      if (!spells.includes(spellName)) continue;
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const count = stored != null ? Number(stored) : (entry.usesMax ?? entry.uses ?? 1);
      return count > 0;
    }

    if (spells.includes(spellName) && entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count > 0) return true;
    }

    const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
    const stored = getRuntimeValue(playerName, sharedKey);
    if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  }

  const miSpecialActions = playerStats?.automation?.specialActions || [];
  for (const entry of miSpecialActions) {
    if (entry.type !== 'free_spell' && entry.type !== 'fey_reinforcements' && entry.type !== 'misty_wanderer' && entry.type !== 'dragon_companion') continue;
    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (spells.includes(spellName) && entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count > 0) return true;
    }
  }

  const isAuraOfVitality = (spellName || '').toLowerCase() === 'aura of vitality';
  if (isAuraOfVitality) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (Array.isArray(targetEffects) && targetEffects.some(te => te.effect === 'aura_of_vitality' && te.target === playerName)) {
      return true;
    }
  }

  // Eyebite concentration recast — free cast when already concentrating on Eyebite
  if (spellName === 'Eyebite') {
    const cs = getCombatSummary(campaignName);
    if (cs) {
      const creature = cs.creatures.find(c => c.name === playerName);
      if (creature && creature.concentration && creature.concentration.spell === 'Eyebite') {
        return true;
      }
    }
  }

  // Spiritual Weapon concentration recast — free cast when already concentrating on Spiritual Weapon
  if (spellName === 'Spiritual Weapon') {
    const cs = getCombatSummary(campaignName);
    if (cs) {
      const creature = cs.creatures.find(c => c.name === playerName);
      if (creature && creature.concentration && creature.concentration.spell === 'Spiritual Weapon') {
        return true;
      }
    }
  }

  // Shapechange concentration recast — free cast when already concentrating on Shapechange
  if (spellName === 'Shapechange') {
    const cs = getCombatSummary(campaignName);
    if (cs) {
      const creature = cs.creatures.find(c => c.name === playerName);
      if (creature && creature.concentration && creature.concentration.spell === 'Shapechange') {
        return true;
      }
    }
  }

  return false;
}

function decrementFreeCastResource(playerName, spellName, spellLevel, playerStats, campaignName) {
  // CLA-356: Telekinetic Master's Telekinesis is an UNLIMITED slotless free cast
  // ("Cast without spell slot") — nothing to consume. Skip all counter decrements so the
  // row never drains; concentration (not a use counter) is the gate for the bonus attack.
  const telekineticMasterEntry = playerStats?.spellAbilities?.spells?.find(s => s.name === spellName);
  if (telekineticMasterEntry?._telekineticMasterFreeCast) return;

  // CLA-252: phantasmal_creatures lives in passives[] — consume the per-spell free-cast counter.
  const phantasmalPassive = playerStats?.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  if (phantasmalPassive && (phantasmalPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Phantasmal_Creatures_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = phantasmalPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    const count = stored != null ? Number(stored) : usesMax;
    if (count > 0) {
      setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
      addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: phantasmalPassive.name || 'Phantasmal Creatures',
        spellName: spellName,
        note: `Phantasmal Creatures free cast of ${spellName} — spectral, half HP, no spell slot consumed. ${count - 1} free cast${count - 1 === 1 ? '' : 's'} of ${spellName} remaining until your next Long Rest.`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
    }
  }

  // CLA-308: Shadow Arts — consume the per-spell free-cast counter (one per spell
  // per Long Rest) and log the slotless cast with its source and resource note.
  const shadowArtsPassive = playerStats?.automation?.passives?.find(p => p.type === 'shadow_arts');
  if (shadowArtsPassive && (shadowArtsPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = shadowArtsPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    const count = stored != null ? Number(stored) : usesMax;
    if (count > 0) {
      setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
      addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: shadowArtsPassive.name || 'Shadow Arts',
        spellName: spellName,
        note: `Shadow Arts free cast of ${spellName} — no spell slot consumed. ${spellName} is spent until your next Long Rest.`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
    }
  }

  const arcanums = playerStats?.class?.arcanums || [];
  if (arcanums.includes(spellName)) {
    // CLA-231: decrement the counter keyed by the cast spell's own level.
    if (spellLevel >= 6 && spellLevel <= 9) {
      const resourceKey = `mysticArcanumLevel${spellLevel}`;
      const count = Number(getRuntimeValue(playerName, resourceKey) ?? 1);
      if (count > 0) {
        setRuntimeValue(playerName, resourceKey, count - 1, campaignName);
      }
    }
  }

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
      if (featureLevel !== null && featureLevel === spellLevel) {
        const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
        const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
        if (count > 0) {
          setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
        }
        break;
      }
      else if (featureLevel === null) {
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (spells.includes(spellName)) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
          if (count > 0) {
            setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
          }
          break;
        }
      }
      if (featureLevel !== null) continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    // FT-070: per-spell free-cast counters (see isFreeCastAuthorized scan). Consume the
    // cast spell's own counter and log the slotless cast with its feature name.
    if (entry.perSpellTracking) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const count = stored != null ? Number(stored) : (entry.usesMax ?? entry.uses ?? 1);
      if (count > 0) {
        setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
        addEntry(campaignName, {
          type: 'ability_use',
          characterName: playerName,
          abilityName: entry.name,
          spellName: spellName,
          note: `${entry.name} free cast of ${spellName} — no spell slot consumed. ${spellName} is spent this way until your next Long Rest.`,
          timestamp: Date.now(),
        }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
      }
      break;
    }

    if (entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count > 0) {
        setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
      }
      break;
    }
  }

  const favoredEnemyCount = getRuntimeValue(playerName, '_Favored_Enemy_freeCastCount');
  if (favoredEnemyCount != null) {
    const newCount = Number(favoredEnemyCount);
    if (newCount >= 0) {
      setRuntimeValue(playerName, 'favoredEnemyUses', newCount, campaignName);
    }
  }
  const nrFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (nrFreeCast && Array.isArray(nrFreeCast) && nrFreeCast.includes(spellName)) {
    setRuntimeValue(playerName, 'naturalRecoveryFreeCast', null, campaignName);
    setRuntimeValue(playerName, 'naturalRecoveryFreeCastUsed', true, campaignName);
  }
  if (getRuntimeValue(playerName, '_Bewitching_Magic_freeCast') && spellName === 'Misty Step') {
    setRuntimeValue(playerName, '_Bewitching_Magic_freeCast', null, campaignName);
  }

  const sigSpells = getRuntimeValue(playerName, 'SignatureSpells_selection', campaignName);
  if (Array.isArray(sigSpells) && sigSpells.includes(spellName) && spellLevel === 3) {
    const usedKey = `SignatureSpells_${spellName.replace(/\s+/g, '_')}_used`;
    setRuntimeValue(playerName, usedKey, true, campaignName);
  }

  const divSpells = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
  if (Array.isArray(divSpells) && divSpells.includes(spellName)) {
    const divUsedKey = `_Divination_Savant_${spellName.replace(/\s+/g, '_')}_used`;
    setRuntimeValue(playerName, divUsedKey, true, campaignName);
  }
}

function incrementFreeCastResource(playerName, spellName, spellLevel, playerStats, campaignName) {
  // CLA-252: rollback half of the per-spell Phantasmal Creatures free-cast counter.
  const phantasmalPassive = playerStats?.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  if (phantasmalPassive && (phantasmalPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Phantasmal_Creatures_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = phantasmalPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    if (stored != null && Number(stored) < usesMax) {
      setRuntimeValue(playerName, freeCastCountKey, Number(stored) + 1, campaignName);
    }
  }

  // CLA-308: Shadow Arts — roll back the per-spell free-cast counter (one per spell
  // per Long Rest) when a cast is cancelled/skipped.
  const shadowArtsPassive = playerStats?.automation?.passives?.find(p => p.type === 'shadow_arts');
  if (shadowArtsPassive && (shadowArtsPassive.freeCastSpells || []).includes(spellName)) {
    const freeCastCountKey = `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
    const usesMax = shadowArtsPassive.usesMax ?? 1;
    const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
    if (stored != null && Number(stored) < usesMax) {
      setRuntimeValue(playerName, freeCastCountKey, Number(stored) + 1, campaignName);
    }
  }

  const arcanums = playerStats?.class?.arcanums || [];
  if (arcanums.includes(spellName)) {
    // CLA-231: increment the counter keyed by the spell's own level.
    if (spellLevel >= 6 && spellLevel <= 9) {
      const resourceKey = `mysticArcanumLevel${spellLevel}`;
      const count = Number(getRuntimeValue(playerName, resourceKey) ?? 1);
      if (count < 1) {
        setRuntimeValue(playerName, resourceKey, count + 1, campaignName);
      }
    }
  }

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
      if (featureLevel !== null && featureLevel === spellLevel) {
        const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
        const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
        if (count < entry.usesMax) {
          setRuntimeValue(playerName, freeCastCountKey, count + 1, campaignName);
        }
        break;
      }
      else if (featureLevel === null) {
        const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
        if (spells.includes(spellName)) {
          const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
          const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.usesMax);
          if (count < entry.usesMax) {
            setRuntimeValue(playerName, freeCastCountKey, count + 1, campaignName);
          }
          break;
        }
      }
      if (featureLevel !== null) continue;
    }

    const spells = Array.isArray(entry.spell) ? entry.spell : [entry.spell];
    if (!spells.includes(spellName)) continue;

    // FT-070: roll back the cast spell's own per-spell free-cast counter.
    if (entry.perSpellTracking) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const usesMax = entry.usesMax ?? entry.uses ?? 1;
      if (stored != null && Number(stored) < usesMax) {
        setRuntimeValue(playerName, freeCastCountKey, Number(stored) + 1, campaignName);
      }
      break;
    }

    if (entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
      const count = Number(getRuntimeValue(playerName, freeCastCountKey) ?? entry.uses);
      if (count < entry.uses) {
        setRuntimeValue(playerName, freeCastCountKey, count + 1, campaignName);
      }
      break;
    }
  }

  const favoredEnemyCount = getRuntimeValue(playerName, '_Favored_Enemy_freeCastCount');
  if (favoredEnemyCount != null) {
    const newCount = Number(favoredEnemyCount);
    if (newCount >= 0) {
      setRuntimeValue(playerName, 'favoredEnemyUses', newCount + 1, campaignName);
    }
  }
  const nrFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (nrFreeCast && Array.isArray(nrFreeCast) && nrFreeCast.includes(spellName)) {
    setRuntimeValue(playerName, 'naturalRecoveryFreeCast', null, campaignName);
    setRuntimeValue(playerName, 'naturalRecoveryFreeCastUsed', false, campaignName);
  }
  if (getRuntimeValue(playerName, '_Bewitching_Magic_freeCast') && spellName === 'Misty Step') {
    setRuntimeValue(playerName, '_Bewitching_Magic_freeCast', null, campaignName);
  }

  const sigSpells = getRuntimeValue(playerName, 'SignatureSpells_selection', campaignName);
  if (Array.isArray(sigSpells) && sigSpells.includes(spellName) && spellLevel === 3) {
    const usedKey = `SignatureSpells_${spellName.replace(/\s+/g, '_')}_used`;
    setRuntimeValue(playerName, usedKey, false, campaignName);
  }

  const divSpells = getRuntimeValue(playerName, '_Divination_Savant_selection', campaignName);
  if (Array.isArray(divSpells) && divSpells.includes(spellName)) {
    const divUsedKey = `_Divination_Savant_${spellName.replace(/\s+/g, '_')}_used`;
    setRuntimeValue(playerName, divUsedKey, false, campaignName);
  }
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

function getWarlockSlotLevel(playerName, playerStats, minLevel) {
  const isWarlock = playerStats.class?.name === 'Warlock';
  if (!isWarlock) return null;
  for (let lv = minLevel; lv <= 9; lv++) {
    const key = `spell_slots_level_${lv}`;
    const max = (playerStats.spellAbilities && playerStats.spellAbilities[key]) || 0;
    const current = getRuntimeValue(playerName, key);
    const available = current != null ? current : max;
    if (available > 0) return lv;
  }
  return null;
}

export async function prepareSpellCast(spell, metaCtx, { playerName, playerStats, campaignName, isUpcast, upcastLevel, usePsionicPayment, usePsychicDamage, freeCastAuthorized }) {
  const result = {
    modifiedSpell: { ...spell },
    metaCtx: { ...metaCtx },
    slotConsumed: false,
    freeCastUsed: false,
  };

  const isCantrip = spell.level === 0;
  const isWarlock = playerStats.class?.name === 'Warlock';
  const isPsionic = isPsionicSpell(playerStats, spell.name);
  const hasPsionic = hasPsionicSorcery(playerStats);

  if (isCantrip) {
    const modifiedSpell = { ...spell, baseLevel: 0 };
    result.modifiedSpell = modifiedSpell;
    return result;
  }

  const effectiveSpellLevel = isUpcast && upcastLevel ? upcastLevel : spell.level;

  // Concentration management
  const isWgbActive = getRuntimeValue(playerName, '_War_Gods_Blessing_active');
  const isWgbSpell = isWgbActive && ['Shield of Faith', 'Spiritual Weapon'].includes(spell.name);

  let shouldSetConcentration = false;
  let oldConcentrationSpell = null;
  let isEyebiteRecast = false;

  if (!isWgbSpell && spell.concentration && spell.name !== 'Summon Aberration') {
    const cs = getCombatSummary(campaignName);
    if (cs) {
      const creature = cs.creatures.find(c => c.name === playerStats.name);
      if (creature && creature.concentration && creature.concentration.spell !== spell.name) {
        oldConcentrationSpell = creature.concentration.spell;
        breakConcentration(cs, playerName);
        storageService.default.set('combatSummary', cs, campaignName);
        shouldSetConcentration = true;
      } else if (!creature?.concentration) {
        shouldSetConcentration = true;
      } else if (spell.name === 'Eyebite' && creature.concentration.spell === spell.name) {
        isEyebiteRecast = true;
      }
    }
  }

  result.metaCtx.oldConcentrationSpell = oldConcentrationSpell;
  result.metaCtx.shouldSetConcentration = shouldSetConcentration;

  // Psionic Sorcery payment
  const isFreeCast = freeCastAuthorized;
  if (isPsionic && hasPsionic && !isFreeCast && usePsionicPayment) {
    const currentSP = Number(getRuntimeValue(playerName, 'sorceryPoints') ?? 0);
    if (currentSP >= effectiveSpellLevel) {
      setRuntimeValue(playerName, 'sorceryPoints', currentSP - effectiveSpellLevel, campaignName);
      result.metaCtx.psionicSorcery = 'sorceryPoints';
      result.metaCtx.psionicCost = effectiveSpellLevel;
      result.metaCtx._psionicUsed = true;
      addEntry(campaignName, {
        type: 'psionic_sorcery',
        characterName: playerName,
        spellName: spell.name,
        spellLevel: effectiveSpellLevel,
        sorceryPointsSpent: effectiveSpellLevel,
        componentsWaived: ['V', 'S'],
        note: 'Cast without Verbal or Somatic components. No Material components unless consumed or have cost.',
        timestamp: Date.now(),
      });
    }
  }

  // FT-068: Ritual Master Quick Ritual — a prepared ritual spell granted by the feat is
  // cast using its regular casting time (the spell never had its casting time changed)
  // WITHOUT expending a spell slot, once per Long Rest. Opt-in via spell.quickRitual
  // (popup checkbox); consumed here, refused (falls through to normal slot payment) when
  // spent, re-armed by restRules-longRest.
  const quickRitualHold = (playerStats.automation?.ritualSpells || []).some(f => f.chosenSpells && f.quickRitual);
  const quickRitualUsed = getRuntimeValue(playerName, '_Ritual_Master_quickRitualUsed', campaignName);
  const isQuickRitualCast = spell.quickRitual === true && spell._ritualMasterRitual === true && quickRitualHold && quickRitualUsed == null && !isUpcast;

  // Resource consumption
  if (isWgbSpell && spell.name === 'Spiritual Weapon') {
    cleanupBuffsByName(playerName, 'Shield of Faith', campaignName);
  } else if (isEyebiteRecast) {
    // Recasting Eyebite while already concentrating on it — no slot consumed, no buff updated
  } else if (isUpcast && !isFreeCast && !result.metaCtx._psionicUsed && effectiveSpellLevel !== spell.level) {
    const slotKey = `spell_slots_level_${effectiveSpellLevel}`;
    const currentSlots = getRuntimeValue(playerName, slotKey);
    const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
    const availableSlots = currentSlots != null ? currentSlots : maxSlots;
    if (availableSlots > 0) {
      setRuntimeValue(playerName, slotKey, availableSlots - 1, campaignName);
      result.slotConsumed = true;
    }
  } else if (isQuickRitualCast) {
    setRuntimeValue(playerName, '_Ritual_Master_quickRitualUsed', Date.now(), campaignName);
    result.freeCastUsed = true;
    result.metaCtx.quickRitualUsed = true;
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerName,
      abilityName: 'Ritual Master (Quick Ritual)',
      spellName: spell.name,
      note: `Quick Ritual: cast ${spell.name} using its regular casting time — no spell slot consumed. You can't use Quick Ritual again until you finish a Long Rest.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
  } else if (isFreeCast) {
    decrementFreeCastResource(playerName, spell.name, spell.level, playerStats, campaignName);
    result.freeCastUsed = true;
    result.metaCtx.freeCastUsed = true;
    // CLA-234: record ritual casts (Nature Speaker / Animal Speaker) explicitly —
    // cast as a Ritual, no spell slot consumed.
    if (spell._ritualOnly) {
      addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: spell._ritualFeature || 'Ritual Casting',
        spellName: spell.name,
        note: `Cast ${spell.name} as a Ritual — no spell slot consumed.`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
    }
  } else if (!result.metaCtx._psionicUsed) {
    const baseSlotKey = `spell_slots_level_${spell.level}`;
    let availableSlots = getRuntimeValue(playerName, baseSlotKey);
    const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[baseSlotKey]) || 0;
    availableSlots = availableSlots != null ? availableSlots : maxSlots;

    if (isWarlock && availableSlots <= 0) {
      const warlockSlotLevel = getWarlockSlotLevel(playerName, playerStats, spell.level);
      if (warlockSlotLevel !== null) {
        const slotKey = `spell_slots_level_${warlockSlotLevel}`;
        const currentSlots = getRuntimeValue(playerName, slotKey);
        const slotMax = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
        availableSlots = currentSlots != null ? currentSlots : slotMax;
        if (availableSlots > 0) {
          setRuntimeValue(playerName, slotKey, availableSlots - 1, campaignName);
          result.slotConsumed = true;
        }
      }
    } else if (availableSlots > 0) {
      setRuntimeValue(playerName, baseSlotKey, availableSlots - 1, campaignName);
      result.slotConsumed = true;
    }
  }

  // Cleanup old concentration effects
  if (oldConcentrationSpell) {
    cleanupConcentrationEffects(playerName, oldConcentrationSpell, campaignName);
  }

  // Set new concentration
  if (shouldSetConcentration) {
    const cs = getCombatSummary(campaignName);
    if (cs) {
      const targetName = (spell.name === "Hunter's Mark" || spell.name === 'Hex')
        ? (cs.creatures.find(c => c.name === playerStats.name)?.targetName || null)
        : null;
      addConcentration(cs, playerName, spell.name, playerStats.spellAbilities?.saveDc ?? 10, targetName);
      storageService.default.set('combatSummary', cs, campaignName);
    }
  }

  // Hunter's Mark / Hex buff tracking
  if (shouldSetConcentration && spell.name === "Hunter's Mark") {
    const existingBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const newBuffs = Array.isArray(existingBuffs) ? [...existingBuffs, { name: "Hunter's Mark", effect: 'hunters_mark_concentration', duration: 'concentration' }] : [{ name: "Hunter's Mark", effect: 'hunters_mark_concentration', duration: 'concentration' }];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
  }

  if (shouldSetConcentration && spell.name === 'Hex') {
    const existingBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const newBuffs = Array.isArray(existingBuffs) ? [...existingBuffs, { name: 'Hex', effect: 'hex_concentration', duration: 'concentration' }] : [{ name: 'Hex', effect: 'hex_concentration', duration: 'concentration' }];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
  }

  if (shouldSetConcentration && spell.name === 'Eyebite') {
    const existingBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    setRuntimeValue(playerName, 'activeBuffs', [...existingBuffs, { name: 'Eyebite', effect: 'eyebite_concentration', duration: 'concentration' }], campaignName);
  }

  // Build modified spell
  let modifiedSpell = effectiveSpellLevel !== spell.level
    ? { ...spell, level: effectiveSpellLevel, baseLevel: spell.level }
    : { ...spell };

  const hasPsychicSpells = playerStats.automation?.passives?.some(p => p.type === 'psychic_spells');
  const hasSpellBreaker = playerStats.automation?.passives?.some(p => p.type === 'spell_breaker');
  const hasDamage = !!spell.damage;
  const canChangeDamageType = playerStats.class?.name === 'Warlock' && hasPsychicSpells && hasDamage;
  const isDispelMagicAsBonusAction = hasSpellBreaker && spell.name === 'Dispel Magic';

  if (canChangeDamageType && usePsychicDamage) {
    modifiedSpell._psychicSpellsOverride = true;
  }
  if (isDispelMagicAsBonusAction && modifiedSpell.casting_time === '1 action') {
    modifiedSpell.casting_time = '1 bonus action';
  }

  // CLA-252: free (spectral) casts change the school to Illusion and record the summoned
  // creature so the summon path halves its HP. Pass campaignName so the list read/write
  // targets the live campaign store (missing it silently no-oped later appends).
  const phantasmalPassiveForStamp = playerStats.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  if (phantasmalPassiveForStamp && freeCastAuthorized && (phantasmalPassiveForStamp.freeCastSpells || []).includes(spell.name)) {
    modifiedSpell.school = 'Illusion';
    modifiedSpell._phantasmalCreatures = true;
    modifiedSpell._phantasmalHalvesHp = !!phantasmalPassiveForStamp.halvesHp;
    const summonCreatureName = spell.name === 'Summon Beast' ? 'Bestial Spirit' : 'Fey Spirit';
    const existingCreatures = getRuntimeValue(playerName, '_phantasmalCreatures_list', campaignName);
    // Copy before mutating: setRuntimeValue short-circuits identical references, so mutating
    // the store array in place would never POST the append.
    const creatureList = Array.isArray(existingCreatures) ? [...existingCreatures] : [];
    if (!creatureList.includes(summonCreatureName)) {
      creatureList.push(summonCreatureName);
      setRuntimeValue(playerName, '_phantasmalCreatures_list', creatureList, campaignName);
    }
  }

  result.modifiedSpell = modifiedSpell;
  return result;
}

export { isFreeCastAuthorized, incrementFreeCastResource };
