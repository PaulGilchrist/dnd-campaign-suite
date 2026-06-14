import { rollExpression } from '../dice/diceRoller.js';
import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet, rangeToFeet } from './rangeValidation.js';
import { isInnateSorceryActive, getActiveBuffs } from '../combat/buffService.js';
import { triggerPostCastRiderSaves, triggerSpellThief, triggerBewitchingMagic, triggerSoulstitchSpells, hasEmpoweredEvocation, getEmpoweredEvocationIntModifier } from './postCastRiderService.js';
import { triggerPostCastSelfHeals, triggerPostCastAllyHeals } from './postCastHealService.js';
import { triggerSmiteOfProtection } from './smiteOfProtectionService.js';
import { triggerInspiringSmite } from './inspiringSmiteService.js';
import { triggerPrimalCompanionSpellShare } from './primalCompanionSpellShareService.js';
import { triggerWildMagicSurge } from './wildMagicSurgeService.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/useRuntimeState.js';
import { applyHealingToTarget } from './applyHealing.js';
import { getCombatContext } from '../rules/damageUtils.js';
import { postLogEntry } from '../shared/logPoster.js';
import { executeHandler } from '../automation/index.js';
import { rollExpressionMaximized } from '../dice/diceRoller.js';
import { triggerFalseLife } from './falseLifeService.js';
import { triggerHealingWord } from './healingWordService.js';
import { triggerMassCureWounds } from './massCureWoundsService.js';
import { triggerFear } from './fearService.js';
import { triggerFeignDeath } from './feignDeathService.js';
import { triggerFleshToStone } from './fleshToStoneService.js';
import { triggerHoldMonster } from './holdMonsterService.js';
import { triggerHypnoticPattern } from './hypnoticPatternService.js';
import { triggerForesight } from './foresightService.js';
import { triggerFriends, endFriendsOnHostileAction } from './friendsService.js';
import { endInvisibilityOnHostileAction } from './invisibilityService.js';
import { triggerGlobeOfInvulnerability } from './globeOfInvulnerabilityService.js';
import { triggerHeroism } from './heroismService.js';
import { triggerHolyAura } from './holyAuraService.js';
import { executeHandler as executeLongstrider } from '../automation/index.js';

function applyEldritchHex(spell, playerStats, campaignName, targetName) {
    if (spell.name !== 'Hex') return;

    const passives = playerStats.automation?.passives || [];
    const hasEldritchHex = passives.some(p => p.name === 'Eldritch Hex' && p.type === 'conditional_disadvantage');
    if (!hasEldritchHex) return;

    if (!targetName) return;

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];

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

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName }) {
    if (getActiveBuffs(playerStats.name, campaignName).some(b => b.blocksSpellcasting)) {
        console.warn(`[spellCast] ${playerStats.name} cannot cast spells (blocked by active buff)`);
        return;
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
  let spellSaveDc = playerStats.spellAbilities?.saveDc || 8 + playerStats.proficiency;
  if (cantripSpellAbility && playerStats.abilities) {
    const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
    if (ability) {
      spellToHit = ability.bonus + playerStats.proficiency;
      spellSaveDc = 8 + ability.bonus + playerStats.proficiency;
    }
  }

   if (!formula) {
       if (spell.name.toLowerCase() === 'power word heal' && metaCtx?.multiTarget) {
            const target = await getTargetInfo();
            if (target?.name) {
                await applyPowerWordHealToTarget(target.name, playerStats, campaignName);
                await applyPowerWordHealToTarget(metaCtx.multiTarget, playerStats, campaignName);
            }
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

        // Mass Cure Wounds — multi-target healing in 30-ft radius sphere
        if (spell.name && spell.name.toLowerCase() === 'mass cure wounds') {
            await triggerMassCureWounds(spell, metaCtx, playerStats, campaignName, mapName);
            return;
        }

        // Feign Death — buff/condition spell with no damage or save
        if (spell.name && spell.name.toLowerCase() === 'feign death') {
            const target = await getTargetInfo();
            const feignMetaCtx = { ...metaCtx, targetName: target?.name };
            await triggerFeignDeath(spell, feignMetaCtx, playerStats, campaignName, mapName);
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

        // Hypnotic Pattern — multi-target WIS save for all creatures in 30-ft cube (can see)
        if (spell.name && spell.name.toLowerCase() === 'hypnotic pattern') {
            await triggerHypnoticPattern(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName);
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

        // Globe of Invulnerability — toggle passive barrier that blocks spells of level 5 or lower
        if (spell.name && spell.name.toLowerCase() === 'globe of invulnerability') {
            await triggerGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName);
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

        triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
            console.error('[spellCast] False Life trigger failed:', e);
        });

        triggerHealingWord(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
            console.error('[spellCast] Healing Word trigger failed:', e);
        });

        return;
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
       const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects || {});
       if (rangeResult.mode === 'miss') {
         rollContext.isAutoMiss = true;
         rollContext.rangeReason = rangeResult.reason;
        }
     }
   }

    const magicalAmbush = (playerStats.automation?.passives || []).some(
      p => p.type === 'passive_rule' && p.effect === 'magical_ambush'
    );
    const casterConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
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
    const overchannelPassives = (playerStats.automation?.passives || []).filter(
        p => p.type === 'overchannel'
    );
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
    const passives = playerStats.automation?.passives || [];
    const spellBreaker = passives.find(p => p.type === 'passive_rule' && p.effect === 'spell_breaker');
    if (!spellBreaker) return;

    const retentionSpells = spellBreaker.slotRetentionSpells || [];
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
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
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

    const healAmount = 70;
    const maxHp = creature.maxHp || playerStats.hitPoints || 0;
    const currentHp = creature.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
    const actualHeal = Math.min(healAmount, maxHp - currentHp);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    const conditionsToRemove = ['blinded', 'deafened', 'poisoned'];
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
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
    const passives = playerStats.automation?.passives || [];
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
