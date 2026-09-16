# Bug MA-0269 — Androsphinx "Claw Attack" (legendary_actions[0]) INERT

## Verdict: FAIL (inert-prose family, MA-0262/MA-0253 parity)

## Evidence (2026-09-16, test-campaign, live sphinx cs idx2 init 2, hp 199/199)
- Row DOM affordances: buttons 0, .mc-dice-link 0, .clickable 0, cursor auto; `.mc-legendary-counter` 0, `.mc-legendary-header-row` 0 (header absent — rows[0] IS the attack, no economy row in data).
- 2× JS click (row + label): log curl 267→267 ZERO delta; zero popups; console errors 0.
- Control same card: actions "Claw" +12 chip → ONE attack: roll d20 18 +12 = 30 HIT, damage roll 2d10+6 = 13 applied DraconicDragon 137→124 (damage roll + hp_change ts-paired 1789535918296). Pipeline proven live.

## Root cause: DATA
`public/data/monsters.json` androsphinx legendary_actions[0] = bare `{name:"Claw Attack", description:"The sphinx makes one claw attack."}` — no attack_bonus/save_dc/dice/delegates_to/advisory/ability_check → MonsterAction renders text-only (MonsterAction.jsx:161-195 all chip gates fail).

## Name-similarity check: NO delegation exists
Delegation is key-only: `legendaryDelegateAction` (monsterLegendaryUses.js:6-9) matches `action.delegates_to` exactly. Zero consumers map legendary row names ("Claw Attack") onto action names ("Claw"). Name proximity produces no affordance — confirmed live 0-affordance.

## Secondary: economy header absent data-wide
No "Legendary Action Uses" header row and rows[0].uses==null → `legendaryHeaderAction` null (monsterLegendaryUses.js:139) → MonsterCardBody.jsx:54 falls to ungated fallback branch (no legendaryGate, no counter, no slice(1)). Roar usage `{type:'per day',times:3}` display-only (MA-0268 :708 precedent).

## Fix template (adult MA-0145 / MA-0262 shape)
legendary_actions header prepend `{name:"Legendary Action Uses", uses:3}` (or uses on canonical structure per MA-0136) + row `delegates_to:"Claw"`; resolution then runs +12/2d10+6 through `legendaryRowHasNumericMechanic`→delegate seam (MonsterCardModal.jsx:304-315) with spend/gate economy live.

## Untouched
Roar victims left as staged (Sorc/Dragon states); no save-file edits; no mutating POSTs; registry/manifest/playbook unedited.
