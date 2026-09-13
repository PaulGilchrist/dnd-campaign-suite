# Bug mon-MA-0023 — Aboleth Psychic Drain: fully inert legendary row (FAIL, flavor-only)

Row: MA-0023 · "Psychic Drain" · category legendary_actions · actionType condition ·
conditions ["charmed","grappled"] · "If the aboleth has at least one creature Charmed or
Grappled, it uses Consume Memories and regains 5 (1d10) Hit Points."

## Verdict: FAIL — inert flavor text (b). No affordance, no gate, no heal, no economy.
Cannot PASS: nothing on the row is clickable or executable; row is a dead text div.

## Live evidence (test-campaign, 2026-09-13, fresh EB Join "Aboleth 1", initiative 12)
1. **No affordance.** Overlay probe: row DOM =
   `<div class="mc-action"><strong>Psychic Drain.</strong> <span>If the aboleth…</span></div>` —
   `.mc-dice-link` count 0, `button` count 0, no role/tabIndex. Inert text only.
2. **No execution on click.** Normal click + forced `el.click()` on row, forced click on
   `<strong>`, forced `dblclick`: zero modals/popups, zero new log entries, zero change-data
   keys/deltas attributable to the row (log at probe time contains only the two join-time
   entries: `encounter joined` + `roll initiative [12,5]`, both t=05:19:34, click was later).
3. **No heal producer.** Aboleth 1 HP stayed 150/150 in card spinbutton and combatSummary
   (`currentHp:150, maxHp:150`) after all clicks. No `hp_change`/`isHealing` mechanism exists
   for monster rows: `MonsterAction.jsx` has no heal/heal-dice path at all, and
   `extractDamageDiceFromDescription` (MonsterCardModal.jsx:29-34) only matches
   `Hit|Failure|Success: N (XdY)` — "regains 5 (1d10) Hit Points" does not match, so even
   the prose 1d10 never becomes a rollable dice link. Data row carries `{name, description}` only
   (monsters.json — no save_dc/attack_bonus/damage dice) → all MonsterAction affordance branches null.
4. **No precondition gate (MV-16 family).** "Charmed or Grappled" is parsed by nothing —
   conditions live only in prose; no structured `requires_conditions`, no target eligibility check.
   Consistent with MA-0019 (Consume Memories gate absent) and MV-9 (zero grapple producers).
   Note: the row's referenced "Consume Memories" itself is gate-ignoring (see bug-mon-MA-0019).
5. **No legendary economy (MV-17 family).** `rg -i "psychic.?drain|psychicDrain" src server` →
   0 hits. `rg -i legendary src/services/{automation,combat,rules}` → 0 files. No uses/day counter,
   no depletion, no round-end reset anywhere. Same inert-legendary family as MA-0021/MA-0022.

## Fix pointer
Structure the row (heal_dice:"1d10", fixed:5, requires_conditions + source attribution,
legendary cost) and add a heal-dispatch affordance + legendary uses tracker; or accept as
documented flavor and mark row non-interactive in the manifest.
