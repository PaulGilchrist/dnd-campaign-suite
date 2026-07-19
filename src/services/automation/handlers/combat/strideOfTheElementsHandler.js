import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const STRIDE_OPTIONS = [
    { name: 'Cold', effect: 'ice_walk', label: 'Ice Walk', icon: 'fa-snowflake', description: 'You can walk across and climb icy or wet surfaces without needing to make an Ability Check. You ignore difficult terrain that is composed of ice or snow.' },
    { name: 'Fire', effect: 'speed_boost', label: '+10 Speed', icon: 'fa-fire', description: 'Your Speed increases by 10 feet.', speedBonus: 10 },
    { name: 'Lightning', effect: 'fly_speed_equals_walk_speed', label: 'Fly Speed', icon: 'fa-bolt-lightning', description: 'You gain a Fly Speed equal to your Speed.' },
    { name: 'Thunder', effect: 'teleport_ready', label: 'Teleport 30 ft', icon: 'fa-wind', description: 'You can teleport up to 30 ft to an unoccupied space you can see.', teleportDistance: '30 ft' },
];

export { STRIDE_OPTIONS };

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const elementalAttunementActive = getRuntimeValue(playerName, 'elementalAttunementActive', campaignName);

    if (!elementalAttunementActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation?.type,
                description: 'Elemental Attunement must be active to use Stride of the Elements.',
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'strideOfTheElements',
        payload: { action, playerStats, campaignName },
    };
}
