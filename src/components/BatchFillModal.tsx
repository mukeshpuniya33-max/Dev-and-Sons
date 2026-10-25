import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  FastForward,
  Calendar,
  Users,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import { Worker } from '../types/attendance';

interface BatchFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  daysInMonth: number;
  year: number;
  month: number;
  currentAttendance?: Record<string, Record<number, string>>;
  onApplyBatch: (targetWorkerIds: string[], days: number[], code: string) => void;
  onApplyIndividualBatch?: (updates: { workerId: string; day: number; code: string }[]) => void;
}

const COMMON_CODES = [
  { code: 'P4', label: 'P4 (1 Day)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { code: 'P4(4)', label: 'P4(4) (1D+4h)', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { code: 'P4(6)', label: 'P4(6) (1D+6h)', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { code: 'P4 + P4', label: 'P4+P4 (2 Days)', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { code: 'WO', label: 'WO (Weekly Off)', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { code: 'A', label: 'A (Absent)', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { code: '', label: 'Clear', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export const BatchFillModal: React.FC<BatchFillModalProps> = ({
  isOpen,
  onClose,
  workers,
  daysInMonth,
  year,
  month,
  currentAttendance = {},
  onApplyBatch,
  onApplyIndividualBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'date_roster' | 'preset_fills'>('date_roster');
  
  // Date-wise roster states
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDate();
    return today <= daysInMonth ? today : 1;
  });
  const [dateSearchQuery, setDateSearchQuery] = useState<string>('');
  const [dateUnitFilter, setDateUnitFilter] = useState<string>('all');
  const [workerAttendanceState, setWorkerAttendanceState] = useState<Record<string, string>>({});

  // Preset fills states
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [fillAction, setFillAction] = useState<'sundays_wo' | 'all_days_p4' | 'single_day'>('sundays_wo');
  const [presetTargetDay, setPresetTargetDay] = useState<number>(1);
  const [selectedCode, setSelectedCode] = useState<string>('P4');

  // Load current attendance when modal opens or selectedDay changes
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      (workers || []).forEach((w) => {
        if (w?.id) {
          const existingCode = currentAttendance?.[w.id]?.[selectedDay] || '';
          initial[w.id] = existingCode;
        }
      });
      setWorkerAttendanceState(initial);
    }
  }, [isOpen, selectedDay, workers, currentAttendance]);

  if (!isOpen) return null;

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Filter workers for Date-Wise Roster
  const filteredDateWorkers = (workers || []).filter((w) => {
    if (!w || !w.id) return false;
    if (dateUnitFilter === 'Both Furnaces (A + B)' || dateUnitFilter === 'Furnaces A+B') {
      if (w.unit !== 'Furnace A' && w.unit !== 'Furnace B') return false;
    } else if (dateUnitFilter !== 'all' && w.unit !== dateUnitFilter) {
      return false;
    }
    if (dateSearchQuery.trim() !== '') {
      const q = dateSearchQuery.toLowerCase().trim();
      const matchName = (w.name || '').toLowerCase().includes(q);
      const matchRole = (w.designation || '').toLowerCase().includes(q);
      const matchCode = (w.employeeCode || '').toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchCode) return false;
    }
    return true;
  });

  const handleSetWorkerCode = (workerId: string, code: string) => {
    setWorkerAttendanceState((prev) => ({
      ...prev,
      [workerId]: code,
    }));
  };

  const handleSetAllForDay = (code: string) => {
    setWorkerAttendanceState((prev) => {
      const next = { ...prev };
      filteredDateWorkers.forEach((w) => {
        next[w.id] = code;
      });
      return next;
    });
  };

  const handleSubmitDateAttendance = () => {
    if (onApplyIndividualBatch) {
      const updates = filteredDateWorkers.map((w) => ({
        workerId: w.id,
        day: selectedDay,
        code: workerAttendanceState[w.id] ?? '',
      }));
      onApplyIndividualBatch(updates);
    } else {
      // Fallback: group by code and call onApplyBatch
      const codeGroups: Record<string, string[]> = {};
      filteredDateWorkers.forEach((w) => {
        const code = workerAttendanceState[w.id] ?? '';
        if (!codeGroups[code]) codeGroups[code] = [];
        codeGroups[code].push(w.id);
      });

      Object.entries(codeGroups).forEach(([code, ids]) => {
        if (ids.length > 0) {
          onApplyBatch(ids, [selectedDay], code);
        }
      });
    }

    onClose();
  };

  const handleApplyPreset = () => {
    const targetWorkers = selectedUnit === 'all'
      ? workers
      : (selectedUnit === 'Both Furnaces (A + B)' || selectedUnit === 'Furnaces A+B')
      ? workers.filter((w) => w.unit === 'Furnace A' || w.unit === 'Furnace B')
      : workers.filter((w) => w.unit === selectedUnit);

    const targetIds = targetWorkers.map((w) => w.id);

    if (fillAction === 'sundays_wo') {
      const sundays: number[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month - 1, day);
        if (d.getDay() === 0) {
          sundays.push(day);
        }
      }
      onApplyBatch(targetIds, sundays, 'WO');
    } else if (fillAction === 'all_days_p4') {
      const allWorkingDays: number[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month - 1, day);
        if (d.getDay() !== 0) {
          allWorkingDays.push(day);
        }
      }
      onApplyBatch(targetIds, allWorkingDays, 'P4');
    } else if (fillAction === 'single_day') {
      onApplyBatch(targetIds, [presetTargetDay], selectedCode);
    }

    onClose();
  };

  // Check if selectedDay is a Sunday
  const selectedDateObj = new Date(year, month - 1, selectedDay);
  const isSelectedSunday = selectedDateObj.getDay() === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <FastForward className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Bulk Attendance Manager
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mark attendance date-wise for all workers or apply plant preset fills
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('date_roster')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'date_roster'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Date-Wise Bulk Attendance (Day 1..31)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preset_fills')}
            className={`pb-2.5 px-3 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'preset_fills'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Plant Preset Auto-Fills</span>
          </button>
        </div>

        {/* Tab 1: Date-Wise Bulk Attendance */}
        {activeTab === 'date_roster' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Date Selector Row */}
            <div className="p-4 bg-slate-100/70 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Select Date:
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    Day {selectedDay} {isSelectedSunday ? '(Sunday)' : ''}
                  </span>
                </div>

                {/* Quick set all */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Set All:</span>
                  <button
                    type="button"
                    onClick={() => handleSetAllForDay('P4')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                  >
                    All P4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllForDay('P4(6)')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100"
                  >
                    All P4(6)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllForDay('WO')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-300 hover:bg-cyan-100"
                  >
                    All WO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllForDay('A')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100"
                  >
                    All A
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllForDay('')}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Day badges 1..31 scrollable */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {daysArray.map((d) => {
                  const isSun = new Date(year, month - 1, d).getDay() === 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={`w-7 h-7 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                        d === selectedDay
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : isSun
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={dateSearchQuery}
                    onChange={(e) => setDateSearchQuery(e.target.value)}
                    placeholder="Search staff by name or role..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={dateUnitFilter}
                  onChange={(e) => setDateUnitFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  <option value="all">All Units</option>
                  <option value="Both Furnaces (A + B)">Furnace A + Furnace B</option>
                  <option value="Furnace A">Furnace A</option>
                  <option value="Furnace B">Furnace B</option>
                  <option value="CCM">CCM</option>
                </select>
              </div>
            </div>

            {/* Workers List Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredDateWorkers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No active workers found matching criteria.
                </div>
              ) : (
                filteredDateWorkers.map((w, idx) => {
                  const currentCode = workerAttendanceState[w.id] ?? '';
                  return (
                    <div
                      key={w.id}
                      className="p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-indigo-300 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 text-[10px] font-mono text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{w.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {w.unit}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {w.designation}
                          </div>
                        </div>
                      </div>

                      {/* Code Options */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {COMMON_CODES.map((item) => {
                          const isSelected = currentCode === item.code;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleSetWorkerCode(w.id, item.code)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-400'
                                  : `${item.color} hover:opacity-80`
                              }`}
                            >
                              {item.code || 'None'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Submit Bar */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Updating {filteredDateWorkers.length} active workers for Day {selectedDay}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitDateAttendance}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Save Date Attendance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Plant Preset Auto-Fills */}
        {activeTab === 'preset_fills' && (
          <div className="p-6 space-y-4 text-xs overflow-y-auto">
            {/* Target Unit */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Target Workers</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              >
                <option value="all">All Workers ({workers.length} staff)</option>
                <option value="Both Furnaces (A + B)">Furnace A + Furnace B</option>
                <option value="Furnace A">Furnace A only</option>
                <option value="Furnace B">Furnace B only</option>
                <option value="CCM">CCM only</option>
              </select>
            </div>

            {/* Action type */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Preset Fill Action</label>
              <div className="space-y-2">
                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="batchAction"
                    checked={fillAction === 'sundays_wo'}
                    onChange={() => setFillAction('sundays_wo')}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Mark all Sundays as Weekly Off (WO)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Automatically marks all Sunday dates in this month as WO
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="batchAction"
                    checked={fillAction === 'all_days_p4'}
                    onChange={() => setFillAction('all_days_p4')}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Mark all weekdays as Standard Shift (P4)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Fills Mon-Sat working days with P4 (1 day shift)
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="batchAction"
                    checked={fillAction === 'single_day'}
                    onChange={() => setFillAction('single_day')}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Fill specific single date with uniform code
                    </span>
                    {fillAction === 'single_day' && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-bold mb-1">Day</span>
                          <select
                            value={presetTargetDay}
                            onChange={(e) => setPresetTargetDay(parseInt(e.target.value, 10))}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                          >
                            {daysArray.map((d) => (
                              <option key={d} value={d}>
                                Day {d}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-bold mb-1">Code</span>
                          <select
                            value={selectedCode}
                            onChange={(e) => setSelectedCode(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold font-mono"
                          >
                            <option value="P4">P4 (1 Day)</option>
                            <option value="P4(4)">P4(4) (1D + 4h)</option>
                            <option value="P4(6)">P4(6) (1D + 6h)</option>
                            <option value="P4 + P4">P4 + P4 (2 Days)</option>
                            <option value="A">A (Absent)</option>
                            <option value="WO">WO (Weekly Off)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPreset}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                Apply Preset Fill
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
