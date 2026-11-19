// @maintained-by-ai
/**
 * Ruleset-switch keep/drop preview (roadmap Item 2 — ruleset-switch data-loss guard).
 *
 * Pure classification over the ruleset-switch seam in CharacterCreationWizard:
 * before `handleRulesetChange` wipes spells/feats/background, this service
 * classifies every current choice against the TARGET ruleset's real data files
 * (spells.json / feats.json / classes.json / backgrounds.json for the target
 * version — never a hardcoded list) so the confirm modal can be byte-honest
 * about what is kept vs dropped.
 *
 * Keep policy (best-effort prefill, plan Item 2):
 *  - Spell: name found in the target spells.json AND its `classes` array still
 *    lists the character's class.
 *  - Feat: name found in the target feats.json AND every prerequisite the
 *    target data expresses stays met by the current draft (level, ability
 *    minimums, Fighting Style, Spellcasting/Pact Magic, armor training).
 *    A prerequisite the data cannot express as checkable is classified
 *    honestly as UNVERIFIABLE → dropped — we never guess keep.
 *  - Background: step 5 is 2024-only in this app, so switching TO 5e always
 *    drops it; switching to 2024 keeps it only if it exists by name there.
 *
 * All legality is derived from the JSON rows themselves; see
 * rulesetSwitchPreview.test.js for the classification matrix (synthetic
 * fixtures + the real public/data files).
 */

import {
  loadSpells,
  loadFeatData,
  loadClassData,
  loadBackgroundData,
} from '../ui/dataLoader.js';

export const RULESET_LABELS = {
  '5e': '5th Edition (5e)',
  '2024': '2024 Rules',
};

export const DROP_REASONS = {
  MISSING: 'missing',
  NOT_ON_CLASS_LIST: 'not-on-class-list',
  PREREQUISITE: 'prerequisite',
  PREREQUISITE_UNVERIFIABLE: 'prerequisite-unverifiable',
  RULESET_UNSUPPORTED: 'ruleset-unsupported',
};

// Visible list cap for modal copy — beyond it rows collapse to "(+N more)".
export const NAME_LIST_VISIBLE_CAP = 6;

/** Normalized display name of a selected row (strings or { name } objects). */
export function entryNameOf(entry) {
  return typeof entry === 'string' ? entry : (entry?.name || '');
}

/** Cap a name list for modal copy: "A, B (+N more)". */
export function formatNameList(names, cap = NAME_LIST_VISIBLE_CAP) {
  const list = names || [];
  const visible = list.slice(0, cap);
  const overflow = list.length - visible.length;
  return visible.join(', ') + (overflow > 0 ? ` (+${overflow} more)` : '');
}

function findByName(list, name) {
  return (list || []).find(item => item.name === name || item.index === name) || null;
}

function characterLevelOf(formData) {
  const level = parseInt(formData?.level, 10);
  return Number.isFinite(level) ? level : 1;
}

function abilityTotal(formData, abilityName) {
  const row = (formData?.abilities || []).find(a => a?.name === abilityName);
  if (!row) return null;
  return (row.baseScore || 0)
    + (row.featIncrease || 0)
    + (row.backgroundIncrease || 0)
    + (row.miscIncrease || 0);
}

function subclassNameOf(formData) {
  return formData?.class?.subclass?.name || formData?.class?.major?.name || '';
}

function hasChosenFightingStyle(formData) {
  return (formData?.class?.fightingStyles?.length || 0) > 0
    || (formData?.fightingStyles?.length || 0) > 0;
}

/**
 * Does the TARGET class grant spellcasting at the character's level?
 * Returns true / false, or null when the class row itself is absent from the
 * target data (→ unverifiable, never a guessed keep).
 * `required_major` rows (e.g. Arcane Trickster) only count when the
 * character's chosen subclass matches.
 */
function classHasSpellcasting(targetClasses, className, charLevel, subclassName) {
  const classData = findByName(targetClasses, className);
  if (!classData || !Array.isArray(classData.class_levels)) return null;
  const atOrBelow = classData.class_levels.filter(entry => (entry.level || 0) <= charLevel);
  return atOrBelow.some(entry => {
    const sc = entry.spellcasting;
    if (!sc) return false;
    if (sc.required_major && sc.required_major !== subclassName) return false;
    if ((sc.cantrips_known || 0) > 0) return true;
    if ((sc.prepared_spells || 0) > 0) return true;
    return Object.keys(sc).some(key => key.startsWith('spell_slots') && (sc[key] || 0) > 0);
  });
}

/** 2024 `prerequisites.armor_training` value → keyword sought in the class row. */
const ARMOR_TRAINING_KEYWORDS = {
  'Light Armor Training': 'light',
  'Medium Armor Training': 'medium',
  'Heavy Armor Training': 'heavy',
  'Shield Training': 'shield',
};

// ---------------------------------------------------------------------------
// Prerequisite evaluation. Each evaluator returns
//   { status: 'met' | 'unmet' | 'unverifiable', detail: string }
// ---------------------------------------------------------------------------

function evaluateAbilityMin(label, names, minimum, formData) {
  const totals = names.map(name => ({ name, total: abilityTotal(formData, name) }));
  if (totals.some(({ total }) => total === null)) {
    return { status: 'unverifiable', detail: `ability ${names.join(' or ')} is not on the character sheet` };
  }
  if (totals.some(({ total }) => total >= minimum)) {
    return { status: 'met', detail: '' };
  }
  const actual = totals.map(({ name, total }) => `your ${name} is ${total}`).join(', ');
  return { status: 'unmet', detail: `${label} ${minimum} or higher (${actual})` };
}

function evaluateSpellcasting(targetClasses, ctx, label) {
  const verdict = classHasSpellcasting(targetClasses, ctx.className, ctx.charLevel, ctx.subclassName);
  if (verdict === null) {
    return { status: 'unverifiable', detail: `${ctx.className} was not found in the target class data` };
  }
  if (verdict) return { status: 'met', detail: '' };
  return { status: 'unmet', detail: `${label} (the ${ctx.className} has no spellcasting at level ${ctx.charLevel} here)` };
}

/** 2024 `ability_scores` groups list alternatives (Str OR Dex) — met if one meets its minimum. */
function evaluateAbilityScoresGroup(entries, formData) {
  const names = entries.map(a => a.name);
  const minimum = Math.min(...entries.map(a => a.minimum));
  return evaluateAbilityMin(`requires ${names.join(' or ')}`, names, minimum, formData);
}

/** 2024 structured prerequisites: { level, ability_scores, feature, armor_training }. */
function evaluate2024Prerequisites(prerequisites, formData, targetClasses, ctx) {
  const results = [];

  if (typeof prerequisites.level === 'number') {
    results.push(ctx.charLevel >= prerequisites.level
      ? { status: 'met', detail: '' }
      : { status: 'unmet', detail: `requires ${ordinal(prerequisites.level)} level (the character is ${ordinal(ctx.charLevel)})` });
  }

  if (Array.isArray(prerequisites.ability_scores) && prerequisites.ability_scores.length > 0) {
    results.push(evaluateAbilityScoresGroup(prerequisites.ability_scores, formData));
  }

  if (prerequisites.feature) {
    const feature = prerequisites.feature;
    if (feature === 'Fighting Style') {
      results.push(hasChosenFightingStyle(formData)
        ? { status: 'met', detail: '' }
        : { status: 'unmet', detail: 'requires a Fighting Style (none chosen)' });
    } else if (feature === 'Spellcasting or Pact Magic') {
      results.push(evaluateSpellcasting(targetClasses, ctx, 'requires Spellcasting or Pact Magic'));
    } else {
      results.push({ status: 'unverifiable', detail: `feature prerequisite "${feature}" is not expressible in the wizard data` });
    }
  }

  if (prerequisites.armor_training) {
    results.push(evaluateArmorTraining(prerequisites.armor_training, targetClasses, ctx));
  }

  return results;
}

/** 2024 armor_training prereq: met via the class row or an exactly-named held feat. */
function evaluateArmorTraining(training, targetClasses, ctx) {
  const keyword = ARMOR_TRAINING_KEYWORDS[training];
  const classRow = findByName(targetClasses, ctx.className);
  const fromClass = Boolean(keyword && classRow?.armor_training
    && classRow.armor_training.toLowerCase().includes(keyword));
  const fromFeats = ctx.selectedFeatNames.includes(training);
  if (fromClass || fromFeats) {
    return { status: 'met', detail: '' };
  }
  if (!classRow) {
    return { status: 'unverifiable', detail: `${ctx.className} was not found in the target class data` };
  }
  // A race trait or another feat can grant training outside the class row, so
  // an unconfirmed keyword is never reported as a hard miss.
  return { status: 'unverifiable', detail: `requires ${training}, which the target class data does not grant (a race or feat might — not checkable)` };
}

const ABILITY_NAME_RE = '(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)';
const ABILITY_PREREQ_RE = new RegExp(`^${ABILITY_NAME_RE}(?: or ${ABILITY_NAME_RE})? (\\d+) or higher$`, 'i');
const CAST_AT_LEAST_ONE_RE = /^the ability to cast at least one spell$/i;
const ARMOR_PROF_RE = /^proficiency with (.+)$/i;

/** 5e free-text `prerequisite` strings, machine-checked where the grammar allows. */
function evaluate5ePrerequisite(prerequisite, formData, targetClasses, ctx) {
  const text = String(prerequisite || '').trim();
  const abilityMatch = text.match(ABILITY_PREREQ_RE);
  if (abilityMatch) {
    const names = [abilityMatch[1], abilityMatch[2]].filter(Boolean);
    return evaluateAbilityMin(`requires ${names.join(' or ')}`, names, parseInt(abilityMatch[3], 10), formData);
  }
  if (CAST_AT_LEAST_ONE_RE.test(text)) {
    return evaluateSpellcasting(targetClasses, ctx, 'requires the ability to cast at least one spell');
  }
  const armorMatch = text.match(ARMOR_PROF_RE);
  if (armorMatch) {
    const wanted = armorMatch[1].trim();
    const classRow = findByName(targetClasses, ctx.className);
    const profs = Array.isArray(classRow?.proficiencies) ? classRow.proficiencies : null;
    if (!profs) {
      return { status: 'unverifiable', detail: `requires ${wanted} proficiency, not checkable from the target class data` };
    }
    const covered = profs.some(prof => {
      const p = String(prof).toLowerCase();
      return p === wanted.toLowerCase()
        || (p === 'all armor' && /armor/.test(wanted.toLowerCase()));
    });
    if (covered) return { status: 'met', detail: '' };
    // A race or feat can grant armor proficiency outside the class row.
    return { status: 'unverifiable', detail: `requires ${wanted} proficiency, which the target ${ctx.className} class row does not list (a race or feat might grant it — not checkable)` };
  }
  return { status: 'unverifiable', detail: `prerequisite "${text}" is not expressible in the wizard data` };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------------------
// Row classifiers
// ---------------------------------------------------------------------------

function classifySpells(formData, targetRuleset, targetSpells) {
  const label = RULESET_LABELS[targetRuleset];
  const rows = (formData?.spells || []).map(entryNameOf).filter(Boolean);
  const className = formData?.class?.name;
  const kept = [];
  const dropped = [];

  rows.forEach(name => {
    const spell = findByName(targetSpells, name);
    if (!spell) {
      dropped.push({ name, reason: DROP_REASONS.MISSING, detail: `not in the ${label} spell data` });
      return;
    }
    if (!className) {
      dropped.push({ name, reason: DROP_REASONS.PREREQUISITE_UNVERIFIABLE, detail: 'no class chosen to check the spell list against' });
      return;
    }
    if (Array.isArray(spell.classes) && spell.classes.includes(className)) {
      kept.push(name);
    } else if (Array.isArray(spell.classes)) {
      dropped.push({ name, reason: DROP_REASONS.NOT_ON_CLASS_LIST, detail: `not on the ${className} ${label} spell list` });
    } else {
      dropped.push({ name, reason: DROP_REASONS.PREREQUISITE_UNVERIFIABLE, detail: `${label} spell data carries no class list to verify against` });
    }
  });

  return { selected: rows, kept, dropped };
}

function classifyFeats(formData, targetRuleset, targetFeats, targetClasses, ctx) {
  const label = RULESET_LABELS[targetRuleset];
  const rows = (formData?.feats || []).map(entryNameOf).filter(Boolean);
  const kept = [];
  const dropped = [];

  rows.forEach(name => {
    const feat = findByName(targetFeats, name);
    if (!feat) {
      dropped.push({ name, reason: DROP_REASONS.MISSING, detail: `not in the ${label} feat data` });
      return;
    }
    // 2024 data carries structured `prerequisites`; 5e carries a free-text
    // `prerequisite` string; both absent means the data asserts no condition.
    const results = [];
    if (feat.prerequisites && typeof feat.prerequisites === 'object') {
      results.push(...evaluate2024Prerequisites(feat.prerequisites, formData, targetClasses, ctx));
    }
    if (typeof feat.prerequisite === 'string' && feat.prerequisite.trim()) {
      results.push(evaluate5ePrerequisite(feat.prerequisite, formData, targetClasses, ctx));
    }

    const unverifiable = results.find(r => r.status === 'unverifiable');
    const unmet = results.find(r => r.status === 'unmet');
    if (unverifiable) {
      dropped.push({ name, reason: DROP_REASONS.PREREQUISITE_UNVERIFIABLE, detail: unverifiable.detail });
    } else if (unmet) {
      dropped.push({ name, reason: DROP_REASONS.PREREQUISITE, detail: unmet.detail });
    } else {
      kept.push(name);
    }
  });

  return { selected: rows, kept, dropped };
}

function classifyBackground(formData, targetRuleset, targetBackgrounds) {
  const name = formData?.background || '';
  const selected = name ? [name] : [];
  if (!name) return { selected, kept: null, dropped: [] };
  if (targetRuleset !== '2024') {
    return {
      selected,
      kept: null,
      dropped: [{
        name,
        reason: DROP_REASONS.RULESET_UNSUPPORTED,
        detail: 'the Background step only exists under 2024 Rules',
      }],
    };
  }
  const found = findByName(targetBackgrounds, name);
  return found
    ? { selected, kept: name, dropped: [] }
    : { selected, kept: null, dropped: [{ name, reason: DROP_REASONS.MISSING, detail: `not in the ${RULESET_LABELS['2024']} background data` }] };
}

/**
 * Pure classification entry point. All target-ruleset data is passed in, so
 * this is testable without any network lane; the callers load it via
 * buildRulesetSwitchPreview.
 */
export function classifyRulesetSwitch({
  formData,
  targetRuleset,
  targetSpells = [],
  targetFeats = [],
  targetClasses = [],
  targetBackgrounds = [],
}) {
  const ctx = {
    charLevel: characterLevelOf(formData),
    className: formData?.class?.name || '',
    subclassName: subclassNameOf(formData),
    selectedFeatNames: (formData?.feats || []).map(entryNameOf).filter(Boolean),
  };

  const spells = classifySpells(formData, targetRuleset, targetSpells);
  const feats = classifyFeats(formData, targetRuleset, targetFeats, targetClasses, ctx);
  const background = classifyBackground(formData, targetRuleset, targetBackgrounds);

  const droppedRows = [...spells.dropped, ...feats.dropped, ...background.dropped];
  const keptCount = spells.kept.length + feats.kept.length + (background.kept ? 1 : 0);
  const hasSelections = spells.selected.length > 0 || feats.selected.length > 0 || background.selected.length > 0;

  return {
    targetRuleset,
    className: ctx.className,
    targetDataLoaded: targetClasses.length > 0,
    spells,
    feats,
    background,
    keptCount,
    droppedCount: droppedRows.length,
    hasSelections,
  };
}

/**
 * Load the TARGET ruleset's data through the shared cached loader and classify
 * every current choice against it. Resolves the same object shape as
 * classifyRulesetSwitch.
 */
export async function buildRulesetSwitchPreview(formData, targetRuleset) {
  const [targetSpells, targetFeats, targetClasses, targetBackgrounds] = await Promise.all([
    loadSpells(targetRuleset),
    loadFeatData(targetRuleset),
    loadClassData(targetRuleset),
    loadBackgroundData(targetRuleset),
  ]);
  return classifyRulesetSwitch({
    formData,
    targetRuleset,
    targetSpells,
    targetFeats,
    targetClasses,
    targetBackgrounds,
  });
}

/**
 * Pure apply step: rewrite the draft to exactly what the confirmed preview
 * promises — kept rows survive untouched (object payloads included), dropped
 * rows disappear, the rules field flips. The wizard stores ONLY this result,
 * so post-switch state can never hold a phantom selection.
 */
export function applyRulesetSwitchToFormData(formData, preview) {
  const keptSpells = new Set(preview.spells.kept);
  const keptFeats = new Set(preview.feats.kept);
  return {
    ...formData,
    rules: preview.targetRuleset,
    spells: (formData.spells || []).filter(entry => keptSpells.has(entryNameOf(entry))),
    feats: (formData.feats || []).filter(entry => keptFeats.has(entryNameOf(entry))),
    background: preview.background.kept || '',
  };
}
