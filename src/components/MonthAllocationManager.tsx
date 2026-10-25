import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Calendar,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Worker, MonthlyAllocationDatabase, PlantUnit } from '../types/attendance';
import {
  isWorkerExcludedInMonth,
  excludeWorkerFromMonth,
  includeWorkerInMonth,
} from '../utils/monthAllocationEngine';

interface MonthAllocationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  masterWorkers: Worker[];
  initialYear: number;
  initialMonth: number;
  monthlyAllocationDb: MonthlyAllocationDatabase;
  onSaveAllocation: (updatedAllocationDb: MonthlyAllocationDatabase, targetMonthKey: string) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthAllocationManager: React.FC<MonthAllocationManagerProps> = ({
  isOpen,
  onClose,
  masterWorkers,
  initialYear,
  initialMonth,
  monthlyAllocationDb,
  onSaveAllocation,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');

  // Local copy of allocation database for fast, offline-first manipulation before saving/syncing
  const [localAllocationDb, setLocalAllocationDb] =
    useState<MonthlyAllocationDatabase>(monthlyAllocationDb);

  // Sync incoming props if open
  React.useEffect(() => {
    setLocalAllocationDb(monthlyAllocationDb);
  }, [monthlyAllocationDb, isOpen]);

  const targetMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const targetMonthName = MONTH_NAMES[selectedMonth - 1];

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Only consider active, non-permanently-deleted master workers
  const eligibleMasterWorkers = useMemo(() => {
    return masterWorkers.filter((w) => !w.isDeleted && w.status !== 'inactive');
  }, [masterWorkers]);

  // Filtered workers list for UI view
  const displayedWorkers = useMemo(() => {
    return eligibleMasterWorkers.filter((w) => {
      // Unit filter
      if (selectedUnit !== 'All') {
        if (selectedUnit === 'Both Furnaces') {
          if (w.unit !== 'Furnace A' && w.unit !== 'Furnace B') return false;
        } else if (w.unit !== selectedUnit) {
          return false;
        }
      }

      // Joining date check: if worker was added in a later month, they cannot be allocated earlier
      if (w.addedInMonthKey && w.addedInMonthKey > targetMonthKey) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchName = w.name.toLowerCase().includes(query);
        const matchRole = w.designation.toLowerCase().includes(query);
        const matchCode = (w.employeeCode || '').toLowerCase().includes(query);
        if (!matchName && !matchRole && !matchCode) return false;
      }

      return true;
    });
  }, [eligibleMasterWorkers, selectedUnit, targetMonthKey, searchQuery]);

  // Statistics for current month
  const stats = useMemo(() => {
    let includedCount = 0;
    let excludedCount = 0;

    eligibleMasterWorkers.forEach((w) => {
      if (w.addedInMonthKey && w.addedInMonthKey > targetMonthKey) return;
      const isExcluded = isWorkerExcludedInMonth(localAllocationDb, w.id, targetMonthKey);
      if (isExcluded) {
        excludedCount++;
      } else {
        includedCount++;
      }
    });

    return { includedCount, excludedCount, total: includedCount + excludedCount };
  }, [eligibleMasterWorkers, localAllocationDb, targetMonthKey]);

  // Toggle single worker
  const handleToggleWorker = (workerId: string) => {
    const isCurrentlyExcluded = isWorkerExcludedInMonth(localAllocationDb, workerId, targetMonthKey);
    let updatedDb: MonthlyAllocationDatabase;

    if (isCurrentlyExcluded) {
      updatedDb = includeWorkerInMonth(localAllocationDb, workerId, targetMonthKey).updatedDb;
    } else {
      updatedDb = excludeWorkerFromMonth(localAllocationDb, workerId, targetMonthKey).updatedDb;
    }

    setLocalAllocationDb(updatedDb);
    onSaveAllocation(updatedDb, targetMonthKey);
  };

  // Bulk actions for current month
  const handleIncludeAllDisplayed = () => {
    let currentDb = { ...localAllocationDb };
    displayedWorkers.forEach((w) => {
      currentDb = includeWorkerInMonth(currentDb, w.id, targetMonthKey).updatedDb;
    });
    setLocalAllocationDb(currentDb);
    onSaveAllocation(currentDb, targetMonthKey);
  };

  const handleExcludeAllDisplayed = () => {
    let currentDb = { ...localAllocationDb };
    displayedWorkers.forEach((w) => {
      currentDb = excludeWorkerFromMonth(currentDb, w.id, targetMonthKey).updatedDb;
    });
    setLocalAllocationDb(currentDb);
    onSaveAllocation(currentDb, targetMonthKey);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Selective Month Allocation
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  {targetMonthName} {selectedYear}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exclude or include workers for <span className="font-semibold text-slate-700 dark:text-slate-300">{targetMonthName}</span> without modifying the Master Directory or other months.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector Bar & Stats */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          
          {/* Month Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold text-sm text-slate-800 dark:text-slate-100 min-w-[130px] text-center">
              {targetMonthName} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{stats.includedCount} Included</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 font-bold">
              <XCircle className="w-4 h-4" />
              <span>{stats.excludedCount} Excluded</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <Users className="w-4 h-4" />
              <span>{stats.total} Total Master</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by worker name, role, or ID..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Unit Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {['All', 'Furnace A', 'Furnace B', 'CCM'].map((unit) => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  selectedUnit === unit
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          {/* Quick Bulk Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleIncludeAllDisplayed}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              Include All
            </button>
            <button
              onClick={handleExcludeAllDisplayed}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
            >
              Exclude All
            </button>
          </div>
        </div>

        {/* Worker List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-slate-100 dark:divide-slate-800">
          {displayedWorkers.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No workers match this filter or search query</p>
              <p className="text-xs text-slate-400 mt-1">Try switching plant unit or clearing search.</p>
            </div>
          ) : (
            displayedWorkers.map((worker) => {
              const isExcluded = isWorkerExcludedInMonth(localAllocationDb, worker.id, targetMonthKey);

              return (
                <div
                  key={worker.id}
                  className={`py-3.5 px-3 sm:px-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-200 ${
                    isExcluded
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isExcluded
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {worker.name}
                        </span>
                        {worker.employeeCode && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {worker.employeeCode}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isExcluded
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {isExcluded ? 'Excluded this Month' : 'Included'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {worker.designation}
                        </span>
                        <span>•</span>
                        <span>{worker.unit}</span>
                        <span>•</span>
                        <span>₹{worker.salary.toLocaleString('en-IN')}/mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleWorker(worker.id)}
                      className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                        !isExcluded ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={!isExcluded}
                    >
                      <span className="sr-only">Toggle inclusion</span>
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          !isExcluded ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & Done Button */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Excluding a worker here only hides them from <b>{targetMonthName} {selectedYear}</b>. Master profiles and attendance in other months are 100% protected.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all"
          >
            Done & Apply
          </button>
        </div>

      </div>
    </div>
  );
};
