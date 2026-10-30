export const SAMPLE_TRANSCRIPT = `[00:00:05] Rahul: The authentication API is ready for testing.
[00:00:20] Lead: Priya, please finish the API documentation by Friday.
[00:00:40] Lead: Okay, we all agreed to use PostgreSQL.
[00:01:00] Rahul: Someone should update the onboarding docs.
[00:01:20] Priya: The staging environment is unstable right now.
[00:01:40] Lead: Who will own the mobile release?`;

// Friday, 2026-10-30 is the meeting date used across tests (a Friday).
export const MEETING = {
  title: 'Sprint planning',
  meetingDate: '2026-10-28', // Wednesday
  timezone: 'Asia/Kolkata',
  participants: ['Rahul', 'Priya', 'Lead'],
};
