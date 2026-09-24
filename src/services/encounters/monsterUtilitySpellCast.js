// MA-1014: monster-side adjudication of spell_save_dc-only zone/utility rows
// (Ice Devil "Ice Wall" — casts Wall of Ice, level 8 version, no components,
// INT, spell save DC 17, Recharge 6). The row carried a decoy spell_save_dc
// that no renderer branch consumed (zero affordance, MA-1014). The sanctioned
// spell transport seam is handleSpellCast's CLA-325 utility/advisory route
// (§207/§230 twins) — a proceeding chip press here:
//   - recharge economy: the EXISTING live MA-0031 gate (monsterRecharge.js
//     reads flat recharge:"6") — refused rows get the shared
//     .mc-recharge-refusal popup + `<action-slug>_refused (not recharged)`
//     log, ZERO spend (§408/MA-0963 shape); a fresh row spends at resolve
//     (MA-0633 spend-at-resolve byte-shape — this route has no picker),
//     d6 recovery rides the untouched turnStartEffects seam;
//   - cast record: advisory ability_use carrying the row's RAW clauses —
//     spell save DC + casting ability + "(level 8 version)" + no-components
//     (the block-save seam would resolve this row "DC Unknown" since the
//     spell_save_dc never reaches the DC, §218 family — advisory is honest
//     because the wall is a §70 zero-consumer object: GM places it and
//     adjudicates positioning/damage).
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, spendMonsterRecharge, buildRechargeRefusalPopup, buildRechargeRefusalLog } from './monsterRecharge.js';

export function buildUtilitySpellCastLog({ monsterName, spellName, spell, action, castLevel }) {
  const ability = action?.spellcasting_ability || null;
  const dcNote = action?.spell_save_dc != null ? ` (spell save DC ${action.spell_save_dc}${ability ? `, ${ability}` : ''})` : '';
  const levelNote = castLevel != null ? ` Level ${castLevel} version.` : '';
  const componentNote = /no spell components/i.test(action?.description || '') ? ' No spell components required.' : '';
  const concentrationNote = spell?.concentration ? ` Concentration (${spell.duration || 'up to 1 minute'}).` : '';
  return `${monsterName} casts ${spellName} via Spellcasting${dcNote}.${levelNote}${componentNote}${concentrationNote} Wall/zone objects have no engine consumer (§70) — GM places the wall and adjudicates area placement, positioning saves and duration. GM-enforced for monsters.`;
}

// One chip click = one adjudicated cast. Recharge refusal pays nothing;
// otherwise spend recharge FIRST (single merged map write, MA-0005 recipe),
// then record the advisory cast.
export async function resolveUtilitySpellCastRow({ action, spellName, spell = null, castLevel = null, monsterName, campaignName, setPopupHtml, deps = {} }) {
  if (!action || action.spell_save_dc == null) return { resolved: false, reason: 'not-utility-row' };
  const log = deps.addEntry || addEntry;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const gate = monsterRechargeGate(action, getRV(monsterName, MONSTER_RECHARGE_KEY) || {});
  if (gate && !gate.available) {
    if (setPopupHtml) setPopupHtml(buildRechargeRefusalPopup({ monsterName, actionName: action.name, threshold: gate.threshold }));
    await log(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action.name, rechargeKey: gate.key, threshold: gate.threshold }))
      .catch((e) => { console.error('[monsterUtilitySpellCast] Error logging recharge refusal:', e); });
    return { resolved: false, reason: 'not-recharged' };
  }
  if (gate) {
    // Forward the injected deps (set/get runtime + logger) — spendMonsterRecharge
    // owns the single merged map write (MA-0005 recipe).
    await spendMonsterRecharge({ monsterName, action, campaignName, deps: { ...deps, addEntry: log } });
  }
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: spellName,
    description: buildUtilitySpellCastLog({ monsterName, spellName, spell, action, castLevel }),
    timestamp: Date.now(),
  }).catch((e) => { console.error('[monsterUtilitySpellCast] Error logging utility spell cast:', e); });
  return { resolved: true, rechargeKey: gate ? gate.key : null };
}
