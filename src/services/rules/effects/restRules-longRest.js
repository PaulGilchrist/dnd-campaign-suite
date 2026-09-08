import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import * as storageService from '../../../services/ui/storage.js'
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js'
import { endInvisibility, endGreaterInvisibility } from '../features/invisibilityService.js'
import { clearHuntersMarkConcentration } from './restRules.js'
import { getLongRestResources, spellSlotLevels, getLevelAfterLongRest } from './restRules-constants.js'

// CLA-252 + CLA-308: reset passive per-spell free-cast counters on long rest (one
// free cast PER SPELL per long rest — each freeCastSpells counter re-arms to null).
// FT-070 also resets per-spell-tracking free_spell feature counters (Shadow Touched's
// Shadow Magic: chosen spell + Invisibility) — consumer keys in spellPreparationService
// are `_${feature}_${Spell}_freeCastCount`; the old `_shadowTouchedSpell_freeCastCount`
// reset matched no writer/consumer, leaving those free casts permanently spent.
function resetPerSpellFreeCastCounters(name, playerStats, campaignName) {
  const passives = playerStats.automation?.passives ?? []
  const phantasmalPassive = passives.find(p => p.type === 'phantasmal_creatures')
  if (phantasmalPassive) {
    (phantasmalPassive.freeCastSpells ?? []).forEach(spellName => setRuntimeValue(name, `_Phantasmal_Creatures_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true))
    setRuntimeValue(name, '_phantasmalCreatures_list', [], campaignName, true)
  }
  const shadowArtsPassive = passives.find(p => p.type === 'shadow_arts')
  if (shadowArtsPassive) {
    (shadowArtsPassive.freeCastSpells ?? []).forEach(spellName => setRuntimeValue(name, `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true))
  }
  const perSpellFreeCastFeatures = [
    ...(playerStats.automation?.actions ?? []),
    ...(playerStats.automation?.bonusActions ?? []),
    ...(playerStats.automation?.specialActions ?? []),
  ].filter(e => e.type === 'free_spell' && e.perSpellTracking)
  for (const feature of perSpellFreeCastFeatures) {
    const featureSpells = Array.isArray(feature.spell) ? feature.spell : [feature.spell]
    featureSpells.forEach(spellName => {
      if (!spellName) return
      setRuntimeValue(name, `_${feature.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true)
    })
  }
}

export async function applyLongRest(playerStats, campaignName) {
  const name = playerStats.name

  const charData = {}

  charData.currentHitPoints = playerStats.hitPoints
  charData.tempHp = null

  if (playerStats.spellAbilities) {
    for (const level of spellSlotLevels()) {
      const key = `spell_slots_level_${level}`
      const max = playerStats.spellAbilities[key]
      if (max != null) {
        charData[key] = max
         }
       }
     }

    charData.shortRestHitDice = playerStats.level

      getLongRestResources().forEach((key) => {
        charData[key] = null
        })

    // Clear post-cast rider uses on long rest (e.g. Beguiling Magic)
   const passives = playerStats.automation?.passives ?? []
   for (const p of passives) {
     if ((p.type === 'post_cast_rider' || (p.type === 'passive_rule' && p.riderSave)) && p.riderSave?.recharge === 'long_rest') {
       const riderName = p.name
       const usesKey = `postCastRider_${riderName.replace(/\s+/g, '_')}`
       charData[usesKey] = null
     }
   }

       // Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state
       charData.activeBuffs = [];
       charData.activeConditions = [];
       charData.activeConditionMeta = {};

        // Clear Globe of Invulnerability target effects on long rest
         const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
         if (Array.isArray(storedEffects)) {
             setRuntimeValue('campaign', 'targetEffects', storedEffects.filter(te => te.effect !== 'globe_barrier' && te.effect !== 'antimagic_field' && te.effect !== 'protection_from_evil_and_good' && te.effect !== 'forcecage' && te.effect !== 'polymorph' && te.effect !== 'animal_shapes' && te.effect !== 'true_polymorph' && te.effect !== 'object_transform' && te.effect !== 'shapechange'), campaignName);
         }

         // Remove True Polymorph summoned creatures on long rest
          const longRestCs = getCombatSummary(campaignName);
          if (longRestCs?.creatures) {
             const summonedToRemove = longRestCs.creatures.filter(c => c.summonSource === 'true_polymorph');
             if (summonedToRemove.length > 0) {
                longRestCs.creatures = longRestCs.creatures.filter(c => c.summonSource !== 'true_polymorph');
                storageService.default.set('combatSummary', longRestCs, campaignName);
                setCombatSummaryCache(longRestCs, campaignName);
             }
             const objectTransforms = longRestCs.creatures.filter(c => c.polymorphObject);
             if (objectTransforms.length > 0) {
                for (const creature of objectTransforms) {
                   const original = creature.polymorphOriginal || {};
                   if (original.maxHp !== undefined) creature.maxHp = original.maxHp;
                   if (original.ac !== undefined) creature.ac = original.ac;
                   if (original.speed !== undefined) creature.speed = original.speed;
                   delete creature.polymorphObject;
                   delete creature.objectType;
             const activeConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName) || [];
                   const filteredConds = activeConditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
                   if (filteredConds.length !== activeConditions.length) {
                      setRuntimeValue(creature.name, 'activeConditions', filteredConds, campaignName);
                   }
                }
                storageService.default.set('combatSummary', longRestCs, campaignName);
                setCombatSummaryCache(longRestCs, campaignName);
             }
          }

        // Clear Awakened Mind target on long rest
       charData.awakenedMindTarget = null;

       // Clear Clairvoyant Combatant target on long rest
       charData.clairvoyantCombatantTarget = null;
       charData.clairvoyantCombatantUses = null;

      // Clear death save state on long rest
     charData.deathSaves = [false, false, false];
     charData.deathFailures = [false, false, false];
     charData.isDead = 0;

     // Clear Zealous Presence buff marker on long rest (recharges on long rest or rage expenditure)
     charData.zealousPresenceActive = null;

     // Clear Living Legend active state on long rest
     charData.livingLegendActive = null;
     charData.unerringStrikeUsed = null;

     // Clear Holy Nimbus active state on long rest
     charData.holyNimbusActive = null;

     // Clear Elder Champion active state on long rest
      charData.elderChampionActive = null;

     // Clear Avenging Angel active state on long rest
      charData.avengingAngelActive = null;

      // Clear Peerless Athlete active state on long rest
         charData.peerlessAthleteActive = null;

        // Clear Trance of Order active state on long rest
        charData.tranceOfOrderActive = null;

        // Clear Fanatical Focus used state on long rest (Barbarian feature, per long rest)
        charData.fanaticalFocusUsed = null;

        // Clear Wild Magic Surge badge on long rest
        charData.wildMagicSurgeEffects = null;

        // Clear Large Form active state and rest-used flag on long rest
        charData.largeFormActive = null;
        charData.largeFormActive_restUsed = null;

       // Clear Vow of Enmity active state on long rest
     charData.vowOfEnmityTarget = null;
     charData.vowOfEnmityCostPaid = null;
     const vowTarget = getRuntimeValue(name, 'vowOfEnmityTarget', campaignName);
     if (vowTarget) {
       const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
       const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
       await setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
     }

       const currentExhaustion = getRuntimeValue(name, 'exhaustionLevel')
    if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
      charData.exhaustionLevel = getLevelAfterLongRest(currentExhaustion)
          }

       // Grant Heroic Inspiration from Resourceful trait (Human 2024)
     const hasResourceful = playerStats.specialActions?.some(f => f.name === 'Resourceful')
    if (hasResourceful) {
      charData.hasInspiration = true
          }

    // Spell Thief: reset uses to 1 and clear blocked/stolen spell tracking on long rest
    const hasSpellThief = (playerStats.automation?.reactions ?? []).some(
      r => r.type === 'spell_thief'
    )
     if (hasSpellThief) {
        charData.spellthiefUses = 1
       const blockList = getRuntimeValue(name, '_spellThiefBlockedList', campaignName)
       if (blockList) {
         const entries = JSON.parse(blockList)
         for (const entry of entries) {
           charData[`spellThiefBlocked_${entry.casterName}_${entry.spellName}`] = null
         }
       }
       const stolenList = getRuntimeValue(name, '_spellThiefStolenList', campaignName)
       if (stolenList) {
         const entries = JSON.parse(stolenList)
         for (const entry of entries) {
           charData[`spellThiefStolen_${entry.casterName}_${entry.spellName}`] = null
         }
       }
       charData._spellThiefBlockedList = null
       charData._spellThiefStolenList = null

       // Clear blocked spell entries from each caster's runtime store
       if (blockList) {
         const entries = JSON.parse(blockList)
         for (const entry of entries) {
           const casterBlockList = getRuntimeValue(entry.casterName, '_spellThiefCasterBlock', campaignName)
           if (casterBlockList) {
             const casterEntries = JSON.parse(casterBlockList)
             const updated = casterEntries.filter(e => !(e.thiefName === name && e.spellName === entry.spellName))
             if (updated.length > 0) {
               await setRuntimeValue(entry.casterName, '_spellThiefCasterBlock', JSON.stringify(updated), campaignName)
             } else {
               await setRuntimeValue(entry.casterName, '_spellThiefCasterBlock', null, campaignName)
             }
           }
         }
       }
     }

         // Single atomic write fires ONE SSE event with the complete final state
     setRuntimeBatch(name, charData, campaignName)

     // Clear Clairvoyant Combatant effects from campaign targetEffects on long rest
     const clairvoyantEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredClairvoyantEffects = clairvoyantEffects.filter(e => e.effect !== 'clairvoyant_combatant');
     if (filteredClairvoyantEffects.length !== clairvoyantEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredClairvoyantEffects, campaignName, true)
     }

     // Clear Pass Without Trace on long rest
     const pwtEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredPwtEffects = pwtEffects.filter(e => e.effect !== 'pass_without_trace_bonus');
     if (filteredPwtEffects.length !== pwtEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredPwtEffects, campaignName, true)
     }

     // Clear Blur on long rest
     const blurEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredBlurEffects = blurEffects.filter(e => e.effect !== 'blur');
     if (filteredBlurEffects.length !== blurEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredBlurEffects, campaignName, true)
     }

     // Clear Regenerate on long rest
     const regenEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredRegenEffects = regenEffects.filter(e => e.effect !== 'regenerate');
     if (filteredRegenEffects.length !== regenEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredRegenEffects, campaignName, true)
     }

     // Clear Beacon of Hope on long rest
     const beaconEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredBeaconEffects = beaconEffects.filter(e => e.effect !== 'beacon_of_hope');
     if (filteredBeaconEffects.length !== beaconEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredBeaconEffects, campaignName, true)
     }

     // Clear Resistance on long rest
     const resEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredResEffects = resEffects.filter(e => e.effect !== 'resistance_damage_reduction');
     if (filteredResEffects.length !== resEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredResEffects, campaignName, true)
     }

     // Clear Barkskin on long rest
     const barkskinEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredBarkskinEffects = barkskinEffects.filter(e => e.effect !== 'barkskin');
     if (filteredBarkskinEffects.length !== barkskinEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredBarkskinEffects, campaignName, true)
     }

     // Clear Enhance Ability on long rest
     const enhanceAbilityEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredEnhanceAbilityEffects = enhanceAbilityEffects.filter(e => e.effect !== 'enhance_ability');
     if (filteredEnhanceAbilityEffects.length !== enhanceAbilityEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredEnhanceAbilityEffects, campaignName, true)
     }

     // Clear Circle of Power on long rest
     const circleOfPowerEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredCircleOfPowerEffects = circleOfPowerEffects.filter(e => e.effect !== 'circle_of_power');
     if (filteredCircleOfPowerEffects.length !== circleOfPowerEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredCircleOfPowerEffects, campaignName, true)
     }

     // Clear Foresight on long rest
     const foresightEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredForesightEffects = foresightEffects.filter(e => e.effect !== 'foresight' && e.effect !== 'advantage_attacks' && e.effect !== 'advantage_saves' && e.effect !== 'advantage_abilities');
     if (filteredForesightEffects.length !== foresightEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredForesightEffects, campaignName, true)
     }

     // Clear Starry Form on long rest
     const starryEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const filteredStarryEffects = starryEffects.filter(e => e.effect !== 'starry_form');
     if (filteredStarryEffects.length !== starryEffects.length) {
       setRuntimeValue('campaign', 'targetEffects', filteredStarryEffects, campaignName, true)
     }

     // End Wild Shape on long rest
     const wildShapeEffects = getRuntimeValue('campaign', 'targetEffects') || [];
     const wildShapeTargets = wildShapeEffects.filter(te => te.effect === 'wild_shape').map(te => te.source);
     for (const wsSource of wildShapeTargets) {
       const cs = getCombatSummary(campaignName);
       if (cs) {
         const druidCreature = cs.creatures?.find(c => c.name === wsSource && c.type === 'player');
         if (druidCreature) {
           delete druidCreature.wildShapeSource;
           delete druidCreature.beastIndex;
           delete druidCreature.beastName;
         }
         cs.creatures = cs.creatures.filter(c => !(c.wildShapeSource === wsSource && c.type !== 'player'));
         storageService.default.set('combatSummary', cs, campaignName);
       }
       const te = getRuntimeValue('campaign', 'targetEffects') || [];
       const filtered = te.filter(e => !(e.effect === 'wild_shape' && e.source === wsSource));
       if (filtered.length !== te.length) {
         setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
       }
       const buffs = getRuntimeValue(wsSource, 'activeBuffs') || [];
       setRuntimeValue(wsSource, 'activeBuffs', buffs.filter(b => b.effect !== 'shape_shift'), campaignName);
       setRuntimeValue(wsSource, 'circleFormsAC', null, campaignName);
       setRuntimeValue(wsSource, 'tempHp', 0, campaignName);
     }

     // Clear regenerateActive flag from all targets and set them to full HP on long rest
     const longRestAllKeys = getAllStoreKeys();
     for (const key of longRestAllKeys) {
       if (typeof key !== 'string') continue;
       const regenActive = getRuntimeValue(key, 'regenerateActive', campaignName);
       if (regenActive) {
         setRuntimeValue(key, 'regenerateActive', false, campaignName);
         const storedMaxHp = getRuntimeValue(key, 'hitPoints', campaignName);
         if (storedMaxHp != null) {
           setRuntimeValue(key, 'currentHitPoints', storedMaxHp, campaignName);
         }
       }
     }

     setRuntimeValue(name, 'resistanceUsedThisTurn', null, campaignName)

     // Clear Wrath of the Sea badge on long rest
     setRuntimeValue(name, 'wrathOfTheSeaActive', null, campaignName, true)
     setRuntimeValue(name, 'wrathOfTheSeaDc', null, campaignName, true)
     setRuntimeValue(name, 'wrathOfTheSeaWisMod', null, campaignName, true)
     setRuntimeValue(name, 'wrathOfTheSeaSource', null, campaignName, true)

     // Natural Recovery: reset free cast tracking on long rest
     const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
       p => p.type === 'natural_recovery'
     )
     if (hasNaturalRecovery) {
       charData.naturalRecoveryFreeCast = null
       charData.naturalRecoveryFreeCastUsed = null
       charData.naturalRecoverySlots = null
       charData._circleOfTheLandType = null
     }

     // Handle Greater Divine Intervention Wish cooldown (2d4 long rests) — must run AFTER batch reset
     const wishCooldown = getRuntimeValue(name, '_divineInterventionWishCooldown', campaignName)
     if (wishCooldown != null && Number(wishCooldown) > 0) {
       const newCooldown = Number(wishCooldown) - 1
       if (newCooldown <= 0) {
         setRuntimeValue(name, '_divineInterventionWishCooldown', 0, campaignName, true)
       } else {
         setRuntimeValue(name, '_divineInterventionWishCooldown', newCooldown, campaignName, true)
         setRuntimeValue(name, 'divineInterventionUses', -1, campaignName, true)
       }
     }

     clearAllExpirationEffects(name, campaignName)
     clearHuntersMarkConcentration(name, campaignName)
   clearAllConcentrations(campaignName, name)

     // Clear Invisibility buff and condition (not managed by expiration system)
     const invisKey = `_activeInvisibility_${name}`
     const invisCaster = getRuntimeValue('campaign', invisKey, campaignName)
     if (invisCaster) {
       endInvisibility(name, campaignName, 'target finished a rest')
       setRuntimeValue('campaign', invisKey, null, campaignName)
     }

     // Clear Greater Invisibility buff and condition (not managed by expiration system)
     const greaterInvisKey = `_activeGreaterInvisibility_${name}`
     const greaterInvisCaster = getRuntimeValue('campaign', greaterInvisKey, campaignName)
     if (greaterInvisCaster) {
       endGreaterInvisibility(name, campaignName, 'target finished a rest')
       setRuntimeValue('campaign', greaterInvisKey, null, campaignName)
     }

       // Reset Psionic Strike once-per-turn flag on long rest
      setRuntimeValue(name, 'psionicStrikeUsedThisTurn', null, campaignName, true)

     // Reset Uncanny Metabolism tracking on long rest
     setRuntimeValue(name, 'uncannyMetabolismUsed', false, campaignName, true)

     // Clear Elemental Attunement active state on long rest
     setRuntimeValue(name, 'elementalAttunementActive', null, campaignName, true)
     setRuntimeValue(name, 'elementalAttunementElement', null, campaignName, true)

     // Clear Elemental Epitome active state on long rest
     setRuntimeValue(name, 'elementalEpitomeActive', null, campaignName, true)
     setRuntimeValue(name, 'epitomeResistanceType', null, campaignName, true)
     setRuntimeValue(name, 'epitomeEmpoweredUsedRound', null, campaignName, true)
     setRuntimeValue(name, 'destructiveStrideActive', null, campaignName, true)
     setRuntimeValue(name, 'destructiveStrideDamageType', null, campaignName, true)

     // Reset Boon Of Energy Resistance chosen types on long rest
     setRuntimeValue(name, '_Energy_Resistances_chosenTypes', null, campaignName, true)

     // Reset Magic Initiate free cast counters on long rest
     const miInstances = getRuntimeValue(name, '_magicInitiateInstances', campaignName) || playerStats.magicInitiateInstances
     if (miInstances && Array.isArray(miInstances)) {
       miInstances.forEach((inst, idx) => {
         const featureName = `Level 1 Spell [Instance ${idx + 1}]`;
         const freeCastKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
         setRuntimeValue(name, freeCastKey, null, campaignName, true)
       })
     }

     // Reset Fey Touched free cast counter on long rest
     if (playerStats.feyTouchedSpell) {
       setRuntimeValue(name, '_feyTouchedSpell_freeCastCount', null, campaignName, true)
     }

     // FT-070: Shadow Touched per-spell free-cast counter resets moved into
     // resetPerSpellFreeCastCounters (aligned consumer keys, shared machinery).

     // FT-068: Reset Ritual Master Quick Ritual counter on long rest
     const hasRitualMasterGrant = (playerStats.automation?.ritualSpells || []).some(f => f.chosenSpells)
       || (playerStats.feats || []).includes('Ritual Master')
     if (hasRitualMasterGrant) {
       setRuntimeValue(name, '_Ritual_Master_quickRitualUsed', null, campaignName, true)
     }

     // Reset Undying Sentinel (Oath of Glory level 15) on long rest
     setRuntimeValue(name, 'undyingSentinelUsed', false, campaignName, true)

     // Reset Relentless Endurance (Orc race trait) on long rest
     setRuntimeValue(name, 'relentlessEnduranceUsed', false, campaignName, true)

     // Reset Boon of Fate (Epic Boon) on long rest
     setRuntimeValue(name, 'boonOfFateUsed', false, campaignName, true)

     // Reset Signature Spells on long rest
     const selection = getRuntimeValue(name, 'SignatureSpells_selection', campaignName)
     if (selection && Array.isArray(selection)) {
       for (const spell of selection) {
         setRuntimeValue(name, `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`, null, campaignName, true)
       }
     }

     // Celestial Resilience: Grant temp HP on long rest for Celestial Patron
     let celestialResilienceAllies = null;
      if (playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron') {
        const features = playerStats.specialActions || []
           const feature = features.find(f => f.name === 'Celestial Resilience')
          if (feature) {
             if (playerStats.level == null) {
               console.error('[restRules] applyLongRest: playerStats.level is missing for celestial patron temp HP')
               throw new Error('playerStats.level is required for celestial patron temp HP')
             }
             const warlockLevel = playerStats.level
             const chaMod = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus || 0
             const selfTempHp = warlockLevel + chaMod
              if (selfTempHp > 0) {
                setTempHp(name, selfTempHp, campaignName)
                addEntry(campaignName, {
                 type: 'ability_use',
                 characterName: name,
                 abilityName: 'Celestial Resilience',
                 description: `${name} gains ${selfTempHp} temporary hit points from Celestial Resilience (long rest).`,
                 timestamp: Date.now(),
            }).catch((e) => { console.error('[celestialResilience] Error:', e); });

            // Gather allies for modal
            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
              const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'long_rest');
              if (celestialResult?.allyTempHp && celestialResult?.allies && celestialResult.allies.length > 0) {
                celestialResilienceAllies = {
                  creatureTargets: celestialResult.allies,
                  allyTempHp: celestialResult.allyTempHp,
                  selfTempHp: celestialResult.selfTempHp,
                  maxTargets: celestialResult.maxAllies,
                };
              }
             }
             }
           }
         }

         // Reset Bastion of Law ward on long rest
      const wardTarget = getRuntimeValue(name, 'bastionOfLawWardTarget', campaignName)
      setRuntimeValue(name, 'bastionOfLawActive', false, campaignName, true)
      setRuntimeValue(name, 'bastionOfLawWardDice', [], campaignName, true)
      setRuntimeValue(name, 'bastionOfLawWardTarget', null, campaignName, true)
      // Clear ward from the target character
      if (wardTarget) {
       setRuntimeValue(wardTarget, 'bastionOfLawActive', false, campaignName, true)
       setRuntimeValue(wardTarget, 'bastionOfLawWardDice', [], campaignName, true)
       setRuntimeValue(wardTarget, 'bastionOfLawWardSource', null, campaignName, true)
       setRuntimeValue(wardTarget, 'bastionOfLawWardUsed', null, campaignName, true)
       setRuntimeValue(wardTarget, 'bastionOfLawLastAttackDamage', null, campaignName, true)
      }

      // Restore Arcane Ward on long rest (only for Abjurers)
      const hasArcaneWard = (playerStats.automation?.passives ?? []).some(p => p.type === 'arcane_ward' || (p.type === 'passive_rule' && p.effect === 'arcane_ward'))
      if (hasArcaneWard) {
        const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0
        const wardMax = (2 * playerStats.level) + intMod
        setRuntimeValue(name, 'arcaneWardActive', false, campaignName, true)
        setRuntimeValue(name, 'arcaneWardHp', wardMax, campaignName, true)
        setRuntimeValue(name, 'arcaneWardMax', wardMax, campaignName, true)
      }

    // Refresh Portent dice on long rest
    const hasPortent = (playerStats.automation?.specialActions ?? []).some(
      a => a.type === 'portent' || a.name === 'Portent'
    ) || (playerStats.automation?.passives ?? []).some(
      a => a.type === 'portent' || a.name === 'Portent'
    )
    if (hasPortent) {
      const maxDice = playerStats.level >= 14 ? 3 : 2
      const dice = []
      for (let i = 0; i < maxDice; i++) {
        dice.push(rollD20())
      }
      setRuntimeValue(name, 'portentDice', JSON.stringify(dice), campaignName, true)
      setRuntimeValue(name, 'portentUsedThisTurn', null, campaignName, true)
    }

    // Reset per-spell free-cast counters on long rest — CLA-252 Phantasmal Creatures +
    // CLA-308 Shadow Arts (one free cast PER SPELL per long rest — each freeCastSpells
    // counter re-arms to null; null = re-armed/available).
    resetPerSpellFreeCastCounters(name, playerStats, campaignName)

    // Reset Favored Enemy free cast count on long rest
    setRuntimeValue(name, '_Favored_Enemy_freeCastCount', null, campaignName, true)

    // Reset Stonecunning uses on long rest
    setRuntimeValue(name, 'stonecunningUses', null, campaignName, true)
    setRuntimeValue(name, 'stonecunningRestTimestamp', null, campaignName, true)

    // Reset Hurl Through Hell uses on long rest
    setRuntimeValue(name, 'hurlThroughHellUses', null, campaignName, true)
    setRuntimeValue(name, 'hurlThroughHellTurnUsed', null, campaignName, true)

    // Reset Adrenaline Rush uses on long rest
    setRuntimeValue(name, 'adrenalineRushUses', null, campaignName, true)
    setRuntimeValue(name, 'adrenalineRushRestTimestamp', null, campaignName, true)

    // Reset Giant Ancestry uses on long rest
    setRuntimeValue(name, 'cloudsJauntUses', null, campaignName, true)
    setRuntimeValue(name, 'firesBurnUses', null, campaignName, true)
    setRuntimeValue(name, 'frostsChillUses', null, campaignName, true)
    setRuntimeValue(name, 'hillsTumbleUses', null, campaignName, true)
    setRuntimeValue(name, 'stonesEnduranceUses', null, campaignName, true)
    setRuntimeValue(name, 'stormsThunderUses', null, campaignName, true)

    // Reset Overchannel use count on long rest
    setRuntimeValue(name, 'Overchannel_useCount', 0, campaignName, true)

    // Reset Hunter's Prey choice on long rest
    setRuntimeValue(name, "_Hunter's_Prey_choice", null, campaignName, true)

    // Reset Hunter's Prey choice on long rest
    setRuntimeValue(name, "_Hunter's_Prey_choice", null, campaignName, true)

    // Chef: Bolstering Treats crafted on Long Rest
    const hasBolsteringTreats = (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    )
    if (hasBolsteringTreats) {
        const craftCount = playerStats.proficiency || 0
        setRuntimeValue(name, 'chefBolsteringTreats', craftCount, campaignName, true)
    }

    // Clear recipient's bolstering treats on long rest
    setRuntimeValue(name, 'bolsteringTreat', null, campaignName, true)

    // Chef: Replenishing Meals reset on Long Rest
    const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
    )
    if (hasReplenishingMeal) {
        const mealMax = 4 + (playerStats.proficiency || 0)
        setRuntimeValue(name, 'replenishingMeals', mealMax, campaignName, true)
    }

    // Log long rest to campaign log
    const logEntries = [];
    logEntries.push(`${name} takes a long rest.`);
    const resources = [];
    resources.push('All hit dice restored');
    resources.push('All spell slots restored');
    if (playerStats.class?.name === 'Warlock') resources.push('Pact Magic (Warlock spell slots)');
    if (hasPortent) resources.push('Portent dice');
    if (hasBolsteringTreats) resources.push('Bolstering Treats');
    if (hasReplenishingMeal) resources.push('Replenishing Meals');
    const hasCelestialResilience = playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron';
    if (hasCelestialResilience && playerStats.specialActions?.some(f => f.name === 'Celestial Resilience')) resources.push('Celestial Resilience (temp HP)');
    if (hasNaturalRecovery) resources.push('Natural Recovery (spell slots)');
    if (playerStats.class?.name === 'Warlock') resources.push('Magical Cunning (feature reset)');
    if ((playerStats.automation?.reactions ?? []).some(r => r.type === 'telekinetic_thrust')) resources.push('Telekinetic Thrust (use restored)');
    if (resources.length > 0) {
        logEntries.push(`Resources restored: ${resources.join(', ')}`);
    }
    if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
        const newExhaustion = getLevelAfterLongRest(currentExhaustion);
        logEntries.push(`Exhaustion: ${currentExhaustion} → ${newExhaustion}`);
    }

    // Circle of the Stars: Star Map free cast count on Long Rest (reset to WIS modifier, min 1)
    const isDruid = playerStats.class?.name === 'Druid'
    const isCircleOfTheStars = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars'
    if (isDruid && isCircleOfTheStars && playerStats.level >= 3) {
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
        const maxUses = Math.max(wis?.bonus || 0, 1)
        setRuntimeValue(name, '_Star_Map_freeCastCount', maxUses, campaignName, true)
        logEntries.push(`Star Map free casts: ${maxUses}`)
    }

    // Circle of the Stars: Cosmic Omen Star Map roll on Long Rest
    const isDruid2 = playerStats.class?.name === 'Druid'
    const isCircleOfTheStars2 = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars'
    if (isDruid2 && isCircleOfTheStars2 && playerStats.level >= 6) {
        const starMapRoll = rollD20()
        const isEven = starMapRoll % 2 === 0
        const omenType = isEven ? 'Weal' : 'Woe'
        setRuntimeValue(name, 'cosmicOmenEffect', JSON.stringify({
            type: omenType,
            isEven,
            starMapRoll,
        }), campaignName, true)
        clearAllExpirationEffects(name, campaignName)
        logEntries.push(`Cosmic Omen Star Map: ${starMapRoll} → ${omenType}`)
    }
    try {
        addEntry(campaignName, { type: 'long_rest', message: logEntries.join(' | ') });
    } catch (err) {
        console.error('[restRules] Failed to log long rest:', err.message);
    }

    return { celestialResilienceAllies }
}
