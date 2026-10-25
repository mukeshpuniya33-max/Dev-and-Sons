import React, { useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  Users,
  Building2,
  Briefcase,
  Search,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Percent,
  Clock,
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListFilter,
} from 'lucide-react';
import { Worker, AttendanceDatabase, MonthlyAllocationDatabase } from '../types/attendance';
import { computePlantAnalytics, DailyAnalytics } from '../utils/analyticsEngine';
import { formatCurrency } from '../utils/attendanceCalculator';

interface PlantAnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  masterWorkers: Worker[];
  currentMonthWorkers?: Worker[];
  monthlyAllocationDb: MonthlyAllocationDatabase;
  attendanceDb: AttendanceDatabase;
  year: number;
  month: number;
  monthNames: string[];
}

type Language = 'en' | 'hi';
type TabType = 'daily' | 'designations' | 'units' | 'workers';
type DesignationViewMode = 'all' | 'days' | 'percent' | 'daily_payout';
type UnitViewMode = 'all' | 'monthly' | 'daily';
type DailyDisplayMode = 'focus' | 'table';

const STORAGE_KEY_LANG = 'plant_analytics_lang_preference';

const HINDI_MONTHS = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

const ENGLISH_DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HINDI_DAYS_OF_WEEK = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export const PlantAnalyticsDashboard: React.FC<PlantAnalyticsDashboardProps> = ({
  isOpen,
  onClose,
  masterWorkers,
  currentMonthWorkers,
  monthlyAllocationDb,
  attendanceDb,
  year,
  month,
  monthNames,
}) => {
  // Language preference with persistent storage; defaults to English ('en')
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved === 'hi' || saved === 'en') return saved;
    } catch {
      // safe fallback
    }
    return 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // safe fallback
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [dailyDisplayMode, setDailyDisplayMode] = useState<DailyDisplayMode>('focus');
  const [designationViewMode, setDesignationViewMode] = useState<DesignationViewMode>('all');
  const [unitViewMode, setUnitViewMode] = useState<UnitViewMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const analytics = useMemo(() => {
    return computePlantAnalytics(
      masterWorkers,
      monthlyAllocationDb,
      attendanceDb,
      year,
      month,
      currentMonthWorkers
    );
  }, [masterWorkers, monthlyAllocationDb, attendanceDb, year, month, currentMonthWorkers]);

  // Adjust selected day if month days changed
  const validSelectedDay = Math.min(Math.max(1, selectedDay), analytics.daysInCurrentMonth);

  const selectedDayData: DailyAnalytics = useMemo(() => {
    return (
      analytics.dailyAnalytics.find((d) => d.day === validSelectedDay) ||
      analytics.dailyAnalytics[0] || {
        day: 1,
        dateKey: `${year}-${String(month).padStart(2, '0')}-01`,
        dayOfWeekIndex: 0,
        totalPresent: 0,
        totalWorkingDays: 0,
        totalPayout: 0,
        unitBreakdown: [],
        designationBreakdown: [],
        workerDetails: [],
      }
    );
  }, [analytics.dailyAnalytics, validSelectedDay, year, month]);

  const currentMonthName = useMemo(() => {
    if (language === 'hi') {
      return HINDI_MONTHS[month - 1] || 'वर्तमान माह';
    }
    return monthNames[month - 1] || 'Current Month';
  }, [language, month, monthNames]);

  const prevMonthIndex = month === 1 ? 12 : month - 1;
  const prevMonthName = useMemo(() => {
    if (language === 'hi') {
      return HINDI_MONTHS[prevMonthIndex - 1] || 'पिछला माह';
    }
    return monthNames[prevMonthIndex - 1] || 'Previous Month';
  }, [language, prevMonthIndex, monthNames]);

  // Filtered workers list for Tab 4
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return analytics.workers;
    const q = searchQuery.toLowerCase().trim();
    return analytics.workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.designation.toLowerCase().includes(q) ||
        w.unit.toLowerCase().includes(q) ||
        (w.employeeCode || '').toLowerCase().includes(q)
    );
  }, [analytics.workers, searchQuery]);

  // Filtered designations list for Tab 2
  const filteredDesignations = useMemo(() => {
    if (!searchQuery.trim()) return analytics.designations;
    const q = searchQuery.toLowerCase().trim();
    return analytics.designations.filter((d) =>
      d.designation.toLowerCase().includes(q)
    );
  }, [analytics.designations, searchQuery]);

  // Filtered daily workers for current selected day
  const filteredDailyWorkers = useMemo(() => {
    if (!searchQuery.trim()) return selectedDayData.workerDetails;
    const q = searchQuery.toLowerCase().trim();
    return selectedDayData.workerDetails.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.designation.toLowerCase().includes(q) ||
        w.unit.toLowerCase().includes(q) ||
        (w.employeeCode || '').toLowerCase().includes(q)
    );
  }, [selectedDayData.workerDetails, searchQuery]);

  // Quick export of Day-wise analytics to CSV
  const handleExportDailyCSV = () => {
    const headers = language === 'hi'
      ? ['तारीख (Date)', 'दिन (Day)', 'कुल उपस्थिति (Present)', 'कुल कार्य दिवस (Man-Days)', 'दैनिक पेआउट (₹ Payout)']
      : ['Date', 'Day of Week', 'Total Present Workers', 'Total Working Days (Man-Days)', 'Daily Wage Payout (INR)'];

    const rows = analytics.dailyAnalytics.map((d) => [
      d.dateKey,
      language === 'hi' ? HINDI_DAYS_OF_WEEK[d.dayOfWeekIndex] : ENGLISH_DAYS_OF_WEEK[d.dayOfWeekIndex],
      d.totalPresent,
      d.totalWorkingDays.toFixed(2),
      d.totalPayout.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Plant_Daily_Analytics_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  // Strict bilingual dictionary - guarantees ZERO Hindi letters in English mode
  const t = {
    en: {
      dashboardTitle: 'Plant Workforce & Salary Analytics',
      dashboardSubtitle: 'Comprehensive date-wise daily and monthly attendance, working days, and wage payout comparison across designations and units.',
      vs: 'vs',
      totalPlantPayout: 'Total Monthly Payout',
      totalWorkingDays: 'Total Working Days',
      overallAttendance: 'Overall Attendance Rate',
      activeHeadcount: 'Active Workforce',
      avgDailyPayoutCard: 'Avg Daily Payout',
      prev: 'Prev',
      days: 'days',
      workers: 'workers',
      tabDaily: 'Date-Wise (Daily)',
      tabDesignations: 'By Designation',
      tabUnits: 'By Plant Unit',
      tabWorkers: 'By Worker',
      modeAll: 'Complete Overview',
      modeDays: 'Total Working Days',
      modePercent: 'Attendance Rate (%)',
      modeDailyPayout: 'Daily Avg Payout',
      modeMonthly: 'Monthly Total',
      modeDaily: 'Daily Breakdown',
      viewSingleDay: 'Single Date Breakdown',
      viewAllDays: 'Full Month Register (All Days)',
      searchDesignation: 'Search designation (e.g. Melter, Helper)...',
      searchWorker: 'Search worker or designation...',
      searchDailyWorker: 'Filter workers present today...',
      dateCol: 'Date',
      dayOfWeekCol: 'Day',
      designationCol: 'Designation / Role',
      workersCol: 'Headcount',
      presentCountCol: 'Attendance (Present)',
      workingDaysCol: 'Working Days',
      attendancePctCol: 'Attendance Rate (%)',
      avgDaysCol: 'Avg Days / Worker',
      currentPayoutCol: 'Current Month Payout',
      prevPayoutCol: 'Previous Month Payout',
      dailyPayoutCol: 'Daily Payout',
      avgDailyPayoutCol: 'Daily Avg Payout',
      avgDailyDaysCol: 'Daily Avg Days',
      momVarianceCol: 'MoM Variance',
      unitCol: 'Plant Unit',
      workerNameCol: 'Worker Name',
      attendanceCodeCol: 'Shift / Code',
      unitBreakdownTitle: 'Unit Breakdown for this Date',
      desigBreakdownTitle: 'Designation Breakdown for this Date',
      dailyWorkersTitle: 'Workers Present on this Date',
      noWorkersOnDate: 'No attendance records logged on this date.',
      noDataTitle: 'No records found',
      noDataDesc: 'No data matches your current search criteria.',
      exportCsv: 'Export Daily CSV',
      closeBtn: 'Close Dashboard',
      prevDay: 'Previous Day',
      nextDay: 'Next Day',
      selectDatePrompt: 'Select Date:',
      footerNote: 'All daily working days, attendance counts, and payouts are calculated from active registers (overtime converted at 12 hours = 1 day; daily payout = monthly salary / days in month × days worked).',
    },
    hi: {
      dashboardTitle: 'प्लांट कार्यबल एवं वेतन एनालिटिक्स',
      dashboardSubtitle: 'तारीख (डेट-वाइज) दैनिक एवं मासिक उपस्थिति, कार्य दिवस, और वेतन व्यय का पद व यूनिट अनुसार संपूर्ण विश्लेषण।',
      vs: 'बनाम',
      totalPlantPayout: 'कुल मासिक वेतन भुगतान',
      totalWorkingDays: 'कुल कार्य दिवस (Man-Days)',
      overallAttendance: 'समग्र उपस्थिति दर',
      activeHeadcount: 'सक्रिय कार्यबल',
      avgDailyPayoutCard: 'दैनिक औसत पेआउट',
      prev: 'गत माह',
      days: 'दिन',
      workers: 'श्रमिक',
      tabDaily: 'दैनिक (डेट-वाइज)',
      tabDesignations: 'पद अनुसार',
      tabUnits: 'यूनिट अनुसार',
      tabWorkers: 'श्रमिक अनुसार',
      modeAll: 'विस्तृत विवरण',
      modeDays: 'कुल कार्य दिवस',
      modePercent: 'उपस्थिति प्रतिशत (%)',
      modeDailyPayout: 'दैनिक औसत पेआउट',
      modeMonthly: 'माह का कुल',
      modeDaily: 'दैनिक विवरण',
      viewSingleDay: 'एकल तारीख विवरण',
      viewAllDays: 'संपूर्ण माह तालिका (सभी 31 दिन)',
      searchDesignation: 'पद खोजें (जैसे Melter, Helper)...',
      searchWorker: 'श्रमिक या पद खोजें...',
      searchDailyWorker: 'आज उपस्थित श्रमिकों को खोजें...',
      dateCol: 'तारीख (Date)',
      dayOfWeekCol: 'वार (Day)',
      designationCol: 'पद / पदनाम',
      workersCol: 'कुल श्रमिक',
      presentCountCol: 'उपस्थिति (हाजिरी)',
      workingDaysCol: 'कार्य दिवस',
      attendancePctCol: 'उपस्थिति प्रतिशत (%)',
      avgDaysCol: 'औसत दिन / श्रमिक',
      currentPayoutCol: 'माह का कुल पेआउट',
      prevPayoutCol: 'गत माह का पेआउट',
      dailyPayoutCol: 'दैनिक पेआउट',
      avgDailyPayoutCol: 'दैनिक औसत पेआउट',
      avgDailyDaysCol: 'दैनिक औसत दिन',
      momVarianceCol: 'मासिक अंतर',
      unitCol: 'प्लांट यूनिट',
      workerNameCol: 'श्रमिक का नाम',
      attendanceCodeCol: 'हाजिरी कोड',
      unitBreakdownTitle: 'इस तारीख पर यूनिट अनुसार उपस्थिति एवं पेआउट',
      desigBreakdownTitle: 'इस तारीख पर पद अनुसार उपस्थिति एवं पेआउट',
      dailyWorkersTitle: 'इस तारीख पर उपस्थित श्रमिकों की सूची',
      noWorkersOnDate: 'इस तारीख को किसी भी श्रमिक की हाजिरी दर्ज नहीं है।',
      noDataTitle: 'कोई रिकॉर्ड नहीं मिला',
      noDataDesc: 'आपके द्वारा खोजे गए शब्द से कोई परिणाम नहीं मिला।',
      exportCsv: 'दैनिक CSV डाउनलोड करें',
      closeBtn: 'डैशबोर्ड बंद करें',
      prevDay: 'पिछला दिन',
      nextDay: 'अगला दिन',
      selectDatePrompt: 'तारीख चुनें:',
      footerNote: 'सभी दैनिक कार्य दिवस, हाजिरी और पेआउट सीधे रजिस्टर से परिकलित किए जाते हैं (12 घंटे = 1 कार्य दिवस; दैनिक पेआउट = मासिक वेतन ÷ कुल माह के दिन × किए गए कार्य दिवस)।',
    },
  }[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[96vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                  {t.dashboardTitle}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300">
                  {currentMonthName} {year} {t.vs} {prevMonthName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.dashboardSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Switcher Segmented Control */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleSetLanguage('en')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Switch to English (Pure English mode - zero Hindi)"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleSetLanguage('hi')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  language === 'hi'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="हिंदी में देखें"
              >
                हिंदी
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive Summary Cards: Month Total vs Daily Average */}
        <div className="p-3 sm:p-4 bg-slate-50/60 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* Total Plant Payout (Monthly & Daily Avg) */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{t.totalPlantPayout}</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {formatCurrency(analytics.totalCurrentPayout)}
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
                  {t.avgDailyPayoutCard}: {formatCurrency(analytics.avgDailyPlantPayout)}
                </span>
                <span
                  className={`inline-flex items-center font-bold px-1.5 py-0.2 rounded text-[10px] tabular-nums ${
                    analytics.totalDifference >= 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}
                >
                  {analytics.totalDifference >= 0 ? '+' : ''}{analytics.totalPercentChange.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Total Working Days (Monthly & Daily Avg) */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{t.totalWorkingDays}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {analytics.totalCurrentWorkingDays.toFixed(1)} <span className="text-xs font-bold text-slate-400">{t.days}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-blue-600 dark:text-blue-400 font-bold tabular-nums">
                  {analytics.avgDailyPlantWorkingDays.toFixed(1)} {t.days}/day
                </span>
                <span className="text-slate-400 tabular-nums">
                  {t.prev}: {analytics.totalPreviousWorkingDays.toFixed(1)} {t.days}
                </span>
              </div>
            </div>
          </div>

          {/* Overall Attendance Rate (%) */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{t.overallAttendance}</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums flex items-baseline gap-1.5">
                <span>{analytics.overallAttendancePercentage.toFixed(1)}%</span>
                <span className="text-[10px] font-normal text-slate-400">
                  ({analytics.totalCurrentWorkingDays.toFixed(0)}/{analytics.totalAvailableDays} {t.days})
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, analytics.overallAttendancePercentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Workforce */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{t.activeHeadcount}</span>
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {analytics.workers.length} <span className="text-xs font-bold text-slate-400">{t.workers}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                <span>{analytics.designations.length} {t.tabDesignations}</span>
                <span>•</span>
                <span>{analytics.units.length} {t.tabUnits}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Tab Switcher & Sub-Controls */}
        <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          
          {/* Main Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setActiveTab('daily'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'daily'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{t.tabDaily}</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('designations'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'designations'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.tabDesignations} ({analytics.designations.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('units'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'units'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.tabUnits} ({analytics.units.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('workers'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'workers'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.tabWorkers} ({analytics.workers.length})
            </button>
          </div>

          {/* Contextual Sub-controls for each tab */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Controls for Daily tab */}
            {activeTab === 'daily' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDailyDisplayMode('focus')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    dailyDisplayMode === 'focus'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.viewSingleDay}
                </button>
                <button
                  type="button"
                  onClick={() => setDailyDisplayMode('table')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    dailyDisplayMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.viewAllDays}
                </button>
              </div>
            )}

            {/* Controls for Designation tab */}
            {activeTab === 'designations' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDesignationViewMode('days')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    designationViewMode === 'days'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeDays}
                </button>
                <button
                  type="button"
                  onClick={() => setDesignationViewMode('daily_payout')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    designationViewMode === 'daily_payout'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeDailyPayout}
                </button>
                <button
                  type="button"
                  onClick={() => setDesignationViewMode('percent')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    designationViewMode === 'percent'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modePercent}
                </button>
                <button
                  type="button"
                  onClick={() => setDesignationViewMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    designationViewMode === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeAll}
                </button>
              </div>
            )}

            {/* Controls for Unit tab */}
            {activeTab === 'units' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setUnitViewMode('monthly')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    unitViewMode === 'monthly'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeMonthly}
                </button>
                <button
                  type="button"
                  onClick={() => setUnitViewMode('daily')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    unitViewMode === 'daily'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeDaily}
                </button>
                <button
                  type="button"
                  onClick={() => setUnitViewMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    unitViewMode === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.modeAll}
                </button>
              </div>
            )}

            {/* Export CSV button */}
            {activeTab === 'daily' && (
              <button
                type="button"
                onClick={handleExportDailyCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                title={t.exportCsv}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.exportCsv}</span>
              </button>
            )}

            {/* Search Input */}
            {(activeTab === 'designations' || activeTab === 'workers' || (activeTab === 'daily' && dailyDisplayMode === 'focus')) && (
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'designations'
                      ? t.searchDesignation
                      : activeTab === 'daily'
                      ? t.searchDailyWorker
                      : t.searchWorker
                  }
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          
          {/* ========================================================================= */}
          {/* TAB 1: DATE-WISE / DAILY BREAKDOWN */}
          {/* ========================================================================= */}
          {activeTab === 'daily' && (
            <div className="space-y-4">
              
              {/* Horizontal Date Picker Strip */}
              <div className="bg-slate-50/70 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {t.selectDatePrompt} {currentMonthName} {year}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={validSelectedDay <= 1}
                      onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={t.prevDay}
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </button>
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200 px-2">
                      {String(validSelectedDay).padStart(2, '0')} / {analytics.daysInCurrentMonth}
                    </span>
                    <button
                      type="button"
                      disabled={validSelectedDay >= analytics.daysInCurrentMonth}
                      onClick={() => setSelectedDay((d) => Math.min(analytics.daysInCurrentMonth, d + 1))}
                      className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={t.nextDay}
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                </div>

                {/* Days Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {analytics.dailyAnalytics.map((d) => {
                    const isSelected = d.day === validSelectedDay;
                    const dayName = language === 'hi'
                      ? HINDI_DAYS_OF_WEEK[d.dayOfWeekIndex]
                      : ENGLISH_DAYS_OF_WEEK[d.dayOfWeekIndex];
                    const isSunday = d.dayOfWeekIndex === 0;

                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setSelectedDay(d.day)}
                        className={`flex flex-col items-center justify-center min-w-[44px] py-1.5 px-2 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md scale-105'
                            : isSunday
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/60 dark:border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase">{dayName}</span>
                        <span className="text-xs font-black font-mono mt-0.5">{d.day}</span>
                        <span className={`text-[9px] font-bold mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {d.totalPresent > 0 ? `${d.totalPresent}p` : '-'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VIEW 1: SINGLE DATE FOCUS */}
              {dailyDisplayMode === 'focus' && (
                <div className="space-y-4">
                  
                  {/* Selected Date Header KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    
                    {/* Selected Date */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.dateCol}</span>
                      <div className="mt-1">
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          {validSelectedDay} {currentMonthName} {year}
                        </div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {language === 'hi' ? HINDI_DAYS_OF_WEEK[selectedDayData.dayOfWeekIndex] : ENGLISH_DAYS_OF_WEEK[selectedDayData.dayOfWeekIndex]}
                        </span>
                      </div>
                    </div>

                    {/* Daily Payout on this Date */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.dailyPayoutCol}</span>
                      <div className="mt-1">
                        <div className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                          {formatCurrency(selectedDayData.totalPayout)}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Month Total: {formatCurrency(analytics.totalCurrentPayout)}
                        </span>
                      </div>
                    </div>

                    {/* Daily Working Days on this Date */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.workingDaysCol} (Date)</span>
                      <div className="mt-1">
                        <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                          {selectedDayData.totalWorkingDays.toFixed(2)} <span className="text-xs font-bold text-slate-400">{t.days}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Avg: {analytics.avgDailyPlantWorkingDays.toFixed(1)} {t.days}/day
                        </span>
                      </div>
                    </div>

                    {/* Total Attendance on this Date */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.presentCountCol}</span>
                      <div className="mt-1">
                        <div className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                          {selectedDayData.totalPresent} <span className="text-xs font-bold text-slate-400">/ {analytics.workers.length}</span>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {analytics.workers.length > 0
                            ? ((selectedDayData.totalPresent / analytics.workers.length) * 100).toFixed(1)
                            : 0}% workforce active
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Dual Column: Unit Breakdown vs Designation Breakdown on Selected Date */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Unit Breakdown on this Date */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {t.unitBreakdownTitle}
                        </h4>
                      </div>
                      {selectedDayData.unitBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">{t.noWorkersOnDate}</p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedDayData.unitBreakdown.map((u) => (
                            <div key={u.unit} className="py-2.5 flex items-center justify-between">
                              <div>
                                <span className="font-black text-xs text-slate-900 dark:text-white">{u.unit}</span>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {u.presentCount} {t.workers} • {u.workingDays.toFixed(1)} {t.days}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                                  {formatCurrency(u.payout)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Designation Breakdown on this Date */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <Briefcase className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          {t.desigBreakdownTitle}
                        </h4>
                      </div>
                      {selectedDayData.designationBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">{t.noWorkersOnDate}</p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                          {selectedDayData.designationBreakdown.map((d) => (
                            <div key={d.designation} className="py-2.5 flex items-center justify-between">
                              <div>
                                <span className="font-black text-xs text-slate-900 dark:text-white">{d.designation}</span>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {d.presentCount} {t.workers} • {d.workingDays.toFixed(1)} {t.days}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                                  {formatCurrency(d.payout)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Individual Workers Marked on this Date */}
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                    <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span>{t.dailyWorkersTitle} ({selectedDayData.workerDetails.length})</span>
                      </h4>
                    </div>
                    {filteredDailyWorkers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">{t.noWorkersOnDate}</p>
                    ) : (
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200/70 dark:border-slate-750">
                              <th className="py-2.5 px-3.5">{t.workerNameCol}</th>
                              <th className="py-2.5 px-3.5">{t.designationCol}</th>
                              <th className="py-2.5 px-3.5">{t.unitCol}</th>
                              <th className="py-2.5 px-3.5 text-center">{t.attendanceCodeCol}</th>
                              <th className="py-2.5 px-3.5 text-right">{t.workingDaysCol}</th>
                              <th className="py-2.5 px-3.5 text-right">{t.dailyPayoutCol}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredDailyWorkers.map((w) => (
                              <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3.5 font-bold text-slate-900 dark:text-white">
                                  {w.name}
                                </td>
                                <td className="py-2 px-3.5 text-indigo-600 dark:text-indigo-400 font-medium">
                                  {w.designation}
                                </td>
                                <td className="py-2 px-3.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                                    {w.unit}
                                  </span>
                                </td>
                                <td className="py-2 px-3.5 text-center font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                  {w.code}
                                </td>
                                <td className="py-2 px-3.5 text-right font-mono font-bold tabular-nums">
                                  {w.workingDays.toFixed(2)}
                                </td>
                                <td className="py-2 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                                  {formatCurrency(w.payout)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* VIEW 2: FULL MONTH REGISTER TABLE (ALL 31 DAYS) */}
              {dailyDisplayMode === 'table' && (
                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-4">{t.dateCol}</th>
                        <th className="py-3 px-4 text-center">{t.dayOfWeekCol}</th>
                        <th className="py-3 px-4 text-center">{t.presentCountCol}</th>
                        <th className="py-3 px-4 text-right">{t.workingDaysCol}</th>
                        <th className="py-3 px-4 text-right">{t.dailyPayoutCol}</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {analytics.dailyAnalytics.map((d) => {
                        const dayName = language === 'hi'
                          ? HINDI_DAYS_OF_WEEK[d.dayOfWeekIndex]
                          : ENGLISH_DAYS_OF_WEEK[d.dayOfWeekIndex];
                        const isSunday = d.dayOfWeekIndex === 0;

                        return (
                          <tr
                            key={d.day}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                              isSunday ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4 font-black font-mono text-slate-900 dark:text-white">
                              {String(d.day).padStart(2, '0')} {currentMonthName} {year}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                isSunday ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 font-black' : 'text-slate-600 dark:text-slate-400'
                              }`}>
                                {dayName}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                              {d.totalPresent}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                              {d.totalWorkingDays.toFixed(2)} {t.days}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                              {formatCurrency(d.totalPayout)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDay(d.day);
                                  setDailyDisplayMode('focus');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] cursor-pointer"
                              >
                                Inspect Date
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BY DESIGNATION (Month Total vs Daily Average Breakdown) */}
          {/* ========================================================================= */}
          {activeTab === 'designations' && (
            <div className="space-y-4">
              {filteredDesignations.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Briefcase className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-bold">{t.noDataTitle}</p>
                  <p className="text-xs">{t.noDataDesc}</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-4">{t.designationCol}</th>
                        <th className="py-3 px-4 text-center">{t.workersCol}</th>

                        {/* Working Days Columns */}
                        {(designationViewMode === 'days' || designationViewMode === 'all') && (
                          <th className="py-3 px-4 text-right">{t.workingDaysCol}</th>
                        )}

                        {/* Daily Avg Days */}
                        {designationViewMode === 'all' && (
                          <th className="py-3 px-4 text-right">{t.avgDailyDaysCol}</th>
                        )}

                        {/* Attendance Percentage Columns */}
                        {(designationViewMode === 'percent' || designationViewMode === 'all') && (
                          <th className="py-3 px-4 text-left min-w-[130px]">{t.attendancePctCol}</th>
                        )}

                        {/* Current Month Payout */}
                        <th className="py-3 px-4 text-right">{t.currentPayoutCol}</th>

                        {/* Daily Average Payout */}
                        {(designationViewMode === 'daily_payout' || designationViewMode === 'all') && (
                          <th className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">{t.avgDailyPayoutCol}</th>
                        )}

                        {/* MoM Variance */}
                        <th className="py-3 px-4 text-right">{t.momVarianceCol}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredDesignations.map((d) => {
                        const isUp = d.difference >= 0;
                        const pct = d.attendancePercentage;
                        const pctColor =
                          pct >= 85
                            ? 'bg-emerald-500'
                            : pct >= 65
                            ? 'bg-indigo-500'
                            : pct >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500';

                        return (
                          <tr
                            key={d.designation}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            {/* Designation */}
                            <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <Briefcase className="w-3.5 h-3.5" />
                                </div>
                                <span className="tracking-wide">{d.designation}</span>
                              </div>
                            </td>

                            {/* Headcount */}
                            <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono">
                                {d.workerCount}
                              </span>
                            </td>

                            {/* Total Monthly Working Days */}
                            {(designationViewMode === 'days' || designationViewMode === 'all') && (
                              <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                                <span className="text-indigo-600 dark:text-indigo-400">
                                  {d.currentWorkingDays.toFixed(1)}
                                </span>{' '}
                                <span className="text-[10px] text-slate-400 font-bold">{t.days}</span>
                              </td>
                            )}

                            {/* Daily Avg Days */}
                            {designationViewMode === 'all' && (
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                {d.avgDailyWorkingDays.toFixed(2)}/day
                              </td>
                            )}

                            {/* Attendance % with Bar */}
                            {(designationViewMode === 'percent' || designationViewMode === 'all') && (
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-xs tabular-nums min-w-[38px] text-slate-800 dark:text-slate-200">
                                    {d.attendancePercentage.toFixed(1)}%
                                  </span>
                                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden min-w-[50px]">
                                    <div
                                      className={`h-1.5 rounded-full ${pctColor} transition-all duration-300`}
                                      style={{ width: `${Math.min(100, Math.max(0, d.attendancePercentage))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Current Monthly Payout */}
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                              {formatCurrency(d.currentPayout)}
                            </td>

                            {/* Daily Average Payout */}
                            {(designationViewMode === 'daily_payout' || designationViewMode === 'all') && (
                              <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                {formatCurrency(d.avgDailyPayout)}
                              </td>
                            )}

                            {/* MoM Variance */}
                            <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                              <span
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs ${
                                  isUp
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                                }`}
                              >
                                {isUp ? '+' : ''}{formatCurrency(d.difference)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BY PLANT UNIT (Month Total vs Daily Average Breakdown) */}
          {/* ========================================================================= */}
          {activeTab === 'units' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {analytics.units.map((u) => {
                  const isUp = u.difference >= 0;
                  return (
                    <div
                      key={u.unit}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900 dark:text-white">
                            {u.unit}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{u.workerCount} {t.workers}</span>
                            <span>•</span>
                            <span>{t.workingDaysCol}: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{u.currentManDays.toFixed(1)} {t.days}</strong></span>
                            <span>•</span>
                            <span>{t.overallAttendance}: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{u.attendancePercentage.toFixed(1)}%</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                        
                        {/* Daily Average Payout */}
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase block">{t.avgDailyPayoutCol}</span>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                            {formatCurrency(u.avgDailyPayout)}
                          </span>
                        </div>

                        {/* Current Monthly Payout */}
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase block">{t.currentPayoutCol}</span>
                          <span className="text-sm font-black text-slate-900 dark:text-white font-mono tabular-nums">
                            {formatCurrency(u.currentPayout)}
                          </span>
                        </div>

                        {/* MoM Variance */}
                        <div className="text-right min-w-[90px]">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase block">{t.momVarianceCol}</span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-black font-mono px-2 py-0.5 rounded-lg tabular-nums ${
                              isUp
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}
                          >
                            {isUp ? '+' : ''}{formatCurrency(u.difference)} ({u.percentChange.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: BY WORKER (Individual Worker Monthly & Daily Stats) */}
          {/* ========================================================================= */}
          {activeTab === 'workers' && (
            <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4">{t.workerNameCol}</th>
                    <th className="py-3 px-4">{t.designationCol}</th>
                    <th className="py-3 px-4">{t.unitCol}</th>
                    <th className="py-3 px-4 text-right">{t.workingDaysCol}</th>
                    <th className="py-3 px-4 text-right">{t.attendancePctCol}</th>
                    <th className="py-3 px-4 text-right">{t.avgDailyPayoutCol}</th>
                    <th className="py-3 px-4 text-right">{t.currentPayoutCol}</th>
                    <th className="py-3 px-4 text-right">{t.momVarianceCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredWorkers.map((w) => {
                    const isUp = w.difference >= 0;
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{w.name}</span>
                            {w.employeeCode && (
                              <span className="font-mono text-[10px] text-slate-400">({w.employeeCode})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                          {w.designation}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {w.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {w.currentWorkingDays.toFixed(1)} {t.days}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          {w.attendancePercentage.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {formatCurrency(w.avgDailyPayout)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(w.currentPayout)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg text-xs ${
                              isUp
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}
                          >
                            {isUp ? '+' : ''}{formatCurrency(w.difference)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{t.footerNote}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
          >
            {t.closeBtn}
          </button>
        </div>

      </div>
    </div>
  );
};
