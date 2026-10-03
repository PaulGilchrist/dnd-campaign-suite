import { getHitDieSize } from '../../../rules/effects/restRules.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

// SP-007: read the paid slot level off the forwarded metaCtx (stamped by the
// cast lane) and fall back to the prepared spell's effective level — upcasts
// must resolve dice/level at the slot actually consumed, not the base 2.
function resolveSlotLevel(action) {
    return action.metaCtx?.slotLevel || action.metaCtx?.modifiedSpell?.level || action.metaCtx?.upcastLevel
        || action.spell?.upcastLevel || action.spell?.level || 2;
}

function resolveDiceCount(action, slotLevel) {
    const diceText = action.spell?.heal_at_slot_level?.[String(slotLevel)] || action.action?.heal_at_slot_level?.[String(slotLevel)] || '2 short rest dice';
    return parseInt(diceText, 10) || 2;
}

export function handle(action, playerStats, campaignName, _mapName) {
    const slotLevel = resolveSlotLevel(action);
    const hitDieSize = getHitDieSize(playerStats);

    if (!hitDieSize) {
        console.error(`[arcaneVigor] Could not determine hit die size for ${playerStats.name}`);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: 'arcane_vigor',
                description: `Error: Could not determine hit die size for ${playerStats.name}.`,
            },
        };
    }

    // SP-007: spellcasting_ability carries shorthand ('INT') while playerStats.abilities
    // names are full words ('Intelligence') — resolve via the canonical abilityLookup
    // (same seam automationExpressions uses live) so the modifier is never silently 0.
    const spellcastingAbility = playerStats.spellAbilities?.spellcasting_ability || 'INT';
    const spellcastingAbilityModifier = getAbilityModifier(playerStats.abilities, spellcastingAbility);

    const diceCount = resolveDiceCount(action, slotLevel);

    return {
        type: 'modal',
        modalName: 'ArcaneVigor',
        payload: {
            hitDieSize,
            spellcastingAbility,
            spellcastingAbilityModifier,
            diceCount,
            slotLevel,
            playerName: playerStats.name,
            campaignName,
        },
    };
}
