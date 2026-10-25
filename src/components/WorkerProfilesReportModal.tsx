import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Filter,
  Search,
  Users,
  CreditCard,
  User,
  Building2,
  Calendar,
  FileText,
  Sparkles,
  Phone,
  Shield,
  BadgeCheck,
  Briefcase,
  Layers,
  LayoutGrid,
  TableProperties,
  Share2,
  Mail,
  MessageSquare,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Eye,
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { downloadElementAsMultiPagePdf } from '../utils/multiPagePdf';
import { printElementDirect } from '../utils/printHelper';
import { Worker, PlantUnit, AttendanceDatabase, AttendanceCalculation } from '../types/attendance';
import { formatCurrency, calculateWorkerMonthlyAttendance, getDaysInMonth } from '../utils/attendanceCalculator';
import { getAttendanceCode } from '../utils/attendanceSyncEngine';
import { VoiceSearchInput } from './VoiceSearchInput';

interface WorkerProfilesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  masterWorkers: Worker[];
  contractorName?: string;
  year?: number;
  month?: number;
  monthName?: string;
  attendanceDb?: AttendanceDatabase;
  calculations?: Record<string, AttendanceCalculation>;
}

export const WorkerProfilesReportModal: React.FC<WorkerProfilesReportModalProps> = ({
  isOpen,
  onClose,
  workers,
  masterWorkers,
  contractorName = 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES',
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  monthName = 'October',
  attendanceDb = {},
  calculations = {},
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Source worker pool: master directory combined with current month workers
  const allAvailableWorkers = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((w) => map.set(w.id, w));
    masterWorkers.forEach((mw) => {
      if (!map.has(mw.id)) {
        map.set(mw.id, mw);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [workers, masterWorkers]);

  // Initial selection: all workers selected by default
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(
    () => new Set(allAvailableWorkers.map((w) => w.id))
  );

  const [unitFilter, setUnitFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'single-row' | 'single-card' | 'dossier-grid' | 'attendance-register'>('single-row');
  const [isWorkerPickerOpen, setIsWorkerPickerOpen] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(true);

  // Custom fields inclusion toggles (Independent DOB and Age toggles)
  const [includeFields, setIncludeFields] = useState({
    designation: true,
    unit: true,
    salary: true,
    employeeCode: true,
    fatherName: true,
    dateOfBirth: true,
    age: true,
    joiningDate: true,
    phone: true,
    accountNumber: true,
    ifscCode: true,
    bankName: true,
    aadharNumber: true,
    panNumber: true,
    address: true,
    notes: true,
  });

  if (!isOpen) return null;

  // Search filter across: Name, Designation, Unit, Father Name, Notes, Account Number, Phone, Aadhaar, PAN
  const filteredList = allAvailableWorkers.filter((w) => {
    const matchesUnit = unitFilter === 'All' || w.unit === unitFilter;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesUnit;

    const matchesSearch =
      w.name.toLowerCase().includes(query) ||
      w.designation.toLowerCase().includes(query) ||
      w.unit.toLowerCase().includes(query) ||
      (w.fatherName && w.fatherName.toLowerCase().includes(query)) ||
      (w.notes && w.notes.toLowerCase().includes(query)) ||
      (w.accountNumber && w.accountNumber.includes(query)) ||
      (w.phone && w.phone.includes(query)) ||
      (w.aadharNumber && w.aadharNumber.includes(query)) ||
      (w.panNumber && w.panNumber.toLowerCase().includes(query)) ||
      (w.employeeCode && w.employeeCode.toLowerCase().includes(query));

    return matchesUnit && matchesSearch;
  });

  const selectedWorkers = allAvailableWorkers.filter((w) => selectedWorkerIds.has(w.id));

  // Selection Handlers
  const handleSelectAll = () => {
    setSelectedWorkerIds(new Set(allAvailableWorkers.map((w) => w.id)));
  };

  const handleDeselectAll = () => {
    setSelectedWorkerIds(new Set());
  };

  const handleSelectFilteredOnly = () => {
    setSelectedWorkerIds(new Set(filteredList.map((w) => w.id)));
  };

  const handleToggleWorker = (id: string) => {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleField = (field: keyof typeof includeFields) => {
    setIncludeFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Helper for Age calculation
  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let ageYears = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      ageYears--;
    }
    return ageYears >= 0 ? `${ageYears} Yrs` : null;
  };

  // 1. Isolated Print (Prints ONLY selected workers, zero dashboard leakage)
  const handlePrint = async () => {
    if (!printAreaRef.current) return;
    await printElementDirect(
      printAreaRef.current,
      'portrait',
      `${contractorName} - Worker Profiles Register`
    );
  };

  // 2. Download Multi-Page Canvas PDF (Visual parity with colors)
  const handleDownloadPDF = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const fileName = `Staff_Profiles_${new Date().toISOString().slice(0, 10)}.pdf`;
      await downloadElementAsMultiPagePdf(printAreaRef.current, fileName, 'p');
    } catch (err) {
      console.error('PDF Generation failed, falling back to direct print:', err);
      await handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. Instant Vector PDF (Ultra-fast 0-lag jsPDF autotable)
  const handleDownloadVectorPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(contractorName, 40, 40);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Staff & Manpower Profiles Register • Total Workers: ${selectedWorkers.length}`, 40, 56);
      doc.text(`Report Date: ${new Date().toLocaleDateString('en-GB')}`, 40, 70);

      const headers: string[] = ['#', 'Worker Name'];
      if (includeFields.unit) headers.push('Unit');
      if (includeFields.designation) headers.push('Designation');
      if (includeFields.salary) headers.push('Salary (₹)');
      if (includeFields.fatherName) headers.push('Father Name');
      if (includeFields.dateOfBirth) headers.push('DOB');
      if (includeFields.age) headers.push('Age');
      if (includeFields.joiningDate) headers.push('Joining');
      if (includeFields.accountNumber) headers.push('Bank A/C');
      if (includeFields.ifscCode) headers.push('IFSC');
      if (includeFields.bankName) headers.push('Bank Name');
      if (includeFields.aadharNumber) headers.push('Aadhaar');
      if (includeFields.panNumber) headers.push('PAN');
      if (includeFields.phone) headers.push('Phone');

      const rows = selectedWorkers.map((w, idx) => {
        const r: (string | number)[] = [idx + 1, w.name];
        if (includeFields.unit) r.push(w.unit);
        if (includeFields.designation) r.push(w.designation.toUpperCase());
        if (includeFields.salary) r.push(`₹${w.salary.toLocaleString('en-IN')}`);
        if (includeFields.fatherName) r.push(w.fatherName || '—');
        if (includeFields.dateOfBirth) r.push(w.dateOfBirth || '—');
        if (includeFields.age) r.push(calculateAge(w.dateOfBirth) || '—');
        if (includeFields.joiningDate) r.push(w.joiningDate || '—');
        if (includeFields.accountNumber) r.push(w.accountNumber || '—');
        if (includeFields.ifscCode) r.push(w.ifscCode || '—');
        if (includeFields.bankName) r.push(w.bankName || '—');
        if (includeFields.aadharNumber) r.push(w.aadharNumber || '—');
        if (includeFields.panNumber) r.push(w.panNumber || '—');
        if (includeFields.phone) r.push(w.phone || '—');
        return r;
      });

      (doc as any).autoTable({
        head: [headers],
        body: rows,
        startY: 85,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`Staff_Profiles_Fast_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Vector PDF generation error:', err);
      handleDownloadPDF();
    }
  };

  // 4. Share PDF Document
  const handleSharePDFDocument = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const fileName = `Staff_Profiles_${new Date().toISOString().slice(0, 10)}.pdf`;
      await downloadElementAsMultiPagePdf(printAreaRef.current, fileName, 'p');
    } catch (err) {
      console.error('Share PDF error:', err);
      await handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 5. Share in WhatsApp Font (Text Format Only)
  const handleShareWhatsApp = () => {
    const header = `*📋 ${contractorName}*\n*Worker Profiles & Bank Details Register*\n_Total Workers: ${selectedWorkers.length} | Date: ${new Date().toLocaleDateString()}_\n\n`;

    const body = selectedWorkers
      .map((w, idx) => {
        let details = `${idx + 1}. *${w.name}* (${w.unit} - ${w.designation.toUpperCase()})\n`;
        if (includeFields.salary) details += `   • Base Salary: ₹${w.salary.toLocaleString('en-IN')}\n`;
        if (includeFields.fatherName && w.fatherName) details += `   • Father: ${w.fatherName}\n`;
        if (includeFields.dateOfBirth && w.dateOfBirth) details += `   • DOB: ${w.dateOfBirth}\n`;
        if (includeFields.age && w.dateOfBirth) details += `   • Age: ${calculateAge(w.dateOfBirth) || '—'}\n`;
        if (includeFields.accountNumber && w.accountNumber) details += `   • Bank A/C: ${w.accountNumber} (${w.bankName || ''})\n`;
        if (includeFields.ifscCode && w.ifscCode) details += `   • IFSC: ${w.ifscCode}\n`;
        if (includeFields.aadharNumber && w.aadharNumber) details += `   • Aadhaar: ${w.aadharNumber}\n`;
        if (includeFields.panNumber && w.panNumber) details += `   • PAN: ${w.panNumber}\n`;
        if (includeFields.phone && w.phone) details += `   • Phone: ${w.phone}\n`;
        if (includeFields.notes && w.notes) details += `   • Notes: ${w.notes}\n`;
        return details;
      })
      .join('\n');

    const fullText = header + body;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
    window.open(whatsappUrl, '_blank');
  };

  // 6. Share via Email
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`${contractorName} - Staff Profiles & Bank Details Report`);
    const bodyText = selectedWorkers
      .map((w, idx) => {
        return `${idx + 1}. ${w.name} | ${w.unit} | ${w.designation.toUpperCase()} | Salary: Rs. ${w.salary} | A/C: ${w.accountNumber || 'N/A'} | IFSC: ${w.ifscCode || 'N/A'} | Aadhaar: ${w.aadharNumber || 'N/A'} | Phone: ${w.phone || 'N/A'}`;
      })
      .join('\n');

    const body = encodeURIComponent(
      `Dear Sir/Madam,\n\nPlease find the staff profiles and bank account details below:\n\n${bodyText}\n\nGenerated securely from Staff Attendance & Payroll Manager on ${new Date().toLocaleDateString()}.`
    );

    try {
      const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
      const link = document.createElement('a');
      link.href = mailtoUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        } catch {}
      }, 300);
    } catch (err) {
      console.warn('Mailto dispatch notice:', err);
    }
  };

  // 7. Export to CSV
  const handleExportCSV = () => {
    const headers = ['S.No.', 'Worker Name'];
    if (includeFields.unit) headers.push('Plant Unit');
    if (includeFields.designation) headers.push('Designation');
    if (includeFields.salary) headers.push('Base Salary (Rs.)');
    if (includeFields.fatherName) headers.push('Father / Guardian Name');
    if (includeFields.dateOfBirth) headers.push('Date of Birth');
    if (includeFields.age) headers.push('Age');
    if (includeFields.joiningDate) headers.push('Date of Joining');
    if (includeFields.accountNumber) headers.push('Bank Account Number');
    if (includeFields.ifscCode) headers.push('IFSC Code');
    if (includeFields.bankName) headers.push('Bank Name');
    if (includeFields.aadharNumber) headers.push('Aadhaar Number');
    if (includeFields.panNumber) headers.push('PAN Number');
    if (includeFields.phone) headers.push('Phone Number');
    if (includeFields.address) headers.push('Residential Address');
    if (includeFields.employeeCode) headers.push('Employee Code');
    if (includeFields.notes) headers.push('Notes');

    const rows = selectedWorkers.map((w, idx) => {
      const row = [String(idx + 1), `"${w.name.replace(/"/g, '""')}"`];
      if (includeFields.unit) row.push(`"${w.unit}"`);
      if (includeFields.designation) row.push(`"${w.designation.toUpperCase()}"`);
      if (includeFields.salary) row.push(String(w.salary || 0));
      if (includeFields.fatherName) row.push(`"${w.fatherName || ''}"`);
      if (includeFields.dateOfBirth) row.push(`"${w.dateOfBirth || ''}"`);
      if (includeFields.age) row.push(`"${calculateAge(w.dateOfBirth) || ''}"`);
      if (includeFields.joiningDate) row.push(`"${w.joiningDate || ''}"`);
      if (includeFields.accountNumber) row.push(`"\t${w.accountNumber || ''}"`);
      if (includeFields.ifscCode) row.push(`"${w.ifscCode || ''}"`);
      if (includeFields.bankName) row.push(`"${w.bankName || ''}"`);
      if (includeFields.aadharNumber) row.push(`"\t${w.aadharNumber || ''}"`);
      if (includeFields.panNumber) row.push(`"${w.panNumber || ''}"`);
      if (includeFields.phone) row.push(`"${w.phone || ''}"`);
      if (includeFields.address) row.push(`"${w.address || ''}"`);
      if (includeFields.employeeCode) row.push(`"${w.employeeCode || ''}"`);
      if (includeFields.notes) row.push(`"${w.notes || ''}"`);
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Staff_Profiles_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn modal-print-active print:static print:inset-auto print:block print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-6xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Header - Screen Only */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-amber-500/10 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Worker Profiles Exporter (PDF • Print • Share)
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {selectedWorkers.length} Selected
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single-row table, custom worker selection checkboxes, PDF download, and WhatsApp/Email sharing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              title="Toggle worker selection & field customization panel"
            >
              <span>⚙️ {isConfigOpen ? 'Hide Configuration' : 'Configure Workers & Columns'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SINGLE UNIFIED SCROLL CONTAINER - Screen Only */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Customization & Selection Toolbar */}
          {isConfigOpen && (
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3 print:hidden text-xs">
          {/* Top Row: Unit filter, Search & Layout Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Unit Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-500" /> Unit:
              </span>
              {['All', 'Furnace A', 'Furnace B', 'CCM'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitFilter(u)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    unitFilter === u
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Layout Mode Switcher */}
            <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setLayoutMode('single-row')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'single-row'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Single Row Compact Table"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>Single-Row Table</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('single-card')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'single-card'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Individual 1-Page Voucher per worker"
              >
                <User className="w-3.5 h-3.5" />
                <span>1-Page Dossier</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('dossier-grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'dossier-grid'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Multi-card grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('attendance-register')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'attendance-register'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Monthly Attendance Register format"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Attendance Summary</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="w-48 sm:w-60">
              <VoiceSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search staff, account, phone..."
                size="sm"
              />
            </div>
          </div>

          {/* Worker Checkbox Selector Header & Quick Buttons */}
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWorkerPickerOpen(!isWorkerPickerOpen)}
                  className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 hover:text-indigo-600 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Choose Specific Workers to Include ({selectedWorkerIds.size}/{allAvailableWorkers.length})</span>
                  {isWorkerPickerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  Select All ({allAvailableWorkers.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  Clear All
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleSelectFilteredOnly}
                    className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 cursor-pointer"
                  >
                    Select Filtered ({filteredList.length})
                  </button>
                )}
              </div>
            </div>

            {/* Worker Checkboxes Grid */}
            {isWorkerPickerOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-36 overflow-y-auto pt-1 border-t border-slate-100 dark:border-slate-800">
                {filteredList.map((worker, idx) => {
                  const isChecked = selectedWorkerIds.has(worker.id);
                  return (
                    <button
                      key={worker.id}
                      type="button"
                      onClick={() => handleToggleWorker(worker.id)}
                      className={`p-1.5 rounded-lg border text-left flex items-start space-x-1.5 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-400 text-indigo-950 dark:text-indigo-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="pt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-[11px] block truncate">
                          {idx + 1}. {worker.name}
                        </span>
                        <span className="text-[9px] block text-slate-400 dark:text-slate-500 uppercase truncate">
                          {worker.unit} &bull; {worker.designation}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Independent Field Customization Checkboxes (DOB and Age separate!) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Include Columns:</span>
            {[
              { key: 'fatherName', label: 'Father Name' },
              { key: 'dateOfBirth', label: 'Date of Birth (DOB)' },
              { key: 'age', label: 'Age (Years)' },
              { key: 'accountNumber', label: 'Bank Account' },
              { key: 'ifscCode', label: 'IFSC Code' },
              { key: 'bankName', label: 'Bank Name' },
              { key: 'joiningDate', label: 'Joining Date' },
              { key: 'aadharNumber', label: 'Aadhaar' },
              { key: 'panNumber', label: 'PAN' },
              { key: 'salary', label: 'Base Salary' },
              { key: 'phone', label: 'Phone' },
              { key: 'notes', label: 'Notes' },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 select-none shadow-2xs"
              >
                <input
                  type="checkbox"
                  checked={includeFields[key as keyof typeof includeFields]}
                  onChange={() => handleToggleField(key as keyof typeof includeFields)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        )}

        {/* Printable & Exportable Content Area */}
        <div
          ref={printAreaRef}
          className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-5 print:p-2 print:border-none print:bg-white print:text-black"
        >
          {/* Official Plant Header */}
          <div className="p-4 rounded-xl border-2 border-slate-900 dark:border-slate-200 bg-slate-50 dark:bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:border-black print:bg-white print:p-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block print:text-black">
                Staff &amp; Manpower Directory Register
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                {contractorName}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-black">
                Furnace Division (Furnace A, Furnace B) &bull; CCM Continuous Casting Machine Division
              </p>
            </div>

            <div className="text-right sm:border-l sm:pl-4 border-slate-300 dark:border-slate-700 print:border-black text-xs space-y-0.5">
              <span className="font-bold block text-slate-800 dark:text-slate-200 print:text-black">
                Selected Workers: {selectedWorkers.length}
              </span>
              <span className="text-slate-500 dark:text-slate-400 block print:text-black text-[10px]">
                Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="inline-block px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black border border-emerald-300 print:border-black print:bg-transparent print:text-black uppercase">
                Official Report
              </span>
            </div>
          </div>

          {selectedWorkers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-bold">No workers selected for export.</p>
              <p className="text-xs">Use the checkbox selector above to choose the specific workers you want.</p>
            </div>
          ) : layoutMode === 'attendance-register' ? (
            /* Layout 4: Monthly Attendance & Payout Register */
            <div className="space-y-4">
              <div className="text-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Monthly Attendance &amp; Payroll Summary Register
                </h4>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Period: {monthName} {year} &bull; Total Active Staff: {selectedWorkers.length}
                </p>
              </div>

              <div className="overflow-x-auto border-2 border-slate-900 dark:border-slate-200 rounded-xl print:border-black print:rounded-none">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 uppercase text-[10px] tracking-wider font-black print:bg-black print:text-white">
                      <th className="p-2 border border-slate-700 text-center w-8">#</th>
                      <th className="p-2 border border-slate-700">Worker &amp; Designation</th>
                      <th className="p-2 border border-slate-700">Unit</th>
                      <th className="p-2 border border-slate-700 text-right">Base Salary</th>
                      <th className="p-2 border border-slate-700 text-center">Present Days</th>
                      <th className="p-2 border border-slate-700 text-center">OT Hours</th>
                      <th className="p-2 border border-slate-700 text-center">Working Days</th>
                      <th className="p-2 border border-slate-700 text-right">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkers.map((worker, index) => {
                      const daysInMonth = year && month ? getDaysInMonth(year, month) : 31;
                      let calc = calculations && calculations[worker.id];
                      if (!calc) {
                        const mKey = year && month ? `${year}-${String(month).padStart(2, '0')}` : '';
                        const raw = attendanceDb?.[worker.id]?.[mKey] || {};
                        const cleanRec: Record<number, string> = {};
                        Object.keys(raw).forEach((d) => {
                          const code = getAttendanceCode(raw[Number(d)]);
                          if (code) cleanRec[Number(d)] = code;
                        });
                        calc = calculateWorkerMonthlyAttendance(cleanRec, worker.salary, daysInMonth);
                      }

                      return (
                        <tr key={worker.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850">
                          <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">
                            {index + 1}
                          </td>
                          <td className="p-2 border border-slate-200">
                            <div className="font-extrabold text-slate-900 dark:text-white">{worker.name}</div>
                            <div className="text-[10px] text-slate-500 uppercase">{worker.designation}</div>
                          </td>
                          <td className="p-2 border border-slate-200">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {worker.unit}
                            </span>
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-semibold">
                            {formatCurrency(worker.salary)}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-emerald-600">
                            {calc.baseWorkingDays}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-amber-600">
                            {calc.totalExtraHours > 0 ? `${calc.totalExtraHours}h` : '-'}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-extrabold text-blue-600">
                            {calc.totalWorkingDays}
                          </td>
                          <td className="p-2 border border-slate-200 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(calc.payoutSalary)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800 font-black text-xs print:bg-slate-200">
                      <td colSpan={7} className="p-2.5 border border-slate-300 text-right uppercase">
                        Total Plant Payout ({monthName} {year}):
                      </td>
                      <td className="p-2.5 border border-slate-300 text-right font-mono text-emerald-700 dark:text-emerald-300 text-sm">
                        {formatCurrency(
                          selectedWorkers.reduce((sum, w) => {
                            const daysInMonth = year && month ? getDaysInMonth(year, month) : 31;
                            let calc = calculations && calculations[w.id];
                            if (!calc) {
                              const mKey = year && month ? `${year}-${String(month).padStart(2, '0')}` : '';
                              const raw = attendanceDb?.[w.id]?.[mKey] || {};
                              const cleanRec: Record<number, string> = {};
                              Object.keys(raw).forEach((d) => {
                                const code = getAttendanceCode(raw[Number(d)]);
                                if (code) cleanRec[Number(d)] = code;
                              });
                              calc = calculateWorkerMonthlyAttendance(cleanRec, w.salary, daysInMonth);
                            }
                            return sum + (calc.payoutSalary || 0);
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : layoutMode === 'single-row' ? (
            /* Layout 1: Single-Row Compact Table with Independent Field Columns */
            <div className="overflow-x-auto border-2 border-slate-900 dark:border-slate-200 rounded-xl print:border-black print:rounded-none">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 uppercase text-[10px] tracking-wider font-black print:bg-black print:text-white">
                    <th className="p-1.5 border border-slate-700 dark:border-slate-300 text-center w-8">#</th>
                    <th className="p-1.5 border border-slate-700 dark:border-slate-300">Worker Full Name</th>
                    {includeFields.unit && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Unit</th>}
                    {includeFields.designation && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Designation</th>}
                    {includeFields.salary && <th className="p-1.5 border border-slate-700 dark:border-slate-300 text-right">Salary (₹)</th>}
                    {includeFields.fatherName && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Father Name</th>}
                    {includeFields.dateOfBirth && <th className="p-1.5 border border-slate-700 dark:border-slate-300">DOB</th>}
                    {includeFields.age && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Age</th>}
                    {includeFields.joiningDate && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Joining</th>}
                    {includeFields.accountNumber && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Bank A/C No.</th>}
                    {includeFields.ifscCode && <th className="p-1.5 border border-slate-700 dark:border-slate-300">IFSC</th>}
                    {includeFields.bankName && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Bank</th>}
                    {includeFields.aadharNumber && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Aadhaar</th>}
                    {includeFields.panNumber && <th className="p-1.5 border border-slate-700 dark:border-slate-300">PAN</th>}
                    {includeFields.phone && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Phone</th>}
                    {includeFields.notes && <th className="p-1.5 border border-slate-700 dark:border-slate-300">Notes</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 print:divide-black">
                  {selectedWorkers.map((w, idx) => {
                    const age = calculateAge(w.dateOfBirth);
                    return (
                      <tr
                        key={w.id}
                        className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40 print:bg-white'}
                      >
                        <td className="p-1.5 border border-slate-300 dark:border-slate-700 text-center font-bold print:border-black">
                          {idx + 1}
                        </td>
                        <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-bold uppercase print:border-black whitespace-nowrap">
                          {w.name}
                        </td>
                        {includeFields.unit && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-medium print:border-black whitespace-nowrap">
                            {w.unit}
                          </td>
                        )}
                        {includeFields.designation && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-extrabold uppercase text-indigo-700 dark:text-indigo-300 print:text-black print:border-black whitespace-nowrap">
                            {w.designation.toUpperCase()}
                          </td>
                        )}
                        {includeFields.salary && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 text-right font-black text-emerald-600 print:text-black print:border-black font-mono whitespace-nowrap">
                            ₹{w.salary.toLocaleString('en-IN')}
                          </td>
                        )}
                        {includeFields.fatherName && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 print:border-black">
                            {w.fatherName || '—'}
                          </td>
                        )}
                        {includeFields.dateOfBirth && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 print:border-black font-mono whitespace-nowrap">
                            {w.dateOfBirth || '—'}
                          </td>
                        )}
                        {includeFields.age && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 print:border-black whitespace-nowrap">
                            {age || '—'}
                          </td>
                        )}
                        {includeFields.joiningDate && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 print:border-black font-mono whitespace-nowrap">
                            {w.joiningDate || '—'}
                          </td>
                        )}
                        {includeFields.accountNumber && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-mono font-bold print:border-black tracking-wider whitespace-nowrap">
                            {w.accountNumber || '—'}
                          </td>
                        )}
                        {includeFields.ifscCode && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-mono uppercase print:border-black whitespace-nowrap">
                            {w.ifscCode || '—'}
                          </td>
                        )}
                        {includeFields.bankName && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 print:border-black truncate max-w-[100px]">
                            {w.bankName || '—'}
                          </td>
                        )}
                        {includeFields.aadharNumber && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-mono print:border-black whitespace-nowrap">
                            {w.aadharNumber || '—'}
                          </td>
                        )}
                        {includeFields.panNumber && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-mono uppercase print:border-black whitespace-nowrap">
                            {w.panNumber || '—'}
                          </td>
                        )}
                        {includeFields.phone && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 font-mono print:border-black whitespace-nowrap">
                            {w.phone || '—'}
                          </td>
                        )}
                        {includeFields.notes && (
                          <td className="p-1.5 border border-slate-300 dark:border-slate-700 text-[10px] print:border-black">
                            {w.notes || '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : layoutMode === 'single-card' ? (
            /* Layout 2: Individual 1-Page Profile Voucher per Worker */
            <div className="space-y-4 print:space-y-6">
              {selectedWorkers.map((worker, index) => {
                const age = calculateAge(worker.dateOfBirth);
                return (
                  <div
                    key={worker.id}
                    className="p-5 rounded-2xl border-2 border-slate-900 dark:border-slate-300 bg-white dark:bg-slate-800 space-y-4 print:border-black print:break-after-page print:bg-white print:text-black"
                  >
                    <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-300 pb-3 print:border-black">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg print:border-black print:text-black print:bg-white print:border">
                          {index + 1}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 print:text-black">
                            Worker Profile Dossier #{index + 1}
                          </span>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                            {worker.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {includeFields.designation && (
                              <span className="font-extrabold text-xs text-indigo-700 dark:text-indigo-300 uppercase print:text-black">
                                {worker.designation.toUpperCase()}
                              </span>
                            )}
                            {includeFields.unit && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 print:border-black print:text-black">
                                {worker.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {includeFields.salary && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block print:text-black">
                            Monthly Base Salary
                          </span>
                          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 print:text-black font-mono">
                            ₹{worker.salary.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details Grid - Strict inclusion based on includeFields */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {includeFields.fatherName && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:border-black print:bg-white">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Father / Guardian:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 print:text-black">{worker.fatherName || '—'}</span>
                        </div>
                      )}

                      {(includeFields.dateOfBirth || includeFields.age) && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:border-black print:bg-white">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">
                            {includeFields.dateOfBirth && includeFields.age
                              ? 'Date of Birth & Age:'
                              : includeFields.dateOfBirth
                              ? 'Date of Birth:'
                              : 'Age:'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 print:text-black">
                            {includeFields.dateOfBirth && (worker.dateOfBirth || '—')}
                            {includeFields.dateOfBirth && includeFields.age && age && ` (${age})`}
                            {!includeFields.dateOfBirth && includeFields.age && (age || '—')}
                          </span>
                        </div>
                      )}

                      {includeFields.joiningDate && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:border-black print:bg-white">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Date of Joining:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 print:text-black">{worker.joiningDate || '—'}</span>
                        </div>
                      )}

                      {(includeFields.accountNumber || includeFields.ifscCode || includeFields.bankName) && (
                        <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 print:border-black print:bg-white col-span-2 sm:col-span-2">
                          <span className="text-[10px] text-blue-800 dark:text-blue-300 font-black block uppercase print:text-black">
                            Bank Account Number:
                          </span>
                          <span className="text-base font-black text-slate-900 dark:text-white print:text-black font-mono tracking-wider">
                            {includeFields.accountNumber ? worker.accountNumber || '—' : 'On File'}
                          </span>
                          <span className="text-[10px] text-slate-500 block print:text-black mt-0.5">
                            {includeFields.bankName && `Bank: ${worker.bankName || 'Direct Transfer'}`}
                            {includeFields.bankName && includeFields.ifscCode && ' • '}
                            {includeFields.ifscCode && `IFSC: ${worker.ifscCode || '—'}`}
                          </span>
                        </div>
                      )}

                      {(includeFields.aadharNumber || includeFields.panNumber) && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:border-black print:bg-white">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Government ID:</span>
                          {includeFields.aadharNumber && (
                            <span className="font-bold text-slate-800 dark:text-slate-100 print:text-black block font-mono text-[11px]">
                              Aadhaar: {worker.aadharNumber || '—'}
                            </span>
                          )}
                          {includeFields.panNumber && (
                            <span className="font-bold text-slate-800 dark:text-slate-100 print:text-black block font-mono text-[11px]">
                              PAN: {worker.panNumber || '—'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {includeFields.notes && worker.notes && (
                      <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 print:border-black print:text-black">
                        <strong>Notes / Remarks:</strong> {worker.notes}
                      </div>
                    )}

                    <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-[10px] text-slate-500 print:border-black print:text-black">
                      <span>{includeFields.phone && `Phone: ${worker.phone || '—'} • `}ID: {worker.employeeCode || worker.id.slice(0, 8)}</span>
                      <span>Worker Signature / Thumb: ___________________</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Layout 3: Multi-card Dossier Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
              {selectedWorkers.map((worker, index) => {
                const age = calculateAge(worker.dateOfBirth);
                return (
                  <div
                    key={worker.id}
                    className="p-3.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-xs space-y-2.5 print:border-black print:bg-white print:text-black print:break-inside-avoid"
                  >
                    <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-2 print:border-black">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400">#{index + 1}</span>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase print:text-black">
                          {worker.name}
                        </h4>
                        <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase print:text-black">
                          {includeFields.unit && worker.unit}
                          {includeFields.unit && includeFields.designation && ' • '}
                          {includeFields.designation && worker.designation.toUpperCase()}
                        </span>
                      </div>
                      {includeFields.salary && (
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 print:text-black font-mono">
                          ₹{worker.salary.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {includeFields.fatherName && (
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">Father:</span>
                          <span className="font-bold truncate block">{worker.fatherName || '—'}</span>
                        </div>
                      )}

                      {(includeFields.dateOfBirth || includeFields.age) && (
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase">
                            {includeFields.dateOfBirth && includeFields.age
                              ? 'DOB & Age:'
                              : includeFields.dateOfBirth
                              ? 'DOB:'
                              : 'Age:'}
                          </span>
                          <span className="font-bold truncate block">
                            {includeFields.dateOfBirth && (worker.dateOfBirth || '—')}
                            {includeFields.dateOfBirth && includeFields.age && age && ` (${age})`}
                            {!includeFields.dateOfBirth && includeFields.age && (age || '—')}
                          </span>
                        </div>
                      )}

                      {(includeFields.accountNumber || includeFields.ifscCode) && (
                        <div className="col-span-2 bg-blue-50/50 dark:bg-blue-950/30 p-1.5 rounded-lg border border-blue-100 dark:border-blue-900/40 print:border-black print:bg-white">
                          {includeFields.accountNumber && (
                            <span className="text-[9px] text-blue-800 dark:text-blue-300 font-bold block uppercase">
                              A/C: {worker.accountNumber || '—'}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-500 block">
                            {includeFields.ifscCode && `IFSC: ${worker.ifscCode || '—'}`}
                            {includeFields.ifscCode && includeFields.bankName && ' • '}
                            {includeFields.bankName && (worker.bankName || '')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Official Signatures & Seal Box */}
          <div className="pt-4 mt-4 border-t-2 border-slate-900 dark:border-slate-100 flex items-center justify-between text-xs print:border-black">
            <div className="text-center space-y-6">
              <div className="w-36 border-b border-slate-900 dark:border-slate-100 print:border-black" />
              <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black block text-[11px]">
                Contractor Signature &amp; Stamp
              </span>
            </div>

            <div className="text-center space-y-6">
              <div className="w-36 border-b border-slate-900 dark:border-slate-100 print:border-black" />
              <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black block text-[11px]">
                Plant Incharge / HR Verification
              </span>
            </div>
          </div>
        </div>
        {/* End of SINGLE UNIFIED SCROLL CONTAINER */}

        {/* Footer Actions with Dedicated Buttons - Screen Only */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {selectedWorkers.length} workers ready
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Share in WhatsApp Font (Text Format) */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Share formatted worker profiles and bank accounts to WhatsApp in text font format"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Font (Text Format)</span>
            </button>

            {/* Share PDF Document (File) */}
            <button
              type="button"
              onClick={handleSharePDFDocument}
              disabled={isGeneratingPdf}
              className="py-2 px-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 shadow-xs cursor-pointer"
              title="Share official profiles report as a real PDF document file"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Share PDF Document (File)'}</span>
            </button>

            {/* Share via Email */}
            <button
              type="button"
              onClick={handleShareEmail}
              className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Share worker profiles ledger via Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel / CSV</span>
            </button>

            {/* Fast Vector PDF */}
            <button
              type="button"
              onClick={handleDownloadVectorPDF}
              className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Instant Vector PDF (Zero lag, ultra-fast table)"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Fast Vector PDF</span>
            </button>

            {/* Download Full Multi-Page Canvas PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Download direct full-layout multi-page PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Full PDF'}</span>
            </button>

            {/* Print Preview Button */}
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md shadow-slate-800/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Preview document before printing"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Print Preview</span>
            </button>

            {/* Print Document (Isolated Iframe Print) */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-black text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Print directly or save as A4 PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Print Preview Modal Overlay */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-6xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold">Print Preview (100% Fidelity)</h4>
                  <p className="text-xs text-slate-300">
                    Staff Profiles Register preview. Zero toolbars included.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
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
                <div className="flex justify-between items-center border-b border-black pb-2">
                  <div>
                    <h3 className="text-sm font-black uppercase text-black">{contractorName}</h3>
                    <h4 className="text-xs font-bold text-black">Staff &amp; Manpower Directory Register</h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold text-black">Selected Workers: {selectedWorkers.length}</span>
                  </div>
                </div>

                <div className="border border-black rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-black font-bold">
                      <tr>
                        <th className="p-1.5 border border-black text-center w-8">#</th>
                        <th className="p-1.5 border border-black">Worker Full Name</th>
                        {includeFields.unit && <th className="p-1.5 border border-black">Unit</th>}
                        {includeFields.designation && <th className="p-1.5 border border-black">Designation</th>}
                        {includeFields.salary && <th className="p-1.5 border border-black text-right">Salary (₹)</th>}
                        {includeFields.fatherName && <th className="p-1.5 border border-black">Father Name</th>}
                        {includeFields.dateOfBirth && <th className="p-1.5 border border-black">DOB</th>}
                        {includeFields.age && <th className="p-1.5 border border-black">Age</th>}
                        {includeFields.accountNumber && <th className="p-1.5 border border-black">Bank A/C No.</th>}
                        {includeFields.ifscCode && <th className="p-1.5 border border-black">IFSC</th>}
                        {includeFields.phone && <th className="p-1.5 border border-black">Phone</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black bg-white">
                      {selectedWorkers.map((w, idx) => (
                        <tr key={w.id} className="border-b border-black">
                          <td className="p-1.5 border border-black text-center font-bold text-black">{idx + 1}</td>
                          <td className="p-1.5 border border-black font-bold uppercase text-black">{w.name}</td>
                          {includeFields.unit && <td className="p-1.5 border border-black text-black">{w.unit}</td>}
                          {includeFields.designation && <td className="p-1.5 border border-black uppercase text-black">{w.designation}</td>}
                          {includeFields.salary && <td className="p-1.5 border border-black text-right font-mono font-bold text-black">₹{w.salary?.toLocaleString('en-IN')}</td>}
                          {includeFields.fatherName && <td className="p-1.5 border border-black text-black">{w.fatherName || '—'}</td>}
                          {includeFields.dateOfBirth && <td className="p-1.5 border border-black font-mono text-black">{w.dateOfBirth || '—'}</td>}
                          {includeFields.age && <td className="p-1.5 border border-black text-black">{calculateAge(w.dateOfBirth) || '—'}</td>}
                          {includeFields.accountNumber && <td className="p-1.5 border border-black font-mono text-black">{w.accountNumber || '—'}</td>}
                          {includeFields.ifscCode && <td className="p-1.5 border border-black font-mono uppercase text-black">{w.ifscCode || '—'}</td>}
                          {includeFields.phone && <td className="p-1.5 border border-black text-black">{w.phone || '—'}</td>}
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
