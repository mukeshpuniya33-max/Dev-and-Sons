import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Plus, Flame, Sparkles, Sun, Moon, Bookmark, Trash2 } from 'lucide-react';
import { parseAttendanceCode } from '../utils/attendanceCalculator';

interface QuickTapModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerName: string;
  designation: string;
  unit: string;
  day: number;
  dateString: string;
  currentCode?: string;
  currentShift1Reason?: string;
  currentShift2Reason?: string;
  currentShift3Reason?: string;
  currentShift1Type?: 'Day' | 'Night';
  currentShift2Type?: 'Day' | 'Night';
  currentShift3Type?: 'Day' | 'Night';
  currentOtReason?: string;
  activeDayDesignation?: string;
  activeDaySalary?: number;
  isTransferredDay?: boolean;
  onSelectCode: (
    code: string,
    shift1Reason?: string,
    shift2Reason?: string,
    shift3Reason?: string,
    shift1Type?: 'Day' | 'Night',
    shift2Type?: 'Day' | 'Night',
    shift3Type?: 'Day' | 'Night'
  ) => void;
}

export const QuickTapModal: React.FC<QuickTapModalProps> = ({
  isOpen,
  onClose,
  workerName,
  designation,
  unit,
  day,
  dateString,
  currentCode = '',
  currentShift1Reason = '',
  currentShift2Reason = '',
  currentShift3Reason = '',
  currentShift1Type = 'Day',
  currentShift2Type = 'Night',
  currentShift3Type = 'Night',
  currentOtReason = '',
  activeDayDesignation,
  activeDaySalary,
  isTransferredDay,
  onSelectCode,
}) => {
  const [shiftCount, setShiftCount] = useState<1 | 2 | 3>(1);
  const [shift1Hours, setShift1Hours] = useState<number>(0);
  const [shift2Hours, setShift2Hours] = useState<number>(0);
  const [shift3Hours, setShift3Hours] = useState<number>(0);

  const [shift1Type, setShift1Type] = useState<'Day' | 'Night'>(currentShift1Type);
  const [shift2Type, setShift2Type] = useState<'Day' | 'Night'>(currentShift2Type);
  const [shift3Type, setShift3Type] = useState<'Day' | 'Night'>(currentShift3Type);

  const [shift1ReasonInput, setShift1ReasonInput] = useState<string>(currentShift1Reason || (currentOtReason ? currentOtReason : ''));
  const [shift2ReasonInput, setShift2ReasonInput] = useState<string>(currentShift2Reason);
  const [shift3ReasonInput, setShift3ReasonInput] = useState<string>(currentShift3Reason);

  useEffect(() => {
    if (isOpen) {
      setShift1Type(currentShift1Type || 'Day');
      setShift2Type(currentShift2Type || 'Night');
      setShift3Type(currentShift3Type || 'Night');
      setShift1ReasonInput(currentShift1Reason || (currentOtReason ? currentOtReason : ''));
      setShift2ReasonInput(currentShift2Reason || '');
      setShift3ReasonInput(currentShift3Reason || '');
    }
  }, [
    isOpen,
    currentShift1Type,
    currentShift2Type,
    currentShift3Type,
    currentShift1Reason,
    currentShift2Reason,
    currentShift3Reason,
    currentOtReason,
  ]);

  // User Custom Quick-Tap Tags (Saved in localStorage - Zero default system text)
  const [userCustomTags, setUserCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('plant_custom_quick_tags_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const handleSaveCustomTag = (tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed || userCustomTags.includes(trimmed)) return;
    const updated = [...userCustomTags, trimmed];
    setUserCustomTags(updated);
    try {
      localStorage.setItem('plant_custom_quick_tags_v1', JSON.stringify(updated));
    } catch {}
  };

  const handleDeleteCustomTag = (tagToDelete: string) => {
    const updated = userCustomTags.filter((t) => t !== tagToDelete);
    setUserCustomTags(updated);
    try {
      localStorage.setItem('plant_custom_quick_tags_v1', JSON.stringify(updated));
    } catch {}
  };

  if (!isOpen) return null;

  // Compute built code
  const buildCurrentCustomCode = (): string => {
    const s1 = shift1Hours > 0 ? `P4(${shift1Hours})` : 'P4';
    if (shiftCount === 1) return s1;

    const s2 = shift2Hours > 0 ? `P4(${shift2Hours})` : 'P4';
    if (shiftCount === 2) return `${s1} + ${s2}`;

    const s3 = shift3Hours > 0 ? `P4(${shift3Hours})` : 'P4';
    return `${s1} + ${s2} + ${s3}`;
  };

  const customBuiltCode = buildCurrentCustomCode();
  const parsedCustom = parseAttendanceCode(customBuiltCode);
  const convertedDays = Math.floor(parsedCustom.hours / 12);
  const remainingHours = parsedCustom.hours % 12;

  // Direct 1-tap presets from user prompt
  const singlePresets = ['P4', 'P4(2)', 'P4(4)', 'P4(6)', 'P4(8)', 'P4(12)'];
  const doublePresets = ['P4 + P4', 'P4(4)+P4(4)', 'P4(6)+P4(6)', 'P4(8)+P4(4)', 'P4(12)+P4(12)'];
  const triplePresets = ['P4+P4+P4', 'P4(4)+P4(4)+P4(4)', 'P4(8)+P4(8)+P4(8)'];
  const otherPresets = ['A', 'WO', 'HD'];

  const handleApply = (code: string) => {
    onSelectCode(
      code,
      shift1ReasonInput,
      shift2ReasonInput,
      shift3ReasonInput,
      shift1Type,
      shift2Type,
      shift3Type
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-600" />
                {unit}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Date: {dateString}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 flex flex-wrap items-center gap-1.5">
              <span>{workerName}</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                ({activeDayDesignation || designation})
              </span>
              {isTransferredDay && (
                <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                  Role Transfer Day (₹{activeDaySalary?.toLocaleString('en-IN')}/m)
                </span>
              )}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Section 1: 1-Tap Quick Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ⚡ Quick 1-Tap Buttons
              </span>
              <span className="text-[11px] text-slate-500">Tap to record immediately</span>
            </div>

            {/* Single Shift Buttons */}
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">Single Shift (P4 / P4 + Extra Hours)</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {singlePresets.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleApply(code)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all active:scale-95 flex flex-col items-center justify-center ${
                      currentCode.replace(/\s+/g, '') === code.replace(/\s+/g, '')
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span>{code}</span>
                    <span className="text-[9px] font-normal text-slate-400">
                      {code === 'P4' ? '1 Day' : `1D + ${code.match(/\d+/)?.[0] || ''}h`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Double Shift Buttons */}
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">Double Shift (P4 + P4 / Overtime)</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {doublePresets.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleApply(code)}
                    className="py-2 px-1.5 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 hover:border-blue-400 transition-all active:scale-95 flex flex-col items-center justify-center"
                  >
                    <span>{code}</span>
                    <span className="text-[9px] font-normal text-blue-500">2 Days + OT</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Triple Shift Buttons */}
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">Triple Shift (P4 + P4 + P4)</div>
              <div className="grid grid-cols-3 gap-1.5">
                {triplePresets.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleApply(code)}
                    className="py-2 px-2 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 hover:bg-purple-100 hover:border-purple-400 transition-all active:scale-95 flex flex-col items-center justify-center"
                  >
                    <span>{code}</span>
                    <span className="text-[9px] font-normal text-purple-500">3 Days Shift</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Non-working / Leave */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleApply('A')}
                className="py-1.5 px-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all text-center"
              >
                A (Absent)
              </button>
              <button
                type="button"
                onClick={() => handleApply('WO')}
                className="py-1.5 px-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all text-center"
              >
                WO (Weekly Off)
              </button>
              <button
                type="button"
                onClick={() => handleApply('HD')}
                className="py-1.5 px-2 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-all text-center"
              >
                HD (Half Day)
              </button>
              <button
                type="button"
                onClick={() => handleApply('')}
                className="py-1.5 px-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center"
              >
                Clear Entry
              </button>
            </div>
          </div>

          {/* Section 2: Custom Multi-Shift Hour Builder (1 to 12 Hours) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Custom Shift &amp; Hours Builder (1 to 12)
              </span>
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShiftCount(1)}
                  className={`px-2 py-0.5 rounded-md ${shiftCount === 1 ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                >
                  1 Shift
                </button>
                <button
                  type="button"
                  onClick={() => setShiftCount(2)}
                  className={`px-2 py-0.5 rounded-md ${shiftCount === 2 ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                >
                  2 Shifts
                </button>
                <button
                  type="button"
                  onClick={() => setShiftCount(3)}
                  className={`px-2 py-0.5 rounded-md ${shiftCount === 3 ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                >
                  3 Shifts
                </button>
              </div>
            </div>

            {/* Shift 1 Extra Hours */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Shift 1 extra hours: {shift1Hours}h</span>
                <span className="text-slate-400">{shift1Hours > 0 ? `P4(${shift1Hours})` : 'P4'}</span>
              </div>
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setShift1Hours(h)}
                    className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold flex items-center justify-center border transition-all ${
                      shift1Hours === h
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Shift 2 Extra Hours if double/triple */}
            {shiftCount >= 2 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Shift 2 extra hours: {shift2Hours}h</span>
                  <span className="text-slate-400">{shift2Hours > 0 ? `P4(${shift2Hours})` : 'P4'}</span>
                </div>
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setShift2Hours(h)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold flex items-center justify-center border transition-all ${
                        shift2Hours === h
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shift 3 Extra Hours if triple */}
            {shiftCount === 3 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Shift 3 extra hours: {shift3Hours}h</span>
                  <span className="text-slate-400">{shift3Hours > 0 ? `P4(${shift3Hours})` : 'P4'}</span>
                </div>
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setShift3Hours(h)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold flex items-center justify-center border transition-all ${
                        shift3Hours === h
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Shift Timing Selection (Day / Night Shift) & Shift-Wise Task Reason Notes */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  ☀️ / 🌙 Day &amp; Night Shift Selection &amp; Reasons (Optional)
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">1st, 2nd &amp; 3rd Shift Slots</span>
              </div>

              {/* Shift 1 Reason & Day/Night Selector */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    1st Shift Slot (P4)
                  </span>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setShift1Type('Day')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                        shift1Type === 'Day'
                          ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Day Shift</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShift1Type('Night')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                        shift1Type === 'Night'
                          ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Night Shift</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={shift1ReasonInput}
                    onChange={(e) => setShift1ReasonInput(e.target.value)}
                    placeholder="Type reason for 1st shift (e.g., Morning casting)..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {shift1ReasonInput.trim() && !userCustomTags.includes(shift1ReasonInput.trim()) && (
                    <button
                      type="button"
                      onClick={() => handleSaveCustomTag(shift1ReasonInput)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all flex items-center gap-1 shrink-0"
                      title="Save this reason into your custom Quick-Tap list for future 1-tap use"
                    >
                      <Bookmark className="w-3 h-3 text-indigo-600" />
                      <span>+ Save Tag</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Shift 2 Reason & Day/Night Selector (When 2+ shifts selected or in code) */}
              {(shiftCount >= 2 || currentCode.includes('+')) && (
                <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      2nd Shift Slot (P4 - Overtime / Callback)
                    </span>
                    <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setShift2Type('Day')}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                          shift2Type === 'Day'
                            ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Sun className="w-3 h-3" />
                        <span>Day Shift</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShift2Type('Night')}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                          shift2Type === 'Night'
                            ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Moon className="w-3 h-3" />
                        <span>Night Shift</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={shift2ReasonInput}
                      onChange={(e) => setShift2ReasonInput(e.target.value)}
                      placeholder="Type reason for 2nd shift (e.g., Night callback)..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {shift2ReasonInput.trim() && !userCustomTags.includes(shift2ReasonInput.trim()) && (
                      <button
                        type="button"
                        onClick={() => handleSaveCustomTag(shift2ReasonInput)}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[10px] border border-blue-300 transition-all flex items-center gap-1 shrink-0"
                        title="Save this reason into your custom Quick-Tap list"
                      >
                        <Bookmark className="w-3 h-3 text-blue-600" />
                        <span>+ Save Tag</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Shift 3 Reason & Day/Night Selector */}
              {(shiftCount === 3 || currentCode.split('+').length >= 3) && (
                <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      3rd Shift Slot (P4 - Extra Duty)
                    </span>
                    <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-purple-200 dark:border-purple-800 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setShift3Type('Day')}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                          shift3Type === 'Day'
                            ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Sun className="w-3 h-3" />
                        <span>Day Shift</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShift3Type('Night')}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                          shift3Type === 'Night'
                            ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Moon className="w-3 h-3" />
                        <span>Night Shift</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={shift3ReasonInput}
                      onChange={(e) => setShift3ReasonInput(e.target.value)}
                      placeholder="Type reason for 3rd shift..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {shift3ReasonInput.trim() && !userCustomTags.includes(shift3ReasonInput.trim()) && (
                      <button
                        type="button"
                        onClick={() => handleSaveCustomTag(shift3ReasonInput)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold text-[10px] border border-purple-300 transition-all flex items-center gap-1 shrink-0"
                      >
                        <Bookmark className="w-3 h-3 text-purple-600" />
                        <span>+ Save Tag</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* User Saved Quick-Tap Tags (Zero default hardcoded system tags) */}
              {userCustomTags.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-indigo-500" />
                      Your Saved Quick-Tap Tags (Tap to fill):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {userCustomTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (shiftCount >= 2 && !shift2ReasonInput) {
                              setShift2ReasonInput(tag);
                            } else {
                              setShift1ReasonInput(tag);
                            }
                          }}
                          className="hover:underline cursor-pointer"
                        >
                          + {tag}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomTag(tag)}
                          className="text-slate-400 hover:text-red-500 p-0.5 transition-colors cursor-pointer"
                          title="Remove saved custom tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Builder Preview & Apply Button */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Generated Code</span>
                <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {customBuiltCode}
                </span>
                <span className="text-xs text-slate-500 block">
                  = {parsedCustom.days} Days + {parsedCustom.hours} Hours
                  {convertedDays > 0 && ` (${convertedDays} day added from 12h OT + ${remainingHours}h remaining)`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleApply(customBuiltCode)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Apply Code</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
