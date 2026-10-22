// @maintained-by-ai
// Registry canon owner (#820 golden-once): TARGET_EFFECT_DEFINITIONS is imported by the
// entire conditions family (#995-#1011, all maintained: base #998 dispatch, compute #1000
// fold bytes, combine #999, internal #1001, tickets, saveService quad, utils #1006,
// rules #1007-#1008, restoreBalance #1009, savePrompt #1010, slow #1011), the engine
// 134-key dispatch census (#998), and the GM manual-add UI (EffectAdder reads SOLELY
// from this registry — #app mandate: label/description/icon/group on every entry).
// A data typo here propagates app-wide, so the full golden census IS the test:
// every key's label/icon/cls/group/fields/defaults bytes pinned once (#815/#985 pattern,
// transcribed verbatim from the running module). Descriptions are long advisory prose —
// pinned non-empty here, with ticket-copy guard phrases for the ones consumers quote.
// Fold bytes → #1000 · dispatch → #998 · UI render → EffectAdder lanes · Defensive
// label sort → healingBlock.test.js:28. Consumers (registerTargetEffect writers,
// badge renderers) pin their own usage in their own lanes.
// Old→new map: 40 loose blocks → goldenCensus(134) + roster + goldenSelfConsistency +
// getEffectDefinition-honesty + register-table + getActive-pin + matcher-truth-table +
// description-copy-guards.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition, registerTargetEffect, getActiveTargetEffect, abilitySaveDisadvantageActive } from './targetEffectDefinitions.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Golden census: [effect, label, icon, cls, group, fields, defaults] — verbatim bytes.
// Adding/removing an effect MUST update this table (roster test fails otherwise), which
// is the intended friction of the #820 golden-once mandate.
const CENSUS = [
  ['slasher_enhanced_critical', 'Attack Disadv', 'fa-arrow-down', 'effect-disadvantage', 'Attack', ['source']],
  ['disadvantage_next_attack', 'Disadv Next Attack', 'fa-arrow-down', 'effect-disadvantage', 'Attack', ['source']],
  ['concentration_disadvantage', 'Concentration Disadv', 'fa-arrow-down', 'effect-disadvantage', 'Saves & Checks', ['source']],
  ['goad', 'Goad', 'fa-bullseye', 'effect-disadvantage', 'Attack', ['source']],
  ['next_attack_bonus', 'Next Attack +N Bonus', 'fa-bullseye', 'effect-target-adv', 'Attack', ['source', 'value'], { value: 5 }],
  ['next_attack_advantage', 'Next Attack Advantage', 'fa-arrow-up', 'effect-target-adv', 'Attack', ['source']],
  ['distracting_strike_advantage', 'Next Attack Adv vs Target', 'fa-arrow-up', 'effect-target-adv', 'Attack', ['source']],
  ['marked_as_prey', 'Marked as Prey', 'fa-crosshairs', 'effect-buff', 'Attack', ['source']],
  ['pesky_swarm', 'Pesky Swarm', 'fa-bug', 'effect-disadvantage', 'Attack', ['source']],
  ['disadvantage_attack_rolls', 'Attack Disadvantage', 'fa-arrow-down', 'effect-disadvantage', 'Attack', ['source']],
  ['reckless_attack', 'Reckless Attack', 'fa-shield-halved', 'effect-buff', 'Attack', ['source']],
  ['taunting_step', 'Taunted', 'fa-wand-sparkles', 'effect-disadvantage', 'Attack', ['source']],
  ['thri_kreen_bite_poison', 'Poisoned', 'fa-disease', 'effect-debuff', 'Attack', ['source', 'dc', 'saveType']],
  ['burning', 'Burning', 'fa-fire', 'effect-debuff', 'Defensive', ['source']],
  ['no_healing', "Can't Regain Hit Points", 'fa-heart-circle-xmark', 'effect-debuff', 'Defensive', ['source']],
  ['constrict_grapple', 'Constrict', 'fa-hand-fist', 'effect-debuff', 'Defensive', ['source', 'dc']],
  ['dodge', 'Disadvantage on attacks', 'fa-shield-halved', 'effect-target-disadv', 'Defensive'],
  ['escape_the_horde', 'Escape the Horde', 'fa-shield-halved', 'effect-target-disadv', 'Defensive', ['source']],
  ['frightful_presence_immunity', 'FP Immunity', 'fa-shield-halved', 'effect-buff', 'Defensive', ['source']],
  ['frightful_presence', 'Frightful Presence', 'fa-skull', 'effect-debuff', 'Defensive', ['source']],
  ['gaze_immunity', 'Gaze Immunity', 'fa-eye-slash', 'effect-buff', 'Defensive', ['source']],
  ['infernal_wound', 'Infernal Wound', 'fa-droplet', 'effect-debuff', 'Defensive', ['source', 'dc', 'bleedDie'], { bleedDie: '1d10' }],
  ['ink_cloud', 'Ink Cloud', 'fa-smog', 'effect-debuff', 'Defensive', ['source']],
  ['multiattack_defense', 'Multiattack Defense', 'fa-shield-halved', 'effect-target-disadv', 'Defensive', ['source']],
  ['no_action_and_bonus_action', 'No Actions or Bonus Actions', 'fa-ban', 'effect-cannot-act', 'Defensive', ['source']],
  ['no_opportunity_attacks', 'No Opportunity Attacks', 'fa-ban', 'effect-cannot-act', 'Defensive'],
  ['no_reactions', 'No Reactions', 'fa-ban', 'effect-cannot-act', 'Defensive'],
  ['protection', 'Protection', 'fa-shield-halved', 'effect-target-disadv', 'Defensive', ['source']],
  ['rapport_spores', 'Telepathic Rapport (Rapport Spores)', 'fa-comment-dots', 'effect-buff', 'Defensive', ['source']],
  ['ability_score_drain', 'Ability Score Drain', 'fa-arrow-down', 'effect-debuff', 'Saves & Checks', ['ability', 'source']],
  ['hp_max_reduce', 'HP Max Reduced', 'fa-heart-crack', 'effect-debuff', 'Saves & Checks', ['source']],
  ['advantage_abilities', 'Adv Check', 'fa-hand', 'effect-buff', 'Saves & Checks', ['source']],
  ['advantage_attacks', 'Adv', 'fa-arrow-up', 'effect-buff', 'Saves & Checks', ['source']],
  ['advantage_saves', 'Adv Save', 'fa-shield-halved', 'effect-buff', 'Saves & Checks', ['source']],
  ['bane_penalty', 'Bane (-1d4)', 'fa-shield-halved', 'effect-disadvantage', 'Saves & Checks', ['source', 'dc', 'displayLabel'], { dc: 15, displayLabel: 'Bane' }],
  ['giggling_magic_debuff', 'Giggling Magic (-1d6)', 'fa-face-laugh-squint', 'effect-disadvantage', 'Saves & Checks', ['source', 'displayLabel'], { displayLabel: 'Giggling Magic' }],
  ['weakening_breath', 'Weakening Breath', 'fa-hand-fist', 'effect-disadvantage', 'Saves & Checks', ['source', 'dc', 'saveType', 'damageSubtractDie'], { damageSubtractDie: '1d6' }],
  ['hex_ability_check_disadvantage', 'Check Disadv', 'fa-shield', 'effect-disadvantage', 'Saves & Checks', ['ability', 'source'], { ability: 'wis' }],
  ['dex_save_disadvantage', 'DEX Save Disadv', 'fa-shield', 'effect-disadvantage', 'Saves & Checks'],
  ['wisdom_save_advantage', 'WIS Save Adv', 'fa-shield', 'effect-buff', 'Saves & Checks', ['source']],
  ['disadvantage_perception_checks', 'Perception Disadv', 'fa-eye-slash', 'effect-disadvantage', 'Saves & Checks'],
  ['hex_save_disadvantage', 'Save Disadv', 'fa-shield', 'effect-disadvantage', 'Saves & Checks', ['ability', 'source'], { ability: 'wis' }],
  ['ability_save_disadvantage', 'Save Disadv (Ability)', 'fa-shield', 'effect-disadvantage', 'Saves & Checks', ['ability', 'source']],
  ['disadvantage_on_next_save', 'Save Disadv (Next)', 'fa-shield', 'effect-disadvantage', 'Saves & Checks', ['source']],
  ['sleep_staged', 'Sleep', 'fa-moon', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['paralyzing_staged', 'Paralyzing Breath', 'fa-bolt', 'effect-debuff', 'Spells', ['source', 'dc', 'saveType']],
  ['petrifying_bite_staged', 'Petrifying Bite', 'fa-diamond', 'effect-debuff', 'Spells', ['source', 'dc', 'saveType']],
  ['tashas_hideous_laughter', "Tasha's Hideous Laughter", 'fa-music', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['forcecage', 'Forcecage', 'fa-dungeon', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['protection_from_evil_and_good', 'Protection from Evil and Good', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['protection_from_poison', 'Protection from Poison', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['maze', 'Maze', 'fa-dungeon', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['confusion', 'Confused', 'fa-circle-notch', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['banishment', 'Banishment', 'fa-door-open', 'effect-debuff', 'Spells', ['source']],
  ['banished_demiplane', 'Banished (Demiplane)', 'fa-door-open', 'effect-debuff', 'Spells', ['source']],
  ['holy_aura', 'Holy Aura', 'fa-sun', 'effect-buff', 'Spells', ['source']],
  ['antimagic_field', 'Antimagic Field', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['aura_of_life', 'Aura of Life', 'fa-heart-pulse', 'effect-buff', 'Spells', ['source']],
  ['aura_of_purity', 'Aura of Purity', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['aura_of_vitality', 'Aura of Vitality', 'fa-heart-pulse', 'effect-buff', 'Spells', ['source']],
  ['barkskin', 'Barkskin', 'fa-tree', 'effect-buff', 'Spells', ['source']],
  ['blur', 'Blur', 'fa-eye-slash', 'effect-target-disadv', 'Spells', ['source']],
  ['beacon_of_hope', 'Beacon of Hope', 'fa-heart-pulse', 'effect-buff', 'Spells', ['source']],
  ['bless_bonus', 'Bless (+1d4)', 'fa-hands', 'effect-bless', 'Spells', ['source']],
  ['calm_emotions', 'Calm Emotions', 'fa-hand-holding-heart', 'effect-buff', 'Spells', ['source']],
  ['indifferent', 'Indifferent (Calm Emotions)', 'fa-handshake', 'effect-neutral', 'Spells', ['source']],
  ['circle_of_power', 'Circle of Power', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['clairvoyant_combatant', 'Clairvoyant Combatant', 'fa-eye', 'effect-target-adv', 'Spells', ['source']],
  ['compelled_duel', 'Compelled Duel', 'fa-hand-fist', 'effect-disadvantage', 'Spells', ['source']],
  ['crown_of_madness', 'Crown of Madness', 'fa-crown', 'effect-charm', 'Spells', ['source']],
  ['death_strike', 'Death Strike', 'fa-skull', 'effect-auto-crit', 'Spells', ['source', 'dc'], { dc: 15 }],
  ['heroism', 'Heroism', 'fa-dragon', 'effect-buff', 'Spells', ['source']],
  ['death_ward', 'Death Ward', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['enhance_ability', 'Enhance Ability', 'fa-hand', 'effect-buff', 'Spells', ['ability', 'source'], { ability: 'STR' }],
  ['bolstered', 'Bolstered', 'fa-shield-heart', 'effect-buff', 'Spells', ['source']],
  ['bolster_advantage', 'Bolstered (Advantage on D20 Tests)', 'fa-arrow-up', 'effect-buff', 'Spells', ['source']],
  ['enlarged', 'Enlarged', 'fa-up-right-and-down-left-from-center', 'effect-buff', 'Spells', ['source']],
  ['ethereal', 'Ethereal', 'fa-ghost', 'effect-buff', 'Spells', ['source']],
  ['disguised', 'Disguised', 'fa-user-secret', 'effect-buff', 'Spells', ['source']],
  ['invisible', 'Invisible', 'fa-eye-slash', 'effect-buff', 'Spells', ['source']],
  ['eye_ray_paralyzed', 'Eye Ray: Paralyzed', 'fa-bolt', 'effect-debuff', 'Spells', ['source', 'dc', 'saveType']],
  ['eye_ray_petrifying', 'Eye Ray: Petrifying', 'fa-hand', 'effect-debuff', 'Spells', ['source', 'dc', 'saveType']],
  ['faerie_fire', 'Faerie Fire', 'fa-fire', 'effect-debuff', 'Spells', ['source']],
  ['flesh_to_stone', 'Flesh to Stone', 'fa-dungeon', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['foresight', 'Foresight', 'fa-eye', 'effect-target-adv', 'Spells', ['source']],
  ['globe_barrier', 'Globe of Invulnerability', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['ottos_irresistible_dance', "Otto's Irresistible Dance", 'fa-music', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['regenerate', 'Regenerate', 'fa-heart-pulse', 'effect-buff', 'Spells', ['source']],
  ['resistance_damage_reduction', 'Resistance', 'fa-shield-halved', 'effect-buff', 'Spells', ['source']],
  ['ray_of_enfeeble_debuff', 'Ray of Enfeeblement', 'fa-hand-fist', 'effect-disadvantage', 'Spells', ['source']],
  ['resilient_sphere', 'Resilient Sphere', 'fa-circle', 'effect-debuff', 'Spells', ['source']],
  ['silenced', 'Silenced', 'fa-volume-xmark', 'effect-disadvantage', 'Spells', ['source']],
  ['starry_form', 'Starry Form', 'fa-star', 'effect-buff', 'Spells', ['source', 'constellation']],
  ['incite_rampage', 'Incited Rampage', 'fa-fire', 'effect-buff', 'Spells', ['source']],
  ['redirect_attack', 'Redirected Attack', 'fa-right-left', 'effect-buff', 'Spells', ['source']],
  ['summoned', 'Summoned', 'fa-hand-sparkles', 'effect-summoned', 'Spells', ['source']],
  ['wild_shape', 'Wild Shape', 'fa-paw', 'effect-buff', 'Spells', ['source', 'beastName']],
  ['polymorph', 'Polymorph', 'fa-paw', 'effect-buff', 'Spells', ['source', 'beastName']],
  ['true_polymorph', 'True Polymorph', 'fa-paw', 'effect-buff', 'Spells', ['source', 'beastName', 'mode']],
  ['animal_shapes', 'Animal Shapes', 'fa-paw', 'effect-buff', 'Spells', ['source', 'beastName']],
  ['shapechange', 'Shapechange', 'fa-paw', 'effect-buff', 'Spells', ['source', 'formName']],
  ['object_transform', 'True Polymorph (Object)', 'fa-gem', 'effect-debuff', 'Spells', ['source', 'objectType']],
  ['pass_without_trace_bonus', 'Pass Without Trace', 'fa-wind', 'effect-target-adv', 'Spells', ['source', 'value'], { value: 10 }],
  ['imprisonment', 'Imprisonment', 'fa-dungeon', 'effect-debuff', 'Spells', ['source', 'value']],
  ['prismatic_spray_indigo', 'Prismatic Spray (Indigo)', 'fa-eye', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['prismatic_spray_violet', 'Prismatic Spray (Violet)', 'fa-door-open', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['sanctuary', 'Sanctuary', 'fa-shield-halved', 'effect-buff', 'Spells', ['source', 'dc']],
  ['sleet_storm', 'Sleet Storm', 'fa-snowflake', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['stinking_cloud', 'Stinking Cloud', 'fa-smog', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['warding_bond', 'Warding Bond', 'fa-ring', 'effect-buff', 'Spells', ['source']],
  ['web', 'Web', 'fa-spider', 'effect-debuff', 'Spells', ['source', 'dc']],
  ['whirlwind', 'Whirlwind (Zone)', 'fa-hurricane', 'effect-debuff', 'Spells', ['source', 'dc', 'saveType']],
  ['lair_dream_plane', 'Dream Plane (Lair)', 'fa-cloud-moon', 'effect-debuff', 'Lair', ['source']],
  ['lair_darkness', 'Magical Darkness (Lair)', 'fa-moon', 'effect-debuff', 'Lair', ['source']],
  ['lair_insect_cloud', 'Insect Cloud (Lair)', 'fa-bug', 'effect-debuff', 'Lair', ['source', 'dc']],
  ['lair_sand_cloud', 'Sand Cloud (Lair)', 'fa-smog', 'effect-debuff', 'Lair', ['source', 'dc']],
  ['lair_fog_cloud', 'Fog Cloud (Lair)', 'fa-cloud-fog', 'effect-debuff', 'Lair', ['source']],
  ['lair_spike_growth', 'Stone Spikes (Lair)', 'fa-mountain', 'effect-debuff', 'Lair', ['source']],
  ['lair_slimy_ground', 'Slimy Ground (Lair)', 'fa-hand-dots', 'effect-debuff', 'Lair', ['source']],
  ['lair_spectral_eyes', 'Spectral Eyes and Tentacles (Lair)', 'fa-eye', 'effect-debuff', 'Lair', ['source']],
  ['lair_mud', 'Liquid Mud (Lair)', 'fa-water', 'effect-debuff', 'Lair', ['source', 'dc']],
  ['lair_volcanic_gas', 'Volcanic Gas (Lair)', 'fa-smog', 'effect-debuff', 'Lair', ['source', 'dc']],
  ['ac_penalty', 'AC Penalty', 'fa-shield-halved', 'effect-disadvantage', 'Movement', ['source', 'value'], { value: 2 }],
  ['attached', 'Attached', 'fa-circle-dot', 'effect-debuff', 'Movement', ['source']],
  ['branches_of_the_tree_teleport', 'Tree-Branch Teleport', 'fa-tree', 'effect-neutral', 'Movement', ['source', 'value'], { value: 5 }],
  ['frozen_grip', 'Frozen Grip', 'fa-snowflake', 'effect-debuff', 'Movement', ['source', 'value'], { value: 10 }],
  ['falling', 'Falling', 'fa-person-falling', 'effect-debuff', 'Movement', ['value'], { value: 10 }],
  ['push', 'Pushed', 'fa-hand', 'effect-debuff', 'Movement', ['source', 'value'], { value: 10 }],
  ['speed_half', 'Speed Halved', 'fa-gauge-high', 'effect-debuff', 'Movement', ['source']],
  ['speed_zero', 'Speed 0', 'fa-gauge-simple', 'effect-speed-zero', 'Movement', ['source']],
  ['speed_reduction', 'Speed Reduced', 'fa-minus', 'effect-speed-zero', 'Movement', ['source', 'value'], { value: 10 }],
  ['telekinetic_movement', 'Telekinetic Moved', 'fa-hand', 'effect-neutral', 'Movement', ['source', 'value'], { value: 30 }],
  ['teleport_swap_with_illusion', 'Illusion Swap', 'fa-arrows-rotate', 'effect-neutral', 'Movement', ['source', 'value'], { value: 30 }],
  ['warping_implosion_teleport', 'Warping Implosion', 'fa-arrow-right-arrow-left', 'effect-neutral', 'Movement', ['source', 'value'], { value: 120 }],
  ['pulled_toward', 'Pulled Toward', 'fa-arrows-to-circle', 'effect-debuff', 'Movement', ['source', 'value'], { value: 5 }],
];

describe('TARGET_EFFECT_DEFINITIONS golden census (#820)', () => {
  it.each(CENSUS)('te "%s" is golden', (effect, label, icon, cls, group, fields, defaults) => {
    const def = getEffectDefinition(effect);
    expect(def).toBeDefined();
    const { description, ...shape } = def;
    expect(typeof description).toBe('string');
    expect(description.length).toBeGreaterThan(0);
    // Exact shape: no missing, extra, or drifted property beyond description (#app mandate).
    expect(shape).toEqual({ effect, label, icon, cls, group, fields, defaults });
  });

  it('roster is exactly the golden census — no additions, removals, or duplicates', () => {
    const keys = TARGET_EFFECT_DEFINITIONS.map((d) => d.effect);
    expect(keys).toHaveLength(CENSUS.length);
    expect([...keys].sort()).toEqual(CENSUS.map((row) => row[0]).sort());
    expect([...new Set(keys)]).toHaveLength(CENSUS.length);
    // Groups stay within the authored picker set.
    expect([...new Set(TARGET_EFFECT_DEFINITIONS.map((d) => d.group))].sort())
      .toEqual(['Attack', 'Defensive', 'Lair', 'Movement', 'Saves & Checks', 'Spells']);
  });

  it('golden rows are self-consistent: fa- icons, effect- cls, defaults keys declared in fields', () => {
    for (const [effect, , icon, cls, , fields, defaults] of CENSUS) {
      expect(icon, effect).toMatch(/^fa-/);
      expect(cls, effect).toMatch(/^effect-/);
      for (const key of Object.keys(defaults || {})) {
        expect(fields, `${effect}.${key}`).toContain(key);
      }
    }
  });
});

// Advisory prose guards for copy consumers quote verbatim (badges, modals, tickets).
// Full-byte description ownership stays in the consumer lanes that render them.
describe('description copy guards', () => {
  it.each([
    ['concentration_disadvantage', ['Disadvantage on saving throws to maintain Concentration']],
    ['no_healing', ["can't regain Hit Points"]],
    ['indifferent', ['GM-enforced advisory', 'takes damage']],
    ['rapport_spores', ['telepathy', 'GM-enforced']],
    ['attached', ["2d4) Necrotic damage at the start of each of the stirge's turns", '5 feet of movement', 'can detach it as an action', 'Darkmantle: Speed 0, moves with the target', 'DC 13 Strength (Athletics) action']],
    ['frozen_grip', ['Speed is reduced by N feet', "can't take Reactions", 'move or take one action on its turn, not both', 'GM-enforced']],
    ['pulled_toward', ['pulled N feet straight toward the source', 'GM-enforced']],
  ])('te "%s" copy stays in force', (effect, phrases) => {
    const def = getEffectDefinition(effect);
    for (const phrase of phrases) {
      expect(def.description, `${effect}: ${phrase}`).toContain(phrase);
    }
  });
});

describe('getEffectDefinition', () => {
  it('returns undefined for unknown/empty keys — honest lookup, no throw', () => {
    expect(getEffectDefinition('nonexistent_effect')).toBeUndefined();
    expect(getEffectDefinition('')).toBeUndefined();
    expect(getEffectDefinition(null)).toBeUndefined();
    expect(getEffectDefinition(undefined)).toBeUndefined();
  });
});

describe('registerTargetEffect', () => {
  const campaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Full written-array + full setRuntimeValue arg-tuple pins (skipSync=true baked in).
  it.each([
    {
      name: 'creates a concentration entry on an empty store',
      stored: [],
      call: ['Ally1', 'holy_aura', 'Paladin', undefined],
      expected: [{ target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' }],
    },
    {
      name: 'creates a concentration entry on a null store',
      stored: null,
      call: ['Ally1', 'aura_of_life', 'Cleric', undefined],
      expected: [{ target: 'Ally1', effect: 'aura_of_life', source: 'Cleric', duration: 'concentration' }],
    },
    {
      name: 'same target+effect+source overwrites in place, extraProps replacing values',
      stored: [{ target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Paladin', chosenType: 'Fire', duration: 'concentration' }],
      call: ['Ally1', 'resistance_damage_reduction', 'Paladin', { chosenType: 'Cold' }],
      expected: [{ target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Paladin', chosenType: 'Cold', duration: 'concentration' }],
    },
    {
      name: 'different target appends, preserving the existing entry',
      stored: [{ target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' }],
      call: ['Ally2', 'holy_aura', 'Paladin', undefined],
      expected: [
        { target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' },
        { target: 'Ally2', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' },
      ],
    },
    {
      name: 'different source appends its own entry with extraProps passed through',
      stored: [{ target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Cleric', chosenType: 'Fire', duration: 'concentration' }],
      call: ['Ally1', 'resistance_damage_reduction', 'Paladin', { chosenType: 'Cold' }],
      expected: [
        { target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Cleric', chosenType: 'Fire', duration: 'concentration' },
        { target: 'Ally1', effect: 'resistance_damage_reduction', source: 'Paladin', chosenType: 'Cold', duration: 'concentration' },
      ],
    },
  ])('$name', ({ stored, call, expected }) => {
    getRuntimeValue.mockReturnValue(stored);
    const [target, effect, source, extraProps] = call;
    registerTargetEffect(campaignName, target, effect, source, extraProps);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expected, campaignName, true);
  });
});

describe('getActiveTargetEffect', () => {
  const campaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the live te by target+key, null for misses and non-array stores', () => {
    const te = { target: 'Ally1', effect: 'concentration_disadvantage', source: 'Adult Black Dragon 1', duration: 'until_end_of_next_turn' };
    getRuntimeValue.mockReturnValue([te]);
    expect(getActiveTargetEffect(campaignName, 'Ally1', 'concentration_disadvantage')).toBe(te);
    expect(getActiveTargetEffect(campaignName, 'Ally2', 'concentration_disadvantage')).toBeNull();
    expect(getActiveTargetEffect(campaignName, 'Ally1', 'holy_aura')).toBeNull();
    getRuntimeValue.mockReturnValue(undefined);
    expect(getActiveTargetEffect(campaignName, 'Ally1', 'concentration_disadvantage')).toBeNull();
  });
});

// MA-1352 + CLA-107: ability-scoped save-disadvantage matcher truth table.
describe('abilitySaveDisadvantageActive', () => {
  const abilityTe = (over = {}) => ({
    target: 'Bandit 1',
    effect: 'ability_save_disadvantage',
    ability: 'int',
    source: 'Psychic Gray Ooze 1',
    duration: 'until_start_of_next_turn',
    ...over,
  });
  const hexTe = (over = {}) => ({
    target: 'Bandit 1',
    effect: 'hex_save_disadvantage',
    ability: 'DEX',
    source: 'HexWarlock',
    ...over,
  });

  it.each([
    ['full-word save type matches the int te', [abilityTe()], 'Bandit 1', 'Intelligence', true],
    ['uppercase abbreviation matches', [abilityTe()], 'Bandit 1', 'INT', true],
    ['lowercase abbreviation matches', [abilityTe()], 'Bandit 1', 'int', true],
    ['other save type stays unaffected', [abilityTe()], 'Bandit 1', 'DEX', false],
    ['other worded save type stays unaffected', [abilityTe()], 'Bandit 1', 'Wisdom', false],
    ['other target stays unaffected', [abilityTe()], 'Other 1', 'Intelligence', false],
    ['te without an ability never matches', [{ target: 'Bandit 1', effect: 'ability_save_disadvantage', source: 'X' }], 'Bandit 1', 'Intelligence', false],
    ['te with the wrong ability never matches', [abilityTe({ ability: 'dex' })], 'Bandit 1', 'Intelligence', false],
    ['CLA-107 hex folds its chosen ability (uppercase stored)', [hexTe()], 'Bandit 1', 'DEX', true],
    ['CLA-107 hex folds the worded form', [hexTe()], 'Bandit 1', 'Dexterity', true],
    ['CLA-107 hex folds the lowercase form', [hexTe()], 'Bandit 1', 'dex', true],
    ['CLA-107 hex does not fold other abilities', [hexTe()], 'Bandit 1', 'STR', false],
    ['CLA-107 hex worded mismatch stays false', [hexTe()], 'Bandit 1', 'Wisdom', false],
    ['CLA-107 hex does not leak to other targets', [hexTe()], 'Other 1', 'Dexterity', false],
    ['next_save te does not leak into the ability-scoped lane', [{ target: 'Bandit 1', effect: 'disadvantage_on_next_save', source: 'X' }], 'Bandit 1', 'Intelligence', false],
    ['empty te-list is inert', [], 'Bandit 1', 'Intelligence', false],
    ['undefined te-list is inert', undefined, 'Bandit 1', 'Intelligence', false],
    ['empty saveType is inert', [abilityTe()], 'Bandit 1', '', false],
    ['undefined saveType is inert', [abilityTe()], 'Bandit 1', undefined, false],
  ])('%s', (_name, targetEffects, target, saveType, expected) => {
    expect(abilitySaveDisadvantageActive(targetEffects, target, saveType)).toBe(expected);
  });
});
