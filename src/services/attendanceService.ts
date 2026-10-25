import {
  AttendanceDatabase,
  AttendanceRecord,
  MonthlyAllocationDatabase,
  MonthAllocationRecord,
  SyncStatus,
} from '../types/attendance';
import { useEffect, useRef } from 'react';

/**
 * Writes an attendance record with status, attendance code, isDeleted: false, and updatedAt: Date.now().
 */
export function markAttendance(
  attendanceDb: AttendanceDatabase = {},
  workerId: string,
  status: string,
  day: number,
  monthKey: string
): { updatedDb: AttendanceDatabase; record: AttendanceRecord } {
  const db: AttendanceDatabase = JSON.parse(JSON.stringify(attendanceDb || {}));

  if (!db[workerId]) db[workerId] = {};
  if (!db[workerId][monthKey]) db[workerId][monthKey] = {};

  const record: AttendanceRecord = {
    status,
    attendance: status,
    isDeleted: false,
    updatedAt: Date.now(),
  };

  db[workerId][monthKey][day] = record;
  return { updatedDb: db, record };
}

/**
 * Writes a tombstone record with status: 'cleared', attendance: null, isDeleted: true, updatedAt: Date.now()
 * to eliminate zombie echo resurrections across devices.
 */
export function clearAttendance(
  attendanceDb: AttendanceDatabase = {},
  workerId: string,
  day: number,
  monthKey: string
): { updatedDb: AttendanceDatabase; record: AttendanceRecord } {
  const db: AttendanceDatabase = JSON.parse(JSON.stringify(attendanceDb || {}));

  if (!db[workerId]) db[workerId] = {};
  if (!db[workerId][monthKey]) db[workerId][monthKey] = {};

  const record: AttendanceRecord = {
    status: 'cleared',
    attendance: null,
    isDeleted: true,
    updatedAt: Date.now(),
  };

  db[workerId][monthKey][day] = record;
  return { updatedDb: db, record };
}

/**
 * Sets isExcluded: true with updatedAt: Date.now() for that month only (preserves master directory and other months).
 */
export function excludeWorkerFromMonth(
  allocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): { updatedDb: MonthlyAllocationDatabase; record: MonthAllocationRecord } {
  const db: MonthlyAllocationDatabase = JSON.parse(JSON.stringify(allocationDb || {}));

  if (!db[monthKey]) db[monthKey] = {};

  const record: MonthAllocationRecord = {
    isExcluded: true,
    updatedAt: Date.now(),
  };

  db[monthKey][workerId] = record;
  return { updatedDb: db, record };
}

/**
 * Sets isExcluded: false with updatedAt: Date.now().
 */
export function includeWorkerInMonth(
  allocationDb: MonthlyAllocationDatabase = {},
  workerId: string,
  monthKey: string
): { updatedDb: MonthlyAllocationDatabase; record: MonthAllocationRecord } {
  const db: MonthlyAllocationDatabase = JSON.parse(JSON.stringify(allocationDb || {}));

  if (!db[monthKey]) db[monthKey] = {};

  const record: MonthAllocationRecord = {
    isExcluded: false,
    updatedAt: Date.now(),
  };

  db[monthKey][workerId] = record;
  return { updatedDb: db, record };
}

export interface UseRealtimeSyncHandlerProps {
  attendanceDb: AttendanceDatabase;
  onSyncStatusChange?: (status: SyncStatus) => void;
  handleIncomingAttendance: (incoming: AttendanceDatabase) => void;
}

export function useRealtimeSyncHandler({
  attendanceDb,
  onSyncStatusChange,
  handleIncomingAttendance,
}: UseRealtimeSyncHandlerProps) {
  const attendanceDbRef = useRef(attendanceDb);
  useEffect(() => {
    attendanceDbRef.current = attendanceDb;
  }, [attendanceDb]);

  return { attendanceDbRef, handleIncomingAttendance, onSyncStatusChange };
}
