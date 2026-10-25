import { Worker, AttendanceDatabase } from '../types/attendance';

// Default worker list is empty (0 workers) so user can add their own workers
export const DEFAULT_WORKERS: Worker[] = [];

// Empty initial attendance database
export function getInitialAttendanceData(_year: number = 2026, _month: number = 10): AttendanceDatabase {
  return {};
}
