import { getRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';

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

const PRE_CAST_OPTIONS = METAMAGIC_OPTIONS.filter(o => o.effect !== METAMAGIC_EFFECTS.EMPOWERED);

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
     const buffs = getRuntimeValue(playerName, 'activeBuffs') || [];
     return Array.isArray(buffs) && buffs.some(b => b.name === 'Innate Sorcery') ? 2 : 1;
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
    const buffs = getRuntimeValue(playerName, 'activeBuffs') || [];
    return Array.isArray(buffs) && buffs.some(b => b.name === 'Innate Sorcery');
 }

export function computeMetamagicCost(selectedOptionNames, optionsList, stats, playerName) {
    if (selectedOptionNames.length === 0) return { totalCost: 0, waivedName: null };

    const costs = selectedOptionNames.map(name => {
        const opt = optionsList.find(o => o.name === name);
        return { name, cost: opt?.resolvedCost || 0 };
    });

    if (hasArcaneApotheosis(stats, playerName)) {
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
    const passives = playerStats?.automation?.passives || [];
    for (const passive of passives) {
        if (passive.type === 'psionic_spells_list' && Array.isArray(passive.psionicSpells)) {
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
    const passives = playerStats?.automation?.passives || [];
    return passives.some(p => p.type === 'psionic_sorcery');
}

