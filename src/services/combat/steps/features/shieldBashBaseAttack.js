import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// FT-082 collateral: restore the stashed base weapon attack as campaign
// lastAttack after the Shield Bash save resolution clobbered it with a
// save record ({attackName:'Shield Bash', damageType:null}). Without this,
// Slasher Hamstring (slashing_damage_hit) falsely refuses on shield holders
// within the same turn. Clears the stash afterwards.
//
// Lives in a useRuntimeState-only leaf so the consumerless-save resolution
// seam (automation/common/savePrompt.js) can run it store-side without
// pulling the shieldBash rider step's pipeline graph into its import chain.
// The restore is SELF-GUARDED: no stash (or a Shield Bash-shaped stash)
// writes nothing, so it is a byte-inert no-op for every non-Shield-Bash save.
export async function restoreBaseAttackAfterBash(playerStats, campaignName) {
  const stash = getRuntimeValue(playerStats.name, '_shieldBashBaseAttack', campaignName);
  // A valid stash is the base attack object; ignore null/arrays/empty.
  if (!stash || typeof stash !== 'object' || Array.isArray(stash) || !stash.attackName) return;
  if (stash.attackName !== 'Shield Bash') {
    await setRuntimeValue('campaign', 'lastAttack', stash, campaignName);
  }
  await setRuntimeValue(playerStats.name, '_shieldBashBaseAttack', null, campaignName);
}
