export const formatDate = (isoDate: string): string => {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

export const formatDateTime = (isoDateTime: string): string => {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const classNames = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');
