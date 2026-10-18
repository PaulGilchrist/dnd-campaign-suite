// @maintained-by-ai
// CLA-177 lane: branches unique to Naturally Stealthy in handleHideAction —
// the hasNaturallyStealthy eligibility gate, larger-obscuring-creature resolution
// (inline combatSummary size vs monsters.json fallback), the 5-ft range seam, and
// the byte-exact trait citation clause in the success AND failure popup/log copy.
// Baseline popup/log copy, cannotAct + already-hidden gates, forcedMode channels,
// Skulker copy, and Invisible/advantage_on_stealth stamping (identical payload for
// Naturally Stealthy hides — the trait only changes copy, per buildHide*Messages)
// are owned by useCharActionsHideAction.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import {
    createHooks,
    mockGetMonsterData,
    mockSetPopupHtml,
    mockAddEntry,
    campaignName,
    basePlayerStats,
} from './useCharActionsBaseActions.test-utils.js';

// lv5 halfling carrying the Naturally Stealthy passive_rule (automationPassives.hasNaturallyStealthy shape).
// race.size 'Small (about 2-3 feet tall)' exercises the startsWith size normalization.
function halflingStats() {
    return {
        ...basePlayerStats,
        rules: '2024',
        race: { name: 'Halfling', size: 'Small (about 2-3 feet tall)' },
        automation: { passives: [{ type: 'passive_rule', effect: 'naturally_stealthy' }] },
    };
}

// Character is visible (no activeConditions) so the already-hidden gate passes;
// supplies the stubbed Stealth roll that the popup/log math reads.
function visibleGrv(lastAttack) {
    return vi.fn((_charKey, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'lastAttack') return lastAttack;
        return undefined;
    });
}

describe('handleHideAction — Naturally Stealthy (CLA-177)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Inline combatSummary size: the creature scan must short-circuit before any
    // monsters.json lookup, and the trait clause appears byte-exact in both the
    // success and failure copy (the two buildHide*Messages obscurement branches).
    it.each([
        {
            name: 'success',
            lastAttack: { total: 18, d20: 12 },
            popup: 'Hide successful! (Naturally Stealthy - obscured by Ogre 1 (Large, at least one size larger)) (d20: 12 + 0 = 18) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.',
            log: 'Stealth check: 18 (Naturally Stealthy - obscured by Ogre 1 (Large, at least one size larger)) (d20: 12 + 0) vs DC 15 — Success. Gained Invisible condition and advantage on Stealth checks.',
        },
        {
            name: 'failure',
            lastAttack: { total: 10, d20: 4 },
            popup: 'Hide failed! (Naturally Stealthy - obscured by Ogre 1 (Large, at least one size larger)) (d20: 4 + 0 = 10) You remain visible.',
            log: 'Stealth check: 10 (Naturally Stealthy - obscured by Ogre 1 (Large, at least one size larger)) (d20: 4 + 0) vs DC 15 — Failure. Did not gain the Invisible condition.',
        },
    ])('cites the trait byte-exact in popup and log on $name when a Large creature is within reach', async ({ lastAttack, popup, log }) => {
        const loadCombatSummary = vi.fn().mockResolvedValue({
            creatures: [{ name: 'TestFighter' }, { name: 'Ogre 1', size: 'Large' }],
        });
        const hooks = createHooks({
            getRuntimeValue: visibleGrv(lastAttack),
            playerStats: halflingStats(),
            loadCombatSummary,
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockGetMonsterData).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Hide', description: popup });
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Hide',
            description: log,
        });
    });

    it('resolves size via monsters.json only when the combatSummary entry lacks one', async () => {
        const creatures = [{ name: 'TestFighter' }, { name: 'Ogre 1' }];
        const loadCombatSummary = vi.fn().mockResolvedValue({ creatures });
        const getMonsterData = vi.fn().mockResolvedValue({ name: 'Ogre', size: 'Large' });
        const hooks = createHooks({
            getRuntimeValue: visibleGrv({ total: 18, d20: 12 }),
            playerStats: halflingStats(),
            loadCombatSummary,
            getMonsterData,
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(getMonsterData).toHaveBeenCalledWith('Ogre 1', creatures);
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Hide',
            description: 'Hide successful! (Naturally Stealthy - obscured by Ogre 1 (Large, at least one size larger)) (d20: 12 + 0 = 18) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.',
        });
    });

    // Provable boundaries: a same-size creature fails the one-size-larger test and
    // an ineligible character never runs the scan at all — both must emit the plain
    // baseline copy (byte-exact pins double as the absence proof).
    it.each([
        {
            name: 'halfling scanned but no creature is larger (same-size Kobold boundary)',
            playerStats: halflingStats(),
            creatures: [{ name: 'TestFighter' }, { name: 'Kobold 1', size: 'Small' }],
            scanRan: true,
        },
        {
            name: 'character without the passive never scans (non-halfling control)',
            playerStats: { ...basePlayerStats, rules: '2024' },
            creatures: [{ name: 'TestFighter' }, { name: 'Ogre 1', size: 'Large' }],
            scanRan: false,
        },
    ])('emits baseline copy with no trait citation when $name', async ({ playerStats, creatures, scanRan }) => {
        const loadCombatSummary = vi.fn().mockResolvedValue({ creatures });
        const hooks = createHooks({
            getRuntimeValue: visibleGrv({ total: 18, d20: 12 }),
            playerStats,
            loadCombatSummary,
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        if (scanRan) {
            expect(loadCombatSummary).toHaveBeenCalledWith(campaignName);
        } else {
            expect(loadCombatSummary).not.toHaveBeenCalled();
        }
        expect(mockGetMonsterData).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Hide',
            description: 'Hide successful! (d20: 12 + 0 = 18) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.',
        });
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Hide',
            description: 'Stealth check: 18 (d20: 12 + 0) vs DC 15 — Success. Gained Invisible condition and advantage on Stealth checks.',
        });
    });
});
