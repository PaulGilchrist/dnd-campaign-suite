/**
 * Campaign-authoring plan Phase 3 — the single AI-draft chip shared by every
 * GM list lane (quests/factions/NPCs/settlements/sessions/maps). One concept:
 * renders `draft` when the row is an unapproved AI draft, nothing otherwise.
 * Players can never receive draft rows in the first place (server-side
 * filtering in jsonEntityCrud/maps/encounters lanes), so this is GM UI only.
 */
function DraftFlag({ row }) {
  if (row?.draft !== true) return null;
  return <span className="ct-draft-flag">draft</span>;
}

export default DraftFlag;
