export type PlantUnit = 'Furnace A' | 'Furnace B' | 'CCM' | string;

export const CCM_DESIGNATIONS = [
  'CCM MANAGER',
  'CCM INCHARGE',
  'MOLD OPERATOR',
  'MOLD OPERATOR HELPER',
  'FITTER',
  'FITTER HELPER',
  'FOREMAN',
  'GAS CUTTER',
  'GAS CUTTER HELPER',
  'BLADE YARD',
  'TENDISMISSION',
  'TENDISMISSION HELPER',
  'TIMMERMAN',
  'TIMMERMAN HELPER',
  'LADDLEMAN',
  'LADDLEMAN HELPER',
  'SBO',
  'ELECTRICIAN',
  'CRANE OPERATOR',
  'SUPERVISOR',
  'PUMP OPERATOR',
  'BELDER',
] as const;

export const FURNACE_DESIGNATIONS = [
  'MELTER',
  'BARIMAN',
  'FURNACE HELPER',
  'CRANE OPERATOR',
  'SUPERVISOR',
  'INCHARGE',
] as const;

export interface DesignationPeriod {
  id: string;
  designation: string; // in CAPITAL LETTERS
  unit?: PlantUnit;
  salary: number; // Monthly Base Salary for this role period
  startDay: number; // 1 to 31
  endDay: number; // 1 to 31
  monthKey?: string; // Optional: e.g. "2026-10", if omitted applies to any month
  notes?: string; // Transfer note or reason
}

export interface Worker {
  id: string;
  name: string;
  designation: string; // in CAPITAL LETTERS
  unit: PlantUnit; // 'Furnace A' | 'Furnace B' | 'CCM'
  salary: number; // Monthly Base Salary
  designationPeriods?: DesignationPeriod[]; // Mid-month role transfer periods
  orderIndex?: number; // Sorting order index
  employeeCode?: string;
  phone?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  aadharNumber?: string; // 12-digit Aadhaar
  address?: string; // Residential Address
  panNumber?: string; // PAN Number
  fatherName?: string; // Father / Guardian Name
  joiningDate?: string; // Date of Joining
  dateOfBirth?: string; // Date of Birth YYYY-MM-DD
  addedInMonthKey?: string; // e.g. "2026-11" - ensures workers propagate forward to next months but never to previous months
  notes?: string;
  status?: 'active' | 'inactive';
  isDeleted?: boolean;
  deletedAt?: number;
  updatedAt?: number;
}

export interface AttendanceRecord {
  status: string; // e.g. "P4", "P4(4)", "A", "WO", "cleared"
  attendance: string | null; // e.g. "P4" or null when cleared
  shiftDesignation?: string;
  shiftSalary?: number;
  isDeleted?: boolean;
  updatedAt: number; // high-resolution Date.now() timestamp
}

// Map of day (1..31) to attendance code or structured AttendanceRecord
export type WorkerMonthAttendance = Record<number, string | AttendanceRecord>;

// Map of workerId -> monthYearKey ("2026-10") -> WorkerMonthAttendance
export type AttendanceDatabase = Record<string, Record<string, WorkerMonthAttendance>>;

export interface DesignationSplitBreakdown {
  id: string;
  designation: string;
  unit: PlantUnit;
  monthlySalary: number;
  perDayRate: number;
  perHourRate: number;
  startDay: number;
  endDay: number;
  baseWorkingDays: number;
  totalExtraHours: number;
  convertedDaysFromHours: number;
  remainingHours: number;
  totalWorkingDays: number;
  totalEquivalentDays: number;
  periodPayoutSalary: number;
  presentDaysCount: number;
  absentDaysCount: number;
  weeklyOffDaysCount: number;
  notes?: string;
}

export interface AttendanceCalculation {
  totalDaysInMonth: number;
  baseWorkingDays: number;
  totalExtraHours: number;
  convertedDaysFromHours: number; // Math.floor(totalExtraHours / 12)
  remainingHours: number; // totalExtraHours % 12
  totalWorkingDays: number; // baseWorkingDays + convertedDaysFromHours
  totalEquivalentDaysWithFraction: number; // totalWorkingDays + (remainingHours / 12)
  monthlySalary: number;
  perDayRate: number; // monthlySalary / totalDaysInMonth
  perHourRate: number; // perDayRate / 12
  payoutSalary: number; // (monthlySalary / totalDaysInMonth) * (totalWorkingDays + (remainingHours / 12))
  presentDaysCount: number; // number of days worked
  absentDaysCount: number;
  weeklyOffDaysCount: number;
  hasSplitDesignation?: boolean;
  splitBreakdown?: DesignationSplitBreakdown[];
}

export interface UserAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface MonthAllocationRecord {
  isExcluded: boolean;
  updatedAt: number;
}

// Map of monthKey (e.g. "2026-10") -> workerId -> MonthAllocationRecord
export type MonthlyAllocationDatabase = Record<string, Record<string, MonthAllocationRecord>>;
