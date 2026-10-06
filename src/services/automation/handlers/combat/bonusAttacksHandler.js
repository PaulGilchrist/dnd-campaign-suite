import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { DEBUG_FORCE_CRIT } from '../../../ui/utils.js';
import { applyHealingDirectly } from '../../common/healingRoll.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';

// CLA-144: resolve EVERY token in the heal formula to a number before
// rollExpression — the unresolved literal 'WIS modifier' made parseExpression
// fail (null) so every Hand of Healing flurry strike healed 0. Mirrors the
// verified token lane (rules/effects/turnStartEffects.js WIS modifier
// substitution, summonSpiritHandler.js). The formula itself already carries
// the WIS term, so nothing is appended a second time.
function resolveHealingStrikeFormula(handOfHealingAuto, playerStats) {
    const healFormula = handOfHealingAuto?.healExpression || 'martial_arts_die + WIS modifier';
    const martialArtsDie = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.martial_arts_die || 4;
    const wisBonus = playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0;
    const resolved = healFormula
        .replace(/martial_arts_die/gi, `1d${martialArtsDie}`)
        .replace(/WIS modifier/gi, String(wisBonus));
    return { resolved, wisBonus };
}

async function applyHealingStrike({ featureName, playerName, playerStats, campaignName, healingTarget, handOfHealingAuto, flurryHealingHarmUses }) {
    const { resolved: resolvedHealFormula, wisBonus } = resolveHealingStrikeFormula(handOfHealingAuto, playerStats);
    const healResult = rollExpression(resolvedHealFormula);
    const healAmount = healResult?.total || 0;
    if (!healResult) {
        console.error('[bonusAttacksHandler:heal] rollExpression returned null for fully numeric formula — no heal applied:', { resolvedHealFormula, playerName, healingTarget });
    }

    const healTargetStats = getRuntimeValue('characters', 'characters', campaignName)
        ?.find(c => c.name === healingTarget) || playerStats;

    const { newHp, actualHeal } = applyHealingDirectly(healTargetStats, healingTarget, healAmount, campaignName);

    addEntry(campaignName, {
        type: 'hp_change',
        targetName: healingTarget,
        delta: actualHeal,
        currentHp: newHp,
        maxHp: healTargetStats.hitPoints || healTargetStats.maxHitPoints || newHp,
        isHealing: true,
        isUnconscious: false,
        sourceName: playerName,
        note: `${featureName} — Hand of Healing`,
    }).catch((e) => { console.error("[bonusAttacksHandler:heal-error]", e); });

    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'damage',
        name: 'Hand of Healing',
        formula: resolvedHealFormula,
        rolls: healResult?.rolls || [],
        total: healAmount,
        modifier: wisBonus,
        targetName: healingTarget,
        finalDamage: -actualHeal,
        isCrit: false,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bonusAttacksHandler:heal-log-error]", e); });

    const updatedUses = Math.max(0, flurryHealingHarmUses - 1);
    await setRuntimeValue(playerStats.name, 'flurryHealingHarmUses', updatedUses, campaignName);

    return {
        flurryHealingHarmUses: updatedUses,
        damageResult: {
            rollResult: healResult,
            rawDamage: healAmount,
            finalDamage: 0,
            isCrit: false,
            isHealing: true,
        },
    };
}

function buildAttackResultLines(attackResults) {
    let description = '';
    for (const r of attackResults) {
        const hitText = r.isCrit ? 'CRIT!' : r.hit ? 'Hit' : 'Miss';
        const hitStyle = r.isCrit ? ' style="color: var(--color-crit, #ff4444)"' : r.hit ? ' style="color: var(--color-hit, #44bb44)"' : ' style="color: var(--color-miss, #bb4444)"';
        description += `<div class="attack-result-line"><span${hitStyle}><b>${hitText}</b></span> — ${r.targetName} (AC ${r.ac})<br/>`;
        description += `d20: ${r.d20Roll} + ${r.totalAttack - r.d20Roll} = ${r.totalAttack} | `;
        if (r.hit && r.damageResult) {
            const dr = r.damageResult;
            const diceStr = dr.rollResult?.rolls?.join(' + ') || '0';
            const mod = dr.rollResult?.modifier || 0;
            const part = mod !== 0 ? ` [${diceStr} + ${mod} = ${dr.rawDamage}]` : ` [${diceStr} = ${dr.rawDamage}]`;
            description += `Damage: ${part}${dr.isCrit ? ' (doubled dice)' : ''} → ${dr.finalDamage} ${r._damageType} damage`;
        } else {
            description += 'No damage';
        }
        description += `</div>`;
    }
    return description;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const numAttacks = auto.attacks || 3;

    const cs = getCombatSummary(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot use ${action.name}.`,
                automation: auto,
            },
        };
    }

    const creatureTargets = cs.creatures
        .filter(c => c.name !== playerName)
        .map(c => c.name);

    if (creatureTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No valid targets found. Cannot use ${action.name}.`,
                automation: auto,
            },
        };
    }

    const currentTarget = getTargetFromAttacker(cs, playerName);
    const currentTargetName = currentTarget?.name || null;

    const { attackBonus, damageFormula, damageType } = resolveFlurryWeaponStats(playerStats, auto);

    return {
        type: 'modal',
        modalName: 'flurryOfBlows',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName: _mapName,
            attackBonus,
            damageFormula,
            damageType,
            creatureTargets,
            numAttacks,
            currentTargetName,
        },
    };
}

function buildFlurryTargetSnapshots(cs, playerName) {
    const targetSnapshots = {};
    for (const creature of cs.creatures) {
        if (creature.name !== playerName) {
            targetSnapshots[creature.name] = {
                ac: creature.ac || 10,
                currentHp: creature.currentHp,
                maxHp: creature.maxHp,
            };
        }
    }
    return targetSnapshots;
}

async function applyFlurryAttackDamage({ cs, targetName, damageFormula, damageType, isCrit, campaignName, playerName }) {
    const rollFn = isCrit ? rollExpressionDoubled : rollExpression;
    const rollResult = rollFn(damageFormula);
    const rawDamage = rollResult?.total || 0;

    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    // CLA-144: applyDamageToTarget is ASYNC — calling it un-awaited made
    // applyResult a Promise, so finalDamage read 0 on every flurry strike and
    // silently gated every finalDamage>0 consumer (Hand of Harm saves never armed).
    const applyResult = await applyDamageToTarget(cs, targetName, rawDamage, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerName });

    if (!applyResult) {
        console.error('[bonusAttacksHandler] applyFlurryAttackDamage: applyDamageToTarget returned null — damage not applied:', { targetName, rawDamage, playerName });
    }

    const finalDamage = applyResult?.finalDamage || 0;
    const damageResult = {
        rollResult,
        rawDamage,
        finalDamage,
        isCrit,
    };

    if (finalDamage > 0) {
        endInvisibilityOnHostileAction(playerName, campaignName);
    }

    return { damageResult, finalDamage };
}

function resolveHandOfHarmExpression(handOfHarmAuto, playerStats) {
    const scaling = handOfHarmAuto.scaling || {};
    const levels = Object.keys(scaling).map(Number).sort((a, b) => a - b);
    let damageExpression = handOfHarmAuto.damageExpression || '1d6';
    for (const level of levels) {
        if (playerStats.level >= level) {
            damageExpression = scaling[level];
        }
    }
    return damageExpression;
}

function logHandOfHarmRefusal(campaignName, playerName, description) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'hand_of_harm_refused',
        description,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[bonusAttacksHandler:harm-refused]', e); });
}

function registerHandOfHarmSave({ isHandOfHarmStrike, handOfHarmAuto, finalDamage, rawDamage, cs, targetName, playerName, playerStats, featureName, campaignName, targetSnapshots, handOfHarmSavePromises, totalDamageRef }) {
    if (!isHandOfHarmStrike) return;

    if (!handOfHarmAuto) {
        logHandOfHarmRefusal(campaignName, playerName, `${playerName}'s Flurry strike hit ${targetName} but Hand of Harm automation could not be resolved — no CON save prompted.`);
        return;
    }

    // RAW: Hand of Harm triggers when the strike "deals damage" — a strike
    // zeroed by immunity/death-clamp legitimately prompts no save. Zero-silent:
    // refusals log (CLA-107 no-fallback rule).
    if (finalDamage <= 0) {
        logHandOfHarmRefusal(campaignName, playerName, `Hand of Harm not triggered — the strike on ${targetName} dealt 0 damage (rolled ${rawDamage}, immunity or death-clamp), so no Constitution save is prompted.`);
        return;
    }

    const saveDc = buildSaveDc(handOfHarmAuto, playerStats);
    const damageExpression = resolveHandOfHarmExpression(handOfHarmAuto, playerStats);
    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        attackerName: playerName,
        saveType: handOfHarmAuto.saveType || 'CON',
        saveDc,
        sourceName: featureName,
        damageFormula: damageExpression,
        damageType: handOfHarmAuto.damageType || 'Necrotic',
    });

    const handleSaveResult = async (saveEvent) => {
        const saveDetail = saveEvent?.detail || {};
        if (saveDetail.promptId !== promptId) return;

        if (!saveDetail.success) {
            await applyHandOfHarmDamage({ cs, targetName, damageExpression, handOfHarmAuto, playerName, campaignName, featureName, totalDamageRef, targetSnapshots });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);
    handOfHarmSavePromises.push(promise);
}

async function applyHandOfHarmDamage({ cs, targetName, damageExpression, handOfHarmAuto, playerName, campaignName, featureName, totalDamageRef, targetSnapshots }) {
    const damageResult2 = rollExpression(damageExpression);
    const necroticDamage = damageResult2?.total || 0;

    if (necroticDamage <= 0) return;

    const harmDamageType = handOfHarmAuto.damageType || 'Necrotic';
    const harmCharacters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const harmApplyResult = await applyDamageToTarget(cs, targetName, necroticDamage, [harmDamageType], { campaignName, characters: harmCharacters, ignoreResistance: false, attackerName: playerName });

    if (!harmApplyResult) {
        console.error('[bonusAttacksHandler:harm] applyDamageToTarget returned null — Hand of Harm necrotic damage not applied:', { targetName, necroticDamage, playerName });
        return;
    }

    const finalHarmDamage = harmApplyResult.finalDamage || 0;
    totalDamageRef.value += finalHarmDamage;

    const snapshot = targetSnapshots[targetName] || {};

    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'damage',
        name: 'Hand of Harm',
        formula: damageExpression,
        rolls: damageResult2.rolls || [],
        total: necroticDamage,
        damageType: harmDamageType,
        targetName,
        finalDamage: finalHarmDamage,
        isCrit: false,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bonusAttacksHandler:harm-error]", e); });

    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: -finalHarmDamage,
        currentHp: (snapshot.currentHp || 0) - finalHarmDamage,
        maxHp: snapshot.maxHp || 0,
        isHealing: false,
        sourceName: playerName,
        note: `${featureName} — Hand of Harm`,
    }).catch((e) => { console.error("[bonusAttacksHandler:harm-log-error]", e); });

    if (handOfHarmAuto.alsoInflicts) {
        const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
        const newEffects = [...storedEffects, {
            target: targetName,
            source: featureName,
            option: handOfHarmAuto.alsoInflicts,
            effect: handOfHarmAuto.alsoInflicts,
            duration: 'until_used',
        }];
        await setRuntimeValue('campaign', 'targetEffects', newEffects, campaignName);

        addEntry(campaignName, {
            type: 'condition',
            characterName: targetName,
            action: 'applied',
            condition: 'Disadvantage on next attack roll',
            reason: `${playerName}'s Hand of Harm (${featureName}, failed Constitution save)`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[bonusAttacksHandler:harm-condition]', e); });
    }
}

async function resolveFlurryHitStrike(ctx) {
    const {
        cs, targetName, damageFormula, damageType, isCrit, campaignName, playerName,
        hasFlurryHealingHarm, healingTarget, handOfHarmAuto, handOfHealingAuto, openHandFeature,
        pendingOpenHandTargets, playerStats, featureName,
    } = ctx;

    let damageResult = null;
    let finalDamage = 0;

    const isHealingStrike = hasFlurryHealingHarm && ctx.flurryHealingHarmUses > 0 && healingTarget;
    const isHandOfHarmStrike = hasFlurryHealingHarm && !isHealingStrike && handOfHarmAuto;

    let flurryHealingHarmUses = ctx.flurryHealingHarmUses;
    if (isHealingStrike) {
        const outcome = await applyHealingStrike({
            featureName, playerName, playerStats, campaignName,
            healingTarget, handOfHealingAuto, flurryHealingHarmUses,
        });
        flurryHealingHarmUses = outcome.flurryHealingHarmUses;
        damageResult = outcome.damageResult;
    } else {
        const outcome = await applyFlurryAttackDamage({ cs, targetName, damageFormula, damageType, isCrit, campaignName, playerName });
        damageResult = outcome.damageResult;
        finalDamage = outcome.finalDamage;
        ctx.totalDamageRef.value += finalDamage;
        // CLA-143: track rolled totals too — finalDamage death-clamps to 0 on
        // corpses, so "Total damage dealt: 0" alone was dishonest in the ledger.
        ctx.totalRolledRef.value += damageResult.rawDamage;

        registerHandOfHarmSave({
            isHandOfHarmStrike, handOfHarmAuto, finalDamage, rawDamage: damageResult.rawDamage, cs, targetName,
            playerName, playerStats, featureName, campaignName, targetSnapshots: ctx.targetSnapshots,
            handOfHarmSavePromises: ctx.handOfHarmSavePromises, totalDamageRef: ctx.totalDamageRef,
        });

        if (openHandFeature && !pendingOpenHandTargets.has(targetName)) {
            pendingOpenHandTargets.set(targetName, {
                targetName,
                action: openHandFeature,
                playerStats,
                campaignName,
                mapName: ctx._mapName,
            });
        }
    }

    return { damageResult, finalDamage, flurryHealingHarmUses };
}

function logFlurryStrikeRolls(attackResult, ctx) {
    const { playerName, featureName, attackBonus, damageFormula, damageType, campaignName, snapshot } = ctx;
    const { targetName, d20Roll, ac, hit, isCrit, damageResult } = attackResult;

    addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'attack',
        name: featureName,
        rolls: [d20Roll],
        total: d20Roll,
        bonus: attackBonus,
        isNatural20: d20Roll === 20,
        isNatural1: d20Roll === 1,
        targetName,
        targetAc: ac,
        damageType,
        hit,
        isCrit,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bonusAttacksHandler:roll]", e); });

    if (hit && damageResult) {
        const displayFormula = damageFormula;
        addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'damage',
            name: featureName,
            formula: displayFormula,
            rolls: damageResult.rollResult?.rolls || [],
            total: damageResult.rawDamage,
            modifier: damageResult.rollResult?.modifier || 0,
            damageType,
            targetName,
            finalDamage: damageResult.finalDamage,
            isCrit: damageResult.isCrit,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[bonusAttacksHandler:log-error]", e); });

        addEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: -(damageResult.finalDamage),
            currentHp: snapshot.currentHp - damageResult.finalDamage,
            maxHp: snapshot.maxHp,
            isHealing: false,
            sourceName: playerName,
            note: `${featureName} attack`,
        }).catch((e) => { console.error("[bonusAttacksHandler:log-error]", e); });
    }
}

// CLA-144: Hand of Harm has casting_time '1 reaction' so feature
// categorization files it under playerStats.reactions (featureCategorizationUtils
// CASTING_TIME_CATEGORY) — a specialActions-only search found nothing and the
// Hand of Harm save never armed. Search the row arrays, then the built
// automation.reactions (reaction_damage builder output already carries the
// level-scaled damageExpression and the WIS-based saveDc).
function resolveHandOfHarmAutomation(playerStats) {
    const specialActionRow = (playerStats.specialActions || []).find(a => a.name === 'Hand of Harm');
    if (specialActionRow?.automation) return specialActionRow.automation;

    const reactionRow = (playerStats.reactions || []).find(a => a.name === 'Hand of Harm');
    if (reactionRow?.automation) {
        // Monk spellcasting ability is Wisdom — buildSaveDc's 'ability' path
        // defaults to CON without this stamp.
        return { ...reactionRow.automation, saveAbility: reactionRow.automation.saveAbility || 'WIS' };
    }

    const builtReaction = (playerStats.automation?.reactions || []).find(r => r.type === 'reaction_damage' && r.name === 'Hand of Harm');
    if (builtReaction) return builtReaction;

    return null;
}

function resolveHandOfHealingAutomation(playerStats) {
    const row = (playerStats.bonusActions || []).find(a => a.name === 'Hand of Healing')
        || (playerStats.specialActions || []).find(a => a.name === 'Hand of Healing')
        || (playerStats.reactions || []).find(a => a.name === 'Hand of Healing');
    return row?.automation || null;
}

function resolveFlurryHealingHarm(playerStats, campaignName) {
    const hasFlurryHealingHarm = playerStats.specialActions?.some(f => f.name === "Flurry of Healing and Harm");
    let flurryHealingHarmUses = 0;
    let handOfHarmAuto = null;
    let handOfHealingAuto = null;

    if (hasFlurryHealingHarm) {
        flurryHealingHarmUses = Number(getRuntimeValue(playerStats.name, 'flurryHealingHarmUses', campaignName) || 0);
        handOfHarmAuto = resolveHandOfHarmAutomation(playerStats);
        handOfHealingAuto = resolveHandOfHealingAutomation(playerStats);
        if (!handOfHarmAuto) {
            console.error('[bonusAttacksHandler] Flurry of Healing and Harm held but Hand of Harm automation not found in specialActions/reactions/automation.reactions — harm saves will refuse:', playerStats.name);
        }
    }

    return { hasFlurryHealingHarm, flurryHealingHarmUses, handOfHarmAuto, handOfHealingAuto };
}

// CLA-143: attackType:'unarmed_strike' rows (Flurry of Blows / Heightened
// Flurry of Blows, both rulesets) must roll the Unarmed Strike entry's die
// (lv20 2024 = 1d12), NOT attacks[0] — with a Quarterstaff equipped first the
// old code silently dealt staff 1d6 on "unarmed" Flurry. Rows without
// attackType (e.g. disengage_dodge) keep the attacks[0] behavior byte-identical.
function resolveFlurryWeaponStats(playerStats, auto) {
    const attacks = Array.isArray(playerStats?.attacks) ? playerStats.attacks : [];
    const entry = (auto?.attackType === 'unarmed_strike'
        ? (attacks.find(a => a?.weaponType === 'unarmed') || attacks.find(a => a?.name === 'Unarmed Strike'))
        : null) || attacks[0];
    return {
        attackBonus: entry?.hitBonus ?? 0,
        damageFormula: entry?.damage ?? '1d4+0',
        damageType: entry?.damageType || 'Bludgeoning',
    };
}

function attachPendingOpenHandTargets(result, pendingOpenHandTargets) {
    if (pendingOpenHandTargets.size === 0) return;
    result.openHandTargets = Array.from(pendingOpenHandTargets.values()).map(target => ({
        targetName: target.targetName,
        action: target.action,
        playerStats: target.playerStats,
        campaignName: target.campaignName,
        mapName: target.mapName,
    }));
}

function rollFlurryAttackRoll(d20Roll, attackBonus, ac) {
    const totalAttack = d20Roll + attackBonus;
    const isCrit = DEBUG_FORCE_CRIT || d20Roll === 20;
    const isAutoMiss = d20Roll === 1;
    const hit = isAutoMiss ? false : (totalAttack >= ac);
    return { totalAttack, isCrit, hit };
}

function buildFlurryAbilityDesc(playerName, featureName, numAttacks, totals, hasFlurryHealingHarm) {
    if (hasFlurryHealingHarm) {
        return `${playerName} used ${featureName} (Flurry of Healing and Harm), making ${numAttacks} strikes. Total damage: ${totals.applied}.`;
    }
    // CLA-143: applied totals death-clamp to 0 on corpses — report rolled
    // honestly when they diverge.
    const clampNote = totals.rolled > totals.applied ? ` (rolled ${totals.rolled}, clamped by resistances or death)` : '';
    return `${playerName} used ${featureName}, making ${numAttacks} unarmed strikes. Total damage dealt: ${totals.applied}${clampNote}.`;
}

export async function applyFlurryOfBlows({ action, playerStats, campaignName, _mapName, distribution, numAttacks, healingTarget = null }) {
    const playerName = playerStats.name;
    const featureName = action.name;

    if (!distribution) {
        return null;
    }

    const cs = getCombatSummary(campaignName);
    if (!cs) return null;

    const { attackBonus, damageFormula, damageType } = resolveFlurryWeaponStats(playerStats, action.automation);

    const targetSnapshots = buildFlurryTargetSnapshots(cs, playerName);

    const attackResults = [];
    const totalDamageRef = { value: 0 };
    const totalRolledRef = { value: 0 };
    const pendingOpenHandTargets = new Map();
    const handOfHarmSavePromises = [];

    const openHandFeature = playerStats.automation?.actions?.find(a => a.type === 'open_hand_technique');

    const flurryHarmSetup = resolveFlurryHealingHarm(playerStats, campaignName);
    const { hasFlurryHealingHarm, handOfHarmAuto, handOfHealingAuto } = flurryHarmSetup;
    let flurryHealingHarmUses = flurryHarmSetup.flurryHealingHarmUses;

    for (const [targetName, attackCount] of Object.entries(distribution)) {
        if (!attackCount || attackCount <= 0) continue;

        const snapshot = targetSnapshots[targetName];
        if (!snapshot) continue;

        for (let i = 0; i < attackCount; i++) {
            const d20Roll = rollD20();
            const { totalAttack, isCrit, hit } = rollFlurryAttackRoll(d20Roll, attackBonus, snapshot.ac);

            let damageResult = null;

            if (hit) {
                const outcome = await resolveFlurryHitStrike({
                    cs, targetName, damageFormula, damageType, isCrit, campaignName, playerName,
                    hasFlurryHealingHarm, healingTarget, handOfHarmAuto, handOfHealingAuto, openHandFeature,
                    pendingOpenHandTargets, playerStats, featureName, targetSnapshots,
                    handOfHarmSavePromises, totalDamageRef, totalRolledRef, flurryHealingHarmUses, _mapName,
                });
                damageResult = outcome.damageResult;
                flurryHealingHarmUses = outcome.flurryHealingHarmUses;
            }

            const attackResult = {
                targetName,
                attackNumber: i + 1,
                d20Roll,
                totalAttack,
                ac: snapshot.ac,
                hit,
                isCrit,
                damageResult,
                _damageType: damageType,
            };
            attackResults.push(attackResult);

            logFlurryStrikeRolls(attackResult, {
                playerName, featureName, attackBonus, damageFormula, damageType, campaignName, snapshot,
            });
        }
    }

    const abilityDesc = buildFlurryAbilityDesc(playerName, featureName, numAttacks, { applied: totalDamageRef.value, rolled: totalRolledRef.value }, hasFlurryHealingHarm);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: abilityDesc,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[bonusAttacksHandler:log-error]", e); });

    const hitCount = attackResults.filter(r => r.hit).length;
    const critCount = attackResults.filter(r => r.isCrit).length;

    let description = `${hitCount}/${numAttacks} hits (${critCount} critical${critCount !== 1 ? 's' : ''}), ${totalDamageRef.value} damage<br/><br/>`;
    description += buildAttackResultLines(attackResults);

    const result = {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
        },
    };

    if (handOfHarmSavePromises.length > 0) {
        result.handOfHarmSavePromises = handOfHarmSavePromises;
    }

    attachPendingOpenHandTargets(result, pendingOpenHandTargets);

    return result;
}
