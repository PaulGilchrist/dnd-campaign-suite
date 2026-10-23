// Re-export barrel: LIVE only via blockChecks.js:35 dynamic import of
// getActiveBuffs (fix#294 taxonomy: internally live => demote, not delete).
//
// CONSOLIDATED (owner blanket approval of census #1499/#1500/#1501; resolves
// the fix#128 "PENDING OWNER DECISION #1460" dead-module marker 2026-10-23):
// Deleted this pass — ZERO production importers, live twin superior in every
// divergence (nothing rescued; byte-diff table in the flush record):
//   - resolveSpellResolution (was :160-220) + its private helper face
//     checkBlockedByBuff / resolveAmbushFlags / checkSilenceBlocked /
//     applyPsychicComponents / resolveEffectiveDamageType / resolveSaveDc /
//     resolveCastingMod / resolveCantripLevel / resolveSpellStats
//     (was :25-158). Live host is executeSpellCast inline resolution at
//     execution/index.js:801-833. The dead copy had REGRESSED on every
//     live fix: no CLA-404 Beast Spells bypass (live blockChecks.js:34),
//     no Antimagic Field check (live index.js:793), no fix#126 ambush
//     self-catch degrade (live resolveMagicalAmbushOrDegrade :160-167/:811),
//     pre-CLA-268 always-swap psychic damage (live gate
//     computePsychicDamageType :45-51; ledger run2#1460 flagged the dead
//     lane as a rewiring hazard), and the :205-207 '__placeholder__'
//     runtime no-op junk (#1460).
//   - logGenericSpellCast (was :222-247): dead twin of LIVE
//     execution/index.js:261 (called :834). Live carries the SP-079
//     _deferChooserSlotPayment guard (:266) and SP-103 _shapechangeFormChange
//     guard (:269) the dead copy lacked — divergence direction was
//     dead-stale, so deletion, not rescue (#227 check run, reversed: live
//     is the better copy). Display-level bytes already converged at fix#128
//     (#1501): dead resolveCantripLevel displayLevel === live :275
//     `spell.level || 0`.
//   - isInnateSorceryActive re-export (was :249): dead re-export, zero
//     consumers read it through this barrel (census plan:1290).
// Coordinated lane retirement (fix#82 precedent): spellResolution.test.js,
// spellResolution.complex.test.js and spellResolution-log.test.js were
// deleted in the same pass — their SUT faces no longer exist. Live log-lane
// semantics stay pinned by the execution/index.js test family (batch #214).
import { getActiveBuffs } from '../../../../combat/buffs/buffService.js';

export { getActiveBuffs };
