import type { JobApplicationType } from '../types/JobApplication';

export type ApplicationStats = {
  total: number;
  /** Applications that left "Saved" (sent to the company). */
  sent: number;
  /** Sent applications that got any answer: interview, offer or rejection. */
  responses: number;
  /** Whole-number percentage of sent applications that got a response, or null if none were sent. */
  responseRate: number | null;
  interviews: number;
  offers: number;
};

export function getApplicationStats(
  applications: JobApplicationType[],
): ApplicationStats {
  const count = (status: JobApplicationType['status']) =>
    applications.filter((application) => application.status === status).length;

  const interviews = count('INTERVIEW_SCHEDULED');
  const offers = count('OFFER');
  const rejections = count('REJECTED');
  const sent = applications.length - count('SAVED');
  const responses = interviews + offers + rejections;

  return {
    total: applications.length,
    sent,
    responses,
    responseRate: sent === 0 ? null : Math.round((responses / sent) * 100),
    interviews,
    offers,
  };
}
