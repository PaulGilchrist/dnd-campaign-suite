import { handle, applySpellShare } from './primalCompanionSpellShareHandler.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

describe('primalCompanionSpellShareHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockAction = {
        name: 'Share Spells',
        description: 'When you cast a spell targeting yourself, you can also affect your Primal Companion beast if within 30 feet.',
        automation: {
            type: 'primal_companion_spell_share',
            range: '30_ft',
            casting_time: 'passive',
        },
    };

    const mockPlayerStats = { name: 'TestRanger' };

    describe('handle', () => {
        it('returns modal when companion is summoned and alive', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                return true;
            });

            const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSpellShare');
            expect(result.payload.companionType).toBe('Beast of the Forest');
        });

        it('returns popup when no companion is summoned', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return null;
                return undefined;
            });

            const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No primal companion summoned.');
        });

        it('returns popup when companion is not alive', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return false;
                return undefined;
            });

            const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Primal companion is not alive.');
        });
    });

    describe('applySpellShare', () => {
        it('returns success popup when sharing is confirmed', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                return undefined;
            });

            const result = await applySpellShare(mockAction, mockPlayerStats, 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Spell shared with Beast of the Forest.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRanger',
                'lastSpellShare',
                mockAction.name,
                'test-campaign'
            );
        });

        it('returns info popup when sharing is declined', async () => {
            const result = await applySpellShare(mockAction, mockPlayerStats, 'test-campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Spell not shared with primal companion.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when no companion exists', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return null;
                return undefined;
            });

            const result = await applySpellShare(mockAction, mockPlayerStats, 'test-campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No primal companion to share spell with.');
        });
    });
});
