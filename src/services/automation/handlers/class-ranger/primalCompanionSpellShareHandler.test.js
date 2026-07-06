// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applySpellShare } from './primalCompanionSpellShareHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Share Spells',
        automation: {
            type: 'primal_companion_spell_share',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('primalCompanionSpellShareHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal when companion is summoned and alive or alive is undefined', async () => {
            // Companion summoned and alive (undefined = treated as alive)
            getRuntimeValue.mockReturnValueOnce('Beast of the Forest').mockReturnValueOnce(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSpellShare');
            expect(result.payload.companionType).toBe('Beast of the Forest');
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns info popup when companion is not alive', async () => {
            getRuntimeValue
                .mockReturnValueOnce('Beast of the Sea')
                .mockReturnValueOnce(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.description).toBe('Primal companion is not alive.');
            expect(result.payload.automation).toBeDefined();
        });

        it('returns info popup when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.description).toBe('No primal companion summoned.');
            expect(result.payload.automation).toBeDefined();
        });
    });

    describe('applySpellShare', () => {
        it('shares spell and sets runtime value when confirmed with companion', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Forest');

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.automationType).toBe('primal_companion_spell_share');
            expect(result.payload.description).toBe('Spell shared with Beast of the Forest.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                'lastSpellShare',
                'Share Spells',
                'test-campaign'
            );
        });

        it('returns info popup when sharing is declined', async () => {
            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.description).toBe('Spell not shared with primal companion.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when no companion exists', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await applySpellShare(makeAction(), makePlayerStats(), 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Share Spells');
            expect(result.payload.description).toBe('No primal companion to share spell with.');
            expect(result.payload.automation).toBeDefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
