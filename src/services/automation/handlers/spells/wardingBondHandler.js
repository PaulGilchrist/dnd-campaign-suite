import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { KEY } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// SP-125: duration is 1 hour. Engine encodes minutes as rounds (CLA-334
// recipe: minutes × 10 rounds/minute) → 60 minutes = 600 rounds. No
// expireOnCreatureName anchor (CLA-345 anchor-first-turn drain warning):
// an anchor drains the bond at the anchor's NEXT turn-start (round+1).
const WARDING_BOND_ROUNDS = 600;

const ALL_DAMAGES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const casterName = playerStats.name;

    // 2024 rules: target selected via SecondaryTargetModal (passed through metaCtx)
    let targetName = action.metaCtx?.wardingBondTargetName;

    // Fallback: use combat context target (for non-2024 or legacy flow)
    if (!targetName) {
        const combatSummary = getCombatSummary(campaignName);
        if (combatSummary) {
            const target = getTargetFromAttacker(combatSummary, casterName);
            if (target) {
                targetName = target.name;
            }
        }
    }

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. Choose a willing creature within range.`,
                automation: auto,
            },
        };
    }

    // RAW: casting again on EITHER connected creature ends the previous bond
    // (SP-125: scan the caster store too — if the target's buff expired early,
    // a stale caster-side bond must not stack into duplicates).
    const rawTargetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(rawTargetBuffs) ? rawTargetBuffs : [];
    const rawCasterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterActiveBuffs = Array.isArray(rawCasterBuffs) ? rawCasterBuffs : [];
    const existingBond = targetActiveBuffs.find(b => b.effect === 'warding_bond')
        || casterActiveBuffs.find(b => b.effect === 'warding_bond');

    if (existingBond) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `Casting ${action.name} again ends the previous Warding Bond.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[wardingBond] Recast-break log error:', e); });
    }

    // Apply warding bond buff to target: AC +1, save +1, resistance to all damage
    const targetBuff = {
        name: action.name,
        effect: 'warding_bond',
        duration: auto.duration || '1 hour',
        resistanceTypes: [...ALL_DAMAGES],
        acBonus: 1,
        saveBonus: 1,
        sourceCharacter: casterName,
    };

    const finalTargetBuffs = [...targetActiveBuffs.filter(b => b.effect !== 'warding_bond'), targetBuff];

    // Store bond relationship on caster
    const finalCasterBuffs = [...casterActiveBuffs.filter(b => b.effect !== 'warding_bond'), {
        name: action.name,
        effect: 'warding_bond',
        duration: auto.duration || '1 hour',
        sourceCharacter: casterName,
        bondTarget: targetName,
    }];

    await setRuntimeValue(targetName, 'activeBuffs', finalTargetBuffs, campaignName);
    await setRuntimeValue(casterName, 'activeBuffs', finalCasterBuffs, campaignName);

    // SP-125: 1-hour clocks (CLA-334 minutes×10 → 600 rounds) for BOTH bonded
    // buffs, with NO expireOnCreatureName anchor (CLA-345 anchor-first-turn drain:
    // an anchor strips the ward at the caster's NEXT turn-start, round+1).
    // Registered in ONE merged write (§6-#18: sequential addExpiration calls race —
    // each POST wholesale-replaces the char store, so only one clock survived live).
    // Keeps any non-warding-bond expirations so stale ward clocks cannot strip
    // the new bond after recast.
    const rawExpirations = getRuntimeValue(casterName, KEY, campaignName);
    const keptExpirations = (Array.isArray(rawExpirations) ? rawExpirations : [])
        .filter(e => !(e.effects || []).some(ef => ef.type === 'remove_active_buff' && ef.buffName === action.name));
    const appliedRound = getCurrentCombatRound(campaignName);
    const wardClock = (target) => ({
        target,
        effects: [{ type: 'remove_active_buff', buffName: action.name }],
        appliedRound,
        expiryRounds: WARDING_BOND_ROUNDS,
        expireOnCreatureName: null,
    });
    await setRuntimeValue(casterName, KEY, [...keptExpirations, wardClock(targetName), wardClock(casterName)], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} cast ${action.name} on ${targetName}.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[wardingBond] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated on ${targetName}. While within 60 feet, they gain +1 AC, +1 to saving throws, and resistance to all damage. You take the same damage they take.`,
            automation: auto,
        },
    };
}

export function getWardingBondTarget(casterName, campaignName) {
    const casterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterActiveBuffs = Array.isArray(casterBuffs) ? casterBuffs : [];
    const bondBuff = casterActiveBuffs.find(b => b.effect === 'warding_bond');
    return bondBuff?.bondTarget || null;
}

export function getWardingBondSource(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    const bondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
    return bondBuff?.sourceCharacter || null;
}

export function isWardingBondActive(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    return targetActiveBuffs.some(b => b.effect === 'warding_bond');
}
