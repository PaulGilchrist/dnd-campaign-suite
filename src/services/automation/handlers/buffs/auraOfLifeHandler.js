import { getRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const AURA_OF_LIFE_BUFF_NAME = 'Aura of Life';
const AURA_OF_LIFE_HP_PROTECT_KEY = 'auraOfLifeHpMaxProtected';
// SP-008: RAW duration is Concentration, up to 10 minutes — 10 rounds per
// minute (§37 minutes×10); single rounds:100 clock, NO round anchor (the
// anchor leg fired at the caster's round-2 turn-start and truncated the
// aura to ~1 round).
const AURA_OF_LIFE_DURATION_ROUNDS = 100;

// SP-008: picker cap = party membership (gridless-lenient — no distance
// gate). Selected allies from the Allies chip; when unconfigured, fall back
// leniently to the player combatants on the board plus the caster.
export function resolveAuraOfLifeParty(campaignName, casterName, csCreatures) {
    const storedAllies = getRuntimeValue(casterName, 'selectedAllies');
    const configured = Array.isArray(storedAllies) && storedAllies.length > 0;
    const partyNames = configured ? [...storedAllies] : csCreatures.filter(c => c.type === 'player').map(c => c.name);
    if (!partyNames.some(n => n.toLowerCase() === casterName.toLowerCase())) {
        partyNames.unshift(casterName);
    }
    const lower = new Set(partyNames.map(n => String(n).toLowerCase()));
    return csCreatures.map(c => c.name).filter(n => lower.has(String(n).toLowerCase()));
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const combatSummary = await getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    // SP-008: aura affects the caster and party allies — no 5-target cap
    // (that was the Aura of Protection copy). Gridless-lenient.
    const creatureTargets = resolveAuraOfLifeParty(campaignName, playerStats.name, combatSummary.creatures);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            creatureTargets,
            description: 'An aura radiates from you in a 30-foot Emanation. Choose all willing allies within the aura. Concentration, up to 10 minutes.',
            automation: action.automation || {},
        },
    };
}

export async function applyAuraOfLife(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const auto = action.automation || {};
    const casterName = playerStats.name;
    const appliedTargets = [];

    for (const targetName of targetNames) {
        // Add activeBuffs entry with necrotic resistance
        const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const existingAura = buffs.some(b => b.name === AURA_OF_LIFE_BUFF_NAME);
        const newBuffs = existingAura ? buffs : [...buffs, {
            name: AURA_OF_LIFE_BUFF_NAME,
            effect: 'aura_of_life',
            duration: 'Concentration, up to 10 minutes',
            sourceCharacter: casterName,
            resistanceTypes: ['Necrotic'],
        }];

        // Add turn start heal effect to target's turnStartEffects
        const storedTurnEffects = getRuntimeValue(targetName, 'turnStartEffects', campaignName) || [];
        const newTurnEffects = storedTurnEffects.some(e => e.type === 'aura_of_life_turn_start_heal')
            ? storedTurnEffects
            : [...storedTurnEffects, { type: 'aura_of_life_turn_start_heal', name: AURA_OF_LIFE_BUFF_NAME }];

        // SP-008: ONE merged write per target (§39 same-tick multi-key
        // discipline — un-awaited per-key setRuntimeValue calls could race
        // and drop the turnStartEffects key, as seen live on FeyRanger).
        setRuntimeObject(targetName, {
            activeBuffs: newBuffs,
            [AURA_OF_LIFE_HP_PROTECT_KEY]: true,
            turnStartEffects: newTurnEffects,
        }, campaignName);

        // Register targetEffect for badge display on CreatureCard
        registerTargetEffect(campaignName, targetName, 'aura_of_life', casterName);

        // SP-008: explicit 10-minute clock (rounds 100), NO caster round
        // anchor — the anchor leg expired at the caster's next turn-start,
        // truncating the aura to ~1 round. The expiry legs below strip
        // buff + HP protection + te badge + turn-start heal together.
        addExpiration({ attackerName: casterName, targetName, effects: [
            { type: 'remove_active_buff', buffName: AURA_OF_LIFE_BUFF_NAME },
            { type: 'aura_of_life_hp_protection_end' },
        ], campaignName, rounds: AURA_OF_LIFE_DURATION_ROUNDS });

        // Add concentration for caster
        const combatSummary = getCombatSummary(campaignName);
        addConcentration(combatSummary, casterName, 'Aura of Life', 10 + Math.floor(playerStats.concentrationBonus || 0));

        appliedTargets.push(targetName);

        // Log to campaign
        await addEntry(campaignName, {
            type: 'spell_effect',
            characterName: casterName,
            spellName: action.name,
            targetName,
            effects: ['Resistance to Necrotic damage', 'HP maximum can\'t be reduced', 'Regains 1 HP at start of turn if at 0 HP'],
            timestamp: Date.now(),
        }).catch((e) => { console.error('[auraOfLife] Error:', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${appliedTargets.length} target(s) gained resistance to Necrotic damage, HP maximum protection, and 1 HP healing at start of turn from ${action.name}.`,
            automation: auto,
        },
    };
}

export function isAuraOfLifeActive(targetName, campaignName) {
    const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return buffs.some(b => b.name === AURA_OF_LIFE_BUFF_NAME && b.effect === 'aura_of_life');
}
