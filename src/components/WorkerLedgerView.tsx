import React, { useState, useEffect, useMemo } from 'react';
import { Worker, AttendanceCalculation } from '../types/attendance';
import { formatCurrency, parseAttendanceCode, calculateAge, getWorkerActiveDesignation } from '../utils/attendanceCalculator';
import { SharePayslipModal } from './SharePayslipModal';
import { VoiceSearchInput } from './VoiceSearchInput';
import { downloadPayslipPdf } from '../utils/pdfGenerator';
import { printElement } from '../utils/printHelper';
import {
  ArrowLeft,
  Calendar,
  Flame,
  Clock,
  DollarSign,
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Phone,
  FileText,
  User,
  Briefcase,
  Layers,
  CreditCard,
  Building2,
  Hash,
  Sliders,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Send,
  ShieldCheck,
  Award,
  Landmark,
  Download,
  MapPin,
  FileCheck,
  Loader2,
  Mail,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRightLeft,
} from 'lucide-react';

interface WorkerLedgerViewProps {
  worker: Worker;
  daysInMonth: number;
  year: number;
  month: number;
  attendanceRecords: Record<number, string>;
  rawAttendanceRecords?: Record<number, any>;
  dayNotes?: Record<number, string>;
  calc: AttendanceCalculation;
  onBack: () => void;
  onUpdateCode: (day: number, code: string) => void;
  onOpenQuickTapModal: (day: number) => void;
  onNextWorker?: () => void;
  onPrevWorker?: () => void;
  hasNextWorker?: boolean;
  hasPrevWorker?: boolean;
  onChangeMonth?: (m: number) => void;
  onChangeYear?: (y: number) => void;
  allWorkers?: Worker[];
  onSelectWorker?: (w: Worker) => void;
  onEditWorker?: (w: Worker) => void;
}

const CONTRACTOR_STORAGE_KEY = 'plant_contractor_profile_v2';

const DEFAULT_CONTRACTOR = {
  name: '',
  tagline: '',
  association: '',
  proprietor: '',
  phone: '',
  email: '',
  license: '',
  address: '',
};

export const WorkerLedgerView: React.FC<WorkerLedgerViewProps> = ({
  worker,
  daysInMonth,
  year,
  month,
  attendanceRecords,
  rawAttendanceRecords,
  dayNotes,
  calc,
  onBack,
  onUpdateCode,
  onOpenQuickTapModal,
  onNextWorker,
  onPrevWorker,
  hasNextWorker = false,
  hasPrevWorker = false,
  onChangeMonth,
  onChangeYear,
  allWorkers,
  onSelectWorker,
  onEditWorker,
}) => {
  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [contractorSavedToast, setContractorSavedToast] = useState<boolean>(false);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Search-to-select worker state
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isLedgerMonthMenuOpen, setIsLedgerMonthMenuOpen] = useState<boolean>(false);

  // Sync Clock configuration to match top level settings
  const [timeFormat] = useState<string>(() => {
    try {
      return localStorage.getItem('clock_time_format_v2') || '12hr';
    } catch { return '12hr'; }
  });
  const [dateFormat] = useState<string>(() => {
    try {
      return localStorage.getItem('clock_date_format_v2') || 'DD/MM/YYYY';
    } catch { return 'DD/MM/YYYY'; }
  });
  const [timezoneMode] = useState<string>(() => {
    try {
      return localStorage.getItem('clock_timezone_mode_v2') || 'device';
    } catch { return 'device'; }
  });
  const [selectedTimezone] = useState<string>(() => {
    try {
      return localStorage.getItem('clock_selected_timezone_v2') || 'Asia/Kolkata';
    } catch { return 'Asia/Kolkata'; }
  });
  const [timeHourOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('clock_hour_offset_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 0;
  });
  const [timeMinuteOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('clock_minute_offset_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 0;
  });

  const getPayslipTimestamp = () => {
    let date = new Date();

    if (timezoneMode === 'timezone') {
      try {
        const tzString = date.toLocaleString('en-US', { timeZone: selectedTimezone });
        date = new Date(tzString);
      } catch (e) {}
    }

    if (timeHourOffset !== 0 || timeMinuteOffset !== 0) {
      date = new Date(date.getTime() + (timeHourOffset * 60 * 60 * 1000) + (timeMinuteOffset * 60 * 1000));
    }

    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    let ampm = '';
    if (timeFormat === '12hr') {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    
    const displayHours = String(hours).padStart(2, '0');
    const displayMinutes = String(minutes).padStart(2, '0');
    const displaySeconds = String(seconds).padStart(2, '0');
    const timeString = `${displayHours}:${displayMinutes}:${displaySeconds}${ampm}`;

    const day = date.getDate();
    const monthIdx = date.getMonth();
    const fullYear = date.getFullYear();

    const dd = String(day).padStart(2, '0');
    const mm = String(monthIdx + 1).padStart(2, '0');
    const yyyy = String(fullYear);
    
    const monthNamesFull = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let dateStr = '';
    if (dateFormat === 'DD/MM/YYYY') {
      dateStr = `${dd}/${mm}/${yyyy}`;
    } else if (dateFormat === 'MM/DD/YYYY') {
      dateStr = `${mm}/${dd}/${yyyy}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      dateStr = `${yyyy}-${mm}-${dd}`;
    } else {
      dateStr = `${day} ${monthNamesFull[monthIdx]} ${yyyy}`;
    }

    return `${dateStr} at ${timeString}`;
  };

  // Customization states for Payslip & Sharing (DEFAULTS ARE ALL TRUE / COMPULSORY)
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [documentMode, setDocumentMode] = useState<'full' | 'payslip_only' | 'attendance_only' | 'account_only'>('full');

  // Contractor details (COMPULSORY BY DEFAULT, CUSTOMIZABLE TO HIDE/EDIT)
  const [includeContractor, setIncludeContractor] = useState<boolean>(true);
  const [contractorName, setContractorName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) return parsed.name;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.name;
  });
  const [contractorTagline, setContractorTagline] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tagline) return parsed.tagline;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.tagline;
  });
  const [contractorAssociation, setContractorAssociation] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.association) return parsed.association;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.association;
  });
  const [contractorProprietor, setContractorProprietor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.proprietor) return parsed.proprietor;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.proprietor;
  });
  const [contractorPhone, setContractorPhone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.phone) return parsed.phone;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.phone;
  });
  const [contractorEmail, setContractorEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) return parsed.email;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.email;
  });
  const [contractorLicense, setContractorLicense] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.license) return parsed.license;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.license;
  });
  const [contractorAddress, setContractorAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.address) return parsed.address;
      }
    } catch {}
    return DEFAULT_CONTRACTOR.address;
  });

  // Worker KYC & Bank details
  const [includeBank, setIncludeBank] = useState<boolean>(true);
  const [accountNumber, setAccountNumber] = useState<string>(worker.accountNumber || '');
  const [ifscCode, setIfscCode] = useState<string>(worker.ifscCode || '');
  const [bankName, setBankName] = useState<string>(worker.bankName || '');

  const [includePhone, setIncludePhone] = useState<boolean>(true);
  const [phone, setPhone] = useState<string>(worker.phone || '');

  const [includeBaseSalary, setIncludeBaseSalary] = useState<boolean>(true);
  const [includeDailyRate, setIncludeDailyRate] = useState<boolean>(true);
  const [includePayoutSalary, setIncludePayoutSalary] = useState<boolean>(true);
  const [includeFormulaNote, setIncludeFormulaNote] = useState<boolean>(true);

  const [includeAadhar, setIncludeAadhar] = useState<boolean>(true);
  const [aadharNumber, setAadharNumber] = useState<string>(worker.aadharNumber || '');

  const [includeAddress, setIncludeAddress] = useState<boolean>(true);
  const [address, setAddress] = useState<string>(worker.address || '');

  const [includePan, setIncludePan] = useState<boolean>(true);
  const [panNumber, setPanNumber] = useState<string>(worker.panNumber || '');

  const [fatherName, setFatherName] = useState<string>(worker.fatherName || '');

  const [includeDailyBreakdown, setIncludeDailyBreakdown] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);

  // Sync with worker prop when worker changes - ALWAYS DEFAULT TO TRUE FOR ALL DETAILS (Fixed typing bug by depending only on worker.id)
  useEffect(() => {
    setAccountNumber(worker.accountNumber || '');
    setIfscCode(worker.ifscCode || '');
    setBankName(worker.bankName || '');
    setPhone(worker.phone || '');
    setAadharNumber(worker.aadharNumber || '');
    setAddress(worker.address || '');
    setPanNumber(worker.panNumber || '');
    setFatherName(worker.fatherName || '');

    // Always default to true for all details
    setIncludeContractor(true);
    setIncludeBank(true);
    setIncludePhone(true);
    setIncludeAadhar(true);
    setIncludeAddress(true);
    setIncludePan(true);
    setIncludeBaseSalary(true);
    setIncludeDailyRate(true);
    setIncludePayoutSalary(true);
    setIncludeFormulaNote(true);
  }, [worker.id]);

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const currentMonthName = monthNames[month - 1];

  const getDayDetails = (day: number) => {
    const d = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      name: dayNames[d.getDay()],
      short: shortNames[d.getDay()],
      isSunday: d.getDay() === 0,
      formattedDate: `${day} ${currentMonthName.slice(0, 3)} ${year}`,
    };
  };

  // Extract all shift duty task notes and salary justifications for this worker in this month
  const workerShiftNotes = useMemo(() => {
    const list: Array<{
      day: number;
      dateStr: string;
      code: string;
      s1Reason: string;
      s2Reason: string;
      s3Reason: string;
      s1Type: string;
      s2Type: string;
      s3Type: string;
      otReason: string;
      dayNote?: string;
      combinedReason: string;
      salaryJustification: string;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const rec = rawAttendanceRecords?.[day];
      const dNote = dayNotes?.[day] ? String(dayNotes[day]).trim() : '';

      let code = attendanceRecords[day] || '';
      let s1Reason = '';
      let s2Reason = '';
      let s3Reason = '';
      let s1Type = 'Day';
      let s2Type = 'Night';
      let s3Type = 'Night';
      let otReason = '';

      if (typeof rec === 'object' && rec !== null) {
        if (rec.isDeleted || rec.status === 'cleared') continue;
        if (rec.attendance || rec.status) code = String(rec.attendance || rec.status).trim();
        s1Reason = rec.shift1Reason ? String(rec.shift1Reason).trim() : '';
        s2Reason = rec.shift2Reason ? String(rec.shift2Reason).trim() : '';
        s3Reason = rec.shift3Reason ? String(rec.shift3Reason).trim() : '';
        s1Type = rec.shift1Type || 'Day';
        s2Type = rec.shift2Type || 'Night';
        s3Type = rec.shift3Type || 'Night';
        otReason = rec.otReason ? String(rec.otReason).trim() : '';
      } else if (rec) {
        code = String(rec).trim();
      }

      if (s1Reason || s2Reason || s3Reason || otReason || dNote) {
        const parts: string[] = [];
        if (s1Reason) parts.push(`1st Shift (${s1Type}): ${s1Reason}`);
        if (s2Reason) parts.push(`2nd Shift (${s2Type}): ${s2Reason}`);
        if (s3Reason) parts.push(`3rd Shift (${s3Type}): ${s3Reason}`);
        if (!s1Reason && !s2Reason && !s3Reason && otReason) parts.push(`OT: ${otReason}`);
        if (dNote) parts.push(`Date Shift Note: ${dNote}`);

        const combined = parts.join(' • ');
        list.push({
          day,
          dateStr: `${day} ${currentMonthName.slice(0, 3)} ${year}`,
          code: code || 'P4',
          s1Reason,
          s2Reason,
          s3Reason,
          s1Type,
          s2Type,
          s3Type,
          otReason,
          dayNote: dNote,
          combinedReason: combined,
          salaryJustification: `Assigned specific duty task (${combined}) on date ${day} — salary/wage payout approved.`,
        });
      }
    }

    return list.sort((a, b) => a.day - b.day);
  }, [rawAttendanceRecords, attendanceRecords, dayNotes, daysInMonth, currentMonthName, year]);

  // 100% reliable print handler
  const handlePrint = () => {
    printElement('printablePayslipVoucher');
  };

  // High-res PDF download
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    const cleanName = worker.name.replace(/\s+/g, '_');
    const filename = `Payslip_${cleanName}_${currentMonthName}_${year}.pdf`;
    await downloadPayslipPdf('printablePayslipVoucher', filename);
    setIsDownloadingPdf(false);
  };

  // Erase all KYC & Bank details for private payslip
  const handleEraseAllKycBank = () => {
    setIncludeBank(false);
    setIncludeAadhar(false);
    setIncludeAddress(false);
    setIncludePan(false);
    setAccountNumber('');
    setIfscCode('');
    setBankName('');
    setAadharNumber('');
    setAddress('');
    setPanNumber('');
  };

  const handleRestoreAllKycBank = () => {
    setIncludeBank(true);
    setIncludeAadhar(true);
    setIncludeAddress(true);
    setIncludePan(true);
    setAccountNumber(worker.accountNumber || '');
    setIfscCode(worker.ifscCode || '');
    setBankName(worker.bankName || '');
    setAadharNumber(worker.aadharNumber || '');
    setAddress(worker.address || '');
    setPanNumber(worker.panNumber || '');
  };

  // Contractor Profile actions
  const handleSaveContractorAsDefault = () => {
    const profile = {
      name: contractorName,
      tagline: contractorTagline,
      association: contractorAssociation,
      proprietor: contractorProprietor,
      phone: contractorPhone,
      email: contractorEmail,
      license: contractorLicense,
      address: contractorAddress,
    };
    try {
      localStorage.setItem(CONTRACTOR_STORAGE_KEY, JSON.stringify(profile));
      setContractorSavedToast(true);
      setTimeout(() => setContractorSavedToast(false), 2500);
    } catch (e) {
      console.warn('Failed to save contractor profile:', e);
    }
  };

  const handleResetContractorDefaults = () => {
    setIncludeContractor(true);
    setContractorName(DEFAULT_CONTRACTOR.name);
    setContractorTagline(DEFAULT_CONTRACTOR.tagline);
    setContractorAssociation(DEFAULT_CONTRACTOR.association);
    setContractorProprietor(DEFAULT_CONTRACTOR.proprietor);
    setContractorPhone(DEFAULT_CONTRACTOR.phone);
    setContractorEmail(DEFAULT_CONTRACTOR.email);
    setContractorLicense(DEFAULT_CONTRACTOR.license);
    setContractorAddress(DEFAULT_CONTRACTOR.address);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto space-y-4 p-2 sm:p-4">
      {/* Top Navigation & Profile Strip with Worker Next/Prev Shifting Arrows */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 font-bold text-xs"
            title="Back to All Workers Master Sheet"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Master Grid</span>
          </button>

          {/* Quick Worker Navigation Arrows with Integrated Dropdown Select Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 gap-2">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={onPrevWorker}
                disabled={!hasPrevWorker}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Previous Worker (Shift to previous worker payslip)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden lg:inline">Prev</span>
              </button>
              <span className="text-[11px] font-mono font-bold px-2 text-slate-600 dark:text-slate-300">
                Staff List
              </span>
              <button
                type="button"
                onClick={onNextWorker}
                disabled={!hasNextWorker}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Next Worker (Shift to next worker payslip)"
              >
                <span className="hidden lg:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Select/Search worker name dropdown directly inside Ledger! */}
            {allWorkers && onSelectWorker && (() => {
              const matchedWorkers = allWorkers.filter(w =>
                w.name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                w.unit.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
                w.designation.toLowerCase().includes(ledgerSearch.toLowerCase())
              );
              return (
                <div className="relative border-t sm:border-t-0 sm:border-l border-slate-300 dark:border-slate-600 pt-1.5 sm:pt-0 sm:pl-2.5 flex items-center">
                  <div className="relative w-full sm:w-56">
                    <VoiceSearchInput
                      value={ledgerSearch}
                      onChange={(val) => {
                        setLedgerSearch(val);
                        setIsDropdownOpen(true);
                      }}
                      placeholder={`Jump to: ${worker.name}`}
                      size="sm"
                      inputClassName="bg-white dark:bg-slate-700 font-extrabold text-[11px] text-indigo-700 dark:text-indigo-300"
                    />
                    
                    {isDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsDropdownOpen(false)} 
                        />
                        <div className="absolute left-0 mt-1 w-56 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 p-1 divide-y divide-slate-100 dark:divide-slate-750">
                          {matchedWorkers.length === 0 ? (
                            <div className="p-2 text-xs text-slate-400 italic">No matches found</div>
                          ) : (
                            matchedWorkers.map((w) => (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => {
                                  onSelectWorker(w);
                                  setLedgerSearch('');
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-[11px] transition-colors flex items-center justify-between gap-1 ${
                                  w.id === worker.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20 font-bold' : ''
                                }`}
                              >
                                <div>
                                  <div className="font-extrabold text-slate-900 dark:text-white truncate">{w.name}</div>
                                  <div className="text-[9px] text-slate-400 font-semibold">{w.designation}</div>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                  {w.unit}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  worker.unit === 'Furnace A'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                    : worker.unit === 'Furnace B'
                    ? 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 border-orange-300'
                    : 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                {worker.unit}
              </span>

              {/* Dynamic Month/Year picker directly inside payslip! */}
              {onChangeMonth && onChangeYear ? (
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
                  
                  {/* Previous Month Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (month === 1) {
                        onChangeMonth(12);
                        onChangeYear(year - 1);
                      } else {
                        onChangeMonth(month - 1);
                      }
                    }}
                    title="Previous Month"
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Month Selector Display Button with Custom Popover Dropdown (no native arrows) */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsLedgerMonthMenuOpen(!isLedgerMonthMenuOpen)}
                      className="px-2 py-0.5 font-bold text-[11px] text-slate-800 dark:text-slate-200 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-center min-w-[70px] cursor-pointer"
                      title="Select Month"
                    >
                      {monthNames[month - 1]}
                    </button>

                    {isLedgerMonthMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsLedgerMonthMenuOpen(false)} />
                        <div className="absolute left-1/2 -translate-x-1/2 mt-7 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1 divide-y divide-slate-100 dark:divide-slate-750 max-h-60 overflow-y-auto">
                          {monthNames.map((mName, idx) => (
                            <button
                              key={mName}
                              type="button"
                              onClick={() => {
                                onChangeMonth(idx + 1);
                                setIsLedgerMonthMenuOpen(false);
                              }}
                              className={`w-full text-center py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                idx + 1 === month
                                  ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-extrabold'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {mName}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Next Month Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (month === 12) {
                        onChangeMonth(1);
                        onChangeYear(year + 1);
                      } else {
                        onChangeMonth(month + 1);
                      }
                    }}
                    title="Next Month"
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors mr-1"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-1 space-x-0.5">
                    <button
                      type="button"
                      onClick={() => onChangeYear(year - 1)}
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed)) onChangeYear(parsed);
                      }}
                      className="w-12 text-center font-extrabold text-[11px] text-slate-800 dark:text-slate-200 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => onChangeYear(year + 1)}
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-medium">
                  {currentMonthName} {year} ({daysInMonth} Days)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <span>{worker.name}</span>
              {worker.employeeCode && (
                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                  {worker.employeeCode}
                </span>
              )}
            </h2>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                {worker.designation}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{worker.phone || 'No Mobile'}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <span>A/C: {worker.accountNumber || 'Pending'}</span>
              </span>
              <span>&bull;</span>
              <span>
                Base Salary: <strong className="text-slate-900 dark:text-white">{formatCurrency(worker.salary)}</strong>
              </span>
              {worker.joiningDate && (
                <>
                  <span>&bull;</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    📅 Joined: <strong className="text-slate-900 dark:text-white">{worker.joiningDate}</strong>
                  </span>
                </>
              )}
              {worker.dateOfBirth && (
                <>
                  <span>&bull;</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    🎂 DOB: <strong className="text-slate-900 dark:text-white">{worker.dateOfBirth}</strong>
                    {(() => {
                      const ageObj = calculateAge(worker.dateOfBirth);
                      return ageObj ? ` (${ageObj.years}Y, ${ageObj.days}D)` : '';
                    })()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Download PDF + Share Payslip + Customize + Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-all active:scale-95"
            title="Download Payslip as PDF File"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          {/* Share Payslip Button */}
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
            title="Share Payslip on WhatsApp, Apps, or Copy Text"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          {/* Customize Payslip Button */}
          <button
            type="button"
            onClick={() => setIsCustomizing((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isCustomizing
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
            title="Customize Contractor, Association, Tagline, Aadhaar, address, bank details, and print options"
          >
            <Sliders className="w-4 h-4" />
            <span>Customize</span>
          </button>

          {/* Edit Role Transfer / Mid-Month Designation Split Button */}
          {onEditWorker && (
            <button
              type="button"
              onClick={() => onEditWorker(worker)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                calc.hasSplitDesignation
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
              title="Set 5-day / 15-day role changes and split salary calculations"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>{calc.hasSplitDesignation ? 'Edit Role Split' : '+ Role Split'}</span>
            </button>
          )}

          {/* Print Preview Button */}
          <button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="Preview document before printing"
          >
            <Eye className="w-4 h-4" />
            <span>Print Preview</span>
          </button>

          {/* Print Button (Isolated & 100% Reliable) */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95"
            title="Print Official Document with 1-31 Sheet"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sheet</span>
          </button>

          {/* Payout Badge */}
          <div className="text-right bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
              Net Payout
            </span>
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              {includePayoutSalary ? formatCurrency(calc.payoutSalary) : 'Hidden'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CUSTOMIZE PAYSLIP & CONTRACTOR DETAILS PANEL (TAGLINE, ASSOCIATION, OWNER) */}
      {/* ========================================================================= */}
      {isCustomizing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-indigo-500/30 shadow-lg space-y-4 print:hidden animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Customize Contractor, Association Name, Tagline &amp; Owner Details
              </h3>
              <span className="text-xs text-slate-500 hidden sm:inline">
                (By default Contractor info shows on payslip. Toggle or edit below)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleEraseAllKycBank}
                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 flex items-center gap-1"
                title="Erase and hide bank details and Aadhaar from this payslip"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Erase KYC</span>
              </button>
              <button
                type="button"
                onClick={handleRestoreAllKycBank}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
                title="Reset back to worker's saved profile details"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Worker KYC</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCustomizing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {/* Section 1: Contractor, Tagline, Association & Owner Details */}
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-extrabold">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  1. Contractor &amp; Tagline
                </span>
                <input
                  type="checkbox"
                  checked={includeContractor}
                  onChange={(e) => setIncludeContractor(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                  title="Show or hide contractor details on payslip"
                />
              </div>
              <div className="space-y-1.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contractor / Firm Name</label>
                  <input
                    type="text"
                    disabled={!includeContractor}
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    placeholder="Contractor Name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tagline / Sub-heading</label>
                  <input
                    type="text"
                    disabled={!includeContractor}
                    value={contractorTagline}
                    onChange={(e) => setContractorTagline(e.target.value)}
                    placeholder="e.g. Excellence in Industrial Manpower"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Association Name</label>
                  <input
                    type="text"
                    disabled={!includeContractor}
                    value={contractorAssociation}
                    onChange={(e) => setContractorAssociation(e.target.value)}
                    placeholder="Association Name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Owner / Proprietor Name</label>
                  <input
                    type="text"
                    disabled={!includeContractor}
                    value={contractorProprietor}
                    onChange={(e) => setContractorProprietor(e.target.value)}
                    placeholder="Mukesh Puniya"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contractor Phone</label>
                  <input
                    type="tel"
                    disabled={!includeContractor}
                    value={contractorPhone}
                    onChange={(e) => setContractorPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contractor Email</label>
                  <input
                    type="email"
                    disabled={!includeContractor}
                    value={contractorEmail}
                    onChange={(e) => setContractorEmail(e.target.value)}
                    placeholder="contractor@email.com"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-indigo-200/60">
                <button
                  type="button"
                  onClick={handleSaveContractorAsDefault}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                >
                  <Save className="w-3 h-3" />
                  <span>{contractorSavedToast ? 'Saved!' : 'Save as Default'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetContractorDefaults}
                  className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Section 2: Bank Details */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  2. Employee Bank Account Details
                </span>
                <input
                  type="checkbox"
                  checked={includeBank}
                  onChange={(e) => setIncludeBank(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
              </label>
              <div className="space-y-1.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Account Number</label>
                  <input
                    type="text"
                    disabled={!includeBank}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">IFSC Code</label>
                  <input
                    type="text"
                    disabled={!includeBank}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="IFSC Code (e.g. SBIN0001234)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold uppercase disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Bank Name &amp; Branch</label>
                  <input
                    type="text"
                    disabled={!includeBank}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank Name & Branch"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Aadhaar & Address */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  3. Aadhaar &amp; Address
                </span>
                <input
                  type="checkbox"
                  checked={includeAadhar}
                  onChange={(e) => {
                    setIncludeAadhar(e.target.checked);
                    setIncludeAddress(e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-emerald-600"
                />
              </label>
              <div className="space-y-1.5 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Card No. (12-Digit)</label>
                  <input
                    type="text"
                    disabled={!includeAadhar}
                    value={aadharNumber}
                    onChange={(e) => setAadharNumber(e.target.value)}
                    placeholder="Aadhaar No. (e.g. 1234 5678 9012)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Residential Address</label>
                  <input
                    type="text"
                    disabled={!includeAddress}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Residential Address"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">PAN Card Number</label>
                  <input
                    type="text"
                    disabled={!includePan}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="PAN Card No. (e.g. ABCDE1234F)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono uppercase disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Mobile & Layout Options */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  4. Mobile &amp; Layout Options
                </span>
                <input
                  type="checkbox"
                  checked={includePhone}
                  onChange={(e) => setIncludePhone(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
              </label>
              <div className="pt-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Worker Mobile No.</label>
                <input
                  type="tel"
                  disabled={!includePhone}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile / WhatsApp Number"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={includeDailyBreakdown}
                    onChange={(e) => setIncludeDailyBreakdown(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600"
                  />
                  <span>Show 1-31 Shift Audit Table</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={includeSignatures}
                    onChange={(e) => setIncludeSignatures(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600"
                  />
                  <span>Show Official Signature Lines</span>
                </label>
              </div>
            </div>

            {/* Section 5: Financial Rates & Formula Options */}
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <span className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                5. Financial Rates Customization
              </span>
              <div className="space-y-1.5 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeBaseSalary}
                    onChange={(e) => setIncludeBaseSalary(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600"
                  />
                  <span>Show Base Monthly Salary (₹ Rate)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeDailyRate}
                    onChange={(e) => setIncludeDailyRate(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600"
                  />
                  <span>Show Per Day Wage Rate (₹ Rate/Day)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includePayoutSalary}
                    onChange={(e) => setIncludePayoutSalary(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600"
                  />
                  <span>Show Net Payment Amount</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeFormulaNote}
                    onChange={(e) => setIncludeFormulaNote(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600"
                  />
                  <span>Show Step-by-Step Salary Formula</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document View / Download Mode Selector Bar (PROMINENT AT TOP) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-indigo-200 dark:border-indigo-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Document Download &amp; Print Mode:
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              {documentMode === 'payslip_only'
                ? 'Showing Official Payment Slip Only (Clean Payout View)'
                : documentMode === 'attendance_only'
                ? 'Showing Attendance Register Only (Shift Records View)'
                : documentMode === 'account_only'
                ? 'Showing Bank Account Statement Only'
                : 'Showing Full Payslip & 1-31 Shift Audit Table'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1 max-w-xl">
          <button
            type="button"
            onClick={() => setDocumentMode('full')}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all ${
              documentMode === 'full'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Full Payslip
          </button>
          <button
            type="button"
            onClick={() => setDocumentMode('payslip_only')}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all ${
              documentMode === 'payslip_only'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Payment Slip Only
          </button>
          <button
            type="button"
            onClick={() => setDocumentMode('attendance_only')}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all ${
              documentMode === 'attendance_only'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Attendance Only
          </button>
          <button
            type="button"
            onClick={() => setDocumentMode('account_only')}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all ${
              documentMode === 'account_only'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Account Details Only
          </button>
        </div>
      </div>

      {/* Formula & Calculation Breakdown Card (Hidden when in Payment Slip Only or Account Details Only mode) */}
      {includeFormulaNote && (documentMode === 'full' || documentMode === 'attendance_only') && (
        <div className="bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50/60 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 rounded-2xl p-4 sm:p-5 border border-indigo-100 dark:border-indigo-900/40 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Step-by-Step Salary Formula &amp; Payout Breakdown
            </span>
            <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
              Payout = (Monthly Salary ÷ {daysInMonth} Days) × (Working Days + OT Hours ÷ 12)
            </span>
          </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 text-xs">
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Base Shift Days</span>
            <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {calc.baseWorkingDays} Days
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">from P4 regular shifts</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Extra OT Hours</span>
            <span className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
              {calc.totalExtraHours} Hours
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">from P4(hours)</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Converted Days (12h=1D)</span>
            <span className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
              +{calc.convertedDaysFromHours} Days
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Math.floor({calc.totalExtraHours} ÷ 12)</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Remaining OT Hours</span>
            <span className="text-base font-bold text-purple-600 dark:text-purple-400 font-mono">
              {calc.remainingHours} Hours
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({calc.totalExtraHours} % 12)</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Total Working Days</span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {calc.totalWorkingDays} Days
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({calc.baseWorkingDays} + {calc.convertedDaysFromHours})</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 block">Per Day Rate</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ₹{Math.round(calc.perDayRate)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">₹{worker.salary.toLocaleString('en-IN')} ÷ {daysInMonth}d</span>
          </div>
        </div>

        {/* Detailed Calculation Sentence */}
        <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 text-xs font-mono text-slate-700 dark:text-slate-300 border border-indigo-200/50">
          <strong>Step-by-Step Salary Calculation:</strong> (₹{worker.salary.toLocaleString('en-IN')} ÷ {daysInMonth} days) × ({calc.totalWorkingDays} working days + {calc.remainingHours} hrs ÷ 12) = ₹{calc.perDayRate.toFixed(2)} × {calc.totalEquivalentDaysWithFraction.toFixed(2)} days = <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(calc.payoutSalary)}</strong>
        </div>
      </div>
      )}

      {/* MID-MONTH DESIGNATION TRANSFERS & MULTI-ROLE SPLIT SALARY CARD */}
      {calc.hasSplitDesignation && calc.splitBreakdown && calc.splitBreakdown.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/80 dark:from-slate-800/90 dark:via-indigo-950/60 dark:to-slate-900/90 rounded-2xl p-4 sm:p-5 border-2 border-indigo-300 dark:border-indigo-800 shadow-sm space-y-3.5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200 dark:border-indigo-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Mid-Month Designation Transfers &amp; Split Salary Calculation</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 font-bold">
                    {calc.splitBreakdown.length} Post Periods
                  </span>
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Pro-rata wage distribution: worker served different posts with distinct salary rates
                </p>
              </div>
            </div>

            {onEditWorker && (
              <button
                type="button"
                onClick={() => onEditWorker(worker)}
                className="px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-50 shadow-2xs flex items-center gap-1 w-fit cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Adjust Dates / Roles</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {calc.splitBreakdown.map((period, idx) => (
              <div
                key={period.id || idx}
                className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <strong className="text-slate-900 dark:text-white font-black text-xs font-sans uppercase">
                      Days {period.startDay} to {period.endDay} ({period.endDay - period.startDay + 1} Days)
                    </strong>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                    {period.unit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Assigned Post:</span>
                    <strong className="text-xs text-indigo-950 dark:text-indigo-200 uppercase font-sans font-black">
                      {period.designation}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Monthly Base Rate:</span>
                    <strong className="text-xs text-slate-900 dark:text-white">
                      ₹{period.monthlySalary.toLocaleString('en-IN')}/m
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Daily Wage Rate:</span>
                    <strong className="text-xs text-blue-700 dark:text-blue-300">
                      ₹{period.perDayRate.toFixed(2)}/day
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Shifts + OT:</span>
                    <strong className="text-xs text-amber-700 dark:text-amber-300">
                      {period.baseWorkingDays}d + {period.totalExtraHours}h OT
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-750 p-2 rounded-lg">
                  <span className="text-[10px] font-sans font-bold text-slate-600 dark:text-slate-300">
                    Period Earnings ({period.totalEquivalentDays} Eq Days):
                  </span>
                  <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(period.periodPayoutSalary)}
                  </strong>
                </div>

                {period.notes && (
                  <div className="text-[10px] text-slate-500 italic font-sans">
                    Note: {period.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-white font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="font-sans text-[11px] text-slate-300">
              Formula: Sum of pro-rata earnings for each designation period based on days worked
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-sans uppercase font-bold text-[10px]">Total Net Payout:</span>
              <strong className="text-base font-black text-emerald-300">
                {formatCurrency(calc.payoutSalary)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Date 1 to Date 31 Interactive Ledger */}
      {(documentMode === 'full' || documentMode === 'attendance_only') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Daily Attendance Register: Date 1 to Date {daysInMonth}
            </h3>
            <p className="text-xs text-slate-500">
              Tap buttons in each row to set shifts (P4, P4(4), P4+P4, A, WO)
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {calc.presentDaysCount} Days Worked &bull; {calc.totalExtraHours}h OT
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {daysArray.map((day) => {
            const { name: dow, short: shortDow, isSunday, formattedDate } = getDayDetails(day);
            const currentCode = attendanceRecords[day] || '';
            const parsed = parseAttendanceCode(currentCode);
            const activeRole = getWorkerActiveDesignation(worker, day, `${year}-${String(month).padStart(2, '0')}`);

            return (
              <div
                key={day}
                className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors ${
                  isSunday ? 'bg-rose-50/20 dark:bg-rose-950/10' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                }`}
              >
                {/* Date & Day of Week */}
                <div className="flex items-center space-x-3 min-w-[200px]">
                  <div
                    className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center font-bold font-mono text-xs border ${
                      isSunday
                        ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span>{day}</span>
                    <span className="text-[9px] font-normal leading-none uppercase">{shortDow}</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{formattedDate}</span>
                      {isSunday && (
                        <span className="text-[10px] text-rose-500 font-semibold">(Sunday)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {currentCode ? (
                        <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {currentCode} = {parsed.days} Days + {parsed.hours} Hours OT
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not marked</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase font-mono">
                        {activeRole.designation}
                      </span>
                      {activeRole.isTransferred && (
                        <span className="text-[8.5px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                          Transfer Role (₹{activeRole.salary.toLocaleString('en-IN')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Tap Buttons in Row */}
                <div className="flex items-center flex-wrap gap-1.5">
                  {/* P4 single shift */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode === 'P4'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    P4
                  </button>

                  {/* P4(4) */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4(4)')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode.replace(/\s+/g, '') === 'P4(4)'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    P4(4)
                  </button>

                  {/* P4(8) */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4(8)')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode.replace(/\s+/g, '') === 'P4(8)'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    P4(8)
                  </button>

                  {/* P4 + P4 */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4 + P4')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode.replace(/\s+/g, '') === 'P4+P4'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    P4+P4
                  </button>

                  {/* P4(4) + P4(4) */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4(4)+P4(4)')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode.replace(/\s+/g, '') === 'P4(4)+P4(4)'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    P4(4)+P4(4)
                  </button>

                  {/* P4 + P4 + P4 */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'P4+P4+P4')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode.replace(/\s+/g, '') === 'P4+P4+P4'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    3×P4
                  </button>

                  {/* Absent */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'A')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode === 'A'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-rose-600 border-slate-200 dark:border-slate-700 hover:bg-rose-50'
                    }`}
                  >
                    A
                  </button>

                  {/* Weekly Off */}
                  <button
                    type="button"
                    onClick={() => onUpdateCode(day, 'WO')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                      currentCode === 'WO'
                        ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    WO
                  </button>

                  {/* Custom Hours / Modal Opener */}
                  <button
                    type="button"
                    onClick={() => onOpenQuickTapModal(day)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                  >
                    Custom Hours (1-12)...
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* PROFESSIONAL EXECUTIVE PAYSLIP & DATE 1-31 MONTHLY ATTENDANCE REGISTER */}
      {/* (TARGET FOR PDF DOWNLOAD & OFFICIAL PRINTING) */}
      {/* ========================================================================= */}
      <div
        id="printablePayslipVoucher"
        className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-xl space-y-6 print:p-6 print:border-2 print:border-slate-300 print:rounded-2xl print:shadow-none print:m-0 print:bg-white"
      >
        {/* CONTRACTOR, TAGLINE & ASSOCIATION TOP BANNER (UNIQUE & EXECUTIVE TEMPLATE) */}
        {includeContractor && contractorName && (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border-2 border-amber-500/30 shadow-lg relative overflow-hidden">
            {/* Subtle Gold Decorative Accent */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="space-y-1.5 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  ESTABLISHMENT &bull; AUTHORIZED MANPOWER CONTRACTOR
                </span>
                {contractorLicense && (
                  <span className="text-[10px] font-mono font-bold text-amber-300/90 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    Lic No: {contractorLicense}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-white mt-1">
                {contractorName}
              </h2>
              {contractorTagline && (
                <p className="text-xs text-amber-300 font-bold italic">
                  &ldquo;{contractorTagline}&rdquo;
                </p>
              )}
              {contractorAssociation && (
                <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  <span>Association: {contractorAssociation}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap md:flex-col items-start md:items-end gap-x-4 gap-y-1 text-xs text-slate-300 font-mono z-10">
              {contractorProprietor && (
                <div className="md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Proprietor / Owner:</span>
                  <strong className="text-white text-xs font-bold">{contractorProprietor}</strong>
                </div>
              )}
              {contractorPhone && (
                <div className="md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Mobile / WhatsApp:</span>
                  <strong className="text-amber-300 text-xs font-bold">{contractorPhone}</strong>
                </div>
              )}
              {contractorEmail && (
                <div className="md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Contractor Email:</span>
                  <strong className="text-indigo-200 text-xs font-bold">{contractorEmail}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Executive Payslip Header */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Flame className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  {documentMode === 'attendance_only'
                    ? 'ATTENDANCE STATEMENT REPORT'
                    : documentMode === 'account_only'
                    ? 'BANK ACCOUNT & PAYOUT STATEMENT'
                    : documentMode === 'payslip_only'
                    ? 'OFFICIAL PAYMENT SLIP'
                    : 'OFFICIAL SALARY VOUCHER'}
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  VOUCHER #{worker.employeeCode || `EMP-${worker.id.slice(-4).toUpperCase()}`}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950 mt-1">
                {documentMode === 'attendance_only'
                  ? 'Monthly Shift Attendance Register'
                  : documentMode === 'account_only'
                  ? 'Employee Bank Account & Payout Statement'
                  : documentMode === 'payslip_only'
                  ? 'Monthly Wage Payment Slip'
                  : 'Monthly Wage Payslip & Attendance Statement'}
              </h1>
              <p className="text-xs font-bold text-slate-600">
                Plant Section: <strong className="text-slate-950 uppercase">{worker.unit}</strong> &bull; Period:{' '}
                <strong className="text-indigo-950">{currentMonthName} {year} ({daysInMonth} Days)</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1 font-mono text-xs">
            <div className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-300 text-right">
              <span className="text-[10px] text-slate-500 font-sans font-bold block uppercase">Disbursement Date</span>
              <strong className="text-xs text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>
        </div>

        {/* 3-Section Executive Identity, KYC & Bank Details Matrix (DEFAULT SHOWN) */}
        <div className={`grid grid-cols-1 ${documentMode === 'account_only' ? 'grid-cols-1' : 'md:grid-cols-2'} gap-4`}>
          {/* Card 1: Worker Identity & Duty Profile */}
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-300 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Employee Identity &amp; KYC
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{worker.unit}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Worker Name:</span>
                <strong className="text-sm font-black text-slate-950">{worker.name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Father / Guardian:</span>
                <strong className="text-xs font-bold text-slate-800">{fatherName || worker.fatherName || 'On Record'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Designation (Role):</span>
                <strong className="text-xs font-extrabold text-indigo-900 uppercase">{worker.designation}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Staff ID / Code:</span>
                <strong className="text-xs font-bold text-slate-800">{worker.employeeCode || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Joining Date:</span>
                <strong className="text-xs font-bold text-slate-800">{worker.joiningDate || 'On Record'}</strong>
              </div>
              <div className="col-span-2 pt-1.5 border-t border-slate-200/80 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Date of Birth:</span>
                  <strong className="text-xs font-bold text-slate-800">
                    {worker.dateOfBirth ? new Date(worker.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'On Record'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Employee Age:</span>
                  <strong className="text-xs font-bold text-indigo-900 dark:text-indigo-400">
                    {(() => {
                      const ageObj = calculateAge(worker.dateOfBirth);
                      return ageObj ? `${ageObj.years} Years, ${ageObj.days} Days` : 'On Record';
                    })()}
                  </strong>
                </div>
              </div>

              {/* Aadhaar Number (DEFAULT SHOWN) */}
              {includeAadhar && documentMode !== 'attendance_only' && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-emerald-600" />
                    Aadhaar Number:
                  </span>
                  <strong className="text-xs font-black text-slate-950 tracking-wider">
                    {aadharNumber || worker.aadharNumber || 'On Record'}
                  </strong>
                </div>
              )}

              {/* Mobile Number */}
              {includePhone && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    Mobile Number:
                  </span>
                  <strong className="text-xs font-bold text-emerald-800">
                    {phone || worker.phone || 'On Record'}
                  </strong>
                </div>
              )}

              {/* Address (DEFAULT SHOWN) */}
              {includeAddress && documentMode !== 'attendance_only' && (
                <div className="col-span-2 pt-1 border-t border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    Residential Address:
                  </span>
                  <span className="text-xs font-sans text-slate-800 font-semibold">
                    {address || worker.address || 'Address On Employee Record'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Bank Account & Payment Routing Box (DEFAULT SHOWN in full, account_only, payslip_only) */}
          {documentMode !== 'attendance_only' && (includeBank ? (
            <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-indigo-200/80">
                  <div className="flex items-center space-x-1.5">
                    <Landmark className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                      Employee Bank Account Details
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Direct NEFT / Transfer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono mt-2.5">
                  <div>
                    <span className="text-[10px] text-indigo-900/70 uppercase block font-sans font-bold flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-indigo-600" />
                      Bank Account Number:
                    </span>
                    <strong className="text-sm font-black text-slate-950 tracking-wider">
                      {accountNumber || worker.accountNumber || 'Pending / In Record'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-900/70 uppercase block font-sans font-bold flex items-center gap-1">
                      <Hash className="w-3 h-3 text-amber-600" />
                      Bank IFSC Code:
                    </span>
                    <strong className="text-xs font-black text-indigo-900 uppercase">
                      {ifscCode || worker.ifscCode || 'Pending / In Record'}
                    </strong>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-indigo-900/70 uppercase block font-sans font-bold flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-600" />
                      Bank Name &amp; Branch:
                    </span>
                    <strong className="text-xs font-sans font-bold text-slate-900">
                      {bankName || worker.bankName || 'Salary Account (NEFT Direct Credit)'}
                    </strong>
                  </div>
                </div>
              </div>

              {includePan && (panNumber || worker.panNumber) && (
                <div className="pt-2 border-t border-indigo-200/80 text-[11px] font-mono flex items-center justify-between text-indigo-900">
                  <span className="font-sans font-bold text-[10px] uppercase">PAN Card Number:</span>
                  <strong>{panNumber || worker.panNumber}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500 italic">
              Bank Account Details Removed from Payslip (Customized View)
            </div>
          ))}
        </div>

        {/* SIMPLE & CLEAN ATTENDANCE SUMMARY */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">Base Shift Days:</span>
              <strong className="text-base sm:text-lg font-extrabold text-white">{calc.baseWorkingDays} Days</strong>
            </div>
            <div>
              <span className="text-[10px] text-amber-400 font-sans uppercase font-bold block">Overtime Hours:</span>
              <strong className="text-base sm:text-lg font-extrabold text-amber-300">
                {calc.totalExtraHours} Hours OT
              </strong>
              <span className="text-[10px] text-amber-300/80 block font-sans">
                (+{calc.convertedDaysFromHours}d {calc.remainingHours > 0 ? `+${calc.remainingHours}h` : ''})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-indigo-300 font-sans uppercase font-bold block">Total Working Days:</span>
              <strong className="text-base sm:text-lg font-black text-indigo-200">
                {calc.totalWorkingDays} Days {calc.remainingHours > 0 ? `+ ${calc.remainingHours}h` : ''}
              </strong>
            </div>
            {includeBaseSalary && (
              <div>
                <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">Base Monthly Salary:</span>
                <strong className="text-base sm:text-lg font-bold text-slate-200">₹{worker.salary.toLocaleString('en-IN')}</strong>
              </div>
            )}
            {includeDailyRate && (
              <div>
                <span className="text-[10px] text-blue-300 font-sans uppercase font-bold block">Per Day Wage Rate:</span>
                <strong className="text-base sm:text-lg font-bold text-blue-200">₹{Math.round(calc.perDayRate).toLocaleString('en-IN')}/d</strong>
              </div>
            )}
            {includePayoutSalary && (documentMode !== 'attendance_only' ? (
              <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-500/50">
                <span className="text-[10px] text-emerald-300 font-sans uppercase font-bold block">Net Payment:</span>
                <strong className="text-lg sm:text-xl font-black text-emerald-300">{formatCurrency(calc.payoutSalary)}</strong>
              </div>
            ) : (
              <div className="bg-indigo-950/80 p-2.5 rounded-xl border border-indigo-500/50">
                <span className="text-[10px] text-indigo-300 font-sans uppercase font-bold block">Days Present:</span>
                <strong className="text-base sm:text-lg font-black text-indigo-200">{calc.presentDaysCount} Days</strong>
              </div>
            ))}
          </div>
        </div>

        {/* EXECUTIVE DESIGNATION TRANSFER & SPLIT SALARY BOX (PRINT & PDF VOUCHER) */}
        {calc.hasSplitDesignation && calc.splitBreakdown && calc.splitBreakdown.length > 0 && (
          <div className="bg-indigo-50/70 p-4 rounded-2xl border-2 border-indigo-300 space-y-2.5 print:bg-indigo-50/50 print:border-2 print:border-indigo-400">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                  Mid-Month Designation Transfers &amp; Split Salary Calculation Statement
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                {calc.splitBreakdown.length} Post Periods Total
              </span>
            </div>

            <p className="text-[10.5px] text-slate-700 font-sans leading-tight">
              * The worker was transferred / reassigned across different designations during this month. Daily wages and overtime have been calculated pro-rata per active designation rate:
            </p>

            <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-[10.5px] border-collapse font-mono">
                <thead className="bg-indigo-100/70 text-indigo-950 font-bold border-b border-indigo-200">
                  <tr>
                    <th className="py-2 px-2 text-left">Period (Date Range)</th>
                    <th className="py-2 px-2 text-left">Assigned Role</th>
                    <th className="py-2 px-2 text-center">Unit</th>
                    <th className="py-2 px-2 text-right">Base Salary</th>
                    <th className="py-2 px-2 text-right">Day Rate</th>
                    <th className="py-2 px-2 text-center">Shifts + OT</th>
                    <th className="py-2 px-2 text-center">Eq. Days</th>
                    <th className="py-2 px-2.5 text-right font-black">Earned Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-100">
                  {calc.splitBreakdown.map((p, idx) => (
                    <tr key={p.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30'}>
                      <td className="py-1.5 px-2 font-bold text-slate-900">
                        Days {p.startDay}–{p.endDay} ({p.endDay - p.startDay + 1}d)
                      </td>
                      <td className="py-1.5 px-2 font-black uppercase text-indigo-900">
                        {p.designation}
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-700 font-sans text-[10px]">
                        {p.unit}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-800">
                        ₹{p.monthlySalary.toLocaleString('en-IN')}/m
                      </td>
                      <td className="py-1.5 px-2 text-right text-blue-900 font-bold">
                        ₹{p.perDayRate.toFixed(2)}/d
                      </td>
                      <td className="py-1.5 px-2 text-center text-amber-900 font-bold">
                        {p.baseWorkingDays}d + {p.totalExtraHours}h
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-900">
                        {p.totalEquivalentDays}d
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-black text-emerald-800 text-xs">
                        {formatCurrency(p.periodPayoutSalary)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-900">
                  <tr>
                    <td colSpan={6} className="py-2 px-2 text-right uppercase text-[10px] tracking-wider text-slate-300">
                      COMBINED TOTAL NET PAYOUT:
                    </td>
                    <td className="py-2 px-2 text-center text-amber-300 text-xs font-bold">
                      {calc.totalWorkingDays} Days {calc.remainingHours > 0 ? `+ ${calc.remainingHours}h` : ''}
                    </td>
                    <td className="py-2 px-2.5 text-right text-emerald-300 text-sm font-black">
                      {formatCurrency(calc.payoutSalary)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Detailed 1 to 31 Daily Attendance Table (Shown in full or attendance_only) */}
        {(documentMode === 'full' || documentMode === 'attendance_only') && includeDailyBreakdown && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-700" />
                <span>Complete Day 1 to Day {daysInMonth} Shift Attendance Record:</span>
              </h3>
              <div className="text-[11px] font-bold text-slate-800 font-mono bg-slate-100 px-3 py-1 rounded-xl border border-slate-300 flex items-center gap-2">
                <span>Shifts: <strong className="text-slate-950">{calc.baseWorkingDays} Days</strong></span>
                <span>&bull;</span>
                <span>OT: <strong className="text-amber-700">{calc.totalExtraHours} Hours (+{calc.convertedDaysFromHours}d)</strong></span>
                <span>&bull;</span>
                <span>Total: <strong className="text-indigo-900">{calc.totalWorkingDays} Days {calc.remainingHours > 0 ? `+ ${calc.remainingHours} Hours` : ''}</strong></span>
              </div>
            </div>

            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-[11px] text-left border-collapse font-mono">
                <thead className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-2 border-r border-slate-300 text-center w-12">Date</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center w-12">Day</th>
                    <th className="py-2 px-3 border-r border-slate-300">Marked Shift Code</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center">Working Days</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center">OT Hours</th>
                    <th className="py-2 px-3">Daily Status &amp; Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {daysArray.map((day) => {
                    const { short: shortDow, isSunday } = getDayDetails(day);
                    const code = attendanceRecords[day] || '-';
                    const parsed = parseAttendanceCode(code);
                    const dayNoteObj = workerShiftNotes.find((n: any) => n.day === day);
                    const activeRole = getWorkerActiveDesignation(worker, day, `${year}-${String(month).padStart(2, '0')}`);

                    let statusText = 'Not Marked / Off';
                    if (code === 'P4') statusText = 'Present (1 Full Shift)';
                    else if (code.startsWith('P4(')) statusText = `Present (1 Shift + ${parsed.hours}h Overtime)`;
                    else if (code === 'P4 + P4') statusText = 'Present (Double Shift - 2 Days)';
                    else if (code.includes('P4(4)+P4(4)')) statusText = 'Present (Double Shift with OT)';
                    else if (code.includes('P4+P4+P4')) statusText = 'Present (Triple Shift - 3 Days)';
                    else if (code === 'A') statusText = 'Absent';
                    else if (code === 'WO') statusText = 'Weekly Off';
                    else if (code === 'HD') statusText = 'Half Day (0.5 Day)';

                    return (
                      <tr key={day} className={isSunday ? 'bg-rose-50/50' : day % 2 === 0 ? 'bg-slate-50/40' : 'bg-white'}>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold">{day}</td>
                        <td className={`py-1.5 px-2 border-r border-slate-300 text-center uppercase font-bold ${isSunday ? 'text-rose-600' : 'text-slate-600'}`}>
                          {shortDow}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-300 font-extrabold text-slate-950">
                          {code}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-indigo-900">
                          {parsed.days > 0 ? `${parsed.days}d` : '-'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-amber-900">
                          {parsed.hours > 0 ? `${parsed.hours}h` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-700 font-sans text-[10px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{statusText}</span>
                            <span className="font-mono font-bold text-[9px] text-indigo-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300 uppercase">
                              {activeRole.designation}
                            </span>
                          </div>
                          {dayNoteObj && (
                            <div className="mt-1 p-1.5 bg-amber-50/90 rounded-md border border-amber-300/80 text-amber-950 text-[9.5px] leading-tight space-y-0.5">
                              <div className="font-bold text-amber-900">
                                📌 Duty Note: <span className="font-semibold text-slate-900">{dayNoteObj.combinedReason}</span>
                              </div>
                              <div className="text-emerald-700 font-semibold text-[8.5px]">
                                ✓ Specific Duty Performed — Wage Payout Approved
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-900 font-mono">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 uppercase text-right tracking-wider text-xs border-r border-slate-700">
                      TOTAL MONTHLY ATTENDANCE:
                    </td>
                    <td className="py-2.5 px-2 text-center text-amber-300 text-xs font-black border-r border-slate-700">
                      {calc.baseWorkingDays} Days
                    </td>
                    <td className="py-2.5 px-2 text-center text-amber-300 text-xs font-black border-r border-slate-700">
                      {calc.totalExtraHours} Hours OT
                    </td>
                    <td className="py-2.5 px-3 text-emerald-300 text-xs font-sans">
                      {calc.baseWorkingDays} Shift Days + {calc.convertedDaysFromHours} Day ({calc.remainingHours}h OT) = <strong>{calc.totalWorkingDays} Total Working Days {calc.remainingHours > 0 ? `+ ${calc.remainingHours} Hours` : ''}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* SPECIFIC SHIFT DUTY TASK NOTES & WAGE APPROVAL JUSTIFICATION CARD */}
        {workerShiftNotes.length > 0 && (
          <div className="bg-amber-50/60 rounded-2xl p-4 sm:p-5 border-2 border-amber-300 shadow-xs space-y-3 print:bg-amber-50/40 print:border-2 print:border-amber-300 print:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-amber-200 gap-1.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-800" />
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                  Shift Duty Task Notes &amp; Salary Approval Justification ({workerShiftNotes.length} Verified Tasks)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-mono flex items-center gap-1 w-fit">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Wage Disbursal Approved
              </span>
            </div>

            <p className="text-[11px] text-amber-950 leading-relaxed font-sans">
              * The worker performed the following specific duty assignments, machine operations, and overtime tasks on these dates. The monthly salary and overtime calculations reflect these approved duties:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {workerShiftNotes.map((note: any) => (
                <div
                  key={note.day}
                  className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 font-mono">
                      📅 Date: {note.dateStr}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono border border-slate-300">
                      Shift: {note.code}
                    </span>
                  </div>
                  <div className="text-slate-800 font-medium">
                    <span className="text-amber-900 font-bold">Duty Work Done: </span>
                    <span className="font-semibold text-slate-900">{note.combinedReason}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Wage Approved: Assigned specific work performed on Date {note.day}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clean Official Document & Formula Note */}
        {includeFormulaNote && documentMode !== 'attendance_only' && (
          <div className="text-[10px] text-slate-600 font-mono border-t border-slate-200 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>
              * <strong>Step-by-Step Formula:</strong> (Monthly Salary ₹{worker.salary.toLocaleString('en-IN')} ÷ {daysInMonth} Days) × ({calc.baseWorkingDays} Shift Days + {calc.totalExtraHours}h OT ÷ 12) = <strong>{formatCurrency(calc.payoutSalary)}</strong>
            </span>
            <span className="font-bold text-slate-800">12 Hours Overtime = 1 Full Working Day</span>
          </div>
        )}
        <div className="text-[10px] text-slate-500 font-mono border-t border-slate-200 pt-2 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span>* Official Computerized Attendance &amp; Payroll Statement</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/55 dark:bg-indigo-950/20 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
            Printed/Shared on: {getPayslipTimestamp()}
          </span>
          <span className="font-bold text-slate-700">System Verified Voucher</span>
        </div>

        {/* Official Signatures & Contractor Seal Block */}
        {(documentMode === 'full' || documentMode === 'payslip_only') && includeSignatures && (
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs font-bold text-slate-800">
            <div className="border-t-2 border-slate-400 pt-2">
              <span className="block text-[11px]">Worker Signature / Thumb</span>
              <span className="text-[10px] text-slate-400 font-normal font-mono">{worker.name}</span>
            </div>
            <div className="border-t-2 border-slate-400 pt-2">
              <span className="block text-[11px]">Shift Supervisor Incharge</span>
              <span className="text-[10px] text-slate-400 font-normal font-mono">Verified Shift Records</span>
            </div>
            <div className="border-t-2 border-slate-400 pt-2">
              <span className="block text-[11px]">Contractor Authorized Signatory</span>
              <span className="text-[10px] text-slate-500 font-semibold font-mono">
                {includeContractor && contractorName ? contractorName.slice(0, 22) : 'Authorized Stamp & Sign'}
              </span>
            </div>
            <div className="border-t-2 border-slate-400 pt-2">
              <span className="block text-[11px]">Plant Manager / Accounts</span>
              <span className="text-[10px] text-slate-400 font-normal font-mono">Approved for Payment</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Controls: Download PDF + Share Payslip at the down side */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 pb-4 border-t border-slate-200 dark:border-slate-800 print:hidden">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          title="Download Payslip as PDF File"
        >
          {isDownloadingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF (Bottom)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          title="Share Payslip on WhatsApp, Apps, or Copy Text"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Payslip (Bottom)</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          title="Print official copy"
        >
          <Printer className="w-4 h-4" />
          <span>Print Sheet (Bottom)</span>
        </button>
      </div>

      {/* Share Payslip Modal */}
      <SharePayslipModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        worker={worker}
        monthName={currentMonthName}
        year={year}
        daysInMonth={daysInMonth}
        calc={calc}
        attendanceRecords={attendanceRecords}
        includeBank={includeBank}
        accountNumber={accountNumber || worker.accountNumber || ''}
        ifscCode={ifscCode || worker.ifscCode || ''}
        bankName={bankName || worker.bankName || ''}
        includePhone={includePhone}
        phone={phone || worker.phone || ''}
        includeAadhar={includeAadhar}
        aadharNumber={aadharNumber || worker.aadharNumber || ''}
        includeAddress={includeAddress}
        address={address || worker.address || ''}
        includeDailyBreakdown={includeDailyBreakdown}
        includeBaseSalary={includeBaseSalary}
        includeDailyRate={includeDailyRate}
        includePayoutSalary={includePayoutSalary}
        includeFormulaNote={includeFormulaNote}
        includeContractor={includeContractor}
        contractorName={contractorName}
        contractorAssociation={contractorAssociation}
        contractorPhone={contractorPhone}
        contractorEmail={contractorEmail}
        contractorLicense={contractorLicense}
        workerShiftNotes={workerShiftNotes}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        printedSharedOn={getPayslipTimestamp()}
      />

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
                    Worker Attendance &amp; Ledger Document preview. Zero toolbars included.
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
              <div className="p-4 rounded-xl border-2 border-black bg-white space-y-4 text-center">
                <h3 className="text-sm font-black uppercase text-black">{contractorName || 'STEEL PLANT MANPOWER SERVICES'}</h3>
                <h4 className="text-xs font-bold text-black">Official Monthly Attendance &amp; Payout Ledger: {worker.name} ({worker.designation})</h4>
                <p className="text-xs text-black">Period: {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} {year} &bull; Base Salary: ₹{worker.salary?.toLocaleString('en-IN')}</p>
                <div className="p-4 bg-slate-50 border border-black rounded-lg text-left text-xs font-bold">
                  <div>Worker: {worker.name}</div>
                  <div>Unit: {worker.unit}</div>
                  <div>Net Payout: {includePayoutSalary ? formatCurrency(calc.payoutSalary) : 'Hidden'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
