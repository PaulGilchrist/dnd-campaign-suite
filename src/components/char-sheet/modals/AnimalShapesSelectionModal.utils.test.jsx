// LANE OWNERSHIP — AnimalShapesSelectionModal test trio
// - AnimalShapesSelectionModal.behavior.test.jsx (behavior lane): interaction lifecycle and
//   callback contract — loading/error states, Cancel/Close/Escape semantics, overlay click
//   inertness, Transform gating transitions and the exact onConfirm payload.
// - AnimalShapesSelectionModal.test.jsx (rendering lane): modal skeleton structure, creature
//   filtering rules (type / CR cap / size), per-target search filtering, selection badge text.
// - THIS FILE (presentation/utils lane): header title/icon customization including the
//   fa-paw/'Animal Shapes' default-prop fallback, exact per-beast presentation row
//   (CR fraction formatting, size, speed formatting with fixed walk→climb→swim→fly order,
//   "No actions" fallback), exact avatar src and image-error fallback, deterministic sort
//   order, and custom-CR instruction paragraph text (including the `maxCR || 4` display
//   fallback). No gating, callback, filtering-rule, or search contracts live here.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnimalShapesSelectionModal from './AnimalShapesSelectionModal.jsx';

// Deterministic bestiary stub. Sort renders Frog (CR 0) before Eagle/Panther/Wolf
// (CR 1/4) before Brown Bear/Crocodile/Giant Spider (CR 1); Ghast is Undead and never
// appears (filtering itself is owned by the rendering lane — its exact absence here is
// incidental to pinning the utils mock). Frog carries empty actions (pins the
// "No actions" fallback) and scrambled speed keys (pins formatSpeed's fixed key order).
const mockBeasts = [
    {
        index: 'wolf',
        name: 'Wolf',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1/4',
        speed: { walk: 40, climb: 20, swim: 20 },
        actions: [{ name: 'Bite' }, { name: 'Dash' }],
    },
    {
        index: 'spider',
        name: 'Giant Spider',
        type: 'Beast',
        size: 'Large',
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
        index: 'bear',
        name: 'Brown Bear',
        type: 'Beast',
        size: 'Large',
        challenge_rating: '1',
        speed: { walk: 40, climb: 20 },
        actions: [{ name: 'Bite' }, { name: 'Multiattack' }, { name: 'Dash' }],
    },
    {
        index: 'frog',
        name: 'Frog',
        type: 'Beast',
        size: 'Small',
        challenge_rating: '0',
        speed: { fly: 10, swim: 5, walk: 20 },
        actions: [],
    },
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockBeasts),
}));

const baseProps = {
    targets: ['Alric', 'Berenik'],
    maxCR: 4,
    campaignName: 'test-campaign',
    title: 'Animal Shapes',
    icon: 'fa-paw',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// Locate a target's section via its header's accessible text, so every query is
// scoped to one target rather than positional.
function sectionFor(targetName) {
    return screen.getByText(targetName).closest('.animal-shapes-target-section');
}

function beastItemFor(targetName, beastName) {
    const item = Array.from(sectionFor(targetName).querySelectorAll('.animal-shapes-beast-item'))
        .find(el => el.querySelector('.animal-shapes-beast-name')?.childNodes[0].textContent.trim() === beastName);
    if (!item) throw new Error(`No beast item "${beastName}" in section for ${targetName}`);
    return item;
}

function beastNamesInSection(targetName) {
    return Array.from(sectionFor(targetName).querySelectorAll('.animal-shapes-beast-name'))
        .map(el => el.childNodes[0].textContent.trim());
}

// Render and wait for the loaded footer — its accessible name confirms the
// presentation list (not the loading placeholder) is on screen.
async function renderLoaded(props) {
    const result = render(<AnimalShapesSelectionModal {...props} />);
    await screen.findByRole('button', { name: `Transform (0/${props.targets.length})` });
    return result;
}

describe('AnimalShapesSelectionModal - presentation utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('header title and icon', () => {
        it.each([
            { label: 'custom title and icon', title: 'Wild Shape Selection', icon: 'fa-dragon' },
            { label: 'default props fallback', title: undefined, icon: undefined },
        ])('%s — header-scoped icon with exact class list', async ({ title, icon }) => {
            const expectedTitle = title ?? 'Animal Shapes';
            const expectedIconClass = `fa-solid ${icon ?? 'fa-paw'}`;

            await renderLoaded(makeProps({ title, icon }));

            // The title text node is a direct child of the header div, so getByText
            // resolves to the header itself — scoping the icon assertion to the header.
            const header = screen.getByText(expectedTitle);
            expect(header.className).toBe('sp-header');

            const icons = header.querySelectorAll('i');
            expect(icons).toHaveLength(1);
            expect(icons[0].className).toBe(expectedIconClass);
        });
    });

    describe('sort order', () => {
        it('lists beasts CR-ascending then alphabetically, exactly', async () => {
            await renderLoaded(makeProps());

            expect(beastNamesInSection('Alric')).toEqual([
                'Frog',
                'Eagle', 'Panther', 'Wolf',
                'Brown Bear', 'Crocodile', 'Giant Spider',
            ]);
        });
    });

    describe('beast presentation rows', () => {
        it.each([
            {
                name: 'Wolf',
                crText: 'CR 0.25',
                speedText: 'Walk 40, Climb 20, Swim 20',
                actionsText: 'Bite, Dash',
            },
            {
                name: 'Eagle',
                crText: 'CR 0.25',
                speedText: 'Fly 50',
                actionsText: 'Beak, Talons',
            },
            {
                name: 'Brown Bear',
                crText: 'CR 1',
                speedText: 'Walk 40, Climb 20',
                actionsText: 'Bite, Multiattack, Dash',
            },
            {
                // Empty actions → "No actions" fallback; scrambled speed keys →
                // output must still follow walk→climb→swim→fly (no climb here).
                name: 'Frog',
                crText: 'CR 0',
                speedText: 'Walk 20, Swim 5, Fly 10',
                actionsText: 'No actions',
            },
        ])('formats $name row with exact CR, size, speed, and action text', async ({ name, crText, speedText, actionsText }) => {
            await renderLoaded(makeProps());

            const item = beastItemFor('Alric', name);
            expect(Array.from(item.classList)).toEqual(['animal-shapes-beast-item']);

            const beast = mockBeasts.find(b => b.name === name);
            expect(item.querySelector('.animal-shapes-beast-size').textContent).toBe(beast.size);
            expect(item.querySelector('.animal-shapes-beast-cr').textContent).toBe(crText);
            expect(item.querySelector('.animal-shapes-beast-stats').textContent).toBe(speedText);
            expect(item.querySelector('.animal-shapes-beast-actions').textContent).toBe(actionsText);
        });
    });

    describe('avatar image error fallback', () => {
        it('hides only the failed image and keeps its row intact; sibling images stay visible', async () => {
            await renderLoaded(makeProps());

            const wolfImg = within(beastItemFor('Alric', 'Wolf')).getByRole('img', { name: 'Wolf' });
            const bearImg = within(beastItemFor('Alric', 'Brown Bear')).getByRole('img', { name: 'Brown Bear' });

            expect(wolfImg.getAttribute('src')).toBe('https://paulgilchrist.github.io/dnd-tools/images/wolf.jpg');
            expect(wolfImg.style.display).toBe('');

            fireEvent.error(wolfImg);

            expect(wolfImg.style.display).toBe('none');
            expect(bearImg.style.display).toBe('');
            expect(beastItemFor('Alric', 'Wolf')).toBeInTheDocument();
        });
    });

    describe('instruction text', () => {
        it.each([
            { label: 'integer CR', maxCR: 2, text: 'Choose a beast form (CR 2 or lower, Large or smaller) for each target:' },
            { label: 'fractional CR', maxCR: 0.5, text: 'Choose a beast form (CR 0.5 or lower, Large or smaller) for each target:' },
            // maxCR omitted → the `maxCR || 4` display fallback renders CR 4.
            { label: 'missing CR falls back to 4', maxCR: undefined, text: 'Choose a beast form (CR 4 or lower, Large or smaller) for each target:' },
        ])('shows the exact instruction paragraph for $label', async ({ maxCR, text }) => {
            await renderLoaded(makeProps({ maxCR }));

            expect(screen.getByText(text)).toBeInTheDocument();
        });
    });
});
