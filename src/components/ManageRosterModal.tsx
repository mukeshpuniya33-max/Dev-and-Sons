import React, { useState } from 'react';
import {
  X,
  Search,
  Check,
  Plus,
  Users,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
  CheckSquare,
  Square,
  HelpCircle,
} from 'lucide-react';
import { Worker, PlantUnit, CCM_DESIGNATIONS, FURNACE_DESIGNATIONS } from '../types/attendance';
import { VoiceSearchInput } from './VoiceSearchInput';
import { useFieldSpeech } from '../hooks/useFieldSpeech';
import { VoiceMicButton } from './VoiceMicButton';

interface ManageRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  masterWorkers: Worker[];
  currentMonthWorkers: Worker[];
  onUpdateRoster: (selectedWorkers: Worker[]) => void;
  onAddWorkerToMaster: (worker: Worker) => void;
  onEditMasterWorker: (workerId: string, updatedData: Partial<Worker>, editGlobally: boolean) => void;
  onDeleteMasterWorker: (workerId: string) => void;
  onDeleteAllWorkers: () => void;
}

export const ManageRosterModal: React.FC<ManageRosterModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  masterWorkers,
  currentMonthWorkers,
  onUpdateRoster,
  onAddWorkerToMaster,
  onEditMasterWorker,
  onDeleteMasterWorker,
  onDeleteAllWorkers,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'roster' | 'master'>('roster');
  
  // States for adding new worker directly to Master Directory
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('MELTER');
  const [newUnit, setNewUnit] = useState<PlantUnit>('Furnace A');
  const [newSalary, setNewSalary] = useState<string>('26000');

  // States for editing a worker's name/details
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('');
  const [editUnit, setEditUnit] = useState<PlantUnit>('Furnace A');
  const [editSalary, setEditSalary] = useState<string>('');
  const [editGlobally, setEditGlobally] = useState<boolean>(false);

  // Confirmation dialog states (foolproof, replaces window.confirm for mobile/iframe safety)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [clearMonthConfirm, setClearMonthConfirm] = useState<boolean>(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState<boolean>(false);

  const {
    activeField,
    startListening,
  } = useFieldSpeech();

  if (!isOpen) return null;

  // Active status map for current selected month
  const activeIds = new Set(currentMonthWorkers.map((w) => w.id));

  const handleToggleWorker = (worker: Worker) => {
    let updatedList: Worker[];
    if (activeIds.has(worker.id)) {
      // Remove from this month
      updatedList = currentMonthWorkers.filter((w) => w.id !== worker.id);
    } else {
      // Add to this month
      const newWorker: Worker = {
        ...worker,
        orderIndex: currentMonthWorkers.length,
      };
      updatedList = [...currentMonthWorkers, newWorker];
    }
    onUpdateRoster(updatedList);
  };

  const handleSelectAll = () => {
    const updatedList = [...currentMonthWorkers];
    masterWorkers.forEach((mw) => {
      if (!activeIds.has(mw.id)) {
        updatedList.push({
          ...mw,
          orderIndex: updatedList.length,
        });
      }
    });
    onUpdateRoster(updatedList);
  };

  const handleDeselectAll = () => {
    setClearMonthConfirm(true);
  };

  const handleConfirmClearMonth = () => {
    onUpdateRoster([]);
    setClearMonthConfirm(false);
  };

  const handleConfirmDeleteAll = () => {
    onDeleteAllWorkers();
    setDeleteAllConfirm(false);
  };

  const handleAddNewMasterWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const salaryNum = parseFloat(newSalary) || 26000;
    
    const newWorker: Worker = {
      id: `w-${Date.now()}`,
      name: newName.trim(),
      designation: newRole.trim().toUpperCase(),
      unit: newUnit,
      salary: salaryNum,
      status: 'active',
    };

    onAddWorkerToMaster(newWorker);
    
    // Automatically apply to current month as well
    onUpdateRoster([...currentMonthWorkers, { ...newWorker, orderIndex: currentMonthWorkers.length }]);

    // Reset fields
    setNewName('');
    setNewSalary('26000');
    setIsAddingNew(false);
  };

  const handleStartEditing = (worker: Worker) => {
    setEditingWorker(worker);
    setEditName(worker.name);
    setEditRole(worker.designation);
    setEditUnit(worker.unit);
    setEditSalary(worker.salary.toString());
    setEditGlobally(true); // Default to global update
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker || !editName.trim()) return;

    const salaryNum = parseFloat(editSalary) || editingWorker.salary;
    const updatedData: Partial<Worker> = {
      name: editName.trim(),
      designation: editRole.trim().toUpperCase(),
      unit: editUnit,
      salary: salaryNum,
    };

    onEditMasterWorker(editingWorker.id, updatedData, editGlobally);
    
    setEditingWorker(null);
  };

  const handleDeleteMasterWorkerClick = (workerId: string, workerName: string) => {
    setDeleteConfirmTarget({ id: workerId, name: workerName });
  };

  const handleConfirmPermanentDelete = () => {
    if (!deleteConfirmTarget) return;
    const workerId = deleteConfirmTarget.id;
    // onDeleteMasterWorker already deletes from master, current month, all months, and cloud
    onDeleteMasterWorker(workerId);
    setDeleteConfirmTarget(null);
  };

  const filteredMaster = masterWorkers.filter((w) => {
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.designation.toLowerCase().includes(q) ||
      w.unit.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Manage Month Staff Roster
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Safely store all workers. Apply them selectively to <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{monthName} {year}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'roster'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>📅 Apply to {monthName} ({currentMonthWorkers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'master'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>👥 Master Directory Roster ({masterWorkers.length})</span>
          </button>
        </div>

        {/* Search & Actions Strip */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1">
            <VoiceSearchInput
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search staff by name, role, unit..."
            />
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'roster' && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Apply All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Clear All
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-1 cursor-pointer transition-all hover:scale-102"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Profile</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Roster tab content: select which master staff to include this month */}
          {activeTab === 'roster' && (
            <div className="space-y-2">
              <div className="p-3 bg-indigo-50/55 dark:bg-indigo-950/15 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 text-xs text-slate-600 dark:text-slate-355 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white mb-0.5">Selective Monthly Allocation</p>
                  Check worker profiles to add them as active for <span className="font-bold text-indigo-700 dark:text-indigo-400">{monthName} {year}</span>. Unchecked profiles are safely kept in the Master Directory and will not clutter this month.
                </div>
              </div>

              {filteredMaster.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">
                  No staff profiles found. Click "Create Profile" to add.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredMaster.map((mw) => {
                    const isActive = activeIds.has(mw.id);
                    const currentMonthWorker = currentMonthWorkers.find((w) => w.id === mw.id);
                    const displayName = currentMonthWorker?.name || mw.name;

                    return (
                      <div
                        key={mw.id}
                        onClick={() => handleToggleWorker(mw)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <button type="button" className="shrink-0 text-indigo-600">
                            {isActive ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                          <div className="text-left min-w-0">
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                              {displayName}
                            </h4>
                            <div className="text-[10px] text-slate-400 font-semibold font-mono uppercase mt-0.5 truncate">
                              {mw.designation} &bull; ₹{mw.salary.toLocaleString('en-IN')}
                            </div>
                            {currentMonthWorker && currentMonthWorker.name !== mw.name && (
                              <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                                Renamed from "{mw.name}" for this month
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            mw.unit === 'Furnace A'
                              ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60'
                              : mw.unit === 'Furnace B'
                              ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60'
                              : 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60'
                          }`}>
                            {mw.unit}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditing(currentMonthWorker || mw);
                            }}
                            title="Edit or Rename Worker"
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Master Directory view: full directory administration */}
          {activeTab === 'master' && (
            <div className="space-y-2">
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 text-xs text-slate-600 dark:text-slate-355 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white mb-0.5">Global Master Directory</p>
                  These profiles are permanently and safely stored in the cloud. You can edit names, units, or salary rates, or delete inactive profiles. Editing here sets the template for future rosters.
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteAllConfirm(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                >
                  Delete All Workers
                </button>
              </div>

              <div className="space-y-1.5">
                {filteredMaster.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs italic">
                    No matching master profiles.
                  </div>
                ) : (
                  filteredMaster.map((mw) => {
                    const isActive = activeIds.has(mw.id);
                    return (
                      <div
                        key={mw.id}
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-850"
                      >
                        <div className="text-left min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{mw.name}</span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold border ${
                              mw.unit === 'Furnace A' ? 'bg-amber-100 text-amber-800' : mw.unit === 'Furnace B' ? 'bg-orange-100 text-orange-800' : 'bg-cyan-100 text-cyan-800'
                            }`}>
                              {mw.unit}
                            </span>
                            {isActive && (
                              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold px-1.5 py-0.2 rounded-md">
                                Active this month
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-455 font-semibold font-mono uppercase mt-0.5 truncate">
                            {mw.designation} &bull; Base Wage: ₹{mw.salary.toLocaleString('en-IN')} / Month
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditing(mw)}
                            title="Edit Profile"
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMasterWorkerClick(mw.id, mw.name)}
                            title="Delete Permanent Profile"
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-150 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/10 active:scale-95 transition-all cursor-pointer"
          >
            Finished Editing
          </button>
        </div>
      </div>

      {/* Popover Form: Create Master Profile */}
      {isAddingNew && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <form
            onSubmit={handleAddNewMasterWorker}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Create New Worker Profile</h4>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">Full Name:</label>
                  <VoiceMicButton
                    fieldName="New Name"
                    isActive={activeField === 'New Name'}
                    onToggle={() => startListening('New Name', 'name', (text) => setNewName(text))}
                    title="Speak worker full name"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter worker full name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Plant Unit:</label>
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as PlantUnit)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="Furnace A">Furnace A</option>
                  <option value="Furnace B">Furnace B</option>
                  <option value="CCM">CCM</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">Designation (Role):</label>
                  <VoiceMicButton
                    fieldName="New Role"
                    isActive={activeField === 'New Role'}
                    onToggle={() => startListening('New Role', 'uppercase', (text) => setNewRole(text.toUpperCase()))}
                    title="Speak designation"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value.toUpperCase())}
                  placeholder={newUnit === 'CCM' ? 'CCM MANAGER' : 'MELTER'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase font-bold"
                />
                    {/* Quick Taps */}
                <div className="mt-1.5 flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  {(() => {
                    const ccmDesignationsFromMaster = Array.from(new Set(masterWorkers.filter(w => w.unit === 'CCM').map(w => w.designation.toUpperCase())));
                    const combinedCCMDesignations = Array.from(new Set([...CCM_DESIGNATIONS, ...ccmDesignationsFromMaster])).sort();
                    return (newUnit === 'CCM' ? combinedCCMDesignations : FURNACE_DESIGNATIONS).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setNewRole(role)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                          newRole === role
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {role}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Monthly Salary (₹):</label>
                <input
                  type="number"
                  required
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl"
              >
                Create &amp; Apply
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Popover Form: Edit Worker Details */}
      {editingWorker && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Edit Profile Details</h4>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">Full Name:</label>
                  <VoiceMicButton
                    fieldName="Edit Name"
                    isActive={activeField === 'Edit Name'}
                    onToggle={() => startListening('Edit Name', 'name', (text) => setEditName(text))}
                    title="Speak worker full name"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Plant Unit:</label>
                <select
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value as PlantUnit)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="Furnace A">Furnace A</option>
                  <option value="Furnace B">Furnace B</option>
                  <option value="CCM">CCM</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">Designation:</label>
                  <VoiceMicButton
                    fieldName="Edit Role"
                    isActive={activeField === 'Edit Role'}
                    onToggle={() => startListening('Edit Role', 'uppercase', (text) => setEditRole(text.toUpperCase()))}
                    title="Speak designation"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Monthly Salary (₹):</label>
                <input
                  type="number"
                  required
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>

              {/* Monthly Rename vs Global Directory Option Checkbox */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 space-y-1.5">
                <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editGlobally}
                    onChange={(e) => setEditGlobally(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Apply edits globally in Directory?</span>
                </label>
                <p className="text-[10px] text-slate-500 font-semibold pl-6">
                  If unchecked, changes apply ONLY to {monthName} {year}. This lets you customize worker names month-by-month without altering history or other months!
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md shadow-indigo-600/10"
              >
                Save Edits
              </button>
            </div>
          </form>
        </div>
      )}

      {/* In-Modal Permanent Delete Confirmation Dialog (100% Reliable across all devices & iframes) */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-rose-200 dark:border-rose-900/60 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Delete Worker Permanently?
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-semibold">
                "{deleteConfirmTarget.name}"
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                This will remove the worker from the Master Directory, all monthly rosters, and active screens across both Mobile &amp; Laptop. Historic past attendance numbers are safely preserved.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Modal Clear Month Roster Confirmation */}
      {clearMonthConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Clear {monthName} {year} Roster?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                All staff will be removed from this month's active view. Their profiles remain safely stored in the Master Directory and can be re-applied at any time.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setClearMonthConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearMonth}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                Yes, Clear Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Modal Delete ALL Workers Confirmation */}
      {deleteAllConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-rose-200 dark:border-rose-900/60 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Delete ALL Worker Profiles?
              </h4>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-bold">
                Permanent Action
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to delete ALL worker profiles in the Master Directory and clear all rosters across both Laptop and Mobile?
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteAllConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
