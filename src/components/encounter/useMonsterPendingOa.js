/**
 * bug-monster-oa-resolution-auto-missed-by-melee-range-gate — the monster
 * stat-block card's pending-trigger OA lane (marker read → live gate →
 * stale eviction → single-press resolution). Extracted to its own hook so the
 * card component (already at the ESLint statement/complexity ceilings) stays
 * byte-neutral; all the marker math lives in
 * services/combat/pendingOpportunityAttacks.js.
 *
 * The resolve press routes through the card's own handleAttack with an
 * oaContext {mover, sceneCreatures, consumed} — the marker pins the explicit
 * target and proves trigger-time adjacency (no click-time auto-miss), and the
 * one-charge law holds because the trigger already spent the reaction
 * (opportunityTrigger.js) and the monster card lane carries no economy gate
 * to self-deny.
 */
import { useEffect, useRef } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
    clearPendingOa,
    findPendingOaFor,
    isPendingOaLive,
    findMeleeAttackRow,
} from '../../services/combat/pendingOpportunityAttacks.js';

export function useMonsterPendingOa({ campaignName, monsterName, monster, creatures, handleAttack }) {
  const pendingOaMap = useRuntimeValue('campaign', 'pendingOAs', campaignName);
  const pendingOa = findPendingOaFor(pendingOaMap, monsterName);
  const live = !!pendingOa && isPendingOaLive({ creatures }, pendingOa);
  const attackRow = live ? findMeleeAttackRow(monster?.actions) : null;
  const resolvedRef = useRef(null);

  useEffect(() => {
    // The mover left the encounter (away/dead/off-board) between the trigger
    // and this look — evict the stale marker (no refund: the reaction was
    // legitimately spent at the trigger).
    if (pendingOa && !live) clearPendingOa(campaignName, monsterName);
  }, [pendingOa, live, campaignName, monsterName]);

  // Dedicated OA resolution press (the affordance names the mover). The
  // promptId latch blocks a same-tab double-click from resolving the one
  // charged reaction twice while the consume POST/SSE echo lands; a press
  // refused by an upstream gate consumed nothing, so the latch releases and
  // the affordance stays honest.
  const resolve = async () => {
    if (!live || !pendingOa || !attackRow) return;
    if (resolvedRef.current === pendingOa.promptId) return;
    resolvedRef.current = pendingOa.promptId;
    const oaContext = { mover: pendingOa.mover, sceneCreatures: creatures, consumed: false };
    await handleAttack(attackRow.name, attackRow.attack_bonus, attackRow, oaContext);
    if (!oaContext.consumed) resolvedRef.current = null;
  };

  return {
    pendingOaMover: live ? pendingOa.mover : null,
    pendingOaHasMelee: !!attackRow,
    onResolveOpportunityAttack: resolve,
  };
}
