const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a strict YYYY-MM-DD date string, rejecting both malformed
 * strings and impossible calendar dates (e.g. 2024-02-30). This is purely a
 * format check — it never evaluates business rules like whether the date is
 * achievable; that's the backend's job.
 */
export const isValidDateOnlyString = (value: string): boolean => {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
