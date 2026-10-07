# Bug FT-107 — Mounted Combatant (2024 feat): FAIL(b)

## Verdict
FAIL(b) — feat automation **consumers exist but zero mount-state affordance**: no UI anywhere produces the mount state the consumers read, so none of the three legs can ever trigger.

## Consumers (live, verified)
- `src/services/combat/conditions/conditionEffectsInternal.js:68-77` — `mountedAndTargetSmaller` reads `attackerCreature.isMounted`, `.mountSize`, `.rangeToTarget` ≤5ft → advantage (`mounted_and_target_one_size_smaller`, feats.json `Mounted Strike` automation `attack_rolls_vs_unmounted_near_mount`).
- `src/services/automation/handlers/reactions/reactionBonusHandler.js:511,581` — Leap Aside (`zero_on_success_half_on_fail_for_mount`) and Veer (`redirect_attack_to_self`) read runtime `getRuntimeValue(playerName, 'mountName')`.
- `src/hooks/combat/hitResolution.js:107-133` — `runVeerRedirect` reads `mountedBy` on target + `veerActive` on rider; logs redirect ledger rows.

## Missing producers (the bug)
No code writes `mountName`, `mountedBy`, `isMounted`, or `mountSize` outside tests:
- `rg 'mountedBy' src/ server/ --glob '!*.test.*'` → only the read at `hitResolution.js:107`.
- `rg 'mountName|isMounted|mountSize' src/ server/ --glob '!*.test.*'` → only the consumer reads above.
- No "Mount/Ride/Dismount" button in any component; CampaignAdmin (`src/components/campaign-admin/CampaignAdmin.jsx`) offers only **clear**-change-data, no key editor.

## Live evidence (test-campaign, header verified `test-campaign`)
1. EvasiveFighter lv18 2024 — feat granted via wizard step 8 (checkbox `list-item-checkbox-trigger`); sheet Reactions rows appeared: `Leap Aside:`, `Veer:`, Special Actions `Mounted Strike:`.
2. Click Leap Aside → popup: **"Leap Aside requires you to be mounted. No mount is currently active."**
3. Click Veer → popup: **"Veer requires you to be mounted. No mount is currently active."**
4. Feat-gate differential: before grant, Reactions section contained no Leap Aside/Veer rows (find `/Leap Aside|Veer|Mounted/` → no matches).
5. Only rider-adjacent affordance "Manage allies" writes `selectedAllies` (`CharSummary.jsx:610`) — NOT mount state. Pony (Medium, monsters.json) can be joined to encounters/initiative but nothing stamps `mountedBy`; no rider stamp exists anywhere.
6. Advantage differential untestable: no mount → `isMounted` never true → Mounted Strike consumer unreachable in play.

## Canonical comparison (exactness)
Consumer semantics match canonical quotes when driven in tests (advantage vs unmounted one-size-smaller within 5ft; mount 0-on-success/half-on-fail Dex-saves; reaction redirect hit-mount→hit-you), but all three legs are dead in the shipped app for lack of mount state.

## Fix recipe
Add a mount-state producer + affordance:
1. UI action "Mount" (e.g., character summary / initiative NPC context) selecting a Beast/NPC mount → `setRuntimeValue(rider,'mountName',mountName)` + `setRuntimeValue(mount,'mountedBy',riderName)`; companion Dismount clears both.
2. Feed `isMounted`/`mountSize`/`rangeToTarget` into the condition context used by `conditionEffectsInternal.mountedAndTargetSmaller` at attack time (combatSummary creature lookup + map range).
3. Ensure mounted Strike / Leap Aside / Veer reaction rows remain gated on `mountName` (already correct).

## Cleanup state
- Feat reverted: `EvasiveFighter.json` feats no longer include "Mounted Combatant" (GET/disk verified after debounce).
- Admin Full Reset executed; `GET /api/campaigns/test-campaign/log` → `[]`; no mount runtime keys on disk.
