import { AttendanceCalculation, Worker, DesignationPeriod, DesignationSplitBreakdown, PlantUnit } from '../types/attendance';

/**
 * Parses any attendance code like:
 * - "P4" -> 1 day, 0 hrs
 * - "P4(4)" -> 1 day, 4 hrs
 * - "P4(12)" -> 1 day, 12 hrs
 * - "P4 + P4" -> 2 days, 0 hrs
 * - "P4(4) + P4(6)" -> 2 days, 10 hrs
 * - "P4 + P4 + P4" -> 3 days, 0 hrs
 * - "P4(4) + P4(4) + P4(4)" -> 3 days, 12 hrs
 * - "A" or "Absent" -> 0 days, 0 hrs
 * - "WO" or "Weekly Off" -> 0 days, 0 hrs
 * - "HD" or "Half Day" -> 0.5 days, 0 hrs
 */
export function parseAttendanceCode(code: unknown): {
  days: number;
  hours: number;
  isAbsent: boolean;
  isWeeklyOff: boolean;
  isHalfDay: boolean;
} {
  if (code === null || code === undefined) {
    return { days: 0, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
  }

  let rawStr = '';
  if (typeof code === 'object' && code !== null) {
    const entry = code as Record<string, any>;
    if (entry.isDeleted === true || entry.status === 'cleared') {
      return { days: 0, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
    }
    rawStr = String(entry.attendance || entry.status || entry.code || '').trim();
  } else {
    rawStr = String(code).trim();
  }

  const clean = rawStr.toUpperCase();
  if (!clean || clean === 'CLEARED' || clean === '__DELETED__') {
    return { days: 0, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
  }

  // Handle plain numbers or numeric strings
  if (clean === '1' || clean === 'P' || clean === 'PRESENT') {
    return { days: 1, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
  }
  if (clean === '0' || clean === 'A' || clean === 'ABSENT') {
    return { days: 0, hours: 0, isAbsent: true, isWeeklyOff: false, isHalfDay: false };
  }
  if (clean === '0.5' || clean === 'HD' || clean === 'HALF DAY' || clean === 'HALFDAY') {
    return { days: 0.5, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: true };
  }
  if (clean === 'WO' || clean === 'OFF' || clean === 'WEEKLY OFF' || clean === 'WEEKLYOFF') {
    return { days: 0, hours: 0, isAbsent: false, isWeeklyOff: true, isHalfDay: false };
  }

  // Split multiple shifts connected by '+'
  const parts = clean.split('+');
  let days = 0;
  let hours = 0;

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;

    // Pattern: T4(H), P4(H), T(H) or P(H) where H is 1 to 12
    const withHoursMatch = p.match(/^(?:T|P)\s*4?\s*\(\s*(\d+)\s*\)$/i);
    if (withHoursMatch) {
      days += 1;
      const h = parseInt(withHoursMatch[1], 10);
      if (!isNaN(h)) {
        hours += h;
      }
      continue;
    }

    // Pattern: T4, P4, T, or P (standard single shift = 1 working day)
    const standardMatch = p.match(/^(?:T|P)\s*4?$/i);
    if (standardMatch) {
      days += 1;
      continue;
    }

    // Pattern: direct hours like "(6)" or "6H"
    const directHours = p.match(/^\(?\s*(\d+)\s*H?\)?$/i);
    if (directHours) {
      const h = parseInt(directHours[1], 10);
      if (!isNaN(h)) {
        hours += h;
      }
      continue;
    }
  }

  return { days, hours, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
}

/**
 * Resolves which designation, unit, and monthly salary applies to a worker on a specific day of the month.
 */
export function getWorkerActiveDesignation(
  worker: {
    designation?: string;
    unit?: PlantUnit;
    salary?: number;
    designationPeriods?: DesignationPeriod[];
  },
  day: number,
  monthKey?: string
): {
  designation: string;
  unit: PlantUnit;
  salary: number;
  periodId?: string;
  isTransferred: boolean;
  startDay: number;
  endDay: number;
  notes?: string;
} {
  const defaultRes = {
    designation: (worker.designation || 'WORKER').toUpperCase(),
    unit: (worker.unit || 'Furnace A') as PlantUnit,
    salary: worker.salary && worker.salary > 0 ? worker.salary : 26000,
    isTransferred: false,
    startDay: 1,
    endDay: 31,
    notes: undefined as string | undefined,
  };

  if (!worker.designationPeriods || !Array.isArray(worker.designationPeriods) || worker.designationPeriods.length === 0) {
    return defaultRes;
  }

  // Filter periods applicable to this month
  const applicablePeriods = worker.designationPeriods.filter((p) => {
    if (p.monthKey && monthKey && p.monthKey !== monthKey) return false;
    return true;
  });

  const matched = applicablePeriods.find((p) => day >= p.startDay && day <= p.endDay);
  if (matched) {
    const isTransferred =
      matched.designation.toUpperCase() !== defaultRes.designation ||
      matched.salary !== defaultRes.salary ||
      matched.unit !== defaultRes.unit;

    return {
      designation: matched.designation.toUpperCase(),
      unit: (matched.unit || defaultRes.unit) as PlantUnit,
      salary: matched.salary > 0 ? matched.salary : defaultRes.salary,
      periodId: matched.id,
      isTransferred,
      startDay: matched.startDay,
      endDay: matched.endDay,
      notes: matched.notes,
    };
  }

  return defaultRes;
}

/**
 * Calculates monthly working days, overtime hours conversion (12 hours = 1 day),
 * and total payout salary based on the monthly salary and days in month.
 * Resilient to argument order and supports mid-month designation splits.
 */
export function calculateWorkerMonthlyAttendance(
  attendanceRecords: Record<number, any> | undefined,
  arg2: number | Worker,
  arg3?: number,
  argMonthKey?: string
): AttendanceCalculation {
  let monthlySalary = 26000;
  let totalDaysInMonth = 31;
  let workerObj: Worker | undefined = undefined;

  if (typeof arg2 === 'object' && arg2 !== null) {
    workerObj = arg2;
    monthlySalary = workerObj.salary || 26000;
    if (typeof arg3 === 'number') {
      totalDaysInMonth = arg3;
    }
  } else if (typeof arg3 === 'number') {
    // If one is > 366 (or > 31), it is definitely monthlySalary
    if (arg2 > 366 || (arg3 <= 31 && arg2 > arg3)) {
      monthlySalary = arg2;
      totalDaysInMonth = arg3;
    } else {
      monthlySalary = arg3;
      totalDaysInMonth = arg2;
    }
  } else {
    monthlySalary = Number(arg2) || 26000;
  }

  // Ensure totalDaysInMonth is at least 1 and capped between 28 and 31
  if (totalDaysInMonth <= 0 || totalDaysInMonth > 31) {
    totalDaysInMonth = 31;
  }
  if (monthlySalary < 0) {
    monthlySalary = 0;
  }

  // Check if this worker has mid-month designation transfers
  const hasPeriods = Boolean(
    workerObj?.designationPeriods &&
    Array.isArray(workerObj.designationPeriods) &&
    workerObj.designationPeriods.length > 0
  );

  let baseWorkingDays = 0;
  let totalExtraHours = 0;
  let presentDaysCount = 0;
  let absentDaysCount = 0;
  let weeklyOffDaysCount = 0;

  // Track per-day parsed attendance
  const dayStats: Record<number, { days: number; hours: number; isAbsent: boolean; isWeeklyOff: boolean; isHalfDay: boolean }> = {};

  if (attendanceRecords) {
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const code = attendanceRecords[day];
      if (!code) {
        dayStats[day] = { days: 0, hours: 0, isAbsent: false, isWeeklyOff: false, isHalfDay: false };
        continue;
      }

      const parsed = parseAttendanceCode(code);
      dayStats[day] = parsed;

      if (parsed.isAbsent) {
        absentDaysCount++;
      } else if (parsed.isWeeklyOff) {
        weeklyOffDaysCount++;
      } else if (parsed.isHalfDay) {
        presentDaysCount++;
        baseWorkingDays += 0.5;
      } else if (parsed.days > 0 || parsed.hours > 0) {
        presentDaysCount++;
        baseWorkingDays += parsed.days;
        totalExtraHours += parsed.hours;
      }
    }
  }

  // Calculate overall converted days and payout
  const convertedDaysFromHours = Math.floor(totalExtraHours / 12);
  const remainingHours = totalExtraHours % 12;
  const totalWorkingDays = baseWorkingDays + convertedDaysFromHours;
  const totalEquivalentDaysWithFraction = totalWorkingDays + (remainingHours / 12);

  const perDayRate = totalDaysInMonth > 0 ? monthlySalary / totalDaysInMonth : 0;
  const perHourRate = perDayRate / 12;
  let payoutSalary = perDayRate * totalEquivalentDaysWithFraction;

  let splitBreakdown: DesignationSplitBreakdown[] | undefined = undefined;
  let hasSplitDesignation = false;

  if (hasPeriods && workerObj) {
    // Collect all applicable periods for this month
    const periods = (workerObj.designationPeriods || []).filter((p) => {
      if (p.monthKey && argMonthKey && p.monthKey !== argMonthKey) return false;
      return true;
    });

    if (periods.length > 0) {
      // Build distinct intervals spanning the days
      // Let's sort periods by startDay
      const sortedPeriods = [...periods].sort((a, b) => a.startDay - b.startDay);

      // We partition days 1..totalDaysInMonth into intervals
      const intervalList: Array<{
        id: string;
        designation: string;
        unit: PlantUnit;
        salary: number;
        startDay: number;
        endDay: number;
        notes?: string;
      }> = [];

      let currentDay = 1;
      for (const p of sortedPeriods) {
        const pStart = Math.max(1, Math.min(totalDaysInMonth, p.startDay));
        const pEnd = Math.max(pStart, Math.min(totalDaysInMonth, p.endDay));

        // If there is an uncovered gap before this period
        if (currentDay < pStart) {
          intervalList.push({
            id: `primary-${currentDay}-${pStart - 1}`,
            designation: workerObj.designation.toUpperCase(),
            unit: workerObj.unit,
            salary: workerObj.salary,
            startDay: currentDay,
            endDay: pStart - 1,
            notes: 'Primary Designation Assignment',
          });
        }

        intervalList.push({
          id: p.id || `period-${pStart}-${pEnd}`,
          designation: p.designation.toUpperCase(),
          unit: p.unit || workerObj.unit,
          salary: p.salary > 0 ? p.salary : workerObj.salary,
          startDay: pStart,
          endDay: pEnd,
          notes: p.notes,
        });

        currentDay = pEnd + 1;
      }

      // If days remain at the end
      if (currentDay <= totalDaysInMonth) {
        intervalList.push({
          id: `primary-${currentDay}-${totalDaysInMonth}`,
          designation: workerObj.designation.toUpperCase(),
          unit: workerObj.unit,
          salary: workerObj.salary,
          startDay: currentDay,
          endDay: totalDaysInMonth,
          notes: 'Primary Designation Assignment',
        });
      }

      // Check if we actually have different roles or salaries across intervals
      const hasVariation =
        intervalList.length > 1 ||
        intervalList.some(
          (iv) =>
            iv.designation !== workerObj!.designation.toUpperCase() ||
            iv.salary !== workerObj!.salary
        );

      if (hasVariation) {
        hasSplitDesignation = true;
        let cumulativePayout = 0;

        splitBreakdown = intervalList.map((iv) => {
          let pBaseWorkingDays = 0;
          let pTotalExtraHours = 0;
          let pPresentDays = 0;
          let pAbsentDays = 0;
          let pWeeklyOffDays = 0;

          for (let d = iv.startDay; d <= iv.endDay; d++) {
            const stats = dayStats[d];
            if (!stats) continue;

            if (stats.isAbsent) {
              pAbsentDays++;
            } else if (stats.isWeeklyOff) {
              pWeeklyOffDays++;
            } else if (stats.isHalfDay) {
              pPresentDays++;
              pBaseWorkingDays += 0.5;
            } else if (stats.days > 0 || stats.hours > 0) {
              pPresentDays++;
              pBaseWorkingDays += stats.days;
              pTotalExtraHours += stats.hours;
            }
          }

          const pConvertedDays = Math.floor(pTotalExtraHours / 12);
          const pRemainingHours = pTotalExtraHours % 12;
          const pTotalWorkingDays = pBaseWorkingDays + pConvertedDays;
          const pEquivalentDays = pTotalWorkingDays + (pRemainingHours / 12);

          const pDayRate = totalDaysInMonth > 0 ? iv.salary / totalDaysInMonth : 0;
          const pHourRate = pDayRate / 12;
          const pPayout = Math.round(pDayRate * pEquivalentDays * 100) / 100;

          cumulativePayout += pPayout;

          return {
            id: iv.id,
            designation: iv.designation,
            unit: iv.unit,
            monthlySalary: iv.salary,
            perDayRate: Math.round(pDayRate * 100) / 100,
            perHourRate: Math.round(pHourRate * 100) / 100,
            startDay: iv.startDay,
            endDay: iv.endDay,
            baseWorkingDays: pBaseWorkingDays,
            totalExtraHours: pTotalExtraHours,
            convertedDaysFromHours: pConvertedDays,
            remainingHours: pRemainingHours,
            totalWorkingDays: pTotalWorkingDays,
            totalEquivalentDays: Math.round(pEquivalentDays * 100) / 100,
            periodPayoutSalary: pPayout,
            presentDaysCount: pPresentDays,
            absentDaysCount: pAbsentDays,
            weeklyOffDaysCount: pWeeklyOffDays,
            notes: iv.notes,
          };
        });

        // Use the exact sum of the split periods as the net payout salary
        payoutSalary = Math.round(cumulativePayout * 100) / 100;
      }
    }
  }

  const safeEquivalent = isNaN(totalEquivalentDaysWithFraction) ? 0 : Math.max(0, Math.round(totalEquivalentDaysWithFraction * 100) / 100);
  const safePayout = isNaN(payoutSalary) ? 0 : Math.max(0, Math.round(payoutSalary * 100) / 100);
  const safePerDay = isNaN(perDayRate) ? 0 : Math.max(0, Math.round(perDayRate * 100) / 100);
  const safePerHour = isNaN(perHourRate) ? 0 : Math.max(0, Math.round(perHourRate * 100) / 100);

  return {
    totalDaysInMonth,
    baseWorkingDays: isNaN(baseWorkingDays) ? 0 : baseWorkingDays,
    totalExtraHours: isNaN(totalExtraHours) ? 0 : totalExtraHours,
    convertedDaysFromHours: isNaN(convertedDaysFromHours) ? 0 : convertedDaysFromHours,
    remainingHours: isNaN(remainingHours) ? 0 : remainingHours,
    totalWorkingDays: isNaN(totalWorkingDays) ? 0 : totalWorkingDays,
    totalEquivalentDaysWithFraction: safeEquivalent,
    monthlySalary: isNaN(monthlySalary) ? 0 : monthlySalary,
    perDayRate: safePerDay,
    perHourRate: safePerHour,
    payoutSalary: safePayout,
    presentDaysCount: isNaN(presentDaysCount) ? 0 : presentDaysCount,
    absentDaysCount: isNaN(absentDaysCount) ? 0 : absentDaysCount,
    weeklyOffDaysCount: isNaN(weeklyOffDaysCount) ? 0 : weeklyOffDaysCount,
    hasSplitDesignation,
    splitBreakdown,
  };
}

/**
 * Returns the number of days in a given year and month (1-indexed month, 1 = Jan, 10 = Oct).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formats a currency amount into standard localized Indian Rupees / standard format.
 */
export function formatCurrency(amount: unknown): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : (typeof amount === 'string' ? parseFloat(amount) || 0 : 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${Math.round(num)}`;
  }
}

/**
 * Calculates a person's exact age in years and days from a YYYY-MM-DD birthdate string relative to today.
 */
export function calculateAge(dobString: string | undefined): { years: number; days: number; text: string } | null {
  if (!dobString || !dobString.trim()) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let birthDateThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  
  if (today < birthDateThisYear) {
    years--;
    birthDateThisYear = new Date(today.getFullYear() - 1, dob.getMonth(), dob.getDate());
  }
  
  const diffTime = Math.abs(today.getTime() - birthDateThisYear.getTime());
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    years,
    days,
    text: `${years} Years, ${days} Days`,
  };
}
