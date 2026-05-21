/**
 * Assignation conducteur / bon envoyé — une entrée par numéro de course (1, 2, …).
 */

function parseDriverAssignmentsMap(r) {
  let raw = r && r.driverAssignmentsByCourse;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

function getDriverAssignmentForCourse(r, courseNum) {
  const n = Math.max(1, parseInt(String(courseNum || 1), 10) || 1);
  const map = parseDriverAssignmentsMap(r);
  const entry = map[String(n)];
  if (entry && (entry.sentAt || entry.sentTo || entry.driverName)) {
    return {
      sentAt: entry.sentAt || null,
      sentTo: String(entry.sentTo || '').trim() || null,
      driverName: String(entry.driverName || '').trim() || null,
      plate: String(entry.plate || '').trim() || null,
    };
  }
  /* Rétrocompat : anciennes réservations (champs globaux = course 1 uniquement) */
  if (n === 1 && r && r.driverOrderSentAt) {
    return {
      sentAt: r.driverOrderSentAt,
      sentTo: String(r.driverOrderSentTo || '').trim() || null,
      driverName: String(r.assignedDriverName || '').trim() || null,
      plate: String(r.assignedDriverPlate || '').trim() || null,
    };
  }
  return null;
}

function colleagueDisplayNameFromAssignment(assignment) {
  if (!assignment) return '';
  const n = String(assignment.driverName || '').trim();
  if (n) return n;
  const em = String(assignment.sentTo || '').trim();
  const at = em.indexOf('@');
  if (at > 0) return em.slice(0, at);
  return em || '';
}

function buildDriverAssignmentsPatch(r, courseNum, { sentAt, sentTo, driverName, plate }) {
  const map = { ...parseDriverAssignmentsMap(r) };
  map[String(courseNum)] = {
    sentAt: sentAt || new Date().toISOString(),
    sentTo: String(sentTo || '').trim(),
    driverName: String(driverName || '').trim() || null,
    plate: String(plate || '').trim() || null,
  };
  return { driverAssignmentsByCourse: map };
}

/** Applique course + assignation collègue pour e-mails / bons de mission. */
function reservationViewForCourse(r, courseNum, applyCourseToReservation) {
  const view = applyCourseToReservation(r, courseNum);
  const a = getDriverAssignmentForCourse(r, courseNum);
  if (!a) return view;
  return {
    ...view,
    assignedDriverName: a.driverName,
    assignedDriverPlate: a.plate,
    driverOrderSentAt: a.sentAt,
    driverOrderSentTo: a.sentTo,
  };
}

module.exports = {
  parseDriverAssignmentsMap,
  getDriverAssignmentForCourse,
  colleagueDisplayNameFromAssignment,
  buildDriverAssignmentsPatch,
  reservationViewForCourse,
};
