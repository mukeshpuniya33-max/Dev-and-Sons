import { Worker, AttendanceDatabase, MonthlyAllocationDatabase } from '../types/attendance';
import { calculateWorkerMonthlyAttendance, parseAttendanceCode } from './attendanceCalculator';
import { getActiveWorkersForMonth, getAttendanceCode } from './attendanceSyncEngine';

export interface DailyUnitStats {
  unit: string;
  presentCount: number;
  workingDays: number; // man-days on this date
  payout: number;      // total wages on this date
}

export interface DailyDesignationStats {
  designation: string;
  presentCount: number;
  workingDays: number;
  payout: number;
}

export interface DailyWorkerDetail {
  id: string;
  name: string;
  employeeCode?: string;
  designation: string;
  unit: string;
  code: string;
  workingDays: number;
  payout: number;
}

export interface DailyAnalytics {
  day: number;
  dateKey: string;           // e.g. "2026-10-01"
  dayOfWeekIndex: number;    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  totalPresent: number;      // count of workers present on this day
  totalWorkingDays: number;  // total equivalent man-days on this day
  totalPayout: number;       // total wage payout on this day
  unitBreakdown: DailyUnitStats[];
  designationBreakdown: DailyDesignationStats[];
  workerDetails: DailyWorkerDetail[];
}

export interface UnitAnalytics {
  unit: string;
  currentPayout: number;       // total monthly payout
  previousPayout: number;      // previous month payout
  difference: number;          // MoM difference
  percentChange: number;
  currentManDays: number;      // total monthly man-days
  previousManDays: number;
  workerCount: number;
  attendancePercentage: number;
  avgDailyPayout: number;      // average payout per day in current month
  avgDailyManDays: number;     // average man-days per day
}

export interface DesignationAnalytics {
  designation: string;
  currentPayout: number;       // total monthly payout
  previousPayout: number;      // previous month payout
  difference: number;          // MoM difference
  percentChange: number;
  workerCount: number;
  currentWorkingDays: number;  // total monthly working days
  previousWorkingDays: number;
  daysDifference: number;
  totalAvailableDays: number;
  attendancePercentage: number;
  avgDaysPerWorker: number;
  avgDailyPayout: number;      // average payout per day for this designation
  avgDailyWorkingDays: number; // average working days per day for this designation
}

export interface WorkerMoMAnalytics {
  id: string;
  name: string;
  employeeCode?: string;
  unit: string;
  designation: string;
  currentPayout: number;
  previousPayout: number;
  difference: number;
  percentChange: number;
  currentWorkingDays: number;
  previousWorkingDays: number;
  attendancePercentage: number;
  avgDailyPayout: number;
}

export interface PlantAnalyticsReport {
  currentMonthKey: string;
  previousMonthKey: string;
  daysInCurrentMonth: number;
  daysInPreviousMonth: number;
  totalCurrentPayout: number;
  totalPreviousPayout: number;
  totalDifference: number;
  totalPercentChange: number;
  totalCurrentWorkingDays: number;
  totalPreviousWorkingDays: number;
  totalAvailableDays: number;
  overallAttendancePercentage: number;
  avgDailyPlantPayout: number;
  avgDailyPlantWorkingDays: number;
  dailyAnalytics: DailyAnalytics[];
  units: UnitAnalytics[];
  designations: DesignationAnalytics[];
  workers: WorkerMoMAnalytics[];
}

/**
 * Normalizes day-by-day attendance into clean day -> code strings for calculation.
 * Defensively extracts codes from both string entries and object records.
 */
function extractWorkerMonthAttendance(
  workerId: string,
  monthKey: string,
  attendanceDb: AttendanceDatabase
): Record<number, string> {
  const result: Record<number, string> = {};
  const monthData = attendanceDb?.[workerId]?.[monthKey];
  if (!monthData || typeof monthData !== 'object') return result;

  for (let day = 1; day <= 31; day++) {
    const entry = monthData[day] !== undefined ? monthData[day] : (monthData as Record<string, any>)[String(day)];
    if (entry !== undefined && entry !== null) {
      const code = getAttendanceCode(entry);
      if (code) {
        result[day] = code;
      }
    }
  }
  return result;
}

/**
 * Computes comprehensive Month-over-Month (MoM) and Date-wise (Daily) Plant Salary & Attendance Analytics.
 *
 * Provides:
 * 1. Day-wise breakdown for all dates (1 to 31): Total attendance, man-days, daily payout, unit breakdown, and designation breakdown.
 * 2. Monthly aggregates for units and designations with both Total Month and Daily Average statistics.
 * 3. Individual worker breakdown with monthly & daily rate computations.
 */
export function computePlantAnalytics(
  masterWorkers: Worker[] = [],
  monthlyAllocationDb: MonthlyAllocationDatabase = {},
  attendanceDb: AttendanceDatabase = {},
  currentYear: number,
  currentMonth: number,
  currentMonthWorkers?: Worker[]
): PlantAnalyticsReport {
  const curMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  
  // Previous month calculation
  let prevYear = currentYear;
  let prevMonth = currentMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  // Days in respective months
  const curDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();

  // Build a master lookup map of all known worker profiles
  const allKnownWorkersMap = new Map<string, Worker>();
  
  if (Array.isArray(masterWorkers)) {
    for (const w of masterWorkers) {
      if (w && w.id && !w.isDeleted) {
        allKnownWorkersMap.set(w.id, w);
      }
    }
  }

  if (Array.isArray(currentMonthWorkers)) {
    for (const w of currentMonthWorkers) {
      if (w && w.id && !w.isDeleted) {
        if (!allKnownWorkersMap.has(w.id) || !allKnownWorkersMap.get(w.id)?.salary) {
          allKnownWorkersMap.set(w.id, w);
        }
      }
    }
  }

  // Active workers derived from allocation rules
  const baseCurWorkers = getActiveWorkersForMonth(
    Array.from(allKnownWorkersMap.values()),
    monthlyAllocationDb,
    curMonthKey
  );
  const basePrevWorkers = getActiveWorkersForMonth(
    Array.from(allKnownWorkersMap.values()),
    monthlyAllocationDb,
    prevMonthKey
  );

  const curWorkerMap = new Map<string, Worker>();
  for (const w of baseCurWorkers) {
    curWorkerMap.set(w.id, w);
  }

  // If currentMonthWorkers are explicitly passed, ensure any non-deleted worker is in current month
  if (Array.isArray(currentMonthWorkers)) {
    for (const w of currentMonthWorkers) {
      if (w && w.id && !w.isDeleted && w.status !== 'inactive') {
        curWorkerMap.set(w.id, w);
      }
    }
  }



  const prevWorkerMap = new Map<string, Worker>();
  for (const w of basePrevWorkers) {
    prevWorkerMap.set(w.id, w);
  }



  const unitMap = new Map<string, {
    curPayout: number;
    prevPayout: number;
    curDays: number;
    prevDays: number;
    count: number;
  }>();

  const desigMap = new Map<string, {
    curPayout: number;
    prevPayout: number;
    curDays: number;
    prevDays: number;
    count: number;
  }>();

  const workerMomList: WorkerMoMAnalytics[] = [];

  const workerPayoutsCur = new Map<string, { payout: number; days: number; worker: Worker }>();
  const workerPayoutsPrev = new Map<string, { payout: number; days: number; worker: Worker }>();

  // =========================================================================
  // Initialize Daily Analytics Structures (Day 1 to curDaysInMonth)
  // =========================================================================
  interface RawDailyData {
    day: number;
    dateKey: string;
    dayOfWeekIndex: number;
    totalPresent: number;
    totalWorkingDays: number;
    totalPayout: number;
    unitMap: Map<string, { presentCount: number; workingDays: number; payout: number }>;
    desigMap: Map<string, { presentCount: number; workingDays: number; payout: number }>;
    workerDetails: DailyWorkerDetail[];
  }

  const dailyRawMap = new Map<number, RawDailyData>();
  for (let d = 1; d <= curDaysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const dateKey = `${curMonthKey}-${dStr}`;
    const dayOfWeekIndex = new Date(currentYear, currentMonth - 1, d).getDay();
    dailyRawMap.set(d, {
      day: d,
      dateKey,
      dayOfWeekIndex,
      totalPresent: 0,
      totalWorkingDays: 0,
      totalPayout: 0,
      unitMap: new Map(),
      desigMap: new Map(),
      workerDetails: [],
    });
  }

  // Process current month attendance
  for (const w of curWorkerMap.values()) {
    const cleanAttendance = extractWorkerMonthAttendance(w.id, curMonthKey, attendanceDb);
    const calc = calculateWorkerMonthlyAttendance(cleanAttendance, w.salary || 26000, curDaysInMonth);
    workerPayoutsCur.set(w.id, {
      payout: calc.payoutSalary || 0,
      days: calc.totalEquivalentDaysWithFraction || 0,
      worker: w,
    });

    const perDayRate = (w.salary || 26000) / curDaysInMonth;
    const perHourRate = perDayRate / 12;
    const workerUnit = w.unit || 'General';
    const workerDesig = (w.designation || 'WORKER').toUpperCase().trim();

    // Calculate Day-wise breakdown for this worker
    for (let d = 1; d <= curDaysInMonth; d++) {
      const dayData = dailyRawMap.get(d);
      if (!dayData) continue;

      const code = cleanAttendance[d] || '';
      if (!code) continue;

      const parsed = parseAttendanceCode(code);
      const dayEquivDays = parsed.days + (parsed.hours / 12);
      const isPresent = parsed.days > 0 || parsed.hours > 0;
      const dayPayout = (perDayRate * parsed.days) + (perHourRate * parsed.hours);

      if (isPresent || dayEquivDays > 0) {
        dayData.totalPresent += 1;
        dayData.totalWorkingDays += dayEquivDays;
        dayData.totalPayout += dayPayout;

        // Day Unit Breakdown
        let uDay = dayData.unitMap.get(workerUnit);
        if (!uDay) {
          uDay = { presentCount: 0, workingDays: 0, payout: 0 };
          dayData.unitMap.set(workerUnit, uDay);
        }
        uDay.presentCount += 1;
        uDay.workingDays += dayEquivDays;
        uDay.payout += dayPayout;

        // Day Designation Breakdown
        let dDay = dayData.desigMap.get(workerDesig);
        if (!dDay) {
          dDay = { presentCount: 0, workingDays: 0, payout: 0 };
          dayData.desigMap.set(workerDesig, dDay);
        }
        dDay.presentCount += 1;
        dDay.workingDays += dayEquivDays;
        dDay.payout += dayPayout;

        // Day Worker Detail
        dayData.workerDetails.push({
          id: w.id,
          name: w.name || 'Unknown Worker',
          employeeCode: w.employeeCode,
          designation: workerDesig,
          unit: workerUnit,
          code,
          workingDays: dayEquivDays,
          payout: dayPayout,
        });
      }
    }
  }

  // Process previous month attendance
  for (const w of prevWorkerMap.values()) {
    const cleanAttendance = extractWorkerMonthAttendance(w.id, prevMonthKey, attendanceDb);
    const calc = calculateWorkerMonthlyAttendance(cleanAttendance, w.salary || 26000, prevDaysInMonth);
    workerPayoutsPrev.set(w.id, {
      payout: calc.payoutSalary || 0,
      days: calc.totalEquivalentDaysWithFraction || 0,
      worker: w,
    });
  }

  // All unique worker IDs active in either month
  const allWorkerIds = Array.from(new Set([...workerPayoutsCur.keys(), ...workerPayoutsPrev.keys()]));

  let totalCurrentPayout = 0;
  let totalPreviousPayout = 0;
  let totalCurrentWorkingDays = 0;
  let totalPreviousWorkingDays = 0;

  for (const id of allWorkerIds) {
    const curData = workerPayoutsCur.get(id);
    const prevData = workerPayoutsPrev.get(id);
    const worker = curData?.worker || prevData?.worker;
    if (!worker) continue;

    const curPayout = curData?.payout || 0;
    const prevPayout = prevData?.payout || 0;
    const curDays = curData?.days || 0;
    const prevDays = prevData?.days || 0;

    const diff = curPayout - prevPayout;
    const pct = prevPayout > 0 ? (diff / prevPayout) * 100 : curPayout > 0 ? 100 : 0;
    const workerAttendancePct = curDaysInMonth > 0 ? Math.min(100, (curDays / curDaysInMonth) * 100) : 0;

    totalCurrentPayout += curPayout;
    totalPreviousPayout += prevPayout;
    totalCurrentWorkingDays += curDays;
    totalPreviousWorkingDays += prevDays;

    // Worker MoM list
    workerMomList.push({
      id: worker.id,
      name: worker.name || 'Unknown Worker',
      employeeCode: worker.employeeCode,
      unit: worker.unit || 'General',
      designation: (worker.designation || 'WORKER').toUpperCase().trim(),
      currentPayout: curPayout,
      previousPayout: prevPayout,
      difference: diff,
      percentChange: pct,
      currentWorkingDays: curDays,
      previousWorkingDays: prevDays,
      attendancePercentage: workerAttendancePct,
      avgDailyPayout: curDaysInMonth > 0 ? curPayout / curDaysInMonth : 0,
    });

    // Unit aggregation
    const unitName = worker.unit || 'General';
    let uStats = unitMap.get(unitName);
    if (!uStats) {
      uStats = { curPayout: 0, prevPayout: 0, curDays: 0, prevDays: 0, count: 0 };
      unitMap.set(unitName, uStats);
    }
    uStats.curPayout += curPayout;
    uStats.prevPayout += prevPayout;
    uStats.curDays += curDays;
    uStats.prevDays += prevDays;
    if (curData) {
      uStats.count += 1;
    }

    // Designation aggregation
    const desigName = (worker.designation || 'WORKER').toUpperCase().trim();
    let dStats = desigMap.get(desigName);
    if (!dStats) {
      dStats = { curPayout: 0, prevPayout: 0, curDays: 0, prevDays: 0, count: 0 };
      desigMap.set(desigName, dStats);
    }
    dStats.curPayout += curPayout;
    dStats.prevPayout += prevPayout;
    dStats.curDays += curDays;
    dStats.prevDays += prevDays;
    if (curData) {
      dStats.count += 1;
    }
  }

  const totalDifference = totalCurrentPayout - totalPreviousPayout;
  const totalPercentChange = totalPreviousPayout > 0 ? (totalDifference / totalPreviousPayout) * 100 : totalCurrentPayout > 0 ? 100 : 0;
  const curHeadcount = curWorkerMap.size;
  const totalAvailableDays = curHeadcount * curDaysInMonth;
  const overallAttendancePercentage = totalAvailableDays > 0 ? Math.min(100, (totalCurrentWorkingDays / totalAvailableDays) * 100) : 0;

  const avgDailyPlantPayout = curDaysInMonth > 0 ? totalCurrentPayout / curDaysInMonth : 0;
  const avgDailyPlantWorkingDays = curDaysInMonth > 0 ? totalCurrentWorkingDays / curDaysInMonth : 0;

  // Convert raw daily structures to final DailyAnalytics array
  const dailyAnalytics: DailyAnalytics[] = Array.from(dailyRawMap.values()).map((raw) => {
    const unitBreakdown: DailyUnitStats[] = Array.from(raw.unitMap.entries()).map(([unit, s]) => ({
      unit,
      presentCount: s.presentCount,
      workingDays: s.workingDays,
      payout: s.payout,
    })).sort((a, b) => b.payout - a.payout);

    const designationBreakdown: DailyDesignationStats[] = Array.from(raw.desigMap.entries()).map(([designation, s]) => ({
      designation,
      presentCount: s.presentCount,
      workingDays: s.workingDays,
      payout: s.payout,
    })).sort((a, b) => b.payout - a.payout);

    return {
      day: raw.day,
      dateKey: raw.dateKey,
      dayOfWeekIndex: raw.dayOfWeekIndex,
      totalPresent: raw.totalPresent,
      totalWorkingDays: raw.totalWorkingDays,
      totalPayout: raw.totalPayout,
      unitBreakdown,
      designationBreakdown,
      workerDetails: raw.workerDetails.sort((a, b) => b.payout - a.payout),
    };
  });

  const units: UnitAnalytics[] = Array.from(unitMap.entries()).map(([unit, s]) => {
    const diff = s.curPayout - s.prevPayout;
    const unitAvailableDays = s.count * curDaysInMonth;
    const unitAttPct = unitAvailableDays > 0 ? Math.min(100, (s.curDays / unitAvailableDays) * 100) : 0;
    return {
      unit,
      currentPayout: s.curPayout,
      previousPayout: s.prevPayout,
      difference: diff,
      percentChange: s.prevPayout > 0 ? (diff / s.prevPayout) * 100 : 0,
      currentManDays: s.curDays,
      previousManDays: s.prevDays,
      workerCount: s.count,
      attendancePercentage: unitAttPct,
      avgDailyPayout: curDaysInMonth > 0 ? s.curPayout / curDaysInMonth : 0,
      avgDailyManDays: curDaysInMonth > 0 ? s.curDays / curDaysInMonth : 0,
    };
  }).sort((a, b) => b.currentPayout - a.currentPayout);

  const designations: DesignationAnalytics[] = Array.from(desigMap.entries()).map(([designation, s]) => {
    const diff = s.curPayout - s.prevPayout;
    const pctChange = s.prevPayout > 0 ? (diff / s.prevPayout) * 100 : s.curPayout > 0 ? 100 : 0;
    const daysDiff = s.curDays - s.prevDays;
    const totalAvail = s.count * curDaysInMonth;
    const attPct = totalAvail > 0 ? Math.min(100, (s.curDays / totalAvail) * 100) : 0;
    const avgDays = s.count > 0 ? s.curDays / s.count : 0;

    return {
      designation,
      currentPayout: s.curPayout,
      previousPayout: s.prevPayout,
      difference: diff,
      percentChange: pctChange,
      workerCount: s.count,
      currentWorkingDays: s.curDays,
      previousWorkingDays: s.prevDays,
      daysDifference: daysDiff,
      totalAvailableDays: totalAvail,
      attendancePercentage: attPct,
      avgDaysPerWorker: avgDays,
      avgDailyPayout: curDaysInMonth > 0 ? s.curPayout / curDaysInMonth : 0,
      avgDailyWorkingDays: curDaysInMonth > 0 ? s.curDays / curDaysInMonth : 0,
    };
  }).sort((a, b) => b.currentWorkingDays - a.currentWorkingDays);

  return {
    currentMonthKey: curMonthKey,
    previousMonthKey: prevMonthKey,
    daysInCurrentMonth: curDaysInMonth,
    daysInPreviousMonth: prevDaysInMonth,
    totalCurrentPayout,
    totalPreviousPayout,
    totalDifference,
    totalPercentChange,
    totalCurrentWorkingDays,
    totalPreviousWorkingDays,
    totalAvailableDays,
    overallAttendancePercentage,
    avgDailyPlantPayout,
    avgDailyPlantWorkingDays,
    dailyAnalytics,
    units,
    designations,
    workers: workerMomList.sort((a, b) => b.currentPayout - a.currentPayout),
  };
}
