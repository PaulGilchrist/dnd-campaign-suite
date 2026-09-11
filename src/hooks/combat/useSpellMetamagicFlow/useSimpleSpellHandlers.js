import {
  applyAidEffect, applyHeroesFeastEffect, applyLesserRestorationEffect,
  applyMageArmorEffect,
  applyProtectionFromEvilAndGood,
  applyShieldOfFaithEffect,
  applyBaneEffect, applyBlessEffect, applyBeaconOfHopeEffect,
  applyHolyAuraEffect, applyHaste, applyInvisibility,
  applyGreaterInvisibility,
  applyAuraOfLifeEffect, applyAuraOfPurityEffect,
  applyCircleOfPowerEffect, applyCompulsionEffect,
  applyAuraOfVitalityEffect, applyDeathWardEffect,
  applyFeignDeath, applyHeroism,
  applyLongstriderEffect, applySpareTheDyingEffect,
  handleSanctuary, executeHandler,
} from '../../../services/automation/index.js'
import { triggerFaerieFire } from '../../../services/rules/features/faerieFireService.js'
import { triggerHeal } from '../../../services/rules/features/healService.js'
import { triggerForesight } from '../../../services/rules/features/foresightService.js'
import { triggerHoldMonster } from '../../../services/rules/features/holdMonsterService.js'
import { triggerCharmPerson } from '../../../services/rules/features/charmPersonService.js'
import { triggerCharmMonster } from '../../../services/rules/features/charmMonsterService.js'
import { triggerBanishment } from '../../../services/rules/features/banishmentService.js'
import { triggerRevivify } from '../../../services/rules/features/revivifyService.js'
import { triggerHealingWord } from '../../../services/rules/features/healingWordService.js'
import { applyPolymorph } from '../../../services/automation/handlers/spells/polymorphService.js'
import { confirmGreaterRestoration } from '../../../services/rules/features/greaterRestorationService.js'
import { confirmRemoveCurse } from '../../../services/rules/features/removeCurseService.js'
import { confirmRegenerate } from '../../../services/rules/features/regenerateService.js'
import { consumeMaterial } from '../../../services/rules/spells/materialComponents.js'
import { addEntry } from '../../../services/ui/logService.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js'
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js'
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'

// Shared runner helpers — every handler body is a small module-level function
// invoked with (d, pending, result), where d carries the hook's render-scoped
// deps (playerStats, campaignName, setPopupHtml, onExecute, …).

const allTargets = (d, pending) => pending.creatureTargets
const toArray = (value) => (Array.isArray(value) ? value : [value])
const computeSaveDc = (d, pending) => pending.spellSaveDc || d.playerStats.spellAbilities?.saveDc || 8 + (d.playerStats.proficiency || 2)

function showPopupIfPayload(d, popup) {
  if (popup?.payload && d.setPopupHtml) d.setPopupHtml(popup.payload)
}

function showPopupIfPresent(d, popup) {
  if (popup && d.setPopupHtml) d.setPopupHtml(popup.payload)
}

// getApplyFn/getTriggerFn are thunks so partially-mocked service modules
// (tests using vi.mock factories) only resolve when a handler actually runs.
const applySpell = (getApplyFn, bodyOf, showPopup = null) => async (d, pending, result) => {
  const applyFn = getApplyFn()
  const returned = await applyFn({ name: pending.spellName, spell: pending.spell, ...bodyOf(pending) }, d.playerStats, d.campaignName, null, result)
  if (showPopup) showPopup(d, returned)
}

const consumeThenApply = (material, runner) => async (d, pending, result) => {
  await consumeMaterial(d.playerStats, material, d.campaignName)
  await runner(d, pending, result)
}

const triggerSpell = (getTriggerFn, metaOf, showPopup = null) => async (d, pending, result) => {
  const triggerFn = getTriggerFn()
  const returned = await triggerFn(pending.spell, metaOf(pending, result), d.playerStats, d.campaignName, null)
  if (showPopup) showPopup(d, returned)
}

function areaAction(d, pending, type, saveType, metaCtx) {
  return {
    name: pending.spellName,
    spell: pending.spell,
    automation: { type, saveDc: computeSaveDc(d, pending), saveType },
    metaCtx,
  }
}

const areaExecute = (type, saveType) => async (d, pending, result) => {
  await executeHandler(areaAction(d, pending, type, saveType, { targets: result }), d.playerStats, d.campaignName, null)
}

async function runSlow(d, pending, result) {
  const action = {
    name: pending.spellName,
    spell: pending.spell,
    automation: { type: 'slow', range: pending.range, saveDc: computeSaveDc(d, pending), saveType: 'WIS' },
    metaCtx: { targets: result },
  }
  await executeHandler(action, d.playerStats, d.campaignName, null, null)
}

async function runConfusion(d, pending, result) {
  const targetNames = toArray(result)
  const action = areaAction(d, pending, 'confusion', 'WIS', { targets: targetNames, metamagicHeighten: pending.metamagicHeighten })
  const popup = await executeHandler(action, d.playerStats, d.campaignName, null)
  showPopupIfPayload(d, popup)
}

async function runHeal(d, pending, result) {
  const targetName = result.targetName
  if (!targetName) return
  await triggerHeal(
    { name: pending.spellName, spell: pending.spell, level: pending.spellLevel },
    { targetName },
    d.playerStats,
    d.campaignName,
    null
  )
}

async function runForesight(d, pending, result) {
  const targetName = result?.[0] || pending.creatureTargets?.[0]
  if (!targetName) return
  const popup = await triggerForesight(
    { name: pending.spellName, spell: pending.spell },
    { targetName },
    d.playerStats,
    d.campaignName,
    null
  )
  showPopupIfPayload(d, popup)
}

async function runRegenerate(d, pending, result) {
  const targetName = result?.targetName
  if (!targetName) return
  const popup = await confirmRegenerate(
    { name: pending.spellName, spell: pending.spell, automation: { type: 'regenerate', range: pending.range } },
    d.playerStats,
    d.campaignName,
    null,
    targetName
  )
  showPopupIfPresent(d, popup)
}

async function runSanctuary(d, pending, result) {
  const targetName = result
  if (!targetName) return
  const action = {
    name: pending.spellName,
    spell: pending.spell,
    automation: { type: 'sanctuary', range: pending.range, duration: '1 minute', casting_time: pending.castingTime },
    metaCtx: { targetName },
  }
  const popup = await handleSanctuary(action, d.playerStats, d.campaignName, null)
  showPopupIfPresent(d, popup)
}

async function runPolymorph(d, pending, result) {
  const targetName = Array.isArray(result) ? result[0] : result
  if (!targetName) return
  const popup = await applyPolymorph(pending.spell, {
    polymorphTarget: targetName,
    characters: pending.characters || [],
  }, d.playerStats, d.campaignName, null)
  showPopupIfPayload(d, popup)
}

async function runAnimalFriendship(d, pending, result) {
  const freeCastAuthorized = isFreeCastAuthorized(d.playerStats.name, pending.spellName, pending.spellLevel, d.playerStats, d.campaignName)
  const preparedResult = await prepareSpellCast(pending.spell, { targetNames: result }, {
    playerName: d.playerStats.name,
    playerStats: d.playerStats,
    campaignName: d.campaignName,
    isUpcast: false,
    freeCastAuthorized,
  })
  d.onExecute(preparedResult.modifiedSpell, preparedResult.metaCtx)
}

async function runRevivify(d, pending, result) {
  const targetName = result.targetName
  if (!targetName) return
  const popup = await triggerRevivify(
    pending.spell,
    { targetName },
    d.playerStats,
    d.campaignName,
    targetName
  )
  // SP-100: createConfirmHandler spends the slot before applyFn — refund it
  // when the trigger refuses (target no longer dead / material gone).
  if (popup?.payload?.type === 'automation_info') {
    rollbackSpellSlot(d.playerStats.name, pending.spellName, pending.spellLevel || 0, d.playerStats, d.campaignName)
  }
  showPopupIfPresent(d, popup)
}

function buildHealingWordPopup(spellName, healResult) {
  const bonusHealDetail = healResult.bonusDetails?.length > 0
    ? healResult.bonusDetails.map(t => `${t.amount} ${t.name}`).join(', ')
    : ''
  const rawTotal = healResult.rawTotal ?? healResult.healAmount
  return {
    type: 'heal',
    name: spellName,
    formula: healResult.formula,
    rolls: healResult.rolls || [],
    total: rawTotal,
    targetName: healResult.targetName,
    finalHeal: healResult.healAmount,
    bonusHeal: healResult.bonusHeal || 0,
    bonusHealDetail,
    healingRerollOriginalRolls: healResult.healingRerollOriginalRolls || null,
    healingRerollDisplayRolls: healResult.healingRerollDisplayRolls || null,
  }
}

async function runHealingWord(d, pending, result) {
  const targetName = result.targetName
  if (!targetName) return
  const healResult = await triggerHealingWord(
    pending.spell,
    { targetName, slotLevel: pending.spellLevel },
    d.playerStats,
    d.campaignName,
    null
  )
  if (healResult && d.setPopupHtml) {
    d.setPopupHtml(buildHealingWordPopup(pending.spellName, healResult))
  }
}

async function runCureWounds(d, pending, result) {
  const targetName = result.targetName
  if (!targetName) return
  d.onExecute(pending.spell, { targetName, slotLevel: pending.spellLevel })
}

async function runHex(d, pending, result) {
  const targetName = Array.isArray(result) ? result[0] : result
  if (!targetName) return
  d.onExecute(pending.spell, { targetName })
}

function refundGreaterRestorationNoEffects(d) {
  const pending = d.getPending('greaterRestoration')
  if (!pending) return
  d.cfClearPending('greaterRestoration')
  const slotKey = `spell_slots_level_${pending.spellLevel || 0}`
  const current = getRuntimeValue(d.playerStats.name, slotKey, d.campaignName)
  const max = (d.playerStats.spellAbilities && d.playerStats.spellAbilities[slotKey]) || 0
  const available = current != null ? current : max
  if (available >= 0) {
    setRuntimeValue(d.playerStats.name, slotKey, available + 1, d.campaignName)
  }
  addEntry(d.campaignName, {
    type: 'spell',
    characterName: d.playerStats.name,
    targetName: null,
    targets: [],
    spellName: pending.spellName,
    spellLevel: pending.spellLevel || 0,
    castingTime: pending.castingTime,
    timestamp: Date.now(),
  }).catch((e) => { console.error("[useSimpleSpellHandlers:log-error]", e); })
}

// Declarative handler registry: each spec maps a gated spell to its confirm
// runner plus the target selectors handed to createConfirmHandler/createSkipHandler.
const SIMPLE_SPELL_SPECS = [
  { name: 'aid', key: 'Aid', run: applySpell(() => applyAidEffect, p => ({ automation: { type: 'aid', range: p.range, maxTargets: p.maxTargets } })) },
  { name: 'bane', key: 'Bane', run: applySpell(() => applyBaneEffect, p => ({ automation: { type: 'bane', range: p.range, maxTargets: p.maxTargets } })) },
  { name: 'bless', key: 'Bless', run: applySpell(() => applyBlessEffect, p => ({ automation: { type: 'bless', range: p.range, maxTargets: p.maxTargets } })) },
  { name: 'faerieFire', key: 'FaerieFire', run: triggerSpell(() => triggerFaerieFire, (p, r) => ({ targets: toArray(r) }), showPopupIfPayload) },
  { name: 'holyAura', key: 'HolyAura', run: applySpell(() => applyHolyAuraEffect, p => ({ automation: { type: 'holy_aura', duration: p.spell.duration, auraRange: 30, casting_time: p.castingTime } }), showPopupIfPresent) },
  { name: 'slow', key: 'Slow', run: runSlow },
  { name: 'haste', key: 'Haste', run: applySpell(() => applyHaste, () => ({ automation: { type: 'haste' } })) },
  { name: 'invisibility', key: 'Invisibility', run: applySpell(() => applyInvisibility, () => ({ automation: { type: 'invisibility' } })) },
  { name: 'greaterInvisibility', key: 'GreaterInvisibility', run: applySpell(() => applyGreaterInvisibility, () => ({ automation: { type: 'greater_invisibility' } })) },
  { name: 'feignDeath', key: 'FeignDeath', run: applySpell(() => applyFeignDeath, () => ({ automation: { type: 'feign_death' } }), showPopupIfPresent) },
  { name: 'heal', key: 'Heal', run: runHeal },
  { name: 'longstrider', key: 'Longstrider', run: applySpell(() => applyLongstriderEffect, () => ({ automation: { type: 'longstrider' } }), showPopupIfPresent) },
  { name: 'spareTheDying', key: 'SpareTheDying', run: applySpell(() => applySpareTheDyingEffect, () => ({ automation: { type: 'spare_the_dying' } }), showPopupIfPresent) },
  { name: 'beaconOfHope', key: 'BeaconOfHope', run: applySpell(() => applyBeaconOfHopeEffect, p => ({ automation: { type: 'beacon_of_hope', range: p.range } }), showPopupIfPresent) },
  { name: 'heroesFeast', key: 'HeroesFeast', run: consumeThenApply('Gem-Encrusted Bowl (1,000 gp)', applySpell(() => applyHeroesFeastEffect, p => ({ automation: { type: 'heroes_feast', range: p.range, maxTargets: p.maxTargets } }))) },
  { name: 'auraOfLife', key: 'AuraOfLife', run: applySpell(() => applyAuraOfLifeEffect, () => ({ automation: { type: 'aura_of_life' } })) },
  { name: 'auraOfPurity', key: 'AuraOfPurity', run: applySpell(() => applyAuraOfPurityEffect, p => ({ automation: p.spell.automation || { type: 'aura_of_purity' } })) },
  { name: 'circleOfPower', key: 'CircleOfPower', run: applySpell(() => applyCircleOfPowerEffect, p => ({ automation: p.spell.automation || { type: 'circle_of_power', auraRange: 30 } }), showPopupIfPayload) },
  { name: 'compulsion', key: 'Compulsion', run: applySpell(() => applyCompulsionEffect, p => ({ automation: p.spell.automation || { type: 'compulsion' } }), showPopupIfPayload) },
  { name: 'auraOfVitality', key: 'AuraOfVitality', run: applySpell(() => applyAuraOfVitalityEffect, p => ({ automation: p.spell.automation || { type: 'aura_of_vitality' }, spellSlotLevel: p.spellLevel }), showPopupIfPayload) },
  { name: 'deathWard', key: 'DeathWard', run: applySpell(() => applyDeathWardEffect, p => ({ automation: p.spell.automation || { type: 'death_ward' }, spellSlotLevel: p.spellLevel }), showPopupIfPayload) },
  { name: 'heroism', key: 'Heroism', run: applySpell(() => applyHeroism, p => ({ automation: p.spell.automation || { type: 'heroism' } }), showPopupIfPayload) },
  { name: 'greaterRestoration', key: 'GreaterRestoration', run: consumeThenApply('Diamond Dust (100 gp)', applySpell(() => confirmGreaterRestoration, p => ({ automation: { type: 'greater_restoration', range: p.range } }))) },
  { name: 'lesserRestoration', key: 'LesserRestoration', run: applySpell(() => applyLesserRestorationEffect, p => ({ automation: { type: 'lesser_restoration', range: p.range } })) },
  { name: 'removeCurse', key: 'RemoveCurse', run: applySpell(() => confirmRemoveCurse, p => ({ automation: { type: 'remove_curse', range: p.range } }), showPopupIfPayload) },
  { name: 'mageArmor', key: 'MageArmor', run: applySpell(() => applyMageArmorEffect, p => ({ automation: { type: 'mage_armor', range: p.range } })) },
  { name: 'foresight', key: 'Foresight', run: runForesight },
  {
    name: 'protectionFromEvilAndGood',
    key: 'ProtectionFromEvilAndGood',
    run: consumeThenApply('Flask of Holy Water (25 gp)', applySpell(() => applyProtectionFromEvilAndGood, () => ({ automation: { type: 'protection_from_evil_and_good' } }))),
    confirmTargets: (d, pending) => [pending.creatureTargets.find(n => n === d.playerStats.name) || pending.creatureTargets[0]],
    skipTargets: (d, pending) => [pending.creatureTargets[0]],
  },
  { name: 'shieldOfFaith', key: 'ShieldOfFaith', run: applySpell(() => applyShieldOfFaithEffect, p => ({ automation: { type: 'shield_of_faith', range: p.range } })) },
  { name: 'regenerate', key: 'Regenerate', run: runRegenerate },
  { name: 'sanctuary', key: 'Sanctuary', run: runSanctuary },
  { name: 'sleetStorm', key: 'SleetStorm', run: areaExecute('sleet_storm', 'DEX') },
  { name: 'cureWounds', key: 'CureWounds', run: runCureWounds },
  { name: 'holdMonster', key: 'HoldMonster', run: triggerSpell(() => triggerHoldMonster, (p, r) => ({ holdMonsterTargets: toArray(r) })) },
  { name: 'holdPerson', key: 'HoldPerson', run: triggerSpell(() => triggerHoldMonster, (p, r) => ({ holdPersonTargets: toArray(r) })) },
  { name: 'polymorph', key: 'Polymorph', run: runPolymorph },
  { name: 'animalFriendship', key: 'AnimalFriendship', run: runAnimalFriendship },
  { name: 'charmPerson', key: 'CharmPerson', run: triggerSpell(() => triggerCharmPerson, (p, r) => ({ charmPersonTargets: toArray(r) })) },
  { name: 'charmMonster', key: 'CharmMonster', run: triggerSpell(() => triggerCharmMonster, (p, r) => ({ charmMonsterTargets: toArray(r) })) },
  { name: 'banishment', key: 'Banishment', run: triggerSpell(() => triggerBanishment, (p, r) => ({ banishmentTargets: toArray(r) }), showPopupIfPayload) },
  { name: 'prismatic_spray', key: 'PrismaticSpray', run: async (d, pending, result) => d.onExecute(pending.spell, { selectedTargets: toArray(result) }) },
  { name: 'hex', key: 'Hex', run: runHex },
  { name: 'revivify', key: 'Revivify', run: runRevivify, confirmTargets: (d, pending, sel) => (sel?.targetName ? [sel.targetName] : pending.creatureTargets) },
  { name: 'stinkingCloud', key: 'StinkingCloud', run: areaExecute('stinking_cloud', 'CON') },
  { name: 'confusion', key: 'Confusion', run: runConfusion },
  { name: 'healingWord', key: 'HealingWord', run: runHealingWord },
  { name: 'web', key: 'Web', run: areaExecute('web_area_save', 'DEX') },
]

export function useSimpleSpellHandlers(createConfirmHandler, createSkipHandler, playerStats, campaignName, characters, setPopupHtml, getPending, cfClearPending, onExecute) {
  const deps = { playerStats, campaignName, setPopupHtml, getPending, cfClearPending, onExecute }
  const handlers = {}
  for (const spec of SIMPLE_SPELL_SPECS) {
    const confirmTargets = spec.confirmTargets || allTargets
    const skipTargets = spec.skipTargets || allTargets
    handlers[`handle${spec.key}Confirm`] = createConfirmHandler(spec.name, (pending, result) => spec.run(deps, pending, result), (pending, sel) => confirmTargets(deps, pending, sel))
    handlers[`handle${spec.key}Skip`] = createSkipHandler(spec.name, (pending) => skipTargets(deps, pending))
  }
  handlers.handleGreaterRestorationNoEffects = () => refundGreaterRestorationNoEffects(deps)
  return handlers
}
