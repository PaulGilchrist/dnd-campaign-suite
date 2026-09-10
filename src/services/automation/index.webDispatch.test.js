// SP-126: the Web live confirmer (useSimpleSpellHandlers) stamped type
// 'web', which has NO HANDLER_MAP entry — executeHandler returned null and
// the whole effect body (DEX saves, Restrained, logs) never ran although the
// slot + concentration were already paid. 'web_area_save' must dispatch to
// handleWebAreaSave.
import { describe, it, expect, vi } from 'vitest';

import { executeHandler } from './index.js';
import { handle as handleWebAreaSave } from './handlers/spells/webAreaSaveHandler.js';

vi.mock('./handlers/spells/webAreaSaveHandler.js', () => ({
    handle: vi.fn(async () => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Web',
            description: 'Web affects 1 creature.',
        },
    })),
    processWebAreaSave: vi.fn(async () => null),
}));

const playerStats = { name: 'DivinationWizard', level: 20, proficiency: 6, spellAbilities: { saveDc: 19 } };

describe('executeHandler — web_area_save dispatch (SP-126)', () => {
    it('routes web_area_save to handleWebAreaSave and returns its popup (not null)', async () => {
        const action = {
            name: 'Web',
            automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 19 },
            metaCtx: { targets: ['Zombie 1'] },
        };
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(handleWebAreaSave).toHaveBeenCalledWith(action, playerStats, 'test-campaign', null, undefined);
        expect(result).not.toBeNull();
        expect(result.payload.description).toContain('Web');
    });

    it('control: bare type web (the broken pre-fix stamp) still dispatches null', async () => {
        const action = {
            name: 'Web',
            automation: { type: 'web', saveType: 'DEX', saveDc: 19 },
            metaCtx: { targets: ['Zombie 1'] },
        };
        const result = await executeHandler(action, playerStats, 'test-campaign', null);

        expect(result).toBeNull();
    });
});
