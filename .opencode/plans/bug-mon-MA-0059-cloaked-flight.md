# bug-mon-MA-0059 — Adult Blue Dragon "Cloaked Flight" — inert display row; no Invisibility cast, no half-speed fly, no once-per-turn gate

## Title
MA-0059 Adult Blue Dragon · Cloaked Flight · legendary_actions · other · FAIL (flavor b: unimplemented)

## Overview
Legendary action row renders as static text in `.mc-overlay`. No spellcast execution (§MV-5 inert spellcast path), no movement grant (§7: no monster move consumer), no "can't take again until next turn" gate. Same MV-17 fingerprint as MA-0058 (whole legendary_actions category inert).

## Expected Behavior
On click/spend: dragon casts Invisibility on self (invisible condition/targetEffect on creature), may move up to half Fly Speed (40 ft.), gated once per turn with regain at turn start.

## Actual Behavior
- Data: monsters.json `legendary_actions[1]` = {name, description} only — no spell/movement/gate fields.
- Code grep-zero: `cloaked` → 0 consumers src+server (non-test); `can't take this action` → 0; `legendary` files are display-only (MonsterCardModal, MonsterCardBody, npcStatBlockUtils, lootGenerator). invisibilityService is character-side only, no monster path (§MV-5 spellcast inert). No monster half-speed/fly consumer (§7).
- Live probe (test-campaign, header ✓ MV-18): joined Adult Blue Dragon 1 (init 10, 212 hp). Cloaked Flight row = DIV.mc-section, cursor auto, tabIndex -1, zero button/input/select/a/.mc-dice-link — no numeric affordance (correct: no bonus/dc/dice authored). Forced `.click()` on row + inner STRONG → zero modals, zero overlay inputs (only pre-existing `mc-close`). change-data diff: same 7 keys, no invis/targetEffect/condition keys, combatSummary contains no "invis". Log: 2→2 entries, zero automation log.

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounters → tick Adult Blue Dragon → Join Encounter.
2. Click dragon token → `.mc-overlay` → Cloaked Flight row → click / forced click → nothing.
3. curl /api/campaigns/test-campaign/change-data + /log → no invisibility/te/gate keys, no log entry.

## Likely Location
Missing subsystem: no legendary-action execution consumer in MonsterCardBody.jsx; legendary economy absent app-wide (MV-17, see MA-0058). Monster spellcasting-as-legendary-action unimplemented (§MV-5).

## Notes
- Cleanup: admin clear-change-data + clear-log POSTs (Host: localhost).
