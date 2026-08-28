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