import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { loadSpells } from '../../ui/dataLoader.js';

const REACTION_TIMES = new Set(['Reaction', '1 Reaction']);

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const storedUses = getRuntimeValue(playerName, 'divineInterventionUses', campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (playerStats._trackedResources?.divineInterventionUses?.current ?? 1);

    if (currentUses <= 0) {
        const wishCooldown = getRuntimeValue(playerName, '_divineInterventionWishCooldown', campaignName);
        const cooldownRemaining = wishCooldown != null ? Number(wishCooldown) : 0;
        const desc = cooldownRemaining > 0
            ? `Divine Intervention (Wish) is on cooldown. ${cooldownRemaining} long rest${cooldownRemaining > 1 ? 's' : ''} remaining.`
            : 'Divine Intervention is expended. It recharges after a Long Rest.';
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: desc,
            },
        };
    }

    const isGreater = auto.upgradeTo === 'wish';
    const allSpells = await loadSpells(playerStats.rules || '2024');
    const eligibleSpells = allSpells.filter(s => {
        if (isGreater) {
            return s.name === 'Wish';
        }
        if (!s.classes || !s.classes.includes('Cleric')) return false;
        if (s.level > 5) return false;
        if (REACTION_TIMES.has(s.casting_time)) return false;
        return true;
    });

    return {
        type: 'modal',
        modalName: 'divineIntervention',
        payload: {
            featureName: action.name,
            isGreater,
            eligibleSpells,
            playerStats,
            campaignName,
        },
    };
}

export async function onSpellSelected(action, playerStats, campaignName, selectedSpell) {
    const playerName = playerStats.name;
    const auto = action.automation;

    const storedUses = getRuntimeValue(playerName, 'divineInterventionUses', campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (playerStats._trackedResources?.divineInterventionUses?.current ?? 1);

    if (currentUses <= 0) return null;

    const isGreater = auto.upgradeTo === 'wish';
    let newUses = currentUses - 1;
    let rechargeMessage = 'until you finish a Long Rest.';

    if (isGreater && selectedSpell.name === 'Wish') {
        const d4Roll = Math.floor(Math.random() * 4) + 1;
        const d4Roll2 = Math.floor(Math.random() * 4) + 1;
        const cooldown = d4Roll + d4Roll2;
        setRuntimeValue(playerName, '_divineInterventionWishCooldown', cooldown, campaignName, true);
        newUses = -1;
        rechargeMessage = `until you finish ${cooldown} Long Rests.`;
    }

    setRuntimeValue(playerName, 'divineInterventionUses', newUses, campaignName, true);

    return {
        type: 'spell_selected',
        spell: selectedSpell,
        skipSlotCost: true,
        skipMaterialComponents: true,
        rechargeMessage,
        name: action.name,
    };
}
