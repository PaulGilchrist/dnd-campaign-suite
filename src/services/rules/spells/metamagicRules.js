import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

export const METAMAGIC_EFFECTS = {
  CAREFUL: 'ally_auto_succeed_save',
  DISTANT: 'double_range',
  EMPOWERED: 'reroll_damage_dice',
  EXTENDED: 'double_duration',
  HEIGHTENED: 'disadvantage_on_save',
  QUICKENED: 'cast_spell_as_bonus_action',
  SUBTLE: 'no_verbal_somatic',
  TWINNED: 'target_two_creatures',
};

export const METAMAGIC_OPTIONS = [
  {
    name: 'Careful Spell',
    cost: 1,
    effect: METAMAGIC_EFFECTS.CAREFUL,
    description: 'Allies automatically succeed on saving throws against your spell.',
  },
  {
    name: 'Distant Spell',
    cost: 1,
    effect: METAMAGIC_EFFECTS.DISTANT,
    description: 'Double the range of the spell, or turn a touch spell into 30 ft.',
  },
  {
    name: 'Empowered Spell',
    cost: 1,
    effect: METAMAGIC_EFFECTS.EMPOWERED,
    description: 'Reroll a number of damage dice up to your Charisma modifier.',
  },
  {
    name: 'Extended Spell',
    cost: 1,
    effect: METAMAGIC_EFFECTS.EXTENDED,
    description: 'Double the duration of the spell, up to 24 hours.',
  },
  {
    name: 'Heightened Spell',
    cost: 3,
    effect: METAMAGIC_EFFECTS.HEIGHTENED,
    description: 'Give one target disadvantage on its first saving throw against the spell.',
  },
  {
    name: 'Quickened Spell',
    cost: 2,
    effect: METAMAGIC_EFFECTS.QUICKENED,
    description: 'Change the casting time to 1 bonus action.',
  },
  {
    name: 'Subtle Spell',
    cost: 1,
    effect: METAMAGIC_EFFECTS.SUBTLE,
    description: 'Cast the spell without somatic or verbal components.',
  },
  {
    name: 'Twinned Spell',
    cost: 'spell_level',
    effect: METAMAGIC_EFFECTS.TWINNED,
    description: 'Target a second creature in range with the same spell.',
  },
];

// #1451(c): isPreCastOption is the single source of this split — the popup's
// selectable lane is pre-cast options only; Empowered is post-roll (damage-dice
// reride, empoweredSpellService.js) and must never appear in the chooser.
const PRE_CAST_OPTIONS = METAMAGIC_OPTIONS.filter(isPreCastOption);

export function getMetamagicCost(option, spellLevel) {
  if (option.cost === 'spell_level') {
    return Math.max(1, spellLevel || 0);
  }
  return option.cost;
}

export function getPreCastOptions(stats, currentSP, spellLevel) {
  if (!stats || stats.class?.name !== 'Sorcerer') return [];
  return PRE_CAST_OPTIONS.map(opt => {
    const cost = getMetamagicCost(opt, spellLevel);
    return { ...opt, resolvedCost: cost, affordable: currentSP >= cost };
  });
}

export function getChaModifier(stats) {
  if (!stats?.abilities) return 0;
  return Math.max(0, getAbilityModifier(stats.abilities, 'Charisma'));
}

export function getMaxMetamagicPerSpell(stats, playerName) {
  if (stats?.rules === '2024' && (stats.level || 0) >= 6) {
     const buffs = getRuntimeValue(playerName, 'activeBuffs');
       if (!Array.isArray(buffs)) return 1;
       return buffs.some(b => b.name === 'Innate Sorcery') ? 2 : 1;
    }
   return 1;
}

export function isPreCastOption(option) {
  return option.effect !== METAMAGIC_EFFECTS.EMPOWERED;
}

export function hasArcaneApotheosis(stats, playerName) {
    const passives = stats?.automation?.passives ?? [];
    const hasFeature = passives.some(p => p.name === 'Arcane Apotheosis');
    if (!hasFeature) return false;
    const buffs = getRuntimeValue(playerName, 'activeBuffs');
    if (!Array.isArray(buffs)) return false;
    return buffs.some(b => b.name === 'Innate Sorcery');
 }

// #1451(a) DISK LAW (public/data/2024/classes.json [9]/class_levels[19]/features[0],
// level 20): "While your Innate Sorcery feature is active, you can use one Metamagic
// option on each of your turns without spending Sorcery Points on it." — once PER
// TURN, not per cast. Pre-fix computeMetamagicCost waived its highest-cost option on
// EVERY call, so a Quickened double-cast turn got the waiver twice. The waiver is now
// latched per turn: _Arcane_Apotheosis_usedRound (fix#63/_War_Magic_usedRound house
// naming, warMagicCantripHandler.js:17; numeric-round stamp + `=== currentRound` gate
// per CLA-381 warMagicCantripHandler.js:54-55; consumed at the waived-cast confirm
// seam in MetamagicPopup.jsx handleConfirm via consumeArcaneApotheosisWaiver;
// re-armed at round wrap / initiative roll in navigationHandlers.js
// PLAYER_ROUND_LATCH_KEYS + Initiative.jsx clearPlayerRoundFlags). NO-CLOCK POLICY:
// turn-seam latch matured only at initiative seams — zero timers, zero Date.now.
export const ARCANE_APOTHEOSIS_USED_ROUND_KEY = '_Arcane_Apotheosis_usedRound';

export function isArcaneApotheosisWaiverSpent(playerName, campaignName) {
  const usedRound = Number(getRuntimeValue(playerName, ARCANE_APOTHEOSIS_USED_ROUND_KEY) ?? 0);
  return usedRound === getCurrentCombatRound(campaignName);
}

export function consumeArcaneApotheosisWaiver(playerStats, campaignName) {
  const stamp = getCurrentCombatRound(campaignName);
  setRuntimeValue(playerStats.name, ARCANE_APOTHEOSIS_USED_ROUND_KEY, stamp, campaignName);
  return stamp;
}

export function computeMetamagicCost(selectedOptionNames, optionsList, stats, playerName, campaignName) {
    if (selectedOptionNames.length === 0) return { totalCost: 0, waivedName: null };

    const costs = selectedOptionNames.map(name => {
        const opt = optionsList.find(o => o.name === name);
        // #1451(b): no `|| 0` silent-free arm — an unresolvable cost row is invalid
        // input; refuse loudly via the file's own console.error + throw house arm
        // (see getPsionicSpellsList :138). A fabricated 0 here = free casting.
        if (!opt || typeof opt.resolvedCost !== 'number' || !Number.isFinite(opt.resolvedCost)) {
            console.error('[metamagicRules] Unknown Metamagic option (no cost row):', name);
            throw new Error('Unknown Metamagic option: ' + name);
        }
        return { name, cost: opt.resolvedCost };
    });

    // #1451(a): waiver is once per TURN (disk law above) — spent latches do not waive.
    // Read-only here (preview-safe: the popup calls this every render); the stamp lives
    // at the confirm seam via consumeArcaneApotheosisWaiver.
    if (hasArcaneApotheosis(stats, playerName) && !isArcaneApotheosisWaiverSpent(playerName, campaignName)) {
        const maxCost = Math.max(...costs.map(c => c.cost));
        const waivedIdx = costs.findIndex(c => c.cost === maxCost);
        const waivedName = costs[waivedIdx].name;
        let totalCost = 0;
        for (let i = 0; i < costs.length; i++) {
            if (i !== waivedIdx) totalCost += costs[i].cost;
        }
        return { totalCost, waivedName };
    }

    const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);
    return { totalCost, waivedName: null };
 }

export function getPsionicSpellsList(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) { console.error('[metamagicRules] Missing array:', passives); throw new Error('Expected array, got ' + passives); }
    for (const passive of passives) {
        if (passive.type === 'psionic_spells_list' && Array.isArray(passive.psionicSpells)) {
            return passive.psionicSpells;
        }
        if (passive.type === 'psionic_sorcery' && Array.isArray(passive.psionicSpells)) {
            return passive.psionicSpells;
        }
    }
    return [];
}

export function isPsionicSpell(playerStats, spellName) {
    if (!spellName) return false;
    const psionicSpells = getPsionicSpellsList(playerStats);
    return psionicSpells.includes(spellName);
}

export function hasPsionicSorcery(playerStats) {
    const passives = playerStats?.automation?.passives;
    if (passives == null) { console.error('[metamagicRules] Missing array:', passives); throw new Error('Expected array, got ' + passives); }
    return passives.some(p => p.type === 'psionic_sorcery');
}

