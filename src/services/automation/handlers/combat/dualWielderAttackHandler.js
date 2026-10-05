import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

// FT-104: Dual Wielder (2024 feats.json, Enhanced Dual Wielding) — exactly
// ONE extra attack as a Bonus Action on your own turn with a different melee
// weapon lacking Two-Handed, damage dice only (+magic), once per turn.
// Was mis-routed to the monk Flurry handler (bonus_attacks → 3 Unarmed
// attacks copied from attacks[0]). Mirrors the verified CLA-393
// (Wrath of the Sea) gate shape and the verified CLA-382/CLA-399
// (bonusActionAttackHandler) attack_roll leg shape.
const USED_ROUND_KEY = '_DualWielder_UsedRound';
const DW_ROW_NAME = 'Dual Wielder Extra Attack';

function refusalPopup(action, reason) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: reason,
            automation: action.automation,
        },
    };
}

async function logRefusal(action, playerName, campaignName, reason) {
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'dual_wielder_refused',
        name: action.name,
        description: `${action.name} refused — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[dualWielderAttackHandler:log-error]', e); });
}

// FT-104: the off-hand melee attack row built by attackCalc2024
// (weaponType gate + different-weapon + non-Two-Handed enforced at build).
function pickDualWielderRow(playerStats) {
    return (playerStats.attacks || []).find(a =>
        a.name === DW_ROW_NAME && a.weaponType === 'melee'
        && !(a.properties || []).some(p => String(p).toLowerCase() === 'two-handed')
    ) || null;
}

// Returns { reason } on refusal, { csFresh, currentRound, dwRow, target } on pass.
async function checkGates(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    // CLA-371/CLA-393: fresh combat context for the turn gate + round latch;
    // getCurrentCombatRound MUST thread campaignName (playbook §31).
    const csFresh = await getCombatContext(campaignName);
    if (!csFresh) {
        return { reason: `No combat context found. Cannot use ${action.name}.` };
    }

    const currentRound = getCurrentCombatRound(campaignName);

    // Gate 1 — once-per-turn latch (cleared at round wrap in initiative.jsx
    // + navigationHandlers PLAYER_ROUND_LATCH_KEYS).
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { reason: 'Once per turn — the Dual Wielder extra attack has already been used this round.' };
    }

    // Gate 2 — own turn only ("later on the same turn" is your own turn).
    // Turn-walk authority is __initiative__.lastAppliedTurnStartCreature
    // ("<round>:<name>", §MN-007) — cs.activeCreatureName is a stale mirror.
    const gate = getRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', campaignName) || csFresh.activeCreatureName;
    const ownerName = String(gate || '').includes(':') ? String(gate).split(':').slice(1).join(':') : (gate || '');
    if (ownerName && ownerName !== playerName) {
        return { reason: `It is ${ownerName}'s turn — Enhanced Dual Wielding is a Bonus Action on your own turn.` };
    }

    // Gate 3 — an off-hand melee weapon must be wielded (row from the sheet).
    const dwRow = pickDualWielderRow(playerStats);
    if (!dwRow) {
        return { reason: 'You must be wielding two melee weapons (the second lacking the Two-Handed property, at least one Light).' };
    }

    const target = getTargetFromAttacker(csFresh, playerName);
    if (!target?.name) {
        return { reason: 'No target selected — set the Target dropdown on your initiative card first.' };
    }

    return { csFresh, currentRound, dwRow, target };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;

    const gates = await checkGates(action, playerStats, campaignName);
    if (gates.reason) {
        await logRefusal(action, playerName, campaignName, gates.reason);
        return refusalPopup(action, gates.reason);
    }
    const { currentRound, dwRow, target } = gates;

    // CLA-371: serialize the latch — awaited stamp BEFORE the attack resolves
    // so a second same-round click reads the stamped round and is refused.
    await setRuntimeValue(playerName, USED_ROUND_KEY, currentRound, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} — one Bonus Action off-hand ${dwRow.weaponName || 'melee weapon'} attack on ${target.name} (damage dice only, no ability modifier).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[dualWielderAttackHandler:log-error]', e); });

    // Verified CLA-399 attack_roll leg: single adjudicated attack vs the armed
    // target via the shared attack pipeline (rolls, hit/miss, hp_change).
    return {
        type: 'attack_roll',
        payload: {
            attack: {
                name: `${DW_ROW_NAME} (${dwRow.weaponName || 'Off-Hand'})`,
                type: 'Bonus Action',
                range: dwRow.range ?? 5,
                hitBonus: dwRow.hitBonus ?? (playerStats.proficiency || 0),
                damage: dwRow.damage,
                damageType: dwRow.damageType || 'Slashing',
                autoDamageFormula: dwRow.damage,
                autoDamageName: `${DW_ROW_NAME} (${dwRow.weaponName || 'Off-Hand'})`,
            },
            targetName: target.name,
            sourceName: action.name,
        },
    };
}
