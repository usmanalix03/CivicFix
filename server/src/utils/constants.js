export const ISSUE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  CONTESTED: 'CONTESTED',
  NEEDS_VERIFICATION: 'NEEDS_VERIFICATION',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
});

export const USER_ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

export const ACTION_TYPES = Object.freeze({
  INITIAL_REPORT: 'INITIAL_REPORT',
  CONFIRM_FIXED: 'CONFIRM_FIXED',
  FLAG_SPAM: 'FLAG_SPAM',
  STILL_EXISTS: 'STILL_EXISTS',
});

export const OTP_PURPOSES = Object.freeze({
  CITIZEN_SIGNUP: 'CITIZEN_SIGNUP',
  ADMIN_SIGNUP: 'ADMIN_SIGNUP',
  PASSWORD_RESET: 'PASSWORD_RESET',
  ADMIN_EDIT: 'ADMIN_EDIT',
  USER_DELETE: 'USER_DELETE',
  ADMIN_DELETE: 'ADMIN_DELETE',
});

// Canonical civic categories surfaced to the AI and used for display badges.
export const CIVIC_CATEGORIES = Object.freeze([
  'Pothole',
  'Electrical Hazard',
  'Sanitation',
  'Water Logging',
  'Streetlight',
  'Vandalism',
  'Road Damage',
  'Drainage',
  'Traffic Signal',
  'Illegal Dumping',
  'Public Property Damage',
  'Other',
]);

export const MAP_FEED_STATUSES = Object.freeze(['ACTIVE', 'NEEDS_VERIFICATION', 'CONTESTED']);

// Minimum GPS accuracy (metres) the client must satisfy before reporting.
export const GPS_ACCURACY_THRESHOLD_METERS = 20;
