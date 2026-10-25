import { Worker, AttendanceDatabase, MonthlyAllocationDatabase } from '../types/attendance';

export interface SyncPayload {
  accountKey?: string;
  userEmail?: string;
  userId?: string;
  senderDeviceId?: string;
  workers: Worker[];
  attendance: AttendanceDatabase;
  monthlyWorkersDb: Record<string, Worker[]>;
  masterWorkers: Worker[];
  monthlyAllocationDb?: MonthlyAllocationDatabase;
  dayNotesDb?: Record<string, Record<number, string>>;
  deletedWorkerIds?: string[];
  clearedAttendanceCells?: Record<string, number>;
  timestamp?: number;
}

export interface SyncResponse {
  success: boolean;
  accountKey: string;
  data: {
    workers: Worker[];
    attendance: AttendanceDatabase;
    monthlyWorkersDb: Record<string, Worker[]>;
    masterWorkers: Worker[];
    monthlyAllocationDb?: MonthlyAllocationDatabase;
    deletedWorkerIds?: string[];
    clearedAttendanceCells?: Record<string, number>;
    senderDeviceId?: string;
    revision?: number;
    timestamp: number;
    updatedAt: string;
  } | null;
}

const STORAGE_KEY_DELETED_WORKER_IDS = 'plant_deleted_worker_ids_v1';
const STORAGE_KEY_CLEARED_CELLS = 'plant_cleared_attendance_cells_v1';

export function getDeletedWorkerIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_WORKER_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function recordWorkerDeletion(workerId: string) {
  if (!workerId) return;
  try {
    const existing = new Set(getDeletedWorkerIds());
    existing.add(workerId);
    localStorage.setItem(STORAGE_KEY_DELETED_WORKER_IDS, JSON.stringify(Array.from(existing)));
  } catch {}
}

export function clearRecordedDeletion(workerId: string) {
  if (!workerId) return;
  try {
    const existing = new Set(getDeletedWorkerIds());
    existing.delete(workerId);
    localStorage.setItem(STORAGE_KEY_DELETED_WORKER_IDS, JSON.stringify(Array.from(existing)));
  } catch {}
}

export function getClearedAttendanceCells(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLEARED_CELLS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch {}
  return {};
}

export function recordCellClear(cellKey: string) {
  if (!cellKey) return;
  try {
    const existing = getClearedAttendanceCells();
    existing[cellKey] = Date.now();
    localStorage.setItem(STORAGE_KEY_CLEARED_CELLS, JSON.stringify(existing));
  } catch {}
}

export function clearRecordedCellClear(cellKey: string) {
  if (!cellKey) return;
  try {
    const existing = getClearedAttendanceCells();
    if (existing[cellKey]) {
      delete existing[cellKey];
      localStorage.setItem(STORAGE_KEY_CLEARED_CELLS, JSON.stringify(existing));
    }
  } catch {}
}

export async function pushToServerSync(payload: SyncPayload): Promise<SyncResponse['data']> {
  const deletedIds = getDeletedWorkerIds();
  const clearedCells = getClearedAttendanceCells();
  const accountKey = (payload.accountKey || payload.userEmail || '').toLowerCase().trim();
  if (!accountKey) return null;

  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      accountKey,
      deletedWorkerIds: deletedIds,
      clearedAttendanceCells: clearedCells,
      timestamp: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Server sync failed with HTTP status ${response.status}`);
  }

  const result: SyncResponse = await response.json();
  return result.data;
}

export async function pullFromServerSync(accountKey: string): Promise<SyncResponse['data']> {
  if (!accountKey) return null;
  const normKey = accountKey.toLowerCase().trim();
  const response = await fetch(`/api/sync/pull?accountKey=${encodeURIComponent(normKey)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Server sync pull failed with HTTP status ${response.status}`);
  }

  const result: SyncResponse = await response.json();
  return result.data;
}

export function subscribeToServerSyncStream(
  accountKey: string,
  onDataReceived: (data: SyncResponse['data']) => void
): () => void {
  if (!accountKey || typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const normKey = accountKey.toLowerCase().trim();
  let eventSource: EventSource | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      eventSource = new EventSource(`/api/sync/stream?accountKey=${encodeURIComponent(normKey)}`);

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === '') return;
          const parsed = JSON.parse(event.data);
          if (parsed && typeof parsed === 'object') {
            onDataReceived(parsed);
          }
        } catch (err) {
          console.warn('[SSE Sync] Parse notice:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      console.warn('[SSE Sync] Connection notice:', e);
      if (!isClosed) {
        setTimeout(connect, 4000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

export async function transferAccountDataServer(targetEmail: string, dataBundle: {
  workers: Worker[];
  attendance: AttendanceDatabase;
  monthlyWorkersDb: Record<string, Worker[]>;
  masterWorkers: Worker[];
}) {
  const normTarget = targetEmail.toLowerCase().trim();
  const response = await fetch('/api/sync/transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetEmail: normTarget,
      data: dataBundle,
      timestamp: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Account data transfer failed with HTTP status ${response.status}`);
  }

  return await response.json();
}

export interface AnomalyItem {
  id: string;
  name: string;
  unit: string;
  type: 'high_absence' | 'zero_attendance' | 'high_overtime' | 'wage_mismatch';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface UnitStat {
  count: number;
  totalPayout: number;
  presentDays: number;
  otDays: number;
}

export interface AIPayrollInsightsResponse {
  success: boolean;
  summary: string;
  stats: {
    totalWorkers: number;
    activePresent: number;
    totalPayoutFormatted: string;
    avgDailyPresent: number;
    totalOvertimeShifts?: number;
    totalAbsentDays?: number;
    attendanceRate?: number;
    estimatedOTCostFormatted?: string;
    unitBreakdown: Record<string, UnitStat>;
  };
  anomalies?: AnomalyItem[];
  costOptimization?: {
    overtimeSharePercent: number;
    potentialSavingsTips: string;
  };
  recommendations: string[];
}

export interface AIAskResponse {
  success: boolean;
  answer: string;
  highlights?: string[];
  actionAdvice?: string;
}

export async function fetchAIPayrollInsights(payload: {
  year: number;
  month: number;
  workers: Worker[];
  attendanceDb: AttendanceDatabase;
  totalPlantPayout: number;
}): Promise<AIPayrollInsightsResponse> {
  const response = await fetch('/api/ai/payroll-insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI Insights request failed with HTTP status ${response.status}`);
  }

  return await response.json();
}

export async function askAIPayrollQuestion(payload: {
  question: string;
  image?: string;
  year: number;
  month: number;
  workers: Worker[];
  attendanceDb: AttendanceDatabase;
  totalPlantPayout: number;
  language?: 'hi' | 'en';
}): Promise<AIAskResponse> {
  const response = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI Ask request failed with HTTP status ${response.status}`);
  }

  return await response.json();
}
