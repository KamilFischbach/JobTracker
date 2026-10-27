import type { JobApplicationType } from '../types/JobApplication';

export type ApplicationSort =
  | 'applied-newest'
  | 'applied-oldest'
  | 'company'
  | 'salary-high';

export type ApplicationListFilters = {
  searchText: string;
  appliedAfter: string;
  appliedBefore: string;
  sortBy: ApplicationSort;
};

export function dateInputValue(date: Date | null) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function filterAndSortApplications(
  applications: JobApplicationType[],
  filters: ApplicationListFilters,
): JobApplicationType[] {
  const searchNeedle = filters.searchText.trim().toLowerCase();
  const filtered = applications.filter((application) => {
    const matchesKeyword =
      !searchNeedle ||
      [application.companyName, application.jobTitle, application.notes]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(searchNeedle));
    const appliedDate = dateInputValue(application.appliedDate);
    const matchesAfter =
      !filters.appliedAfter ||
      (appliedDate !== '' && appliedDate >= filters.appliedAfter);
    const matchesBefore =
      !filters.appliedBefore ||
      (appliedDate !== '' && appliedDate <= filters.appliedBefore);

    return matchesKeyword && matchesAfter && matchesBefore;
  });

  return filtered.sort((left, right) => {
    if (filters.sortBy === 'company') {
      return left.companyName.localeCompare(right.companyName);
    }
    if (filters.sortBy === 'salary-high') {
      const leftSalary =
        left.salaryMax === null ? null : Number(left.salaryMax);
      const rightSalary =
        right.salaryMax === null ? null : Number(right.salaryMax);
      if (leftSalary === null && rightSalary === null) return 0;
      if (leftSalary === null) return 1;
      if (rightSalary === null) return -1;
      return rightSalary - leftSalary;
    }

    if (!left.appliedDate && !right.appliedDate) return 0;
    if (!left.appliedDate) return 1;
    if (!right.appliedDate) return -1;

    const dateDifference =
      left.appliedDate.getTime() - right.appliedDate.getTime();
    return filters.sortBy === 'applied-newest'
      ? -dateDifference
      : dateDifference;
  });
}
