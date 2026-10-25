import {
  Worker,
  AttendanceDatabase,
  AttendanceRecord,
  MonthlyAllocationDatabase,
  MonthAllocationRecord,
} from '../types/attendance';

/**
 * Marks or updates attendance for a worker on a specific day in a specific month with a high-resolution timestamp.
 */
export function markAttendance(
  attendanceDb: AttendanceDatabase = {},
  workerId: string,
  attendanceCode: string,
  day: number,
  monthKey: string
): { updatedDb: AttendanceDatabase; record: AttendanceRecord } {
  const workerAttendance = { ...(attendanceDb[workerId] || {}) };
  const monthAttendance = { ...(workerAttendance[monthKey] || {}) };

  const now = Date.now();
  const existingCell = monthAttendance[day];
  const existingTs =
    typeof existingCell === 'object' && existingCell !== null ? existingCell.updatedAt || 0 : 0;
  const updatedAt = now > existingTs ? now : existingTs + 1;

  const record: AttendanceRecord = {
    status: attendanceCode,
    attendance: attendanceCode,
    isDeleted: false,
    updatedAt,
  };

  monthAttendance[day] = record;
  workerAttendance[monthKey] = monthAttendance;

  const updatedDb: AttendanceDatabase = {
    ...attendanceDb,
    [workerId]: workerAttendance,
  };

  return { updatedDb, record };
}

/**
 * Clears or tombstones attendance for a worker on a specific day using a soft delete record.
 */
export function clearAttendance(
  attendanceDb: AttendanceDatabase = {},
  workerId: string,
  day: number,
  monthKey: string
): { updatedDb: AttendanceDatabase; record: AttendanceRecord } {
  const workerAttendance = { ...(attendanceDb[workerId] || {}) };
  const monthAttendance = { ...(workerAttendance[monthKey] || {}) };

  const now = Date.now();
  const existingCell = monthAttendance[day];
  const existingTs =
    typeof existingCell === 'object' && existingCell !== null ? existingCell.updatedAt || 0 : 0;
  const updatedAt = now > existingTs ? now : existingTs + 1;

  const record: AttendanceRecord = {
    status: 'cleared',
    attendance: null,
    isDeleted: true,
    updatedAt,
  };

  monthAttendance[day] = record;
  workerAttendance[monthKey] = monthAttendance;

  const updatedDb: AttendanceDatabase = {
    ...attendanceDb,
    [workerId]: workerAttendance,
  };

  return { updatedDb, record };
}

/**
 * Adds or updates a worker in the master directory with a soft-delete tombstone support and updatedAt timestamp.
 */
export function addOrUpdateWorker(
  masterWorkers: Worker[] = [],
  workerPayload: Worker
): Worker[] {
  const now = Date.now();
  const updatedWorker: Worker = {
    ...workerPayload,
    status: workerPayload.status || 'active',
    isDeleted: workerPayload.isDeleted || false,
    updatedAt: Math.max(Number(workerPayload.updatedAt) || 0, now),
  };

  const index = masterWorkers.findIndex((w) => w.id === updatedWorker.id);
  if (index >= 0) {
    const copy = [...masterWorkers];
    copy[index] = { ...copy[index], ...updatedWorker };
    return copy;
  } else {
    return [...masterWorkers, updatedWorker];
  }
}

/**
 * Soft deletes or excludes a worker from a specific month only.
 * Leaves the Master Directory and all other months untouched.
 */
export function excludeWorkerFromMonth(
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): { updatedDb: MonthlyAllocationDatabase; record: MonthAllocationRecord } {
  const currentMonthMap = { ...(monthlyAllocationDb[monthKey] || {}) };
  const currentRecord = currentMonthMap[workerId];
  const currentTs = currentRecord?.updatedAt || 0;
  const now = Date.now();
  const updatedAt = now > currentTs ? now : currentTs + 1;

  const record: MonthAllocationRecord = {
    isExcluded: true,
    updatedAt,
  };

  currentMonthMap[workerId] = record;

  const updatedDb: MonthlyAllocationDatabase = {
    ...monthlyAllocationDb,
    [monthKey]: currentMonthMap,
  };

  return { updatedDb, record };
}

/**
 * Restores or includes a worker in a specific month's roster.
 */
export function includeWorkerInMonth(
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): { updatedDb: MonthlyAllocationDatabase; record: MonthAllocationRecord } {
  const currentMonthMap = { ...(monthlyAllocationDb[monthKey] || {}) };
  const currentRecord = currentMonthMap[workerId];
  const currentTs = currentRecord?.updatedAt || 0;
  const now = Date.now();
  const updatedAt = now > currentTs ? now : currentTs + 1;

  const record: MonthAllocationRecord = {
    isExcluded: false,
    updatedAt,
  };

  currentMonthMap[workerId] = record;

  const updatedDb: MonthlyAllocationDatabase = {
    ...monthlyAllocationDb,
    [monthKey]: currentMonthMap,
  };

  return { updatedDb, record };
}
