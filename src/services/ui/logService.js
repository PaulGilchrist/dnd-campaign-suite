const BASE_URL = '/api/campaigns';

// ── POST-lane audit text (bug-log-schema-gate-rejects-app-own-combat-rows) ──
// The server POST gate (server/routes/log.js, owner ruling 2026-11-20) refuses any
// row that carries no non-empty human-readable text in one of the canonical fields
// — the forgery defense that keeps a hand-POSTed {type:'hp_change',threshold:'dead'}
// from faking a death cue table-wide. The app's OWN structured producers (roll
// attack/damage rows, hp_change, death_save, condition legs, the quick-spawn join
// row, …) render from their structured fields via the Log view's ENTRY_COMPONENTS
// and never wrote prose, so the textless gate silently 400'd every real combat
// audit trail. This lane is the ONE POST funnel every client producer shares, so
// the lane stamps a plain-English audit `message` derived from the row's own
// structured bytes when it carries no canonical text. Entries that already carry
// readable text pass through byte-identically; a forged hand-crafted POST never
// runs this code and still 400s at the gate.
//
// LOG_TEXT_FIELDS mirrors the server gate's canonical list verbatim
// (server/routes/log.js). Per-type phrasing mirrors the family voice of the
// matching Log renderers (LogRollEntry badges HIT/MISS/Critical Hit!,
// LogHpHealingEntry 'Defeated/Bloodied', LogDeathSaveEntry 'Stabilized!/Has
// Perished!', LogEncounterEntry/LogConditionEntry presentation maps).

const LOG_TEXT_FIELDS = ['message', 'description', 'noteText', 'summary', 'text'];

function hasReadableText(entry) {
  return LOG_TEXT_FIELDS.some(
    (field) => typeof entry[field] === 'string' && entry[field].trim().length > 0
  );
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function rollOutcome(entry) {
  if (entry.isNatural1) return 'Critical Miss!';
  if (entry.isCrit) return 'Critical Hit!';
  if (entry.isAutoMiss) return 'AUTO-MISS';
  if (entry.hit === true) return 'HIT';
  if (entry.hit === false) return 'MISS';
  return null;
}

function saveOutcomeLabel(saveResult) {
  if (saveResult === 'success') return 'SUCCESS';
  if (saveResult === 'failure') return 'FAILURE';
  return String(saveResult);
}

const DAMAGE_ROLL_TYPES = ['damage', 'save-damage', 'aoe-damage', 'overchannel-damage', 'graze-damage'];

// Roll-type branches hoisted to small helpers (complexity budget, mirroring the
// hoisted spread helpers in useLoggedDiceRollAttack.js).
function describeAttackRoll(entry) {
  const who = entry.characterName || 'The roll';
  let line = `${who} attacks${entry.targetName ? ` ${entry.targetName}` : ''}`
    + ` with ${entry.name || 'an attack'}: ${entry.total ?? '?'}`;
  if (entry.bonus != null) line += ` ${signed(entry.bonus)}`;
  if (entry.bonusDetail) line += ` ${entry.bonusDetail}`;
  if (entry.targetAc != null) line += ` vs AC ${entry.targetAc}`;
  const outcome = rollOutcome(entry);
  if (outcome) line += ` — ${outcome}`;
  return line;
}

function describeDamageRoll(entry) {
  const who = entry.characterName || 'The roll';
  let line = `${who} rolls ${entry.name || entry.rollType} damage: ${entry.total ?? '?'}`;
  if (entry.formula) line += ` (${entry.formula})`;
  if (entry.damageType) line += ` ${entry.damageType}`;
  if (entry.finalDamage != null && entry.finalDamage !== entry.total) {
    line += ` → ${entry.finalDamage} final`;
  }
  return line;
}

function describeInitiativeRoll(entry) {
  const who = entry.characterName || 'The roll';
  let line = `${who} rolls initiative: ${entry.total ?? '?'}`;
  if (entry.bonus != null) line += ` (${signed(entry.bonus)})`;
  return line;
}

function describeSaveRoll(entry) {
  const who = entry.characterName || 'The roll';
  let line = `${who} makes the ${entry.saveType ? `${String(entry.saveType).toUpperCase()} ` : ''}saving throw`;
  if (entry.name) line += ` against ${entry.name}`;
  if (entry.total != null) {
    line += `: ${entry.total}${entry.bonus != null ? ` ${signed(entry.bonus)}` : ''}`;
  }
  if (entry.saveDc != null) line += ` vs DC ${entry.saveDc}`;
  if (entry.saveResult) line += ` — ${saveOutcomeLabel(entry.saveResult)}`;
  return line;
}

function describeOtherRoll(entry) {
  const who = entry.characterName || 'The roll';
  if (!entry.name && !entry.rollType) return describeGeneric(entry);
  let line = `${who} rolls ${entry.name || entry.rollType}`;
  if (typeof entry.total === 'number') {
    line += `: ${entry.total}${entry.bonus != null ? ` ${signed(entry.bonus)}` : ''}`;
    if (entry.bonusDetail) line += ` ${entry.bonusDetail}`;
  }
  if (entry.saveResult) line += ` — ${saveOutcomeLabel(entry.saveResult)}`;
  return line;
}

function describeRoll(entry) {
  if (entry.rollType === 'attack') return describeAttackRoll(entry);
  if (DAMAGE_ROLL_TYPES.includes(entry.rollType)) return describeDamageRoll(entry);
  if (entry.rollType === 'initiative') return describeInitiativeRoll(entry);
  if (entry.rollType === 'save') return describeSaveRoll(entry);
  return describeOtherRoll(entry);
}

function hpThresholdClause(entry) {
  if (entry.threshold === 'dead') return entry.isPlayer ? ' — falls unconscious' : ' — Defeated';
  if (entry.threshold === 'bloodied') return ' — Bloodied';
  if (entry.threshold === 'recovering') return ' — Recovering';
  if (entry.isUnconscious) return ' — Knocked Unconscious';
  return '';
}

function describeHpChange(entry) {
  const who = entry.targetName || 'A creature';
  const hp = (typeof entry.currentHp === 'number' && typeof entry.maxHp === 'number')
    ? ` (${entry.currentHp}/${entry.maxHp} HP)` : '';
  if (typeof entry.delta === 'number' && entry.delta < 0) {
    let line = `${who} takes ${-entry.delta} damage`;
    if (entry.sourceName) line += ` from ${entry.sourceName}`;
    return line + hp + hpThresholdClause(entry);
  }
  if (typeof entry.delta === 'number' && entry.delta > 0) {
    return entry.isTempHp
      ? `${who} gains ${entry.delta} temporary HP${hp}`
      : `${who} heals ${entry.delta} HP${hp}`;
  }
  if (typeof entry.delta === 'number') return `${who}: no HP change${hp}`;
  return `${who} — HP change`;
}

function describeDeathSave(entry) {
  const who = entry.characterName || 'A creature';
  const tally = (typeof entry.totalSuccesses === 'number' || typeof entry.totalFailures === 'number')
    ? ` (${entry.totalSuccesses ?? 0} successes, ${entry.totalFailures ?? 0} failures)` : '';
  if (entry.result === 'stable') return `${who} is Stabilized — three death save successes${tally}`;
  if (entry.result === 'dead') return `${who} Has Perished — three death save failures${tally}`;
  if (entry.result === 'removed') return `${who}: Dying Condition Removed`;
  if (entry.roll != null) {
    if (entry.isNatural20) return `${who} rolls a Natural 20 death save — Stabilized!${tally}`;
    if (entry.isNatural1) return `${who} rolls a Natural 1 death save — Double Failure${tally}`;
    if (entry.success === true) return `${who} makes a Death Save Success (rolled ${entry.roll})${tally}`;
    if (entry.success === false) return `${who} makes a Death Save Failure (rolled ${entry.roll})${tally}`;
    return `${who} rolls a death save: ${entry.roll}${tally}`;
  }
  return `${who} — death save update${tally}`;
}

const ENCOUNTER_ACTION_LABELS = {
  started: 'Encounter Started',
  joined: 'Encounter Joined',
  completed: 'Encounter Completed',
  loot_awarded: 'Loot Awarded',
};

function describeEncounter(entry) {
  const label = ENCOUNTER_ACTION_LABELS[entry.action] || 'Encounter Update';
  const roster = Array.isArray(entry.monsters) && entry.monsters.length > 0
    ? `: ${entry.monsters.join(', ')}` : '';
  return `${label}${entry.encounterName ? ` — ${entry.encounterName}` : ''}${roster}`;
}

const CONDITION_ACTION_LABELS = {
  applied: 'Condition Applied',
  'target-effect-applied': 'Effect Applied',
  'concentration-started': 'Concentration Started',
  kept: 'Condition Maintained',
  maintained: 'Condition Maintained',
  broken: 'Condition Broken',
  removed: 'Condition Broken',
  ended: 'Condition Ended',
  turn_start_behavior: 'Condition Behavior',
};

function describeCondition(entry) {
  const label = CONDITION_ACTION_LABELS[entry.action] || 'Condition Update';
  let line = `${label}${entry.characterName ? ` for ${entry.characterName}` : ''}`;
  if (entry.condition) line += ` — ${entry.condition}`;
  if (typeof entry.dc === 'number') line += ` (DC ${entry.dc})`;
  return line;
}

// Last-resort sentence for every other structured type: the type label is always
// non-empty (the gate requires a non-empty string `type` upstream), so no producer
// row can ever be text-rejected again.
function describeGeneric(entry) {
  // Word-per-word capitalization mirrors formatEntryTypeLabel (log view facets):
  // 'hp_change' -> 'Hp Change', 'note' -> 'Note', 'ai_dress' -> 'Ai Dress'.
  const label = String(entry.type ?? 'log')
    .split(/[_\s]+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const who = entry.characterName || entry.targetName || entry.attackerName || entry.sourceName;
  const what = entry.name || entry.abilityName || entry.spellName || entry.condition || entry.formula;
  let line = who ? `${who} — ${label}` : label;
  if (what && what !== who) line += `: ${what}`;
  if (typeof entry.total === 'number') line += ` (${entry.total})`;
  return line;
}

export function deriveAuditText(entry) {
  switch (entry.type) {
    case 'roll': return describeRoll(entry);
    case 'hp_change': return describeHpChange(entry);
    case 'death_save': return describeDeathSave(entry);
    case 'encounter': return describeEncounter(entry);
    case 'condition': return describeCondition(entry);
    default: return describeGeneric(entry);
  }
}

// Returns the entry verbatim when it already carries canonical readable text;
// otherwise a copy with a derived plain-English `message` stamped on. Never
// mutates the caller's object.
export function stampAuditText(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  if (hasReadableText(entry)) return entry;
  return { ...entry, message: deriveAuditText(entry) };
}

export async function getLog(campaignName) {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/log`);
   if (!response.ok) throw new Error('Failed to fetch log');
   return response.json();
}

export async function addEntry(campaignName, entry) {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stampAuditText(entry))
   });
   if (!response.ok) throw new Error('Failed to add log entry');
    return response.json();
}
