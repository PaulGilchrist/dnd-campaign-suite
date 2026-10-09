import { addEntry } from '../../services/ui/logService.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { getConsumedMaterial, getMaterialRequirementMessage } from '../../services/rules/spells/materialComponents.js';
import { isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints } from './useMetamagic.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { tryGateSpell } from './spellGates.js';
import { getCreatureTargets } from './useSpellMetamagicHelpers.js';
import { resolveTarget } from '../../services/automation/common/targetResolver.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';

// CLA-388: Wild Companion casts Find Familiar "without Material components" — a paid
// grant stamp waives the consumed-material requirement AND its consumption. Without the
// grant the consumed-material gate stays enforced.
function hasWildCompanionWaiver(playerStats, spell, freeCastAuthorized) {
  if (!freeCastAuthorized) return false;
  return [...(playerStats.automation?.actions || []),
    ...(playerStats.automation?.bonusActions || []),
    ...(playerStats.automation?.specialActions || [])].some(e =>
      e.type === 'free_spell' && e.resourceCost === 'wild_companion' &&
      (Array.isArray(e.spell) ? e.spell : [e.spell]).includes(spell.name));
}

// Highest damage-progression level applicable to a cantrip for this caster.
function resolveCantripAutoLevel(spell, playerStats) {
  if (spell.level !== 0 || !spell.damage) return null;
  const charDmg = spell.damage?.damage_at_character_level;
  const slotDmg = spell.damage?.damage_at_slot_level;
  const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
  if (!dmgObj) return null;
  const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
  const applicable = levels.filter(l => l <= playerStats.level);
  return applicable.length > 0 ? Math.max(...applicable) : null;
}

// SP-088/SP-089: this Words-of-Creation branch early-returns, so the generic
// prepareSpellCast call below is never reached and Power Word slots were never
// consumed. Spend the slot here (mirroring the generic call and createConfirmHandler)
// on BOTH the target-selected and skip paths — both still cast the spell.
async function spendPowerWordSlot(spell, metaCtx, { playerStats, campaignName, freeCastAuthorized }) {
  const result = await prepareSpellCast(spell, metaCtx, {
    playerName: playerStats.name,
    playerStats,
    campaignName,
    isUpcast: spell.isUpcast,
    upcastLevel: spell.upcastLevel,
    freeCastAuthorized,
    usePsionicPayment: !!spell.usePsionicPayment,
    usePsychicDamage: !!spell.usePsychicDamage,
  });
  if (result.slotConsumed) {
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: spell.name,
      spellName: spell.name,
      description: `${spell.name}: Expended a level ${result.modifiedSpell.level || spell.level} spell slot.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useSpellMetamagicGates:slot-log-error]", e); });
  }
  return result;
}

async function openPowerWordTargetModal({ spell, metaCtx, creatureTargets, multiTargetSpread, setSecondaryTargetModal, onExecute, playerStats, campaignName, freeCastAuthorized }) {
  const modalConfig = {
    title: 'Words of Creation — Choose Second Target',
    targets: creatureTargets.map(name => ({ name, type: 'creature' })),
    confirmLabel: 'Cast Spell',
    confirmIcon: 'fa-solid fa-sparkles',
    featureDescription: `When you cast ${spell.name}, you can target a second creature within ${multiTargetSpread.range || '10 ft'} of the first target.`,
    description: 'Select a second creature to also be affected by the spell.',
    onTargetSelected: async (secondTargetName) => {
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName: secondTargetName,
        spellName: spell.name,
        spellLevel: spell.level || 0,
        castingTime: spell.casting_time,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[useSpellMetamagicGates:log-error]", e); });
      await spendPowerWordSlot(spell, metaCtx, { playerStats, campaignName, freeCastAuthorized });
      const mCtx = { multiTarget: secondTargetName };
      onExecute(spell, mCtx);
      setSecondaryTargetModal(null);
    },
    onSkip: async () => {
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        spellName: spell.name,
        spellLevel: spell.level || 0,
        castingTime: spell.casting_time,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[useSpellMetamagicGates:log-error]", e); });
      await spendPowerWordSlot(spell, metaCtx, { playerStats, campaignName, freeCastAuthorized });
      onExecute(spell, {});
      setSecondaryTargetModal(null);
    },
  };
  setSecondaryTargetModal({ secondaryTargetModal: modalConfig });
}

// SP-007: backfill the paid upcast level onto a metaCtx carrier (byte-twin of the
// CLA-086 confirm-lane stamp). prepareSpellCast snapshots its metaCtx argument into
// result.metaCtx BEFORE any caller-side stamp, so the caller stamp alone never reaches
// onExecute — generic automation handlers (arcane_vigor upcast) resolved at base 2.
// Stamp BOTH carriers so the slot level actually consumed reaches downstream resolvers.
function stampPaidSlotLevelOn(carrier, upcastLevel) {
  if (!carrier || carrier.slotLevel || !upcastLevel) return;
  carrier.slotLevel = upcastLevel;
}

// SP-079 (§CLA-208 pay-at-open family): Mass Suggestion pays at chooser CONFIRM,
// not at row-click/open. The chooser is opened by executeSpellCast's automationPopup,
// but the slot spend here (handleNonSorcererCast → prepareSpellCast) previously paid
// BEFORE the chooser even rendered — a Skip/cancel left the lv6 slot spent, zero saves
// resolved, plus a phantom cast log. This branch opens the chooser UNPAID and stamps
// _deferChooserSlotPayment so executeSpellCast skips the cast log and the chooser's
// confirm (MassSuggestionModal.handleCreatureSelectionConfirm) consumes the slot + logs
// once. Mirrors the consumeBarkskinSlot / consumeProtectionFromPoisonSlot pay-at-confirm
// template (useCustomHandlers.js). Same shared lane serves both 2024 and 5e rows.
function isDeferredChooserPaymentSpell(spell) {
  const lower = (spell?.name || '').toLowerCase();
  return lower === 'mass suggestion' && spell?.automation?.type === 'mass_suggestion';
}

// SP-080: Maze has no chooser modal — mazeHandler resolves the armed initiative
// Target combobox via targetResolver.resolveTarget and refuses unarmed casts,
// but handleNonSorcererCast below paid the slot + caster concentration via
// prepareSpellCast BEFORE the handler ran (pay-no-effect leak, §CLA-208 /
// SP-079 deferred-pay family). Resolve the exact same target the handler will
// use and refuse with the handler's own refusal faces (§41 `maze_refused`
// automation log, zero spend, no phantom cast). A valid target keeps the
// paid lane below byte-identical.
function isMazeSpell(spell) {
  const lower = (spell?.name || '').toLowerCase();
  return lower === 'maze' || spell?.automation?.type === 'maze';
}

// Returns true when the cast was refused (unpaid) — mirrors mazeHandler's
// refusal faces, which run only after this gate has already refused.
async function refuseUnarmedMazeCastGate(spell, playerStats, campaignName, setPopupHtml) {
  if (!isMazeSpell(spell)) return false;
  const cs = await getCombatContext(campaignName);
  if (!cs?.creatures || cs.creatures.length === 0) {
    refuseUnarmedMazeCast(spell, playerStats, campaignName, setPopupHtml, 'No creatures in combat.');
    return true;
  }
  const resolved = await resolveTarget(campaignName, playerStats.name);
  if (!resolved?.target?.name) {
    refuseUnarmedMazeCast(spell, playerStats, campaignName, setPopupHtml, 'No target selected.');
    return true;
  }
  if (!cs.creatures.some(c => c.name === resolved.target.name)) {
    refuseUnarmedMazeCast(spell, playerStats, campaignName, setPopupHtml, `Target "${resolved.target.name}" not found in combat.`);
    return true;
  }
  return false;
}

function refuseUnarmedMazeCast(spell, playerStats, campaignName, setPopupHtml, head) {
  if (setPopupHtml) {
    setPopupHtml({
      type: 'automation_info',
      name: spell.name,
      automationType: 'maze_refused',
      description: `${head} ${spell.name} has no effect.`,
    });
  }
  addEntry(campaignName, {
    type: 'automation',
    automationType: 'maze_refused',
    reason: head.startsWith('No creatures') ? 'no_creatures' : 'no_target',
    characterName: playerStats.name,
    abilityName: spell.name,
    description: `${spell.name} refused: ${head.charAt(0).toLowerCase()}${head.slice(1)} Nothing spent.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error("[useSpellMetamagicGates:maze_refused]", e); });
}

// SP-103: recasting Shapechange while already transformed is RAW "an action to
// shape-shift into a different eligible form" — a free form change, not a new
// casting. cs.shapechangeOriginal is the transform-state source of truth; when it
// exists the chooser reopens UNPAID (no slot, no second concentration, no THP
// re-grant — confirmShapechangeTransform swaps forms only) and stamps
// _shapechangeFormChange so executeSpellCast skips the cast log (mirror
// _deferChooserSlotPayment). Fresh casts (no originals) keep the paid lane intact.
function isShapechangeSpell(spell) {
  const lower = (spell?.name || '').toLowerCase();
  return lower === 'shapechange' || spell?.automation?.type === 'shapechange';
}

async function isShapechangeTransformActive(playerStats, campaignName) {
  const cs = await getCombatContext(campaignName);
  const creature = cs?.creatures?.find(c => c.name === playerStats.name);
  return !!creature?.shapechangeOriginal;
}

async function tryUnpaidShapechangeRecast(spell, metaCtx, { campaignName, onExecute, playerStats }) {
  if (!await isShapechangeTransformActive(playerStats, campaignName)) return false;
  onExecute({ ...spell, _shapechangeFormChange: true }, { ...metaCtx, _shapechangeFormChange: true });
  return true;
}



// Non-sorcerer cast path: cantrip auto-leveling, concentration-preserving casts,
// and the generic prepareSpellCast slot payment. Mirrors the original ordering exactly.
async function handleNonSorcererCast(spell, metaCtx, {
  campaignName, consumedMaterial, freeCastAuthorized, materialsWaived, onExecute, playerStats
}) {
  const cantripAutoLevel = resolveCantripAutoLevel(spell, playerStats);

  // Spell-identity short-circuit BEFORE the await (SP-080 timing family): non-
  // shapechange lanes keep their exact sync onExecute timing.
  if (isShapechangeSpell(spell) && await tryUnpaidShapechangeRecast(spell, metaCtx, { campaignName, onExecute, playerStats })) return;

  if (isDeferredChooserPaymentSpell(spell)) {
    // SP-079: open the chooser unpaid — the spend + cast log move to confirm.
    onExecute({ ...spell, _deferChooserSlotPayment: true, slotLevel: spell.upcastLevel || spell.level }, metaCtx);
    return;
  }

  if (cantripAutoLevel) {
    const preparedSpell = { ...spell, level: cantripAutoLevel, baseLevel: 0 };
    if (consumedMaterial && !materialsWaived) await consumeMaterial(playerStats, consumedMaterial.itemName, campaignName);
    onExecute(preparedSpell, metaCtx);
  } else if (metaCtx.oldConcentrationSpell !== undefined) {
    if (consumedMaterial && !materialsWaived) await consumeMaterial(playerStats, consumedMaterial.itemName, campaignName);
    onExecute(spell, metaCtx);
  } else {
    const isUpcast = spell.isUpcast;
    const upcastLevel = spell.upcastLevel;
    const result = await prepareSpellCast(spell, metaCtx, {
      playerName: playerStats.name,
      playerStats,
      campaignName,
      isUpcast,
      upcastLevel,
      freeCastAuthorized,
      // CLA-271: forward the Psionic Sorcery SP-payment opt-in so prepareSpellCast
      // pays SP, skips the spell slot and logs psionic_sorcery.
      usePsionicPayment: !!spell.usePsionicPayment,
      // CLA-268: forward the Psychic Spells damage-type opt-in so prepareSpellCast
      // stamps _psychicSpellsOverride and the execution resolver swaps to Psychic.
      usePsychicDamage: !!spell.usePsychicDamage,
    });
    stampPaidSlotLevelOn(metaCtx, upcastLevel);
    stampPaidSlotLevelOn(result.metaCtx, upcastLevel);
    if (consumedMaterial && !materialsWaived) await consumeMaterial(playerStats, consumedMaterial.itemName, campaignName);
    onExecute(result.modifiedSpell, result.metaCtx);
  }
}

function showMaterialRequiredPopup(spell, setPopupHtml) {
  if (!setPopupHtml) return;
  setPopupHtml({
    type: 'automation_info',
    name: spell.name,
    automationType: 'material_required',
    description: getMaterialRequirementMessage(spell),
  });
}

function isPowerWordSpell(spell) {
  const lower = spell.name ? spell.name.toLowerCase() : '';
  return lower === 'power word heal' || lower === 'power word kill';
}

// Returns true when the multi-target spread consumed the cast (modal opened or
// pending target selector queued); false to fall through to the normal cast.
async function handleMultiTargetGate(spell, metaCtx, {
  campaignName, cfSetPending, characters, freeCastAuthorized, multiTargetSpread, onExecute, playerStats, setSecondaryTargetModal
}) {
  const creatureTargets = getCreatureTargets(playerStats?.name, campaignName, characters);
  if (creatureTargets.length === 0) return false;
  if (isPowerWordSpell(spell) && setSecondaryTargetModal) {
    await openPowerWordTargetModal({ spell, metaCtx, creatureTargets, multiTargetSpread, setSecondaryTargetModal, onExecute, playerStats, campaignName, freeCastAuthorized });
    return true;
  }
  cfSetPending('multiTarget', {
    spell,
    spellName: spell.name,
    spellLevel: spell.level || 0,
    castingTime: spell.casting_time,
    range: multiTargetSpread.range || '10 ft',
    creatureTargets,
  });
  return true;
}

function isBlockedByConsumedMaterial(consumedMaterial, materialsWaived, playerStats, hasMaterial) {
  return !!(consumedMaterial && !materialsWaived && !hasMaterial(playerStats, consumedMaterial.itemName));
}

function queueSorceryMetamagic(spell, metaCtx, { playerStats, cfSetPending }) {
  let sorcerySpell = spell;
  if (spell.level === 0 && spell.damage) {
    const autoLevel = resolveCantripAutoLevel(spell, playerStats);
    if (autoLevel) {
      sorcerySpell = { ...spell, level: autoLevel, baseLevel: 0 };
    }
  }

  const spellLevel = (metaCtx?.slotLevel ?? (sorcerySpell.baseLevel ?? sorcerySpell.level)) || 0;
  const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
  const isPsionic = isPsionicSpell(playerStats, spell.name);
  const hasPsionic = hasPsionicSorcery(playerStats);

  cfSetPending('metamagic', {
    spell: sorcerySpell,
    spellName: spell.name,
    spellLevel: spellLevel,
    castingTime: spell.casting_time,
    _currentSP: currentSP,
    isPsionic: isPsionic && hasPsionic,
    psionicCost: isPsionic && hasPsionic ? spellLevel : 0,
    _metaCtx: metaCtx,
  });
}

export async function gateMetamagic(spell, metaCtx, {
  hasMaterial, setPopupHtml, isSorcerer, playerStats, campaignName, cfSetPending, setSecondaryTargetModal, characters, onExecute
}) {
  const consumedMaterial = getConsumedMaterial(spell);
  // CLA-312: gate free-cast authorization on the EFFECTIVE cast level.
  const gateLevel = (spell.isUpcast && spell.upcastLevel) || spell.level;
  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, gateLevel, playerStats, campaignName);
  const materialsWaived = hasWildCompanionWaiver(playerStats, spell, freeCastAuthorized);
  if (isBlockedByConsumedMaterial(consumedMaterial, materialsWaived, playerStats, hasMaterial)) {
    showMaterialRequiredPopup(spell, setPopupHtml);
    return;
  }

  const handled = tryGateSpell(spell.name, campaignName, cfSetPending, {
    spell,
    metaCtx,
    playerStats,
    characters,
    isSorcerer,
    setPopupHtml,
  });
  if (handled) return;

  // CLA-388 etc.: Words-of-Creation / Power Word spells open a second-target flow first.
  const multiTargetSpread = isPowerWordSpell(spell) ? { range: '10 ft' } : getMultiTargetSpreadForSpell(playerStats, spell.name);
  if (multiTargetSpread && await handleMultiTargetGate(spell, metaCtx, { campaignName, cfSetPending, characters, freeCastAuthorized, multiTargetSpread, onExecute, playerStats, setSecondaryTargetModal })) {
    return;
  }

  // SP-080: refuse an unarmed Maze cast BEFORE any payment lane (slot + caster
  // concentration). Short-circuit on spell identity so non-Maze lanes keep their
  // exact sync timing (other-paths tests assert onExecute inside a sync act()).
  if (isMazeSpell(spell) && await refuseUnarmedMazeCastGate(spell, playerStats, campaignName, setPopupHtml)) return;

  if (!isSorcerer) {
    await handleNonSorcererCast(spell, metaCtx, { campaignName, consumedMaterial, freeCastAuthorized, materialsWaived, onExecute, playerStats });
    return;
  }

  queueSorceryMetamagic(spell, metaCtx, { playerStats, cfSetPending });
}


