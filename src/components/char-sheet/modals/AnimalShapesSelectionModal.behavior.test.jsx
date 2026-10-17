// LANE OWNERSHIP — AnimalShapesSelectionModal test trio
// - behavior.test.jsx (THIS FILE, behavior lane): interaction lifecycle and callback
//   contract — loading/error states, close semantics (Cancel / Close / Escape), overlay
//   click inertness, Transform gating transitions (select → switch → deselect), and the
//   exact onConfirm payload. Asserts disabled-until-selected and inertness on cancel.
// - AnimalShapesSelectionModal.test.jsx (rendering lane): modal structure, creature
//   filtering rules, search UI behaviour, selection badge display.
// - AnimalShapesSelectionModal.utils.test.jsx (presentation lane): custom title/icon,
//   speed formatting, image-error fallback, sort order, instruction text.
// Keep new interaction/contract tests here; keep pure display checks in the other two.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnimalShapesSelectionModal from './AnimalShapesSelectionModal.jsx';
import { loadMonsters } from '../../../services/ui/dataLoader.js';

// Deterministic bestiary stub: CR sorts Eagle/Panther/Wolf (1/4) before
// Brown Bear/Crocodile/Giant Spider (1); Ghast is Undead (filtered out).
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
];

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => mockBeasts),
}));

const crocodile = mockBeasts.find(b => b.index === 'crocodile');
const panther = mockBeasts.find(b => b.index === 'panther');
const brownBear = mockBeasts.find(b => b.index === 'bear');

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

// The Transform button's accessible name embeds the live selection count,
// so locating it by full name asserts count display and identity atomically.
function transformButton(label) {
    return screen.getByRole('button', { name: `Transform (${label})` });
}

async function findByTransformButton(label) {
    const btn = await screen.findByRole('button', { name: `Transform (${label})` });
    return btn;
}

function findBeastItemInSection(beastName, sectionIndex) {
    const section = document.querySelectorAll('.animal-shapes-target-section')[sectionIndex];
    if (!section) throw new Error(`No target section at index ${sectionIndex}`);
    const item = Array.from(section.querySelectorAll('.animal-shapes-beast-item')).find(el => {
        const nameEl = el.querySelector('.animal-shapes-beast-name');
        return nameEl && nameEl.childNodes[0].textContent.trim() === beastName;
    });
    if (!item) throw new Error(`No beast item "${beastName}" in section ${sectionIndex}`);
    return item;
}

// Render and wait until the loaded selection UI is up (Transform footer rendered).
async function renderLoaded(props) {
    const result = render(<AnimalShapesSelectionModal {...props} />);
    await findByTransformButton(`0/${props.targets.length}`);
    return result;
}

async function selectBeast(beastName, sectionIndex) {
    fireEvent.click(findBeastItemInSection(beastName, sectionIndex));
}

let consoleErrorSpy;

beforeEach(() => {
    vi.clearAllMocks();
    loadMonsters.mockImplementation(async () => mockBeasts);
    // Silence the component's intentional error-state console.error in error tests.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('AnimalShapesSelectionModal - behavior', () => {
    describe('lifecycle states', () => {
        it('blocks selection actions while loading, but Escape still cancels', async () => {
            // Forever-pending load: deterministic, no timers — we only assert the loading snapshot.
            loadMonsters.mockReturnValueOnce(new Promise(() => { }));
            render(<AnimalShapesSelectionModal {...baseProps} />);

            expect(await screen.findByText('Loading available creatures...')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Transform/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
            expect(baseProps.onConfirm).not.toHaveBeenCalled();
        });

        it('shows the error message with only a Close action, which cancels without confirming', async () => {
            loadMonsters.mockRejectedValueOnce(new Error('Network error'));
            const props = makeProps();
            render(<AnimalShapesSelectionModal {...props} />);

            expect(await screen.findByText('Failed to load creature data.')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Transform/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(props.onCancel).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });
    });

    describe('close interactions', () => {
        it.each([
            ['Cancel button click', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
            ['Escape key press', () => fireEvent.keyDown(document, { key: 'Escape' })],
        ])('%s cancels exactly once and never confirms', async (_name, trigger) => {
            const props = makeProps();
            await renderLoaded(props);

            trigger();

            expect(props.onCancel).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).not.toHaveBeenCalled();
        });

        it('is inert when clicking the overlay backdrop — neither callback fires', async () => {
            const props = makeProps();
            await renderLoaded(props);

            fireEvent.click(document.querySelector('.sp-overlay'));
            fireEvent.click(document.querySelector('.sp-modal'));

            expect(props.onCancel).not.toHaveBeenCalled();
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(screen.getByText('Animal Shapes')).toBeInTheDocument();
        });
    });

    describe('Transform gating', () => {
        it.each([
            { label: 'no targets', targets: [], selections: [], count: '0/0' },
            { label: 'one of two selected', targets: ['Alric', 'Berenik'], selections: [[0, 'Crocodile']], count: '1/2' },
            {
                label: 'two of three selected',
                targets: ['Alric', 'Berenik', 'Cedric'],
                selections: [[0, 'Crocodile'], [1, 'Panther']],
                count: '2/3',
            },
        ])('stays disabled and inert with partial selection — $label', async ({ targets, selections, count }) => {
            const props = makeProps({ targets });
            await renderLoaded(props);

            for (const [sectionIndex, beastName] of selections) {
                await selectBeast(beastName, sectionIndex);
            }

            const btn = await findByTransformButton(count);
            expect(btn).toBeDisabled();

            fireEvent.click(btn);
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(props.onCancel).not.toHaveBeenCalled();
        });

        it('transitions enabled state through select, switch, deselect and re-select', async () => {
            const props = makeProps();
            await renderLoaded(props);
            expect(transformButton('0/2')).toBeDisabled();

            await selectBeast('Crocodile', 0);
            expect(await findByTransformButton('1/2')).toBeDisabled();

            // Switching Alric's choice keeps the count at 1/2 and stays disabled.
            await selectBeast('Brown Bear', 0);
            expect(await findByTransformButton('1/2')).toBeDisabled();

            await selectBeast('Panther', 1);
            expect(await findByTransformButton('2/2')).toBeEnabled();

            // Deselect Alric's current choice (Brown Bear) — gates closed again.
            await selectBeast('Brown Bear', 0);
            expect(await findByTransformButton('1/2')).toBeDisabled();

            await selectBeast('Crocodile', 0);
            expect(await findByTransformButton('2/2')).toBeEnabled();
        });
    });

    describe('confirm payload contract', () => {
        it('confirms with the exact chosen beast payload per target, reflecting a mid-flow switch', async () => {
            const props = makeProps();
            await renderLoaded(props);

            await selectBeast('Crocodile', 0);
            await selectBeast('Panther', 1);
            // Alric switches form after both targets are selected.
            await selectBeast('Brown Bear', 0);

            const btn = transformButton('2/2');
            expect(btn).toBeEnabled();
            fireEvent.click(btn);

            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith({
                Alric: brownBear,
                Berenik: panther,
            });
            expect(props.onCancel).not.toHaveBeenCalled();
        });

        it('allows both targets to pick the same form and confirms both selections', async () => {
            const props = makeProps();
            await renderLoaded(props);

            await selectBeast('Crocodile', 0);
            await selectBeast('Crocodile', 1);

            fireEvent.click(transformButton('2/2'));

            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith({
                Alric: crocodile,
                Berenik: crocodile,
            });
            expect(props.onCancel).not.toHaveBeenCalled();
        });
    });
});
