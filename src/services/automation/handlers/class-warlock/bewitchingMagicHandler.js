import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const freeCastKey = '_Bewitching_Magic_freeCast';
    await setRuntimeValue(playerStats.name, freeCastKey, ['Misty Step'], campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: 'You can cast <b>Misty Step</b> without expending a spell slot as part of the same action.',
        },
    };
}
