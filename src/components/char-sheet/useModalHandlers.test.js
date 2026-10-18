// @maintained-by-ai
// Base lane for useModalHandlers: owns the returned-handler registry contract and
// handleMasteryClose — the only handler not owned by a slice lane. Sibling owners:
//   useModalHandlers-damage.test.js  — divine fury / generic / modifier / enhanced-unarmed
//                                        choice-skip handlers + no-pending gate table (#357)
//   useModalHandlers-features.test.js— feature-choice confirm/skip + constellation routing (#358)
//   useModalHandlers-flurry.test.js  — flurry confirm/skip + open-hand-from-flurry queue (#359)
//   useModalHandlers-simple.test.js  — weaponMasteryChoice + weaponKindMasteryClose clears (#360)
// Purged-deps justification (runtime-probed: suite green with minimal deps): handleMasteryClose
// (useModalHandlers.js:17-24) references only setModalState/pendingDamage/proceedWithDamage/
// setPendingDamage, so playerStats, rollDamage (source destructures unused _rollDamage),
// campaignName, modalState and its setState-merge mock are dead weight and removed here.

import { describe, it, expect, vi } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

describe('useModalHandlers', () => {
    it('returns exactly the 18 handlers consumers wire into CharActionModals', () => {
        const handlers = useModalHandlers({});

        expect(Object.keys(handlers).sort()).toEqual([
            'handleConstellationSelect',
            'handleDamageTypeModifierChoice',
            'handleDamageTypeModifierSkip',
            'handleDivineFuryDamageType',
            'handleDivineFurySkip',
            'handleEnhancedUnarmedChoice',
            'handleEnhancedUnarmedSkip',
            'handleFeatureChoiceConfirm',
            'handleFeatureChoiceSkip',
            'handleFlurryOfBlowsConfirm',
            'handleFlurryOfBlowsSkip',
            'handleGenericDamageTypeChoice',
            'handleGenericDamageTypeSkip',
            'handleMasteryClose',
            'handleOpenHandFromFlurryConfirm',
            'handleOpenHandFromFlurrySkip',
            'handleWeaponKindMasteryClose',
            'handleWeaponMasteryChoice',
        ]);
        for (const [key, fn] of Object.entries(handlers)) {
            expect(fn, key).toBeTypeOf('function');
        }
    });

    describe('handleMasteryClose', () => {
        it('closes the mastery modal, proceeds with the exact pending payload by reference, then resets pending damage', async () => {
            const attack = { name: 'Longsword' };
            const pendingDamage = {
                attack,
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            };
            const setModalState = vi.fn();
            const proceedWithDamage = vi.fn();
            const setPendingDamage = vi.fn();
            const { handleMasteryClose } = useModalHandlers({
                setModalState, pendingDamage, proceedWithDamage, setPendingDamage,
            });

            await handleMasteryClose();

            expect(setModalState.mock.calls).toEqual([[{ weaponMasteryModal: null }]]);
            expect(proceedWithDamage.mock.calls).toEqual([[{
                attack,
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            }]]);
            // Downstream consumers mutate attack in place (e.g. damage-type
            // modifier rewrites), so the same reference must reach proceedWithDamage.
            expect(proceedWithDamage.mock.calls[0][0].attack).toBe(attack);
            expect(setPendingDamage.mock.calls).toEqual([[null]]);
            // Seam order: close the modal before committing the damage it gated.
            expect(setModalState.mock.invocationCallOrder[0])
                .toBeLessThan(proceedWithDamage.mock.invocationCallOrder[0]);
            expect(proceedWithDamage.mock.invocationCallOrder[0])
                .toBeLessThan(setPendingDamage.mock.invocationCallOrder[0]);
        });

        it('closes the mastery modal and never touches the damage pipeline when nothing is pending', async () => {
            const setModalState = vi.fn();
            const proceedWithDamage = vi.fn();
            const setPendingDamage = vi.fn();
            const { handleMasteryClose } = useModalHandlers({
                setModalState, pendingDamage: null, proceedWithDamage, setPendingDamage,
            });

            await handleMasteryClose();

            expect(setModalState.mock.calls).toEqual([[{ weaponMasteryModal: null }]]);
            expect(proceedWithDamage).not.toHaveBeenCalled();
            expect(setPendingDamage).not.toHaveBeenCalled();
        });
    });
});
