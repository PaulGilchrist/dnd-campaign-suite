// @maintained-by-ai
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';
import {
    WOLF, CROCODILE, EAGLE, RAT, GIANT_SPIDER, GHAST,
    diskMonster, assertDiskRows, SHARED_MONSTER_PINS,
    WALK_ONLY, WALK_OR_SWIM, WALK_SWIM_FLY,
    speedTextOf,
} from './PolymorphSelectionModal.test-utils.js';

// Features lane: customization props (title/actionLabel), allowAnyCreature /
// object_into_creature modes, excludeTypes, CR display, class-feature fallbacks,
// and the non-default limitation strings rendered in beast rows. Core flows
// (loading, search, selection, close, CLA-391 dep stability) and the
// filterBeastSpeeds unit contract live in PolymorphSelectionModal.test.jsx.
//
// Fixture note (ledger pass #150): the old mockMonsters here was a hand-copied,
// drifted twin of the core lane fixture (numeric speeds instead of the disk's
// "40 ft." strings). Per the pass #150 rec the rows now live in the SHARED
// fixture module PolymorphSelectionModal.test-utils.js (disk-derived with
// drift-throws) that BOTH lanes import; only this lane's distinctive
// ADULT_BLACK_DRAGON row and its pin stay local below.

// Lane-distinctive disk row (the shared six come from test-utils).
const ADULT_BLACK_DRAGON = diskMonster('Adult Black Dragon');

// Drift-throw: pin the exact disk bytes the assertions below depend on —
// shared rows via SHARED_MONSTER_PINS, lane-distinctive row here.
assertDiskRows(SHARED_MONSTER_PINS);
assertDiskRows({
    'adult black dragon': { speed: { walk: '40 ft.', fly: '80 ft.', swim: '40 ft.' }, challenge_rating: '14', type: 'Dragon' },
});

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

// findBeastItem/speedTextOf come from test-utils (shared with core lane).

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
