// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import PolymorphSelectionModal, { filterBeastSpeeds } from './PolymorphSelectionModal.jsx';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import {
    WOLF, CROCODILE, EAGLE, RAT, GIANT_SPIDER, GHAST,
    diskMonster, assertDiskRows, SHARED_MONSTER_PINS,
    WALK_ONLY, WALK_OR_SWIM, WALK_SWIM_FLY,
    findBeastItem, speedTextOf,
} from './PolymorphSelectionModal.test-utils.js';

// Core lane: loading, list filtering/sorting, search, selection, confirm/cancel,
// CLA-391 load-effect dep stability, and the filterBeastSpeeds limitation contract.
// Customization props (title/actionLabel), allowAnyCreature / object_into_creature
// modes and CR display live in PolymorphSelectionModal.features.test.jsx.
//
// Fixtures are shared with the features lane via PolymorphSelectionModal.test-utils.js
// (extraction per ledger pass #150 rec: mockMonsters copy-pasted and drifted):
// REAL disk rows (public/data/monsters.json and the druid rows of
// public/data/classes.json) with drift-throws — the previous hand-copied
// mockMonsters had drifted speeds (numbers instead of the disk's "40 ft."
// strings) per the bug ledger. Lane-distinctive rows (Panther/Brown Bear/
// Badger) and their pins stay local below. classFeatures is NOT mocked here:
// real getClassFeatures on disk-derived druid levels yields the authoritative
// limitation strings (classRules.js:124-128; same vocabulary in
// classRules2024.js:293). The strings are prose where the clause before "only"
// enumerates ALLOWED modes and "(no ...)" enumerates FORBIDDEN ones —
// 'walk only (no swim or fly)' must NOT surface swim/climb/burrow
// (the old limitations.includes('fly'/'swim') gate did, pass #150).

// Lane-distinctive disk rows (the shared six come from test-utils).
const PANTHER = diskMonster('Panther');
const BROWN_BEAR = diskMonster('Brown Bear');
const BADGER = diskMonster('Badger');

// Drift-throw: pin the exact disk bytes the assertions below depend on —
// shared rows via SHARED_MONSTER_PINS, lane-distinctive rows here.
assertDiskRows(SHARED_MONSTER_PINS);
assertDiskRows({
    panther: { speed: { walk: '50 ft.', fly: '', swim: '', climb: '40 ft.', burrow: '', other: [] }, challenge_rating: '0.25', type: 'Beast' },
    'brown bear': { speed: { walk: '40 ft.', climb: '30 ft.' }, challenge_rating: '1', type: 'Beast' },
    badger: { speed: { walk: '20 ft.', burrow: '5 ft.' }, challenge_rating: '0', type: 'Beast' },
});

const mockMonsters = [WOLF, PANTHER, CROCODILE, EAGLE, RAT, GIANT_SPIDER, BROWN_BEAR, BADGER, GHAST];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
}));

// Authoritative limitation contract, derived from REAL disk rows through the real
// rules engine, with drift-throws if the prose grammar ever changes.
const diskDruid = (JSON.parse(readFileSync('public/data/classes.json', 'utf8')).results
    || JSON.parse(readFileSync('public/data/classes.json', 'utf8'))).find(c => c.index === 'druid');
if (!diskDruid) throw new Error('Fixture drift: druid class no longer exists in public/data/classes.json');

function diskLimitationsAt(level) {
    return getClassFeatures({ rules: '5e', level, class: { name: 'Druid', class_levels: diskDruid.class_levels } })?.wildShapeLimitations;
}

// Drift-throw pinning of the imported limitation vocabulary: the real engine
// must still emit exactly the shared literals at these druid levels.
for (const [actual, expected] of [
    [diskLimitationsAt(2), WALK_ONLY],
    [diskLimitationsAt(4), WALK_OR_SWIM],
    [diskLimitationsAt(8), WALK_SWIM_FLY],
]) {
    if (actual !== expected) {
        throw new Error(`Limitation contract drift: expected '${expected}' from disk druid levels, got '${actual}' - re-verify classRules.js getDruidFeatures prose against the filterBeastSpeeds parser`);
    }
}

const baseProps = {
    playerStats: { rules: '5e', level: 2, class: { name: 'Druid', class_levels: diskDruid.class_levels } },
    maxCR: 1,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

// Mirrors the wild_shape_select caller (CharSheet.modals.jsx) which omits
// excludeTypes and maxCR — the fresh `[]` default in the effect deps used to
// refire loadBeasts every render (infinite loop, tab crash, CLA-391).
const druidStats2024 = {
    rules: '2024',
    level: 20,
    class: { name: 'Druid', class_levels: [{ level: 20, beast_max_cr: 1, wild_shape: 4 }] },
};

function getBeastItems() {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item'));
}

function beastNameOf(item) {
    const clone = item.querySelector('.wild-shape-beast-name').cloneNode(true);
    clone.querySelector('.wild-shape-beast-cr')?.remove();
    return clone.textContent.replace(/\s+/g, ' ').trim();
}

function getBeastNames() {
    return getBeastItems().map(beastNameOf);
}

// findBeastItem/speedTextOf come from test-utils (shared with features lane).

function getSelectedItemNames() {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item.selected')).map(beastNameOf);
}

function waitForBeastsLoaded() {
    return waitFor(() => {
        expect(document.querySelectorAll('.wild-shape-beast-item').length).toBeGreaterThan(0);
    });
}

describe('filterBeastSpeeds (limitation polarity)', () => {
    it('under walk-only limits keeps walk and excludes swim/climb/fly/burrow (exact)', () => {
        // Wolf regression: disk Wolf is walk-only, so its row is the
        // permitted-speeds-retained case; Crocodile/Panther/Eagle/Badger carry
        // the exclusions (the old gate surfaced Wolf's Swim 20 only because the
        // drifted hand-written fixture gave it a fabricated swim speed).
        expect(filterBeastSpeeds(WOLF.speed, WALK_ONLY)).toEqual({ walk: '40 ft.' });
        expect(filterBeastSpeeds(CROCODILE.speed, WALK_ONLY)).toEqual({ walk: '20 ft.' });
        expect(filterBeastSpeeds(PANTHER.speed, WALK_ONLY)).toEqual({ walk: '50 ft.' });
        expect(filterBeastSpeeds(EAGLE.speed, WALK_ONLY)).toEqual({ walk: '10 ft.' });
        expect(filterBeastSpeeds(BADGER.speed, WALK_ONLY)).toEqual({ walk: '20 ft.' });
    });

    it('under walk-or-swim-only limits swim is allowed and climb/fly/burrow excluded (exact)', () => {
        // Positive-polarity carrier (kills an inverted-polarity mutant) and the
        // own-keyword gate: climb/burrow used to ride hasSwim, so Giant Spider
        // showed Climb and Badger showed Burrow under "walk or swim only".
        expect(filterBeastSpeeds(CROCODILE.speed, WALK_OR_SWIM)).toEqual({ walk: '20 ft.', swim: '30 ft.' });
        expect(filterBeastSpeeds(GIANT_SPIDER.speed, WALK_OR_SWIM)).toEqual({ walk: '30 ft.' });
        expect(filterBeastSpeeds(BADGER.speed, WALK_OR_SWIM)).toEqual({ walk: '20 ft.' });
        expect(filterBeastSpeeds(EAGLE.speed, WALK_OR_SWIM)).toEqual({ walk: '10 ft.' });
    });

    it('under walk-swim-or-fly all enumerated and unnamed extra modes are allowed (exact)', () => {
        // Post-Fly-talent prose has no "only"/"no" clause: the beast keeps every
        // real (non-empty) speed it has, including climb; empty-string modes
        // from disk stay filtered out.
        expect(filterBeastSpeeds(EAGLE.speed, WALK_SWIM_FLY)).toEqual({ walk: '10 ft.', fly: '60 ft.' });
        expect(filterBeastSpeeds(CROCODILE.speed, WALK_SWIM_FLY)).toEqual({ walk: '20 ft.', swim: '30 ft.' });
        expect(filterBeastSpeeds(PANTHER.speed, WALK_SWIM_FLY)).toEqual({ walk: '50 ft.', climb: '40 ft.' });
    });

    it('returns {} without speeds and the full speeds without limitations', () => {
        expect(filterBeastSpeeds(undefined, WALK_ONLY)).toEqual({});
        expect(filterBeastSpeeds(CROCODILE.speed, null)).toEqual(CROCODILE.speed);
    });
});

describe('PolymorphSelectionModal (core)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading message and no list while creature data is in flight', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        loadMonsters.mockImplementationOnce(() => new Promise(() => { /* never resolves */ }));

        render(<PolymorphSelectionModal {...baseProps} />);

        expect(screen.getByText('Loading available creatures...')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search beasts...')).not.toBeInTheDocument();
    });

    it('lists exactly the CR<=1 beasts, sorted by CR then name, with wild shape copy', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        expect(screen.getByText('Choose a beast form (CR 1 or lower)')).toBeInTheDocument();
        // Type filter (no Ghast), CR filter and no-walk filter in one exact-list
        // assertion, plus CR-then-name sort order. Every disk beast has a walk
        // speed, so Eagle (CR 0) and Badger (CR 0) legitimately remain listed —
        // with their forbidden extra modes hidden (see speed regression below).
        expect(getBeastNames()).toEqual([
            'Badger', 'Eagle', 'Rat', 'Panther', 'Wolf', 'Crocodile', 'Brown Bear', 'Giant Spider',
        ]);

        const movement = Array.from(document.querySelectorAll('.wild-shape-info'))
            .find(d => d.textContent.startsWith('Movement:'));
        expect(movement).toHaveTextContent('walk only');
    });

    it('renders only walk speeds on every row under walk-only limitations', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        // Exact rendered speed lists: no swim/climb/fly/burrow may surface under
        // 'walk only (no swim or fly)' (pass #150 polarity defect).
        expect(speedTextOf('Wolf')).toBe('Walk 40 ft.');
        expect(speedTextOf('Crocodile')).toBe('Walk 20 ft.');
        expect(speedTextOf('Panther')).toBe('Walk 50 ft.');
        expect(speedTextOf('Eagle')).toBe('Walk 10 ft.');
        expect(speedTextOf('Badger')).toBe('Walk 20 ft.');
        expect(speedTextOf('Giant Spider')).toBe('Walk 30 ft.');
        expect(speedTextOf('Brown Bear')).toBe('Walk 40 ft.');
        for (const span of Array.from(document.querySelectorAll('.wild-shape-beast-stats span'))) {
            expect(span.textContent).not.toMatch(/Swim|Climb|Fly|Burrow/);
        }
    });

    it('honors the maxCR prop when listing beasts', async () => {
        render(<PolymorphSelectionModal {...baseProps} maxCR={0} />);
        await waitForBeastsLoaded();

        expect(screen.getByText('Choose a beast form (CR 0 or lower)')).toBeInTheDocument();
        expect(getBeastNames()).toEqual(['Badger', 'Eagle', 'Rat']);
    });

    it('search filters by name case-insensitively, shows no-results copy, and restores on clear', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        const input = screen.getByPlaceholderText('Search beasts...');

        fireEvent.change(input, { target: { value: 'cro' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual(['Crocodile']);
        });

        fireEvent.change(input, { target: { value: 'WOLF' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual(['Wolf']);
        });

        fireEvent.change(input, { target: { value: 'xyznonexistent' } });
        await waitFor(() => {
            expect(screen.getByText(/No beasts match/)).toBeInTheDocument();
            expect(document.querySelectorAll('.wild-shape-beast-item')).toHaveLength(0);
        });

        fireEvent.change(input, { target: { value: '' } });
        await waitFor(() => {
            expect(getBeastNames()).toEqual([
                'Badger', 'Eagle', 'Rat', 'Panther', 'Wolf', 'Crocodile', 'Brown Bear', 'Giant Spider',
            ]);
        });
    });

    it('single-selects a beast (switchable), and confirms once with the chosen beast', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        const confirmBtn = screen.getByRole('button', { name: 'Wild Shape' });
        expect(confirmBtn).toBeDisabled();

        fireEvent.click(findBeastItem('Wolf'));
        await waitFor(() => expect(confirmBtn).toBeEnabled());
        expect(getSelectedItemNames()).toEqual(['Wolf']);

        // Selection switches and stays single
        fireEvent.click(findBeastItem('Brown Bear'));
        await waitFor(() => expect(getSelectedItemNames()).toEqual(['Brown Bear']));

        fireEvent.click(findBeastItem('Wolf'));
        fireEvent.click(confirmBtn);

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm.mock.calls[0][0]).toMatchObject({ index: 'wolf', name: 'Wolf' });
    });

    it('calls onCancel from the Cancel button and the Escape key', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitForBeastsLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(baseProps.onCancel).toHaveBeenCalledTimes(2);
    });

    it('loads monsters exactly once when maxCR and excludeTypes are omitted, even across rerenders (CLA-391)', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        const renderModal = () => (
            <PolymorphSelectionModal
                playerStats={druidStats2024}
                campaignName="test-campaign"
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const { rerender } = render(renderModal());
        await waitForBeastsLoaded();
        rerender(renderModal());
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(loadMonsters).toHaveBeenCalledTimes(1);
    });

    it('keeps the load effect stable when given an inline excludeTypes array by value (CLA-391)', async () => {
        const { loadMonsters } = await import('../../../services/ui/dataLoader.js');
        const renderModal = () => (
            <PolymorphSelectionModal
                playerStats={druidStats2024}
                maxCR={1}
                campaignName="test-campaign"
                excludeTypes={['undead']}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const { rerender } = render(renderModal());
        await waitForBeastsLoaded();
        rerender(renderModal());
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(loadMonsters).toHaveBeenCalledTimes(1);
    });
});
