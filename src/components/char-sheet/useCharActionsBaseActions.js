import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { hasNaturallyStealthy } from '../../services/combat/automation/automationPassives.js'
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js'

const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function sizeIndexFor(size, fallbackIndex) {
    const normalized = String(size || '').trim().toLowerCase();
    const index = SIZE_ORDER.findIndex(s => normalized === s.toLowerCase() || normalized.startsWith(`${s.toLowerCase()} `));
    return index === -1 ? fallbackIndex : index;
}

// Pure: Wisdom (Bardic Inspiration replacement) Stealth bonus recalculation.
function resolveWisReplaceStealthBonus(playerStats, exhaustionPenalty) {
    const wisAbility = playerStats?.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = wisAbility?.bonus || 0;
    const wisBonus = Math.max(1, wisMod);
    const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
    const isProficient = playerStats.skillProficiencies?.includes('Stealth');
    const isExpert = playerStats.expertise?.includes('Stealth');
    let newBonus = wisBonus;
    if (isProficient) newBonus += proficiency;
    if (isExpert) newBonus += proficiency;
    return newBonus - exhaustionPenalty;
}

// Pure: resolve the Stealth check bonus from passive/skill modifiers.
function computeStealthBonus(conditionEffects, playerStats, exhaustionPenalty) {
    const stealthSkill = playerStats?.abilities?.flatMap(a => a.skills || []).find(s => s.name === 'Stealth');
    let stealthBonus = stealthSkill?.bonus ?? 0 - exhaustionPenalty;
    const isCharismaSkill = ['Deception', 'Intimidation', 'Performance', 'Persuasion'].includes('Stealth');
    if (conditionEffects?.wisCheckReplace && isCharismaSkill) {
        stealthBonus = resolveWisReplaceStealthBonus(playerStats, exhaustionPenalty);
    }
    const isJackOfAllTrades = playerStats?.automation?.passives?.some(p => p.type === 'jack_of_all_trades');
    const isNotProficient = !playerStats?.skillProficiencies?.includes('Stealth');
    if (isJackOfAllTrades && isNotProficient) {
        const prof = Math.floor((playerStats.level - 1) / 4 + 2);
        stealthBonus += Math.floor(prof / 2);
    }
    if (conditionEffects?.passWithoutTraceBonus && 'Stealth' === 'Stealth') {
        stealthBonus += parseInt(conditionEffects.passWithoutTraceBonus, 10);
    }
    return stealthBonus;
}

function hasSkulkerFeat(playerStats) {
    return (playerStats?.feats || []).some(f => String(f).toLowerCase().includes('skulker'));
}

function hexDexDisadvantageApplies(conditionEffects) {
    return !!(conditionEffects?.hexAbilityCheckDisadvantage && conditionEffects?.hexAbilityCheckDisadvantageAbility === 'DEX');
}

function stealthAdvantageApplies(conditionEffects) {
    return !!(conditionEffects?.abilityCheckAdvantage && (!conditionEffects?.abilityCheckAdvantageSkill || conditionEffects.abilityCheckAdvantageSkill === 'Stealth'));
}

function peerlessStealthAdvantageApplies(conditionEffects) {
    return !!(conditionEffects?.peerlessAthleteAdvantageSkills && conditionEffects.peerlessAthleteAdvantageSkills.includes('Stealth'));
}

function applyAdvantageUnlessDisadvantaged(checkContext) {
    checkContext.forcedMode = checkContext.forcedMode === 'disadvantage' ? undefined : 'advantage';
}

// Pure: resolve advantage/disadvantage context + Skulker fog-of-war flag.
function resolveStealthCheckContext(conditionEffects, playerStats) {
    const checkContext = {};
    let skulkerFogOfWarApplied = false;
    if (conditionEffects?.abilityCheckDisadvantage) checkContext.forcedMode = 'disadvantage';
    if (!checkContext.forcedMode && hexDexDisadvantageApplies(conditionEffects)) checkContext.forcedMode = 'disadvantage';
    if (stealthAdvantageApplies(conditionEffects)) {
        applyAdvantageUnlessDisadvantaged(checkContext);
    }
    if (peerlessStealthAdvantageApplies(conditionEffects)) {
        applyAdvantageUnlessDisadvantaged(checkContext);
    }
    if (!checkContext.forcedMode && playerStats?.rules === '2024' && hasSkulkerFeat(playerStats)) {
        checkContext.forcedMode = 'advantage';
        skulkerFogOfWarApplied = true;
    }
    return { checkContext, skulkerFogOfWarApplied };
}

// Pure: build the success popup description + log line for a Hide result.
function buildHideSuccessMessages({ d20Val, stealthBonus, rollTotal, dc, skulkerFogOfWarApplied, naturallyStealthyObscuredBy }) {
    let successDesc = `Hide successful! (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.`;
    let successLog = `Stealth check: ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Success. Gained Invisible condition and advantage on Stealth checks.`;
    if (skulkerFogOfWarApplied) {
        successDesc = `Hide successful! (Advantage from Skulker - Fog of War) (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.`;
        successLog = `Stealth check: ${rollTotal} (Advantage from Skulker - Fog of War) (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Success. Gained Invisible condition and advantage on Stealth checks.`;
    }
    if (naturallyStealthyObscuredBy) {
        const obscurement = `${naturallyStealthyObscuredBy.name} (${naturallyStealthyObscuredBy.size}, at least one size larger)`;
        successDesc = `Hide successful! (Naturally Stealthy - obscured by ${obscurement}) (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.`;
        successLog = `Stealth check: ${rollTotal} (Naturally Stealthy - obscured by ${obscurement}) (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Success. Gained Invisible condition and advantage on Stealth checks.`;
    }
    return { successDesc, successLog };
}

// Pure: build the failure popup description + log line for a Hide result.
function buildHideFailureMessages({ d20Val, stealthBonus, rollTotal, dc, skulkerFogOfWarApplied, naturallyStealthyObscuredBy }) {
    let failDesc = `Hide failed! (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You remain visible.`;
    let failLog = `Stealth check: ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Failure. Did not gain the Invisible condition.`;
    if (skulkerFogOfWarApplied) {
        failDesc = `Hide failed! (Advantage from Skulker - Fog of War) (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You remain visible.`;
        failLog = `Stealth check: ${rollTotal} (Advantage from Skulker - Fog of War) (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Failure. Did not gain the Invisible condition.`;
    }
    if (naturallyStealthyObscuredBy) {
        const obscurement = `${naturallyStealthyObscuredBy.name} (${naturallyStealthyObscuredBy.size}, at least one size larger)`;
        failDesc = `Hide failed! (Naturally Stealthy - obscured by ${obscurement}) (d20: ${d20Val} + ${stealthBonus} = ${rollTotal}) You remain visible.`;
        failLog = `Stealth check: ${rollTotal} (Naturally Stealthy - obscured by ${obscurement}) (d20: ${d20Val} + ${stealthBonus}) vs DC ${dc} — Failure. Did not gain the Invisible condition.`;
    }
    return { failDesc, failLog };
}

// Pure: resolve the grapple check ability + bonus (Monk uses DEX; JoAT adds half PB).
function computeGrappleCheckBonus(playerStats, exhaustionPenalty) {
    const isMonk = playerStats.class?.name === 'Monk';
    const strAbility = playerStats?.abilities?.find(a => a.name === 'Strength');
    const strMod = strAbility?.bonus || 0;
    const dexAbility = playerStats?.abilities?.find(a => a.name === 'Dexterity');
    const dexMod = dexAbility?.bonus || 0;
    const useAbility = isMonk ? 'Dexterity' : 'Strength';
    const abilityMod = isMonk ? dexMod : strMod;
    let checkBonus = abilityMod - exhaustionPenalty;
    const isJackOfAllTrades = playerStats?.automation?.passives?.some(p => p.type === 'jack_of_all_trades');
    if (isJackOfAllTrades) {
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        checkBonus += Math.floor(proficiency / 2);
    }
    return { isMonk, useAbility, checkBonus };
}

export default function useCharActionsBaseActions({
    cannotAct,
    getRuntimeValue,
    setRuntimeValue,
    rollSkillCheck,
    rollAbilityCheck,
    addEntry,
    setPopupHtml,
    playerStats,
    campaignName,
    exhaustionPenalty,
    conditionEffects,
    toggleBuff,
    addExpiration,
    loadCombatSummary,
    getMonsterData,
}) {
    async function findLargerObscuringCreature() {
        const cs = await loadCombatSummary(campaignName);
        const creatures = Array.isArray(cs?.creatures) ? cs.creatures : [];
        const playerSizeIndex = sizeIndexFor(playerStats?.size || playerStats?.race?.size || 'Medium', 2);
        for (const creature of creatures) {
            if (!creature || creature.name === playerStats.name) continue;
            if (creature.currentHp === 0) continue;
            let sizeLabel = creature.size || '';
            let sizeIndex = sizeIndexFor(sizeLabel, -1);
            if (sizeIndex === -1) {
                const monsterData = await getMonsterData(creature.name, creatures);
                sizeLabel = monsterData?.size || '';
                sizeIndex = sizeIndexFor(sizeLabel, -1);
            }
            if (sizeIndex < playerSizeIndex + 1) continue;
            if (await isWithinRange(playerStats.name, creature.name, 5)) {
                return { name: creature.name, size: SIZE_ORDER[sizeIndex] };
            }
        }
        return null;
    }

    async function handleHideAction() {
        if (cannotAct) return;
        const currentConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
        const isAlreadyInvisible = currentConditions.some(c => String(c).toLowerCase() === 'invisible');
        if (isAlreadyInvisible) {
            setPopupHtml({ type: 'automation_info', name: 'Hide', description: 'You are already hidden (Invisible condition active).' });
            return;
        }
        const stealthBonus = computeStealthBonus(conditionEffects, playerStats, exhaustionPenalty);
        const { checkContext, skulkerFogOfWarApplied } = resolveStealthCheckContext(conditionEffects, playerStats);
        const naturallyStealthyObscuredBy = hasNaturallyStealthy(playerStats) ? await findLargerObscuringCreature() : null;
        await rollSkillCheck('Stealth', stealthBonus, checkContext);
        await new Promise(resolve => setTimeout(resolve, 50));
        const lastAttackData = await getRuntimeValue('campaign', 'lastAttack', campaignName);
        const rollTotal = lastAttackData?.total;
        const dc = 15;
        const d20Val = lastAttackData?.d20 ?? '?';
        const success = rollTotal >= dc;
        const msgArgs = { d20Val, stealthBonus, rollTotal, dc, skulkerFogOfWarApplied, naturallyStealthyObscuredBy };
        if (success) {
            const newConditions = [...currentConditions, 'invisible'];
            await setRuntimeValue(playerStats.name, 'activeConditions', newConditions, campaignName);
            const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
            const hasAdvantageOnStealth = activeBuffs.some(b => b.effect === 'advantage_on_stealth');
            const newBuffs = hasAdvantageOnStealth ? activeBuffs : [...activeBuffs, { name: 'Hide', effect: 'advantage_on_stealth' }];
            await setRuntimeValue(playerStats.name, 'activeBuffs', newBuffs, campaignName);
            const { successDesc, successLog } = buildHideSuccessMessages(msgArgs);
            setPopupHtml({ type: 'automation_info', name: 'Hide', description: successDesc });
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Hide',
                description: successLog,
            }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
        } else {
            const { failDesc, failLog } = buildHideFailureMessages(msgArgs);
            setPopupHtml({ type: 'automation_info', name: 'Hide', description: failDesc });
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Hide',
                description: failLog,
            }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
        }
    }

    async function handleDodgeAction() {
        if (cannotAct) return;
        const result = toggleBuff(
            playerStats.name,
            'Dodge',
            { effect: 'dodge', duration: 'until_start_of_next_turn' },
            campaignName,
            playerStats.name
        );
        if (!result.wasActive) {
            addExpiration(playerStats.name, playerStats.name, [
                { type: 'remove_active_buff', buffName: 'Dodge' }
            ], campaignName, undefined, playerStats.name);
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Dodge',
                description: `${playerStats.name} takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.`,
            }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
        }
        setPopupHtml({
            type: 'automation_info',
            name: 'Dodge',
            description: result.wasActive
                ? 'Dodge deactivated.'
                : 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.',
        });
    }

    function grappleForcedMode(current, mode) {
        if (mode !== 'advantage') return mode;
        return current === 'disadvantage' ? undefined : 'advantage';
    }

    function resolveGrappleCheckContext(isMonk, useAbility) {
        const ce = conditionEffects || {};
        const ctx = {};
        if (isMonk && ce.peerlessAthleteAdvantageSkills?.includes(useAbility)) {
            ctx.forcedMode = grappleForcedMode(ctx.forcedMode, 'advantage');
        } else if (ce.strCheckDisadvantage) {
            ctx.forcedMode = 'disadvantage';
        }
        if (ce.abilityCheckDisadvantage) ctx.forcedMode = 'disadvantage';
        if (!ctx.forcedMode && ce.hexAbilityCheckDisadvantage && ce.hexAbilityCheckDisadvantageAbility === useAbility) ctx.forcedMode = 'disadvantage';
        if (ce.abilityCheckAdvantage && (!ce.abilityCheckAdvantageSkill || ce.abilityCheckAdvantageSkill === useAbility)) {
            ctx.forcedMode = grappleForcedMode(ctx.forcedMode, 'advantage');
        }
        return ctx;
    }

    // Pure: player target — look up STR bonus from its combatSummary creature entry.
    function resolvePlayerTargetStrBonus(target, cs) {
        const targetCharacter = cs?.creatures?.find(c => c.name === target.name);
        const targetStr = targetCharacter?.computedStats?.abilities?.find(a => a.name === 'Strength') || targetCharacter?.abilities?.find(a => a.name === 'Strength');
        return targetStr?.bonus || 0;
    }

    async function resolveTargetStrBonus(target, cs) {
        let targetStrBonus = 0;
        if (target.computedStats?.abilities) {
            const targetStr = target.computedStats.abilities.find(a => a.name === 'Strength');
            targetStrBonus = targetStr?.bonus || 0;
        } else if (target.abilities) {
            const targetStr = target.abilities.find(a => a.name === 'Strength');
            targetStrBonus = targetStr?.bonus || 0;
        } else if (target.ability_score_modifiers?.str != null) {
            targetStrBonus = target.ability_score_modifiers.str;
        } else if (target.type === 'player') {
            targetStrBonus = resolvePlayerTargetStrBonus(target, cs);
        } else {
            const monsterData = await getMonsterData(target.name, cs?.creatures || []);
            if (monsterData?.ability_score_modifiers?.str != null) {
                targetStrBonus = monsterData.ability_score_modifiers.str;
            }
        }
        return targetStrBonus;
    }

    async function applyGrappleSuccess(target, cs, useAbility, checkBonus, rollTotal, d20Val, targetStrBonus) {
        const combatSummary = cs;
        if (combatSummary?.creatures) {
            const targetCreature = combatSummary.creatures.find(c => c.name === target.name);
            if (targetCreature) {
                const storedConditions = getRuntimeValue(targetCreature.name, 'activeConditions') || [];
                const filtered = storedConditions.filter(c => String(c).toLowerCase() !== 'grappled');
                await setRuntimeValue(targetCreature.name, 'activeConditions', [...filtered, 'grappled'], campaignName);
            }
        }
        const signed = targetStrBonus >= 0 ? '+' : '';
        setPopupHtml({ type: 'automation_info', name: 'Grapple', description: `Grapple successful! (d20: ${d20Val} + ${checkBonus} = ${rollTotal}) vs target STR (${signed}${targetStrBonus}). Target is now grappled.` });
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Grapple',
            description: `${useAbility} check: ${rollTotal} (d20: ${d20Val} + ${checkBonus}) vs target STR (${signed}${targetStrBonus}) — Success. Target is now grappled.`,
        }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
    }

    async function reportGrappleFailure(useAbility, checkBonus, rollTotal, d20Val, targetStrBonus) {
        const signed = targetStrBonus >= 0 ? '+' : '';
        setPopupHtml({ type: 'automation_info', name: 'Grapple', description: `Grapple failed! (d20: ${d20Val} + ${checkBonus} = ${rollTotal}) vs target STR (${signed}${targetStrBonus}). Target is not grappled.` });
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Grapple',
            description: `${useAbility} check: ${rollTotal} (d20: ${d20Val} + ${checkBonus}) vs target STR (${signed}${targetStrBonus}) — Failure. Target is not grappled.`,
        }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
    }

    async function handleGrappleAction() {
        if (cannotAct) return;
        const cs = await loadCombatSummary(campaignName);
        const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
        if (!target) {
            setPopupHtml({ type: 'automation_info', name: 'Grapple', description: 'No target selected. Select a target in combat first.' });
            return;
        }
        const targetConditions = target.conditions || [];
        const isTargetAlreadyGrappled = targetConditions.some(c => String(c).toLowerCase() === 'grappled');
        if (isTargetAlreadyGrappled) {
            setPopupHtml({ type: 'automation_info', name: 'Grapple', description: 'Target is already grappled.' });
            return;
        }
        const { isMonk, useAbility, checkBonus } = computeGrappleCheckBonus(playerStats, exhaustionPenalty);
        const checkContext = resolveGrappleCheckContext(isMonk, useAbility);
        await rollAbilityCheck(useAbility, checkBonus, checkContext);
        await new Promise(resolve => setTimeout(resolve, 50));
        const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
        const rollTotal = lastAttack?.total;
        const d20Val = lastAttack?.d20 ?? '?';
        const targetStrBonus = await resolveTargetStrBonus(target, cs);
        const success = rollTotal > targetStrBonus;
        if (success) {
            await applyGrappleSuccess(target, cs, useAbility, checkBonus, rollTotal, d20Val, targetStrBonus);
        } else {
            await reportGrappleFailure(useAbility, checkBonus, rollTotal, d20Val, targetStrBonus);
        }
    }

    return {
        handleHideAction,
        handleDodgeAction,
        handleGrappleAction,
    };
}
