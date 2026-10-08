import { createMassHealHandler } from './massHealUtils.js';

// SP-091: the once-per-Long-Rest latch (prayerOfHealingLatch.js, LR-cleared via
// LONG_REST_RESOURCES) + per-target short-rest benefit apply to the 2024 canonical
// row (spells.json lv2: five creatures, 2d8, "benefits of a Short Rest", "can't be
// affected again until ... a Long Rest"). The 5e twin (six creatures, 2d8 + MOD,
// neither clause) keeps the enforcement inert and keeps its six-target cap.
const { handle, confirmFn: confirmPrayerOfHealing } = createMassHealHandler({
    spellName: 'Prayer of Healing',
    defaultSlotLevel: 2,
    defaultMaxTargets: 5,
    defaultMaxTargets5e: 6,
    modalName: 'prayerOfHealingTarget',
    logPrefix: 'prayerOfHealing',
    oncePerLongRest: true,
});

export { handle, confirmPrayerOfHealing };
