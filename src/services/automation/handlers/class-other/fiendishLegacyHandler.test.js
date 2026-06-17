import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import {
    handle,
    confirmFiendishLegacy,
    getFiendishLegacySelection,
    getFiendishLegacyAbility,
    getFiendishLegacyCantrip,
    getFiendishLegacyLevel3Spell,
    getFiendishLegacyLevel5Spell,
    restoreUses,
} from './fiendishLegacyHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Warlock1',
        level: 3,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Fiendish Legacy',
        automation: { type: 'fiendish_legacy', ...automation },
    };
}

// ─── handle ───

describe('fiendishLegacyHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when legacy already selected', async () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Fiendish Legacy: Infernal (already selected)');
    });

    it('returns modal when no legacy selected', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishLegacy');
    });

    it('includes action, playerStats, campaignName in modal payload', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.action).toBeDefined();
        expect(result.payload.playerStats).toBeDefined();
        expect(result.payload.campaignName).toBe(campaignName);
    });

    it('returns info popup with automation in payload', async () => {
        getRuntimeValue.mockReturnValue('Abyssal');

        const result = await handle(makeAction({ custom: 'val' }), makePlayerStats(), campaignName, null);

        expect(result.payload.automation).toEqual({ type: 'fiendish_legacy', custom: 'val' });
    });
});

// ─── confirmFiendishLegacy ───

describe('confirmFiendishLegacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when legacy not found', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Nonexistent', campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No legacy selected.');
    });

    it('returns info popup when legacy is empty string', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), '', campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No legacy selected.');
    });

    it('stores selected legacy', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacySelection',
            'Infernal',
            campaignName,
        );
    });

    it('stores spellcasting ability', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyAbility',
            'Charisma',
            campaignName,
        );
    });

    it('stores cantrip for Infernal (Fire Bolt)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyCantrip',
            'Fire Bolt',
            campaignName,
        );
    });

    it('stores cantrip for Abyssal (Poison Spray)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Abyssal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyCantrip',
            'Poison Spray',
            campaignName,
        );
    });

    it('stores cantrip for Chthonic (Chill Touch)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Chthonic', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyCantrip',
            'Chill Touch',
            campaignName,
        );
    });

    it('stores level 3 spell for Infernal (Hellish Rebuke)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel3',
            'Hellish Rebuke',
            campaignName,
        );
    });

    it('stores level 3 spell for Abyssal (Ray of Sickness)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Abyssal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel3',
            'Ray of Sickness',
            campaignName,
        );
    });

    it('stores level 3 spell for Chthonic (False Life)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Chthonic', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel3',
            'False Life',
            campaignName,
        );
    });

    it('stores level 5 spell for Infernal (Darkness)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel5',
            'Darkness',
            campaignName,
        );
    });

    it('stores level 5 spell for Abyssal (Hold Person)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Abyssal', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel5',
            'Hold Person',
            campaignName,
        );
    });

    it('stores level 5 spell for Chthonic (Ray of Enfeeblement)', async () => {
        await confirmFiendishLegacy(makePlayerStats(), 'Chthonic', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Warlock1',
            '_fiendishLegacyLevel5',
            'Ray of Enfeeblement',
            campaignName,
        );
    });

    it('returns popup with correct description for Infernal', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(result.payload.description).toContain('Selected Infernal legacy');
        expect(result.payload.description).toContain('Spellcasting ability: Charisma');
    });

    it('returns popup with correct description for Abyssal', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Abyssal', campaignName);

        expect(result.payload.description).toContain('Selected Abyssal legacy');
        expect(result.payload.description).toContain('Spellcasting ability: Charisma');
    });

    it('returns popup with correct description for Chthonic', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Chthonic', campaignName);

        expect(result.payload.description).toContain('Selected Chthonic legacy');
        expect(result.payload.description).toContain('Spellcasting ability: Charisma');
    });
});

// ─── getFiendishLegacySelection ───

describe('getFiendishLegacySelection', () => {
    it('returns stored legacy', () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = getFiendishLegacySelection(makePlayerStats(), campaignName);

        expect(result).toBe('Infernal');
    });

    it('returns null when no legacy stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacySelection(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── getFiendishLegacyAbility ───

describe('getFiendishLegacyAbility', () => {
    it('returns stored ability', () => {
        getRuntimeValue.mockReturnValue('Charisma');

        const result = getFiendishLegacyAbility(makePlayerStats(), campaignName);

        expect(result).toBe('Charisma');
    });

    it('returns null when no ability stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyAbility(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── getFiendishLegacyCantrip ───

describe('getFiendishLegacyCantrip', () => {
    it('returns stored cantrip', () => {
        getRuntimeValue.mockReturnValue('Fire Bolt');

        const result = getFiendishLegacyCantrip(makePlayerStats(), campaignName);

        expect(result).toBe('Fire Bolt');
    });

    it('returns null when no cantrip stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyCantrip(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── getFiendishLegacyLevel3Spell ───

describe('getFiendishLegacyLevel3Spell', () => {
    it('returns stored level 3 spell', () => {
        getRuntimeValue.mockReturnValue('Hellish Rebuke');

        const result = getFiendishLegacyLevel3Spell(makePlayerStats(), campaignName);

        expect(result).toBe('Hellish Rebuke');
    });

    it('returns null when no level 3 spell stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyLevel3Spell(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── getFiendishLegacyLevel5Spell ───

describe('getFiendishLegacyLevel5Spell', () => {
    it('returns stored level 5 spell', () => {
        getRuntimeValue.mockReturnValue('Darkness');

        const result = getFiendishLegacyLevel5Spell(makePlayerStats(), campaignName);

        expect(result).toBe('Darkness');
    });

    it('returns null when no level 5 spell stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyLevel5Spell(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── restoreUses ───

describe('restoreUses', () => {
    it('clears all legacy keys', () => {
        restoreUses('Warlock1', campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Warlock1', '_fiendishLegacySelection', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Warlock1', '_fiendishLegacyAbility', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Warlock1', '_fiendishLegacyCantrip', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Warlock1', '_fiendishLegacyLevel3', null, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Warlock1', '_fiendishLegacyLevel5', null, campaignName);
    });

    it('calls setRuntimeValue with all legacy keys set to null', () => {
        vi.clearAllMocks();
        restoreUses('Warlock1', campaignName);

        const calls = setRuntimeValue.mock.calls;
        expect(calls.length).toBe(5);
        const keys = calls.map((c) => c[1]);
        expect(keys).toContain('_fiendishLegacySelection');
        expect(keys).toContain('_fiendishLegacyAbility');
        expect(keys).toContain('_fiendishLegacyCantrip');
        expect(keys).toContain('_fiendishLegacyLevel3');
        expect(keys).toContain('_fiendishLegacyLevel5');
        calls.forEach((c) => {
            expect(c[2]).toBeNull();
        });
    });
});
