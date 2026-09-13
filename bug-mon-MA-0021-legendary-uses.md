# bug-mon-MA-0021-legendary-uses.md

**Verdict: FAIL** — display-only name-text "3 (4 in Lair)", zero spend/regain enforcement, zero affordance, grep-zero consumer.

## Monster
- Aboleth · actionName "Legendary Action Uses: 3 (4 in Lair)" · category legendary_actions · actionType other

## Static evidence
- `public/data/monsters.json` aboleth `legendary_actions[0].name = "Legendary Action Uses: 3 (4 in Lair)"` — uses are authored as **plain name text**, no `legendary_actions_count` field, no structured counter.
- `src/components/encounter/MonsterCardBody.jsx:29` renders `legendary_actions` as display-only `.mc-action` rows (`<strong>` name + `<span>` description), no clickable/role=button, no `.mc-dice-link`.
- `src/components/encounter/MonsterCardModal.jsx:607` comment: Legendary rows are *blocked* (attackerActionBlocked), Reactions stay live — confirms Legendary has no active handler.
- Grep `legendary` across `src/` + `server/`: matches only lootGenerator rarity tier + MonsterCardBody display + test fixtures + `npcStatBlockUtils.js:79` empty-array default. **No initiative integration** for "immediately after another creature's turn"; no spend/regain logic; no counter state.

## Live evidence (EB join Aboleth → .mc-overlay)
- Joined Aboleth 1 via Encounters → Join Encounter → initiative (init 7). Card opened via avatar click.
- `.mc-overlay` Legendary section rows (`Legendary Action Uses`, `Lash`, `Psychic Drain`) all render as inert text: `hasDiceLink:false`, `clickable:false`.
- Click on the uses header row → no overlay, no spinbutton editor, no counter change (only `.mc-overlay` remains, no `.sp-overlay/.popup-overlay/.modal` mounts).
- Next→ walk (15 clicks, polled activeCreatureName + round): round stayed `1`; when Aboleth 1 became active (idx 0, idx 11) **no legendary prompt, no popup, no counter decrement/regain**.
- `GET /api/campaigns/Frostfall/change-data` before **and** after: top-level `legendary` keys = `[]`; whole-blob grep for `legendary` = 0 hits. Aboleth 1 store carries only `pendingExpirations` — no uses counter persisted anywhere.

## Conclusion
The legendary-uses header is pure stat-block name text. The app has zero affordance (no counter, no clickable row), zero spend tracking, zero round-wrap regain, and zero consumer code. Manifest row "Legendary Action Uses: 3 (4 in Lair)" has no runtime economy → **FAIL**.
