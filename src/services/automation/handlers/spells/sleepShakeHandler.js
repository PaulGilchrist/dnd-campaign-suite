// Sleep "Shake Asleep" lane (#1957–#1959) — thin config wrapper over the
// shared wake-on-damage shake factory. Public exports (handle, handleConfirm)
// and file path are unchanged for automation/index.js (sleep_shake
// registration imports handle only; handleConfirm stays exported per the
// #1957 confirm lane); every per-spell literal the twin split required now
// lives in this config.
import { createWakeOnDamageShake } from './wakeOnDamageShake.js';

const { handle, handleConfirm } = createWakeOnDamageShake({
    defaultFeatureName: 'Shake Asleep',
    modalName: 'sleepShake',
    awakenConditions: ['incapacitated', 'unconscious'],
    removalConditions: ['incapacitated', 'unconscious'],
    conditionReason: 'Shake Asleep (Sleep spell)',
    logTag: '[sleepShake]',
    slumberPhrase: 'magical slumber',
    spellName: 'Sleep',
});

export { handle, handleConfirm };
