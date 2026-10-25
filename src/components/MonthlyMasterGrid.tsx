import React, { useState } from 'react';
import { Worker, AttendanceCalculation } from '../types/attendance';
import { formatCurrency, parseAttendanceCode, getWorkerActiveDesignation } from '../utils/attendanceCalculator';
import {
  User,
  Flame,
  MoreVertical,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  DollarSign,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Printer,
  FileText,
} from 'lucide-react';

interface MonthlyMasterGridProps {
  workers: Worker[];
  daysInMonth: number;
  year: number;
  month: number;
  attendanceData: Record<string, Record<number, string>>; // workerId -> day -> code
  calculations: Record<string, AttendanceCalculation>; // workerId -> calc
  onCellClick: (worker: Worker, day: number) => void;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (workerId: string) => void;
  onSelectWorkerForLedger: (worker: Worker) => void;
  onMoveWorkerUp?: (index: number) => void;
  onMoveWorkerDown?: (index: number) => void;
  onOpenReorderModal?: () => void;
  dayNotes?: Record<number, string>;
  onDayHeaderClick?: (day: number) => void;
  onOpenColorfulExport?: () => void;
}

export const MonthlyMasterGrid: React.FC<MonthlyMasterGridProps> = ({
  workers,
  daysInMonth,
  year,
  month,
  attendanceData,
  calculations,
  onCellClick,
  onEditWorker,
  onDeleteWorker,
  onSelectWorkerForLedger,
  onMoveWorkerUp,
  onMoveWorkerDown,
  onOpenReorderModal,
  dayNotes,
  onDayHeaderClick,
  onOpenColorfulExport,
}) => {
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);

  // Days array: 1 to daysInMonth (e.g. 1 to 31)
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Helper to get day of week abbreviation
  const getDayOfWeek = (day: number) => {
    const d = new Date(year, month - 1, day);
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return { name: dayNames[d.getDay()], isSunday: d.getDay() === 0 };
  };

  // Helper to style attendance badges
  const getBadgeStyle = (code: string | undefined) => {
    if (!code) return 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-dashed border-slate-200 dark:border-slate-800';
    const parsed = parseAttendanceCode(code);
    if (parsed.isAbsent) return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold border-rose-300';
    if (parsed.isWeeklyOff) return 'bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold border-slate-300';
    if (parsed.isHalfDay) return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border-amber-300';
    if (parsed.days >= 3) return 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-bold border-purple-300';
    if (parsed.days >= 2) return 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold border-blue-300';
    if (parsed.hours > 0) return 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold border-amber-300';
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border-emerald-300';
  };

  // Helper to render multi-shift / multi-code entries cleanly without overlapping
  const renderAttendanceBadges = (code: unknown) => {
    let strCode = '';
    let shift1Reason = '';
    let shift2Reason = '';
    let shift3Reason = '';
    let otReason = '';

    let shift1Type = 'Day';
    let shift2Type = 'Night';
    let shift3Type = 'Night';

    if (typeof code === 'object' && code !== null) {
      const record = code as any;
      strCode = String(record.attendance || record.status || '').trim();
      shift1Reason = record.shift1Reason ? String(record.shift1Reason).trim() : '';
      shift2Reason = record.shift2Reason ? String(record.shift2Reason).trim() : '';
      shift3Reason = record.shift3Reason ? String(record.shift3Reason).trim() : '';
      shift1Type = record.shift1Type || 'Day';
      shift2Type = record.shift2Type || 'Night';
      shift3Type = record.shift3Type || 'Night';
      otReason = record.otReason ? String(record.otReason).trim() : '';
    } else {
      strCode = code === null || code === undefined ? '' : String(code).trim();
    }

    if (!strCode) return <span className="text-slate-300 dark:text-slate-700 font-bold">-</span>;
    const tokens = strCode.split(/[\+,/]/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return <span className="text-xs">{strCode}</span>;

    // Combine all reasons for cell tooltip
    const reasonParts: string[] = [];
    if (shift1Reason) reasonParts.push(`1st Shift (${shift1Type} Shift): ${shift1Reason}`);
    if (shift2Reason) reasonParts.push(`2nd Shift (${shift2Type} Shift): ${shift2Reason}`);
    if (shift3Reason) reasonParts.push(`3rd Shift (${shift3Type} Shift): ${shift3Reason}`);
    if (!shift1Reason && !shift2Reason && !shift3Reason && otReason) {
      reasonParts.push(`OT Task: ${otReason}`);
    }
    const combinedTooltip = reasonParts.join(' | ');

    return (
      <div className="flex flex-col items-center justify-center gap-1 w-full py-0.5 relative">
        {tokens.map((token, idx) => {
          let tokenReason = '';
          if (idx === 0 && shift1Reason) tokenReason = `1st Shift (${shift1Type} Shift): ${shift1Reason}`;
          else if (idx === 1 && shift2Reason) tokenReason = `2nd Shift (${shift2Type} Shift): ${shift2Reason}`;
          else if (idx === 2 && shift3Reason) tokenReason = `3rd Shift (${shift3Type} Shift): ${shift3Reason}`;
          else if (combinedTooltip) tokenReason = combinedTooltip;

          return (
            <span
              key={idx}
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-tight whitespace-nowrap overflow-visible border max-w-full text-center shadow-xs transition-transform ${getBadgeStyle(
                token
              )}`}
              title={tokenReason ? `${token} (${tokenReason})` : token}
            >
              {token}
            </span>
          );
        })}
        {combinedTooltip && (
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900 pointer-events-none"
            title={combinedTooltip}
          />
        )}
      </div>
    );
  };

  return (

      <div
        className="flex-1 overflow-x-auto overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs touch-pan-x touch-pan-y overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
      <table className="w-full text-xs text-left border-collapse select-none">
        {/* Table Header */}
        <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-30 shadow-xs">
          <tr>
            {/* Shift Order / Action Header */}
            <th className="py-2.5 px-1.5 sticky left-0 z-40 bg-slate-100 dark:bg-slate-800 w-[48px] min-w-[48px] border-b border-r border-slate-200 dark:border-slate-700 text-center font-bold">
              {onOpenReorderModal ? (
                <button
                  type="button"
                  onClick={onOpenReorderModal}
                  title="Shift and Reorder Workers"
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center mx-auto transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              ) : (
                '#'
              )}
            </th>

            {/* Pinned Left Columns with precise offsets matching body cells */}
            <th className="py-2 px-3 sticky left-[48px] z-40 bg-slate-100 dark:bg-slate-800 min-w-[200px] border-b border-r border-slate-200 dark:border-slate-700 font-bold">
              <div className="flex items-center justify-between gap-1">
                <span>Worker &amp; Designation</span>
                {onOpenColorfulExport && (
                  <button
                    type="button"
                    onClick={onOpenColorfulExport}
                    className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs border border-emerald-300 cursor-pointer"
                    title="Download entire monthly table in colorful format with all shift badges (PDF / Image / HTML)"
                  >
                    <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Download Colorful Table</span>
                  </button>
                )}
              </div>
            </th>
            <th className="py-2.5 px-2.5 sticky left-[248px] z-40 bg-slate-100 dark:bg-slate-800 min-w-[90px] border-b border-r border-slate-200 dark:border-slate-700 font-bold text-center">
              Unit
            </th>
            <th className="py-2.5 px-3 sticky left-[338px] z-40 bg-slate-100 dark:bg-slate-800 min-w-[120px] border-b border-r border-slate-200 dark:border-slate-700 font-bold text-right shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
              <div className="leading-tight">
                <span>Monthly</span>
                <br />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Salary (₹)</span>
              </div>
            </th>

            {/* Date Columns: 1 to 31 */}
            {daysArray.map((day) => {
              const { name: dow, isSunday } = getDayOfWeek(day);
              const dayNote = dayNotes?.[day];
              const hasActiveNote = Boolean(dayNote && typeof dayNote === 'string' && dayNote.trim() !== '');

              return (
                <th
                  key={day}
                  onClick={() => onDayHeaderClick && onDayHeaderClick(day)}
                  title={hasActiveNote ? `Day ${day} (${dow}) - Note: ${dayNote} (Click to edit/clear)` : `Day ${day} (${dow}) - Click to set day event note`}
                  className={`py-1.5 px-1 min-w-[42px] max-w-[46px] text-center border-b border-r border-slate-200 dark:border-slate-700 font-semibold cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors relative ${
                    isSunday ? 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : ''
                  }`}
                >
                  <div className="text-[10px] text-slate-400 uppercase leading-none">{dow}</div>
                  <div className="text-xs font-bold mt-0.5">{day}</div>
                  {hasActiveNote ? (
                    <span
                      className="block mt-0.5 text-[8px] font-extrabold tracking-tight uppercase px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate max-w-[42px] mx-auto shadow-2xs"
                      title={dayNote}
                    >
                      {dayNote!.length > 6 ? dayNote!.substring(0, 5) + '..' : dayNote}
                    </span>
                  ) : null}
                </th>
              );
            })}

            {/* Calculated Summary Columns */}
            <th className="py-2.5 px-2 min-w-[65px] text-center border-b border-r border-slate-200 dark:border-slate-700 font-bold bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
              Shift Days
            </th>
            <th className="py-2.5 px-2 min-w-[65px] text-center border-b border-r border-slate-200 dark:border-slate-700 font-bold bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              Extra OT (H)
            </th>
            <th className="py-2.5 px-2 min-w-[75px] text-center border-b border-r border-slate-200 dark:border-slate-700 font-bold bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              Total Days
            </th>
            <th className="py-2.5 px-2.5 min-w-[110px] text-right border-b border-slate-200 dark:border-slate-700 font-bold bg-emerald-50/60 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
              Payout Salary (₹)
            </th>
            <th className="py-2.5 px-2 text-center border-b border-slate-200 dark:border-slate-700 min-w-[65px]">
              Action
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {workers.length === 0 && (
            <tr>
              <td colSpan={daysInMonth + 6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center text-lg font-bold">
                    🔥
                  </div>
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    No worker is here
                  </p>
                  <p className="text-xs text-slate-400">
                    There are zero workers in this unit/search selection.
                  </p>
                </div>
              </td>
            </tr>
          )}
          {workers.map((worker, index) => {
            const workerAttendance = attendanceData[worker.id] || {};
            const calc = calculations[worker.id] || {
              baseWorkingDays: 0,
              totalExtraHours: 0,
              convertedDaysFromHours: 0,
              remainingHours: 0,
              totalWorkingDays: 0,
              totalEquivalentDaysWithFraction: 0,
              payoutSalary: 0,
              perDayRate: 0,
            };

            return (
              <tr
                key={worker.id}
                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                  index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-900/40'
                }`}
              >
                {/* Reorder Shift Up / Down Arrows (Pinned Left) */}
                <td className="py-1 px-1 sticky left-0 z-20 bg-inherit border-r border-slate-200 dark:border-slate-800 text-center w-[48px] min-w-[48px]">
                  <div className="flex flex-col items-center justify-center space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onMoveWorkerUp && onMoveWorkerUp(index)}
                      disabled={index === 0}
                      title="Shift worker UP into group"
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-slate-400 leading-none">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onMoveWorkerDown && onMoveWorkerDown(index)}
                      disabled={index === workers.length - 1}
                      title="Shift worker DOWN"
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </td>

                {/* Worker Name & Designation (Pinned) */}
                <td className="py-2 px-3 sticky left-[48px] z-20 bg-inherit border-r border-slate-200 dark:border-slate-800 min-w-[200px]">
                  <div
                    onClick={() => onSelectWorkerForLedger(worker)}
                    className="cursor-pointer group"
                    title="Click to view worker payslip and daily attendance"
                  >
                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <span>{worker?.name || 'Worker'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {worker?.designation || 'STAFF'}
                      </span>
                      {calc.hasSplitDesignation && (
                        <span className="text-[8.5px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300">
                          🔄 {calc.splitBreakdown?.length} Roles
                        </span>
                      )}
                      {worker?.employeeCode && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                          {worker.employeeCode}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Unit (Pinned) */}
                <td className="py-2 px-2 sticky left-[248px] z-20 bg-inherit border-r border-slate-200 dark:border-slate-800 text-center min-w-[90px]">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      worker?.unit === 'Furnace A'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                        : worker?.unit === 'Furnace B'
                        ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/80 dark:text-orange-300'
                        : worker?.unit === 'Furnace A + Furnace B'
                        ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 font-bold'
                        : 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300'
                    }`}
                  >
                    {worker?.unit || 'General'}
                  </span>
                </td>

                {/* Monthly Base Salary (Pinned with shadow & border) */}
                <td className="py-2 px-3 sticky left-[338px] z-20 bg-inherit border-r border-slate-200 dark:border-slate-800 text-right font-mono font-semibold text-slate-700 dark:text-slate-300 min-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {formatCurrency(worker?.salary || 0)}
                </td>

                {/* Attendance Date Cells (1 to 31) with Anti-Overlap Multi-Shift Support */}
                {daysArray.map((day) => {
                  const code = workerAttendance[day];
                  const { isSunday } = getDayOfWeek(day);
                  const activeRole = getWorkerActiveDesignation(worker, day, `${year}-${String(month).padStart(2, '0')}`);

                  return (
                    <td
                      key={day}
                      onClick={() => onCellClick(worker, day)}
                      className={`py-1 px-1 min-w-[46px] max-w-[54px] text-center border-b border-r border-slate-200 dark:border-slate-800 cursor-pointer transition-colors align-middle ${
                        isSunday ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <div
                        className="w-full min-h-[36px] px-0.5 py-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                        title={`Day ${day} (${worker?.name || 'Worker'}) - Role: ${activeRole.designation} (₹${activeRole.salary.toLocaleString('en-IN')}/m): Click to change attendance`}
                      >
                        {renderAttendanceBadges(code)}
                        {activeRole.isTransferred && (
                          <span
                            className="text-[7.5px] font-extrabold px-1 py-0.1 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 leading-none truncate max-w-[44px]"
                            title={`Transferred Post: ${activeRole.designation} @ ₹${activeRole.salary.toLocaleString('en-IN')}/m`}
                          >
                            {activeRole.designation.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}

                {/* Summary Cells */}
                <td className="py-2 px-2 text-center border-b border-r border-slate-200 dark:border-slate-800 font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10 min-w-[65px]">
                  {calc?.baseWorkingDays ?? 0}
                </td>
                <td className="py-2 px-2 text-center border-b border-r border-slate-200 dark:border-slate-800 font-bold font-mono text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10 min-w-[65px]">
                  {(calc?.totalExtraHours ?? 0) > 0 ? `${calc.totalExtraHours}h` : '-'}
                </td>
                <td className="py-2 px-2 text-center border-b border-r border-slate-200 dark:border-slate-800 font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/10 min-w-[75px]" title={`${calc?.totalWorkingDays ?? 0} days + ${calc?.remainingHours ?? 0} hrs`}>
                  {(calc?.totalEquivalentDaysWithFraction ?? 0).toFixed(1)}
                </td>
                <td className="py-2 px-2.5 text-right border-b border-r border-slate-200 dark:border-slate-800 font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20 min-w-[110px]">
                  {formatCurrency(calc?.payoutSalary ?? 0)}
                </td>
                <td className="py-2 px-2 text-center border-b border-slate-200 dark:border-slate-800 min-w-[65px]">
                  <div className="flex items-center justify-center space-x-1">
                    <button
                      type="button"
                      onClick={() => onEditWorker(worker)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit worker details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkerToDelete(worker)}
                      className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete worker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Delete Confirmation Modal */}
      {workerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-rose-200 dark:border-rose-900/60 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Delete Worker?
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
                "{workerToDelete.name}"
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                This worker will be removed from this month's register but will remain in your Master Directory.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWorkerToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteWorker(workerToDelete.id);
                  setWorkerToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
