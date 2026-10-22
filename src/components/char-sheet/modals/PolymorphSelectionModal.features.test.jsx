// @maintained-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';

// Features lane: customization props (title/actionLabel), allowAnyCreature /
// object_into_creature modes, excludeTypes, CR display, class-feature fallbacks,
// and the non-default limitation strings rendered in beast rows. Core flows
// (loading, search, selection, close, CLA-391 dep stability) and the
// filterBeastSpeeds unit contract live in PolymorphSelectionModal.test.jsx.
//
// Fixture note (ledger pass #150): the old mockMonsters here was a hand-copied,
// drifted twin of the core lane fixture (numeric speeds instead of the disk's
// "40 ft." strings). A shared fixture module was recommended but creating one
// is outside this file's edit scope, so the rows are now derived directly from
// REAL disk bytes via readFileSync with drift-throws — no hand copies left.

const diskMonsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

function diskMonster(name) {
    const found = diskMonsters.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`Fixture drift: '${name}' no longer exists in public/data/monsters.json`);
    return found;
}

const WOLF = diskMonster('Wolf');
const EAGLE = diskMonster('Eagle');
const RAT = diskMonster('Rat');
const CROCODILE = diskMonster('Crocodile');
const GIANT_SPIDER = diskMonster('Giant Spider');
const GHAST = diskMonster('Ghast');
const ADULT_BLACK_DRAGON = diskMonster('Adult Black Dragon');

// Drift-throw: pin exact disk bytes the assertions below depend on.
const EXPECTED_DISK_SPEEDS = {
    wolf: { speed: { walk: '40 ft.' }, challenge_rating: '0.25', type: 'Beast' },
    eagle: { speed: { walk: '10 ft.', fly: '60 ft.' }, challenge_rating: '0', type: 'beast' },
    rat: { speed: { walk: '20 ft.', fly: '', swim: '', climb: '20 ft.', burrow: '', other: [] }, challenge_rating: '0', type: 'Beast' },
    crocodile: { speed: { walk: '20 ft.', swim: '30 ft.' }, challenge_rating: '0.5', type: 'Beast' },
    'giant spider': { speed: { walk: '30 ft.', climb: '30 ft.' }, challenge_rating: '1', type: 'Beast' },
    ghast: { speed: { walk: '30 ft.' }, challenge_rating: '2', type: 'Undead' },
    'adult black dragon': { speed: { walk: '40 ft.', fly: '80 ft.', swim: '40 ft.' }, challenge_rating: '14', type: 'Dragon' },
};
for (const [name, expected] of Object.entries(EXPECTED_DISK_SPEEDS)) {
    const m = diskMonster(name);
    if (JSON.stringify(m.speed) !== JSON.stringify(expected.speed)
        || String(m.challenge_rating) !== expected.challenge_rating
        || m.type !== expected.type) {
        throw new Error(`Fixture drift: '${name}' disk row changed - ${JSON.stringify(m)} (expected speed ${JSON.stringify(expected.speed)}, cr ${expected.challenge_rating}, type ${expected.type})`);
    }
}

const mockMonsters = [WOLF, EAGLE, RAT, CROCODILE, GIANT_SPIDER, GHAST, ADULT_BLACK_DRAGON];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
}));

// The limitation prose these overrides fake is the authoritative contract from
// disk (classRules.js:124-128 / classRules2024.js:293): the clause before "only"
// enumerates ALLOWED modes, "(no ...)" enumerates FORBIDDEN ones. Drift-throw
// if the source strings ever change underneath this parser contract.
const classRulesSrc = readFileSync('src/services/character/classRules.js', 'utf8');
const classRules2024Src = readFileSync('src/services/character/classRules2024.js', 'utf8');
const WALK_ONLY = 'walk only (no swim or fly)';
const WALK_OR_SWIM = 'walk or swim only (no fly)';
const WALK_SWIM_FLY = 'walk, swim, or fly';
for (const [src, label] of [[classRulesSrc, 'classRules.js'], [classRules2024Src, 'classRules2024.js']]) {
    if (!src.includes(WALK_OR_SWIM) || !src.includes(WALK_SWIM_FLY)) {
        throw new Error(`Limitation contract drift: ${label} no longer emits '${WALK_OR_SWIM}' / '${WALK_SWIM_FLY}'`);
    }
}
if (!classRulesSrc.includes(WALK_ONLY)) {
    throw new Error(`Limitation contract drift: classRules.js no longer emits '${WALK_ONLY}'`);
}

let getClassFeaturesOverride = undefined;
const CLASS_FEATURES_DEFAULT = {
    wildShapeLimitations: WALK_ONLY,
    maxWildShapeChallengeRating: 1,
};

vi.mock('../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => getClassFeaturesOverride ?? CLASS_FEATURES_DEFAULT),
}));

const baseProps = {
    playerStats: { class: { name: 'Druid' }, level: 4, rules: '5e' },
    maxCR: 1,
    campaignName: 'test-campaign',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function findBeastItem(beastName) {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item')).find(item =>
        item.querySelector('.wild-shape-beast-name').textContent.includes(beastName)) || null;
}

function speedTextOf(beastName) {
    const item = findBeastItem(beastName);
    if (!item) throw new Error(`Beast row missing: ${beastName}`);
    const spans = item.querySelectorAll('.wild-shape-beast-stats span');
    return spans[spans.length - 1].textContent;
}

describe('PolymorphSelectionModal - Features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getClassFeaturesOverride = undefined;
    });

    it('renders custom title in the header and custom action label on the confirm button', async () => {
        render(<PolymorphSelectionModal {...makeProps({ title: 'Polymorph Selection', actionLabel: 'Transform' })} />);
        await waitFor(() => {
            expect(screen.getByText('Polymorph Selection')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Transform/ })).toBeInTheDocument();
        });
        // Default title/actionLabel ("Wild Shape") are exercised by every test
        // in the core lane (PolymorphSelectionModal.test.jsx).
    });

    it('allowAnyCreature mode lists non-beasts with creature-specific copy and no wild-shape panels', async () => {
        render(<PolymorphSelectionModal {...makeProps({ allowAnyCreature: true, maxCR: 3 })} />);
        await waitFor(() => {
            // Non-beast Ghast (CR 2) now passes the type filter; numeric maxCR
            // prop overrides the class-feature default of 1 (label shows CR 3).
            expect(screen.getByText('Ghast')).toBeInTheDocument();
            expect(screen.getByText('Choose a creature form (CR 3 or lower)')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Search creatures...')).toBeInTheDocument();
        });
        expect(screen.queryByText(/Movement:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Excluded Types:/)).not.toBeInTheDocument();
    });

    it('object_into_creature mode caps the list at CR 9 regardless of maxCR', async () => {
        render(<PolymorphSelectionModal {...makeProps({
            allowAnyCreature: true,
            maxCR: 1,
            mode: 'object_into_creature',
        })} />);
        await waitFor(() => {
            expect(screen.getByText('Choose a creature form (CR 9 or lower)')).toBeInTheDocument();
            // Ghast (CR 2) exceeds maxCR 1 but passes the CR 9 mode cap
            expect(screen.getByText('Ghast')).toBeInTheDocument();
            expect(screen.queryByText('Adult Black Dragon')).not.toBeInTheDocument();
        });
    });

    it('excludeTypes hides those creature types and lists them in an info panel', async () => {
        render(<PolymorphSelectionModal {...makeProps({
            allowAnyCreature: true,
            maxCR: 3,
            excludeTypes: ['Undead'],
        })} />);
        await waitFor(() => {
            expect(screen.getByText('Excluded Types:')).toBeInTheDocument();
            expect(screen.getByText('Excluded Types:').parentElement).toHaveTextContent('Undead');
            expect(screen.queryByText('Ghast')).not.toBeInTheDocument();
            expect(screen.getByText('Wolf')).toBeInTheDocument();
        });
    });

    it('formats fractional challenge ratings as decimals in beast rows', async () => {
        render(<PolymorphSelectionModal {...baseProps} />);
        await waitFor(() => {
            // Wolf (CR 0.25) is the only fractional CR in this fixture
            expect(screen.getAllByText('CR 0.25')).toHaveLength(1);
            // Rat and Eagle are both CR 0 on disk
            expect(screen.getAllByText('CR 0')).toHaveLength(2);
        });
    });

    it('falls back to class-feature max CR when maxCR prop is not a number', async () => {
        getClassFeaturesOverride = {
            wildShapeLimitations: WALK_ONLY,
            maxWildShapeChallengeRating: 0,
        };
        render(<PolymorphSelectionModal {...makeProps({ maxCR: null })} />);
        await waitFor(() => {
            expect(screen.getByText('Choose a beast form (CR 0 or lower)')).toBeInTheDocument();
            expect(screen.getByText('Rat')).toBeInTheDocument();
            expect(screen.queryByText('Wolf')).not.toBeInTheDocument();
        });
    });

    it('renders allowed speeds per limitation string (walk-or-swim hides fly/climb)', async () => {
        getClassFeaturesOverride = {
            wildShapeLimitations: WALK_OR_SWIM,
            maxWildShapeChallengeRating: 1,
        };
        render(<PolymorphSelectionModal {...makeProps({ maxCR: 1 })} />);
        await waitFor(() => expect(screen.getByText('Wolf')).toBeInTheDocument());

        // swim allowed on its own keyword; fly forbidden by the no-clause;
        // climb/burrow must not ride hasSwim (old defect, pass #150).
        expect(speedTextOf('Crocodile')).toBe('Walk 20 ft., Swim 30 ft.');
        expect(speedTextOf('Giant Spider')).toBe('Walk 30 ft.');
        expect(speedTextOf('Eagle')).toBe('Walk 10 ft.');
    });

    it('renders fly speeds when limitations allow it (walk, swim, or fly)', async () => {
        getClassFeaturesOverride = {
            wildShapeLimitations: WALK_SWIM_FLY,
            maxWildShapeChallengeRating: 1,
        };
        render(<PolymorphSelectionModal {...makeProps({ maxCR: 1 })} />);
        await waitFor(() => expect(screen.getByText('Eagle')).toBeInTheDocument());

        expect(speedTextOf('Eagle')).toBe('Walk 10 ft., Fly 60 ft.');
        expect(speedTextOf('Crocodile')).toBe('Walk 20 ft., Swim 30 ft.');
    });
});
