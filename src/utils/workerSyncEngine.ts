import { Worker } from '../types/attendance';

/**
 * Extracts high-resolution timestamp from a worker object.
 * Legacy objects without updatedAt default to 0.
 */
export function getWorkerTimestamp(worker: Worker | undefined | null): number {
  if (!worker) return 0;
  const ts = Number(worker.updatedAt);
  return !isNaN(ts) && ts > 0 ? ts : 0;
}

/**
 * Checks if a worker object is a soft-deleted tombstone.
 */
export function isWorkerTombstone(worker: Worker | undefined | null): boolean {
  if (!worker) return false;
  return worker.isDeleted === true || worker.status === 'inactive';
}

/**
 * Returns only active, non-deleted workers for UI rendering and calculations.
 */
export function getActiveWorkers(workers: Worker[] = []): Worker[] {
  if (!Array.isArray(workers)) return [];
  return workers.filter((w) => !w.isDeleted && w.status !== 'inactive');
}

/**
 * 1. addOrUpdateWorker(workers, worker)
 * 
 * Adds or updates a worker with a high-resolution LWW timestamp.
 * Resets isDeleted: false if being re-added or restored.
 */
export function addOrUpdateWorker(
  workers: Worker[] = [],
  worker: Partial<Worker> & { id: string }
): { updatedWorkers: Worker[]; worker: Worker } {
  const now = Date.now();
  const existingIndex = workers.findIndex((w) => w.id === worker.id);
  const existing = existingIndex >= 0 ? workers[existingIndex] : null;

  const currentTs = getWorkerTimestamp(existing);
  const updatedAt = now > currentTs ? now : currentTs + 1;

  const updatedWorker: Worker = {
    ...existing,
    ...worker,
    isDeleted: false,
    status: worker.status && worker.status !== 'inactive' ? worker.status : 'active',
    updatedAt,
  } as Worker;

  let updatedWorkers: Worker[];
  if (existingIndex >= 0) {
    updatedWorkers = workers.map((w, idx) => (idx === existingIndex ? updatedWorker : w));
  } else {
    updatedWorkers = [...workers, updatedWorker];
  }

  return { updatedWorkers, worker: updatedWorker };
}

/**
 * 2. deleteWorker(workers, workerId)
 * 
 * Tombstone Soft-Delete (Do NOT immediately slice/filter out workers from array):
 * Marks the worker: isDeleted: true, status: 'inactive', deletedAt: Date.now(), updatedAt: Date.now().
 * Returns the array containing the tombstone record so it propagates across devices.
 */
export function deleteWorker(
  workers: Worker[] = [],
  workerId: string
): { updatedWorkers: Worker[]; tombstone: Worker } {
  const now = Date.now();
  const existingIndex = workers.findIndex((w) => w.id === workerId);
  const existing = existingIndex >= 0 ? workers[existingIndex] : null;

  const currentTs = getWorkerTimestamp(existing);
  const updatedAt = now > currentTs ? now : currentTs + 1;

  const tombstone: Worker = existing
    ? {
        ...existing,
        isDeleted: true,
        status: 'inactive',
        deletedAt: updatedAt,
        updatedAt,
      }
    : {
        id: workerId,
        name: 'Deleted Worker',
        designation: '',
        unit: 'Furnace A',
        salary: 0,
        isDeleted: true,
        status: 'inactive',
        deletedAt: updatedAt,
        updatedAt,
      };

  let updatedWorkers: Worker[];
  if (existingIndex >= 0) {
    updatedWorkers = workers.map((w, idx) => (idx === existingIndex ? tombstone : w));
  } else {
    updatedWorkers = [...workers, tombstone];
  }

  return { updatedWorkers, tombstone };
}

/**
 * 3. mergeWorkersWithLWW(localWorkers, incomingWorkers)
 * 
 * Merges two worker arrays using Last-Write-Wins (LWW) per worker id.
 * If both lists contain the worker, keeps the object with the higher updatedAt.
 * If the newer version has isDeleted: true, it MUST remain deleted across both devices.
 */
export function mergeWorkersWithLWW(
  localWorkers: Worker[] = [],
  incomingWorkers: Worker[] = []
): Worker[] {
  if (!incomingWorkers || incomingWorkers.length === 0) {
    return localWorkers || [];
  }
  if (!localWorkers || localWorkers.length === 0) {
    return incomingWorkers || [];
  }

  const workerMap = new Map<string, Worker>();

  // Process local workers first
  for (const worker of localWorkers) {
    if (worker && worker.id) {
      workerMap.set(worker.id, worker);
    }
  }

  // Merge incoming workers using LWW
  for (const incoming of incomingWorkers) {
    if (!incoming || !incoming.id) continue;

    const existing = workerMap.get(incoming.id);
    if (!existing) {
      workerMap.set(incoming.id, incoming);
    } else {
      const localTs = getWorkerTimestamp(existing);
      const incomingTs = getWorkerTimestamp(incoming);

      // LWW: Pick newer. If incoming is newer or equal, accept incoming.
      // This strictly preserves tombstone records (isDeleted: true) if their timestamp is newer!
      if (incomingTs >= localTs) {
        workerMap.set(incoming.id, incoming);
      }
    }
  }

  const result = Array.from(workerMap.values());

  // Sort by orderIndex so staff order is strictly preserved and identical across devices
  return result.sort((a, b) => {
    const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 99999;
    const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 99999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * 4. mergeRosterWithLWW(localRoster, incomingRoster)
 * 
 * Merges monthly management roster records using Last-Write-Wins (LWW).
 * Iterates month-by-month across both rosters and merges the worker lists
 * using mergeWorkersWithLWW.
 */
export function mergeRosterWithLWW(
  localRoster: Record<string, Worker[]> = {},
  incomingRoster: Record<string, Worker[]> = {}
): Record<string, Worker[]> {
  if (!incomingRoster || Object.keys(incomingRoster).length === 0) {
    return localRoster || {};
  }
  if (!localRoster || Object.keys(localRoster).length === 0) {
    return incomingRoster || {};
  }

  const allMonths = new Set([
    ...Object.keys(localRoster || {}),
    ...Object.keys(incomingRoster || {}),
  ]);

  const mergedRoster: Record<string, Worker[]> = {};

  for (const monthKey of allMonths) {
    const localMonthWorkers = localRoster[monthKey] || [];
    const incomingMonthWorkers = incomingRoster[monthKey] || [];
    mergedRoster[monthKey] = mergeWorkersWithLWW(localMonthWorkers, incomingMonthWorkers);
  }

  return mergedRoster;
}

/**
 * 5. updateRosterWithTombstones(existingRoster, selectedActiveWorkers, allPossibleWorkers)
 * 
 * For a given month, converts omitted workers into tombstones so that other devices
 * holding stale rosters recognize they were deselected/removed from this month.
 */
export function updateRosterWithTombstones(
  currentMonthRoster: Worker[] = [],
  selectedActiveWorkers: Worker[] = [],
  allPossibleWorkers: Worker[] = []
): Worker[] {
  const now = Date.now();
  const selectedIds = new Set(selectedActiveWorkers.map((w) => w.id));
  const result: Worker[] = [];

  // Active selected workers with current/updated timestamps
  for (const worker of selectedActiveWorkers) {
    const currentTs = getWorkerTimestamp(worker);
    const updatedAt = now > currentTs ? now : currentTs + 1;
    result.push({
      ...worker,
      isDeleted: false,
      status: worker.status && worker.status !== 'inactive' ? worker.status : 'active',
      updatedAt,
    });
  }

  // Determine workers previously in roster or master directory who are omitted
  const candidateOmitted = [
    ...currentMonthRoster,
    ...allPossibleWorkers,
  ];

  const processedOmitted = new Set<string>();

  for (const worker of candidateOmitted) {
    if (!worker || !worker.id || selectedIds.has(worker.id) || processedOmitted.has(worker.id)) {
      continue;
    }
    processedOmitted.add(worker.id);

    const currentTs = getWorkerTimestamp(worker);
    const updatedAt = now > currentTs ? now : currentTs + 1;

    // Roster Tombstone entry
    result.push({
      ...worker,
      isDeleted: true,
      status: 'inactive',
      deletedAt: updatedAt,
      updatedAt,
    });
  }

  return result;
}
