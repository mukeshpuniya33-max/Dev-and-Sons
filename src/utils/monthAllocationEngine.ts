import {
  Worker,
  MonthAllocationRecord,
  MonthlyAllocationDatabase,
} from '../types/attendance';

/**
 * 1. getActiveWorkersForMonth
 * 
 * Returns all active workers allocated to a specific month.
 * By default, every month inherits all active profiles from the Master Directory.
 * If a worker has isExcluded: true in that specific month's allocation record,
 * they are excluded from this month only.
 */
export function getActiveWorkersForMonth(
  masterWorkers: Worker[] = [],
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  monthKey: string
): Worker[] {
  if (!Array.isArray(masterWorkers)) return [];

  const monthAllocations = monthlyAllocationDb[monthKey] || {};

  return masterWorkers.filter((worker) => {
    // 1. Permanent deletion or inactivity in Master Directory applies everywhere
    if (worker.isDeleted === true || worker.status === 'inactive') {
      return false;
    }

    // 2. Joining date propagation check: worker does not appear in months prior to addition
    if (worker.addedInMonthKey && worker.addedInMonthKey > monthKey) {
      return false;
    }

    // 3. Month-specific exclusion override
    const allocation = monthAllocations[worker.id];
    if (allocation && allocation.isExcluded === true) {
      return false;
    }

    // By default, included in this month
    return true;
  });
}

/**
 * Checks if a specific worker is excluded from a month.
 */
export function isWorkerExcludedInMonth(
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): boolean {
  return monthlyAllocationDb[monthKey]?.[workerId]?.isExcluded === true;
}

/**
 * 2. excludeWorkerFromMonth(monthlyAllocationDb, workerId, monthKey)
 * 
 * Excludes a worker ONLY from the specified month's roster.
 * Crucial: Does NOT touch Master Directory or other months.
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
 * 3. includeWorkerInMonth(monthlyAllocationDb, workerId, monthKey)
 * 
 * Restores/includes a worker in the specified month's roster.
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

/**
 * Toggles a worker's inclusion for a given month.
 */
export function toggleWorkerMonthAllocation(
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): { updatedDb: MonthlyAllocationDatabase; record: MonthAllocationRecord; isNowExcluded: boolean } {
  const currentMonthMap = monthlyAllocationDb[monthKey] || {};
  const isCurrentlyExcluded = currentMonthMap[workerId]?.isExcluded === true;

  if (isCurrentlyExcluded) {
    const res = includeWorkerInMonth(monthlyAllocationDb, workerId, monthKey);
    return { ...res, isNowExcluded: false };
  } else {
    const res = excludeWorkerFromMonth(monthlyAllocationDb, workerId, monthKey);
    return { ...res, isNowExcluded: true };
  }
}

/**
 * 4. mergeMonthlyAllocationWithLWW(localAllocationDb, incomingAllocationDb)
 * 
 * Merges two monthly allocation databases using Last-Write-Wins (LWW) per worker per month.
 * Compares timestamps (updatedAt) so exclusions and inclusions sync reliably across devices.
 */
export function mergeMonthlyAllocationWithLWW(
  localAllocationDb: MonthlyAllocationDatabase = {},
  incomingAllocationDb: MonthlyAllocationDatabase = {}
): MonthlyAllocationDatabase {
  if (!incomingAllocationDb || Object.keys(incomingAllocationDb).length === 0) {
    return localAllocationDb || {};
  }
  if (!localAllocationDb || Object.keys(localAllocationDb).length === 0) {
    return incomingAllocationDb || {};
  }

  const result: MonthlyAllocationDatabase = {};
  const allMonths = new Set([
    ...Object.keys(localAllocationDb || {}),
    ...Object.keys(incomingAllocationDb || {}),
  ]);

  for (const monthKey of allMonths) {
    const localMonthMap = localAllocationDb[monthKey] || {};
    const incomingMonthMap = incomingAllocationDb[monthKey] || {};

    const allWorkerIds = new Set([
      ...Object.keys(localMonthMap),
      ...Object.keys(incomingMonthMap),
    ]);

    const mergedMonthMap: Record<string, MonthAllocationRecord> = {};

    for (const workerId of allWorkerIds) {
      const localRec = localMonthMap[workerId];
      const incomingRec = incomingMonthMap[workerId];

      if (!localRec && incomingRec) {
        mergedMonthMap[workerId] = incomingRec;
      } else if (localRec && !incomingRec) {
        mergedMonthMap[workerId] = localRec;
      } else if (localRec && incomingRec) {
        const localTs = Number(localRec.updatedAt) || 0;
        const incomingTs = Number(incomingRec.updatedAt) || 0;

        // LWW: If incoming is newer or equal, take incoming
        if (incomingTs >= localTs) {
          mergedMonthMap[workerId] = incomingRec;
        } else {
          mergedMonthMap[workerId] = localRec;
        }
      }
    }

    result[monthKey] = mergedMonthMap;
  }

  return result;
}
