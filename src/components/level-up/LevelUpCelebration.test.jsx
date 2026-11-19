// Roadmap Item 8 — LEVEL UP celebration contract.
//
// Lanes driven with the REAL runtime-state module so the detection seam is
// the production one:
//  - writer client: setRuntimeValue(char, 'xp', …) — the exact call every award
//    lane (loot Award, auto-rewards, sheet XP modal) performs; it notifies the
//    local store synchronously;
//  - other clients: replaceRuntimeObject(char, bucket) — the exact API App's
//    `change-<campaign>-<char>` SSE echo adoption uses (two-client-style pin).
// The milestone grant lane is the roster `level` bump a `character-update-*`
// echo produces (App mirrors it into the roster prop we re-render with).
//
// Owns:
//  - XP crossing → banner with character name and honest "Level A → B" copy
//    (single + multi-level jump, both rulesets);
//  - one award leveling many characters → ONE banner naming all rows;
//  - merged consecutive crossings (from stays, to extends);
//  - XP lane gated on experience mode; milestone mode celebrates the wizard
//    level bump instead, and an experience-mode bump never double-fires;
//  - 20→21 honesty (past-max XP is silent);
//  - cold baseline / unarmed seed are never celebrated;
//  - click-to-open-wizard handoff (passes the roster character, removes the
//    row) and click-to-dismiss (× and Continue, no timers).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LevelUpCelebration from './LevelUpCelebration.jsx';
import {
    clearRuntimeState,
    replaceRuntimeObject,
    setRuntimeValue,
} from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const alice = (overrides) => ({
    name: 'Alice', level: 1, xp: 250, xpMode: 'experience', rules: '5e', ...overrides,
});
const bob = (overrides) => ({
    name: 'Bob', level: 1, xp: 250, xpMode: 'experience', rules: '2024', ...overrides,
});

function setup(characters, { armed = true, onOpenWizard = vi.fn() } = {}) {
    const view = render(
        <LevelUpCelebration
            campaignName={CAMPAIGN}
            characters={characters}
            armed={armed}
            onOpenWizard={onOpenWizard}
        />,
    );
    return { ...view, onOpenWizard };
}

beforeEach(() => {
    clearRuntimeState('Alice');
    clearRuntimeState('Bob');
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
});

describe('experience mode — XP crossings on the award lane', () => {
    it('shows the celebration when an award crosses a threshold (writing-client notify lane)', () => {
        setup([alice()]);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();

        act(() => { setRuntimeValue('Alice', 'xp', 350, CAMPAIGN); });

        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('LEVEL UP!');
        expect(banner).toHaveTextContent('Alice');
        expect(banner).toHaveTextContent('Level 1 → 2');
        expect(banner).toHaveTextContent('Open the wizard to choose your new features.');
    });

    it('shows the celebration on the SSE-echoed award (replace-runtime-object lane, two-client pin)', () => {
        setup([alice()]);

        // Exactly what App.handleChangeKeyEvent does with a
        // `change-<campaign>-Alice` full-bucket echo from ANOTHER client.
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });

        expect(screen.getByRole('status')).toHaveTextContent('Level 1 → 2');
    });

    it.each(['5e', '2024'])('crosses identically for ruleset %s', (rules) => {
        setup([alice({ rules })]);
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });
        expect(screen.getByRole('status')).toHaveTextContent('Level 1 → 2');
    });

    it('names a multi-level jump honestly ("Level 1 → 3")', () => {
        setup([alice()]);
        act(() => { replaceRuntimeObject('Alice', { xp: 950 }); });
        expect(screen.getByRole('status')).toHaveTextContent('Level 1 → 3');
    });

    it('one award leveling many characters shows ONE banner naming every character', () => {
        setup([alice(), bob()]);
        act(() => {
            replaceRuntimeObject('Alice', { xp: 350 });
            replaceRuntimeObject('Bob', { xp: 950 });
        });
        expect(screen.getAllByRole('status')).toHaveLength(1);
        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('Alice');
        expect(banner).toHaveTextContent('Level 1 → 2');
        expect(banner).toHaveTextContent('Bob');
        expect(banner).toHaveTextContent('Level 1 → 3');
    });

    it('merges consecutive crossings while un-dismissed (from stays, to extends)', () => {
        setup([alice()]);
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });
        act(() => { replaceRuntimeObject('Alice', { xp: 3000 }); });
        expect(screen.getAllByText('Level 1 → 4')).toHaveLength(1);
    });

    it('stays silent when the award does not cross a threshold', () => {
        setup([alice({ xp: 400 })]);
        act(() => { replaceRuntimeObject('Alice', { xp: 500 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('20 → 21 honesty: past-max XP never celebrates a level 21', () => {
        setup([alice({ level: 20, xp: 355000 })]);
        act(() => { replaceRuntimeObject('Alice', { xp: 400000 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('cold baseline (already-crossed XP at mount) never celebrates', () => {
        replaceRuntimeObject('Alice', { xp: 6500 });
        setup([alice()]);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('unarmed (seed window) movements only re-baseline — the change-data seed is not an award', () => {
        const { rerender } = setup([alice()], { armed: false });
        act(() => { replaceRuntimeObject('Alice', { xp: 3000 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        // Arming afterwards baselines the already-seeded value; nothing shows
        // until a NEW crossing lands.
        rerender(
            <LevelUpCelebration
                campaignName={CAMPAIGN}
                characters={[alice()]}
                armed
                onOpenWizard={vi.fn()}
            />,
        );
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('milestone mode — explicit level grant seam', () => {
    it('an XP award past a threshold never celebrates in milestone mode', () => {
        setup([alice({ xpMode: 'milestone' })]);
        act(() => { replaceRuntimeObject('Alice', { xp: 3000 }); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('celebrates the wizard level bump as it lands on the mirrored roster', () => {
        const { rerender } = setup([alice({ xpMode: 'milestone', level: 4 })]);
        // The `character-update-*` echo mirror (App) hands the watcher the
        // bumped roster entry:
        rerender(
            <LevelUpCelebration
                campaignName={CAMPAIGN}
                characters={[alice({ xpMode: 'milestone', level: 5 })]}
                armed
                onOpenWizard={vi.fn()}
            />,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Level 4 → 5');
    });

    it('an experience-mode wizard level bump after an XP crossing never double-fires', () => {
        const { rerender } = setup([alice()]);
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });
        rerender(
            <LevelUpCelebration
                campaignName={CAMPAIGN}
                characters={[alice({ level: 2 })]}
                armed
                onOpenWizard={vi.fn()}
            />,
        );
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getAllByText('Level 1 → 2')).toHaveLength(1);
    });
});

describe('dismissal and wizard handoff (click only — no timers)', () => {
    it('Open wizard hands off the roster character object and clears that row', () => {
        const characters = [alice(), bob()];
        const { onOpenWizard } = setup(characters);
        act(() => {
            replaceRuntimeObject('Alice', { xp: 350 });
            replaceRuntimeObject('Bob', { xp: 950 });
        });
        const openButtons = screen.getAllByText('Open wizard');
        expect(openButtons).toHaveLength(2);

        fireEvent.click(openButtons[0]);
        expect(onOpenWizard).toHaveBeenCalledTimes(1);
        expect(onOpenWizard).toHaveBeenCalledWith(characters[0]);
        expect(screen.queryByText('Open wizard')).toBeInTheDocument(); // Bob still pending
        expect(screen.getByRole('status')).toHaveTextContent('Bob');
    });

    it('the corner × dismisses the whole banner without opening anything', () => {
        const { onOpenWizard } = setup([alice()]);
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss level-up banner' }));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(onOpenWizard).not.toHaveBeenCalled();
    });

    it('Continue dismisses the whole banner without opening anything', () => {
        const { onOpenWizard } = setup([alice()]);
        act(() => { replaceRuntimeObject('Alice', { xp: 350 }); });
        fireEvent.click(screen.getByText('Continue'));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(onOpenWizard).not.toHaveBeenCalled();
    });
});
