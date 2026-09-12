import { getHitDieSize } from '../../../rules/effects/restRules.js';

function resolveSlotLevel(action) {
    return action.metaCtx?.slotLevel || action.metaCtx?.modifiedSpell?.level || action.metaCtx?.upcastLevel || 2;
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

    const spellcastingAbility = playerStats.spellAbilities?.spellcasting_ability || 'INT';
    const abilityObj = playerStats.abilities?.find(a => a.name === spellcastingAbility);
    const spellcastingAbilityModifier = abilityObj?.bonus || 0;

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
