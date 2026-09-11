import { setRuntimeValue, getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { executeHandler } from '../../../../automation/index.js';
import { triggerHealingWord } from '../../../features/healingWordService.js';
import { triggerPostCastSelfHeals, triggerPostCastAllyHeals } from '../../postCastHealService.js';
import { triggerSmiteOfProtection } from '../../../features/smiteOfProtectionService.js';
import { triggerInspiringSmite } from '../../../features/inspiringSmiteService.js';
import { triggerPrimalCompanionSpellShare } from '../../../features/primalCompanionSpellShareService.js';
import { triggerWildMagicSurge } from '../../../features/wildMagicSurgeService.js';
import { triggerBewitchingMagic, triggerPostCastRiderSaves, triggerSpellThief } from '../../postCastRiderService.js';
import { endSanctuary } from '../../../../automation/handlers/spells/sanctuaryHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';
import { triggerConfusion } from '../../../features/confusionService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes } from '../../../../combat/automation/automationService.js';
import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../../../dice/diceRoller.js';
import { refundSpellBreakerSlot, applyHexEffects, applyPowerWordHealToTarget, applyPowerWordKillToTarget, triggerDispelMagic, triggerExpertDivination, triggerArcaneWard, applyRegenerateSpell } from './helpers.js';
import { checkGlobeOfInvulnerability, checkForcecageBlocked, checkBlockedBySpellcastingBuff } from './blockChecks.js';
import { handlePowerWordHeal, handlePowerWordKill, handleMassSuggestion, handleCalmEmotions, handleHypnoticPatternEarly, handleConfusionEarly, handleShapechange, handleFear, handleConjureVolley, handleSilence, handleSleep } from './modalSpells.js';
import { handleRegenerate, handleSeeInvisibility, handleFleshToStone, handleHoldMonster, handleBanishment, handleConfusion, handleMaze, handlePowerWordStun, handleHypnoticPattern, handleSlow, handleBane, handleBless, handleBeaconOfHope, handleMassSuggestion as handleMassSuggestionTrigger, handleSuggestion, handleCommand, handleOttoDance, handleResilientSphere, handleBlur, handleExpeditiousRetreat, handleFriends, handleCrownOfMadness, handleAnimalFriendship, handleDominateBeast, handleDominateMonster, handleDominatePerson, handleRayOfEnfeeblement, handleCompelledDuel, handleGlobeOfInvulnerability, handleForcecage, handleStinkingCloud, handleSleetStorm, handleFaerieFire, handleTashasHideousLaughter, handleImprisonment, handleHeroism, handleLongstrider, handleSpareTheDying, handleEnhanceAbility, handleProtectionFromEnergy, handleProtectionFromPoison, handleResistance, handleGenericAutomation } from './triggerSpells.js';
import { computeRange, computeEmpoweredEvocation, computeBlessedStrikes, computeRadiantSoul, computeOverchannel } from './damageCalculation.js';
import { handleSavePath } from './savePath.js';
import { handleNoSavePath } from './noSavePath.js';
import { handleHolyAura as handleHolyAuraTrigger } from './triggerSpells.js';
import { handleMassCureWounds as handleMassCureWoundsTrigger } from './triggerSpells.js';
import { handleMassHealingWord as handleMassHealingWordTrigger } from './triggerSpells.js';
import { handlePrayerOfHealing as handlePrayerOfHealingTrigger } from './triggerSpells.js';
import { handleFalseLife as handleFalseLifeTrigger } from './triggerSpells.js';
import { handleRemoveCurse as handleRemoveCurseTrigger } from './triggerSpells.js';
import { getCombatSummary } from '../../../../../services/encounters/combatData.js';

// CLA-268: Psychic Spells damage-type swap is opt-in — honor the cast-time
// checkbox flag (_psychicSpellsOverride / usePsychicDamage); otherwise keep RAW.
function computePsychicDamageType(spell, psychicSpellsConfig, damageType) {
    const optedIn = spell._psychicSpellsOverride || spell.usePsychicDamage;
    if (psychicSpellsConfig && spell.damage && damageType && optedIn) {
        return psychicSpellsConfig.damageType || 'Psychic';
    }
    return damageType;
}

// Wrappers for the handled-trigger chain: passThrough returns the handler's
// `result` when handled; swallow returns undefined (matching bare `return;`).
const passThrough = (r) => (r.handled ? { value: r.result } : null);
const swallow = (r) => (r.handled ? { value: undefined } : null);

// Run a chain of handled-result trigger thunks in exact order. Sync thunks
// resolve immediately; async thunks are awaited — preserving the original
// await points of each handler invocation.
async function runTriggerChain(triggers) {
    for (const trigger of triggers) {
        const outcome = trigger();
        const settled = outcome && typeof outcome.then === 'function' ? await outcome : outcome;
        if (settled) return settled;
    }
    return null;
}

// Antimagic Field: block when caster or target is inside an active field.
async function checkAntimagicField(spell, playerStats, globeTargetName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const antimagicEffects = storedEffects.filter(te => te.effect === 'antimagic_field');
    const casterAffected = antimagicEffects.some(te => te.target === playerStats.name);
    const targetAffected = globeTargetName ? antimagicEffects.some(te => te.target === globeTargetName) : false;

    if (casterAffected) {
        await addEntry(campaignName, {
            type: 'automation', creatureName: playerStats.name, name: 'Antimagic Field',
            description: `${spell.name} blocked — caster is within Antimagic Field.`, timestamp: Date.now(),
        }).catch((e) => { console.error("[index:log-error]", e); });
        return { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Antimagic Field', description: `${spell.name} is blocked by Antimagic Field affecting ${playerStats.name}.` } } };
    }

    if (targetAffected && globeTargetName) {
        await addEntry(campaignName, {
            type: 'automation', creatureName: playerStats.name, name: 'Antimagic Field',
            description: `${spell.name} blocked — ${globeTargetName} is within Antimagic Field.`, timestamp: Date.now(),
        }).catch((e) => { console.error("[index:log-error]", e); });
        return { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Antimagic Field', description: `${spell.name} is blocked by Antimagic Field protecting ${globeTargetName}.` } } };
    }

    return null;
}

function resolveMagicalAmbushInvisible(playerStats, campaignName) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[spellCast] magicalAmbush check: playerStats.automation.passives is missing');
        throw new Error('playerStats.automation.passives is required for magical ambush check');
    }
    const magicalAmbush = passives.some(p => p.type === 'passive_rule' && p.effect === 'magical_ambush');
    const rawConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName);
    if (rawConditions == null || !Array.isArray(rawConditions)) {
        console.error('[spellCast] casterConditions: activeConditions is not an array');
        throw new Error('activeConditions must be an array for caster');
    }
    const casterConditions = rawConditions;
    return magicalAmbush && casterConditions.some(c => String(c).toLowerCase() === 'invisible');
}

// Silence: verbal components are impossible inside a Silence zone.
async function checkSilenceBlock(spell, playerStats, campaignName) {
    if (!(spell.components && spell.components.includes('V'))) return null;
    const silenceCaster = getSilenceSource(playerStats.name, campaignName);
    if (silenceCaster && isCreatureInSilenceZone(playerStats.name, silenceCaster, campaignName)) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: playerStats.name,
            name: 'Silence',
            description: `${spell.name} blocked — ${playerStats.name} is inside ${silenceCaster}'s Silence zone; Verbal components are impossible there.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[index:silence-log-error]", e); });
        return {
            automationPopup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Silence',
                    description: `${spell.name} cannot be cast — ${playerStats.name} is inside a Silence zone and Verbal spell components are impossible there.`,
                },
            },
        };
    }
    return null;
}

function applyPsychicComponentReduction(spell, psychicSpellsConfig) {
    if (!(psychicSpellsConfig && spell.components)) return;
    const spellSchool = (spell.school || '').toLowerCase();
    const reducedSchools = (psychicSpellsConfig.spellSchools || []).map(s => s.toLowerCase());
    if (reducedSchools.includes(spellSchool)) {
        const reducedComponents = (psychicSpellsConfig.componentReduction || []).map(c => c.toUpperCase());
        spell.components = spell.components.filter(c => !reducedComponents.includes(c.toUpperCase()));
    }
}

// Full spell data lookup
async function lookupFullSpell(spell, playerStats) {
    let fullSpell = spell;
    const needsLookup = !spell.area_of_effect || (spell.automation?.type && !spell.automation?.effects);
    if (!needsLookup) return fullSpell;
    try {
        const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
        const response = await fetch(spellsUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const allSpells = await response.json();
        const lookup = allSpells.find(s => s.name === spell.name);
        if (lookup) {
            fullSpell = { ...spell, ...lookup, index: undefined, name: spell.name };
        } else {
            console.error('[spellCast] Spell not found in spells.json:', spell.name);
        }
    } catch (e) {
        console.error('[spellCast] Failed to look up full spell data for:', spell.name, e);
    }
    return fullSpell;
}

function computeSpellStats(playerStats, cantripSpellAbility) {
    let spellToHit = playerStats.spellAbilities?.toHit || 0;
    let spellSaveDc;
    if (playerStats.spellAbilities?.saveDc == null) {
        if (playerStats.proficiency == null) {
            console.error('[spellCast] executeSpellCast: playerStats.proficiency is missing');
            throw new Error('playerStats.proficiency is required for spell save DC calculation');
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

    return { spellToHit, spellSaveDc, spellCastingMod };
}

// Generic spell cast log
async function logGenericSpellCast(spell, fullSpell, playerStats, campaignName, getTargetInfo, spellSaveDc, damageType, formula) {
    if (spell.name === 'Hex') return;
    const resolvedTarget = await getTargetInfo();
    const resolvedTargetName = resolvedTarget?.name || null;
    const spellDescription = fullSpell.description ? fullSpell.description.join(' ') : '';
    addEntry(campaignName, {
        type: 'spell', characterName: playerStats.name, targetName: resolvedTargetName,
        spellName: spell.name, spellLevel: spell.level || 0, castingTime: spell.casting_time,
        damageType: damageType || null, damageFormula: formula || null,
        saveDC: spell.dc ? spellSaveDc : null, concentration: !!spell.concentration,
        description: spellDescription || null, timestamp: Date.now(),
    }).catch((e) => { console.error("[index:log-error]", e); });
}

// --- NO DAMAGE PATH: handled-trigger chain in exact original order.
// Returns { handled, value } — value is what executeSpellCast must return.
async function runNoDamagePath(spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, spellCastingMod, rollDamage) {
    const noDamageTriggers = [
        async () => passThrough(await handleRegenerate(spell, getTargetInfo, applyRegenerateSpell, playerStats, campaignName)),
        () => passThrough(handleFear(spell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive)),
        () => passThrough(handleConjureVolley(spell, fullSpell)),
        async () => swallow(await handleSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleFleshToStone(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleHoldMonster(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleBanishment(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleConfusion(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleMaze(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handlePowerWordStun(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleHypnoticPattern(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleSlow(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleBane(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleBless(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleBeaconOfHope(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleMassSuggestionTrigger(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleSuggestion(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleCommand(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => swallow(await handleOttoDance(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleResilientSphere(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleBlur(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleExpeditiousRetreat(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleFriends(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleCrownOfMadness(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleAnimalFriendship(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleDominateBeast(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleDominateMonster(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleDominatePerson(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => swallow(await handleRayOfEnfeeblement(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleCompelledDuel(spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName)),
        async () => passThrough(await handleGlobeOfInvulnerability(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleForcecage(spell, metaCtx, playerStats, campaignName, mapName)),
        () => passThrough(handleSilence(spell, fullSpell, metaCtx, spellSaveDc, playerStats, campaignName, null, (cn) => getCombatSummary(cn))),
        async () => swallow(await handleStinkingCloud(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => swallow(await handleSleetStorm(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleFaerieFire(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleTashasHideousLaughter(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleImprisonment(spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName)),
        async () => passThrough(await handleHeroism(spell, playerStats, campaignName, mapName, characters, executeHandler)),
        async () => swallow(await handleHolyAuraTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => passThrough(await handleLongstrider(spell, playerStats, campaignName, mapName, executeHandler)),
        async () => passThrough(await handleSpareTheDying(spell, playerStats, campaignName, mapName, characters, executeHandler)),
        async () => passThrough(await handleEnhanceAbility(spell, metaCtx, playerStats, campaignName, mapName, characters, executeHandler)),
    ];
    const earlyOutcome = await runTriggerChain(noDamageTriggers);
    if (earlyOutcome) return { handled: true, value: earlyOutcome.value };

    // Status effects fallback
    if (spell.dc && spell.status_effects && spell.status_effects.length > 0 && !fullSpell.area_of_effect) {
        const target = await getTargetInfo();
        const context = {
            targetName: target?.name, attackerName: playerStats.name, ...metaCtx,
            saveDc: spellSaveDc + (innateSorceryActive ? 1 : 0),
            saveType: spell.dc.dc_type, dcSuccess: spell.dc.dc_success,
            metamagicHeighten: hasInvisible || metaCtx?.metamagicHeighten,
            isCantrip: spell.baseLevel === 0 || spell.level === 0,
        };
        if (spell.status_effects && spell.status_effects.length > 0) {
            context.statusEffects = spell.status_effects;
        }
        rollDamage(spell.name, '0', 0, [], 0, context);
    }

    const massHealingOutcome = await runTriggerChain([
        async () => swallow(await handleMassCureWoundsTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleMassHealingWordTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handlePrayerOfHealingTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
        async () => swallow(await handleFalseLifeTrigger(spell, metaCtx, playerStats, campaignName, mapName)),
    ]);
    if (massHealingOutcome) return { handled: true, value: massHealingOutcome.value };

    // Generic healing path
    if (spell.heal_at_slot_level) {
        return { handled: true, value: await runGenericHealPath(spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellCastingMod) };
    }

    triggerHealingWord(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Healing Word trigger failed:', e);
    });

    const protectionOutcome = await runTriggerChain([
        async () => swallow(await handleProtectionFromEnergy(spell, playerStats, campaignName, mapName, executeHandler)),
        async () => swallow(await handleProtectionFromPoison(spell, playerStats, campaignName, mapName, executeHandler)),
    ]);
    if (protectionOutcome) return { handled: true, value: protectionOutcome.value };

    const removeCurseResult = await handleRemoveCurseTrigger(spell, metaCtx, playerStats, campaignName, mapName);
    if (removeCurseResult.handled) {
        if (spell.name && spell.name.toLowerCase() === 'dispel magic') {
            const dispelTarget = await getTargetInfo();
            if (dispelTarget) {
                const dispelMetaCtx = { ...metaCtx, targetName: dispelTarget.name };
                await triggerDispelMagic(dispelMetaCtx, spell, playerStats, campaignName, mapName);
            }
        }
        return { handled: true };
    }

    if (spell.name && spell.name.toLowerCase() === 'dispel magic') {
        const dispelTarget = await getTargetInfo();
        if (dispelTarget) {
            // CLA-322: ability check resolves inside triggerDispelMagic — it logs
            // the check, dispatches `spell-result` with `checkFailed`, and refunds
            // the slot inline (keyed by cast slot level) when Spell Breaker is held.
            await triggerDispelMagic({ ...metaCtx, targetName: dispelTarget.name }, spell, playerStats, campaignName, mapName);
        }
    }

    const resistanceResult = await handleResistance(spell, playerStats, campaignName, mapName, characters, executeHandler, metaCtx);
    if (resistanceResult.handled) return { handled: true };

    return { handled: false };
}

// Generic healing path (spell.heal_at_slot_level) — returns genericHealResult.
async function runGenericHealPath(spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellCastingMod) {
    const explicitTarget = metaCtx?.targetName ? { name: metaCtx.targetName } : null;
    const target = explicitTarget || await getTargetInfo();
    let genericHealResult = null;
    if (target?.name) {
        if (metaCtx?.slotLevel == null && spell.level == null) {
            console.error('[spellCast] executeSpellCast: slot level is missing (metaCtx.slotLevel and spell.level) for healing spell');
            throw new Error('slot level is required for healing spell');
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
            const targetChar = (characters || []).find(c => c.name === target.name);
            const targetStats = targetChar?.computedStats || targetChar;
            const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName, targetStats);
            if (expression === 'max') {
                const isTargetPlayer = target.name === playerStats.name || (characters || []).some(c => c.name === target.name && c.type === 'player');
                const maxHp = isTargetPlayer
                    ? (getRuntimeValue(target.name, 'hitPoints') || playerStats.hitPoints || 0)
                    : (getRuntimeValue(target.name, 'hitPoints') || 0);
                const currentHp = isTargetPlayer
                    ? (getRuntimeValue(target.name, 'currentHitPoints') ?? maxHp)
                    : (getRuntimeValue(target.name, 'currentHitPoints') ?? maxHp);
                const actualHeal = maxHp - currentHp;
                genericHealResult = { targetName: target.name, healAmount: Math.max(0, actualHeal), formula: 'max', rolls: [], rawTotal: Math.max(0, actualHeal), bonusHeal, bonusDetails };
                if (actualHeal > 0) {
                    const combatSummary = await getCombatContext(campaignName);
                    if (combatSummary) {
                        applyHealingToTarget(combatSummary, target.name, actualHeal, campaignName);
                    }
                }
                addEntry(campaignName, {
                    type: 'hp_change', targetName: target.name, delta: actualHeal,
                    currentHp: Math.min(maxHp, currentHp + Math.max(0, actualHeal)), maxHp,
                    isHealing: true, sourceName: playerStats.name, note: spell.name, timestamp: Date.now(),
                }).catch((e) => { console.error("[spellCast] Error:", e); });
            } else {
                let resolvedExpression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
                const maximize = hasHealingMaximizationForTarget(playerStats, target.name, campaignName);
                const rerollOnes = hasRerollHealingOnes(playerStats);
                const result = maximize ? rollExpressionMaximized(resolvedExpression) : rollExpression(resolvedExpression);
                let displayRolls = result?.rolls || null;
                let healingRerollOriginalRolls = null;
                if (result && rerollOnes && !maximize) {
                    const { displayRolls: rerolled, originalRolls } = applyHealingRerollOnes(result.rolls, resolvedExpression);
                    displayRolls = rerolled;
                    healingRerollOriginalRolls = originalRolls;
                }
                if (result) {
                    const isTargetPlayer = target.name === playerStats.name || (characters || []).some(c => c.name === target.name && c.type === 'player');
                    const maxHp = isTargetPlayer
                        ? (getRuntimeValue(target.name, 'hitPoints') || playerStats.hitPoints || 0)
                        : (getRuntimeValue(target.name, 'hitPoints') || 0);
                    const currentHp = isTargetPlayer
                        ? (getRuntimeValue(target.name, 'currentHitPoints') ?? maxHp)
                        : (getRuntimeValue(target.name, 'currentHitPoints') ?? maxHp);
                    const healAmount = result.total + bonusHeal;
                    const actualHeal = Math.min(Math.max(0, healAmount), Math.max(0, maxHp - currentHp));
                    if (actualHeal > 0) {
                        const combatSummary = await getCombatContext(campaignName);
                        if (combatSummary) {
                            applyHealingToTarget(combatSummary, target.name, actualHeal, campaignName);
                        }
                    }
                    genericHealResult = { targetName: target.name, healAmount: actualHeal, formula: resolvedExpression, rolls: displayRolls || result.rolls, rawTotal: result.total + bonusHeal, bonusHeal, bonusDetails, healingRerollOriginalRolls, healingRerollDisplayRolls: displayRolls };
                    const formulaParts = [resolvedExpression];
                    if (bonusDetails.length > 0) {
                        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
                        formulaParts.push(`(${bonusParts})`);
                    }
                    addEntry(campaignName, {
                        type: 'hp_change', targetName: target.name, delta: actualHeal,
                        currentHp: Math.min(maxHp, currentHp + actualHeal), maxHp,
                        isHealing: true, sourceName: playerStats.name, note: spell.name,
                        formula: formulaParts.join(' + '),
                        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[spellCast] Error:", e); });
                }
            }
        }
    }

    triggerPostCastSelfHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast self-heal failed:', e);
    });
    const chaliceResult = await triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast ally-heal failed:', e);
        return null;
    });
    if (chaliceResult?.needsModal) {
        const pending = getRuntimeValue('campaign', 'pendingStarryChaliceHeal', campaignName);
        return {
            type: 'modal', modalName: 'starryChaliceHeal',
            payload: { casterName: playerStats.name, campaignName, amount: chaliceResult.amount, targetNames: pending?.targetNames || [playerStats.name] },
        };
    }
    return genericHealResult;
}

// Hex: apply effects and log the cast.
async function castHex(spell, metaCtx, playerStats, campaignName, getTargetInfo) {
    const ability = metaCtx?.hexAbility || 'STR';
    const hexTarget = metaCtx?.targetName || (await getTargetInfo())?.name;
    applyHexEffects(spell, playerStats, campaignName, hexTarget, ability);
    const hasEldritchHex = playerStats.automation?.passives?.some(p => p.name === 'Eldritch Hex' && p.type === 'conditional_disadvantage');
    const effects = hasEldritchHex ? 'ability check disadvantage + saving throw disadvantage' : 'ability check disadvantage';
    addEntry(campaignName, { type: 'spell', characterName: playerStats.name, targetName: hexTarget, spellName: 'Hex', spellLevel: 1, castingTime: '1 bonus action', hexAbility: ability, effectsApplied: effects }).catch((e) => { console.error("[index:log-error]", e); });
}

// --- Post-cast triggers — returns the Wild Magic Surge popup (if any).
async function runPostCastTriggers(spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo) {
    triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast rider save failed:', e);
    });

    const hexTarget = metaCtx?.targetName || (await getTargetInfo())?.name;
    applyHexEffects(spell, playerStats, campaignName, hexTarget, metaCtx?.hexAbility);

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
    let triggerResult = null;
    const wmsResult = await triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Wild Magic Surge trigger failed:', e);
    });
    if (wmsResult) triggerResult = wmsResult;
    triggerBewitchingMagic(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Bewitching Magic trigger failed:', e);
    });

    triggerExpertDivination(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Expert Divination trigger failed:', e);
    });

    triggerArcaneWard(spell, metaCtx, playerStats, campaignName).catch(e => {
        console.error('[spellCast] Arcane Ward trigger failed:', e);
    });

    const sanctuaryEffects = (function () {
        try {
            return (getRuntimeValue('campaign', 'targetEffects') || []).filter(
                te => te.effect === 'sanctuary' && te.target === playerStats.name
            );
        } catch {
            return [];
        }
    })();
    if (sanctuaryEffects.length > 0) {
        for (const se of sanctuaryEffects) {
            const casterName = se.source;
            const caster = characters?.find(c => c.name === casterName);
            if (caster) {
                endSanctuary(casterName, playerStats.name, campaignName,
                    `${playerStats.name} cast a spell, ending Sanctuary.`);
            }
        }
    }

    return triggerResult;
}

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName, characters }) {
    // --- Block checks ---
    const buffBlock = await checkBlockedBySpellcastingBuff(spell, playerStats, campaignName);
    if (buffBlock) return buffBlock;

    const globeTargetName = getTargetInfo ? (await getTargetInfo())?.name || null : null;
    const globeBlock = await checkGlobeOfInvulnerability(spell, globeTargetName, playerStats, campaignName);
    if (globeBlock) return globeBlock;

    const forcecageBlock = await checkForcecageBlocked(spell, globeTargetName, playerStats, campaignName);
    if (forcecageBlock) return forcecageBlock;

    // Antimagic Field checks
    const antimagicBlock = await checkAntimagicField(spell, playerStats, globeTargetName, campaignName);
    if (antimagicBlock) return antimagicBlock;

    // --- Spell resolution (inline) ---
    const hasInvisible = resolveMagicalAmbushInvisible(playerStats, campaignName);

    const silenceBlock = await checkSilenceBlock(spell, playerStats, campaignName);
    if (silenceBlock) return silenceBlock;

    const psychicSpellsConfig = getPsychicSpellsConfig(playerStats);
    applyPsychicComponentReduction(spell, psychicSpellsConfig);

    if (spell.name && spell.name.toLowerCase() !== 'friends') {
        endFriendsOnHostileAction(playerStats.name, campaignName);
    }
    endInvisibilityOnHostileAction(playerStats.name, campaignName);

    if (spell.casting_time === '1 action') {
        setRuntimeValue(playerStats.name, 'lastActionSpellCast', 1, campaignName);
    }

    const fullSpell = await lookupFullSpell(spell, playerStats);

    // Spell stats
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    const damageInfo = resolveSpellDamageWithTypes(spell, spell.level || 1);
    const formula = damageInfo?.formula || null;
    const damageType = damageInfo?.primaryType || spell.damage?.damage_type || '';
    const effectiveDamageType = computePsychicDamageType(spell, psychicSpellsConfig, damageType);

    const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    const { spellToHit, spellSaveDc, spellCastingMod } = computeSpellStats(playerStats, cantripSpellAbility);

    await logGenericSpellCast(spell, fullSpell, playerStats, campaignName, getTargetInfo, spellSaveDc, damageType, formula);

    // --- Power Word Heal/Kill ---
    const pwhResult = await handlePowerWordHeal(spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordHealToTarget);
    if (pwhResult.handled) return pwhResult.result;

    const pwkResult = await handlePowerWordKill(spell, metaCtx, getTargetInfo, playerStats, campaignName, applyPowerWordKillToTarget);
    if (pwkResult.handled) return pwkResult.result;

    // --- Modal spells (early returns) ---
    let massSuggestionResult = handleMassSuggestion(spell, spellSaveDc, playerStats, campaignName);
    if (massSuggestionResult.handled) return massSuggestionResult.result;

    let calmEmotionsResult = handleCalmEmotions(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx);
    if (calmEmotionsResult.handled) return calmEmotionsResult.result;

    let hypnoticPatternEarlyResult = handleHypnoticPatternEarly(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, innateSorceryActive);
    if (hypnoticPatternEarlyResult.handled) return hypnoticPatternEarlyResult.result;

    let confusionEarlyResult = handleConfusionEarly(fullSpell, spell, metaCtx, spellSaveDc, playerStats, campaignName, mapName, (s, m, p, c, mp) => triggerConfusion(s, m, p, c, mp));
    if (confusionEarlyResult.handled) return confusionEarlyResult.result?.result;

    let shapechangeResult = handleShapechange(fullSpell, metaCtx, playerStats, campaignName, mapName, characters);
    if (shapechangeResult.handled) return shapechangeResult.result;

    let sleepResult = handleSleep(fullSpell, spellSaveDc, playerStats, campaignName, metaCtx, characters);
    if (sleepResult.handled) return sleepResult.result;

    // --- Generic automation routing ---
    let genericAutomationResult = await handleGenericAutomation(spell, executeHandler, (sp, mc, ps, cn) => triggerArcaneWard(sp, mc, ps, cn), playerStats, campaignName, mapName, characters, metaCtx);
    if (genericAutomationResult.handled) {
        if (genericAutomationResult.result) return genericAutomationResult.result;
        return;
    }

    // --- NO DAMAGE PATH ---
    if (!formula) {
        const noDamage = await runNoDamagePath(spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo, spellSaveDc, innateSorceryActive, hasInvisible, spellCastingMod, rollDamage);
        if (noDamage.handled) return noDamage.value;
    }

    // --- Hunter's Mark / Hex ---
    if (spell.name === "Hunter's Mark") return;
    if (spell.name === 'Hex') {
        await castHex(spell, metaCtx, playerStats, campaignName, getTargetInfo);
        return;
    }

    // --- Damage path ---
    const rangeResult = computeRange(spell, metaCtx, attackerPos, targetPos, featEffects);
    const { empEvocFormula } = computeEmpoweredEvocation(playerStats, spell, formula);
    let finalFormula = computeBlessedStrikes(spell, empEvocFormula, playerStats, campaignName, getRuntimeValue);
    finalFormula = computeRadiantSoul(spell, playerStats, campaignName, getRuntimeValue, finalFormula);
    metaCtx = { ...metaCtx, finalFormula };
    const { overchannelFormula, overchannelActive, overchannelUseCount } = computeOverchannel(spell, metaCtx, playerStats, campaignName, getRuntimeValue, empEvocFormula, finalFormula);

    if (rangeResult.isAutoMiss) {
        const context = {
            targetName: (await getTargetInfo())?.name,
            attackerName: playerStats.name,
            ...metaCtx,
            isAutoMiss: true,
            rangeReason: rangeResult.rangeReason,
            saveDc: spellSaveDc,
            saveType: spell.dc?.dc_type || fullSpell.dc?.dc_type,
            dcSuccess: spell.dc?.dc_success ?? fullSpell.dc?.dc_success,
            metamagicHeighten: metaCtx?.metamagicHeighten,
            isCantrip: spell.baseLevel === 0 || spell.level === 0,
        };
        rollDamage(spell.name, formula || '0', 0, [], 0, context);
        if (spell.dc || fullSpell.dc) {
            await handleSavePath(spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters,
                getTargetInfo, getRuntimeValue, innateSorceryActive, effectiveDamageType, spellSaveDc,
                overchannelFormula, overchannelActive, overchannelUseCount, rollAttack, rollDamage, formula, hasInvisible);
        }
        return null;
    }

    if (spell.dc || fullSpell.dc) {
        const savePathResult = await handleSavePath(spell, fullSpell, metaCtx, playerStats, campaignName, mapName, characters,
            getTargetInfo, getRuntimeValue, innateSorceryActive, effectiveDamageType, spellSaveDc,
            overchannelFormula, overchannelActive, overchannelUseCount, rollAttack, rollDamage, formula, hasInvisible);
        if (savePathResult) return savePathResult;
    } else {
        // CLA-200: no-save spells (e.g. Divine Smite — no `dc` in spells.json) must fall
        // through to the post-cast trigger block below instead of early-returning.
        // handleNoSavePath only ever resolves null/undefined, and the dc/no-dc
        // branches are mutually exclusive, so the gated post-cast triggers
        // (Inspiring Smite, Wild Magic Surge, Sanctuary break, etc.) run exactly once.
        await handleNoSavePath(spell, metaCtx, playerStats, campaignName, mapName, characters,
            getTargetInfo, rollAttack, spellToHit, effectiveDamageType);
    }

    // --- Post-cast triggers ---
    return await runPostCastTriggers(spell, metaCtx, playerStats, campaignName, mapName, characters, getTargetInfo);
}

export { refundSpellBreakerSlot };
