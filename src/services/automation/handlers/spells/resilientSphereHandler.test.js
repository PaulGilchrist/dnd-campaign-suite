import { handle } from './resilientSphereHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

const campaignName = 'test-campaign';

function makePlayerStats(name = 'TestWizard') {
    return {
        name,
        proficiency: 4,
        spellAbilities: { saveDc: 15 },
        abilities: [{ name: 'Intelligence', bonus: 4 }],
    };
}

describe('resilientSphereHandler', () => {
    let mockPromptId;
    let mockSavePromise;
    let mockResolve;

    beforeEach(() => {
        mockPromptId = 'prompt-1';
        mockSavePromise = new Promise(resolve => { mockResolve = resolve; });

        vi.spyOn(savePrompt, 'buildSaveDc').mockReturnValue(15);
        vi.spyOn(savePrompt, 'createSaveListener').mockReturnValue({
            promptId: mockPromptId,
            promise: mockSavePromise,
        });

        vi.spyOn(targetResolver, 'resolveTarget').mockResolvedValue({
            target: { name: 'Goblin' },
        });

        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
        });

        vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([]);
        vi.spyOn(runtimeState, 'setRuntimeValue').mockReturnValue(undefined);
        vi.spyOn(logService, 'addEntry').mockResolvedValue({ id: 1 });
        vi.spyOn(logPoster, 'postLogEntry').mockResolvedValue(undefined);
        vi.spyOn(expirations, 'addExpiration').mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should prompt for DEX save on failed save', async () => {
        const action = {
            name: "Otiluke's Resilient Sphere",
            automation: {
                type: 'resilient_sphere',
                saveDc: 15,
                saveType: 'DEX',
            },
        };

        const resultPromise = handle(action, makePlayerStats(), campaignName, null);
        // Trigger the save as failed
        mockResolve({ success: false });
        const result = await resultPromise;

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('failed DEX save');
        expect(result.payload.description).toContain('Resilient Sphere');
    });

    it('should report success on successful save', async () => {
        const action = {
            name: "Otiluke's Resilient Sphere",
            automation: {
                type: 'resilient_sphere',
                saveDc: 15,
                saveType: 'DEX',
            },
        };

        const resultPromise = handle(action, makePlayerStats(), campaignName, null);
        mockResolve({ success: true });
        const result = await resultPromise;

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('succeeded on DEX save');
    });

    it('should apply resilient_sphere buff on failed save', async () => {
        const action = {
            name: "Otiluke's Resilient Sphere",
            automation: {
                type: 'resilient_sphere',
                saveDc: 15,
                saveType: 'DEX',
            },
        };

        const resultPromise = handle(action, makePlayerStats(), campaignName, null);
        mockResolve({ success: false });
        await resultPromise;

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Goblin',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ effect: 'resilient_sphere' })
            ]),
            campaignName
        );
    });

    it('should return early when no creatures in combat', async () => {
        vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue({ creatures: [] });

        const action = {
            name: "Otiluke's Resilient Sphere",
            automation: {
                type: 'resilient_sphere',
                saveDc: 15,
                saveType: 'DEX',
            },
        };

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return early when no target selected', async () => {
        vi.spyOn(targetResolver, 'resolveTarget').mockResolvedValue(null);

        const action = {
            name: "Otiluke's Resilient Sphere",
            automation: {
                type: 'resilient_sphere',
                saveDc: 15,
                saveType: 'DEX',
            },
        };

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });
});
