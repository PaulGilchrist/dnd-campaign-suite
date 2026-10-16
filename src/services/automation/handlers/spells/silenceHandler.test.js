import { describe, it, expect, vi, beforeEach } from 'vitest';

// Silence automation seam map (verified live 2026-10-16):
//   handle() is LIVE — registered in automation/index.js as `silence: handleSilence`
//   (index.js:605). On activation it opens the `silence_target_selection` popup,
//   which useSpellCastExecutor.js routes to SilenceModal.jsx.
//   The modal owns target-selection execution (point-model center on first picked
//   token, outside-radius refusal, per-target activeBuffs grant for Thunder
//   immunity + VERBAL gate) and is covered by SilenceModal.test.jsx.
//   The handler's own `handleTargetSelection`/`isSilenceActive` exports are DEAD
//   code (no production caller, no dynamic dispatch; grep-verified) and pinned
//   divergent legacy semantics (caster-fixed center, no refusal, no buff grant).
//   Their former tests were trimmed here; source removal is queued separately.
// RAW: Silence is cast on self or a point, NO saving throw — this handler never
// prompts one. Turn-based: expiry rides addExpiration seams (remove_active_buff
// + clear_silence_zone handled by clearExpirationEffects.js), never a clock.

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// silenceService must stay fully mocked: silenceHandler.js imports these three
// names at module load even though addSilencedTarget is only reached by the
// now-trimmed dead lane.
vi.mock('../../../rules/features/silenceService.js', () => ({
    isSilenceActive: vi.fn(() => false),
    addSilencedTarget: vi.fn(),
    removeSilencedTargets: vi.fn(() => []),
}));

import { handle } from './silenceHandler.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { removeSilencedTargets } from '../../../rules/features/silenceService.js';

const campaignName = 'test-campaign';
const casterName = 'ClericBoy';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Silence',
        automation: {
            type: 'silence',
            aoeRadius: 20,
            ...automationOverrides,
        },
        ...rest,
    };
}

describe('silenceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        toggleBuff.mockReturnValue({ wasActive: false });
        getCombatContext.mockResolvedValue(null);
        removeSilencedTargets.mockReturnValue([]);
    });

    describe('handle', () => {
        describe('activation (not previously active)', () => {
            it('returns popup with silence_target_selection type', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('silence_target_selection');
                expect(result.payload.name).toBe('Silence');
                expect(result.payload.automationType).toBe('silence');
                expect(result.payload.automation).toEqual(makeAction().automation);
            });

            it('includes aoeRadius in the payload', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.aoeRadius).toBe(20);
            });

            it('uses custom aoeRadius from automation', async () => {
                const action = makeAction({ automation: { aoeRadius: 30 } });
                expect(action.automation.type).toBe('silence');

                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.aoeRadius).toBe(30);
            });

            it('calls toggleBuff with correct parameters', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(toggleBuff).toHaveBeenCalledWith(
                    casterName,
                    'Silence',
                    { type: 'silence', aoeRadius: 20, effect: 'silence' },
                    campaignName,
                );
            });

            it('sets runtime values for silence state on activation', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCaster', true, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceRadius', 20, campaignName,
                );
            });

            it('sets silence center based on combat context', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: casterName, gridX: 5, gridY: 10 }],
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    '{"gridX":5,"gridY":10}',
                    campaignName,
                );
            });

            it('sets silence center to null when caster not found in combat context', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: 'OtherCleric', gridX: 3, gridY: 7 }],
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    null,
                    campaignName,
                );
            });

            it('adds expiration to remove the buff and clear silence zone', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [
                        { type: 'remove_active_buff', buffName: 'Silence' },
                        { type: 'clear_silence_zone', casterName },
                    ], campaignName });
            });

            it('builds target list from combat summary including players and creatures', async () => {
                getCombatContext.mockResolvedValue({
                    players: [
                        { name: 'WizardGirl', gridX: 3, gridY: 4 },
                        { name: casterName, gridX: 5, gridY: 5 },
                    ],
                    creatures: [
                        { name: 'Goblin', gridX: 6, gridY: 6, currentHp: 15, maxHp: 30 },
                        { name: 'Orc', gridX: 7, gridY: 7 },
                    ],
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.targets).toHaveLength(4);
                expect(result.payload.targets[0]).toEqual({
                    name: 'WizardGirl',
                    type: 'player',
                });
                expect(result.payload.targets[1]).toEqual({
                    name: casterName,
                    type: 'player',
                });
                expect(result.payload.targets[2]).toEqual({
                    name: 'Goblin',
                    type: 'creature',
                    currentHp: 15,
                    maxHp: 30,
                });
                expect(result.payload.targets[3]).toEqual({
                    name: 'Orc',
                    type: 'creature',
                });
            });

            it('returns empty targets when combat context is null', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.targets).toHaveLength(0);
            });
        });

        describe('deactivation (previously active)', () => {
            it('returns popup with ended description', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.description).toBe('Silence ended');
                expect(result.payload.automation).toEqual(makeAction().automation);
            });

            it('resets runtime values to false/null', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCaster', false, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCenter', null, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceRadius', null, campaignName,
                );
            });

            it('calls removeSilencedTargets to get silenced targets', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(removeSilencedTargets).toHaveBeenCalledWith(casterName, campaignName);
            });

            it('removes deafened condition from silenced targets', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });
                removeSilencedTargets.mockReturnValue(['Goblin', 'WizardGirl']);
                getRuntimeValue.mockReturnValue(['deafened', 'blinded']);

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin', 'activeConditions', ['blinded'], campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'WizardGirl', 'activeConditions', ['blinded'], campaignName,
                );
            });

            it('does not add expiration or post log when deactivating', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        });
    });
});
