// @maintained-by-ai
// Lane: useAllyEditor (Phase 3.2 tracker ally editor). Owned here: GM-only open
// gate, roster creature list (self INCLUDED — self-only = "trusts no one", but
// synthetic secondTurn rows are never candidates), the CLA-360 (Second Turn)
// holder remap on open (writes + audit must name the holder, never the phantom
// bucket — bug-secondturn-allies-editor-phantom-bucket), confirm writes the
// SHARED selectedAllies key via setAllyList (the same key
// auras/Redirect/AoE read — one allegiance model, D4) + logs the audit row,
// cancel writes nothing, and the modalProps shape. Modal UI itself is owned by
// AllySelectionModal.test.jsx; button gating by Initiative.allyEditor.test.jsx.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAllyEditor } from './useAllyEditor.js';
import { setAllyList } from '../../hooks/useAllySelection.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn((name) => [name]),
    setAllyList: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => null) }));
// Real structural semantics (mirrors thiefsReflexesService.isSecondTurnEntry) —
// same stub pinned in Initiative.effectAdder-second-turn.test.jsx.
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn((creature) => !!creature?.secondTurn),
}));

const ROSTER = { creatures: [
    { name: 'Grim', type: 'player', currentHp: 20, maxHp: 20 },
    { name: 'Sera', type: 'player', currentHp: 15, maxHp: 15 },
    { name: 'Zombie', type: 'npc', currentHp: 9, maxHp: 15 },
    { name: 'Grim (Second Turn)', type: 'player', secondTurn: true, holderName: 'Grim', currentHp: 5, maxHp: 5 },
] };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCombatSummary).mockReturnValue(ROSTER);
});

describe('useAllyEditor', () => {
    it('LAN clients cannot open the editor (tracker authorship is GM-only)', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: false }));
        act(() => result.current.openAllyEditor({ name: 'Grim' }));
        expect(result.current.allyEditorOpen).toBe(false);
        expect(result.current.modalProps).toBeNull();
    });

    it('GM open lists the roster including self but excludes synthetic secondTurn rows', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({ name: 'Grim' }));
        expect(result.current.allyEditorOpen).toBe(true);
        expect(result.current.modalProps.creatures.map(c => c.name))
            .toEqual(['Grim', 'Sera', 'Zombie']);
        expect(result.current.modalProps.currentAllies).toEqual(['Grim']);
        expect(result.current.modalProps.title).toBe('Allies of Grim');
    });

    it('opening from a (Second Turn) row remaps the subject to the holder (CLA-360 law)', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({
            name: 'Grim (Second Turn)',
            type: 'player',
            secondTurn: true,
            holderName: 'Grim',
        }));
        // Header names the HOLDER and marks the twin-card provenance (FV 2026-11-09
        // backlog) — the write/audit subject below stays the holder alone.
        expect(result.current.modalProps.title).toBe('Allies of Grim (second turn)');
        expect(result.current.modalProps.currentAllies).toEqual(['Grim']);
        // and confirming lands on the HOLDER bucket, auditing the real character
        act(() => result.current.confirmAllyEditor(['Grim', 'Sera']));
        expect(setAllyList).toHaveBeenCalledWith('Grim', ['Grim', 'Sera'], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Grim',
            abilityName: 'Ally Selection',
            description: "Grim's allies set to: Grim, Sera",
        }));
    });

    it('a secondTurn row without holderName falls back to its own name (no crash)', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({ name: 'Ghost (Second Turn)', secondTurn: true }));
        expect(result.current.modalProps.title).toBe('Allies of Ghost (Second Turn)');
    });

    it('confirm writes the shared selectedAllies key and logs the audit row', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({ name: 'Grim' }));
        act(() => result.current.confirmAllyEditor(['Grim']));

        expect(setAllyList).toHaveBeenCalledWith('Grim', ['Grim'], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'Grim',
            abilityName: 'Ally Selection',
            description: "Grim's allies set to: Grim",
        }));
        expect(result.current.allyEditorOpen).toBe(false);
    });

    it('cancel is byte-inert (no write, no log)', () => {
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({ name: 'Zombie' }));
        act(() => result.current.closeAllyEditor());
        expect(setAllyList).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(result.current.allyEditorOpen).toBe(false);
    });

    it('no log-failure escape: addEntry rejection is swallowed with console.error', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(addEntry).mockRejectedValueOnce(new Error('network'));
        const { result } = renderHook(() => useAllyEditor({ campaignName: 'test-campaign', isLocalhost: true }));
        act(() => result.current.openAllyEditor({ name: 'Grim' }));
        await act(async () => { result.current.confirmAllyEditor(['Grim', 'Sera']); });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('ally-selection log failed'), expect.any(Error));
        spy.mockRestore();
    });
});
