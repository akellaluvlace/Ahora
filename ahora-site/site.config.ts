// site.config.ts
export const SITE = {
  // Leave null until you have a firm start date. Later set like: '2025-08-20'
  projectStart: null as string | null,

  // How to compute "Build day": 'entries' or 'calendar'
  countersMode: 'entries' as 'entries' | 'calendar',

  // Goal durations in months
  mvpMonths: 3,
  overallMonths: 6,
};