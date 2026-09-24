// MA-1020: monster-side shape-shift affordance for actions[] rows authored
// automation:{type:"monster_shape_shift", effect:"shape_shift", forms:[...]}
// (Imp "Shape-Shift" — formerly a zero-affordance dead prose row). Mirrors
// the MA-0655 monsterSelfBuff / MA-0648 monsterSummon byte-shapes for the
// gate→record→popup cadence, with the MA-0275 AnimalSpiritVariantModal
// chooser chrome for the form pick (chip press → chooser → apply).
// ONE chooser-row click = gate (already-in-form refuses with zero write) →
// stamp the chosen form's Speed dict onto the combatSummary combatant via
// ONE merged full-store storage.set('combatSummary') POST (§39) → log +
// popup. Consumer proof: createNpcClickHandler → NPC_FORM_HANDLERS
// runMonster (npcClickFormHandlers.js:188 honors runtimeCreature.speed) →
// MonsterCardBody Speed row (MonsterCardBody.jsx:147) renders
// Object.entries(monster.speed) — the stamped dict is what the card shows.
// RAW: statistics same except Speed; At Will (no uses, MA-0020 gate null);
// duration "until they shift back" → NO addExpiration clock (§70 honest
// persistent self-state, GM re-click for revert). te `shape_shift` is only a
// save-modifier context key (conditionEffectsInternal.js POST_TARGET_GATE_
// CHECKS), NOT an applied targetEffect — none registered here; the cs Speed
// stamp + shapeShiftForm marker + logs are the state surface. "True Form"
// (form with no speed keys) deletes the stamped dict so runMonster restores
// the authored stat-block Speed (imp: walk 20 ft., fly 40 ft., read from
// disk into the log via loadMonsters).
import { addEntry } from '../ui/logService.js';
import { getCombatSummary } from './combatData.js';
import { loadMonsters } from '../ui/dataLoader.js';
import storage from '../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';

export function isMonsterShapeShiftRow(row) {
  return row?.automation?.type === 'monster_shape_shift'
    && Array.isArray(row.automation.forms) && row.automation.forms.length > 0;
}

export function shapeShiftForms(action) {
  return action?.automation?.forms || [];
}

// The forms payload carries integer feet (camelCase automation keys per the
// MA-0681/§233 convention). The cs stamp mirrors the stat-block Speed dict
// shape the card renderer already reads: { walk:"20 ft.", fly:"60 ft." }.
// A form with NO speed keys is the "True Form" revert entry.
export function shapeShiftSpeedDict(form) {
  if (!form || (form.speed == null && form.fly == null && form.climb == null)) return null;
  const speed = {};
  if (form.speed != null) speed.walk = `${form.speed} ft.`;
  if (form.fly != null) speed.fly = `${form.fly} ft.`;
  if (form.climb != null) speed.climb = `${form.climb} ft.`;
  return speed;
}

export function isTrueFormRequest(form) {
  return shapeShiftSpeedDict(form) == null;
}

export function shapeShiftSpeedText(form) {
  const dict = shapeShiftSpeedDict(form);
  if (!dict) return 'true-form';
  return Object.entries(dict).map(([k, v]) => `${k} ${v}`).join(', ');
}

function formSlug(name) {
  return String(name || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// The card Speed surface the log must stay honest against: MonsterCardBody
// renders monster.speed (block fallback for true form); the stamp covers the
// cs combatant, refreshed on card reopen (§21 cache family).
export function buildShapeShiftAppliedLog({ monsterName, action, form, speedText }) {
  const revert = isTrueFormRequest(form);
  return {
    type: 'automation',
    automationType: revert ? 'shape_shift_reverted' : 'shape_shift_applied',
    automationDetail: revert ? 'revert_true_form' : `form_${formSlug(form.name)}`,
    characterName: monsterName,
    abilityName: action?.name || 'Shape-Shift',
    description: revert
      ? `${monsterName} shape-shifts back to its true form — stamped Speed cleared, the card restores the stat block (${speedText}) — statistics unchanged except Speed (RAW). Persistent self-state: no expiration clock — At Will, GM re-clicks Shape-Shift to change form (§70).`
      : `${monsterName} shape-shifts into ${form.name} — Speed ${speedText} — statistics unchanged except Speed (RAW); equipment does not transform. Persistent self-state: no expiration clock — At Will, GM re-clicks Shape-Shift and picks "True Form" to revert (§70). Card Speed refreshes on card reopen.`,
    timestamp: Date.now(),
  };
}

export function buildShapeShiftRefusalLog({ monsterName, action, reason }) {
  const slug = formSlug(action?.name || 'shape_shift');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    automationDetail: reason,
    characterName: monsterName,
    abilityName: action?.name || 'Shape-Shift',
    description: `${monsterName} Shape-Shift refused — ${reason.replace(/_/g, ' ')}. Zero writes, zero spend.`,
    timestamp: Date.now(),
  };
}

export function buildShapeShiftRefusalPopup({ monsterName, form, reason }) {
  const human = reason.replace(/_/g, ' ');
  return `<div class="mc-prerequisite-refusal"><h3>Shape-Shift Refused</h3><p>${monsterName} — ${human}. No change applied${form?.name ? ` for ${form.name}` : ''}; Shape-Shift is At Will, so a re-click into a different form works any time.</p></div>`;
}

export function buildShapeShiftPopup({ monsterName, form, speedText }) {
  const revert = isTrueFormRequest(form);
  const body = revert
    ? `${monsterName} returns to its true form — the stamped Speed is cleared and the card restores its stat block (${speedText}). At Will, no uses limit; no expiration clock (RAW: persists until it shifts again — GM re-clicks Shape-Shift, §70).`
    : `${monsterName} shape-shifts into ${form.name} — Speed ${speedText} — game statistics are the same except Speed (RAW); equipment does not transform. At Will, no uses limit; no expiration clock (RAW: persists until it shifts back — pick "True Form" to revert, §70).`;
  return `<div class="mc-prerequisite-refusal"><h3>${monsterName} — ${form?.name || 'True Form'}</h3><p>${body}</p></div>`;
}

export function buildShapeShiftDeclineLog({ monsterName, action }) {
  return {
    type: 'automation',
    automationType: 'shape_shift_declined',
    automationDetail: 'chooser_cancelled',
    characterName: monsterName,
    abilityName: action?.name || 'Shape-Shift',
    description: `${monsterName} Shape-Shift chooser cancelled — no form chosen, no Speed change, zero spend.`,
    timestamp: Date.now(),
  };
}

// True-form restore text is read from the authored stat block on disk (imp:
// walk 20 ft., fly 40 ft.) — never hardcoded, never re-stamped to cs (the
// runMonster block fallback is the single source of truth after the stamp
// clears). Rows/combatants without a block fall back to an honest token.
async function resolveTrueFormSpeedText({ creature, deps = {} }) {
  const load = deps.loadMonsters || loadMonsters;
  try {
    const monsters = await load();
    const base = monsters.find(m => m.index === creature.monsterIndex);
    const dict = base?.speed || null;
    return dict ? Object.entries(dict).map(([k, v]) => `${k} ${v}`).join(', ') : 'stat block speed (unresolved)';
  } catch (e) {
    console.error('[monsterShapeShift] true-form speed block lookup failed:', e);
    return 'stat block speed (unresolved)';
  }
}

async function resolveShapeShiftStamp({ monsterName, action, form, campaignName, setPopupHtml, deps }) {
  const log = deps.addEntry || addEntry;
  const getCS = deps.getCombatSummary || getCombatSummary;
  const setCS = deps.setCombatSummary || ((cs) => storage.set('combatSummary', cloneDeep(cs), campaignName));
  const cs = getCS(campaignName);
  const creature = cs?.creatures?.find(c => c.name === monsterName);
  if (!cs || !creature) {
    console.error(`[monsterShapeShift] no combatSummary combatant for ${monsterName} — Shape-Shift refused, zero writes.`);
    setPopupHtml(buildShapeShiftRefusalPopup({ monsterName, form, reason: 'no_combat_summary_entry' }));
    await log(campaignName, buildShapeShiftRefusalLog({ monsterName, action, form, reason: 'no_combat_summary_entry' }));
    return { resolved: false, reason: 'no_combat_summary_entry' };
  }

  const currentForm = creature.shapeShiftForm || null;
  const revert = isTrueFormRequest(form);
  if (revert && !currentForm) {
    setPopupHtml(buildShapeShiftRefusalPopup({ monsterName, form, reason: 'already_true_form' }));
    await log(campaignName, buildShapeShiftRefusalLog({ monsterName, action, form, reason: 'already_true_form' }));
    return { resolved: false, reason: 'already_true_form' };
  }
  if (!revert && currentForm === form.name) {
    setPopupHtml(buildShapeShiftRefusalPopup({ monsterName, form, reason: `already_in_${formSlug(form.name)}_form` }));
    await log(campaignName, buildShapeShiftRefusalLog({ monsterName, action, form, reason: `already_in_${formSlug(form.name)}_form` }));
    return { resolved: false, reason: 'already_in_form' };
  }

  const nextCs = cloneDeep(cs);
  const entry = nextCs.creatures.find(c => c.name === monsterName);
  let speedText;
  if (revert) {
    delete entry.speed;
    delete entry.shapeShiftForm;
    speedText = await resolveTrueFormSpeedText({ creature, deps });
  } else {
    entry.speed = shapeShiftSpeedDict(form);
    entry.shapeShiftForm = form.name;
    speedText = shapeShiftSpeedText(form);
  }
  await setCS(nextCs); // ONE merged full-store cs POST (§39) — no clock, no te.
  await log(campaignName, buildShapeShiftAppliedLog({ monsterName, action, form, speedText }));
  setPopupHtml(buildShapeShiftPopup({ monsterName, form, speedText }));
  return { resolved: true, form: form.name, revert, speed: entry.speed ?? null, speedText };
}

export async function resolveMonsterShapeShiftRow({ action, form, monsterName, campaignName, setPopupHtml, deps = {} } = {}) {
  if (!isMonsterShapeShiftRow(action)) return { resolved: false, reason: 'not-shape-shift' };
  if (!form) return { resolved: false, reason: 'no-form' };
  return resolveShapeShiftStamp({ monsterName, action, form, campaignName, setPopupHtml, deps });
}

// Modal seam helpers — thin wrappers so MonsterCardModal lambdas stay
// branch-free (complexity ceiling §45/§105).
export async function resolveShapeShiftSelection({ chooser, form, monsterName, campaignName, setPopupHtml, setChooser, deps = {} }) {
  setChooser(null);
  if (!chooser?.action) return { resolved: false, reason: 'no-chooser' };
  return resolveMonsterShapeShiftRow({ action: chooser.action, form, monsterName, campaignName, setPopupHtml, deps });
}

export async function declineShapeShiftSelection({ chooser, monsterName, campaignName, setChooser, deps = {} }) {
  const logs = [];
  const log = deps.addEntry || addEntry;
  setChooser(null);
  if (!chooser?.action) return logs;
  const entry = buildShapeShiftDeclineLog({ monsterName, action: chooser.action });
  logs.push(entry);
  await log(campaignName, entry);
  return logs;
}
