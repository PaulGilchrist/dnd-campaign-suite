import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PolymorphSelectionModal from './PolymorphSelectionModal.jsx';

// Mock dataLoader.loadMonsters to return controlled creature data
const mockMonsters = [
    {
        index: 'wolf',
        name: 'Wolf',
        type: 'Beast',
        size: 'Medium',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20, swim: 20 },
        actions: [{ name: 'Bite' }, { name: 'Dash' }],
    },
    {
        index: 'spider',
        name: 'Giant Spider',
        type: 'Beast',
        size: 'Medium',
        challenge_rating: '1',
        speed: { walk: 20, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Net' }],
    },
    {
        index: 'crocodile',
        name: 'Crocodile',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 20, swim: 10 },
        actions: [{ name: 'Bite' }, { name: 'Grapple' }, { name: 'Swallow' }],
    },
    {
        index: 'panther',
        name: 'Panther',
        type: 'Beast',
        size: 'Small',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20 },
        actions: [{ name: 'Bite' }],
    },
    {
        index: 'eagle',
        name: 'Eagle',
        type: 'Beast',
        size: 'Small',
        challenge_rating: '1/4',
        speed: { fly: 50 },
        actions: [{ name: 'Beak' }, { name: 'Talons' }],
    },
    {
        index: 'ghast',
        name: 'Ghast',
        type: 'Undead',
        size: 'Medium',
        challenge_rating: '2',
        speed: { walk: 40 },
        actions: [{ name: 'Claws' }],
    },
    {
        index: 'brown_bear',
        name: 'Brown Bear',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 40, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Multiattack' }, { name: 'Dash' }],
    },
    {
        index: 'rat',
        name: 'Rat',
        type: 'Beast',
        size: 'Tiny',
        challenge_rating: '0',
        speed: { walk: 20 },
        actions: [],
    },
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockMonsters),
}));

let getClassFeaturesOverride = undefined;
const CLASS_FEATURES_DEFAULT = {
    wildShapeLimitations: 'walk only (no swim or fly)',
    maxWildShapeChallengeRating: 1,
};

vi.mock('../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => {
        if (getClassFeaturesOverride !== undefined) {
            return getClassFeaturesOverride;
        }
        return CLASS_FEATURES_DEFAULT;
    }),
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

describe('PolymorphSelectionModal - Features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getClassFeaturesOverride = undefined;
    });

    describe('customization props', () => {
        it('renders custom title, action label, and defaults when not provided', async () => {
            render(<PolymorphSelectionModal {...makeProps({ title: 'Polymorph Selection', actionLabel: 'Transform' })} />);
            await waitFor(() => {
                expect(screen.getByText('Polymorph Selection')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Transform' })).toBeInTheDocument();
            });
        });

        it('renders default title when no custom title is provided', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getByText('Wild Shape')).toBeInTheDocument();
            });
        });
    });

    describe('allowAnyCreature mode', () => {
        it('includes non-beast creatures when allowAnyCreature is true', async () => {
            render(<PolymorphSelectionModal {...makeProps({ allowAnyCreature: true, maxCR: 3 })} />);
            await waitFor(() => {
                expect(screen.getByText('Ghast')).toBeInTheDocument();
            });
        });

        it('changes search placeholder and instruction text for allowAnyCreature mode', async () => {
            render(<PolymorphSelectionModal {...makeProps({ allowAnyCreature: true })} />);
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search creatures...')).toBeInTheDocument();
                expect(screen.getByText('Choose a creature form (CR 1 or lower)')).toBeInTheDocument();
            });
        });

        it('filters to CR 9 or lower and shows correct instruction in object_into_creature mode', async () => {
            render(<PolymorphSelectionModal {...makeProps({
                allowAnyCreature: true,
                mode: 'object_into_creature',
            })} />);
            await waitFor(() => {
                expect(screen.getByText('Choose a creature form (CR 9 or lower)')).toBeInTheDocument();
            });
            // Ghast has CR 2, which should pass the CR 9 filter
            expect(screen.getByText('Ghast')).toBeInTheDocument();
        });
    });

    describe('excludeTypes filtering', () => {
        it('excludes specified creature types', async () => {
            render(<PolymorphSelectionModal {...makeProps({
                excludeTypes: ['Beast'],
            })} />);
            await waitFor(() => {
                expect(screen.getByText(/No beasts match/)).toBeInTheDocument();
            });
        });

        it('does not show excluded types info when excludeTypes is empty', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.queryByText(/Excluded Types:/)).not.toBeInTheDocument();
            });
        });
    });

    describe('challenge rating display', () => {
        it('displays all CR formats correctly', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitFor(() => {
                const crTexts = document.querySelectorAll('.wild-shape-beast-cr');
                const crs = Array.from(crTexts).map(el => el.textContent.trim());
                expect(crs).toContain('CR 0');
                expect(crs).toContain('CR 0.25');
                expect(crs).toContain('CR 1');
            });
        });
    });

    describe('speed formatting', () => {
        it('renders climb speed when wild shape limitations allow it', async () => {
            getClassFeaturesOverride = {
                wildShapeLimitations: 'walk and swim',
                maxWildShapeChallengeRating: 1,
            };
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitFor(() => {
                const speedTexts = document.querySelectorAll('.wild-shape-beast-stats');
                const speeds = Array.from(speedTexts).map(el => el.textContent.trim());
                expect(speeds.some(s => s.includes('Climb 20'))).toBe(true);
            });
        });
    });

    describe('effectiveMaxCR resolution', () => {
        it('uses maxCR prop when it is a number', async () => {
            render(<PolymorphSelectionModal {...makeProps({ maxCR: 2 })} />);
            await waitFor(() => {
                expect(screen.getByText('Choose a beast form (CR 2 or lower)')).toBeInTheDocument();
            });
        });

        it('falls back to class feature maxWildShapeChallengeRating when maxCR is not a number', async () => {
            getClassFeaturesOverride = {
                wildShapeLimitations: 'walk only (no swim or fly)',
                maxWildShapeChallengeRating: 2,
            };

            render(<PolymorphSelectionModal {...makeProps({ maxCR: null })} />);
            await waitFor(() => {
                expect(screen.getByText('Choose a beast form (CR 2 or lower)')).toBeInTheDocument();
            });
        });

        it('filters by effectiveMaxCR from class features', async () => {
            getClassFeaturesOverride = {
                wildShapeLimitations: 'walk only (no swim or fly)',
                maxWildShapeChallengeRating: 0,
            };

            render(<PolymorphSelectionModal {...makeProps({ maxCR: null })} />);
            await waitFor(() => {
                expect(screen.getByText('Rat')).toBeInTheDocument();
                expect(screen.queryByText('Giant Spider')).not.toBeInTheDocument();
            });
        });
    });

    describe('beast detail rendering', () => {
        it('renders beast size in the stats line', async () => {
            render(<PolymorphSelectionModal {...baseProps} />);
            await waitFor(() => {
                expect(screen.getByText('Wolf')).toBeInTheDocument();
            });

            let wolfStats = null;
            for (const item of document.querySelectorAll('.wild-shape-beast-item')) {
                const nameEl = item.querySelector('.wild-shape-beast-name');
                if (nameEl && nameEl.textContent.includes('Wolf')) {
                    const statsEl = item.querySelector('.wild-shape-beast-stats');
                    wolfStats = statsEl ? statsEl.textContent.trim() : '';
                    break;
                }
            }
            expect(wolfStats).toContain('Medium');
        });
    });
});
