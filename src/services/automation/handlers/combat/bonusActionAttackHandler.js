import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { isPolearmWeapon } from '../../common/polearmUtils.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

function slug(name) {
    return String(name || 'war_priest').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'war_priest';
}

function rechargeLabel(recharge) {
    return String(recharge || 'long_rest').split(/[_\s]+/).filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Long Rest';
}

// CLA-382: War Priest RAW is "one attack with a weapon or an Unarmed Strike".
// Own equipped melee, else a loaded ranged weapon (Loading crossbows can't be
// shot again on a Bonus Action), else the Unarmed Strike row.
function pickBonusAttackWeapon(playerStats) {
    const attacks = Array.isArray(playerStats?.attacks) ? playerStats.attacks : [];
    const isLoadedRanged = a => a.weaponType === 'ranged'
        && !(a.properties || []).some(p => /loading/i.test(String(p)));
    return attacks.find(a => a.weaponType === 'melee')
        || attacks.find(isLoadedRanged)
        || attacks.find(a => a.weaponType === 'unarmed')
        || null;
}

// FT-102: "Immediately after you take the Attack action and attack with a
// Quarterstaff, Spear, or a Heavy and Reach weapon" (2024 feats.json). The old
// gate only matched the weapon name on the campaign-global lastAttack — no
// attacker identity, no turn freshness — so a stale polearm lastAttack from a
// previous turn (or another creature's polearm lastAttack) fired the bonus
// attack. Gate now requires: (1) lastAttack is a polearm (existing refusal
// popup byte-identical), (2) lastAttack.attackerName is the player, and (3)
// the CLA-143 round latch `_attackActionTakenRound` (armed by the
// Attack-action row lane, useCharActionsAttackHandlers.js) is stamped at the
// current round read fresh from getCombatContext (playbook §5). Once-per-Attack
// action stays enforced by lastAttack identity: once Pole Strike resolves,
// lastAttack.attackName is 'Pole Strike' (not a polearm) until the next
// Attack-action polearm attack re-arms.
async function checkPolearmRequirement(action, playerStats, campaignName, logRefusal) {
    const lastAttackResult = await findLastAttack(campaignName);
    const lastAttack = lastAttackResult.attackEvent;
    const weaponName = lastAttack?.damageName || lastAttack?.attackName;
    const isPolearm = await isPolearmWeapon(weaponName);
    if (!isPolearm) {
        const reason = `${action.name} requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.`;
        await logRefusal(reason);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: reason,
                automation: action.automation,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    const currentRound = Number(cs?.round ?? 0);
    const armedRound = Number(getRuntimeValue(playerStats.name, '_attackActionTakenRound', campaignName) ?? 0);
    if (armedRound > 0 && armedRound === currentRound && lastAttack?.attackerName === playerStats.name) {
        return null;
    }

    const reason = `${action.name} must be taken immediately after you attack with a Quarterstaff, Spear, or a Heavy and Reach weapon as part of the Attack action on your current turn.`;
    await logRefusal(reason);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: reason,
            automation: action.automation,
        },
    };
}

async function resolvePoleStrikeLeg(action, playerStats, campaignName, usesKey, usesMax) {
    const auto = action.automation;
    const lastAttackResult = await findLastAttack(campaignName);
    const targetName = lastAttackResult.targetName || null;
    const hitBonus = lastAttackResult.attackEvent?.bonus ?? (playerStats.proficiency || 0);

    const damageExpression = auto.damage || auto.extraDamageExpression || '1d4';
    const damageType = auto.damageType || 'Bludgeoning';

    // CLA-382: decrement moved here from the pre-gate so the single awaited
    // spend happens on the leg that actually resolves an attack.
    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    const poleStrikeAttack = {
        name: action.name || 'Pole Strike',
        type: 'Bonus Action',
        range: MELEE_REACH_FEET,
        hitBonus,
        damage: damageExpression,
        damageType,
        autoDamageFormula: damageExpression,
        autoDamageName: action.name || 'Pole Strike',
    };

    return {
        type: 'attack_roll',
        payload: {
            attack: poleStrikeAttack,
            targetName,
            sourceName: action.name,
        },
    };
}

async function resolveDisengageLeg(action, playerStats, campaignName) {
    const auto = action.automation;
    const storedConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'grappled');
    if (filtered.length !== conditions.length) {
        await setRuntimeValue(playerStats.name, 'activeConditions', filtered, campaignName);
    }
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `You take the Disengage action and the Grappled condition ends on you.`,
            automation: auto,
        },
    };
}

// CLA-382: War Priest (2024 Cleric, War Domain lv3) was popup-only — the row
// declared no trigger, so nothing ever produced an attack_roll. Any uses-bearing
// bonus_action_attack row that reaches here (War Priest is the only one in app
// data) now resolves a real weapon attack mirroring the verified Pole Strike shape.
async function resolveWarPriestLeg({ action, playerStats, campaignName, usesKey, usesMax, refusal, logRefusal }) {
    const cs = await getCombatContext(campaignName);
    const target = getTargetFromAttacker(cs, playerStats.name);
    const targetName = target?.name || null;
    if (!targetName) {
        const reason = `${action.name}: No target selected — no attack made, no use spent.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const weapon = pickBonusAttackWeapon(playerStats);
    if (!weapon) {
        const reason = `${action.name}: No usable weapon or Unarmed Strike — no use spent.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
    // Awaited single write BEFORE the attack resolves (CLA-334 §6-#18 write-race rule).
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const attack = {
        name: `${action.name || 'War Priest'} (${weapon.name})`,
        type: 'Bonus Action',
        range: weapon.range ?? MELEE_REACH_FEET,
        hitBonus: weapon.hitBonus ?? (playerStats.proficiency || 0),
        damage: weapon.damage,
        damageType: weapon.damageType || 'Bludgeoning',
        autoDamageFormula: weapon.damage,
        autoDamageName: `${action.name || 'War Priest'} (${weapon.name})`,
    };

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} — bonus-action ${weapon.name} attack on ${targetName} (${currentUses - 1} of ${usesMax} uses remaining).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[bonusActionAttackHandler:log-error]', e); });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}

// CLA-399: Battle Magic (2024 Valor lv14) declares weaponAttack:true with no
// uses economy — it reached the terminal automationInfoPopup and never produced an
// attack. Mirrors the verified resolveWarPriestLeg shape, minus uses-spending
// (no uses in data = no fabricated uses economy).
async function resolveWeaponAttackLeg({ action, playerStats, campaignName, refusal, logRefusal }) {
    const cs = await getCombatContext(campaignName);
    const target = getTargetFromAttacker(cs, playerStats.name);
    const targetName = target?.name || null;
    if (!targetName) {
        const reason = `${action.name}: No target selected — no attack made.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const weapon = pickBonusAttackWeapon(playerStats);
    if (!weapon) {
        const reason = `${action.name}: No usable weapon or Unarmed Strike.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const attack = {
        name: `${action.name || 'Battle Magic'} (${weapon.name})`,
        type: 'Bonus Action',
        range: weapon.range ?? MELEE_REACH_FEET,
        hitBonus: weapon.hitBonus ?? (playerStats.proficiency || 0),
        damage: weapon.damage,
        damageType: weapon.damageType || 'Bludgeoning',
        autoDamageFormula: weapon.damage,
        autoDamageName: `${action.name || 'Battle Magic'} (${weapon.name})`,
    };

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} — bonus-action ${weapon.name} attack on ${targetName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[bonusActionAttackHandler:log-error]', e); });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}

function resolveUsesMax(auto, playerStats) {
    const rawUsesMax = auto.usesMax ?? (auto.uses_expression
        ? evaluateAutoExpression(auto.uses_expression, playerStats)
        : 0);
    return Number(rawUsesMax) || 0;
}

// Battle Magic's exact row shape (weaponAttack + after_casting_action_spell,
// no extraDamage rider). Psychic Blades (different trigger + extraDamageExpression)
// and all other rows keep their existing paths byte-identical.
function isBattleMagicRow(auto) {
    return auto?.weaponAttack === true && auto?.trigger === 'after_casting_action_spell' && !auto?.extraDamageExpression;
}

function dispatchLeg({ auto, isPolearm, usesMax, action, playerStats, campaignName, usesKey, refusal, logRefusal }) {
    if (auto?.effect === 'disengage_end_grappled') {
        return resolveDisengageLeg(action, playerStats, campaignName);
    }
    if (isPolearm) {
        return resolvePoleStrikeLeg(action, playerStats, campaignName, usesKey, usesMax);
    }
    if (usesMax > 0) {
        return resolveWarPriestLeg({ action, playerStats, campaignName, usesKey, usesMax, refusal, logRefusal });
    }
    if (isBattleMagicRow(auto)) {
        return resolveWeaponAttackLeg({ action, playerStats, campaignName, refusal, logRefusal });
    }
    return automationInfoPopup(action);
}

export async function handle(action, playerStats, campaignName, _mapName, _allEquipment) {
    const auto = action.automation;
    const isPolearm = auto?.trigger === 'after_attack_action_with_polearm';

    // FT-102: hoisted above the polearm gate so trigger refusals also log
    // `automation` + `<feature>_refused` (playbook §5, zero spend).
    const logRefusal = async (reason) => {
        await addEntry(campaignName, {
            type: 'automation',
            characterName: playerStats.name,
            automationType: `${slug(action.name)}_refused`,
            name: action.name,
            description: `${action.name} refused — ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[bonusActionAttackHandler:log-error]', e); });
    };

    const refusal = (reason) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto?.type,
            description: reason,
            automation: auto,
        },
    });

    // CLA-382: bonus-action-attack rows dispatch the RAW classes.json automation,
    // which carries only `uses_expression` ("WIS modifier_min_1"), never a baked
    // usesMax — the old gate saw usesMax=0 and skipped, so War Priest was an
    // unlimited popup-only row. Resolve the expression here (mirrors the verified
    // bardicInspiration/stepsOfTheFey pattern).
    const usesMax = resolveUsesMax(auto, playerStats);
    const usesKey = auto.resourceKey || 'warPriestUses';

    if (isPolearm || auto?.weaponRequirement === 'quarterstaff_spear_heavy_reach') {
        const invalid = await checkPolearmRequirement(action, playerStats, campaignName, logRefusal);
        if (invalid) return invalid;
    }

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            const reason = `${action.name} has no uses remaining. Recharges on a ${rechargeLabel(auto.recharge)}.`;
            await logRefusal(reason);
            return refusal(reason);
        }
    }

    return dispatchLeg({ auto, isPolearm, usesMax, action, playerStats, campaignName, usesKey, refusal, logRefusal });
}
