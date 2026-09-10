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

export async function gateMetamagic(spell, metaCtx, {
  hasMaterial, setPopupHtml, isSorcerer, playerStats, campaignName, cfSetPending, setSecondaryTargetModal, characters, onExecute
}) {
  const consumedMaterial = getConsumedMaterial(spell);
  // CLA-312: gate free-cast authorization on the EFFECTIVE cast level.
  const gateLevel = (spell.isUpcast && spell.upcastLevel) || spell.level;
  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, gateLevel, playerStats, campaignName);
  // CLA-388: Wild Companion casts Find Familiar "without Material components" — a paid
  // grant stamp waives the consumed-material requirement AND its consumption. Without the
  // grant the consumed-material gate stays enforced.
  const materialsWaived = freeCastAuthorized && [...(playerStats.automation?.actions || []),
    ...(playerStats.automation?.bonusActions || []),
    ...(playerStats.automation?.specialActions || [])].some(e =>
      e.type === 'free_spell' && e.resourceCost === 'wild_companion' &&
      (Array.isArray(e.spell) ? e.spell : [e.spell]).includes(spell.name));
  if (consumedMaterial && !materialsWaived && !hasMaterial(playerStats, consumedMaterial.itemName)) {
    if (setPopupHtml) {
      setPopupHtml({
        type: 'automation_info',
        name: spell.name,
        automationType: 'material_required',
        description: getMaterialRequirementMessage(spell),
      });
    }
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

  const isPowerWordSpell = spell.name && (spell.name.toLowerCase() === 'power word heal' || spell.name.toLowerCase() === 'power word kill');
  const multiTargetSpread = isPowerWordSpell ? { range: '10 ft' } : getMultiTargetSpreadForSpell(playerStats, spell.name);

  if (multiTargetSpread) {
    const creatureTargets = getCreatureTargets(playerStats?.name, campaignName, characters);
    if (creatureTargets.length > 0) {
      if (isPowerWordSpell && setSecondaryTargetModal) {
        // SP-088/SP-089: this Words-of-Creation branch early-returns, so the generic
        // prepareSpellCast call below is never reached and Power Word slots were never
        // consumed. Spend the slot here (mirroring the generic call and createConfirmHandler)
        // on BOTH the target-selected and skip paths — both still cast the spell.
        const spendPowerWordSlot = async () => {
          const isUpcast = spell.isUpcast;
          const upcastLevel = spell.upcastLevel;
          const result = await prepareSpellCast(spell, metaCtx, {
            playerName: playerStats.name,
            playerStats,
            campaignName,
            isUpcast,
            upcastLevel,
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
        };
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
            await spendPowerWordSlot();
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
            await spendPowerWordSlot();
            onExecute(spell, {});
            setSecondaryTargetModal(null);
          },
        };
        setSecondaryTargetModal({ secondaryTargetModal: modalConfig });
        return;
      }
      cfSetPending('multiTarget', {
        spell,
        spellName: spell.name,
        spellLevel: spell.level || 0,
        castingTime: spell.casting_time,
        range: multiTargetSpread.range || '10 ft',
        creatureTargets,
      });
      return;
    }
  }

  if (!isSorcerer) {
    const isCantrip = spell.level === 0;
    const cantripAutoLevel = (function() {
      if (!isCantrip || !spell.damage) return null;
      const charDmg = spell.damage?.damage_at_character_level;
      const slotDmg = spell.damage?.damage_at_slot_level;
      const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
      if (!dmgObj) return null;
      const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
      const applicable = levels.filter(l => l <= playerStats.level);
      return applicable.length > 0 ? Math.max(...applicable) : null;
    })();

    if (isCantrip && cantripAutoLevel) {
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
      if (!metaCtx.slotLevel && upcastLevel) {
        metaCtx.slotLevel = upcastLevel;
      }
      if (consumedMaterial && !materialsWaived) await consumeMaterial(playerStats, consumedMaterial.itemName, campaignName);
      onExecute(result.modifiedSpell, result.metaCtx);
    }
    return;
  }

  let sorcerySpell = spell;
  if (spell.level === 0 && spell.damage) {
    const charDmg = spell.damage?.damage_at_character_level;
    const slotDmg = spell.damage?.damage_at_slot_level;
    const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
    if (dmgObj) {
      const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
      const applicable = levels.filter(l => l <= playerStats.level);
      if (applicable.length > 0) {
        const autoLevel = Math.max(...applicable);
        sorcerySpell = { ...spell, level: autoLevel, baseLevel: 0 };
      }
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


