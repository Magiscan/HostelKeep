/**
 * The attributes that actually apply to a room right now.
 *
 * An unsaved attribute counts as ON, because that is what the assign UI shows.
 * Reading `status.assignmentAttributes` directly gives `{}` for a room nobody
 * has touched, which silently means "nothing to do" — and drops the room from
 * the filters and the printed sheet while the manager is looking at a card
 * full of ticked boxes.
 */
export function effectiveAttributes(room, status) {
  if (room.type !== 'private') return [];
  const configured = room.attributes
    ? Object.keys(room.attributes).filter(a => room.attributes[a])
    : [];
  const saved = status.assignmentAttributes;
  return configured.filter(attr => (
    saved && Object.prototype.hasOwnProperty.call(saved, attr)
      ? !!saved[attr]
      : true
  ));
}

export function roomNeedsAssignment(room, status) {
  if (status.commonOnly) return true;
  if (room.type === 'dorm') {
    const assign = status.assignmentBedStatus || {};
    return (room.beds || []).some(b => {
      const s = assign[b.id]?.status || 'noone';
      return s !== 'noone' && s !== 'stayover';
    });
  }
  if (room.type === 'private') return effectiveAttributes(room, status).length > 0;
  return false;
}

/**
 * Private-room features that are new to this room: the room was just created,
 * just became private, or just had them ticked in the room form. saveRoom
 * saves these as OFF, so a feature the manager hasn't planned yet doesn't make
 * the room look like it needs cleaning. Features the room already had are
 * left alone.
 */
export function newlyAddedAttributes(room, previous) {
  if (room.type !== 'private') return [];
  const on = (r) => Object.keys(r?.attributes || {}).filter(k => r.attributes[k]);
  const before = previous?.type === 'private' ? new Set(on(previous)) : new Set();
  return on(room).filter(k => !before.has(k));
}