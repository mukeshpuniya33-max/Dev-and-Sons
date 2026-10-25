import { useEffect, useRef, useCallback } from 'react';
import {
  Worker,
  AttendanceDatabase,
  MonthlyAllocationDatabase,
  SyncStatus,
} from '../types/attendance';
import {
  mergeAttendanceWithLWW,
  mergeWorkersWithLWW,
  mergeMonthlyAllocationWithLWW,
} from '../utils/attendanceSyncEngine';
import { subscribeToUserCloudData } from '../lib/firebase';
import { subscribeToServerSyncStream } from '../lib/serverSync';

export interface UseBidirectionalSyncProps {
  enabled: boolean;
  userId?: string | null;
  userEmail?: string | null;
  accountKey?: string;
  deviceId: string;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  masterWorkers: Worker[];
  setMasterWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  attendanceDb: AttendanceDatabase;
  setAttendanceDb: React.Dispatch<React.SetStateAction<AttendanceDatabase>>;
  monthlyAllocationDb: MonthlyAllocationDatabase;
  setMonthlyAllocationDb: React.Dispatch<React.SetStateAction<MonthlyAllocationDatabase>>;
  onSyncStatusChange?: (status: SyncStatus) => void;
}

export function useBidirectionalSync({
  enabled,
  userId,
  userEmail,
  accountKey,
  deviceId,
  workers,
  setWorkers,
  masterWorkers,
  setMasterWorkers,
  attendanceDb,
  setAttendanceDb,
  monthlyAllocationDb,
  setMonthlyAllocationDb,
  onSyncStatusChange,
}: UseBidirectionalSyncProps) {
  const workersRef = useRef(workers);
  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  const masterWorkersRef = useRef(masterWorkers);
  useEffect(() => {
    masterWorkersRef.current = masterWorkers;
  }, [masterWorkers]);

  const attendanceDbRef = useRef(attendanceDb);
  useEffect(() => {
    attendanceDbRef.current = attendanceDb;
  }, [attendanceDb]);

  const monthlyAllocationDbRef = useRef(monthlyAllocationDb);
  useEffect(() => {
    monthlyAllocationDbRef.current = monthlyAllocationDb;
  }, [monthlyAllocationDb]);

  // Flag to strictly prevent reciprocal write-back loop to the cloud
  const isRemoteSyncingRef = useRef<boolean>(false);

  const handleIncomingRemoteData = useCallback(
    (
      incomingMaster?: Worker[],
      incomingAttendance?: AttendanceDatabase,
      incomingAllocation?: MonthlyAllocationDatabase
    ) => {
      // Set flag to true to guarantee no cloud broadcast is triggered by local state setters
      isRemoteSyncingRef.current = true;

      if (incomingMaster && incomingMaster.length > 0) {
        const mergedMaster = mergeWorkersWithLWW(masterWorkersRef.current || [], incomingMaster);
        setMasterWorkers(mergedMaster);
        try {
          localStorage.setItem('plant_master_workers_v3', JSON.stringify(mergedMaster));
        } catch {}
      }

      if (incomingAttendance && Object.keys(incomingAttendance).length > 0) {
        const mergedAttendance = mergeAttendanceWithLWW(
          attendanceDbRef.current || {},
          incomingAttendance
        );
        setAttendanceDb(mergedAttendance);
        try {
          localStorage.setItem('plant_attendance_db_v1', JSON.stringify(mergedAttendance));
        } catch {}
      }

      if (
        incomingAllocation &&
        typeof incomingAllocation === 'object' &&
        Object.keys(incomingAllocation).length > 0
      ) {
        const mergedAllocation = mergeMonthlyAllocationWithLWW(
          monthlyAllocationDbRef.current || {},
          incomingAllocation
        );
        setMonthlyAllocationDb(mergedAllocation);
        try {
          localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(mergedAllocation));
        } catch {}
      }

      onSyncStatusChange?.('synced');
      
      // Delay releasing flag to give React re-render cycles and effect hooks time to settle without echo
      setTimeout(() => {
        isRemoteSyncingRef.current = false;
      }, 500);
    },
    [setMasterWorkers, setAttendanceDb, setMonthlyAllocationDb, onSyncStatusChange]
  );

  useEffect(() => {
    if (!enabled) {
      onSyncStatusChange?.('offline');
      return;
    }

    onSyncStatusChange?.('syncing');
    let unsubFirestore: (() => void) | null = null;
    let unsubServerSync: (() => void) | null = null;

    if (userId) {
      unsubFirestore = subscribeToUserCloudData(
        userId,
        (cloudMaster, cloudAttendance, _monthlyWorkers, _masterList, _deletedIds, cloudAllocation) => {
          handleIncomingRemoteData(cloudMaster, cloudAttendance, cloudAllocation);
        },
        userEmail || undefined,
        deviceId
      );
    }

    if (accountKey) {
      unsubServerSync = subscribeToServerSyncStream(accountKey, (syncPayload) => {
        if (syncPayload) {
          handleIncomingRemoteData(
            syncPayload.masterWorkers || syncPayload.workers,
            syncPayload.attendance,
            syncPayload.monthlyAllocationDb as MonthlyAllocationDatabase
          );
        }
      });
    }

    return () => {
      if (unsubFirestore) unsubFirestore();
      if (unsubServerSync) unsubServerSync();
    };
  }, [enabled, userId, userEmail, accountKey, deviceId, handleIncomingRemoteData, onSyncStatusChange]);

  return {
    workersRef,
    masterWorkersRef,
    attendanceDbRef,
    monthlyAllocationDbRef,
    isRemoteSyncingRef,
    handleIncomingRemoteData,
  };
}
