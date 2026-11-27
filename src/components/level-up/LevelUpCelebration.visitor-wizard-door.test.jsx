// @maintained-by-ai 2026-11-26
// Visitor face of the LEVEL UP celebration's wizard handoff
// (bug-visitor-edit-wizard-unguarded-character-file-put): the banner's
// "Open wizard" button routes the edit-wizard entry whose save lane
// (PUT /<Name>.json) is refuseUnlessGm server-side. The banner stays a pure
// celebration on every screen (all clients), but the dead-end door — walk a
// visitor through the full wizard, 403 at the final save — is hidden from
// non-localhost origins exactly like the sidebar Add Character door and the
// starter Build-heroes row
// (bug-zero-char-auto-wizard-traps-lan-visitor-creation-is-gm-only).
//
// Owns ONLY the origin seam: the door's show/hide and the prompt-copy split
// per hostname. The click-to-open handoff mechanics and the audio edge live
// in LevelUpCelebration.test.jsx (which runs at the default localhost URL) —
// do not re-pin them here.
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import LevelUpCelebration from './LevelUpCelebration.jsx';
import { clearRuntimeState, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Silence the cue lane: the appearance-edge census is owned by the sibling
// suite; here the banner is only a vehicle for the origin-facing copy.
vi.mock('../../services/ui/audioCues.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, playCue: vi.fn() };
});

const CAMPAIGN = 'test-campaign';
const ORIGINAL_LOCATION = window.location;

const alice = () => ({ name: 'Alice', level: 1, xp: 250, xpMode: 'experience', rules: '5e' });

function setHostname(hostname) {
    Object.defineProperty(window, 'location', {
        value: { ...ORIGINAL_LOCATION, hostname },
        writable: true,
        configurable: true,
    });
}

// Render under the given origin and drive the exact XP-crossing call every
// award performs, so the banner is up before assertions run.
function celebrate(hostname) {
    setHostname(hostname);
    render(
        <LevelUpCelebration
            campaignName={CAMPAIGN}
            characters={[alice()]}
            armed
            onOpenWizard={vi.fn()}
        />,
    );
    act(() => { setRuntimeValue('Alice', 'xp', 350, CAMPAIGN); });
}

beforeEach(() => {
    clearRuntimeState('Alice');
});

afterEach(() => {
    Object.defineProperty(window, 'location', {
        value: ORIGINAL_LOCATION,
        writable: true,
        configurable: true,
    });
});

describe('LevelUpCelebration wizard door — origin faces', () => {
    it('GM origin (localhost): wizard door present with the GM prompt copy', () => {
        celebrate('localhost');

        expect(screen.getByRole('status'))
            .toHaveTextContent('Open the wizard to choose your new features.');
        expect(screen.getByRole('button', { name: 'Open wizard' })).toBeInTheDocument();
    });

    it('visitor origin (LAN IP): banner still celebrates, NO wizard door, honest GM-hands-off copy', () => {
        celebrate('192.168.0.44');

        const banner = screen.getByRole('status');
        // The celebration itself is presentation for every client.
        expect(banner).toHaveTextContent('LEVEL UP!');
        expect(banner).toHaveTextContent('Alice');
        expect(banner).toHaveTextContent('Level 1 → 2');
        expect(banner).toHaveTextContent('The GM will open the wizard to choose the new features.');
        // The dead-end door (wizard → 403 at save) is gone.
        expect(screen.queryByRole('button', { name: 'Open wizard' })).not.toBeInTheDocument();
    });
});
