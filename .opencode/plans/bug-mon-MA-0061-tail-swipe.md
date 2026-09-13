# Bug MA-0061 — Adult Blue Dragon · Tail Swipe (legendary_actions / other)

**Verdict: FAIL — inert legendary row, no attack-roll producer.**

Row: monster "Adult Blue Dragon" · "Tail Swipe" · `legendary_actions` · other · "The dragon makes one Rend attack."

## Expected (MA-0022/MA-0040 bar)
Legendary action clicking Tail Swipe should produce one Rend attack roll (+12 to-hit, 2d8+7 slashing + 1d10 lightning) with a campaign-log entry.

## Actual (E2E, test-campaign, localhost:5173, 2026-09-13)
- Tail Swipe JSON: `{name, description}` free text only — no `attack_bonus`, `save_dc`, `damage_dice_primary`.
- Overlay row: `DIV.mc-action`, `cursor: auto`, **0** buttons/links/inputs. Forced pointerdown/up + mousedown/up + click + dblclick + `.click()`: 0 visible modals, no roll prompt, no targetEffects.
- Zero-delta: campaign-log.json unchanged (593 bytes, 2 entries: join + initiative; grep rend/tail = 0); AasimarTest HP 143 unchanged; character-change-data md5 `655300586ccd...` stable.

## Fingerprint
Matches MA-0022 (Aboleth Lash) / MA-0040 (Black Dragon Pounce) / MV-17: legendary "makes one X attack" rows without authored numbers render inert; `MonsterAction.jsx` gates dice links on attack_bonus/save_dc/damage fields; no legendary dispatch keyed to the row.
- MA-0009-GM-model note: the **Rend** component is live on its own actions row (overlay row idx 2, "+12" dice link present), so the mechanic is GM-adjudicable there — but per MA-0022/40 precedent, a legendary *attack* row must itself produce the roll; component-on-own-row does not rescue the inert legendary row.

## Grep
`rg -i "tail swipe|tailswipe" src server public/campaigns` → 0 matches. No consumer.

## Cleanup
`POST /api/campaigns/test-campaign/admin/clear-change-data` + `clear-log` (Host: localhost) executed; browser closed; no manifest/playbook edits.
