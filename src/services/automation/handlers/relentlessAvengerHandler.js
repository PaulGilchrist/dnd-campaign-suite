import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — <i>No target selected — effect noted for manual application.</i>`,
                automation: auto,
            },
        };
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: action.name,
        option: 'Relentless Avenger',
        effect: 'speed_zero',
        value: null,
        duration: auto.duration || 'until_end_of_current_turn',
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    const combatContext = await getCombatContext(campaignName);
    if (combatContext && combatContext.creatures) {
        const targetCreature = combatContext.creatures.find(c => c.name === targetName);
        if (targetCreature) {
            const conditions = targetCreature.conditions || [];
            const speedZeroAlready = conditions.some(c => c.key === 'speed_zero');
            if (!speedZeroAlready) {
                conditions.push({ key: 'speed_zero', source: action.name });
                setRuntimeValue(campaignName, 'combatContext', combatContext, campaignName);
            }
        }
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${targetName}'s Speed is reduced to 0 until end of current turn. You may move up to half your Speed as part of this Reaction.`,
            automation: auto,
        },
    };
}
