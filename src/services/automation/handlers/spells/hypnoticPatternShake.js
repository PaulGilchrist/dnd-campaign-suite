// Hypnotic Pattern "Shake Out Stupor" lane (#1926) — thin config wrapper over
// the shared wake-on-damage shake factory. Public exports (handle,
// handleConfirm) and file path are unchanged for automation/index.js
// (hypnotic_pattern_shake + hypnotic_pattern_shake_confirm registrations);
// every per-spell literal the twin split required now lives in this config.
import { createWakeOnDamageShake } from './wakeOnDamageShake.js';

const { handle, handleConfirm } = createWakeOnDamageShake({
    defaultFeatureName: 'Shake Out Stupor',
    modalName: 'hypnoticPatternShake',
    awakenConditions: ['charmed', 'incapacitated'],
    removalConditions: ['charmed', 'incapacitated', 'speed_zero'],
    conditionReason: 'Shake Out Stupor (Hypnotic Pattern)',
    logTag: '[hypnoticPatternShake]',
    slumberPhrase: 'hypnotic stupor',
    spellName: 'Hypnotic Pattern',
});

export { handle, handleConfirm };
