import React, { useState, useMemo } from 'react';
import { Worker, AttendanceCalculation } from '../types/attendance';
import { formatCurrency, parseAttendanceCode } from '../utils/attendanceCalculator';
import {
  Users,
  Search,
  Calendar,
  Clock,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Flame,
  User,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';

interface SingleScreenWorkerOverviewProps {
  workers: Worker[];
  daysInMonth: number;
  year: number;
  month: number;
  monthName: string;
  attendanceData: Record<string, Record<number, string>>; // workerId -> day -> code
  calculations: Record<string, AttendanceCalculation>;
  onCellClick: (worker: Worker, day: number) => void;
  onSelectWorkerForLedger: (worker: Worker) => void;
}

export const SingleScreenWorkerOverview: React.FC<SingleScreenWorkerOverviewProps> = ({
  workers,
  daysInMonth,
  year,
  month,
  monthName,
  attendanceData,
  calculations,
  onCellClick,
  onSelectWorkerForLedger,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const filteredWorkers = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    return workers.filter((w) => {
      if (!w || !w.id) return false;
      const wUnit = w.unit || '';
      if (selectedUnit === 'All') {
        // match all
      } else if (selectedUnit === 'Furnace A + Furnace B' || selectedUnit === 'Both Furnaces (A + B)') {
        if (wUnit !== 'Furnace A' && wUnit !== 'Furnace B') return false;
      } else if (wUnit !== selectedUnit) {
        return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (w.name || '').toLowerCase().includes(q);
        const matchRole = (w.designation || '').toLowerCase().includes(q);
        const matchCode = (w.employeeCode || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchCode) return false;
      }
      return true;
    });
  }, [workers, selectedUnit, searchQuery]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 p-3 sm:p-6 space-y-4 overflow-y-auto">
      
      {/* Top Overview Header & Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Single-Screen Overview
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {monthName} {year}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compact fit-to-screen view. Tap any worker or punch attendance for <span className="font-bold text-indigo-600 dark:text-indigo-400">Day {selectedDay}</span>.
            </p>
          </div>
        </div>

        {/* Date Quick-Punch Bar (1..31) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
          <span className="text-xs font-extrabold text-slate-400 uppercase shrink-0">Punch Day:</span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            {daysArray.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`w-8 h-8 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer flex items-center justify-center ${
                  d === selectedDay
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search worker by name, role, or ID..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Furnace A', 'Furnace B', 'Furnace A + Furnace B', 'CCM'].map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setSelectedUnit(unit)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                selectedUnit === unit
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      {/* Worker Cards Grid (No-Scroll / Fit to Screen optimization) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {filteredWorkers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-500" />
            <p className="text-sm font-semibold">No workers match this filter or search query</p>
          </div>
        ) : (
          filteredWorkers.map((worker) => {
            const workerAttendance = attendanceData[worker.id] || {};
            const dayCode = workerAttendance[selectedDay];
            const calc = calculations[worker.id] || {
              totalEquivalentDaysWithFraction: 0,
              payoutSalary: 0,
              baseWorkingDays: 0,
            };

            return (
              <div
                key={worker.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between gap-3"
              >
                {/* Top Row: Name, Designation & Unit */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => onSelectWorkerForLedger(worker)}
                    className="cursor-pointer group min-w-0"
                  >
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                      {worker?.name || 'Worker'}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                        {worker?.designation || 'STAFF'}
                      </span>
                      {worker?.employeeCode && (
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                          {worker.employeeCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      worker?.unit === 'Furnace A'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : worker?.unit === 'Furnace B'
                        ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300'
                        : 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300'
                    }`}
                  >
                    {worker?.unit || 'General'}
                  </span>
                </div>

                {/* Middle Row: Quick Punch for Selected Day */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-750">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {selectedDay}
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Shift Punch:
                    </span>
                  </div>

                  {(() => {
                    const record = typeof dayCode === 'object' && dayCode !== null ? (dayCode as any) : null;
                    const strCode = record ? String(record.attendance || record.status || '').trim() : (dayCode ? String(dayCode).trim() : '');
                    const shiftType = record?.shift1Type || 'Day';

                    let colorStyle = 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200';
                    if (strCode) {
                      if (shiftType === 'Night') {
                        colorStyle = 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs';
                      } else {
                        colorStyle = 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs';
                      }
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => onCellClick(worker, selectedDay)}
                        className={`px-3 py-1 rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 cursor-pointer ${colorStyle}`}
                        title="Click to change shift code and Day/Night shift selection"
                      >
                        <span>{strCode || '+ Punch'}</span>
                      </button>
                    );
                  })()}
                </div>

                {/* Bottom Row: Summary & Ledger Link */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold">Total Days: </span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {(calc?.totalEquivalentDaysWithFraction ?? 0).toFixed(1)}d
                    </span>
                    <span className="mx-1 text-slate-300">•</span>
                    <span className="text-slate-400 font-semibold">Payout: </span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 font-mono">
                      {formatCurrency(calc?.payoutSalary ?? 0)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectWorkerForLedger(worker)}
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                  >
                    <span>Full Ledger</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
