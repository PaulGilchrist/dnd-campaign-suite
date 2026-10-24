import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export async function triggerBlur(spell, metaCtx, playerStats, campaignName, _mapName) {
    const isBlur = (spell.name || '').toLowerCase() === 'blur';
    if (!isBlur) return null;

    // fix#353 (#1341): disk BYTES read range 'Self' on BOTH rulesets
    // (public/data/spells.json Blur row {level:2, range:'Self', concentration:true};
    // 2024/spells.json identical) — RAW Blur targets only the caster, so a
    // pipeline-carried metaCtx.targetName is CLAMPED here; non-caster landing is
    // structurally impossible.
    const targetName = playerStats.name;
    // fix#353: canonical upcast-level idiom BY-cite baneService.js:10
    // (`metaCtx?.slotLevel || spell.level || 1`) — log the ACTUAL cast level;
    // base fallback 2 is Blur's disk level (row cited above).
    const slotLevel = metaCtx?.slotLevel || spell.level || 2;

    // Add activeBuffs entry on the target for UI display.
    // Also clear Blur from any previous target (spell ends early if cast again).
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    const newBuffs = activeBuffs.filter(b => b.name !== 'Blur');
    newBuffs.push({
        name: 'Blur',
        effect: 'blur',
        duration: 'Concentration, up to 1 minute',
        source: playerStats.name,
    });
    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    // Add targetEffect on the target so that creatures have Disadvantage on attack rolls against the target
    // The spell ends early if you cast it again, so remove any existing Blur
    // from this caster before applying the new one.
    const rawEffects = getRuntimeValue('campaign', 'targetEffects');
    const effects = Array.isArray(rawEffects) ? rawEffects : [];
    const filtered = effects.filter(te => !(te.effect === 'blur' && te.source === playerStats.name));

    const blurEffect = {
        target: targetName,
        source: playerStats.name,
        effect: 'blur',
        duration: 'concentration',
    };
    filtered.push(blurEffect);
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);

    // Log to campaign
    addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName,
        spellName: 'Blur',
        spellLevel: slotLevel,
        description: `${playerStats.name} casts Blur on themself. Creatures without Blindsight or Truesight have Disadvantage on attack rolls against them for 1 minute.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[blur] Error logging:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Blur',
            automationType: 'blur',
            description: `<b>Blur</b><br/>${targetName} has <b>Disadvantage on attack rolls against them</b> for 1 minute (concentration). Creatures with Blindsight or Truesight are immune to this effect.`,
        },
    };
}
