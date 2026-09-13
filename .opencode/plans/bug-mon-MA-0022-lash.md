# Bug MA-0022 — Aboleth "Lash" legendary action is inert (MV-17 family)

**Verdict: FAIL**

Row: monster "Aboleth" · "Lash" · category `legendary_actions` · actionType `other` · "The aboleth makes one Tentacle attack."

## Evidence (E2E, Testing G2, localhost:5173, 2026-09-13)
1. **Zero affordance**: Lash JSON in `public/data/monsters.json` has no `attack_bonus`, `save_dc`, or `damage_dice_primary`. `MonsterAction.jsx:53-69` only renders dice links when those fields exist → row renders as inert `.mc-action` div. Live DOM: `2 children (<strong>Lash.</strong> + plain span), 0 buttons, 0 .mc-dice-link/[role=button], cursor:auto`. Sibling Tentacle row in same overlay does render its +9 / 2d6+5 links, proving the plumbing works for stat-bearing actions only.
2. **Zero effect**: normal click + forced `el.click()` on the Lash row → no modal/popup, no roll, no log entry (`campaign-log.json` count stayed 5, newest entry predates session), change-data md5 identical before/after (`d41d8cd9...` empty). No Tentacle +9 2d6+5 roll produced.
3. **Grep-zero consumers**: `rg "Lash" src server` → 0 matches; `rg legendary src/services/{automation,combat,rules}` → 0 files. `MonsterCardBody.jsx:29` maps `monster.legendary_actions` through the same generic `MonsterAction` path with no Legendary Action dispatch, use tracking, or attack resolution.

## Classification
Same fingerprint as **MV-17**: legendary rows are display-only text with no clickable affordance and no downstream handler. Expected: clicking Lash (or an equivalent affordance) resolves one Tentacle attack (+9, 2d6+5 bludgeoning) with a log entry.

## Side note (not part of verdict)
Opening the monster card logs 2 console errors: `characterKey === campaignName` misuse when setting `encounter-viewingMonster` (`useRuntimeState.js:79,134`) — separate hygiene issue.

## Cleanup
`POST /api/campaigns/Testing G2/admin/clear-change-data` (Host: localhost) executed; browser closed; no manifest/playbook edits.
