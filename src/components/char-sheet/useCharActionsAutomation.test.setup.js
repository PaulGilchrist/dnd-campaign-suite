// @improved-by-ai
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

function makeBaseGRV(activeBuffs, focusPoints) {
    return vi.fn((charKey, key, _cn) => {
        if (key === 'activeBuffs') return activeBuffs;
        if (key === 'focusPoints') return focusPoints;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
}

function pick(value, fallback) {
    return value || fallback;
}

export function createHooks(overrides = {}) {
    const {
        cannotAct = false,
        getRuntimeValue: customGRV,
        setRuntimeValue: customSRV,
        playerStats = basePlayerStats,
        campaignName: cn = campaignName,
        activeBuffs = [],
        focusPoints = 3,
        rollDamage: customRollDamage,
        rollAttack: customRollAttack,
        executeHandler: customExecuteHandler,
        addEntry: customAddEntry,
        setPopupHtml: customSetPopupHtml,
        setModalState: customSetModalState,
        onBuffsChange: customOnBuffsChange,
        modalState: customModalState,
        mapName: customMapName,
        characters: customCharacters,
    } = overrides;

    return {
        cannotAct,
        getRuntimeValue: pick(customGRV, makeBaseGRV(activeBuffs, focusPoints)),
        setRuntimeValue: pick(customSRV, vi.fn()),
        rollDamage: pick(customRollDamage, vi.fn()),
        rollAttack: pick(customRollAttack, vi.fn()),
        executeHandler: pick(customExecuteHandler, vi.fn()),
        addEntry: pick(customAddEntry, vi.fn().mockResolvedValue(undefined)),
        setPopupHtml: pick(customSetPopupHtml, vi.fn()),
        setModalState: pick(customSetModalState, vi.fn()),
        modalState: pick(customModalState, {}),
        playerStats,
        campaignName: cn,
        mapName: pick(customMapName, 'test-map'),
        characters: pick(customCharacters, []),
        onBuffsChange: pick(customOnBuffsChange, vi.fn()),
    };
}

export function setupBeforeEach() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}
