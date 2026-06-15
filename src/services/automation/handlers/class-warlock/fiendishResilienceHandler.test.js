import { handle, applyTypeChoice } from './fiendishResilienceHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const BASE_FEATURE = { name: 'Fiendish Resilience', automation: { damageTypes: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'] } };
const BASE_STATS = { name: 'TestCharacter' };
const CAMPAIGN = 'test-campaign';

describe('handle – Fiendish Resilience', () => {
    it('returns modal when no type has been chosen', async () => {
        getRuntimeValue.mockReturnValue(null);
        const result = await handle(BASE_FEATURE, BASE_STATS, CAMPAIGN);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishResilience');
        expect(result.payload.damageTypes).toHaveLength(12);
    });

    it('returns modal with existing type when already chosen', async () => {
        getRuntimeValue.mockReturnValue('Fire');
        const result = await handle(BASE_FEATURE, BASE_STATS, CAMPAIGN);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishResilience');
        expect(result.payload.existingType).toBe('Fire');
    });

    it('logs ability use when type already chosen', async () => {
        getRuntimeValue.mockReturnValue('Cold');
        await handle(BASE_FEATURE, BASE_STATS, CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            description: 'Fiendish Resilience — damage type is Cold',
        }));
    });
});

describe('applyTypeChoice – Fiendish Resilience', () => {
    it('stores chosen type in runtime state', async () => {
        getRuntimeValue.mockReturnValue(null);
        const feature = { ...BASE_FEATURE, automation: { damageTypes: ['Fire', 'Cold'] } };
        const result = await applyTypeChoice(feature, BASE_STATS, CAMPAIGN, 'Fire');
        expect(setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_Fiendish_Resilience_chosenType', 'Fire', CAMPAIGN);
        expect(result.type).toBe('popup');
    });

    it('rejects invalid damage type', async () => {
        getRuntimeValue.mockReturnValue(null);
        const feature = { ...BASE_FEATURE, automation: { damageTypes: ['Fire', 'Cold'] } };
        const result = await applyTypeChoice(feature, BASE_STATS, CAMPAIGN, 'Force');
        expect(result).toBeNull();
    });

    it('logs change when type is switched', async () => {
        getRuntimeValue.mockReturnValue('Fire');
        const feature = { ...BASE_FEATURE, automation: { damageTypes: ['Fire', 'Cold'] } };
        await applyTypeChoice(feature, BASE_STATS, CAMPAIGN, 'Cold');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            description: 'Fiendish Resilience — damage type changed to Cold',
        }));
    });

    it('logs initial set when no previous type', async () => {
        getRuntimeValue.mockReturnValue(null);
        const feature = { ...BASE_FEATURE, automation: { damageTypes: ['Fire', 'Cold'] } };
        await applyTypeChoice(feature, BASE_STATS, CAMPAIGN, 'Fire');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            description: 'Fiendish Resilience — damage type set to Fire',
        }));
    });
});
