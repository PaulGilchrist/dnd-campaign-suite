import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { hasNaturallyStealthy } from '../../services/combat/automation/automationPassives.js'
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js'

const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function computePlayerSizeIndex(playerStats) {
    return sizeIndexFor(playerStats?.size || playerStats?.race?.size || 'Medium', 2);
}

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

function findStealthSkill(playerStats) {
    return (playerStats?.abilities || []).flatMap(a => a.skills || []).find(s => s.name === 'Stealth');
}

// Pure: half proficiency added to Stealth when Jack of All Trades covers a non-proficient skill.
function jackOfAllTradesStealthAdjust(playerStats) {
    const isJackOfAllTrades = playerStats?.automation?.passives?.some(p => p.type === 'jack_of_all_trades');
    const isNotProficient = !playerStats?.skillProficiencies?.includes('Stealth');
    if (isJackOfAllTrades && isNotProficient) {
        const prof = Math.floor((playerStats.level - 1) / 4 + 2);
        return Math.floor(prof / 2);
    }
    return 0;
}

// Pure: resolve the Stealth check bonus from passive/skill modifiers.
function computeStealthBonus(conditionEffects, playerStats, exhaustionPenalty) {
    const ce = conditionEffects || {};
    const stealthSkill = findStealthSkill(playerStats);
    let stealthBonus = stealthSkill?.bonus ?? 0 - exhaustionPenalty;
    const isCharismaSkill = ['Deception', 'Intimidation', 'Performance', 'Persuasion'].includes('Stealth');
    if (ce.wisCheckReplace && isCharismaSkill) {
        stealthBonus = resolveWisReplaceStealthBonus(playerStats, exhaustionPenalty);
    }
    stealthBonus += jackOfAllTradesStealthAdjust(playerStats);
    if (ce.passWithoutTraceBonus && 'Stealth' === 'Stealth') {
        stealthBonus += parseInt(ce.passWithoutTraceBonus, 10);
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

// Pure: resolve the grapple check skill + bonus — Strength (Athletics)
// (Monk uses Dexterity (Acrobatics)). Uses the canonical computed skill
// channel (abilities[].skills bonus, as computed by abilityCalc.getAbilities),
// falling back to ability modifier + proficiency when proficient.
// JoAT adds half PB only when NOT proficient (no stacking).
function abilityModOf(playerStats, abilityName) {
    return playerStats?.abilities?.find(a => a.name === abilityName)?.bonus || 0;
}

function proficiencyBonusForLevel(level) {
    return Math.floor((level - 1) / 4 + 2);
}

function jackOfAllTradesHalfBonus(playerStats) {
    const isJackOfAllTrades = playerStats?.automation?.passives?.some(p => p.type === 'jack_of_all_trades');
    if (!isJackOfAllTrades) return 0;
    return Math.floor(proficiencyBonusForLevel(playerStats.level) / 2);
}

function findSheetSkill(playerStats, skillName) {
    return (playerStats?.abilities || []).flatMap(a => a.skills || []).find(s => s.name === skillName);
}

function computeGrappleCheckBonus(playerStats, exhaustionPenalty) {
    const isMonk = playerStats.class?.name === 'Monk';
    const useAbility = isMonk ? 'Dexterity' : 'Strength';
    const skillName = isMonk ? 'Acrobatics' : 'Athletics';
    const isProficient = !!playerStats.skillProficiencies?.includes(skillName);
    const listedSkillBonus = findSheetSkill(playerStats, skillName)?.bonus;
    let checkBonus;
    if (listedSkillBonus != null) {
        checkBonus = listedSkillBonus;
    } else {
        checkBonus = abilityModOf(playerStats, useAbility) + (isProficient ? proficiencyBonusForLevel(playerStats.level) : 0);
    }
    if (!isProficient) checkBonus += jackOfAllTradesHalfBonus(playerStats);
    checkBonus -= exhaustionPenalty;
    return { isMonk, useAbility, skillName, checkBonus };
}

// Pure: read a listed skill total from a target's skill data, supporting
// array ([{name, bonus}]), dict keyed by skill ({modifier} or number) forms.
function findListedSkillBonus(skills, skillName) {
    if (!skills) return null;
    if (Array.isArray(skills)) {
        const hit = skills.find(s => s?.name === skillName);
        return hit?.bonus ?? null;
    }
    const hit = skills[skillName];
    if (hit == null) return null;
    return typeof hit === 'number' ? hit : (hit.modifier ?? null);
}

// Pure: target's total for one contest skill from target-local data only
// (monster skills dict from monsters.json, NPC skillBonuses, player computedStats).
function resolveTargetListedSkillTotal(target, skillName) {
    const totals = [
        findListedSkillBonus(target?.skillBonuses, skillName),
        findListedSkillBonus(target?.computedStats?.skillBonuses, skillName),
        findListedSkillBonus(target?.skills, skillName),
        findListedSkillBonus(target?.computedStats?.skills, skillName),
        findSheetSkill({ abilities: target?.computedStats?.abilities }, skillName)?.bonus,
        findSheetSkill({ abilities: target?.abilities }, skillName)?.bonus,
    ];
    return totals.find(total => total != null) ?? null;
}

function targetProficiencyBonus(target) {
    if (target?.proficiency_bonus != null) return target.proficiency_bonus;
    const level = target?.computedStats?.level ?? target?.level;
    return level != null ? proficiencyBonusForLevel(level) : 0;
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
        const playerSizeIndex = computePlayerSizeIndex(playerStats);
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
        // BA-001: 2014 Dodge also grants advantage on Dexterity saving throws;
        // 2024 Dodge is attack-roll disadvantage only (public/data manifest BA-001).
        const dexSaveClause = playerStats.rules === '2024'
            ? ''
            : ' You have advantage on Dexterity saving throws.';
        if (!result.wasActive) {
            addExpiration({ attackerName: playerStats.name, targetName: playerStats.name, effects: [
                { type: 'remove_active_buff', buffName: 'Dodge' }
            ], campaignName, rounds: undefined, expireOnCreatureName: playerStats.name });
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: 'Dodge',
                description: `${playerStats.name} takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn.${dexSaveClause}`,
            }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
        }
        setPopupHtml({
            type: 'automation_info',
            name: 'Dodge',
            description: result.wasActive
                ? 'Dodge deactivated.'
                : `Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn.${dexSaveClause}`,
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

    // Pure: player target — look up an ability bonus from its combatSummary creature entry.
    function resolvePlayerTargetAbilityBonus(target, cs, abilityName) {
        const targetCharacter = cs?.creatures?.find(c => c.name === target.name);
        const ability = targetCharacter?.computedStats?.abilities?.find(a => a.name === abilityName) || targetCharacter?.abilities?.find(a => a.name === abilityName);
        return ability?.bonus || 0;
    }

    function findAbilityBonus(entries, abilityName) {
        const ability = entries.find(a => a.name === abilityName);
        return ability?.bonus;
    }

    async function resolveTargetAbilityMod(target, cs, abilityName, modKey) {
        if (target.computedStats?.abilities) {
            const bonus = findAbilityBonus(target.computedStats.abilities, abilityName);
            if (bonus != null) return bonus;
        }
        if (target.abilities) {
            const bonus = findAbilityBonus(target.abilities, abilityName);
            if (bonus != null) return bonus;
        }
        if (target.ability_score_modifiers?.[modKey] != null) return target.ability_score_modifiers[modKey];
        if (target.type === 'player') return resolvePlayerTargetAbilityBonus(target, cs, abilityName);
        const monsterData = await getMonsterData(target.name, cs?.creatures || []);
        return monsterData?.ability_score_modifiers?.[modKey] ?? null;
    }

    // RAW PHB grapple: contested by the target's Strength (Athletics) or
    // Dexterity (Acrobatics) check (target's choice). No contested-check
    // chooser seam exists app-wide, so auto-resolve against the target's
    // higher skill total and log which skill was used.
    async function resolveTargetContest(target, cs) {
        const candidates = [
            { skillName: 'Athletics', abilityName: 'Strength', modKey: 'str' },
            { skillName: 'Acrobatics', abilityName: 'Dexterity', modKey: 'dex' },
        ];
        let best = null;
        for (const candidate of candidates) {
            const profList = target.skillProficiencies || target.proficientSkills || target.computedStats?.skillProficiencies || [];
            let total = resolveTargetListedSkillTotal(target, candidate.skillName);
            if (total == null) {
                const mod = await resolveTargetAbilityMod(target, cs, candidate.abilityName, candidate.modKey);
                if (mod == null) continue;
                total = mod + (profList.includes(candidate.skillName) ? targetProficiencyBonus(target) : 0);
            }
            if (!best || total > best.total) best = { skillName: candidate.skillName, total };
        }
        if (!best) {
            console.error(`[useCharActionsBaseActions] grapple contest: no resolvable Athletics/Acrobatics data for ${target.name}`);
            return { skillName: 'Athletics', total: 0 };
        }
        return best;
    }

    function buildGrappleContestPhrase(target, contest) {
        const signed = contest.total >= 0 ? '+' : '';
        return `${target.name} ${contest.skillName} (${signed}${contest.total})`;
    }

    async function applyGrappleSuccess({ target, cs, useAbility, skillName, checkBonus, rollTotal, d20Val, contest }) {
        const combatSummary = cs;
        if (combatSummary?.creatures) {
            const targetCreature = combatSummary.creatures.find(c => c.name === target.name);
            if (targetCreature) {
                const storedConditions = getRuntimeValue(targetCreature.name, 'activeConditions') || [];
                const filtered = storedConditions.filter(c => String(c).toLowerCase() !== 'grappled');
                await setRuntimeValue(targetCreature.name, 'activeConditions', [...filtered, 'grappled'], campaignName);
            }
        }
        const contestPhrase = buildGrappleContestPhrase(target, contest);
        setPopupHtml({ type: 'automation_info', name: 'Grapple', description: `Grapple successful! (d20: ${d20Val} + ${checkBonus} = ${rollTotal}) vs ${contestPhrase}. Target is now grappled.` });
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Grapple',
            description: `${useAbility} (${skillName}) check: ${rollTotal} (d20: ${d20Val} + ${checkBonus}) vs ${contestPhrase} contest — Success. Target is now grappled.`,
        }).catch((e) => { console.error("[useCharActionsBaseActions:log-error]", e); });
    }

    async function reportGrappleFailure({ target, useAbility, skillName, checkBonus, rollTotal, d20Val, contest }) {
        const contestPhrase = buildGrappleContestPhrase(target, contest);
        setPopupHtml({ type: 'automation_info', name: 'Grapple', description: `Grapple failed! (d20: ${d20Val} + ${checkBonus} = ${rollTotal}) vs ${contestPhrase}. Target is not grappled.` });
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Grapple',
            description: `${useAbility} (${skillName}) check: ${rollTotal} (d20: ${d20Val} + ${checkBonus}) vs ${contestPhrase} contest — Failure. Target is not grappled.`,
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
        const { isMonk, useAbility, skillName, checkBonus } = computeGrappleCheckBonus(playerStats, exhaustionPenalty);
        const checkContext = resolveGrappleCheckContext(isMonk, useAbility);
        await rollAbilityCheck(useAbility, checkBonus, checkContext);
        await new Promise(resolve => setTimeout(resolve, 50));
        const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
        const rollTotal = lastAttack?.total;
        const d20Val = lastAttack?.d20 ?? '?';
        const contest = await resolveTargetContest(target, cs);
        const success = rollTotal > contest.total;
        if (success) {
            await applyGrappleSuccess({ target, cs, useAbility, skillName, checkBonus, rollTotal, d20Val, contest });
        } else {
            await reportGrappleFailure({ target, useAbility, skillName, checkBonus, rollTotal, d20Val, contest });
        }
    }

    return {
        handleHideAction,
        handleDodgeAction,
        handleGrappleAction,
    };
}
