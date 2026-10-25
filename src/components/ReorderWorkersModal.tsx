import React, { useState } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Check,
  Search,
  ArrowUpDown,
  Flame,
  Briefcase,
  Users,
  DollarSign,
  Filter,
} from 'lucide-react';
import { Worker, CCM_DESIGNATIONS, FURNACE_DESIGNATIONS } from '../types/attendance';

interface ReorderWorkersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  onSaveWorkerOrder: (reorderedWorkers: Worker[]) => void;
  initialUnit?: string;
}

export const ReorderWorkersModal: React.FC<ReorderWorkersModalProps> = ({
  isOpen,
  onClose,
  workers,
  onSaveWorkerOrder,
  initialUnit = 'All',
}) => {
  const [list, setList] = useState<Worker[]>(workers);
  const [activeUnitTab, setActiveUnitTab] = useState<string>(initialUnit);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setList([...workers]);
      setSelectedWorkerId(null);
      if (initialUnit) {
        setActiveUnitTab(initialUnit);
      }
    }
  }, [isOpen, workers, initialUnit]);

  if (!isOpen) return null;

  // Items visible under current tab/filter
  const visibleItems = list
    .map((worker, originalIndex) => ({ worker, originalIndex }))
    .filter(({ worker }) => {
      let matchUnit = true;
      if (activeUnitTab === 'All') {
        matchUnit = true;
      } else if (activeUnitTab === 'Both Furnaces (A + B)') {
        matchUnit = worker.unit === 'Furnace A' || worker.unit === 'Furnace B';
      } else {
        matchUnit = worker.unit === activeUnitTab;
      }
      const matchSearch =
        filterQuery === '' ||
        worker.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        worker.designation.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (worker.employeeCode && worker.employeeCode.toLowerCase().includes(filterQuery.toLowerCase()));
      return matchUnit && matchSearch;
    });

  // Move worker UP relative to current view
  const handleMoveUp = (filteredIdx: number) => {
    if (filteredIdx <= 0 || filteredIdx >= visibleItems.length) return;
    const current = visibleItems[filteredIdx].worker;
    const prev = visibleItems[filteredIdx - 1].worker;

    const copy = [...list];
    const currentIdx = copy.findIndex((w) => w.id === current.id);
    const prevIdx = copy.findIndex((w) => w.id === prev.id);
    if (currentIdx === -1 || prevIdx === -1) return;

    const [moved] = copy.splice(currentIdx, 1);
    const targetIdx = copy.findIndex((w) => w.id === prev.id);
    copy.splice(targetIdx, 0, moved);

    const now = Date.now();
    setList(copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Move worker DOWN relative to current view
  const handleMoveDown = (filteredIdx: number) => {
    if (filteredIdx < 0 || filteredIdx >= visibleItems.length - 1) return;
    const current = visibleItems[filteredIdx].worker;
    const next = visibleItems[filteredIdx + 1].worker;

    const copy = [...list];
    const currentIdx = copy.findIndex((w) => w.id === current.id);
    const nextIdx = copy.findIndex((w) => w.id === next.id);
    if (currentIdx === -1 || nextIdx === -1) return;

    const [moved] = copy.splice(currentIdx, 1);
    const targetIdx = copy.findIndex((w) => w.id === next.id);
    copy.splice(targetIdx + 1, 0, moved);

    const now = Date.now();
    setList(copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Move to Top of current view
  const handleMoveToTop = (filteredIdx: number) => {
    if (filteredIdx <= 0) return;
    const current = visibleItems[filteredIdx].worker;
    const first = visibleItems[0].worker;

    const copy = [...list];
    const currentIdx = copy.findIndex((w) => w.id === current.id);
    if (currentIdx === -1) return;

    const [moved] = copy.splice(currentIdx, 1);
    const targetIdx = copy.findIndex((w) => w.id === first.id);
    copy.splice(targetIdx, 0, moved);

    const now = Date.now();
    setList(copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Move to Bottom of current view
  const handleMoveToBottom = (filteredIdx: number) => {
    if (filteredIdx >= visibleItems.length - 1) return;
    const current = visibleItems[filteredIdx].worker;
    const last = visibleItems[visibleItems.length - 1].worker;

    const copy = [...list];
    const currentIdx = copy.findIndex((w) => w.id === current.id);
    if (currentIdx === -1) return;

    const [moved] = copy.splice(currentIdx, 1);
    const targetIdx = copy.findIndex((w) => w.id === last.id);
    copy.splice(targetIdx + 1, 0, moved);

    const now = Date.now();
    setList(copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Sort A to Z
  const handleSortAtoZ = () => {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    const now = Date.now();
    setList(sorted.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Sort Z to A
  const handleSortZtoA = () => {
    const sorted = [...list].sort((a, b) => b.name.localeCompare(a.name));
    const now = Date.now();
    setList(sorted.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Auto Group by Designation (CCM roles + Furnace roles)
  const handleGroupByDesignation = () => {
    const desHierarchy = [...FURNACE_DESIGNATIONS, ...CCM_DESIGNATIONS];
    const grouped = [...list].sort((a, b) => {
      const idxA = desHierarchy.indexOf(a.designation.toUpperCase() as any);
      const idxB = desHierarchy.indexOf(b.designation.toUpperCase() as any);
      const rankA = idxA !== -1 ? idxA : 999;
      const rankB = idxB !== -1 ? idxB : 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
    const now = Date.now();
    setList(grouped.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Auto Group by Plant Unit (Furnace A, Furnace B, CCM)
  const handleGroupByUnit = () => {
    const unitOrder: Record<string, number> = {
      'Furnace A': 1,
      'Furnace B': 2,
      CCM: 3,
    };
    const grouped = [...list].sort((a, b) => {
      const orderA = unitOrder[a.unit] || 99;
      const orderB = unitOrder[b.unit] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.designation.localeCompare(b.designation);
    });
    const now = Date.now();
    setList(grouped.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  // Sort by Salary High to Low
  const handleSortSalaryHighToLow = () => {
    const sorted = [...list].sort((a, b) => b.salary - a.salary);
    const now = Date.now();
    setList(sorted.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now })));
  };

  const handleSave = () => {
    const now = Date.now();
    const indexed = list.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now }));
    onSaveWorkerOrder(indexed);
    onClose();
  };

  const unitTabs = [
    { id: 'All', label: 'All Staff' },
    { id: 'CCM', label: 'CCM Unit' },
    { id: 'Furnace A', label: 'Furnace A' },
    { id: 'Furnace B', label: 'Furnace B' },
    { id: 'Both Furnaces (A + B)', label: 'Furnaces (A + B)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Shift &amp; Reorder Staff (SORT BY)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Move workers up/down, sort alphabetically, or group by CCM/Furnace role
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unit Filter Tabs Strip */}
        <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center space-x-1">
            {unitTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveUnitTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeUnitTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search name..."
              className="pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none w-full"
            />
          </div>
        </div>

        {/* Smart 1-Click SORT BY Buttons Strip */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-1">
            SORT BY:
          </span>
          <button
            type="button"
            onClick={handleSortAtoZ}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all active:scale-95"
          >
            A &rarr; Z (Name)
          </button>
          <button
            type="button"
            onClick={handleSortZtoA}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all active:scale-95"
          >
            Z &rarr; A (Name)
          </button>
          <button
            type="button"
            onClick={handleGroupByDesignation}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all active:scale-95"
          >
            <Briefcase className="w-3 h-3 text-indigo-500" />
            <span>Role / Designation</span>
          </button>
          <button
            type="button"
            onClick={handleGroupByUnit}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all active:scale-95"
          >
            <Flame className="w-3 h-3 text-amber-500" />
            <span>Plant Unit</span>
          </button>
          <button
            type="button"
            onClick={handleSortSalaryHighToLow}
            className="py-1 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all active:scale-95"
          >
            <DollarSign className="w-3 h-3 text-emerald-500" />
            <span>Salary (High &rarr; Low)</span>
          </button>
        </div>

        {/* Worker Reorder List */}
        <div className="p-4 overflow-y-auto space-y-1.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {visibleItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No workers found matching the current unit or search filter.
            </div>
          ) : (
            visibleItems.map(({ worker }, filteredIdx) => {
              const isSelected = selectedWorkerId === worker.id;
              return (
                <div
                  key={worker.id}
                  onClick={() => setSelectedWorkerId(worker.id)}
                  className={`py-2 px-3 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-500 shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {/* Index & Worker Info */}
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
                      {filteredIdx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {worker.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            worker.unit === 'Furnace A'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : worker.unit === 'Furnace B'
                              ? 'bg-orange-50 text-orange-800 border-orange-200'
                              : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          }`}
                        >
                          {worker.unit}
                        </span>
                        {worker.employeeCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                            {worker.employeeCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wide uppercase">
                        {worker.designation} &bull; ₹{worker.salary.toLocaleString('en-IN')}/mo
                      </div>
                    </div>
                  </div>

                  {/* Shifting Buttons (Move relative to current filtered tab) */}
                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleMoveUp(filteredIdx)}
                      disabled={filteredIdx === 0}
                      title="Shift Up (▲)"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(filteredIdx)}
                      disabled={filteredIdx === visibleItems.length - 1}
                      title="Shift Down (▼)"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveToTop(filteredIdx)}
                      disabled={filteredIdx === 0}
                      title="Move straight to Top"
                      className="px-2 py-1 rounded-xl text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveToBottom(filteredIdx)}
                      disabled={filteredIdx === visibleItems.length - 1}
                      title="Move straight to Bottom"
                      className="px-2 py-1 rounded-xl text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                    >
                      Bottom
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-semibold">
            {list.length} Staff Workers &bull; Permanently Saved
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Apply &amp; Save Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
