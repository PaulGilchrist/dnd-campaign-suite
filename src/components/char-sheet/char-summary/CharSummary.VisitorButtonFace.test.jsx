// @maintained-by-ai 2026-11-26
// Regression for bug-visitor-edit-wizard-unguarded-character-file-put: the
// sheet header's authoring button group rendered `Edit "<Name>"` /
// `Delete "<Name>"` / Upload on EVERY client — a LAN visitor could open the
// full character wizard pre-filled with any character (and, pre-server-gate,
// save it through the unguarded PUT lane). CharSummary already computes
// `isLocalhost` (:518) for the HP/conditions lanes; the button group must
// consult it too, mirroring the sidebar CharacterList gate
// (bug-player-view-can-create-characters). Visitor face: NO Edit, NO Delete,
// NO Upload — Download stays (it exports the already-open read view; GET is
// open to all), and the rest buttons are runtime lanes, not authoring.
//
// Harness: same minimal mock block as CharSummary-DeleteConfirm.test.jsx
// (proven sufficient to mount CharSummary with no network/store), with
// window.location.hostname flipped per origin face.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

const ORIGINAL_LOCATION = window.location;

function setHostname(hostname) {
    Object.defineProperty(window, 'location', {
        value: { ...ORIGINAL_LOCATION, hostname },
        writable: true,
        configurable: true,
    });
}

function renderSummary() {
    const props = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        exhaustionLevel: 0,
        characters: [mockPlayerStats],
        onDeleteCharacter: vi.fn(),
        onEditCharacter: vi.fn(),
        onUploadClick: vi.fn(),
        onSaveClick: vi.fn(),
    };
    render(<CharSummary {...props} />);
    return props;
}

afterEach(() => {
    Object.defineProperty(window, 'location', {
        value: ORIGINAL_LOCATION,
        writable: true,
        configurable: true,
    });
});

describe('CharSummary header buttons — origin faces (bug-visitor-edit-wizard-unguarded-character-file-put)', () => {
    function expectGmAuthoringFace() {
        expect(screen.getByRole('button', { name: `Edit "${mockPlayerStats.name}"` })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `Delete "${mockPlayerStats.name}"` })).toBeInTheDocument();
        expect(screen.getByTitle('Upload Character')).toBeInTheDocument();
        expect(screen.getByTitle('Download Character')).toBeInTheDocument();
    }

    // Both loopback spellings must open the GM face: dropping either half of
    // the `localhost || 127.0.0.1` pair would lock the GM out of authoring.
    it.each(['localhost', '127.0.0.1'])('GM origin (%s): full authoring group renders (Edit/Delete/Upload + Download)', hostname => {
        setHostname(hostname);
        renderSummary();
        expectGmAuthoringFace();
    });

    it('visitor origin (LAN IP): NO Edit/Delete/Upload door; Download and the rest buttons stay', () => {
        setHostname('192.168.0.44');
        renderSummary();

        expect(screen.queryByRole('button', { name: `Edit "${mockPlayerStats.name}"` })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `Delete "${mockPlayerStats.name}"` })).not.toBeInTheDocument();
        expect(screen.queryByTitle('Upload Character')).not.toBeInTheDocument();
        // Read-side affordances stay for every client: exporting the
        // already-open read view is harmless (GET is open to all), and the
        // rest buttons ride the runtime store, not the authoring lanes.
        expect(screen.getByTitle('Download Character')).toBeInTheDocument();
        expect(screen.getByTestId('long-rest-btn')).toBeInTheDocument();
        expect(screen.getByTitle(/Short Rest/)).toBeInTheDocument();
    });
});
