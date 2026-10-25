import { Worker, AttendanceCalculation } from '../types/attendance';

export function exportAttendanceToCSV(
  workers: Worker[],
  daysInMonth: number,
  year: number,
  month: number,
  attendanceData: Record<string, Record<number, string>>,
  calculations: Record<string, AttendanceCalculation>
) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[month - 1];

  // Header row
  const headers = [
    'Worker Name',
    'Father Name',
    'Designation',
    'Unit',
    'Employee Code',
    'Mobile Number',
    'Aadhaar Number',
    'Address',
    'PAN Number',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Monthly Salary (INR)',
  ];

  for (let day = 1; day <= daysInMonth; day++) {
    headers.push(`Day ${day}`);
  }

  headers.push(
    'Base Shift Days',
    'Extra OT Hours',
    'Converted Days (12h=1D)',
    'Total Working Days',
    'Remaining Hours',
    'Equivalent Working Days',
    'Per Day Rate (INR)',
    'Payout Salary (INR)'
  );

  // Rows
  const rows = workers.map((w) => {
    const workerDays = attendanceData[w.id] || {};
    const calc = calculations[w.id] || {
      baseWorkingDays: 0,
      totalExtraHours: 0,
      convertedDaysFromHours: 0,
      totalWorkingDays: 0,
      remainingHours: 0,
      totalEquivalentDaysWithFraction: 0,
      perDayRate: 0,
      payoutSalary: 0,
    };

    const row = [
      `"${w.name}"`,
      `"${w.fatherName || ''}"`,
      `"${w.designation}"`,
      `"${w.unit}"`,
      `"${w.employeeCode || ''}"`,
      `"${w.phone || ''}"`,
      `"${w.aadharNumber || ''}"`,
      `"${w.address || ''}"`,
      `"${w.panNumber || ''}"`,
      `"${w.accountNumber || ''}"`,
      `"${w.ifscCode || ''}"`,
      `"${w.bankName || ''}"`,
      w.salary,
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      row.push(`"${workerDays[day] || ''}"`);
    }

    row.push(
      calc.baseWorkingDays,
      calc.totalExtraHours,
      calc.convertedDaysFromHours,
      calc.totalWorkingDays,
      calc.remainingHours,
      calc.totalEquivalentDaysWithFraction,
      calc.perDayRate,
      calc.payoutSalary
    );

    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Staff_Attendance_${monthName}_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
