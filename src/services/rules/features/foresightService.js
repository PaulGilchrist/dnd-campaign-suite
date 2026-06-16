import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

export async function triggerForesight(spell, metaCtx, playerStats, campaignName, _mapName) {
    const isForesight = (spell.name || '').toLowerCase() === 'foresight';
    if (!isForesight) return null;

    const targetName = metaCtx?.targetName || playerStats.name;

    // Add activeBuffs entry on the target for UI display.
    // Also clear Foresight from any previous target (spell ends early if cast again).
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    // Clear Foresight buff from any character that had it from this caster
    // We store the caster name in the buff for cleanup; clearing all 'foresight' buffs
    // from every character would be destructive, so we only clear the target's own buff.
    const newBuffs = activeBuffs.filter(b => b.name !== 'Foresight');
    newBuffs.push({
        name: 'Foresight',
        effect: 'foresight',
        duration: '8 hours',
        source: playerStats.name,
    });
    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    // Add targetEffect on the target so that:
    //   - the target has Advantage on D20 Tests (attacks, saves, ability checks)
    //   - other creatures have Disadvantage on attack rolls against the target
    //
    // The spell ends early if you cast it again, so remove any existing Foresight
    // from this caster before applying the new one.
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const filtered = effects.filter(te => !(te.effect === 'foresight' && te.source === playerStats.name));

    const foresightEffect = {
        target: targetName,
        source: playerStats.name,
        effect: 'foresight',
        duration: '8_hours',
    };
    filtered.push(foresightEffect);
    setRuntimeValue(campaignName, 'targetEffects', filtered, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Foresight',
            automationType: 'foresight',
            description: `<b>Foresight</b><br/>${targetName} has <b>Advantage on D20 Tests</b>, and other creatures have <b>Disadvantage on attack rolls</b> against them for 8 hours.`,
        },
    };
}
