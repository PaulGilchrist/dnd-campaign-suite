// Visitor face of the LEVEL UP celebration's wizard handoff
// (bug-visitor-edit-wizard-unguarded-character-file-put): the banner's
// "Open wizard" button routes the edit-wizard entry whose save lane
// (PUT /<Name>.json) is refuseUnlessGm server-side. The banner stays a pure
// celebration on every screen (all clients), but the dead-end door — walk a
// visitor through the full wizard, 403 at the final save — is hidden from
// non-localhost origins exactly like the zero-char auto-offer, the sidebar
// Add Character door and the starter Build-heroes row
// (bug-zero-char-auto-wizard-traps-lan-visitor-creation-is-gm-only).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import LevelUpCelebration from './LevelUpCelebration.jsx';
import { playCue } from '../../services/ui/audioCues.js';
import { clearRuntimeState, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

function celebrate({ armed = true, onOpenWizard = vi.fn() } = {}) {
    render(
        <LevelUpCelebration
            campaignName={CAMPAIGN}
            characters={[alice()]}
            armed={armed}
            onOpenWizard={onOpenWizard}
        />,
    );
    // XP crossing on the award lane — the exact call every award performs.
    act(() => { setRuntimeValue('Alice', 'xp', 350, CAMPAIGN); });
    return onOpenWizard;
}

beforeEach(() => {
    clearRuntimeState('Alice');
    playCue.mockClear();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
});

afterEach(() => {
    Object.defineProperty(window, 'location', {
        value: ORIGINAL_LOCATION,
        writable: true,
        configurable: true,
    });
});

describe('LevelUpCelebration wizard door — origin faces', () => {
    it('GM origin (localhost): banner + working "Open wizard" handoff, GM prompt copy', () => {
        setHostname('localhost');
        const onOpenWizard = celebrate();

        const banner = screen.getByRole('status');
        expect(banner).toHaveTextContent('Open the wizard to choose your new features.');

        fireEvent.click(screen.getByText('Open wizard'));
        expect(onOpenWizard).toHaveBeenCalledTimes(1);
        expect(onOpenWizard.mock.calls[0][0]).toMatchObject({ name: 'Alice' });
    });

    it('visitor origin (LAN IP): banner still celebrates, NO wizard door, honest GM-hands-off copy', () => {
        setHostname('192.168.0.44');
        const onOpenWizard = celebrate();

        const banner = screen.getByRole('status');
        // The celebration itself is presentation for every client.
        expect(banner).toHaveTextContent('LEVEL UP!');
        expect(banner).toHaveTextContent('Alice');
        expect(banner).toHaveTextContent('Level 1 → 2');
        expect(banner).toHaveTextContent('The GM will open the wizard to choose the new features.');
        // The dead-end door (wizard → 403 at save) is gone.
        expect(screen.queryByText('Open wizard')).not.toBeInTheDocument();
        expect(onOpenWizard).not.toHaveBeenCalled();
    });
});
