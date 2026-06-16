import { handle, onIllusionSavantSelected, onIllusionSavantCast, onIllusionSavantLevelUp } from './illusionSavantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpells: vi.fn(),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    rules: '2024',
    level: 5,
};

const mockCampaignName = 'test-campaign';

const mockIllusionSpells = [
    { name: 'Minor Illusion', school: 'Illusion', level: 0, casting_time: '1 action', range: '60 ft.', description: 'Create a sound or image.', damage: null },
    { name: 'Disguise Self', school: 'Illusion', level: 1, casting_time: '1 action', range: 'Self', description: 'Transform your appearance.', damage: null },
    { name: 'Silent Image', school: 'Illusion', level: 1, casting_time: '1 action', range: '120 ft.', description: 'Create an image of an object.', damage: null },
    { name: 'Phantasmal Force', school: 'Illusion', level: 2, casting_time: '1 action', range: '60 ft.', description: 'Create a creature or object.', damage: '1d4 psychic' },
    { name: 'Major Image', school: 'Illusion', level: 3, casting_time: '1 action', range: '120 ft.', description: 'Creates visual illusion.', damage: null },
];

describe('illusionSavantHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal when no spells selected', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockIllusionSpells);

            const result = await handle(
                { name: 'Illusion Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('illusionSavant');
            expect(result.payload.illusionOptions).toEqual(['Minor Illusion', 'Disguise Self', 'Silent Image', 'Phantasmal Force']);
            expect(result.payload.selectedSpells).toEqual([]);
        });

        it('should exclude non-Illusion spells', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                ...mockIllusionSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
                { name: 'Magic Missile', school: 'Evocation', level: 1 },
                { name: 'Major Image', school: 'Illusion', level: 3 },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Illusion Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            expect(result.payload.illusionOptions).not.toContain('Major Image');
            expect(result.payload.illusionOptions).not.toContain('Fire Bolt');
            expect(result.payload.illusionOptions).not.toContain('Magic Missile');
        });

        it('should return popup with available spells when some are selected', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Illusion_Savant_selection') return ['Disguise Self', 'Silent Image'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await handle(
                { name: 'Illusion Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.html).toContain('Disguise Self');
            expect(result.payload.html).toContain('Silent Image');
        });

        it('should return info popup when all spells used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Illusion_Savant_selection') return ['Disguise Self', 'Silent Image'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await handle(
                { name: 'Illusion Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('All Illusion Savant spells have been used');
        });
    });

    describe('onIllusionSavantSelected', () => {
        it('should set runtime value with selected spells', async () => {
            const result = await onIllusionSavantSelected(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self',
                'Silent Image'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Illusion_Savant_selection',
                ['Disguise Self', 'Silent Image'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Disguise Self');
            expect(result.payload.description).toContain('Silent Image');
        });

        it('should reject same spell twice', async () => {
            const result = await onIllusionSavantSelected(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self',
                'Disguise Self'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });

        it('should reject missing spells', async () => {
            const result = await onIllusionSavantSelected(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });
    });

    describe('onIllusionSavantCast', () => {
        it('should mark spell as used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Illusion_Savant_selection') return ['Disguise Self', 'Silent Image'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await onIllusionSavantCast(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self'
            );

            expect(setRuntimeValue).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Disguise Self');
            expect(result.payload.description).toContain('no spell slot expended');
        });

        it('should reject casting non-selected spell', async () => {
            getRuntimeValue.mockReturnValue(['Disguise Self']);

            const result = await onIllusionSavantCast(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Silent Image'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Illusion Savant spell');
        });

        it('should reject already-used spell', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Illusion_Savant_selection') return ['Disguise Self'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await onIllusionSavantCast(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already been cast');
        });
    });

    describe('onIllusionSavantLevelUp', () => {
        it('should add new spell to selection', async () => {
            getRuntimeValue.mockReturnValue(['Disguise Self', 'Silent Image']);
            loadSpells.mockResolvedValue(mockIllusionSpells);

            const result = await onIllusionSavantLevelUp(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Phantasmal Force'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Illusion_Savant_selection',
                ['Disguise Self', 'Silent Image', 'Phantasmal Force'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Phantasmal Force');
        });

        it('should reject non-Illusion spell', async () => {
            getRuntimeValue.mockReturnValue(['Disguise Self']);
            loadSpells.mockResolvedValue([
                ...mockIllusionSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
            ]);

            const result = await onIllusionSavantLevelUp(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Illusion school spell');
        });

        it('should reject null spell', async () => {
            const result = await onIllusionSavantLevelUp(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
        });
    });
});
