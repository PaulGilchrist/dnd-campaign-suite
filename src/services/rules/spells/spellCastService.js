import { rollExpression } from '../../dice/diceRoller.js';
import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import { isInnateSorceryActive, getActiveBuffs } from '../../combat/buffs/buffService.js';
import { triggerPostCastRiderSaves, triggerSpellThief, triggerBewitchingMagic, triggerSoulstitchSpells, hasEmpoweredEvocation, getEmpoweredEvocationIntModifier } from './postCastRiderService.js';
import { triggerPostCastSelfHeals, triggerPostCastAllyHeals } from './postCastHealService.js';
import { triggerSmiteOfProtection } from '../features/smiteOfProtectionService.js';
import { triggerInspiringSmite } from '../features/inspiringSmiteService.js';
import { triggerPrimalCompanionSpellShare } from '../features/primalCompanionSpellShareService.js';
import { triggerWildMagicSurge } from '../features/wildMagicSurgeService.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { executeHandler } from '../../automation/index.js';
import { rollExpressionMaximized } from '../../dice/diceRoller.js';
import { addExpiration } from '../effects/expirations.js';
import { triggerFalseLife } from '../features/falseLifeService.js';
import { triggerHealingWord } from '../features/healingWordService.js';
import { triggerMassCureWounds } from '../features/massCureWoundsService.js';
import { triggerMassHeal } from '../features/massHealService.js';
import { triggerMassHealingWord } from '../features/massHealingWordService.js';
import { triggerPrayerOfHealing } from '../features/prayerOfHealingService.js';
import { triggerFear } from '../features/fearService.js';
import { triggerFeignDeath } from '../features/feignDeathService.js';
import { triggerFleshToStone } from '../features/fleshToStoneService.js';
import { triggerRemoveCurse } from '../features/removeCurseService.js';
import { triggerHoldMonster } from '../features/holdMonsterService.js';
import { triggerHypnoticPattern } from '../features/hypnoticPatternService.js';
import { triggerMassSuggestion } from '../features/massSuggestionService.js';
import { triggerSuggestion } from '../features/suggestionService.js';
import { triggerForesight } from '../features/foresightService.js';
import { triggerResilientSphere } from '../features/resilientSphereService.js';
import { triggerOttoDance } from '../features/ottoDanceService.js';
import { triggerFriends, endFriendsOnHostileAction } from '../features/friendsService.js';
import { triggerRayOfEnfeeblement } from '../features/rayOfEnfeeblementService.js';
import { endInvisibilityOnHostileAction } from '../features/invisibilityService.js';
import { triggerGlobeOfInvulnerability } from '../features/globeOfInvulnerabilityService.js';
import { triggerHeroism } from '../features/heroismService.js';
import { triggerHolyAura } from '../features/holyAuraService.js';
import { triggerSilence, getSilenceSource, isCreatureInSilenceZone } from '../features/silenceService.js';
import { triggerSlow } from '../features/slowService.js';
import { triggerPowerWordFortify } from '../features/powerWordFortifyService.js';
import { triggerPowerWordStun } from '../features/powerWordStunService.js';
import { triggerSeeInvisibility } from '../features/seeInvisibilityService.js';
import { triggerSleep } from '../features/sleepService.js';
import { triggerStinkingCloud } from '../features/stinkingCloudService.js';
import { triggerTashasHideousLaughter } from '../features/tashasHideousLaughterService.js';
import { executeHandler as executeLongstrider } from '../../automation/index.js';
import { executeHandler as executeProtectionFromEnergy } from '../../automation/index.js';
import { executeHandler as executeProtectionFromPoison } from '../../automation/index.js';
import { executeHandler as executeStoneSkin } from '../../automation/index.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';

function applyEldritchHex(spell, playerStats, campaignName, targetName) {
    if (spell.name !== 'Hex') return;

    if (playerStats.automation?.passives == null) {
        console.error('[spellCast] applyEldritchHex: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for Eldritch Hex');
    }
    const passives = playerStats.automation.passives;
    const hasEldritchHex = passives.some(p => p.name === 'Eldritch Hex' && p.type === 'conditional_disadvantage');
    if (!hasEldritchHex) return;

    if (!targetName) return;

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects');
    if (storedEffects == null || typeof storedEffects !== 'object' || !Array.isArray(storedEffects)) {
        console.error('[spellCast] applyEldritchHex: targetEffects is not an array');
        throw new Error('targetEffects must be an array');
    }
    const effects = storedEffects;

    const existingHexIndex = effects.findIndex(
        te => te.target === targetName && te.effect === 'hex_save_disadvantage' && te.source === playerStats.name
    );

    const hexEffect = {
        target: targetName,
        effect: 'hex_save_disadvantage',
        source: playerStats.name,
        duration: 'hex_duration',
    };

    if (existingHexIndex >= 0) {
        effects[existingHexIndex] = hexEffect;
    } else {
        effects.push(hexEffect);
    }

    setRuntimeValue(campaignName, 'targetEffects', effects, campaignName);
}

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName, characters }) {
    if (getActiveBuffs(playerStats.name, campaignName).some(b => b.blocksSpellcasting)) {
        console.warn(`[spellCast] ${playerStats.name} cannot cast spells (blocked by active buff)`);
        return;
    }

    // Silence — block Verbal components if caster is in a silence zone
    if (spell.components && spell.components.includes('V')) {
        const silenceCaster = getSilenceSource(playerStats.name, campaignName);
        if (silenceCaster && isCreatureInSilenceZone(playerStats.name, silenceCaster, campaignName)) {
            console.warn(`[spellCast] ${playerStats.name} cannot cast ${spell.name} — Verbal components blocked by Silence`);
            return;
        }
    }

    // If casting any spell other than Friends, end active Friends early
    // (Friends ends early when you make an attack roll, deal damage, or force a save)
    if (spell.name && spell.name.toLowerCase() !== 'friends') {
        endFriendsOnHostileAction(playerStats.name, campaignName);
    }

    // Casting any spell ends active Invisibility early on the caster
    endInvisibilityOnHostileAction(playerStats.name, campaignName);

    if (spell.casting_time === '1 action') {
        setRuntimeValue(playerStats.name, 'lastActionSpellCast', 1, campaignName);
    }

    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const formula =
     (slotDmg && slotDmg[spell.level]) ||
     (charDmg && charDmg[spell.level]) ||
     (slotDmg && Object.keys(slotDmg).length ? slotDmg[Object.keys(slotDmg)[0]] : null) ||
     (charDmg && Object.keys(charDmg).length ? charDmg[Object.keys(charDmg)[0]] : null) ||
    null;
  const damageType = spell.damage?.damage_type || '';

  const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
  let spellToHit = playerStats.spellAbilities?.toHit || 0;
  let spellSaveDc;
  if (playerStats.spellAbilities?.saveDc == null) {
    if (playerStats.proficiency == null) {
      console.error('[spellCast] executeSpellCast: playerStats.proficiency is missing')
      throw new Error('playerStats.proficiency is required for spell save DC calculation')
    }
    spellSaveDc = 8 + playerStats.proficiency;
  } else {
    spellSaveDc = playerStats.spellAbilities.saveDc;
  }
  if (cantripSpellAbility && playerStats.abilities) {
    const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
    if (ability) {
      spellToHit = ability.bonus + playerStats.proficiency;
      spellSaveDc = 8 + ability.bonus + playerStats.proficiency;
    }
  }

    let spellCastingMod = 0;
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            spellCastingMod = ability.bonus;
        }
    } else if (playerStats.spellAbilities) {
        spellCastingMod = playerStats.spellAbilities.modifier || 0;
    }

    if (!formula) {
        if (spell.name.toLowerCase() === 'power word heal' && metaCtx?.multiTarget) {
            const target = await getTargetInfo();
            if (target?.name) {
                await applyPowerWordHealToTarget(target.name, playerStats, campaignName);
                await applyPowerWordHealToTarget(metaCtx.multiTarget, playerStats, campaignName);
            }
        }

        // Power Word Fortify — multi-target temp HP (up to 6 creatures within range)
        if (spell.name && spell.name.toLowerCase() === 'power word fortify') {
            await triggerPowerWordFortify(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Fear — multi-target WIS save for all creatures (30-ft cone)
        if (spell.name && spell.name.toLowerCase() === 'fear' && spell.dc) {
            const fearInnateBonus = innateSorceryActive ? 1 : 0;
            const fearMetaCtx = { ...metaCtx, spellSaveDc: spellSaveDc + fearInnateBonus };
            await triggerFear(spell, fearMetaCtx, playerStats, campaignName, mapName);
            triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
                console.error('[spellCast] False Life trigger failed:', e);
            });
            return;
        }

        // Regenerate — heal target, set turn-start healing, track body part regrowth
        if (spell.name && spell.name.toLowerCase() === 'regenerate') {
            const target = await getTargetInfo();
            if (target?.name) {
                await applyRegenerateSpell(spell, target, playerStats, campaignName);
            }
            return;
        }

        // Mass Cure Wounds — multi-target healing in 30-ft radius sphere
        if (spell.name && spell.name.toLowerCase() === 'mass cure wounds') {
            await triggerMassCureWounds(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Mass Healing Word — up to 6 creatures regain 2d4+MOD HP (bonus action)
        if (spell.name && spell.name.toLowerCase() === 'mass healing word') {
            await triggerMassHealingWord(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Mass Heal — 9th level multi-target healing (up to 700 HP) + condition removal
        if (spell.name && spell.name.toLowerCase() === 'mass heal') {
            await triggerMassHeal(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Prayer of Healing — up to 5 creatures gain Short Rest benefits + 2d8 HP (10 min casting, Long Rest cooldown per creature)
        if (spell.name && spell.name.toLowerCase() === 'prayer of healing') {
            await triggerPrayerOfHealing(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Feign Death — buff/condition spell with no damage or save
        if (spell.name && spell.name.toLowerCase() === 'feign death') {
            const target = await getTargetInfo();
            const feignMetaCtx = { ...metaCtx, targetName: target?.name };
            await triggerFeignDeath(spell, feignMetaCtx, playerStats, campaignName, mapName);
            return;
        }

        // See Invisibility — self-target buff that lets you see invisible creatures
        if (spell.name && spell.name.toLowerCase() === 'see invisibility') {
            await triggerSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Heal — restores 70 HP and removes Blinded, Deafened, Poisoned conditions
        if (spell.name && spell.name.toLowerCase() === 'heal') {
            const target = await getTargetInfo();
            await triggerHeal(spell, { ...metaCtx, targetName: target?.name }, playerStats, campaignName, mapName);
            return;
        }

        // Flesh to Stone — CON save, progressive Restrained→Petrified
        if (spell.name && spell.name.toLowerCase() === 'flesh to stone') {
            await triggerFleshToStone(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Hold Monster / Hold Person — WIS save, Paralyzed condition with end-of-turn repeat save
        if (spell.name && (spell.name.toLowerCase() === 'hold monster' || spell.name.toLowerCase() === 'hold person')) {
            await triggerHoldMonster(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Power Word Stun — no save, HP threshold check: ≤150 HP = Stunned (with repeat CON save), >150 HP = Speed 0
        if (spell.name && spell.name.toLowerCase() === 'power word stun') {
            await triggerPowerWordStun(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Hypnotic Pattern — multi-target WIS save for all creatures in 30-ft cube (can see)
        if (spell.name && spell.name.toLowerCase() === 'hypnotic pattern') {
            await triggerHypnoticPattern(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Slow — multi-target WIS save, applies speed halved, -2 AC, no reactions, action/bonus limit
        if (spell.name && spell.name.toLowerCase() === 'slow') {
            await triggerSlow(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Mass Suggestion — multi-target WIS save, applies Charmed condition to failed targets
        if (spell.name && spell.name.toLowerCase() === 'mass suggestion') {
            await triggerMassSuggestion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Suggestion — single target WIS save, applies Charmed condition to failed target
        if (spell.name && spell.name.toLowerCase() === 'suggestion') {
            await triggerSuggestion(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Otto's Irresistible Dance / Irresistible Dance — single target WIS save, Charmed + speed_zero + save/attack modifiers
        if (spell.name && (spell.name.toLowerCase() === "otto's irresistible dance" || spell.name.toLowerCase() === 'irresistible dance')) {
            await triggerOttoDance(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Otiluke's Resilient Sphere / Resilient Sphere — DEX save, encloses target in an immovable sphere
        if (spell.name && (spell.name.toLowerCase() === "otiluke's resilient sphere" || spell.name.toLowerCase() === 'resilient sphere')) {
            await triggerResilientSphere(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Foresight — buffs target with advantage on D20 tests and disadvantage on attacks against it
        if (spell.name && spell.name.toLowerCase() === 'foresight') {
            const target = await getTargetInfo();
            const foresightMetaCtx = { ...metaCtx, targetName: target?.name };
            await triggerForesight(spell, foresightMetaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Friends — single-target WIS save or Charmed, with auto-save conditions and early-end triggers
        if (spell.name && spell.name.toLowerCase() === 'friends') {
            const friendsTarget = await getTargetInfo();
            const friendsMetaCtx = { ...metaCtx, spellSaveDc, targetName: friendsTarget?.name };
            await triggerFriends(spell, friendsMetaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Ray of Enfeeblement (2024) — CON save: success = target has Disadvantage on next attack; failure = STR check disadvantage + 1d8 damage reduction
        if (spell.name && spell.name.toLowerCase() === 'ray of enfeeblement') {
            const rayTarget = await getTargetInfo();
            await triggerRayOfEnfeeblement(spell, { ...metaCtx, spellSaveDc, targetName: rayTarget?.name }, playerStats, campaignName, mapName);
            return;
        }

        // Globe of Invulnerability — toggle passive barrier that blocks spells of level 5 or lower
        if (spell.name && spell.name.toLowerCase() === 'globe of invulnerability') {
            await triggerGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Silence — 20-ft-radius sphere: creatures inside are Deafened, immune to Thunder, cannot cast Verbal spells
        if (spell.name && spell.name.toLowerCase() === 'silence') {
            await triggerSilence(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Sleep — multi-target WIS save for all creatures in 5-ft-radius sphere: Incapacitated with repeating save
        if (spell.name && spell.name.toLowerCase() === 'sleep') {
            await triggerSleep(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Stinking Cloud — multi-target CON save for all creatures in 20-ft-radius sphere: Poisoned with repeating save
        if (spell.name && spell.name.toLowerCase() === 'stinking cloud') {
            await triggerStinkingCloud(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Tasha's Hideous Laughter — single target WIS save: Prone + Incapacitated with repeating save (end of turn + on damage)
        if (spell.name && spell.name.toLowerCase() === "tasha's hideous laughter") {
            await triggerTashasHideousLaughter(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
            return;
        }

        // Heroism — grants Frightened immunity and temp HP at start of each turn
        if (spell.name && spell.name.toLowerCase() === 'heroism') {
            const target = await getTargetInfo();
            const heroismMetaCtx = { ...metaCtx, targetName: target?.name };
            await triggerHeroism(spell, heroismMetaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Holy Aura — 30-ft emanation: allies in aura get save advantage, attackers get attack disadvantage, Fiend/Undead melee attackers save vs CON or Blinded
        if (spell.name && spell.name.toLowerCase() === 'holy aura') {
            await triggerHolyAura(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Longstrider — target's Speed increases by 10 feet for duration
        if (spell.name && spell.name.toLowerCase() === 'longstrider') {
            const action = {
                name: 'Longstrider',
                spell: spell,
                automation: { type: 'longstrider' },
            };
            await executeLongstrider(action, playerStats, campaignName, mapName);
            return;
        }

        if (spell.dc && spell.status_effects && spell.status_effects.length > 0) {
         const target = await getTargetInfo();
         const context = {
           targetName: target?.name,
           attackerName: playerStats.name,
            ...rollContext,
           saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
           saveType: spell.dc.dc_type,
           dcSuccess: spell.dc.dc_success,
           metamagicHeighten: hasInvisible,
           isCantrip: spell.level === 0,
         };
         if (spell.status_effects && spell.status_effects.length > 0) {
           context.statusEffects = spell.status_effects;
         }
          rollDamage(spell.name, '0', 0, [], 0, context);
        }

        // Generic healing: use heal_at_slot_level for any healing spell without a dedicated handler
        if (spell.heal_at_slot_level) {
            const target = await getTargetInfo();
            if (target?.name) {
                if (metaCtx?.slotLevel == null && spell.level == null) {
                    console.error('[spellCast] executeSpellCast: slot level is missing (metaCtx.slotLevel and spell.level) for healing spell')
                    throw new Error('slot level is required for healing spell')
                  }
                  const slotLevel = metaCtx?.slotLevel || spell.level;
                const healAtSlotLevel = spell.heal_at_slot_level;
                let expression = healAtSlotLevel[slotLevel];
                if (!expression) {
                    const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
                    const highestBelow = levels.filter(l => l <= slotLevel).pop();
                    if (highestBelow) {
                        expression = healAtSlotLevel[highestBelow];
                    }
                }
                if (expression) {
                    if (expression === 'max') {
                        const combatSummary = await getCombatContext(campaignName);
                        if (combatSummary) {
                            const creature = combatSummary.creatures.find(c => c.name === target.name);
                            const maxHp = creature?.maxHp || playerStats.hitPoints || 0;
                            const currentHp = creature?.currentHp ?? getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? maxHp;
                            const actualHeal = maxHp - currentHp;
                            if (actualHeal > 0) {
                                applyHealingToTarget(combatSummary, target.name, actualHeal, campaignName);
                            }
                            postLogEntry(campaignName, {
                                type: 'hp_change',
                                targetName: target.name,
                                delta: actualHeal,
                                currentHp: maxHp,
                                maxHp,
                                isHealing: true,
                                sourceName: playerStats.name,
                                note: spell.name,
                                timestamp: Date.now(),
                            });
                        }
                    } else {
                        let resolvedExpression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
                        const result = rollExpression(resolvedExpression);
                        if (result) {
                            const combatSummary = await getCombatContext(campaignName);
                            if (combatSummary) {
                                const creature = combatSummary.creatures.find(c => c.name === target.name);
                                const maxHp = creature?.maxHp || playerStats.hitPoints || 0;
                                const currentHp = creature?.currentHp ?? getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? maxHp;
                                const actualHeal = Math.min(result.total, maxHp - currentHp);
                                if (actualHeal > 0) {
                                    applyHealingToTarget(combatSummary, target.name, actualHeal, campaignName);
                                }
                                postLogEntry(campaignName, {
                                    type: 'hp_change',
                                    targetName: target.name,
                                    delta: actualHeal,
                                    currentHp: Math.min(maxHp, currentHp + actualHeal),
                                    maxHp,
                                    isHealing: true,
                                    sourceName: playerStats.name,
                                    note: spell.name,
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    }
                }
            }
            return;
        }

        triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
            console.error('[spellCast] False Life trigger failed:', e);
        });

         triggerHealingWord(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
             console.error('[spellCast] Healing Word trigger failed:', e);
         });

          // Protection from Energy — apply resistance buff to target
          if (spell.name && spell.name.toLowerCase() === 'protection from energy') {
              const target = await getTargetInfo();
              if (target) {
                  const action = {
                      name: 'Protection from Energy',
                      spell: spell,
                      automation: spell.automation ?? {},
                  };
                  await executeProtectionFromEnergy(action, playerStats, campaignName, mapName);
              }
          }

           // Protection from Poison — remove Poisoned condition and apply buff
            if (spell.name && spell.name.toLowerCase() === 'protection from poison') {
                const target = await getTargetInfo();
                if (target) {
                    const action = {
                        name: 'Protection from Poison',
                        spell: spell,
                        automation: spell.automation ?? {},
                    };
                    await executeProtectionFromPoison(action, playerStats, campaignName, mapName);
                }
            }

            // Stone Skin — apply resistance to Bludgeoning, Piercing, and Slashing damage
            if (spell.name && spell.name.toLowerCase() === 'stone skin') {
                const target = await getTargetInfo();
                if (target) {
                    const action = {
                        name: 'Stone Skin',
                        spell: spell,
                        automation: spell.automation ?? {},
                    };
                    await executeStoneSkin(action, playerStats, campaignName, mapName);
                }
            }

            // Remove Curse — remove curses and break attunement on target
            if (spell.name && spell.name.toLowerCase() === 'remove curse') {
                await triggerRemoveCurse(spell, metaCtx, playerStats, campaignName, mapName);
            }

            // Resistance (2024) — apply damage reduction buff to target
            if (spell.name && spell.name.toLowerCase() === 'resistance') {
                const target = await getTargetInfo();
                if (target) {
                    const action = {
                        name: 'Resistance',
                        spell: spell,
                        automation: spell.automation ?? {},
                    };
                    await executeHandler(action, playerStats, campaignName, mapName);
                }
            }

        // Generic automation routing — any spell with automation.type that hasn't been handled by a specific case above
        // This ensures all automated spells (shield, blade_ward, buff_ally, temp_buff, etc.) work when cast
        if (spell.automation?.type) {
            const target = await getTargetInfo();
            if (target) {
                const action = {
                    name: spell.name,
                    spell: spell,
                    automation: spell.automation,
                };
                await executeHandler(action, playerStats, campaignName, mapName);
            }
            return;
        }
    }

   const rollContext = { ...metaCtx, damageType };

   if (attackerPos && targetPos) {
     let effectiveRange = computeEffectiveSpellRange(spell.range, metaCtx);
     if (effectiveRange != null) {
       const cantripRangeBonus = (featEffects?.cantripRangeBonus) || 0;
       if (cantripRangeBonus > 0 && spell.level === 0) {
         const baseRange = rangeToFeet(spell.range);
         if (baseRange != null && baseRange >= 10) {
           effectiveRange += cantripRangeBonus;
         }
       }
       const distanceFt = getDistanceFeet(attackerPos, targetPos);
        const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects ?? {});
       if (rangeResult.mode === 'miss') {
         rollContext.isAutoMiss = true;
         rollContext.rangeReason = rangeResult.reason;
        }
     }
   }

    const magicalAmbush = (function() {
        const passives = playerStats.automation?.passives;
        if (passives == null) {
            console.error('[spellCast] magicalAmbush check: playerStats.automation.passives is missing');
            throw new Error('playerStats.automation.passives is required for magical ambush check');
        }
        return passives.some(p => p.type === 'passive_rule' && p.effect === 'magical_ambush');
    })();
    const rawConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName);
    if (rawConditions == null || !Array.isArray(rawConditions)) {
        console.error('[spellCast] casterConditions: activeConditions is not an array');
        throw new Error('activeConditions must be an array for caster');
    }
    const casterConditions = rawConditions;
    const hasInvisible = magicalAmbush && casterConditions.some(c => String(c).toLowerCase() === 'invisible');

    const hasEmpoweredEvoc = hasEmpoweredEvocation(playerStats);
    const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
    const spellSchool = (spell.school || '').toLowerCase();
    const isEvocation = spellSchool === 'evocation';
    const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && spell.damage && empEvocIntMod > 0;

    let empEvocFormula = formula;
    if (shouldApplyEmpoweredEvoc) {
        empEvocFormula = `${formula} + ${empEvocIntMod}[Empowered Evocation]`;
    }

    // Overchannel: maximize damage for Wizard spells (slot levels 1-5) that deal damage
    let overchannelFormula = empEvocFormula;
    let overchannelActive = false;
    let overchannelUseCount = 0;
    const overchannelPassives = (function() {
        const passives = playerStats.automation?.passives;
        if (passives == null) {
            console.error('[spellCast] overchannelPassives: playerStats.automation.passives is missing');
            throw new Error('playerStats.automation.passives is required for overchannel check');
        }
        return passives.filter(p => p.type === 'overchannel');
    })();
    if (overchannelPassives.length > 0) {
        const spellLevel = metaCtx?.slotLevel || spell.level;
        const hasDamage = !!spell.damage;
        const isSlotLevelValid = spellLevel >= 1 && spellLevel <= 5;
        const usesKey = '_Overchannel_uses';
        const restKey = '_Overchannel_restTimestamp';
        const now = Date.now();
        const lastRestTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
        let currentMaxUses = 1;
        if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
            currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1);
        } else if (!lastRestTimestamp) {
            currentMaxUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1);
        }
        if (hasDamage && isSlotLevelValid && currentMaxUses > 0) {
            overchannelActive = true;
            overchannelUseCount = currentMaxUses;
            overchannelFormula = `${empEvocFormula}[Overchannel Maximize]`;
        }
    }

      if (spell.dc) {
        const target = await getTargetInfo();
        const context = {
          targetName: target?.name,
          attackerName: playerStats.name,
           ...rollContext,
           saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
          saveType: spell.dc.dc_type,
          dcSuccess: spell.dc.dc_success,
          metamagicHeighten: hasInvisible,
          isCantrip: spell.level === 0,
        };
        if (spell.status_effects && spell.status_effects.length > 0) {
          context.statusEffects = spell.status_effects;
        }
      let overchannelResult;
     if (overchannelActive) {
         overchannelResult = rollExpressionMaximized(empEvocFormula);
     } else {
         overchannelResult = rollExpression(empEvocFormula);
     }
     if (overchannelResult) {
       rollDamage(spell.name, empEvocFormula, overchannelResult.total, overchannelResult.rolls, overchannelResult.modifier, context);
      }
        } else {
        if (isMagicMissile(spell)) {
          await executeMagicMissile(spell, metaCtx, { rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters });
        } else {
          const rollCtx = innateSorceryActive && !rollContext.forcedMode ? { ...rollContext, forcedMode: 'advantage' } : rollContext;
          const attackCtx = {
            autoDamageFormula: overchannelFormula,
            autoDamageName: spell.name,
            overchannelActive,
            overchannelUseCount,
            overchannelSpellLevel: metaCtx?.slotLevel || spell.level,
              ...rollCtx,
              isCantrip: spell.level === 0,
              };
          if (hasInvisible) {
            attackCtx.metamagicHeighten = true;
          }
           rollAttack(spell.name, spellToHit, attackCtx);
           }
         }

    triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast rider save failed:', e);
    });

    const hexTarget = metaCtx?.targetName || (await getTargetInfo())?.name;
    applyEldritchHex(spell, playerStats, campaignName, hexTarget);

    triggerPostCastSelfHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast self-heal failed:', e);
    });
    triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast ally-heal failed:', e);
    });
    triggerSmiteOfProtection(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Smite of Protection trigger failed:', e);
    });
    triggerInspiringSmite(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Inspiring Smite trigger failed:', e);
    });
    triggerPrimalCompanionSpellShare(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Primal companion spell share failed:', e);
    });
    triggerSpellThief(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Spell Thief failed:', e);
    });
    triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Wild Magic Surge trigger failed:', e);
    });
    triggerBewitchingMagic(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Bewitching Magic trigger failed:', e);
    });

    triggerSoulstitchSpells(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Soulstitch Spells trigger failed:', e);
    });

    triggerExpertDivination(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Expert Divination trigger failed:', e);
    });

    triggerSpellBreakerSlotRetention(spell, metaCtx, playerStats, campaignName).catch(e => {
        console.error('[spellCast] Spell Breaker slot retention trigger failed:', e);
    });
}

async function triggerSpellBreakerSlotRetention(spell, metaCtx, playerStats, campaignName) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] triggerSpellBreakerSlotRetention: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for spell breaker');
    }
    const spellBreaker = passives.find(p => p.type === 'passive_rule' && p.effect === 'spell_breaker');
    if (!spellBreaker) return;

    const retentionSpells = spellBreaker.slotRetentionSpells;
    if (retentionSpells == null || !Array.isArray(retentionSpells)) {
        console.error('[spellCast] triggerSpellBreakerSlotRetention: slotRetentionSpells is not an array');
        throw new Error('slotRetentionSpells must be an array');
    }
    if (!retentionSpells.includes(spell.name)) return;

    const slotKey = `spell_slots_level_${spell.level}`;
    const currentSlots = getRuntimeValue(playerStats.name, slotKey);
    if (currentSlots == null || currentSlots < 0) return;

    const checkFailed = metaCtx?.saveSuccess === false || metaCtx?.abilityCheckSuccess === false;
    if (!checkFailed) return;

    setRuntimeValue(playerStats.name, slotKey, currentSlots + 1, campaignName);
}



export function refundSpellBreakerSlot(playerName, spellLevel, campaignName) {
    const slotKey = `spell_slots_level_${spellLevel}`;
    const currentSlots = getRuntimeValue(playerName, slotKey);
    if (currentSlots == null || currentSlots < 0) return;
    setRuntimeValue(playerName, slotKey, currentSlots + 1, campaignName);
}

async function applyPowerWordHealToTarget(targetName, playerStats, campaignName) {
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return;

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return;

    const maxHp = creature.maxHp || playerStats.hitPoints || 0;
    const currentHp = creature.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
    const healAmount = maxHp - currentHp;

    if (healAmount > 0) {
        applyHealingToTarget(combatSummary, targetName, healAmount, campaignName);
    }

    const conditionsToRemove = ['charmed', 'frightened', 'paralyzed', 'poisoned', 'stunned'];
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName);
    if (storedConditions == null || !Array.isArray(storedConditions)) {
        console.error('[spellCast] applyPowerWordHealToTarget: activeConditions is not an array');
        throw new Error('activeConditions must be an array');
    }
    const conditions = storedConditions;
    const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                postLogEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason: 'Power Word Heal',
                    timestamp: Date.now(),
                });
            }
        }
    }

    if (hasProne) {
        const existingStance = getRuntimeValue(targetName, 'powerWordHealStandPermission', campaignName);
        if (!existingStance) {
            setRuntimeValue(targetName, 'powerWordHealStandPermission', true, campaignName);
        }
    }

    postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: healAmount,
        currentHp: Math.min(maxHp, currentHp + healAmount),
        maxHp,
        isHealing: true,
        sourceName: playerStats.name,
        note: 'Power Word Heal',
    });
}

async function triggerHeal(spell, metaCtx, playerStats, campaignName, _mapName) {
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return;

    const targetName = metaCtx?.targetName;
    if (!targetName) return;

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return;

    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[spellCast] triggerHeal: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for heal spell')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;
      const healAtSlotLevel = spell.heal_at_slot_level;
      let healAmount = 70;
      if (healAtSlotLevel) {
        const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
        if (expression) {
          const parsed = parseInt(expression, 10);
          if (Number.isNaN(parsed)) {
            console.error('[spellCast] triggerHeal: heal_at_slot_level expression is not a valid number:', expression)
            throw new Error('heal_at_slot_level expression must be a valid number for heal spell')
          }
          healAmount = parsed;
        }
    }
    const maxHp = creature.maxHp || playerStats.hitPoints || 0;
    const currentHp = creature.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
    const actualHeal = Math.min(healAmount, maxHp - currentHp);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    const conditionsToRemove = ['blinded', 'deafened', 'poisoned'];
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName);
    if (storedConditions == null || !Array.isArray(storedConditions)) {
        console.error('[spellCast] triggerHeal: activeConditions is not an array');
        throw new Error('activeConditions must be an array');
    }
    const conditions = storedConditions;
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                postLogEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason: 'Heal',
                    timestamp: Date.now(),
                });
            }
        }
    }

    postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: Math.min(maxHp, currentHp + actualHeal),
        maxHp,
        isHealing: true,
        sourceName: playerStats.name,
        note: 'Heal',
    });
}

const DIVINATION_SCHOOL = 'Divination';

function usesSpellSlot(spell, metaCtx) {
    return metaCtx?.slotLevel > 0 || spell.level > 0;
}

async function triggerExpertDivination(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    const school = (spell.school || '').toLowerCase();
    if (school !== DIVINATION_SCHOOL) {
        return null;
    }

    const spellSlotLevel = metaCtx?.slotLevel || spell.level;
    if (!spellSlotLevel || spellSlotLevel < 2) {
        return null;
    }

    // Check if player has Expert Divination feature
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] triggerExpertDivination: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for expert divination');
    }
    const hasExpertDivination = passives.some(p => p.name === 'Expert Divination' && p.type === 'expert_divination');
    if (!hasExpertDivination) {
        return null;
    }

    const action = {
        name: 'Expert Divination',
        automation: {
            type: 'expert_divination',
            casting_time: 'passive',
        },
        spell,
        spellSlotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[spellCast] Expert Divination trigger failed:', e);
        return null;
    }
}

async function applyRegenerateSpell(spell, target, caster, campaignName) {
    const targetName = target.name;
    const casterName = caster.name;
    if (spell.level == null) {
        console.error('[spellCast] applyRegenerateSpell: spell.level is missing')
        throw new Error('spell.level is required for regenerate spell')
      }
      const slotLevel = spell.level;
      const healAtSlotLevel = spell.heal_at_slot_level;
      if (healAtSlotLevel == null || typeof healAtSlotLevel !== 'object') {
        console.error('[spellCast] applyRegenerateSpell: heal_at_slot_level is not an object');
        throw new Error('heal_at_slot_level must be an object');
      }
      let expression = healAtSlotLevel[slotLevel];
      if (!expression) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
          expression = healAtSlotLevel[highestBelow];
        }
      }

    // Apply initial healing
    if (expression) {
        const result = rollExpression(expression);
        if (result) {
            const combatSummary = await getCombatContext(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures.find(c => c.name === targetName);
                if (creature?.maxHp == null && caster.hitPoints == null) {
                    console.error('[spellCast] applyRegenerateSpell: max HP is missing for both creature and caster')
                    throw new Error('max HP is required for regenerate spell')
                  }
                  const maxHp = creature?.maxHp || caster.hitPoints;
                const currentHp = creature?.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
                const actualHeal = Math.min(result.total, maxHp - currentHp);
                if (actualHeal > 0) {
                    applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
                }
                postLogEntry(campaignName, {
                    type: 'hp_change',
                    targetName,
                    delta: actualHeal,
                    currentHp: Math.min(maxHp, currentHp + actualHeal),
                    maxHp,
                    isHealing: true,
                    sourceName: casterName,
                    note: spell.name,
                    formula: expression,
                    timestamp: Date.now(),
                });
            }
        }
    }

    // Set up turn-start healing: store regenerateActive on the target
    await setRuntimeValue(targetName, 'regenerateActive', true, campaignName);
    await setRuntimeValue(targetName, 'regenerateSource', casterName, campaignName);

    // Track body part regrowth timestamp (2 minutes = 120000ms)
    if (spell.automation?.bodyPartRegrowMinutes == null) {
        console.error('[spellCast] applyRegenerateSpell: spell.automation.bodyPartRegrowMinutes is missing')
        throw new Error('spell.automation.bodyPartRegrowMinutes is required for regenerate spell')
      }
      const bodyPartRegrowMinutes = spell.automation.bodyPartRegrowMinutes
    const regrowTimestamp = Date.now() + (bodyPartRegrowMinutes * 60 * 1000);
    await setRuntimeValue(targetName, 'regenerateBodyPartRegrowTime', regrowTimestamp, campaignName);
    await setRuntimeValue(targetName, 'regenerateBodyPartsTracked', true, campaignName);

    // Add expiration for combat: remove regenerate buff after 1 hour (3600 seconds / 6 = 600 rounds)
    addExpiration(casterName, targetName, [
        { type: 'remove_regenerate_buff' }
    ], campaignName, 600);

    postLogEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: spell.name,
        description: `${casterName} cast ${spell.name} on ${targetName}. Target regains HP and regains 1 HP at start of each turn for 1 hour.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellCast] Error:", e); throw e; });
}

function isMagicMissile(spell) {
    return spell.name && spell.name.toLowerCase() === 'magic missile';
}

function getMagicMissileCount(slotLevel) {
    return 3 + (slotLevel - 1);
}

async function executeMagicMissile(spell, metaCtx, { rollDamage: _rollDamage, playerStats, getTargetInfo: _getTargetInfo, campaignName, mapName: _mapName, characters }) {
    const slotLevel = metaCtx?.slotLevel || spell.level;
    const numMissiles = getMagicMissileCount(slotLevel);
    const missileDamage = '1d4 + 1';
    const damageType = spell.damage?.damage_type || 'Force';

    const distribution = metaCtx?.magicMissileDistribution;
    if (!distribution || Object.keys(distribution).length === 0) {
        return;
    }

    const combatSummary = getCombatSummary(campaignName) || { creatures: [] };
    const casterName = playerStats.name;
    const logEntries = [];

    for (const [targetName, missileCount] of Object.entries(distribution)) {
        if (missileCount <= 0) continue;

        let totalTargetDamage = 0;
        const missileRolls = [];

        for (let i = 0; i < missileCount; i++) {
            const missileResult = rollExpression(missileDamage);
            if (!missileResult) continue;

            missileRolls.push(missileResult.total);
            totalTargetDamage += missileResult.total;
        }

        if (totalTargetDamage <= 0) continue;

        const target = combatSummary.creatures?.find(c => c.name === targetName) || null;
        void target;

        const isShieldActive = getRuntimeValue(targetName, 'activeBuffs', campaignName)?.some(b => b.effect === 'shield');
        let finalDamage;
        let damageReduced;

        if (isShieldActive) {
            finalDamage = 0;
            damageReduced = true;
        } else {
            const ignoreResistance = (function() {
                const passives = playerStats.automation?.passives;
                if (passives == null) {
                    console.error('[spellCast] executeMagicMissile: playerStats.automation.passives is missing');
                    throw new Error('playerStats.automation.passives is required for ignore resistance check');
                }
                return passives.some(p => p.type === 'auto_effect' && p.effect === 'ignore_resistance');
            })();
            const applyResult = applyDamageToTarget(combatSummary, targetName, totalTargetDamage, [damageType], campaignName, characters, ignoreResistance, casterName);
            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(casterName, campaignName);
            }
            finalDamage = applyResult?.finalDamage ?? totalTargetDamage;
            damageReduced = applyResult?.damageReduced;
        }

        const missileFormula = missileCount === 1 ? missileDamage : `${missileCount}× ${missileDamage}`;

        logEntries.push({
            type: 'roll',
            characterName: casterName,
            rollType: 'damage',
            name: `Magic Missile (${targetName})`,
            formula: missileFormula,
            rolls: missileRolls,
            total: totalTargetDamage,
            modifier: 0,
            damageType,
            targetName,
            finalDamage,
            damageReduced,
            shieldImmune: isShieldActive,
            timestamp: Date.now(),
        });
    }

    if (logEntries.length > 0) {
        const allMissileDamage = logEntries.reduce((sum, e) => sum + e.total, 0);
        const allFinalDamage = logEntries.reduce((sum, e) => sum + e.finalDamage, 0);
        rollExpression(`${numMissiles}× ${missileDamage}`);

        addEntry(campaignName, {
            type: 'spell',
            characterName: casterName,
            spellName: spell.name,
            spellLevel: slotLevel,
            castingTime: spell.casting_time,
            missileCount: numMissiles,
            missileDamage,
            damageType,
            targets: logEntries.map(e => ({
                name: e.targetName,
                missiles: e.rolls.length,
                rawDamage: e.total,
                finalDamage: e.finalDamage,
                shieldImmune: e.shieldImmune,
            })),
            totalRawDamage: allMissileDamage,
            totalFinalDamage: allFinalDamage,
            timestamp: Date.now(),
        });
    }
}
