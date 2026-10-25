import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Flame,
  DollarSign,
  Briefcase,
  User,
  Phone,
  Check,
  Sparkles,
  CreditCard,
  Building2,
  Hash,
  MapPin,
  Shield,
  FileCheck,
  CalendarDays,
  Search,
  Mic,
  MicOff,
  Settings2,
  Volume2,
  Trash2,
  Plus,
  ArrowRightLeft,
  Layers,
  CalendarRange,
} from 'lucide-react';
import { Worker, PlantUnit, DesignationPeriod, CCM_DESIGNATIONS, FURNACE_DESIGNATIONS } from '../types/attendance';
import { calculateAge } from '../utils/attendanceCalculator';
import { useFieldSpeech } from '../hooks/useFieldSpeech';
import { VoiceMicButton } from './VoiceMicButton';

interface AddWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveWorker: (worker: Omit<Worker, 'id'>, editId?: string) => void;
  workerToEdit?: Worker | null;
  existingWorkers?: Worker[];
  masterStaffDirectory?: Worker[];
  onImportWorker?: (worker: Worker) => void;
  onDeleteMasterProfile?: (workerId: string) => void;
}

export const AddWorkerModal: React.FC<AddWorkerModalProps> = ({
  isOpen,
  onClose,
  onSaveWorker,
  workerToEdit,
  existingWorkers = [],
  masterStaffDirectory = [],
  onImportWorker,
  onDeleteMasterProfile,
}) => {
  const [name, setName] = useState<string>('');
  const [fatherName, setFatherName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('MELTER');
  const [unit, setUnit] = useState<PlantUnit>('Furnace A');
  const [customUnit, setCustomUnit] = useState<string>('');
  const [salary, setSalary] = useState<string>('26000');
  const [phone, setPhone] = useState<string>('');
  const [aadharNumber, setAadharNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');
  const [joiningDate, setJoiningDate] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [insertPosition, setInsertPosition] = useState<'end' | 'group_designation' | 'group_unit'>('group_designation');
  const [error, setError] = useState<string | null>(null);

  // Mid-Month Designation Transfers & Split Salary
  const [designationPeriods, setDesignationPeriods] = useState<DesignationPeriod[]>([]);
  const [enableRoleSplit, setEnableRoleSplit] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'new' | 'import'>('new');
  const [searchMasterQuery, setSearchMasterQuery] = useState<string>('');
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);

  // Voice speech assistant hook
  const {
    isSupported: isVoiceSupported,
    activeField,
    statusText: voiceStatusText,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
    startListening,
    stopListening,
  } = useFieldSpeech();

  useEffect(() => {
    if (isOpen) {
      setActiveTab('new');
      setSearchMasterQuery('');
      if (workerToEdit) {
        setName(workerToEdit.name);
        setFatherName(workerToEdit.fatherName || '');
        setDesignation(workerToEdit.designation.toUpperCase());
        if (['Furnace A', 'Furnace B', 'CCM'].includes(workerToEdit.unit)) {
          setUnit(workerToEdit.unit);
        } else {
          setUnit('Other');
          setCustomUnit(workerToEdit.unit);
        }
        setSalary(workerToEdit.salary.toString());
        setPhone(workerToEdit.phone || '');
        setAadharNumber(workerToEdit.aadharNumber || '');
        setAddress(workerToEdit.address || '');
        setPanNumber(workerToEdit.panNumber || '');
        setJoiningDate(workerToEdit.joiningDate || '');
        setAccountNumber(workerToEdit.accountNumber || '');
        setIfscCode(workerToEdit.ifscCode || '');
        setBankName(workerToEdit.bankName || '');
        setEmployeeCode(workerToEdit.employeeCode || '');
        setDateOfBirth(workerToEdit.dateOfBirth || '');
        if (workerToEdit.designationPeriods && workerToEdit.designationPeriods.length > 0) {
          setDesignationPeriods(workerToEdit.designationPeriods);
          setEnableRoleSplit(true);
        } else {
          setDesignationPeriods([]);
          setEnableRoleSplit(false);
        }
      } else {
        setName('');
        setFatherName('');
        setDesignation('MELTER');
        setUnit('Furnace A');
        setCustomUnit('');
        setSalary('26000');
        setPhone('');
        setAadharNumber('');
        setAddress('');
        setPanNumber('');
        setJoiningDate('');
        setAccountNumber('');
        setIfscCode('');
        setBankName('');
        setEmployeeCode('');
        setDateOfBirth('');
        setInsertPosition('group_designation');
        setDesignationPeriods([]);
        setEnableRoleSplit(false);
      }
      setError(null);
    }
  }, [workerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Worker name is required.');
      return;
    }
    const numSalary = parseFloat(salary);
    if (isNaN(numSalary) || numSalary <= 0) {
      setError('Please enter a valid monthly salary.');
      return;
    }

    const finalUnit = unit === 'Other' ? (customUnit.trim() || 'General') : unit;
    const finalDesignation = designation.trim().toUpperCase() || 'WORKER';

    // Calculate orderIndex if inserting
    let calculatedOrderIndex: number | undefined = undefined;
    if (!workerToEdit && existingWorkers.length > 0) {
      if (insertPosition === 'group_designation') {
        const sameDesigIdx = existingWorkers
          .map((w, i) => ({ w, i }))
          .filter((item) => item.w.designation.toUpperCase() === finalDesignation);
        if (sameDesigIdx.length > 0) {
          const lastIdx = sameDesigIdx[sameDesigIdx.length - 1].i;
          calculatedOrderIndex = lastIdx + 0.5;
        }
      } else if (insertPosition === 'group_unit') {
        const sameUnitIdx = existingWorkers
          .map((w, i) => ({ w, i }))
          .filter((item) => item.w.unit === finalUnit);
        if (sameUnitIdx.length > 0) {
          const lastIdx = sameUnitIdx[sameUnitIdx.length - 1].i;
          calculatedOrderIndex = lastIdx + 0.5;
        }
      }
    }

    onSaveWorker(
      {
        name: name.trim(),
        fatherName: fatherName.trim() || undefined,
        designation: finalDesignation,
        unit: finalUnit,
        salary: numSalary,
        designationPeriods: enableRoleSplit && designationPeriods.length > 0 ? designationPeriods : undefined,
        orderIndex: calculatedOrderIndex ?? workerToEdit?.orderIndex,
        phone: phone.trim() || undefined,
        aadharNumber: aadharNumber.trim() || undefined,
        address: address.trim() || undefined,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        joiningDate: joiningDate.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim().toUpperCase() || undefined,
        bankName: bankName.trim() || undefined,
        employeeCode: employeeCode.trim() || undefined,
        status: 'active',
      },
      workerToEdit?.id
    );

    onClose();
  };

  const isCCM = unit === 'CCM';
  
  const ccmDesignationsFromMaster = Array.from(new Set(masterStaffDirectory.filter(w => w.unit === 'CCM').map(w => w.designation.toUpperCase())));
  const combinedCCMDesignations = Array.from(new Set([...CCM_DESIGNATIONS, ...ccmDesignationsFromMaster])).sort();
  
  const availableDesignations = isCCM ? combinedCCMDesignations : FURNACE_DESIGNATIONS;

  // Preset Handlers for Mid-Month Designation Transfers
  const handleApplyPreset15Days = () => {
    const curSal = parseFloat(salary) || 26000;
    const finalUnit = (unit === 'Other' ? (customUnit.trim() || 'General') : unit) as PlantUnit;
    const secondRole = isCCM ? (designation.toUpperCase() === 'MOLD OPERATOR' ? 'MOLD OPERATOR HELPER' : 'MOLD OPERATOR') : (designation.toUpperCase() === 'MELTER' ? 'FURNACE HELPER' : 'MELTER');
    setEnableRoleSplit(true);
    setDesignationPeriods([
      {
        id: `period-${Date.now()}-1`,
        designation: designation.toUpperCase() || 'WORKER',
        unit: finalUnit,
        salary: curSal,
        startDay: 1,
        endDay: 15,
        notes: 'Days 1 to 15 First Half Shift Assignment',
      },
      {
        id: `period-${Date.now()}-2`,
        designation: secondRole,
        unit: finalUnit,
        salary: curSal,
        startDay: 16,
        endDay: 31,
        notes: 'Days 16 to 31 Second Half Transferred Role',
      },
    ]);
  };

  const handleApplyPreset5Days = () => {
    const curSal = parseFloat(salary) || 26000;
    const finalUnit = (unit === 'Other' ? (customUnit.trim() || 'General') : unit) as PlantUnit;
    const secondRole = isCCM ? (designation.toUpperCase() === 'MOLD OPERATOR' ? 'MOLD OPERATOR HELPER' : 'MOLD OPERATOR') : (designation.toUpperCase() === 'MELTER' ? 'FURNACE HELPER' : 'MELTER');
    setEnableRoleSplit(true);
    setDesignationPeriods([
      {
        id: `period-${Date.now()}-1`,
        designation: designation.toUpperCase() || 'WORKER',
        unit: finalUnit,
        salary: curSal,
        startDay: 1,
        endDay: 5,
        notes: 'Initial 5 Days Assignment',
      },
      {
        id: `period-${Date.now()}-2`,
        designation: secondRole,
        unit: finalUnit,
        salary: curSal,
        startDay: 6,
        endDay: 31,
        notes: 'Remaining Month Transferred Post Assignment',
      },
    ]);
  };

  // Custom 3-Way split (e.g. Day 1-4, 5-7, 8-31) as requested by user
  const handleApplyPresetCustom3Way = () => {
    const curSal = parseFloat(salary) || 26000;
    const finalUnit = (unit === 'Other' ? (customUnit.trim() || 'General') : unit) as PlantUnit;
    const secondRole = isCCM ? 'MOLD OPERATOR' : 'INCHARGE';
    const thirdRole = isCCM ? 'FITTER' : 'MELTER';
    setEnableRoleSplit(true);
    setDesignationPeriods([
      {
        id: `period-${Date.now()}-1`,
        designation: designation.toUpperCase() || 'WORKER',
        unit: finalUnit,
        salary: curSal,
        startDay: 1,
        endDay: 4,
        notes: 'Days 1 to 4 First Assignment',
      },
      {
        id: `period-${Date.now()}-2`,
        designation: secondRole,
        unit: finalUnit,
        salary: Math.round(curSal * 1.15),
        startDay: 5,
        endDay: 7,
        notes: 'Days 5 to 7 Temporary Post',
      },
      {
        id: `period-${Date.now()}-3`,
        designation: thirdRole,
        unit: finalUnit,
        salary: curSal,
        startDay: 8,
        endDay: 31,
        notes: 'Days 8 to 31 Main Post',
      },
    ]);
  };

  // 10-10-10 3-way split (Day 1-10, 11-20, 21-31)
  const handleApplyPreset10Days = () => {
    const curSal = parseFloat(salary) || 26000;
    const finalUnit = (unit === 'Other' ? (customUnit.trim() || 'General') : unit) as PlantUnit;
    const secondRole = isCCM ? 'MOLD OPERATOR' : 'BARIMAN';
    const thirdRole = isCCM ? 'FITTER' : 'MELTER';
    setEnableRoleSplit(true);
    setDesignationPeriods([
      {
        id: `period-${Date.now()}-1`,
        designation: designation.toUpperCase() || 'WORKER',
        unit: finalUnit,
        salary: curSal,
        startDay: 1,
        endDay: 10,
        notes: 'Days 1-10 Assignment',
      },
      {
        id: `period-${Date.now()}-2`,
        designation: secondRole,
        unit: finalUnit,
        salary: curSal,
        startDay: 11,
        endDay: 20,
        notes: 'Days 11-20 Assignment',
      },
      {
        id: `period-${Date.now()}-3`,
        designation: thirdRole,
        unit: finalUnit,
        salary: curSal,
        startDay: 21,
        endDay: 31,
        notes: 'Days 21-31 Assignment',
      },
    ]);
  };

  const handleAddCustomPeriod = () => {
    const curSal = parseFloat(salary) || 26000;
    const finalUnit = (unit === 'Other' ? (customUnit.trim() || 'General') : unit) as PlantUnit;
    const lastPeriod = designationPeriods[designationPeriods.length - 1];
    const nextStart = lastPeriod ? Math.min(31, lastPeriod.endDay + 1) : 1;
    const nextEnd = 31;
    setEnableRoleSplit(true);
    setDesignationPeriods([
      ...designationPeriods,
      {
        id: `period-${Date.now()}`,
        designation: designation.toUpperCase() || 'WORKER',
        unit: finalUnit,
        salary: curSal,
        startDay: nextStart,
        endDay: nextEnd,
        notes: '',
      },
    ]);
  };

  // Automatically sequence dates across periods sequentially without gaps
  const handleAutoSequenceDates = () => {
    setDesignationPeriods((prev) => {
      let curDay = 1;
      return prev.map((p, idx) => {
        const daysSpan = Math.max(1, p.endDay - p.startDay + 1);
        const startDay = curDay;
        const endDay = idx === prev.length - 1 ? 31 : Math.min(31, startDay + daysSpan - 1);
        curDay = Math.min(31, endDay + 1);
        return { ...p, startDay, endDay };
      });
    });
  };

  const handleUpdatePeriod = (index: number, updates: Partial<DesignationPeriod>) => {
    setDesignationPeriods((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemovePeriod = (index: number) => {
    setDesignationPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const plantUnits: { id: PlantUnit; label: string; badge: string }[] = [
    { id: 'Furnace A', label: 'Furnace A', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'Furnace B', label: 'Furnace B', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
    { id: 'CCM', label: 'CCM', badge: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {workerToEdit ? 'Edit Worker Profile' : 'Add Worker in Attendance'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enroll staff for Furnace A, Furnace B, or CCM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher if adding new worker */}
        {!workerToEdit && masterStaffDirectory && masterStaffDirectory.length > 0 && (
          <div className="flex border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-355'
              }`}
            >
              📝 Create New Worker
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-355'
              }`}
            >
              👥 Import Saved Profile ({masterStaffDirectory.length})
            </button>
          </div>
        )}

        {/* Tab 1: Create New Worker (Or Editing Worker) */}
        {(activeTab === 'new' || workerToEdit) ? (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          {/* Voice Input Assistant Customization & Status Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeField ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    🎙️ Voice Input Assistant
                  </span>
                  {activeField && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      Listening: {activeField}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {voiceStatusText || 'Tap any 🎙️ mic button and speak worker name, guardian name, account no, IFSC, etc.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                title="Customize Voice Microphone Settings"
              >
                <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Customize Mic</span>
              </button>

              <button
                type="button"
                onClick={() => updateVoiceSettings({ enabled: !voiceSettings.enabled })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  voiceSettings.enabled
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {voiceSettings.enabled ? <Check className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>{voiceSettings.enabled ? 'Voice ON' : 'Voice OFF'}</span>
              </button>
            </div>
          </div>

          {/* Voice Customization Settings Drawer */}
          {showVoiceSettings && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                  Voice Recognition Customization:
                </span>
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Speech Language Accent:</span>
                  <select
                    value={voiceSettings.language}
                    onChange={(e) => updateVoiceSettings({ language: e.target.value })}
                    className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-[11px] text-indigo-600"
                  >
                    <option value="en-IN">English (India - en-IN)</option>
                    <option value="hi-IN">Hindi (India - hi-IN)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Auto Format IFSC / PAN in Caps:</span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.autoFormatCaps}
                    onChange={(e) => updateVoiceSettings({ autoFormatCaps: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Unit: Furnace A, Furnace B, CCM */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              1. Select Unit (Plant Section) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {plantUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setUnit(u.id);
                    if (!workerToEdit) {
                      if (u.id === 'CCM') {
                        setDesignation('MOLD OPERATOR');
                      } else {
                        setDesignation('MELTER');
                      }
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                    unit === u.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span>{u.label}</span>
                  {unit === u.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Worker Name & Father/Guardian Name with Voice Mic Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  2. Worker Full Name *
                </label>
                {voiceSettings.enabled && (
                  <VoiceMicButton
                    fieldName="Worker Name"
                    isActive={activeField === 'Worker Name'}
                    onToggle={() => startListening('Worker Name', 'name', (text) => setName(text))}
                    title="Speak worker full name (e.g. Ramesh Kumar)"
                  />
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter worker full name"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                    activeField === 'Worker Name'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Father / Guardian Name (Optional)
                </label>
                {voiceSettings.enabled && (
                  <VoiceMicButton
                    fieldName="Guardian Name"
                    isActive={activeField === 'Guardian Name'}
                    onToggle={() => startListening('Guardian Name', 'name', (text) => setFatherName(text))}
                    title="Speak father / guardian name"
                  />
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Father / Guardian name"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                    activeField === 'Guardian Name'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Designation with Quick Tap Buttons in Capital Letters & Voice Mic */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                3. Designation (Role) *
              </label>
              <div className="flex items-center gap-2">
                {voiceSettings.enabled && (
                  <VoiceMicButton
                    fieldName="Designation"
                    isActive={activeField === 'Designation'}
                    onToggle={() => startListening('Designation', 'uppercase', (text) => setDesignation(text.toUpperCase()))}
                    title="Speak designation (e.g. MELTER, FITTER)"
                  />
                )}
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {isCCM ? `${CCM_DESIGNATIONS.length} CCM Quick Taps` : `${FURNACE_DESIGNATIONS.length} Furnace Quick Taps`}
                </span>
              </div>
            </div>

            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value.toUpperCase())}
              placeholder="e.g. MELTER, MOLD OPERATOR"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                activeField === 'Designation'
                  ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            />

            {/* Quick Tap Buttons in ALL CAPS */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Quick Tap Designation for {unit}:
                </span>
                <span className="text-[10px] text-slate-400">Tap to auto-fill</span>
              </div>

              {isCCM ? (
                /* 16 CCM Quick Tap Buttons */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {CCM_DESIGNATIONS.map((role, idx) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDesignation(role)}
                      className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all truncate ${
                        designation.toUpperCase() === role
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                      }`}
                      title={role}
                    >
                      <span className="text-[9px] opacity-70 block">{idx + 1}.</span>
                      <span className="truncate block">{role}</span>
                    </button>
                  ))}
                </div>
              ) : (
                /* 6 Furnace Quick Tap Buttons */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FURNACE_DESIGNATIONS.map((role, idx) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDesignation(role)}
                      className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all ${
                        designation.toUpperCase() === role
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                      }`}
                    >
                      <span className="text-[10px] opacity-70 block">{idx + 1}.</span>
                      <span className="truncate block">{role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Salary & Voice Mic */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                4. Monthly Base Salary (₹) *
              </label>
              {voiceSettings.enabled && (
                <VoiceMicButton
                  fieldName="Salary"
                  isActive={activeField === 'Salary'}
                  onToggle={() => startListening('Salary', 'number', (text) => setSalary(text))}
                  title="Speak monthly salary (e.g. 26000)"
                />
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                required
                min="0"
                step="100"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 26000"
                className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                  activeField === 'Salary'
                    ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
            </div>
          </div>

          {/* Worker Placement / Shifting option */}
          {!workerToEdit && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                5. Worker List Placement (Shifting &amp; Grouping)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setInsertPosition('group_designation')}
                  className={`p-2 rounded-xl border text-left font-semibold text-[11px] ${
                    insertPosition === 'group_designation'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Group with same role ({designation})
                </button>
                <button
                  type="button"
                  onClick={() => setInsertPosition('end')}
                  className={`p-2 rounded-xl border text-left font-semibold text-[11px] ${
                    insertPosition === 'end'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Add at bottom of list
                </button>
              </div>
            </div>
          )}

          {/* MID-MONTH DESIGNATION TRANSFERS & SPLIT SALARY (मध्य-माह पद परिवर्तन व विभाजन) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70 dark:from-slate-800/80 dark:via-slate-900/60 dark:to-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Mid-Month Designation Transfer &amp; Split Pay</span>
                    {enableRoleSplit && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                        {designationPeriods.length} Periods Active
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    5-day / 15-day role changes with separate daily salary calculations
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!enableRoleSplit) {
                    handleApplyPreset15Days();
                  } else {
                    setEnableRoleSplit(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                  enableRoleSplit
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                {enableRoleSplit ? 'Disable Split' : '+ Enable Role Transfer Split'}
              </button>
            </div>

            {enableRoleSplit && (
              <div className="space-y-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                {/* Fast One-Click Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400">
                    ⚡ Quick Presets:
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyPresetCustom3Way}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors"
                    title="1-4, 5-7, 8-31 Custom Posts with separate salaries"
                  >
                    Custom 3-Way (Day 1-4, 5-7, 8-31)
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPreset15Days}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    15-15 Days Split
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPreset10Days}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    10-10-10 Days Split
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPreset5Days}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    5 Days &amp; Rest
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomPeriod}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-400 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    + Add Period
                  </button>
                  {designationPeriods.length > 1 && (
                    <button
                      type="button"
                      onClick={handleAutoSequenceDates}
                      className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                      title="Sequence start & end days consecutively (1 to 31)"
                    >
                      🔗 Auto-Sequence Dates
                    </button>
                  )}
                </div>

                {/* Periods List */}
                <div className="space-y-2">
                  {designationPeriods.map((period, idx) => (
                    <div
                      key={period.id || idx}
                      className="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black uppercase text-indigo-950 dark:text-indigo-200">
                            Role Assignment {idx + 1}: Days {period.startDay} to {period.endDay}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">
                            {period.endDay - period.startDay + 1} Calendar Days
                          </span>
                          {designationPeriods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePeriod(idx)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete this role period"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Day Range Selection */}
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <CalendarRange className="w-3 h-3 text-indigo-600" />
                            Effective Day Range (1 to 31)
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="flex items-center space-x-1">
                              <span className="text-[10px] text-slate-500">From:</span>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={period.startDay}
                                onChange={(e) =>
                                  handleUpdatePeriod(idx, { startDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })
                                }
                                className="w-full px-2 py-1 text-center font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                              />
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-[10px] text-slate-500">To:</span>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={period.endDay}
                                onChange={(e) =>
                                  handleUpdatePeriod(idx, { endDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 31)) })
                                }
                                className="w-full px-2 py-1 text-center font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Monthly Base Salary for this period */}
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-600" />
                            Monthly Salary for This Role (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={period.salary}
                              onChange={(e) =>
                                handleUpdatePeriod(idx, { salary: parseFloat(e.target.value) || 0 })
                              }
                              className="w-full pl-6 pr-2.5 py-1 font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                            />
                          </div>
                        </div>

                        {/* Designation Selection */}
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-indigo-600" />
                            Designation / Post
                          </label>
                          <select
                            value={period.designation.toUpperCase()}
                            onChange={(e) =>
                              handleUpdatePeriod(idx, { designation: e.target.value.toUpperCase() })
                            }
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-bold uppercase text-slate-900 dark:text-white"
                          >
                            <optgroup label="Available Roles">
                              {availableDesignations.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Other Standard Roles">
                              {[...CCM_DESIGNATIONS, ...FURNACE_DESIGNATIONS]
                                .filter((r) => !availableDesignations.includes(r as any))
                                .map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>

                        {/* Section / Unit */}
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            Plant Section (Unit)
                          </label>
                          <select
                            value={period.unit || unit}
                            onChange={(e) =>
                              handleUpdatePeriod(idx, { unit: e.target.value as PlantUnit })
                            }
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            <option value="Furnace A">Furnace A</option>
                            <option value="Furnace B">Furnace B</option>
                            <option value="CCM">CCM</option>
                            <option value="General">General / Plant</option>
                          </select>
                        </div>

                        {/* Optional Transfer Note */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">
                            Transfer / Duty Reason (e.g. 5 दिन हेल्पर काम, बाकी दिन मेलटर)
                          </label>
                          <input
                            type="text"
                            value={period.notes || ''}
                            onChange={(e) => handleUpdatePeriod(idx, { notes: e.target.value })}
                            placeholder="e.g. Transferred to Furnace after 15 days on trial"
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Identity & KYC Details: Aadhaar, PAN, Address with Voice Mic Buttons */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                6. Identity, Aadhaar &amp; Address Details
              </span>
              <span className="text-[10px] text-slate-400">Defaults on Payslip</span>
            </div>

            {/* Aadhaar Number & PAN Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-emerald-600" />
                    Aadhaar Card Number (12-Digit)
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="Aadhaar Number"
                      isActive={activeField === 'Aadhaar Number'}
                      onToggle={() => startListening('Aadhaar Number', 'aadhar', (text) => setAadharNumber(text))}
                      title="Speak 12-digit Aadhaar number"
                    />
                  )}
                </div>
                <input
                  type="text"
                  maxLength={14}
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white ${
                    activeField === 'Aadhaar Number'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-600" />
                    PAN Card Number
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="PAN Number"
                      isActive={activeField === 'PAN Number'}
                      onToggle={() => startListening('PAN Number', 'pan', (text) => setPanNumber(text.toUpperCase()))}
                      title="Speak PAN number (e.g. ABCDE1234F)"
                    />
                  )}
                </div>
                <input
                  type="text"
                  maxLength={10}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white ${
                    activeField === 'PAN Number'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>

            {/* Residential Address */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" />
                  Permanent / Residential Address
                </label>
                {voiceSettings.enabled && (
                  <VoiceMicButton
                    fieldName="Address"
                    isActive={activeField === 'Address'}
                    onToggle={() => startListening('Address', 'text', (text) => setAddress(text))}
                    title="Speak permanent address"
                  />
                )}
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Ward No. 4, Village/City, Tehsil, Dist. Jaipur, Rajasthan"
                className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white ${
                  activeField === 'Address'
                    ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
            </div>

            {/* Date of Birth, Calculated Age & Joining Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-850">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                  Date of Birth (Calendar)
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Auto Age (Years &amp; Days)
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 min-h-[38px] flex items-center">
                  {(() => {
                    const ageObj = calculateAge(dateOfBirth);
                    return ageObj ? `${ageObj.years} Years, ${ageObj.days} Days` : 'Select DOB above';
                  })()}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  Joining Date (Calendar)
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Bank & Contact Details in Sequenced Way with Voice Mic Buttons */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                7. Contact &amp; Bank Account Details (Sequence)
              </span>
              <span className="text-[10px] text-slate-400">Phone &rarr; A/C &rarr; IFSC &rarr; Bank</span>
            </div>

            {/* Sequence 1: Mobile Number & Staff Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    1. Mobile Number (WhatsApp)
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="Mobile Number"
                      isActive={activeField === 'Mobile Number'}
                      onToggle={() => startListening('Mobile Number', 'phone', (text) => setPhone(text))}
                      title="Speak 10-digit mobile number"
                    />
                  )}
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white ${
                    activeField === 'Mobile Number'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-500" />
                    Staff ID / Code
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="Staff ID"
                      isActive={activeField === 'Staff ID'}
                      onToggle={() => startListening('Staff ID', 'uppercase', (text) => setEmployeeCode(text.toUpperCase()))}
                      title="Speak staff ID / code"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="e.g. FA-101"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white uppercase ${
                    activeField === 'Staff ID'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>

            {/* Sequence 2: Bank Account Number with Voice Mic */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-indigo-600" />
                  2. Bank Account Number
                </label>
                {voiceSettings.enabled && (
                  <VoiceMicButton
                    fieldName="Account Number"
                    isActive={activeField === 'Account Number'}
                    onToggle={() => startListening('Account Number', 'account', (text) => setAccountNumber(text))}
                    title="Speak bank account number (digits)"
                  />
                )}
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 50100234567890"
                className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white ${
                  activeField === 'Account Number'
                    ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
            </div>

            {/* Sequence 3 & 4: IFSC Code and Bank Name with Voice Mic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-amber-600" />
                    3. Bank IFSC Code
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="IFSC Code"
                      isActive={activeField === 'IFSC Code'}
                      onToggle={() => startListening('IFSC Code', 'ifsc', (text) => setIfscCode(text.toUpperCase()))}
                      title="Speak IFSC code (e.g. SBIN0001234)"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234 / HDFC0004567"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white ${
                    activeField === 'IFSC Code'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-blue-600" />
                    4. Bank Name &amp; Branch
                  </label>
                  {voiceSettings.enabled && (
                    <VoiceMicButton
                      fieldName="Bank Name"
                      isActive={activeField === 'Bank Name'}
                      onToggle={() => startListening('Bank Name', 'text', (text) => setBankName(text))}
                      title="Speak Bank name and branch"
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India, Main Branch"
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white ${
                    activeField === 'Bank Name'
                      ? 'border-red-500 ring-2 ring-red-400 bg-red-50/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{workerToEdit ? 'Save Changes' : 'Add to Attendance'}</span>
            </button>
          </div>
        </form>
        ) : (
          /* Tab 2: Import saved profiles from Master Directory */
          <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col max-h-[70vh]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchMasterQuery}
                onChange={(e) => setSearchMasterQuery(e.target.value)}
                placeholder="Search master directory by name or role..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {masterStaffDirectory.filter((mw) => {
                const q = searchMasterQuery.toLowerCase();
                return (
                  mw.name.toLowerCase().includes(q) ||
                  mw.designation.toLowerCase().includes(q) ||
                  mw.unit.toLowerCase().includes(q)
                );
              }).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">
                  No saved profiles match your search query.
                </div>
              ) : (
                masterStaffDirectory
                  .filter((mw) => {
                    const q = searchMasterQuery.toLowerCase();
                    return (
                      mw.name.toLowerCase().includes(q) ||
                      mw.designation.toLowerCase().includes(q) ||
                      mw.unit.toLowerCase().includes(q)
                    );
                  })
                  .map((mw) => (
                    <div
                      key={mw.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <div className="text-left">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>{mw.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {mw.unit}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium font-mono uppercase mt-0.5">
                          {mw.designation} &bull; Base Salary: ₹{mw.salary.toLocaleString('en-IN')}
                        </div>
                        {mw.accountNumber && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Bank A/C: {mw.accountNumber} ({mw.ifscCode})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {onDeleteMasterProfile && (
                          <button
                            type="button"
                            onClick={() => onDeleteMasterProfile(mw.id)}
                            title="Delete profile permanently from directory"
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onImportWorker) {
                              onImportWorker(mw);
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black shadow-sm transition-all cursor-pointer"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
