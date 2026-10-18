// @maintained-by-ai
// ZealousPresenceModal is a thin props adapter over shared/CreatureSelectionModal.jsx with no
// logic of its own. This file pins ONLY that seam: the exact props forwarded to the shared
// modal — the hardcoded Zealous Presence copy (title/icon/description/confirm vs source) and
// verbatim pass-through of targets, maxTargets, and callbacks (identity-pinned). Fixtures
// mirror the real producer shape (zealousPresenceHandler.js: creatureTargets [{ name }] +
// maxTargets auto.targets || 10), so prop omission (e.g. a dropped maxTargets) fails loudly.
// Selection, maxTargets gating, disabled-inertness, and confirm/skip mechanics are covered by
// shared/CreatureSelectionModal.test.jsx; buff internals/duration/logging by
// zealousPresenceHandler.test.js; host routing by CharActionModals.target-selection-handlers
// .test.jsx (which mocks this modal and never renders it).
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ZealousPresenceModal from './ZealousPresenceModal.jsx';

// Capture (not assert on) the mocked shared modal's props — capturedProps is the pin.
let capturedProps = null;

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: (props) => {
        capturedProps = props;
        return null;
    },
}));

function makeProps() {
    return {
        targets: [{ name: 'Ally1' }, { name: 'Ally2' }, { name: 'Ally3' }],
        maxTargets: 10,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
    };
}

describe('ZealousPresenceModal', () => {
    let props;

    beforeEach(() => {
        capturedProps = null;
        props = makeProps();
    });

    it('forwards the exact Zealous Presence configuration to CreatureSelectionModal', () => {
        render(<ZealousPresenceModal {...props} />);

        expect(capturedProps).toEqual({
            title: 'Zealous Presence',
            icon: 'fa-bullseye',
            targets: props.targets,
            maxTargets: 10,
            description: 'Choose creatures to grant Advantage on attack rolls and saving throws until the start of your next turn.',
            confirmLabel: 'Grant Advantage',
            confirmIcon: 'fa-bullseye',
            onConfirm: props.onConfirm,
            onSkip: props.onSkip,
        });
    });
});
