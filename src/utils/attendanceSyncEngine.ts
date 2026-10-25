import {
  Worker,
  AttendanceDatabase,
  WorkerMonthAttendance,
  AttendanceRecord,
  MonthlyAllocationDatabase,
  MonthAllocationRecord,
} from '../types/attendance';

/**
 * Safely extracts numeric updatedAt timestamp or 0.
 * Handles string records (legacy), objects, null, and undefined.
 */
export function getAttendanceTimestamp(record: string | AttendanceRecord | number | undefined | null): number {
  if (!record) return 0;
  if (typeof record === 'number') return record;
  if (typeof record === 'object' && record !== null) {
    const ts = Number((record as AttendanceRecord).updatedAt);
    if (!isNaN(ts) && ts > 0) return ts;
  }
  if (typeof record === 'string') return 1;
  return 0;
}

/**
 * Accurately checks for soft-delete tombstone records.
 * Returns true if entry has status 'cleared', isDeleted === true, or legacy markers.
 */
export function isTombstoneRecord(entry: string | AttendanceRecord | undefined | null): boolean {
  if (!entry) return false;
  if (typeof entry === 'string') {
    return entry === 'cleared' || entry === '__deleted__' || entry === 'deleted';
  }
  if (typeof entry === 'object' && entry !== null) {
    return entry.isDeleted === true || entry.status === 'cleared';
  }
  return false;
}

/**
 * Returns a clean display string for attendance codes.
 * Returns '' (empty string) for cleared/deleted/tombstone records, null, or undefined.
 */
export function getAttendanceCode(entry: string | AttendanceRecord | undefined | null): string {
  if (!entry) return '';
  if (isTombstoneRecord(entry)) return '';
  if (typeof entry === 'string') {
    return entry === 'cleared' ? '' : entry;
  }
  if (typeof entry === 'object' && entry !== null) {
    if (entry.isDeleted || entry.status === 'cleared') return '';
    return entry.attendance || entry.status || (entry as any).code || '';
  }
  return '';
}

/**
 * Safely extracts numeric timestamp from worker object.
 */
export function getWorkerTimestamp(worker: Worker | undefined | null): number {
  if (!worker) return 0;
  return Number(worker.updatedAt) || Number(worker.deletedAt) || 0;
}

/**
 * Deep cell-by-cell (workerId -> monthKey -> day) merge using high-resolution updatedAt.
 * Strictly preserves newer tombstone records (status: 'cleared', isDeleted: true).
 */
export function mergeAttendanceWithLWW(
  localDb: AttendanceDatabase = {},
  incomingDb: AttendanceDatabase = {}
): AttendanceDatabase {
  const local = localDb || {};
  const incoming = incomingDb || {};
  const result: AttendanceDatabase = JSON.parse(JSON.stringify(local));

  const allWorkerIds = new Set([
    ...Object.keys(local),
    ...Object.keys(incoming),
  ]);

  for (const workerId of allWorkerIds) {
    if (!result[workerId]) result[workerId] = {};
    const localMonths = local[workerId] || {};
    const incomingMonths = incoming[workerId] || {};
    const allMonths = new Set([
      ...Object.keys(localMonths),
      ...Object.keys(incomingMonths),
    ]);

    for (const monthKey of allMonths) {
      if (!result[workerId][monthKey]) result[workerId][monthKey] = {};
      const localDays = localMonths[monthKey] || {};
      const incomingDays = incomingMonths[monthKey] || {};
      const allDays = new Set([
        ...Object.keys(localDays).map(Number),
        ...Object.keys(incomingDays).map(Number),
      ]);

      for (const day of allDays) {
        const localCell = localDays[day];
        const incomingCell = incomingDays[day];

        if (incomingCell !== undefined && localCell === undefined) {
          result[workerId][monthKey][day] = incomingCell;
        } else if (localCell !== undefined && incomingCell === undefined) {
          result[workerId][monthKey][day] = localCell;
        } else if (localCell !== undefined && incomingCell !== undefined) {
          const localTs = getAttendanceTimestamp(localCell);
          const incomingTs = getAttendanceTimestamp(incomingCell);

          if (incomingTs >= localTs) {
            // Strictly preserves newer tombstone records ('status: cleared', 'isDeleted: true')
            result[workerId][monthKey][day] = incomingCell;
          } else {
            result[workerId][monthKey][day] = localCell;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Merges workers array by worker ID using updatedAt timestamp.
 * Preserves soft-delete tombstones across devices.
 */
export function mergeWorkersWithLWW(
  localWorkers: Worker[] = [],
  incomingWorkers: Worker[] = []
): Worker[] {
  const workerMap = new Map<string, Worker>();
  
  (localWorkers || []).forEach((w) => {
    if (w && w.id) {
      workerMap.set(w.id, { ...w });
    }
  });

  (incomingWorkers || []).forEach((inc) => {
    if (!inc || !inc.id) return;
    const existing = workerMap.get(inc.id);

    if (!existing) {
      workerMap.set(inc.id, { ...inc });
    } else {
      const existingTs = getWorkerTimestamp(existing);
      const incomingTs = getWorkerTimestamp(inc);

      if (incomingTs >= existingTs) {
        workerMap.set(inc.id, { ...inc });
      }
    }
  });

  return Array.from(workerMap.values());
}

/**
 * Merges month-specific overrides by monthKey -> workerId comparing updatedAt.
 */
export function mergeMonthlyAllocationWithLWW(
  localAlloc: MonthlyAllocationDatabase = {},
  incomingAlloc: MonthlyAllocationDatabase = {}
): MonthlyAllocationDatabase {
  const local = localAlloc || {};
  const incoming = incomingAlloc || {};
  const result: MonthlyAllocationDatabase = JSON.parse(JSON.stringify(local));

  const allMonths = new Set([
    ...Object.keys(local),
    ...Object.keys(incoming),
  ]);

  for (const monthKey of allMonths) {
    if (!result[monthKey]) result[monthKey] = {};
    const localWorkers = local[monthKey] || {};
    const incomingWorkers = incoming[monthKey] || {};
    const allWorkers = new Set([
      ...Object.keys(localWorkers),
      ...Object.keys(incomingWorkers),
    ]);

    for (const workerId of allWorkers) {
      const localRec = localWorkers[workerId];
      const incomingRec = incomingWorkers[workerId];

      if (incomingRec && !localRec) {
        result[monthKey][workerId] = { ...incomingRec };
      } else if (localRec && !incomingRec) {
        result[monthKey][workerId] = { ...localRec };
      } else if (localRec && incomingRec) {
        const localTs = Number(localRec.updatedAt) || 0;
        const incomingTs = Number(incomingRec.updatedAt) || 0;

        if (incomingTs >= localTs) {
          result[monthKey][workerId] = { ...incomingRec };
        } else {
          result[monthKey][workerId] = { ...localRec };
        }
      }
    }
  }

  return result;
}

/**
 * Merges monthly roster databases using LWW.
 */
export function mergeRosterWithLWW(
  localRoster: Record<string, string[]> = {},
  incomingRoster: Record<string, string[]> = {}
): Record<string, string[]> {
  const result: Record<string, string[]> = { ...(localRoster || {}) };
  for (const [monthKey, incomingIds] of Object.entries(incomingRoster || {})) {
    const localIds = result[monthKey] || [];
    const combined = Array.from(new Set([...localIds, ...(incomingIds || [])]));
    result[monthKey] = combined;
  }
  return result;
}

/**
 * Returns workers where worker.isDeleted !== true and allocationDb?.[monthKey]?.[worker.id]?.isExcluded !== true.
 */
export function getActiveWorkersForMonth(
  masterWorkers: Worker[] = [],
  allocationDb: MonthlyAllocationDatabase = {},
  monthKey: string
): Worker[] {
  if (!Array.isArray(masterWorkers)) return [];
  const allocations = allocationDb?.[monthKey] || {};

  return masterWorkers.filter((worker) => {
    if (!worker || worker.isDeleted === true || worker.status === 'inactive') {
      return false;
    }

    if (worker.addedInMonthKey && worker.addedInMonthKey > monthKey) {
      return false;
    }

    const allocation = allocations[worker.id];
    if (allocation && allocation.isExcluded === true) {
      return false;
    }

    return true;
  });
}
