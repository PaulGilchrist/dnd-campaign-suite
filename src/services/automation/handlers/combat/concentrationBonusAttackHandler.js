import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { DEBUG_FORCE_CRIT } from '../../../ui/utils.js';

const LATCH_KEY = '_Telekinetic_Master_attack_usedRound';

// CLA-356: Telekinetic Master (Psi Warrior lv18) — "On each turn while maintaining
// Concentration, make one weapon attack as a Bonus Action." The Bonus Actions row was
// popup-only (no attack resolved). This now gates on LIVE combat concentration, refuses
// (spending nothing) when not concentrating, latches once per turn, and routes a real
// weapon attack through the damage pipeline (roll → damage → applyDamage → logs),
// mirroring bonusAttacksHandler's single-strike model.
export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const concentrationSpell = auto.concentrationSpell || 'Telekinesis';

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `No combat context found. Cannot use ${action.name}.`,
                automation: auto,
            },
        };
    }

    const refusal = (reason) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${reason}`,
            automation: auto,
        },
    });

    const logRefusal = async (reason) => {
        await addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'concentration_bonus_attack_refused',
            name: action.name,
            description: `${action.name} refused — ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[concentrationBonusAttackHandler:log-error]", e); });
    };

    // Gate on LIVE concentration: concentration is established by casting the spell
    // (spellPreparationService), not by this row.
    const creature = cs.creatures?.find(c => c.name === playerName);
    const concentrating = creature?.concentration && creature.concentration.spell === concentrationSpell;
    if (!concentrating) {
        const reason = `You are not concentrating on ${concentrationSpell}. Cast ${concentrationSpell} first.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const round = cs.round ?? 1;
    const latch = getRuntimeValue(playerName, LATCH_KEY, campaignName);
    if (latch && (latch.round ?? 0) >= round) {
        const reason = 'You have already made your bonus-action weapon attack this turn.';
        await logRefusal(reason);
        return refusal(reason);
    }

    const target = getTargetFromAttacker(cs, playerName);
    const targetName = target?.name || null;
    if (!targetName) {
        const reason = 'No target selected — no attack made.';
        await logRefusal(reason);
        return refusal(reason);
    }

    const weapon = (playerStats.attacks || []).find(a => (a.weaponType || a.attackType) === 'melee')
        || playerStats.attacks?.[0];
    const attackBonus = weapon?.hitBonus ?? 0;
    const damageFormula = weapon?.damage || '1d4+0';
    const damageType = weapon?.damageType || 'Bludgeoning';
    const weaponName = weapon?.name || 'weapon';
    const ac = target.ac ?? 10;
    const weaponType = weapon?.weaponType || weapon?.attackType || 'melee';

    const d20Roll = rollD20();
    const total = d20Roll + attackBonus;
    const isCrit = DEBUG_FORCE_CRIT || d20Roll === 20;
    const isAutoMiss = d20Roll === 1;
    const hit = !isAutoMiss && total >= ac;

    // Write the attack roll into lastAttack BEFORE applyDamageToTarget so its
    // merge preserves attacker/target/hit for downstream riders + re-verify.
    await setRuntimeValue('campaign', 'lastAttack', {
        attackerName: playerName,
        targetName,
        d20: d20Roll,
        d20Rolls: [d20Roll],
        bonus: attackBonus,
        total,
        rollType: 'attack',
        hit,
        isCrit,
        isAutoMiss,
        attackName: `${action.name} (${weaponName})`,
        weaponName,
        weaponType,
        targetAc: ac,
        damageFormula,
        damageType,
        primaryDamageType: damageType,
        source: action.name,
        timestamp: Date.now(),
    }, campaignName);

    let finalDamage = 0;
    let damageRolls = [];
    if (hit) {
        const rollResult = (isCrit ? rollExpressionDoubled : rollExpression)(damageFormula);
        const rawDamage = rollResult?.total || 0;
        damageRolls = rollResult?.rolls || [];
        const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
        // applyDamageToTarget writes lastAttack + logs hp_change canonically.
        const applyResult = await applyDamageToTarget(
            cs, targetName, rawDamage, [damageType], campaignName, characters, false, playerName
        );
        finalDamage = applyResult?.finalDamage || 0;
        if (finalDamage > 0) endInvisibilityOnHostileAction(playerName, campaignName);

        await addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'damage',
            name: action.name,
            formula: damageFormula,
            rolls: damageRolls,
            total: rawDamage,
            damageType,
            targetName,
            finalDamage,
            isCrit,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[concentrationBonusAttackHandler:log-error]", e); });
    }

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'attack',
        name: action.name,
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
    }).catch((e) => { console.error("[concentrationBonusAttackHandler:log-error]", e); });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} — bonus-action ${weaponName} attack on ${targetName}: ${isCrit ? 'CRIT' : hit ? 'HIT' : 'MISS'} (${d20Roll}+${attackBonus}=${total} vs AC ${ac})${hit ? `, ${finalDamage} ${damageType} damage` : ''}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[concentrationBonusAttackHandler:log-error]", e); });

    await setRuntimeValue(playerName, LATCH_KEY, { round, activeCreature: playerName }, campaignName);

    const hitText = isCrit ? 'CRITICAL HIT' : hit ? 'HIT' : 'MISS';
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: bonus-action ${weaponName} attack on ${targetName} — <b>${hitText}</b> (${d20Roll}+${attackBonus}=${total} vs AC ${ac})${hit ? `, ${finalDamage} ${damageType} damage` : ''}.`,
            automation: auto,
        },
    };
}
