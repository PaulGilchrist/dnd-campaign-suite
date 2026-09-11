import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import * as storageService from '../../../services/ui/storage.js';
import { isPsionicSpell, hasPsionicSorcery } from './metamagicRules.js';
import { addEntry } from '../../ui/logService.js';

const FREE_CAST_ENTRY_TYPES = ['free_spell', 'fey_reinforcements', 'misty_wanderer', 'dragon_companion'];

function isFreeCastEntryType(entry) {
  return FREE_CAST_ENTRY_TYPES.includes(entry.type);
}

function entrySpells(entry) {
  return Array.isArray(entry.spell) ? entry.spell : [entry.spell];
}

function featureFreeCastKey(entry) {
  return `_${entry.name.replace(/\s+/g, '_')}_freeCastCount`;
}

function parseFeatureSpellLevel(entry) {
  const spellField = Array.isArray(entry.spell) ? entry.spell[0] : entry.spell;
  const levelMatch = spellField ? spellField.match(/level (\d+)/) : null;
  return levelMatch ? parseInt(levelMatch[1], 10) : null;
}

function featureFreeCastCount(playerName, key, fallback) {
  return Number(getRuntimeValue(playerName, key) ?? fallback);
}

// FT-070: per-spell-tracking free_spell entries (e.g. Shadow Touched's Shadow Magic:
// chosen spell + Invisibility) keep one free cast PER SPELL per Long Rest, keyed
// per spell (CLA-308 _Shadow_Arts_<Spell>_freeCastCount naming). Null = fresh.
function perSpellTrackingDecision(entry, playerName, spellName, campaignName) {
  if (!entrySpells(entry).includes(spellName)) return undefined;
  const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
  const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
  const count = stored != null ? Number(stored) : (entry.usesMax ?? entry.uses ?? 1);
  return count > 0;
}

// One free_spell/fey_reinforcements/misty_wanderer/dragon_companion automation entry.
// Returns true (authorized), false (explicitly not authorized — the caller must stop
// scanning and deny), or undefined (entry not applicable — continue scanning).
function checkFreeCastEntry(entry, playerName, spellName, spellLevel, campaignName) {
  if (!isFreeCastEntryType(entry)) return undefined;

  if (entry.uses_expression && entry.usesMax) {
    const featureLevel = parseFeatureSpellLevel(entry);
    if (featureLevel !== null) {
      if (featureLevel === spellLevel && featureFreeCastCount(playerName, featureFreeCastKey(entry), entry.usesMax) > 0) return true;
      return undefined;
    }
    if (entrySpells(entry).includes(spellName) && featureFreeCastCount(playerName, featureFreeCastKey(entry), entry.usesMax) > 0) return true;
  }

  // Checked BEFORE the generic uses/recharge branch so a multi-spell entry can never
  // share one feature-keyed counter between its spells. A non-matching spell on such
  // an entry continues scanning; a matching one decides the cast (spent or not).
  if (entry.perSpellTracking) {
    return perSpellTrackingDecision(entry, playerName, spellName, campaignName);
  }

  if (entrySpells(entry).includes(spellName) && entry.uses != null && entry.recharge && !entry.uses_expression) {
    if (featureFreeCastCount(playerName, featureFreeCastKey(entry), entry.uses) > 0) return true;
  }

  const sharedKey = `_${entry.name.replace(/\s+/g, '_')}_freeCast`;
  const stored = getRuntimeValue(playerName, sharedKey);
  if (stored && Array.isArray(stored) && stored.includes(spellName)) return true;
  return undefined;
}

// Scans an automation action list (actions/bonusActions/specialActions share the exact
// same free-cast authorization semantics). Returns true/false when an entry made a
// final decision, undefined when the scan is inconclusive and the caller continues.
function scanFreeCastEntries(entries, playerName, spellName, spellLevel, campaignName) {
  for (const entry of entries) {
    const decision = checkFreeCastEntry(entry, playerName, spellName, spellLevel, campaignName);
    if (decision !== undefined) return decision;
  }
  return undefined;
}

// Per-spell free-cast counters keyed by a feature prefix (CLA-252 Phantasmal Creatures,
// CLA-308 Shadow Arts) — one free cast PER SPELL per Long Rest. Null counter means fresh
// (usesMax available); Long Rest resets the keys to null to re-arm.
function perSpellFreeCastAvailable(passive, playerName, spellName, keyPrefix, campaignName) {
  if (!passive || !(passive.freeCastSpells || []).includes(spellName)) return false;
  const freeCastCountKey = `_${keyPrefix}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
  const usesMax = passive.usesMax ?? 1;
  const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
  const count = stored != null ? Number(stored) : usesMax;
  return count > 0;
}

// Concentration recast — free cast when already concentrating on the same spell.
function isConcentrationRecastFreeCast(playerName, spellName, campaignName) {
  const cs = getCombatSummary(campaignName);
  if (!cs) return false;
  const creature = cs.creatures.find(c => c.name === playerName);
  return Boolean(creature && creature.concentration && creature.concentration.spell === spellName);
}

// Runtime-keyed free-cast grants: Natural Recovery recovery list and Bewitching Magic
// (free Misty Step while the feature flag is up).
function runtimeSelectionFreeCast(playerName, spellName) {
  const naturalRecoveryFreeCast = getRuntimeValue(playerName, 'naturalRecoveryFreeCast');
  if (naturalRecoveryFreeCast && Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.includes(spellName)) return true;

  const bewitchingFreeCast = getRuntimeValue(playerName, '_Bewitching_Magic_freeCast');
  if (bewitchingFreeCast && spellName === 'Misty Step') return true;
  return false;
}

// Spell Mastery (lv1/lv2 mastery selections) and the once-per-day choice Savants
// (Signature Spells lv3, Divination Savant).
function masteryOrSavantFreeCast(playerName, spellName, spellLevel, campaignName) {
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
  return false;
}

// CLA-231: the counter is keyed by the cast spell's own level — a lv7 arcanum
// consumes mysticArcanumLevel7, never a lower-level arcanum's counter.
function arcanumFreeCast(playerName, spellName, spellLevel, playerStats) {
  const arcanums = playerStats?.class?.arcanums || [];
  if (!arcanums.includes(spellName)) return undefined;
  if (spellLevel < 6 || spellLevel > 9) return false;
  const count = Number(getRuntimeValue(playerName, `mysticArcanumLevel${spellLevel}`) ?? 1);
  return count > 0;
}

// Active-buff free casts that interleave the automation action scans:
// War God's Blessing (before bonusActions) and Mantle of Majesty (before specialActions).
function activeBuffFreeCast(playerName, spellName, buffKey, buffMatcher) {
  const active = getRuntimeValue(playerName, buffKey);
  if (buffMatcher(active)) return true;
  return false;
}

// Aura of Vitality is free while the caster carries the aura targetEffect.
function auraOfVitalityFreeCast(playerName, spellName, campaignName) {
  if ((spellName || '').toLowerCase() !== 'aura of vitality') return false;
  const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
  return Array.isArray(targetEffects) && targetEffects.some(te => te.effect === 'aura_of_vitality' && te.target === playerName);
}

// Concentration recasts — free cast when already concentrating on the same spell
// (Eyebite, Spiritual Weapon, Shapechange).
const CONCENTRATION_RECAST_FREE_SPELLS = ['Eyebite', 'Spiritual Weapon', 'Shapechange'];

function concentrationRecastFreeCast(playerName, spellName, campaignName) {
  for (const recastSpell of CONCENTRATION_RECAST_FREE_SPELLS) {
    if (spellName === recastSpell && isConcentrationRecastFreeCast(playerName, spellName, campaignName)) return true;
  }
  return false;
}

function findAutomationPassive(playerStats, type) {
  return playerStats?.automation?.passives?.find(p => p.type === type);
}

// Checks consulted in order by isFreeCastAuthorized. Each returns true (authorized),
// false (explicit deny — stop scanning), or undefined (not applicable — keep scanning).
// Break/continue points are rule-significant: the scan order is preserved exactly.
const FREE_CAST_CHECKS = [
  ({ playerName, spellName }) => runtimeSelectionFreeCast(playerName, spellName) || undefined,

  // CLA-234: Path of the Wild Heart ritual-only grants (Nature Speaker → Commune with
  // Nature; Animal Speaker → Beast Sense / Speak with Animals). Spell entries are stamped
  // _ritualOnly by spellCalc2024; the feature text carries no once-per-day limit, so the
  // ritual cast is always authorized and never consumes a spell slot.
  // CLA-356: Telekinetic Master (Psi Warrior lv18) — "Always have Telekinesis prepared.
  // Cast without spell slot." Unlimited slotless free cast (no uses limit in the feature
  // text), so it is always authorized and never consumes a spell slot (CLA-234 pattern).
  ({ spellName, playerStats }) => {
    const spellEntry = playerStats?.spellAbilities?.spells?.find(s => s.name === spellName);
    return spellEntry?._ritualOnly || spellEntry?._telekineticMasterFreeCast || undefined;
  },

  ({ playerName, spellName, spellLevel, campaignName }) => masteryOrSavantFreeCast(playerName, spellName, spellLevel, campaignName) || undefined,

  // CLA-231 arcanum — tri-state: a known arcanum decides the cast (free or spent).
  ({ playerName, spellName, spellLevel, playerStats }) => arcanumFreeCast(playerName, spellName, spellLevel, playerStats),

  // CLA-252: Phantasmal Creatures — one free cast PER SPELL per Long Rest.
  ({ playerName, spellName, playerStats, campaignName }) => perSpellFreeCastAvailable(
    findAutomationPassive(playerStats, 'phantasmal_creatures'), playerName, spellName, 'Phantasmal_Creatures', campaignName) || undefined,

  // CLA-308: Shadow Arts (2024 Warrior of Shadow lv3) — slotless free casts of the
  // major's spell list (Darkness, Darkvision, Pass Without Trace, Silence), one free
  // cast PER SPELL per Long Rest. No spell slot is ever consulted for these — they are
  // always cast "without expending spell slots" and Wisdom (stamped by spellCalc2024)
  // is the ability.
  ({ playerName, spellName, playerStats, campaignName }) => perSpellFreeCastAvailable(
    findAutomationPassive(playerStats, 'shadow_arts'), playerName, spellName, 'Shadow_Arts', campaignName) || undefined,

  ({ playerName, spellName, spellLevel, playerStats, campaignName }) => scanFreeCastEntries(playerStats?.automation?.actions || [], playerName, spellName, spellLevel, campaignName),

  ({ playerName, spellName }) => activeBuffFreeCast(playerName, spellName, '_War_Gods_Blessing_active',
    (active) => active && ['Shield of Faith', 'Spiritual Weapon'].includes(spellName)) || undefined,

  ({ playerName, spellName, spellLevel, playerStats, campaignName }) => scanFreeCastEntries(playerStats?.automation?.bonusActions || [], playerName, spellName, spellLevel, campaignName),

  ({ playerName, spellName }) => activeBuffFreeCast(playerName, spellName, 'activeBuffs',
    (active) => (Array.isArray(active) ? active : []).some(b => b.name === 'Mantle of Majesty') && spellName === 'Command') || undefined,

  ({ playerName, spellName, spellLevel, playerStats, campaignName }) => scanFreeCastEntries(playerStats?.automation?.specialActions || [], playerName, spellName, spellLevel, campaignName),

  ({ playerName, spellName, campaignName }) => auraOfVitalityFreeCast(playerName, spellName, campaignName) || undefined,

  ({ playerName, spellName, campaignName }) => concentrationRecastFreeCast(playerName, spellName, campaignName) || undefined,
];

function isFreeCastAuthorized(playerName, spellName, spellLevel, playerStats, campaignName) {
  const ctx = { playerName, spellName, spellLevel, playerStats, campaignName };
  for (const check of FREE_CAST_CHECKS) {
    const decision = check(ctx);
    if (decision !== undefined) return decision;
  }
  return false;
}

// Per-spell free-cast grants consumed on cast (CLA-252 phantasmal_creatures,
// CLA-308 Shadow Arts) — same counter shape (one free cast PER SPELL per Long Rest),
// different ability-name fallback and log note.
const PER_SPELL_CAST_GRANTS = {
  Phantasmal_Creatures: {
    fallbackAbilityName: 'Phantasmal Creatures',
    buildNote: (spellName, remaining) => `Phantasmal Creatures free cast of ${spellName} — spectral, half HP, no spell slot consumed. ${remaining} free cast${remaining === 1 ? '' : 's'} of ${spellName} remaining until your next Long Rest.`,
  },
  Shadow_Arts: {
    fallbackAbilityName: 'Shadow Arts',
    buildNote: (spellName) => `Shadow Arts free cast of ${spellName} — no spell slot consumed. ${spellName} is spent until your next Long Rest.`,
  },
};

function consumePerSpellFreeCastCounter(passive, playerName, spellName, keyPrefix, campaignName) {
  if (!passive || !(passive.freeCastSpells || []).includes(spellName)) return;
  const freeCastCountKey = `_${keyPrefix}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
  const usesMax = passive.usesMax ?? 1;
  const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
  const count = stored != null ? Number(stored) : usesMax;
  if (count <= 0) return;
  setRuntimeValue(playerName, freeCastCountKey, count - 1, campaignName);
  const grant = PER_SPELL_CAST_GRANTS[keyPrefix];
  addEntry(campaignName, {
    type: 'ability_use',
    characterName: playerName,
    abilityName: passive.name || grant.fallbackAbilityName,
    spellName: spellName,
    note: grant.buildNote(spellName, count - 1),
    timestamp: Date.now(),
  }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
}

function restorePerSpellFreeCastCounter(passive, playerName, spellName, keyPrefix, campaignName) {
  if (!passive || !(passive.freeCastSpells || []).includes(spellName)) return;
  const freeCastCountKey = `_${keyPrefix}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
  const usesMax = passive.usesMax ?? 1;
  const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
  if (stored != null && Number(stored) < usesMax) {
    setRuntimeValue(playerName, freeCastCountKey, Number(stored) + 1, campaignName);
  }
}

// Shared scan for consume/restore of the feature-keyed free-cast counter. `ops`
// decides the new counter value per branch: shared counters get (count, max),
// per-spell-tracking counters get (entry, stored, usesMax). null = leave unchanged.
const FREE_CAST_CONSUME_OPS = {
  shared: (count) => (count > 0 ? count - 1 : null),
  perSpell: (entry, stored, usesMax) => {
    const count = stored != null ? Number(stored) : usesMax;
    return count > 0 ? count - 1 : null;
  },
  // FT-070: log the slotless per-spell cast with its feature name (consume only).
  logPerSpell: (entry, playerName, spellName, campaignName) => {
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerName,
      abilityName: entry.name,
      spellName: spellName,
      note: `${entry.name} free cast of ${spellName} — no spell slot consumed. ${spellName} is spent this way until your next Long Rest.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
  },
};

const FREE_CAST_RESTORE_OPS = {
  shared: (count, max) => (count < max ? count + 1 : null),
  perSpell: (entry, stored, usesMax) => (stored != null && Number(stored) < usesMax ? Number(stored) + 1 : null),
  logPerSpell: null,
};

// Consumes the feature-keyed free-cast counter for the first matching automation entry
// (free_spell/fey_reinforcements/misty_wanderer/dragon_companion). Mirrors the scan
// order in isFreeCastAuthorized/checkFreeCastEntry — break points are rule-significant.
function adjustActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName, ops) {
  for (const entry of allActions) {
    if (!isFreeCastEntryType(entry)) continue;
    if (entry.uses_expression && entry.usesMax) {
      const featureLevel = parseFeatureSpellLevel(entry);
      const spellMatches = (featureLevel !== null && featureLevel === spellLevel) ||
        (featureLevel === null && entrySpells(entry).includes(spellName));
      if (spellMatches) {
        const freeCastCountKey = featureFreeCastKey(entry);
        const next = ops.shared(featureFreeCastCount(playerName, freeCastCountKey, entry.usesMax), entry.usesMax);
        if (next !== null) setRuntimeValue(playerName, freeCastCountKey, next, campaignName);
        break;
      }
      if (featureLevel !== null) continue;
    }

    if (!entrySpells(entry).includes(spellName)) continue;

    // FT-070: per-spell free-cast counters (see isFreeCastAuthorized scan). Consume the
    // cast spell's own counter and log the slotless cast with its feature name.
    if (entry.perSpellTracking) {
      const freeCastCountKey = `_${entry.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`;
      const usesMax = entry.usesMax ?? entry.uses ?? 1;
      const stored = getRuntimeValue(playerName, freeCastCountKey, campaignName);
      const next = ops.perSpell(entry, stored, usesMax);
      if (next !== null) {
        setRuntimeValue(playerName, freeCastCountKey, next, campaignName);
        if (ops.logPerSpell) ops.logPerSpell(entry, playerName, spellName, campaignName);
      }
      break;
    }

    if (entry.uses != null && entry.recharge && !entry.uses_expression) {
      const freeCastCountKey = featureFreeCastKey(entry);
      const next = ops.shared(featureFreeCastCount(playerName, freeCastCountKey, entry.uses), entry.uses);
      if (next !== null) setRuntimeValue(playerName, freeCastCountKey, next, campaignName);
      break;
    }
  }
}

function consumeActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName) {
  adjustActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName, FREE_CAST_CONSUME_OPS);
}

// CLA-388: Wild Companion (Druid lv2, 2024) — consume the PAID grant on cast so the
// shared `_Wild_Companion_freeCast` array is no longer unlimited (Bewitching Magic
// consume-shared-array precedent). Log the slotless cast as a summons row; the FEY
// familiar is log-recorded (no familiar combatant entity architecture exists app-wide).
function consumeWildCompanionGrant(allActions, playerName, spellName, campaignName) {
  const wildCompanionGrant = allActions.some(e =>
    e.type === 'free_spell' && e.resourceCost === 'wild_companion' &&
    (Array.isArray(e.spell) ? e.spell : [e.spell]).includes(spellName));
  if (!wildCompanionGrant) return;
  const wildCompanionFreeCast = getRuntimeValue(playerName, '_Wild_Companion_freeCast', campaignName);
  if (Array.isArray(wildCompanionFreeCast) && wildCompanionFreeCast.includes(spellName)) {
    setRuntimeValue(playerName, '_Wild_Companion_freeCast', null, campaignName);
    addEntry(campaignName, {
      type: 'summons',
      characterName: playerName,
      summonName: 'Familiar',
      description: `${playerName} casts ${spellName} via Wild Companion — no spell slot consumed, Material components waived. Familiar (FEY) appears; it disappears when you finish a Long Rest.`,
      summonedCreatures: ['Familiar'],
      timestamp: Date.now(),
    }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
  }
}

// Consume the named-feature free-cast flags after the counter scans (order preserved).
function consumeSpecialFreeCastFlags(allActions, playerName, spellName, spellLevel, campaignName) {
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

  consumeWildCompanionGrant(allActions, playerName, spellName, campaignName);

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

function decrementFreeCastResource(playerName, spellName, spellLevel, playerStats, campaignName) {
  // CLA-356: Telekinetic Master's Telekinesis is an UNLIMITED slotless free cast
  // ("Cast without spell slot") — nothing to consume. Skip all counter decrements so the
  // row never drains; concentration (not a use counter) is the gate for the bonus attack.
  const telekineticMasterEntry = playerStats?.spellAbilities?.spells?.find(s => s.name === spellName);
  if (telekineticMasterEntry?._telekineticMasterFreeCast) return;

  // CLA-252: phantasmal_creatures lives in passives[] — consume the per-spell free-cast counter.
  consumePerSpellFreeCastCounter(findAutomationPassive(playerStats, 'phantasmal_creatures'), playerName, spellName, 'Phantasmal_Creatures', campaignName);

  // CLA-308: Shadow Arts — consume the per-spell free-cast counter (one per spell
  // per Long Rest) and log the slotless cast with its source and resource note.
  consumePerSpellFreeCastCounter(findAutomationPassive(playerStats, 'shadow_arts'), playerName, spellName, 'Shadow_Arts', campaignName);

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
  consumeActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName);
  consumeSpecialFreeCastFlags(allActions, playerName, spellName, spellLevel, campaignName);
}

// Roll back the feature-keyed free-cast counter for the first matching automation entry
// (cancelled/skipped cast). Mirrors consumeActionFreeCastCounters scan order exactly.
function restoreActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName) {
  adjustActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName, FREE_CAST_RESTORE_OPS);
}

// Roll back the named-feature free-cast flags after the counter scans (order preserved).
function restoreSpecialFreeCastFlags(playerName, spellName, spellLevel, campaignName) {
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

function incrementFreeCastResource(playerName, spellName, spellLevel, playerStats, campaignName) {
  // CLA-252: rollback half of the per-spell Phantasmal Creatures free-cast counter.
  restorePerSpellFreeCastCounter(findAutomationPassive(playerStats, 'phantasmal_creatures'), playerName, spellName, 'Phantasmal_Creatures', campaignName);

  // CLA-308: Shadow Arts — roll back the per-spell free-cast counter (one per spell
  // per Long Rest) when a cast is cancelled/skipped.
  restorePerSpellFreeCastCounter(findAutomationPassive(playerStats, 'shadow_arts'), playerName, spellName, 'Shadow_Arts', campaignName);

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
  restoreActionFreeCastCounters(allActions, playerName, spellName, spellLevel, campaignName);
  restoreSpecialFreeCastFlags(playerName, spellName, spellLevel, campaignName);
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

// Concentration management for an incoming cast: detect a replaced concentration
// (breaks it + persists), a fresh concentration, or an Eyebite recast.
function resolveConcentrationChange(spell, playerName, playerStats, campaignName, isWgbSpell) {
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
  return { shouldSetConcentration, oldConcentrationSpell, isEyebiteRecast };
}

// Psionic Sorcery payment — SPs cover the spell level, components waived.
// Returns true when the payment was made (metaCtx stamps applied).
function applyPsionicSorceryPayment(spell, playerName, effectiveSpellLevel, campaignName, metaCtx) {
  const currentSP = Number(getRuntimeValue(playerName, 'sorceryPoints') ?? 0);
  if (currentSP < effectiveSpellLevel) return false;
  setRuntimeValue(playerName, 'sorceryPoints', currentSP - effectiveSpellLevel, campaignName);
  metaCtx.psionicSorcery = 'sorceryPoints';
  metaCtx.psionicCost = effectiveSpellLevel;
  metaCtx._psionicUsed = true;
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
  return true;
}

function consumeUpcastSlot(spell, playerName, playerStats, effectiveSpellLevel, campaignName) {
  const slotKey = `spell_slots_level_${effectiveSpellLevel}`;
  const currentSlots = getRuntimeValue(playerName, slotKey);
  const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
  const availableSlots = currentSlots != null ? currentSlots : maxSlots;
  if (availableSlots <= 0) return false;
  setRuntimeValue(playerName, slotKey, availableSlots - 1, campaignName);
  return true;
}

// FT-068: Ritual Master Quick Ritual — consume the once-per-Long-Rest slotless cast.
function consumeQuickRitual(spell, playerName, campaignName) {
  setRuntimeValue(playerName, '_Ritual_Master_quickRitualUsed', Date.now(), campaignName);
  addEntry(campaignName, {
    type: 'ability_use',
    characterName: playerName,
    abilityName: 'Ritual Master (Quick Ritual)',
    spellName: spell.name,
    note: `Quick Ritual: cast ${spell.name} using its regular casting time — no spell slot consumed. You can't use Quick Ritual again until you finish a Long Rest.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[spellPreparationService:log-error]', e); });
}

function consumeFreeCast(spell, playerName, playerStats, campaignName) {
  decrementFreeCastResource(playerName, spell.name, spell.level, playerStats, campaignName);
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
}

function consumeBaseSlot(spell, playerName, playerStats, isWarlock, campaignName) {
  const baseSlotKey = `spell_slots_level_${spell.level}`;
  let availableSlots = getRuntimeValue(playerName, baseSlotKey);
  const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[baseSlotKey]) || 0;
  availableSlots = availableSlots != null ? availableSlots : maxSlots;

  if (isWarlock && availableSlots <= 0) {
    const warlockSlotLevel = getWarlockSlotLevel(playerName, playerStats, spell.level);
    if (warlockSlotLevel === null) return false;
    const slotKey = `spell_slots_level_${warlockSlotLevel}`;
    const currentSlots = getRuntimeValue(playerName, slotKey);
    const slotMax = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
    const warlockAvailable = currentSlots != null ? currentSlots : slotMax;
    if (warlockAvailable > 0) {
      setRuntimeValue(playerName, slotKey, warlockAvailable - 1, campaignName);
      return true;
    }
    return false;
  }
  if (availableSlots > 0) {
    setRuntimeValue(playerName, baseSlotKey, availableSlots - 1, campaignName);
    return true;
  }
  return false;
}

// Hunter's Mark / Hex concentration buff rows (array-guarded append).
const CONCENTRATION_BUFF_EFFECTS = {
  "Hunter's Mark": 'hunters_mark_concentration',
  'Hex': 'hex_concentration',
};

function trackConcentrationBuff(spellName, playerName, campaignName) {
  const effect = CONCENTRATION_BUFF_EFFECTS[spellName];
  if (!effect) return;
  const existingBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
  const buff = { name: spellName, effect, duration: 'concentration' };
  const newBuffs = Array.isArray(existingBuffs) ? [...existingBuffs, buff] : [buff];
  setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
}

// CLA-252: free (spectral) casts change the school to Illusion and record the summoned
// creature so the summon path halves its HP. Pass campaignName so the list read/write
// targets the live campaign store (missing it silently no-oped later appends).
function stampPhantasmalCast(modifiedSpell, spellName, phantasmalPassive, playerName, campaignName) {
  modifiedSpell.school = 'Illusion';
  modifiedSpell._phantasmalCreatures = true;
  modifiedSpell._phantasmalHalvesHp = !!phantasmalPassive.halvesHp;
  const summonCreatureName = spellName === 'Summon Beast' ? 'Bestial Spirit' : 'Fey Spirit';
  const existingCreatures = getRuntimeValue(playerName, '_phantasmalCreatures_list', campaignName);
  // Copy before mutating: setRuntimeValue short-circuits identical references, so mutating
  // the store array in place would never POST the append.
  const creatureList = Array.isArray(existingCreatures) ? [...existingCreatures] : [];
  if (!creatureList.includes(summonCreatureName)) {
    creatureList.push(summonCreatureName);
    setRuntimeValue(playerName, '_phantasmalCreatures_list', creatureList, campaignName);
  }
}

// Resource consumption branch chain — mutually exclusive, order is rule-significant.
// Mutates result.slotConsumed / result.freeCastUsed / result.metaCtx in place.
function consumeSpellResource(spell, result, { isWgbSpell, isEyebiteRecast, isUpcast, isFreeCast, isQuickRitualCast, isWarlock, effectiveSpellLevel, playerName, playerStats, campaignName }) {
  if (isWgbSpell && spell.name === 'Spiritual Weapon') {
    cleanupBuffsByName(playerName, 'Shield of Faith', campaignName);
  } else if (isEyebiteRecast) {
    // Recasting Eyebite while already concentrating on it — no slot consumed, no buff updated
  } else if (isUpcast && !isFreeCast && !result.metaCtx._psionicUsed && effectiveSpellLevel !== spell.level) {
    result.slotConsumed = consumeUpcastSlot(spell, playerName, playerStats, effectiveSpellLevel, campaignName);
  } else if (isQuickRitualCast) {
    consumeQuickRitual(spell, playerName, campaignName);
    result.freeCastUsed = true;
    result.metaCtx.quickRitualUsed = true;
  } else if (isFreeCast) {
    consumeFreeCast(spell, playerName, playerStats, campaignName);
    result.freeCastUsed = true;
    result.metaCtx.freeCastUsed = true;
  } else if (!result.metaCtx._psionicUsed) {
    result.slotConsumed = consumeBaseSlot(spell, playerName, playerStats, isWarlock, campaignName);
  }
}

// FT-068: Ritual Master Quick Ritual — a prepared ritual spell granted by the feat is
// cast using its regular casting time (the spell never had its casting time changed)
// WITHOUT expending a spell slot, once per Long Rest. Opt-in via spell.quickRitual
// (popup checkbox); consumed here, refused (falls through to normal slot payment) when
// spent, re-armed by restRules-longRest.
function isQuickRitualGrant(spell, playerStats, playerName, campaignName, isUpcast) {
  const quickRitualHold = (playerStats.automation?.ritualSpells || []).some(f => f.chosenSpells && f.quickRitual);
  const quickRitualUsed = getRuntimeValue(playerName, '_Ritual_Master_quickRitualUsed', campaignName);
  return spell.quickRitual === true && spell._ritualMasterRitual === true && quickRitualHold && quickRitualUsed == null && !isUpcast;
}

// Set new concentration on the combat summary (Hunter's Mark / Hex carry targetName).
function applyNewConcentration(spell, playerName, playerStats, campaignName) {
  const cs = getCombatSummary(campaignName);
  if (!cs) return;
  const targetName = (spell.name === "Hunter's Mark" || spell.name === 'Hex')
    ? (cs.creatures.find(c => c.name === playerStats.name)?.targetName || null)
    : null;
  addConcentration(cs, playerName, spell.name, playerStats.spellAbilities?.saveDc ?? 10, targetName);
  storageService.default.set('combatSummary', cs, campaignName);
}

// Psychic damage-type override, Spell Breaker bonus-action Dispel Magic, and
// CLA-252 phantasmal (spectral) free-cast stamping on the modified spell.
function stampModifiedSpell(modifiedSpell, spell, playerStats, usePsychicDamage, freeCastAuthorized, playerName, campaignName) {
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

  const phantasmalPassive = playerStats.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  if (phantasmalPassive && freeCastAuthorized && (phantasmalPassive.freeCastSpells || []).includes(spell.name)) {
    stampPhantasmalCast(modifiedSpell, spell.name, phantasmalPassive, playerName, campaignName);
  }
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

  const concentration = resolveConcentrationChange(spell, playerName, playerStats, campaignName, isWgbSpell);
  const shouldSetConcentration = concentration.shouldSetConcentration;
  const oldConcentrationSpell = concentration.oldConcentrationSpell;
  const isEyebiteRecast = concentration.isEyebiteRecast;

  result.metaCtx.oldConcentrationSpell = oldConcentrationSpell;
  result.metaCtx.shouldSetConcentration = shouldSetConcentration;

  // Psionic Sorcery payment
  const isFreeCast = freeCastAuthorized;
  if (isPsionic && hasPsionic && !isFreeCast && usePsionicPayment) {
    applyPsionicSorceryPayment(spell, playerName, effectiveSpellLevel, campaignName, result.metaCtx);
  }

  const isQuickRitualCast = isQuickRitualGrant(spell, playerStats, playerName, campaignName, isUpcast);

  consumeSpellResource(spell, result, { isWgbSpell, isEyebiteRecast, isUpcast, isFreeCast, isQuickRitualCast, isWarlock, effectiveSpellLevel, playerName, playerStats, campaignName });

  // Cleanup old concentration effects
  if (oldConcentrationSpell) {
    cleanupConcentrationEffects(playerName, oldConcentrationSpell, campaignName);
  }

  // Set new concentration
  if (shouldSetConcentration) {
    applyNewConcentration(spell, playerName, playerStats, campaignName);
  }

  // Hunter's Mark / Hex buff tracking
  if (shouldSetConcentration) {
    trackConcentrationBuff(spell.name, playerName, campaignName);
  }

  if (shouldSetConcentration && spell.name === 'Eyebite') {
    const existingBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    setRuntimeValue(playerName, 'activeBuffs', [...existingBuffs, { name: 'Eyebite', effect: 'eyebite_concentration', duration: 'concentration' }], campaignName);
  }

  // Build modified spell
  const modifiedSpell = effectiveSpellLevel !== spell.level
    ? { ...spell, level: effectiveSpellLevel, baseLevel: spell.level }
    : { ...spell };

  stampModifiedSpell(modifiedSpell, spell, playerStats, usePsychicDamage, freeCastAuthorized, playerName, campaignName);

  result.modifiedSpell = modifiedSpell;
  return result;
}

export { isFreeCastAuthorized, incrementFreeCastResource };
