import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Building2,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  StopCircle,
  Eye,
} from 'lucide-react';
import { Worker, AttendanceCalculation, PlantUnit } from '../types/attendance';
import { formatCurrency, parseAttendanceCode } from '../utils/attendanceCalculator';
import {
  downloadElementAsMultiPagePdf,
  downloadElementAsImage,
  downloadElementAsStandaloneHtml,
} from '../utils/multiPagePdf';
import { printElementDirect } from '../utils/printHelper';

interface ColorfulAttendanceTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  daysInMonth: number;
  year: number;
  month: number;
  monthName: string;
  attendanceData: Record<string, Record<number, string>>;
  calculations: Record<string, AttendanceCalculation>;
  contractorName?: string;
  dayNotes?: Record<number, string>;
}

export const ColorfulAttendanceTableModal: React.FC<ColorfulAttendanceTableModalProps> = ({
  isOpen,
  onClose,
  workers,
  daysInMonth,
  year,
  month,
  monthName,
  attendanceData,
  calculations,
  contractorName = 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES',
  dayNotes = {},
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Helper for day of week
  const getDayOfWeek = (day: number) => {
    const d = new Date(year, month - 1, day);
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return { name: dayNames[d.getDay()], isSunday: d.getDay() === 0 };
  };

  // Color badge styling identical to master grid
  const getBadgeStyle = (code: string | undefined) => {
    if (!code) return 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-dashed border-slate-200 dark:border-slate-800';
    const parsed = parseAttendanceCode(code);
    if (parsed.isAbsent) return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold border-rose-300';
    if (parsed.isWeeklyOff) return 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-bold border-cyan-300';
    if (parsed.isHalfDay) return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border-amber-300';
    if (parsed.days >= 3) return 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-bold border-purple-300';
    if (parsed.days >= 2) return 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold border-blue-300';
    if (parsed.hours > 0) return 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold border-amber-300';
    return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border-emerald-300';
  };

  // Render tokens nicely
  const renderCellBadges = (code: string | undefined) => {
    if (!code) return <span className="text-slate-300 dark:text-slate-700 font-bold">-</span>;
    const tokens = String(code).split(/[\+,/]/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return <span className="text-xs">{code}</span>;

    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        {tokens.map((token, idx) => (
          <span
            key={idx}
            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold leading-tight whitespace-nowrap border text-center shadow-2xs ${getBadgeStyle(
              token
            )}`}
          >
            {token}
          </span>
        ))}
      </div>
    );
  };

  // Filter workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (!w || !w.id) return false;
      let matchesUnit = true;
      if (selectedUnit === 'Both Furnaces (A + B)' || selectedUnit === 'Furnaces A+B') {
        matchesUnit = w.unit === 'Furnace A' || w.unit === 'Furnace B';
      } else if (selectedUnit !== 'All') {
        matchesUnit = w.unit === selectedUnit;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        w.name.toLowerCase().includes(q) ||
        w.designation.toLowerCase().includes(q) ||
        (w.employeeCode && w.employeeCode.toLowerCase().includes(q));

      return matchesUnit && matchesSearch;
    });
  }, [workers, selectedUnit, searchQuery]);

  // Overall totals across filtered workers
  const summaryTotals = useMemo(() => {
    let totalBaseDays = 0;
    let totalOtHours = 0;
    let totalEquivalentDays = 0;
    let totalPayout = 0;

    filteredWorkers.forEach((w) => {
      const calc = calculations[w.id];
      if (calc) {
        totalBaseDays += calc.baseWorkingDays || 0;
        totalOtHours += calc.totalExtraHours || 0;
        totalEquivalentDays += calc.totalWorkingDays || 0;
        totalPayout += calc.payoutSalary || 0;
      }
    });

    return {
      totalWorkers: filteredWorkers.length,
      totalBaseDays,
      totalOtHours,
      totalEquivalentDays,
      totalPayout,
    };
  }, [filteredWorkers, calculations]);

  if (!isOpen) return null;

  // Horizontal Quick Scroll helper
  const handleScrollToX = (pixelOffset: number) => {
    if (scrollWrapperRef.current) {
      scrollWrapperRef.current.scrollTo({ left: pixelOffset, behavior: 'smooth' });
    }
  };

  // Abort ongoing export immediately
  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExporting(false);
    setExportMessage(null);
  };

  // Handle Safe Close
  const handleSafeClose = () => {
    handleCancelExport();
    onClose();
  };

  // 1. Download Colorful Landscape PDF
  const handleDownloadPdf = async () => {
    if (!tableContainerRef.current) return;
    handleCancelExport();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsExporting(true);
    setExportMessage('Generating Full Colorful PDF (All 31 Days)...');
    try {
      const fileName = `Colorful_Attendance_Register_${monthName}_${year}.pdf`;
      const success = await downloadElementAsMultiPagePdf(
        tableContainerRef.current,
        fileName,
        'l',
        controller.signal
      );
      if (success) {
        setExportMessage('Downloaded Colorful PDF Successfully!');
        setTimeout(() => setExportMessage(null), 3000);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('PDF export error:', e);
        setExportMessage('Export failed. Use Print Sheet instead.');
        setTimeout(() => setExportMessage(null), 4000);
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  // 2. Download High-Res Colorful PNG Image
  const handleDownloadImage = async () => {
    if (!tableContainerRef.current) return;
    setIsExporting(true);
    setExportMessage('Generating Full Colorful Image (PNG)...');
    try {
      const fileName = `Colorful_Attendance_Sheet_${monthName}_${year}.png`;
      const success = await downloadElementAsImage(tableContainerRef.current, fileName, true);
      if (success) {
        setExportMessage('Downloaded Colorful Image Successfully!');
        setTimeout(() => setExportMessage(null), 3000);
      }
    } catch (e) {
      console.error('Image export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Download Standalone Offline HTML File
  const handleDownloadHtml = () => {
    if (!tableContainerRef.current) return;
    const fileName = `Colorful_Attendance_Register_${monthName}_${year}.html`;
    const docTitle = `${contractorName} - Attendance Register (${monthName} ${year})`;
    downloadElementAsStandaloneHtml(tableContainerRef.current, fileName, docTitle);
  };

  // 4. Isolated Print (Instant, no background dashboard leak, landscape format)
  const handlePrint = async () => {
    if (!tableContainerRef.current) return;
    await printElementDirect(
      tableContainerRef.current,
      'landscape',
      `${monthName} ${year} Attendance Register - ${contractorName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn modal-print-active print:static print:inset-auto print:block print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-7xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Header - Screen Only */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Download Full Colorful Attendance Table
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                  {filteredWorkers.length} Workers &bull; {monthName} {year}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Full month grid with all dates 1 to 31, vibrant green/amber/blue shift badges, and salary totals
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Strip & Horizontal Navigator - Screen Only */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
          {/* Unit Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-500" /> Unit:
            </span>
            {['All', 'Both Furnaces (A + B)', 'Furnace A', 'Furnace B', 'CCM'].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setSelectedUnit(u)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedUnit === u
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {/* Quick-Jump Horizontal Scroll Buttons (Solves lag & slide issues) */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 px-1">Jump to:</span>
            <button
              type="button"
              onClick={() => handleScrollToX(0)}
              className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
            >
              Days 1–10
            </button>
            <button
              type="button"
              onClick={() => handleScrollToX(480)}
              className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
            >
              Days 11–20
            </button>
            <button
              type="button"
              onClick={() => handleScrollToX(920)}
              className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
            >
              Days 21–31
            </button>
            <button
              type="button"
              onClick={() => handleScrollToX(1800)}
              className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold transition-colors cursor-pointer"
            >
              💰 Totals
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff or designation..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Status Toast with Cancel Button */}
        {exportMessage && (
          <div className="bg-emerald-600 text-white py-1.5 px-4 text-xs font-bold text-center flex items-center justify-between gap-2 print:hidden animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
              <span>{exportMessage}</span>
            </div>
            {isExporting && (
              <button
                type="button"
                onClick={handleCancelExport}
                className="px-2.5 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        )}

        {/* Printable & Exportable Colorful Content Container */}
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-white print:p-0 print:overflow-visible print:bg-white print:text-black space-y-4"
        >
          {/* Official Company / Plant Title Header */}
          <div className="p-4 rounded-2xl border-2 border-slate-900 dark:border-slate-300 bg-slate-50 dark:bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:border-black print:bg-white print:p-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block print:text-black">
                Official Monthly Attendance Register &amp; Wage Payout Sheet
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight print:text-black">
                {contractorName}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-black">
                Month: <strong>{monthName} {year}</strong> &bull; Total Days in Month: <strong>{daysInMonth}</strong> &bull; Plant Units: Furnace A, Furnace B &amp; CCM
              </p>
            </div>

            <div className="text-right sm:border-l sm:pl-4 border-slate-300 dark:border-slate-700 print:border-black text-xs space-y-0.5">
              <span className="font-bold block text-slate-800 dark:text-slate-200 print:text-black">
                Active Workers: {filteredWorkers.length}
              </span>
              <span className="font-extrabold font-mono text-emerald-700 dark:text-emerald-400 block print:text-black">
                Total Payout: {formatCurrency(summaryTotals.totalPayout)}
              </span>
              <span className="inline-block px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black border border-emerald-300 print:border-black print:bg-transparent print:text-black uppercase">
                Official Plant Record
              </span>
            </div>
          </div>

          {/* Full Colorful Attendance Table Wrapper with Smooth Horizontal Scrolling */}
          <div
            ref={scrollWrapperRef}
            className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-x-auto shadow-xs print:border-black print:rounded-none scroll-smooth"
          >
            <table className="min-w-[1600px] w-full text-xs text-left border-collapse">
              {/* Header */}
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold print:bg-slate-100 print:text-black">
                <tr>
                  <th className="py-2 px-1.5 border-b border-r border-slate-300 dark:border-slate-700 text-center w-8 print:border-black">#</th>
                  <th className="py-2 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 min-w-[150px] print:border-black">Worker Name</th>
                  <th className="py-2 px-2 border-b border-r border-slate-300 dark:border-slate-700 min-w-[110px] print:border-black">Designation</th>
                  <th className="py-2 px-1.5 border-b border-r border-slate-300 dark:border-slate-700 text-center min-w-[70px] print:border-black">Unit</th>
                  <th className="py-2 px-2 border-b border-r border-slate-300 dark:border-slate-700 text-right min-w-[80px] print:border-black">Salary (₹)</th>

                  {/* Days 1 to 31 */}
                  {daysArray.map((d) => {
                    const { name: dow, isSunday } = getDayOfWeek(d);
                    const note = dayNotes[d];
                    return (
                      <th
                        key={d}
                        className={`py-1 px-0.5 border-b border-r border-slate-300 dark:border-slate-700 text-center w-[36px] min-w-[36px] max-w-[40px] print:border-black ${
                          isSunday ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : ''
                        }`}
                        title={note ? `Day ${d}: ${note}` : `Day ${d} (${dow})`}
                      >
                        <div className="text-[9px] uppercase leading-none opacity-70">{dow}</div>
                        <div className="text-[11px] font-extrabold mt-0.5">{d}</div>
                      </th>
                    );
                  })}

                  {/* Summary Totals */}
                  <th className="py-2 px-1.5 border-b border-r border-slate-300 dark:border-slate-700 text-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 min-w-[50px] print:border-black">
                    Shifts
                  </th>
                  <th className="py-2 px-1.5 border-b border-r border-slate-300 dark:border-slate-700 text-center bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 min-w-[50px] print:border-black">
                    OT (H)
                  </th>
                  <th className="py-2 px-1.5 border-b border-r border-slate-300 dark:border-slate-700 text-center bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 min-w-[55px] print:border-black">
                    Days
                  </th>
                  <th className="py-2 px-2.5 border-b border-slate-300 dark:border-slate-700 text-right bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 min-w-[95px] print:border-black">
                    Payout (₹)
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 print:bg-white print:divide-slate-300">
                {filteredWorkers.map((worker, idx) => {
                  const workerRecords = attendanceData[worker.id] || {};
                  const calc = calculations[worker.id] || {
                    baseWorkingDays: 0,
                    totalExtraHours: 0,
                    totalWorkingDays: 0,
                    payoutSalary: 0,
                  };

                  return (
                    <tr
                      key={worker.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/40 dark:bg-slate-850/40'
                      }`}
                    >
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-[10px] text-slate-400 print:border-black">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white whitespace-nowrap print:border-black">
                        {worker.name}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase whitespace-nowrap print:border-black">
                        {worker.designation}
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap print:border-black">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 print:border-black">
                          {worker.unit}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-200 print:border-black">
                        ₹{worker.salary?.toLocaleString('en-IN') || '0'}
                      </td>

                      {/* Day Cells with Colorful Badges */}
                      {daysArray.map((d) => {
                        const code = workerRecords[d];
                        return (
                          <td
                            key={d}
                            className="py-1 px-0.5 border-r border-slate-200 dark:border-slate-800 text-center w-[36px] min-w-[36px] max-w-[40px] print:border-black"
                          >
                            {renderCellBadges(code)}
                          </td>
                        );
                      })}

                      {/* Summaries */}
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50/20 print:border-black">
                        {calc.baseWorkingDays || 0}
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-amber-700 dark:text-amber-300 bg-amber-50/20 print:border-black">
                        {calc.totalExtraHours > 0 ? `${calc.totalExtraHours}h` : '-'}
                      </td>
                      <td className="py-1.5 px-1.5 border-r border-slate-200 dark:border-slate-800 text-center font-black font-mono text-blue-700 dark:text-blue-300 bg-blue-50/20 print:border-black">
                        {calc.totalWorkingDays || 0}
                      </td>
                      <td className="py-1.5 px-2.5 border-slate-200 dark:border-slate-800 text-right font-black font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50/30 whitespace-nowrap print:border-black">
                        {formatCurrency(calc.payoutSalary || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Bottom Totals Row */}
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 print:bg-slate-100 print:text-black">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700 text-right uppercase tracking-wider text-xs print:border-black">
                    Plant Totals ({summaryTotals.totalWorkers} Workers):
                  </td>
                  <td colSpan={daysInMonth} className="py-2.5 px-2 border-r border-slate-300 dark:border-slate-700 text-center text-[10px] text-slate-500 font-bold print:border-black">
                    Official Month Attendance Data Verified (Days 1–{daysInMonth})
                  </td>
                  <td className="py-2.5 px-1.5 border-r border-slate-300 dark:border-slate-700 text-center font-mono text-indigo-800 dark:text-indigo-300 print:border-black">
                    {summaryTotals.totalBaseDays}
                  </td>
                  <td className="py-2.5 px-1.5 border-r border-slate-300 dark:border-slate-700 text-center font-mono text-amber-800 dark:text-amber-300 print:border-black">
                    {summaryTotals.totalOtHours}h
                  </td>
                  <td className="py-2.5 px-1.5 border-r border-slate-300 dark:border-slate-700 text-center font-mono text-blue-800 dark:text-blue-300 print:border-black">
                    {summaryTotals.totalEquivalentDays}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800 dark:text-emerald-300 text-sm whitespace-nowrap print:border-black">
                    {formatCurrency(summaryTotals.totalPayout)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Actions - Screen Only */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span>Ready to download:</span>
            <strong className="text-slate-900 dark:text-white">{filteredWorkers.length} workers</strong>
            <span>&bull;</span>
            <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryTotals.totalPayout)} payout</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download Standalone HTML */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Download standalone offline HTML file viewable in any browser without app"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Offline HTML</span>
            </button>

            {/* Download High-Res Image (PNG) */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Download high-resolution full colorful image (PNG)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generating...' : 'Download Image (PNG)'}</span>
            </button>

            {/* Download Colorful PDF (Landscape) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Download complete colorful table as landscape PDF document"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Creating PDF...' : 'Download Colorful PDF'}</span>
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
              className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Print directly or save as PDF via browser print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleSafeClose}
              className="py-2 px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Print Preview Modal Overlay */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-7xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold">Print Preview (100% Fidelity)</h4>
                  <p className="text-xs text-slate-300">
                    This is exactly how the attendance table will appear when printed or exported. Zero toolbars included.
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
              <div className="p-4 rounded-2xl border-2 border-black bg-white space-y-4">
                <div className="p-4 rounded-xl border border-black bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black block">
                      Official Monthly Attendance Register &amp; Wage Payout Sheet
                    </span>
                    <h2 className="text-lg font-black text-black uppercase tracking-tight">
                      {contractorName}
                    </h2>
                    <p className="text-[11px] text-black">
                      Month: <strong>{monthName} {year}</strong> &bull; Total Days: <strong>{daysInMonth}</strong>
                    </p>
                  </div>
                  <div className="text-right border-l pl-4 border-black text-xs space-y-0.5">
                    <span className="font-bold block text-black">Active Workers: {filteredWorkers.length}</span>
                    <span className="font-extrabold font-mono text-black block">Total Payout: {formatCurrency(summaryTotals.totalPayout)}</span>
                  </div>
                </div>

                <div className="border border-black rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-black font-bold">
                      <tr>
                        <th className="py-2 px-1.5 border border-black text-center w-8">#</th>
                        <th className="py-2 px-2.5 border border-black">Worker Name</th>
                        <th className="py-2 px-2 border border-black">Designation</th>
                        <th className="py-2 px-1.5 border border-black text-center">Unit</th>
                        <th className="py-2 px-2 border border-black text-right">Salary (₹)</th>
                        {daysArray.map((d) => (
                          <th key={d} className="py-1 px-0.5 border border-black text-center w-[36px]">
                            <div className="text-[9px] uppercase">{getDayOfWeek(d).name}</div>
                            <div className="text-[11px] font-extrabold">{d}</div>
                          </th>
                        ))}
                        <th className="py-2 px-1.5 border border-black text-center">Shifts</th>
                        <th className="py-2 px-1.5 border border-black text-center">OT</th>
                        <th className="py-2 px-1.5 border border-black text-center">Days</th>
                        <th className="py-2 px-2.5 border border-black text-right">Payout (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkers.map((worker, idx) => {
                        const workerRecords = attendanceData[worker.id] || {};
                        const calc = calculations[worker.id] || { baseWorkingDays: 0, totalExtraHours: 0, totalWorkingDays: 0, payoutSalary: 0 };
                        return (
                          <tr key={worker.id} className="border-b border-black">
                            <td className="py-1.5 px-1.5 border border-black text-center font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-1.5 px-2.5 border border-black font-bold whitespace-nowrap">{worker.name}</td>
                            <td className="py-1.5 px-2 border border-black text-[10.5px] uppercase whitespace-nowrap">{worker.designation}</td>
                            <td className="py-1.5 px-1.5 border border-black text-center whitespace-nowrap">{worker.unit}</td>
                            <td className="py-1.5 px-2 border border-black text-right font-mono font-bold">₹{worker.salary?.toLocaleString('en-IN') || '0'}</td>
                            {daysArray.map((d) => (
                              <td key={d} className="py-1 px-0.5 border border-black text-center w-[36px]">
                                {renderCellBadges(workerRecords[d])}
                              </td>
                            ))}
                            <td className="py-1.5 px-1.5 border border-black text-center font-bold font-mono">{calc.baseWorkingDays || 0}</td>
                            <td className="py-1.5 px-1.5 border border-black text-center font-bold font-mono">{calc.totalExtraHours > 0 ? `${calc.totalExtraHours}h` : '-'}</td>
                            <td className="py-1.5 px-1.5 border border-black text-center font-black font-mono">{calc.totalWorkingDays || 0}</td>
                            <td className="py-1.5 px-2.5 border border-black text-right font-black font-mono whitespace-nowrap">{formatCurrency(calc.payoutSalary || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black text-black border-t-2 border-black">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 border border-black text-right uppercase">Plant Totals ({summaryTotals.totalWorkers} Workers):</td>
                        <td colSpan={daysInMonth} className="py-2.5 px-2 border border-black text-center text-[10px]">Verified</td>
                        <td className="py-2.5 px-1.5 border border-black text-center font-mono">{summaryTotals.totalBaseDays}</td>
                        <td className="py-2.5 px-1.5 border border-black text-center font-mono">{summaryTotals.totalOtHours}h</td>
                        <td className="py-2.5 px-1.5 border border-black text-center font-mono">{summaryTotals.totalEquivalentDays}</td>
                        <td className="py-2.5 px-2.5 border border-black text-right font-mono text-sm">{formatCurrency(summaryTotals.totalPayout)}</td>
                      </tr>
                    </tfoot>
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
