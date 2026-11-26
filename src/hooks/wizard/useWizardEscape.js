import { useEffect } from 'react';

/**
 * F11 (visual audit 2026-11-25, Item 7): Escape closes the character wizard
 * through the SAME lane as the header × and footer Cancel — silent close on
 * an unmodified draft, the named keep-progress DISCARD toll mid-build
 * (shared useReloadGuard + DiscardDraftDialog — never a native dialog:
 * an unhandled window.confirm blocks every automated driver call and wedged
 * the Item 7 e2e session). Suppressed while a role="dialog" child is mounted
 * (the discard toll / ruleset-switch tiers own Escape themselves while open
 * — the toll's own Escape answers KEEP), mirroring the useModalDismiss
 * sibling-modal law. Hoisted out of CharacterCreationWizard (max-statements
 * budget, WizardStepRenderer precedent).
 */
export default function useWizardEscape(onRequestClose) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            // Event-based suppression (bug-wizard-discard-toll-escape-rearm-loop):
            // a keydown that ORIGINATED inside a role="dialog" belongs to that
            // dialog's own Escape lane (DeleteConfirmModal answers KEEP at the
            // #root React delegate). React 19 flushes that discrete-event update
            // synchronously WITHIN the root handler, so by the time this same
            // keydown bubbles to window the toll may already be UNMOUNTED — the
            // DOM census below then false-sees "no dialog" and re-arms a
            // byte-identical toll forever. closest() walks the detached
            // subtree's parent chain (attributes survive the unmount), so the
            // origin test still holds after the flush.
            if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
            if (document.querySelector('[role="dialog"]')) return;
            onRequestClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onRequestClose]);
}
