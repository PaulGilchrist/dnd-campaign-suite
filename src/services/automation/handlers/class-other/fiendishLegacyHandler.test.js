import { handle, confirmFiendishLegacy } from './fiendishLegacyHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';

vi.mock('../../../../hooks/useRuntimeState.js');

const BASE_FEATURE = { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy', options: [] } };
const BASE_STATS = { name: 'TestCharacter' };
const CAMPAIGN = 'test-campaign';

describe('handle – Fiendish Legacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal when no legacy selected', async () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const result = await handle(BASE_FEATURE, BASE_STATS, CAMPAIGN);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishLegacy');
    });

    it('returns popup when legacy already selected', async () => {
        runtimeState.getRuntimeValue.mockReturnValue('Infernal');
        const result = await handle(BASE_FEATURE, BASE_STATS, CAMPAIGN);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Infernal');
    });
});

describe('confirmFiendishLegacy – Fiendish Legacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stores selected Infernal legacy and returns success popup', async () => {
        const result = await confirmFiendishLegacy(BASE_STATS, 'Infernal', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacySelection', 'Infernal', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyCantrip', 'Fire Bolt', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel3', 'Hellish Rebuke', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel5', 'Darkness', CAMPAIGN);
        expect(result.payload.description).toContain('Infernal');
    });

    it('stores Abyssal legacy spells', async () => {
        await confirmFiendishLegacy(BASE_STATS, 'Abyssal', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyCantrip', 'Poison Spray', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel3', 'Ray of Sickness', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel5', 'Hold Person', CAMPAIGN);
    });

    it('stores Chthonic legacy spells', async () => {
        await confirmFiendishLegacy(BASE_STATS, 'Chthonic', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyCantrip', 'Chill Touch', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel3', 'False Life', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(BASE_STATS.name, '_fiendishLegacyLevel5', 'Ray of Enfeeblement', CAMPAIGN);
    });
});
