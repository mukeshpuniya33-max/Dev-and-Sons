import { useEffect, useRef, useCallback } from 'react';
import { Worker, AttendanceDatabase, SyncStatus } from '../types/attendance';
import {
  deleteWorker as engineDeleteWorker,
  addOrUpdateWorker as engineAddOrUpdateWorker,
  mergeWorkersWithLWW,
  mergeRosterWithLWW,
  getActiveWorkers,
  updateRosterWithTombstones,
  getWorkerTimestamp,
} from '../utils/workerSyncEngine';
import { mergeAttendanceWithLWW } from '../utils/attendanceSyncEngine';
import { subscribeToUserCloudData } from '../lib/firebase';
import { subscribeToServerSyncStream } from '../lib/serverSync';

export {
  deleteWorker,
  addOrUpdateWorker,
  mergeWorkersWithLWW,
  mergeRosterWithLWW,
  getActiveWorkers,
  updateRosterWithTombstones,
  getWorkerTimestamp,
} from '../utils/workerSyncEngine';

export interface UseRealtimeWorkerSyncProps {
  workers: Worker[];
  masterWorkers: Worker[];
  monthlyWorkersDb: Record<string, Worker[]>;
  attendanceDb: AttendanceDatabase;
  onSyncUpdate: (payload: {
    workers: Worker[];
    masterWorkers: Worker[];
    monthlyWorkersDb: Record<string, Worker[]>;
    attendanceDb: AttendanceDatabase;
  }) => void;
  userId?: string | null;
  userEmail?: string | null;
  accountKey?: string;
  deviceId?: string;
  onSyncStatusChange?: (status: SyncStatus) => void;
  enabled?: boolean;
}

/**
 * Real-time reactive sync hook for Workers, Management Roster, and Attendance.
 * 
 * Solves Zombie Resurrections & Echo Loops:
 * 1. Synchronizes local state refs continuously to prevent stale closure race conditions.
 * 2. Merges incoming remote workers and rosters cell-by-cell / row-by-row with Last-Write-Wins (LWW).
 * 3. Keeps deleted worker tombstones (isDeleted: true) authoritative across all devices.
 * 4. PURE LOCAL UPDATE: Real-time listeners ONLY update local UI state and NEVER trigger a write-back.
 */
export function useRealtimeWorkerSync({
  workers,
  masterWorkers,
  monthlyWorkersDb,
  attendanceDb,
  onSyncUpdate,
  userId,
  userEmail,
  accountKey,
  deviceId = 'client',
  onSyncStatusChange,
  enabled = true,
}: UseRealtimeWorkerSyncProps) {
  const workersRef = useRef<Worker[]>(workers);
  const masterWorkersRef = useRef<Worker[]>(masterWorkers);
  const monthlyWorkersDbRef = useRef<Record<string, Worker[]>>(monthlyWorkersDb);
  const attendanceDbRef = useRef<AttendanceDatabase>(attendanceDb);

  // Continuously synchronize refs with current component state
  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  useEffect(() => {
    masterWorkersRef.current = masterWorkers;
  }, [masterWorkers]);

  useEffect(() => {
    monthlyWorkersDbRef.current = monthlyWorkersDb;
  }, [monthlyWorkersDb]);

  useEffect(() => {
    attendanceDbRef.current = attendanceDb;
  }, [attendanceDb]);

  const handleIncomingRemoteData = useCallback(
    (
      incomingWorkers?: Worker[],
      incomingAttendance?: AttendanceDatabase,
      incomingMonthlyDb?: Record<string, Worker[]>,
      incomingMaster?: Worker[]
    ) => {
      // 1. Merge Workers & Master with LWW
      const currentMaster = masterWorkersRef.current;
      const currentWorkers = workersRef.current;
      const currentMonthly = monthlyWorkersDbRef.current;
      const currentAttendance = attendanceDbRef.current;

      const mergedMaster = mergeWorkersWithLWW(currentMaster, incomingMaster || incomingWorkers || []);
      const mergedWorkers = mergeWorkersWithLWW(currentWorkers, incomingWorkers || []);

      // 2. Merge Monthly Management Roster with LWW
      const mergedMonthly = mergeRosterWithLWW(currentMonthly, incomingMonthlyDb || {});

      // 3. Merge Attendance with LWW
      const mergedAttendance = incomingAttendance
        ? mergeAttendanceWithLWW(currentAttendance, incomingAttendance)
        : currentAttendance;

      // Pure UI update - NO automated write-back!
      onSyncUpdate({
        workers: mergedWorkers,
        masterWorkers: mergedMaster,
        monthlyWorkersDb: mergedMonthly,
        attendanceDb: mergedAttendance,
      });
    },
    [onSyncUpdate]
  );

  useEffect(() => {
    if (!enabled) return;

    let unsubFirestore: (() => void) | null = null;
    let unsubServerSync: (() => void) | null = null;

    if (userId || userEmail) {
      onSyncStatusChange?.('syncing');

      // 1. Reactive Firestore Snapshot Listener
      unsubFirestore = subscribeToUserCloudData(
        userId || 'anonymous',
        (cloudWorkers, cloudAttendance, cloudMonthlyDb, cloudMaster) => {
          handleIncomingRemoteData(cloudWorkers, cloudAttendance, cloudMonthlyDb, cloudMaster);
          onSyncStatusChange?.('synced');
        },
        userEmail || '',
        deviceId
      );
    }

    // 2. Real-time SSE Fallback Stream
    const effectiveKey = accountKey || userEmail || (userId ? `user_${userId}` : undefined);
    if (effectiveKey) {
      unsubServerSync = subscribeToServerSyncStream(
        effectiveKey,
        (syncPayload) => {
          if (syncPayload) {
            handleIncomingRemoteData(
              syncPayload.workers,
              syncPayload.attendance,
              syncPayload.monthlyWorkersDb,
              syncPayload.masterWorkers
            );
            onSyncStatusChange?.('synced');
          }
        }
      );
    }

    return () => {
      if (unsubFirestore) unsubFirestore();
      if (unsubServerSync) unsubServerSync();
    };
  }, [enabled, userId, userEmail, accountKey, deviceId, handleIncomingRemoteData, onSyncStatusChange]);

  return {
    workersRef,
    masterWorkersRef,
    monthlyWorkersDbRef,
    attendanceDbRef,
    handleIncomingRemoteData,
  };
}
