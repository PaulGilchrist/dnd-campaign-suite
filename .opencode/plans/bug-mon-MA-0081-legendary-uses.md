# Bug MA-0081 — Adult Bronze Dragon "Legendary Action Uses: 3 (4 in Lair)" is inert (MV-17 family)

**Verdict: FAIL** (flavor b — inert text-only header; MV-30: inert + grep-zero is never a PASS)

## Row
- MA-0081 · Adult Bronze Dragon · legendary_actions[0] header · category: other.

## Expected
Legendary action counter tracking 3 uses (4 in lair), spent when a legendary action is taken, reset at start of the dragon's turn, visible as counter/spinbutton on the initiative card and monster card overlay.

## Actual (live probe, test-campaign, joined initiative)
- Overlay row renders as `DIV.mc-action` (cursor: auto), zero `button/input/select/[role=button]` children — no counter, no spend affordance.
- Forced click on the row: zero state delta (`/api/campaigns/test-campaign/change-data` byte-identical pre/post, 9843 B); no log entry; overlay unchanged.
- Prose "expend a use" / "regains all expended uses" has no consumer: `rg -i "legendary.?use|expends a use|regains all expended" src server` → zero monster-side producers (only PC class handlers: clockworkCavalcade, extraAction, magicalCunning).
- No lair 3→4 uses logic anywhere.

## Fingerprint
- MV-17: name-text-only legendary row → inert `.mc-action` via MonsterCardBody.jsx:29 → MonsterActionSection → MonsterAction. No numeric authored fields, so MV-23 exception N/A.
- Missing subsystem: legendary action economy (uses counter, spend, lair bonus, per-turn reset) absent app-wide. Same family as MA-0037/0051/0052.

## Cleanup
- Admin clear-change-data + clear-log POSTs (Host: localhost); browser closed. No manifest/playbook edits.
