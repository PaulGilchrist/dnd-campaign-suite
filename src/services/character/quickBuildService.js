/**
 * Quick Build service for the character wizard.
 *
 * Given the wizard's formData once ruleset/race(/subrace)/class(/subclass)
 * are chosen, derives a complete level-1 draft: ability scores, subclass
 * default, skills/tools/languages, fighting style, cantrips + lowest-level
 * spells, starting equipment & gold, and any level-1-required picks (2024
 * origin feat via background, mandatory resistances).
 *
 * Design rules:
 *  - NEVER re-implement limit logic: every count comes from the same
 *    services the wizard steps use (getSkillLimits, getToolLimitsByCategory,
 *    getLanguageLimits, getFightingStyleLimits, getSpellLimits,
 *    getPreSelected*), so the draft is legal by the wizard's own terms.
 *  - Everything stays editable: the draft is just a starting formData state.
 *  - Authored fallbacks (ability templates, 5e equipment) live in
 *    src/config/quickBuildDefaults.js; 2024 equipment/gold parse the real
 *    starting_equipment strings from public/data/2024/classes.json.
 */
import cloneDeep from 'lodash/cloneDeep';
import {
  fetchClassData,
  fetchRaceData,
  fetchBackgroundData,
  loadFeatData,
  loadSpells,
  loadEquipment,
  loadFightingStyles,
  loadSkills,
} from '../ui/dataLoader.js';
import { computeRaceBuffs } from './raceBuffService.js';
import { getSkillLimits, getPreSelectedSkills, getExpertiseLimits } from './skillValidation.js';
import { ALL_SKILL_NAMES } from './skillValidation/constants.js';
import { getToolLimitsByCategory, getToolsByCategory } from './toolValidation.js';
import { getLanguageLimits, getFightingStyleLimits } from './languagesFightingstylesValidation.js';
import { getPreSelectedResistances } from './resistancesValidation.js';
import { getPreSelectedFeats } from './featValidation.js';
import { getSpellLimits } from '../rules/spells/spellLimits.js';
import {
  QUICK_BUILD_ABILITY_TEMPLATES,
  QUICK_BUILD_PRIMARY_ABILITY,
  QUICK_BUILD_BACKGROUNDS_2024,
  QUICK_BUILD_GENERIC_BACKGROUND_2024,
  QUICK_BUILD_FIGHTING_STYLE_PRIORITY,
  QUICK_BUILD_STARTING_EQUIPMENT_5E,
  QUICK_BUILD_EQUIPMENT_NAME_FIXES,
} from '../../config/quickBuildDefaults.js';

const ABILITY_ORDER = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

/**
 * THE one background derivation for the quick-build lane — both the wizard's
 * Background-step prefill and generateQuickBuildDraft call this, so the two
 * lanes can never disagree. Deterministic table lookup on the same inputs
 * (ruleset + class). Race is not a key: public/data/2024/backgrounds.json
 * carries no race-keyed rows, so class is the only discriminator the authored
 * data supports. Before the class is known (the Background step runs before
 * the Class step) the same call with no className resolves to the generic
 * default — which is also exactly what the draft leaves standing when the user
 * already walked past that prefill (see generateQuickBuildDraft).
 */
export function deriveQuickBackground({ ruleset, className } = {}) {
  if (ruleset !== '2024') return '';
  return QUICK_BUILD_BACKGROUNDS_2024[className] || QUICK_BUILD_GENERIC_BACKGROUND_2024;
}

// ————— Ability scores —————

async function computeRacialIncreases(race, ruleset) {
  if (ruleset !== '5e' || !race?.name) return {};
  const fullRace = await fetchRaceData(race.name, ruleset);
  if (!fullRace) return {};
  const increases = {};
  const addBuffs = (buffs) => buffs.abilityScoreIncreases.forEach(b => {
    increases[b.name] = (increases[b.name] || 0) + b.amount;
  });
  addBuffs(computeRaceBuffs(fullRace, { race: { name: fullRace.name, subrace: race.subrace || null }, rules: ruleset }, '5e'));
  if (race.subrace?.name) {
    addBuffs(computeRaceBuffs(fullRace, { race: { subrace: { name: race.subrace.name } } }, '5e'));
  }
  return increases;
}

// Mirrors useWizardBackgroundAbility's default distribution (each listed
// background ability +1, total 3) so the draft matches what the step applies.
function parseBackgroundAbilityNames(abilityScoresStr) {
  if (!abilityScoresStr) return [];
  return abilityScoresStr.split(/[,;]|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
}

async function buildAbilities(draft) {
  const ruleset = draft.rules;
  const className = draft.class.name;
  const template = QUICK_BUILD_ABILITY_TEMPLATES[className]?.[ruleset];
  if (!template) {
    console.error(`[quickBuildService] No ability template for ${ruleset} ${className} — leaving scores untouched`);
    return;
  }
  const racial = await computeRacialIncreases(draft.race, ruleset);
  const previous = draft.abilities || [];
  draft.abilities = ABILITY_ORDER.map((name, index) => {
    const existing = previous.find(a => a.name === name) || {};
    return {
      name,
      baseScore: template[index],
      featIncrease: existing.featIncrease || 0,
      backgroundIncrease: existing.backgroundIncrease || 0,
      miscIncrease: existing.miscIncrease || 0,
      racialIncrease: racial[name] || 0,
    };
  });
  if (ruleset === '2024' && draft.background) {
    const bgData = await fetchBackgroundData(draft.background, '2024');
    const names = parseBackgroundAbilityNames(bgData?.ability_scores);
    const noneApplied = draft.abilities.every(a => !a.backgroundIncrease);
    if (noneApplied) {
      draft.abilities.forEach(a => {
        if (names.includes(a.name)) a.backgroundIncrease = 1;
      });
    }
  }
}

// ————— Skills & expertise —————

function pushWithin(selected, pool, count) {
  let taken = 0;
  for (const item of pool || []) {
    if (taken >= count) break;
    if (!selected.includes(item)) {
      selected.push(item);
      taken += 1;
    }
  }
  return selected;
}

async function topUpSkills(selected, draft) {
  const limits = await getSkillLimits(draft, await loadFeatData(draft.rules));
  const allowed = typeof limits.allowed === 'number' ? limits.allowed : selected.length;
  if (selected.length >= allowed) return selected.slice(0, allowed);
  const primary = QUICK_BUILD_PRIMARY_ABILITY[draft.class.name];
  const abilitySkills = (await loadSkills()).filter(s => s.ability === primary).map(s => s.name);
  pushWithin(selected, abilitySkills, allowed - selected.length);
  pushWithin(selected, ALL_SKILL_NAMES, allowed - selected.length);
  return selected.slice(0, allowed);
}

async function buildSkills(draft) {
  const allFeats = await loadFeatData(draft.rules);
  const [limits, preSelected] = await Promise.all([
    getSkillLimits(draft, allFeats),
    getPreSelectedSkills(draft, allFeats),
  ]);
  const selected = [...new Set(preSelected)];
  for (const source of limits.skillChoiceSources || []) {
    pushWithin(selected, source.skills, source.count || 0);
  }
  draft.skillProficiencies = await topUpSkills(selected, draft);
  const expertise = await getExpertiseLimits({ ...draft, skillProficiencies: draft.skillProficiencies }, allFeats);
  if (expertise.allowed && expertise.count > 0) {
    const restricted = (expertise.classExpertiseSkillLists || []).flat();
    const primary = QUICK_BUILD_PRIMARY_ABILITY[draft.class.name];
    const abilitySkills = (await loadSkills()).filter(s => s.ability === primary).map(s => s.name);
    let candidates = draft.skillProficiencies.slice();
    if (restricted.length > 0) {
      candidates = candidates.filter(s => restricted.includes(s));
    }
    candidates.sort((a, b) => abilitySkills.indexOf(b) - abilitySkills.indexOf(a));
    draft.expertSkills = candidates.slice(0, expertise.count);
  } else {
    draft.expertSkills = [];
  }
}

// ————— Tools —————

function isToolLikeToken(token) {
  return /\b(Tools|Kit|Vehicles|Instruments?)\b/i.test(token) && !/^choose/i.test(token);
}

async function buildTools(draft) {
  const { categoryLimits, preSelected } = await getToolLimitsByCategory(draft);
  const tools = [...new Set(preSelected)];
  for (const category of [...categoryLimits.keys()].sort()) {
    const pool = (await getToolsByCategory(category)).map(t => t.name);
    pushWithin(tools, pool, categoryLimits.get(category) || 0);
  }
  if (draft.rules === '5e') {
    // 5e grants tools as plain names inside starting_proficiencies (the tool
    // step has no limit logic there — validateTools is a 2024-only lane).
    const [classData, raceData] = await Promise.all([
      fetchClassData(draft.class.name, '5e'),
      fetchRaceData(draft.race.name, '5e'),
    ]);
    const tokens = [...(classData?.starting_proficiencies || []), ...(raceData?.starting_proficiencies || [])];
    pushWithin(tools, tokens.filter(isToolLikeToken), tokens.length);
  }
  draft.toolProficiencies = tools;
}

// ————— Languages —————

async function loadLanguagePool() {
  try {
    const response = await fetch('/data/languages.json');
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('[quickBuildService] Failed to load languages.json:', error);
    return [];
  }
}

async function buildLanguages(draft) {
  const limits = await getLanguageLimits(draft);
  const languages = [...new Set(limits.preSelected || [])];
  const allowed = typeof limits.allowed === 'number' ? limits.allowed : languages.length;
  if (languages.length < allowed) {
    const raceData = await fetchRaceData(draft.race.name, draft.rules);
    const options = raceData?.language_options?.from || [];
    pushWithin(languages, options, allowed - languages.length);
    pushWithin(languages, await loadLanguagePool(), allowed - languages.length);
  }
  draft.languages = languages.slice(0, allowed);
}

// ————— Fighting styles —————

async function buildFightingStyles(draft) {
  const limits = await getFightingStyleLimits(draft);
  const allowed = limits.allowed || 0;
  const styles = [...new Set(limits.preSelected || [])];
  if (styles.length >= allowed) {
    draft.class.fightingStyles = styles.slice(0, allowed);
    return;
  }
  const knownNames = (await loadFightingStyles())
    .map(s => (typeof s === 'object' ? s.name : s))
    .filter(Boolean);
  pushWithin(styles, QUICK_BUILD_FIGHTING_STYLE_PRIORITY.filter(n => knownNames.includes(n)), allowed - styles.length);
  draft.class.fightingStyles = styles;
}

// ————— Spells —————

function highestSlotLevel(limits) {
  for (let level = 9; level >= 1; level -= 1) {
    if ((limits[`level${level}`] || 0) > 0) return level;
  }
  return 0;
}

function compareSpells(a, b) {
  return (a.level - b.level) || a.name.localeCompare(b.name);
}

// How many cantrips/leveled spells the draft should prefill; null when the
// class row carries no level-1 spellcasting to fill (5e Paladin/Ranger rows,
// non-casters that only reach the step via feat grants).
function spellFillCounts(limits) {
  const cantrip = limits.cantrip || 0;
  const maxSlot = highestSlotLevel(limits);
  const spells = limits.spellType === 'prepared'
    ? (limits.preparedSpells || 0)
    : (limits.level1 || 0);
  if (cantrip === 0 && (maxSlot === 0 || spells === 0)) return null;
  return { cantrip, maxSlot, spells };
}

async function buildSpells(draft) {
  const limits = await getSpellLimits({
    className: draft.class.name,
    level: parseInt(draft.level, 10) || 1,
    version: draft.rules,
    majorName: draft.class.subclass?.name || draft.class.major?.name || null,
    extraOptions: {
      divineOrder: draft.class.divineOrder || null,
      primalOrder: draft.class.primalOrder || null,
    },
    abilityScores: draft.abilities,
  });
  const counts = limits.isNonSpellcaster ? null : spellFillCounts(limits);
  if (!counts) {
    draft.spells = [];
    return;
  }
  const pool = (await loadSpells(draft.rules)).filter(s => (s.classes || []).includes(draft.class.name));
  const cantrips = pool.filter(s => (s.level ?? 0) === 0).sort((a, b) => a.name.localeCompare(b.name));
  const leveled = pool.filter(s => s.level > 0 && s.level <= counts.maxSlot).sort(compareSpells);
  draft.spells = [
    ...cantrips.slice(0, counts.cantrip).map(s => s.name),
    ...leveled.slice(0, counts.spells).map(s => s.name),
  ];
}

// ————— Feats & resistances —————

async function buildFeatsAndResistances(draft) {
  // Level-1 feats: only the 2024 background-granted origin feat is required;
  // 5e has no level-1 feat pick. Magic items / special actions stay empty.
  draft.feats = draft.rules === '2024' ? await getPreSelectedFeats(draft) : [];
  draft.magicInitiateInstances = [];
  const { resistances, immunities } = await getPreSelectedResistances(draft);
  draft.resistances = resistances;
  draft.immunities = immunities;
  draft.specialActions = draft.specialActions || [];
}

// ————— Inventory —————

function averageOfWealthDice(wealthStr) {
  const match = (wealthStr || '').match(/(\d+)\s*d\s*(\d+)\s*(?:[x×]\s*(\d+))?/i);
  if (!match) return 10;
  const [, count, die, mult] = match;
  const avg = (parseInt(count, 10) * (parseInt(die, 10) + 1)) / 2;
  return Math.round(avg * (mult ? parseInt(mult, 10) : 1));
}

function normalizeEquipmentToken(rawToken) {
  let token = rawToken
    .replace(/\bof your choice\b/gi, '')
    .replace(/\bchosen for the tool proficiency above\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.]$/, '');
  const parenMatch = token.match(/^(?:.*\bFocus|Book)\s*\(([^)]+)\)$/i);
  if (parenMatch && /^Druidic Focus|Arcane Focus/i.test(token)) {
    const inner = parenMatch[1].trim();
    token = inner.charAt(0).toUpperCase() + inner.slice(1);
  } else if (/^Book\b/i.test(token)) {
    token = 'Book';
  } else if (/\bor\b/i.test(token)) {
    token = token.split(/\s+or\s+/i)[0].trim();
  }
  return QUICK_BUILD_EQUIPMENT_NAME_FIXES[token] || token;
}

async function resolveEquipmentEntry(token, equipment) {
  const exact = equipment.find(e => e.name.toLowerCase() === token.toLowerCase());
  if (exact) return exact;
  const singular = token.replace(/s$/, '');
  return equipment.find(e => e.name.toLowerCase() === singular.toLowerCase()) || null;
}

function splitEquippedBackpack(tokens, equipment) {
  const equipped = [];
  const backpack = [];
  tokens.forEach(token => {
    const entry = equipment.find(e => e.name.toLowerCase() === token.toLowerCase());
    const isWorn = entry && (entry.equipment_category === 'Weapon' || entry.equipment_category === 'Armor');
    (isWorn ? equipped : backpack).push(token);
  });
  return { equipped, backpack };
}

async function buildInventory2024(draft, equipment) {
  const classData = await fetchClassData(draft.class.name, '2024');
  const text = classData?.starting_equipment;
  if (!text) {
    console.error(`[quickBuildService] 2024 class ${draft.class.name} has no starting_equipment on disk — leaving inventory empty`);
    return { backpack: [], equipped: [], gold: draft.inventory?.gold ?? 10, magicItems: [], itemMeta: {} };
  }
  const optionA = text.match(/\(A\)(.*?)(?:;\s*)?(?:or\s+)?\(B\)/i);
  const body = (optionA ? optionA[1] : text).trim();
  const goldMatch = body.match(/(?:and\s+)?(\d+)\s*GP\)?\s*$/i);
  const gold = goldMatch ? parseInt(goldMatch[1], 10) : 10;
  const itemsText = goldMatch ? body.slice(0, goldMatch.index) : body;
  const quantityByToken = {};
  const tokens = itemsText.split(',').map(t => t.trim()).filter(Boolean).map(t => {
    const qtyMatch = t.match(/^(\d+)\s+(.*)$/);
    const token = normalizeEquipmentToken(qtyMatch ? qtyMatch[2] : t);
    quantityByToken[token] = Math.max(quantityByToken[token] || 1, qtyMatch ? parseInt(qtyMatch[1], 10) : 1);
    return token;
  });
  const resolved = await Promise.all(tokens.map(async t => (await resolveEquipmentEntry(t, equipment))?.name || t));
  const uniqueTokens = [...new Set(resolved)];
  const { equipped, backpack } = splitEquippedBackpack(uniqueTokens, equipment);
  const itemMeta = {};
  uniqueTokens.forEach(name => {
    if (quantityByToken[name] > 1) {
      itemMeta[name] = { quantity: quantityByToken[name], description: '' };
    }
  });
  return { backpack, equipped, gold, magicItems: [], itemMeta };
}

function buildInventory5e(draft) {
  const authored = QUICK_BUILD_STARTING_EQUIPMENT_5E[draft.class.name];
  if (!authored) {
    console.error(`[quickBuildService] No 5e equipment default for ${draft.class.name} — leaving inventory empty`);
    return { backpack: [], equipped: [], gold: 10, magicItems: [], itemMeta: {} };
  }
  const itemMeta = {};
  const toNames = (list) => list.map(({ name, quantity }) => {
    if (quantity > 1) itemMeta[name] = { quantity, description: '' };
    return name;
  });
  return {
    backpack: toNames(authored.backpack),
    equipped: toNames(authored.equipped),
    gold: 10, // refined by the caller from starting_wealth
    magicItems: [],
    itemMeta,
  };
}

async function buildInventory(draft) {
  const equipment = await loadEquipment();
  const inventory = draft.rules === '2024'
    ? await buildInventory2024(draft, equipment)
    : buildInventory5e(draft);
  if (draft.rules === '5e') {
    const classData = await fetchClassData(draft.class.name, '5e');
    inventory.gold = averageOfWealthDice(classData?.starting_wealth);
  }
  draft.inventory = inventory;
}

// ————— Subclass —————

async function applySubclassDefault(draft) {
  if (draft.class.subclass?.name) return;
  const classData = await fetchClassData(draft.class.name, draft.rules);
  const options = classData?.subclasses || classData?.majors || [];
  if (options.length > 0) {
    draft.class.subclass = { ...draft.class.subclass, name: options[0].name };
  }
}

// ————— Entry point —————

/**
 * Build the complete quick-build formData draft from a formData whose
 * ruleset/race/class choices are already made. Pure: returns a NEW object;
 * the wizard merges nothing back by itself.
 */
export async function generateQuickBuildDraft(formData) {
  const ruleset = formData?.rules || '5e';
  if (!formData?.race?.name || !formData?.class?.name) {
    console.error('[quickBuildService] Quick build needs both a race and a class — returning draft unchanged');
    return cloneDeep(formData);
  }
  const draft = cloneDeep(formData);
  draft.rules = ruleset;
  draft.level = parseInt(draft.level, 10) || 1;
  if (ruleset === '2024' && !draft.background) {
    // Fill only an empty background (e.g. the user jumped straight to the
    // draft step). A prefill the user already reviewed on the Background step
    // is honoured verbatim — never silently re-derived — and both lanes run
    // through deriveQuickBackground, so a class-less prefill and a fresh
    // fill of the same form can never diverge.
    draft.background = deriveQuickBackground({ ruleset, className: draft.class.name });
  }
  await applySubclassDefault(draft);
  await buildAbilities(draft);
  await buildSkills(draft);
  await buildTools(draft);
  await buildLanguages(draft);
  await buildFightingStyles(draft);
  await buildSpells(draft);
  await buildFeatsAndResistances(draft);
  await buildInventory(draft);
  return draft;
}
