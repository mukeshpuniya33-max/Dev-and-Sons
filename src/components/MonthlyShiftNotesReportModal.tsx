import React, { useState, useMemo, useRef } from 'react';
import { X, Printer, FileText, Search, Clock, Calendar, Flame, CheckCircle, ShieldAlert, Eye } from 'lucide-react';
import { Worker, AttendanceDatabase } from '../types/attendance';
import { parseAttendanceCode } from '../utils/attendanceCalculator';
import { printElementDirect } from '../utils/printHelper';

interface MonthlyShiftNotesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  workers: Worker[];
  attendanceDb: AttendanceDatabase;
  dayNotes?: Record<number, string>;
  contractorName?: string;
}

export interface ShiftNoteEntry {
  workerId: string;
  workerName: string;
  designation: string;
  unit: string;
  day: number;
  dateStr: string;
  code: string;
  otHours: number;
  shift1Reason: string;
  shift2Reason: string;
  shift3Reason: string;
  shift1Type?: 'Day' | 'Night';
  shift2Type?: 'Day' | 'Night';
  shift3Type?: 'Day' | 'Night';
  combinedReason: string;
}

export const MonthlyShiftNotesReportModal: React.FC<MonthlyShiftNotesReportModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  workers,
  attendanceDb,
  dayNotes = {},
  contractorName = 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  // Extract all OT and shift task reason entries for current month
  const otEntries = useMemo<ShiftNoteEntry[]>(() => {
    const list: ShiftNoteEntry[] = [];
    if (!Array.isArray(workers)) return list;

    workers.forEach((worker) => {
      if (!worker || !worker.id) return;
      const workerRecords = attendanceDb[worker.id]?.[monthKey] || {};

      Object.keys(workerRecords).forEach((dayStr) => {
        const day = Number(dayStr);
        if (isNaN(day) || day < 1 || day > 31) return;

        const record = workerRecords[day] as any;
        if (!record) return;

        let code = '';
        let s1Reason = '';
        let s2Reason = '';
        let s3Reason = '';
        let otReason = '';
        let s1Type: 'Day' | 'Night' = 'Day';
        let s2Type: 'Day' | 'Night' = 'Night';
        let s3Type: 'Day' | 'Night' = 'Night';

        if (typeof record === 'object' && record !== null) {
          if (record.isDeleted || record.status === 'cleared') return;
          code = String(record.attendance || record.status || '').trim();
          s1Reason = record.shift1Reason ? String(record.shift1Reason).trim() : '';
          s2Reason = record.shift2Reason ? String(record.shift2Reason).trim() : '';
          s3Reason = record.shift3Reason ? String(record.shift3Reason).trim() : '';
          s1Type = record.shift1Type || 'Day';
          s2Type = record.shift2Type || 'Night';
          s3Type = record.shift3Type || 'Night';
          otReason = record.otReason ? String(record.otReason).trim() : '';
        } else {
          code = String(record).trim();
        }

        const parsed = parseAttendanceCode(code);
        const hasShiftReasons = Boolean(s1Reason || s2Reason || s3Reason || otReason);

        // Include entry if it has any shift task reason or if overtime hours > 0
        if (hasShiftReasons || parsed.hours > 0) {
          const combinedParts: string[] = [];
          if (s1Reason) combinedParts.push(`Shift 1 (${s1Type} Shift): ${s1Reason}`);
          if (s2Reason) combinedParts.push(`Shift 2 (${s2Type} Shift): ${s2Reason}`);
          if (s3Reason) combinedParts.push(`Shift 3 (${s3Type} Shift): ${s3Reason}`);
          if (!s1Reason && !s2Reason && !s3Reason && otReason) combinedParts.push(otReason);

          list.push({
            workerId: worker.id,
            workerName: worker.name || 'Worker',
            designation: worker.designation || 'STAFF',
            unit: worker.unit || 'Furnace A',
            day,
            dateStr: `${day} ${monthName} ${year}`,
            code: code || 'P4',
            otHours: parsed.hours,
            shift1Reason: s1Reason,
            shift2Reason: s2Reason,
            shift3Reason: s3Reason,
            shift1Type: s1Type,
            shift2Type: s2Type,
            shift3Type: s3Type,
            combinedReason: combinedParts.join(' | ') || (parsed.hours > 0 ? `${parsed.hours} Hours Overtime` : 'Overtime Duty'),
          });
        }
      });
    });

    return list.sort((a, b) => a.day - b.day || a.workerName.localeCompare(b.workerName));
  }, [workers, attendanceDb, monthKey, monthName, year]);

  // Filtered OT Entries
  const filteredEntries = useMemo(() => {
    return otEntries.filter((item) => {
      let matchUnit = true;
      if (selectedUnit !== 'All') {
        matchUnit = item.unit === selectedUnit;
      }
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        item.workerName.toLowerCase().includes(q) ||
        item.designation.toLowerCase().includes(q) ||
        item.combinedReason.toLowerCase().includes(q);
      return matchUnit && matchSearch;
    });
  }, [otEntries, selectedUnit, searchQuery]);

  // Active day notes for current month
  const activeDayNotesList = useMemo(() => {
    const list: { day: number; dateStr: string; note: string }[] = [];
    Object.keys(dayNotes).forEach((dayStr) => {
      const day = Number(dayStr);
      const note = dayNotes[day];
      if (!isNaN(day) && note && typeof note === 'string' && note.trim()) {
        list.push({
          day,
          dateStr: `${day} ${monthName} ${year}`,
          note: note.trim(),
        });
      }
    });
    return list.sort((a, b) => a.day - b.day);
  }, [dayNotes, monthName, year]);

  if (!isOpen) return null;

  // Print function (Isolated direct print)
  const handlePrint = async () => {
    if (!contentRef.current) return;
    await printElementDirect(
      contentRef.current,
      'portrait',
      `${monthName} ${year} Shift Notes Register - ${contractorName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn modal-print-active print:static print:inset-auto print:block print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/70 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Monthly Overtime &amp; Shift Notes Register
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Month: <strong className="text-indigo-600 dark:text-indigo-400">{monthName} {year}</strong> • {contractorName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Print Preview</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Notes Register</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Unit:</span>
            {['All', 'Furnace A', 'Furnace B', 'CCM'].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setSelectedUnit(u)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedUnit === u
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search worker or reason..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div ref={contentRef} className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Plant Day Notes & Shutdown Reasons */}
          {activeDayNotesList.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-3">
              <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Plant Shutdown &amp; Day Maintenance Notes ({monthName} {year})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {activeDayNotesList.map((dn) => (
                  <div
                    key={dn.day}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 shadow-2xs flex flex-col"
                  >
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      Date: {dn.dateStr}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {dn.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Worker Overtime & Shift Reason Log */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Worker Overtime &amp; Special Shift Task Reasons ({filteredEntries.length} Records)
              </span>
              <span className="text-[11px] text-slate-500">
                Detailed Shift 1, Shift 2 &amp; Shift 3 Notes (Day / Night Shift)
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto text-lg font-bold">
                  📝
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Shift or OT Notes Recorded
                </h4>
                <p className="text-xs text-slate-500">
                  Zero overtime or shift reasons were entered for {monthName} {year} in this filter view.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 border-b border-r border-slate-200 dark:border-slate-700">Date</th>
                      <th className="py-2.5 px-3 border-b border-r border-slate-200 dark:border-slate-700">Worker &amp; Role</th>
                      <th className="py-2.5 px-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-center">Unit</th>
                      <th className="py-2.5 px-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-center">Shift Code</th>
                      <th className="py-2.5 px-2.5 border-b border-r border-slate-200 dark:border-slate-700 text-center">OT Hrs</th>
                      <th className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-700">Shift Task &amp; Overtime Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredEntries.map((entry, idx) => (
                      <tr key={`${entry.workerId}_${entry.day}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          Day {entry.day} ({entry.dateStr.split(' ')[1]} {entry.day})
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">
                          <div className="font-bold text-slate-900 dark:text-white">{entry.workerName}</div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">{entry.designation}</div>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {entry.unit}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {entry.code}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {entry.otHours > 0 ? `${entry.otHours}h` : '-'}
                        </td>
                        <td className="py-2 px-4 space-y-1.5">
                          {entry.shift1Reason && (
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                {entry.shift1Type === 'Night' ? 'Shift 1 (Night Shift)' : 'Shift 1 (Day Shift)'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.shift1Reason}</span>
                            </div>
                          )}
                          {entry.shift2Reason && (
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                {entry.shift2Type === 'Day' ? 'Shift 2 (Day Shift)' : 'Shift 2 (Night Shift)'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.shift2Reason}</span>
                            </div>
                          )}
                          {entry.shift3Reason && (
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                {entry.shift3Type === 'Day' ? 'Shift 3 (Day Shift)' : 'Shift 3 (Night Shift)'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.shift3Reason}</span>
                            </div>
                          )}
                          {!entry.shift1Reason && !entry.shift2Reason && !entry.shift3Reason && (
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {entry.combinedReason}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Total OT / Task Entries for {monthName} {year}: <strong className="text-slate-900 dark:text-white">{filteredEntries.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-all cursor-pointer"
          >
            Close Register
          </button>
        </div>
      </div>

      {/* Print Preview Modal Overlay */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold">Print Preview (100% Fidelity)</h4>
                  <p className="text-xs text-slate-300">
                    Shift Notes &amp; Overtime Register preview. Zero toolbars included.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 space-y-4">
              <div className="p-4 rounded-xl border-2 border-black bg-white space-y-4">
                <div className="text-center pb-2 border-b border-black">
                  <h3 className="text-sm font-black uppercase text-black">{contractorName}</h3>
                  <h4 className="text-xs font-bold text-black">Monthly Overtime &amp; Shift Notes Register ({monthName} {year})</h4>
                </div>

                <div className="border border-black rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-black font-bold">
                      <tr>
                        <th className="py-2.5 px-3 border border-black">Date</th>
                        <th className="py-2.5 px-3 border border-black">Worker &amp; Role</th>
                        <th className="py-2.5 px-2.5 border border-black text-center">Unit</th>
                        <th className="py-2.5 px-2.5 border border-black text-center">Code</th>
                        <th className="py-2.5 px-2.5 border border-black text-center">OT Hrs</th>
                        <th className="py-2.5 px-4 border border-black">Shift Task &amp; Overtime Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black bg-white">
                      {filteredEntries.map((entry, idx) => (
                        <tr key={idx} className="border-b border-black">
                          <td className="py-2 px-3 border border-black font-bold text-black whitespace-nowrap">Day {entry.day}</td>
                          <td className="py-2 px-3 border border-black text-black">
                            <div className="font-bold">{entry.workerName}</div>
                            <div className="text-[10px] uppercase">{entry.designation}</div>
                          </td>
                          <td className="py-2 px-2.5 border border-black text-center font-bold text-black">{entry.unit}</td>
                          <td className="py-2 px-2.5 border border-black text-center font-mono font-bold text-black">{entry.code}</td>
                          <td className="py-2 px-2.5 border border-black text-center font-bold text-black">{entry.otHours > 0 ? `${entry.otHours}h` : '-'}</td>
                          <td className="py-2 px-4 border border-black text-black">{entry.combinedReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
