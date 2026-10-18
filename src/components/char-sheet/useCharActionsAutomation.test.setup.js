// @maintained-by-ai
// Shared hooks fixture for the useCharActionsAutomation lanes (#545-#550 family).
// Output must cover all 15 props the hook destructures (useCharActionsAutomation.js:259-275).
// Only the 5 override knobs grep-confirmed passed by sibling call sites are parameterized
// (playerStats, getRuntimeValue, setRuntimeValue, modalState, executeHandler);
// every other field is a fixed default. No actual tests live here.
import { vi, beforeEach } from 'vitest';

export const campaignName = 'test-campaign';

export const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    class: { class_levels: [{ level: 5, focus_points: 2 }] },
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Charisma', bonus: 0 },
    ],
    skills: [],
    feats: [],
    automation: { passives: [] },
};

// Default runtime-store seam: pins the keys the hook family reads via getRuntimeValue
// (focusPoints stays 3 — the runtime read, not the basePlayerStats sheet value).
function makeBaseGRV() {
    return vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return 3;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
}

export function createHooks(overrides = {}) {
    return {
        cannotAct: false,
        playerStats: overrides.playerStats || basePlayerStats,
        campaignName,
        mapName: 'test-map',
        characters: [],
        getRuntimeValue: overrides.getRuntimeValue || makeBaseGRV(),
        setRuntimeValue: overrides.setRuntimeValue || vi.fn(),
        setPopupHtml: vi.fn(),
        setModalState: vi.fn(),
        modalState: overrides.modalState || {},
        rollDamage: vi.fn(),
        rollAttack: vi.fn(),
        executeHandler: overrides.executeHandler || vi.fn(),
        addEntry: vi.fn().mockResolvedValue(undefined),
        onBuffsChange: vi.fn(),
    };
}

export function setupBeforeEach() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}
