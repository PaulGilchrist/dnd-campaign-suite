// Canonical button labels for the .sp-modal rider-chooser footer family
// (rendered through ChooserModalFooter). The 2026-11-07 QA backlog pinned
// these exact visible strings: rider choosers mix `Apply Effects` (Devious
// Strikes plural face) with `Apply Effect` (Charge/Shield Bash/Open Hand
// singular), the VT confirm is `Trip Secondary Target`, and the decline
// faces are `Cancel` vs the honest zero-spend `Skip (do not consume use)`.
// QA/explore automation matches these bytes live — never rename a value
// without re-blessing the browser probes and the label-set ledger in
// ChooserModalFooter.labels.test.jsx.
export const CHOOSER_FOOTER_LABELS = {
    applyEffect: 'Apply Effect',
    applyEffects: 'Apply Effects',
    tripSecondaryTarget: 'Trip Secondary Target',
    attackTarget: 'Attack Target',
    applyFear: 'Apply Fear',
    cancel: 'Cancel',
    skipNoConsumeUse: 'Skip (do not consume use)',
    // DG paid-cost latch: once Apply has dispatched (cost committed), Cancel
    // explains why the escape hatch is closed.
    paidCostCommittedTitle: 'Cost already committed — resolve the effect instead',
};
