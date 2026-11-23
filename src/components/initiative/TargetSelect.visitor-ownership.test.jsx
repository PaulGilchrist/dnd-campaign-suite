// @maintained-by-ai
// Lane: TargetSelect.jsx render gate (bug-visitor-arms-any-pc-target-cross-
// player-write). On a LAN (non-localhost) tab the target-arm <select> renders
// ONLY for (a) monster rows with a resolved controller (delegated execution,
// owner decision D2 — unchanged law) and (b) the PC row THIS device plays
// (localCharacterName — the sidebar-selection "mine" signal, Players.jsx
// isTokenOwnedHere precedent). Every other player's PC card renders the target
// as plain read-only text (the visitor HP plain-span face idiom) — the bug's
// exact repro face: 13 enabled selects on a visitor tab letting a bystander
// re-arm anyone's targetName. The GM sees the live select everywhere.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TargetSelect from './TargetSelect.jsx';

const PLAYER = { name: 'ElderPaladin', type: 'player', currentHp: 20 };
const OTHER_PLAYER = { name: 'FeyRanger', type: 'player', currentHp: 18 };
const MONSTER = { name: 'Goblin', type: 'npc', currentHp: 7 };
const ALL = [PLAYER, OTHER_PLAYER, MONSTER];

function renderSelect(props) {
    return render(
        <div className="initiative">
            <TargetSelect
                allCreatures={ALL}
                overlays={[]}
                onTargetChange={vi.fn()}
                {...props}
            />
        </div>
    );
}

describe('TargetSelect visitor PC-row ownership gate', () => {
    it('visitor tab, PC row this device does NOT play: NO select — plain read-only text shows the armed target', () => {
        renderSelect({
            creature: { ...PLAYER, targetName: 'FeyRanger' },
            isLocalhost: false,
            isPlayerSummoned: false,
            localCharacterName: 'FeyRanger',
        });
        expect(screen.queryByTestId('target-select')).toBeNull();
        const readonly = screen.getByTestId('target-readonly');
        expect(readonly.tagName).toBe('SPAN');
        expect(readonly.textContent).toBe('FeyRanger');
        expect(readonly.getAttribute('aria-label')).toBe('ElderPaladin target');
    });

    it('visitor tab, PC row this device DOES play (sidebar selection): live select, current target selected', () => {
        renderSelect({
            creature: { ...PLAYER, targetName: 'Goblin' },
            isLocalhost: false,
            isPlayerSummoned: false,
            localCharacterName: 'ElderPaladin',
        });
        const select = screen.getByTestId('target-select');
        expect(select.disabled).toBe(false);
        expect(select.value).toBe('Goblin');
        expect(screen.queryByTestId('target-readonly')).toBeNull();
    });

    it('visitor tab with NO sidebar selection: every PC row is read-only (nothing is owned here)', () => {
        renderSelect({ creature: PLAYER, isLocalhost: false, isPlayerSummoned: false, localCharacterName: undefined });
        expect(screen.queryByTestId('target-select')).toBeNull();
        expect(screen.getByTestId('target-readonly').textContent).toBe('—');
    });

    it('GM (localhost) tab keeps the live select on EVERY PC row', () => {
        renderSelect({ creature: PLAYER, isLocalhost: true, isPlayerSummoned: false, localCharacterName: 'FeyRanger' });
        expect(screen.getByTestId('target-select')).toBeTruthy();
        expect(screen.queryByTestId('target-readonly')).toBeNull();
    });

    it('unchanged monster law: uncontrolled monster row on a visitor tab renders NOTHING', () => {
        const { container } = renderSelect({
            creature: MONSTER, isLocalhost: false, isPlayerSummoned: false, localCharacterName: 'ElderPaladin',
        });
        expect(container.querySelector('.creature-target')).toBeNull();
    });

    it('unchanged monster law: controlled monster row keeps the visitor\'s live arm lane (delegation D2)', () => {
        renderSelect({
            creature: MONSTER, isLocalhost: false, isPlayerSummoned: true, localCharacterName: null,
        });
        expect(screen.getByTestId('target-select')).toBeTruthy();
    });
});
