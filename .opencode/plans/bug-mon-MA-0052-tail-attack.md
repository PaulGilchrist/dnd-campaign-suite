# Bug MA-0052 — Adult Blue Dracolich "Tail Attack" legendary action is inert (MV-17 family)

**Verdict: FAIL**

Row: monster "Adult Blue Dracolich" · "Tail Attack" · category `legendary_actions` · actionType `other` · "The dracolich makes a tail attack."

## Evidence (E2E, test-campaign, localhost:5173, 2026-09-13)
1. **Zero affordance**: `legendary_actions[2]` in `public/data/monsters.json` carries no `attack_bonus`, `save_dc`, or `damage_dice_primary` — description references the Tail attack but is plain prose. `MonsterAction.jsx:64` renders the to-hit link only when `attack_bonus != null`; `ActionDamageLinks` (`:12`) bails when no dice present → row renders as inert `DIV.mc-action`. Live DOM: `cursor:auto`, `onclick:false`, `0` `.mc-dice-link`/`[role=button]`/`button`, children = `<strong>"Tail Attack."</strong>` + plain span.
2. **Zero effect**: forced `el.click()` ×5 on the row → no modal/popup, no roll, no log entry (log stayed 4: only 2× encounter-joined + 2× initiative rolls from Join), change-data md5 identical before/after (`7d82803763b87b0aca8cf0d7a7b0e761`), `lastAttack` null, no pending roll/prompt/legendary keys. The authored Tail stats (+13, 2d8+7 bludgeoning, reach 15 ft. — MA-0047 PASS reference) are never engaged from this row.
3. **No dispatch**: `monster.legendary_actions` maps through the generic `MonsterAction` path (`MonsterCardBody.jsx:29`) with no legendary-action resolution or attack linkage; no `legendary`/`Tail Attack` consumer in `src/services/{automation,combat,rules}`.

## Classification
**MV-17** fingerprint (same as MA-0022 Lash, MA-0051 Detect): text-only legendary row with no clickable affordance and no downstream handler. Expected: clicking "Tail Attack" resolves the dracolich's Tail attack (+13 to hit, 2d8+7 bludgeoning, reach 15 ft.) with a log entry — or the row is explicitly authored with those numeric fields to become clickable per MV-23.

## Cleanup
`POST /api/campaigns/test-campaign/admin/clear-change-data` + `POST /api/campaigns/test-campaign/admin/clear-log` (Host: localhost) executed; browser closed; no manifest/playbook edits.
