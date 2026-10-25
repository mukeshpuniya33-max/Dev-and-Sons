import jsPDF from 'jspdf';
import 'jspdf-autotable';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Worker, PlantUnit, AttendanceDatabase, AttendanceCalculation, SyncStatus } from './types/attendance';
import { DEFAULT_WORKERS, getInitialAttendanceData } from './data/sampleStaff';
import {
  calculateWorkerMonthlyAttendance,
  getDaysInMonth,
  formatCurrency,
  getWorkerActiveDesignation,
} from './utils/attendanceCalculator';
import {
  getAttendanceCode,
  getAttendanceTimestamp,
  mergeAttendanceWithLWW,
} from './utils/attendanceSyncEngine';
import {
  markAttendance,
  clearAttendance,
} from './services/attendanceService';
import {
  deleteWorker,
  addOrUpdateWorker,
  mergeWorkersWithLWW,
  mergeRosterWithLWW,
  getActiveWorkers,
  updateRosterWithTombstones,
  getWorkerTimestamp,
} from './utils/workerSyncEngine';
import {
  getActiveWorkersForMonth,
  excludeWorkerFromMonth,
  includeWorkerInMonth,
  toggleWorkerMonthAllocation,
  mergeMonthlyAllocationWithLWW,
} from './utils/monthAllocationEngine';
import { MonthlyAllocationDatabase } from './types/attendance';
import { exportAttendanceToCSV } from './utils/exportCsv';
import { downloadStandaloneAppHtmlFile } from './utils/generateStandaloneHtml';
import { MonthlyMasterGrid } from './components/MonthlyMasterGrid';
import { SingleScreenWorkerOverview } from './components/SingleScreenWorkerOverview';
import { WorkerLedgerView } from './components/WorkerLedgerView';
import { QuickTapModal } from './components/QuickTapModal';
import { AddWorkerModal } from './components/AddWorkerModal';
import { ManageRosterModal } from './components/ManageRosterModal';
import { MonthAllocationManager } from './components/MonthAllocationManager';
import { PlantAnalyticsDashboard } from './components/PlantAnalyticsDashboard';
import { BatchFillModal } from './components/BatchFillModal';
import { DownloadAppModal } from './components/DownloadAppModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { ReorderWorkersModal } from './components/ReorderWorkersModal';

import { ShareAppUrlModal } from './components/ShareAppUrlModal';
import { TransferDataModal } from './components/TransferDataModal';
import { WorkerProfilesReportModal } from './components/WorkerProfilesReportModal';
import { MonthlyShiftNotesReportModal } from './components/MonthlyShiftNotesReportModal';
import { ColorfulAttendanceTableModal } from './components/ColorfulAttendanceTableModal';
import { VoiceSearchInput } from './components/VoiceSearchInput';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AIPayrollInsightsModal } from './components/AIPayrollInsightsModal';
import { PublicPayslipView } from './components/PublicPayslipView';
import {
  pushToServerSync,
  pullFromServerSync,
  subscribeToServerSyncStream,
  recordWorkerDeletion,
  clearRecordedDeletion,
  getDeletedWorkerIds,
  recordCellClear,
  clearRecordedCellClear,
} from './lib/serverSync';
import {
  UserPlus,
  Calendar,
  Flame,
  Search,
  Download,
  FastForward,
  RotateCcw,
  RotateCw,
  Sparkles,
  Users,
  Clock,
  DollarSign,
  Grid3X3,
  ListOrdered,
  HelpCircle,
  FileSpreadsheet,
  Smartphone,
  ArrowUpDown,
  BarChart3,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Laptop,
  Globe,
  Check,
  SlidersHorizontal,
  BookOpen,
  Lock,
  Unlock,
  Pencil,
  Building2,
  Award,
  Sun,
  Moon,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Send,
  FileText,
  Printer,
  RefreshCw,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  logoutUser,
  testFirestoreConnection,
  syncUserDataToFirestore,
  subscribeToUserCloudData,
  fetchUserCloudData,
  deleteWorkerFromFirestore,
  checkIncomingAccountTransfer,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, getRedirectResult } from 'firebase/auth';

const STORAGE_KEY_WORKERS = 'plant_attendance_workers_v2';
const STORAGE_KEY_ATTENDANCE = 'plant_attendance_data_v2';
const STORAGE_KEY_HEADER_DETAILS = 'plant_app_header_details_v2';

interface AppHeaderDetails {
  appName: string;
  tagline: string;
  contractorName: string;
  associationName: string;
  appIconBase64?: string;
  isLocked: boolean;
}

interface HistorySnapshot {
  workers: Worker[];
  attendanceDb: AttendanceDatabase;
  monthlyWorkersDb: Record<string, Worker[]>;
  masterWorkers: Worker[];
}

const DEFAULT_HEADER_DETAILS: AppHeaderDetails = {
  appName: 'Dev & Sons Attendance Manager',
  tagline: 'Furnace A • Furnace B • CCM Plant Attendance & Operations',
  contractorName: '',
  associationName: '',
  appIconBase64: '',
  isLocked: false,
};

const SAMPLE_WORKER_NAMES = new Set<string>([]);

const isSampleWorker = (w: any) => {
  if (!w || typeof w !== 'object' || !w.id) return true;
  return false;
};

export const safeSanitizeWorker = (w: any, index: number = 0): Worker | null => {
  if (!w || typeof w !== 'object') return null;
  const id = typeof w.id === 'string' && w.id.trim() ? w.id.trim() : (w.id ? String(w.id) : `w-${Date.now()}-${index}`);
  const name = typeof w.name === 'string' ? w.name.trim() : (w.name ? String(w.name).trim() : '');
  if (!name) return null;
  const unit = typeof w.unit === 'string' && w.unit.trim() ? w.unit.trim() : 'Furnace A';
  const designation = typeof w.designation === 'string' && w.designation.trim() ? w.designation.trim().toUpperCase() : 'WORKER';
  const rawSalary = typeof w.salary === 'number' && !isNaN(w.salary) ? w.salary : parseFloat(w.salary);
  const salary = !isNaN(rawSalary) && rawSalary >= 0 ? rawSalary : 26000;

  return {
    ...w,
    id,
    name,
    unit,
    designation,
    salary,
    orderIndex: typeof w.orderIndex === 'number' && !isNaN(w.orderIndex) ? w.orderIndex : index,
    employeeCode: typeof w.employeeCode === 'string' ? w.employeeCode : (w.employeeCode ? String(w.employeeCode) : ''),
    status: w.status === 'inactive' ? 'inactive' : 'active',
    isDeleted: Boolean(w.isDeleted),
  };
};

export const safeNormalizeWorkersList = (raw: any): Worker[] => {
  if (!Array.isArray(raw)) return [];
  const valid: Worker[] = [];
  raw.forEach((item, idx) => {
    const sanitized = safeSanitizeWorker(item, idx);
    if (sanitized && !isSampleWorker(sanitized)) {
      valid.push(sanitized);
    }
  });
  return valid;
};

// Migration flag check (safe)
try {
  if (typeof window !== 'undefined' && !localStorage.getItem('plant_cleaned_all_mock_workers_v4')) {
    localStorage.setItem('plant_cleaned_all_mock_workers_v4', 'true');
  }
} catch {}

const safeGetStorage = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn(`Corrupt storage for key ${key}, falling back to default`, err);
    return fallback;
  }
};

export default function App() {
  // Check for public payslip view URL parameter
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'payslip') {
    return <PublicPayslipView />;
  }

  // Customizable Header Details State
  const [headerDetails, setHeaderDetails] = useState<AppHeaderDetails>(() => {
    const saved = safeGetStorage(STORAGE_KEY_HEADER_DETAILS, DEFAULT_HEADER_DETAILS);
    if (!saved || typeof saved !== 'object' || !saved.appName) return DEFAULT_HEADER_DETAILS;
    return saved;
  });

  const [isHeaderEditModalOpen, setIsHeaderEditModalOpen] = useState<boolean>(false);
  const [tempHeaderDetails, setTempHeaderDetails] = useState<AppHeaderDetails>(headerDetails);

  const handleSaveHeaderDetails = (newDetails: AppHeaderDetails) => {
    setHeaderDetails(newDetails);
    try {
      localStorage.setItem(STORAGE_KEY_HEADER_DETAILS, JSON.stringify(newDetails));
    } catch (e) {
      console.warn('Failed to save header details:', e);
    }
    setIsHeaderEditModalOpen(false);
  };

  // Customizable Theme Mode State
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => safeGetStorage('app_theme_mode_v2', 'system'));

  // Default App Base Date - October 2026 (App was commissioned October 2026)
  const defaultBaseYear = 2026;
  const defaultBaseMonth = 10; // October 2026
  
  const [year, setYear] = useState<number>(defaultBaseYear);
  const [month, setMonth] = useState<number>(defaultBaseMonth);
  const [isYearEditing, setIsYearEditing] = useState<boolean>(false);
  const [customYearInput, setCustomYearInput] = useState<string>(String(defaultBaseYear));

  // Independent Date State for Payslip/Ledger View
  const [ledgerYear, setLedgerYear] = useState<number>(defaultBaseYear);
  const [ledgerMonth, setLedgerMonth] = useState<number>(defaultBaseMonth);

  // Authentication & Multi-device cloud sync state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Unique device ID for this session/tab to identify cross-device sync broadcasts
  const [localDeviceId] = useState<string>(() => {
    try {
      let id = sessionStorage.getItem('plant_device_session_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        sessionStorage.setItem('plant_device_session_id', id);
      }
      return id;
    } catch {
      return 'dev_' + Math.random().toString(36).substring(2, 9);
    }
  });
  const localDeviceIdRef = useRef(localDeviceId);
  const lastAppliedRevisionRef = useRef<number>(0);

  // Database of month-specific explicitly removed worker IDs
  const [monthlyRemovedWorkersDb, setMonthlyRemovedWorkersDb] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('plant_monthly_removed_workers_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return {};
  });

  const monthlyRemovedWorkersDbRef = useRef(monthlyRemovedWorkersDb);
  useEffect(() => {
    monthlyRemovedWorkersDbRef.current = monthlyRemovedWorkersDb;
  }, [monthlyRemovedWorkersDb]);

  // Master directory of all saved staff profiles
  const [masterWorkers, setMasterWorkers] = useState<Worker[]>(() => {
    const saved = safeGetStorage('plant_master_workers_v3', []);
    return safeNormalizeWorkersList(saved);
  });
  const masterWorkersRef = useRef(masterWorkers);
  useEffect(() => { masterWorkersRef.current = masterWorkers; }, [masterWorkers]);

  // Day notes / plant shutdown / maintenance reasons database per month
  const [dayNotesDb, setDayNotesDb] = useState<Record<string, Record<number, string>>>(() => {
    try {
      const saved = localStorage.getItem('plant_day_notes_db_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch {}
    return {};
  });

  const dayNotesDbRef = useRef(dayNotesDb);
  useEffect(() => {
    dayNotesDbRef.current = dayNotesDb;
    try {
      localStorage.setItem('plant_day_notes_db_v1', JSON.stringify(dayNotesDb));
    } catch {}
  }, [dayNotesDb]);

  const [activeDayNoteTarget, setActiveDayNoteTarget] = useState<number | null>(null);
  const [dayNoteInputValue, setDayNoteInputValue] = useState<string>('');
  const [isDayNoteModalOpen, setIsDayNoteModalOpen] = useState<boolean>(false);

  const handleOpenDayNoteModal = (day: number) => {
    setActiveDayNoteTarget(day);
    const notesForMonth = dayNotesDb[currentMonthKey] || {};
    setDayNoteInputValue(notesForMonth[day] || '');
    setIsDayNoteModalOpen(true);
  };

  const handleDataImport = (importedData: any) => {
    if (!importedData || !importedData.data) {
      alert('Invalid file format: Missing data section.');
      return;
    }
    const { workers, masterWorkers, monthlyWorkersDb, attendanceDb } = importedData.data;

    // Apply data
    const normalizedWorkers = safeNormalizeWorkersList(workers || []);
    const normalizedMaster = safeNormalizeWorkersList(masterWorkers || []);

    setWorkers(normalizedWorkers);
    setMasterWorkers(normalizedMaster);
    if (monthlyWorkersDb) setMonthlyWorkersDb(monthlyWorkersDb);
    if (attendanceDb) setAttendanceDb(attendanceDb);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(normalizedWorkers));
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(normalizedMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(monthlyWorkersDb || {}));
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(attendanceDb || {}));
    } catch (e) {
      console.error('Failed to save imported data to localStorage', e);
    }

    setReloadToast('✅ Data imported successfully!');
    setTimeout(() => setReloadToast(null), 3500);

    // Push to cloud sync
    pushToCloudNow(normalizedWorkers, attendanceDb, monthlyWorkersDb, normalizedMaster);
  };

  const handleSaveDayNote = (customVal?: string | unknown) => {
    if (activeDayNoteTarget === null) return;
    const day = activeDayNoteTarget;
    const rawVal = typeof customVal === 'string' ? customVal : dayNoteInputValue;
    const valToSave = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal || '').trim();

    setDayNotesDb((prev) => {
      const monthNotes = { ...(prev[currentMonthKey] || {}) };
      if (!valToSave) {
        delete monthNotes[day];
      } else {
        monthNotes[day] = valToSave;
      }
      const updated = {
        ...prev,
        [currentMonthKey]: monthNotes,
      };
      try {
        localStorage.setItem('plant_day_notes_db_v1', JSON.stringify(updated));
      } catch {}
      pushToCloudNow(undefined, undefined, undefined, undefined, undefined, updated);
      return updated;
    });
    setIsDayNoteModalOpen(false);
    setActiveDayNoteTarget(null);
  };

  // Database of month-specific lists of workers
  const [monthlyWorkersDb, setMonthlyWorkersDb] = useState<Record<string, Worker[]>>(() => {
    const saved = safeGetStorage('plant_monthly_workers_db_v3', {});
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};
    const normalized: Record<string, Worker[]> = {};
    Object.keys(saved).forEach((mKey) => {
      normalized[mKey] = safeNormalizeWorkersList(saved[mKey]);
    });
    return normalized;
  });
  const monthlyWorkersDbRef = useRef(monthlyWorkersDb);
  useEffect(() => { monthlyWorkersDbRef.current = monthlyWorkersDb; }, [monthlyWorkersDb]);
  
  // Monthly Allocation Database
  const [monthlyAllocationDb, setMonthlyAllocationDb] = useState<MonthlyAllocationDatabase>(() => {
    const saved = safeGetStorage('plant_monthly_allocation_db_v1', {});
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};
    return saved;
  });
  const monthlyAllocationDbRef = useRef(monthlyAllocationDb);
  useEffect(() => { monthlyAllocationDbRef.current = monthlyAllocationDb; }, [monthlyAllocationDb]);
  
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = safeGetStorage(STORAGE_KEY_WORKERS, []);
    return safeNormalizeWorkersList(saved);
  });
  const workersRef = useRef(workers);
  useEffect(() => { workersRef.current = workers; }, [workers]);

  const [attendanceDb, setAttendanceDb] = useState<AttendanceDatabase>(() => {
    const saved = safeGetStorage(STORAGE_KEY_ATTENDANCE, {});
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};
    return saved;
  });
  const attendanceDbRef = useRef(attendanceDb);
  useEffect(() => { attendanceDbRef.current = attendanceDb; }, [attendanceDb]);


  // Attendance & Roster History Undo/Redo States (Session-scoped only, clear on refresh/restart like Excel)
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>(() => {
    // Clean up any legacy persisted undo/redo stacks from localStorage
    try {
      localStorage.removeItem('plant_undo_stack_v3');
      localStorage.removeItem('plant_redo_stack_v3');
    } catch {}
    return [];
  });
  
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Capture snapshot of workers, attendanceDb, monthlyWorkersDb, and masterWorkers
  const saveToHistory = (
    curWorkers: Worker[] = workers,
    curAttendance: AttendanceDatabase = attendanceDb,
    curMonthlyDb: Record<string, Worker[]> = monthlyWorkersDb,
    curMaster: Worker[] = masterWorkers
  ) => {
    try {
      const snapshot: HistorySnapshot = {
        workers: JSON.parse(JSON.stringify(curWorkers)),
        attendanceDb: JSON.parse(JSON.stringify(curAttendance)),
        monthlyWorkersDb: JSON.parse(JSON.stringify(curMonthlyDb)),
        masterWorkers: JSON.parse(JSON.stringify(curMaster)),
      };
      
      setUndoStack((prev) => {
        const updated = [...prev, snapshot];
        if (updated.length > 15) return updated.slice(updated.length - 15); // limit size to 15 snapshots
        return updated;
      });
      setRedoStack([]); // Clear redo stack on new action
    } catch (e) {
      console.warn('Failed to save to undo history:', e);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    try {
      const currentSnapshot: HistorySnapshot = {
        workers: JSON.parse(JSON.stringify(workers)),
        attendanceDb: JSON.parse(JSON.stringify(attendanceDb)),
        monthlyWorkersDb: JSON.parse(JSON.stringify(monthlyWorkersDb)),
        masterWorkers: JSON.parse(JSON.stringify(masterWorkers)),
      };

      setRedoStack((prev) => {
        const updated = [...prev, currentSnapshot];
        if (updated.length > 15) return updated.slice(updated.length - 15);
        return updated;
      });
      
      setUndoStack(newUndoStack);

      // Restore states
      setWorkers(previous.workers);
      setAttendanceDb(previous.attendanceDb);
      setMonthlyWorkersDb(previous.monthlyWorkersDb);
      setMasterWorkers(previous.masterWorkers);
    } catch (e) {
      console.warn('Undo failed:', e);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    try {
      const currentSnapshot: HistorySnapshot = {
        workers: JSON.parse(JSON.stringify(workers)),
        attendanceDb: JSON.parse(JSON.stringify(attendanceDb)),
        monthlyWorkersDb: JSON.parse(JSON.stringify(monthlyWorkersDb)),
        masterWorkers: JSON.parse(JSON.stringify(masterWorkers)),
      };

      setUndoStack((prev) => {
        const updated = [...prev, currentSnapshot];
        if (updated.length > 15) return updated.slice(updated.length - 15);
        return updated;
      });

      setRedoStack(newRedoStack);

      // Restore states
      setWorkers(next.workers);
      setAttendanceDb(next.attendanceDb);
      setMonthlyWorkersDb(next.monthlyWorkersDb);
      setMasterWorkers(next.masterWorkers);
    } catch (e) {
      console.warn('Redo failed:', e);
    }
  };

  // Filters & Search
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View state
  const [viewMode, setViewMode] = useState<'master' | 'ledger'>('master');
  const [gridDisplayMode, setGridDisplayMode] = useState<'table' | 'overview'>('table');
  const [selectedLedgerWorker, setSelectedLedgerWorker] = useState<Worker | null>(null);

  // Modals
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState<boolean>(false);
  const [isManageRosterOpen, setIsManageRosterOpen] = useState<boolean>(false);
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState<boolean>(false);
  const [isMonthAllocationOpen, setIsMonthAllocationOpen] = useState<boolean>(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  const [isColorfulTableModalOpen, setIsColorfulTableModalOpen] = useState<boolean>(false);

  // Zoom level state (supports laptops & phones zoom-in/out)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('app_zoom_level_v2');
      if (saved) {
        const parsed = parseFloat(saved);
        if (parsed >= 0.7 && parsed <= 1.4) return parsed;
      }
    } catch {}
    return 1.0; // Default Zoom (100%)
  });

  const handleZoomIn = () => {
    setZoomLevel((prev) => {
      const next = Math.min(prev + 0.1, 1.4);
      localStorage.setItem('app_zoom_level_v2', next.toFixed(1));
      return parseFloat(next.toFixed(1));
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.1, 0.7);
      localStorage.setItem('app_zoom_level_v2', next.toFixed(1));
      return parseFloat(next.toFixed(1));
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    localStorage.setItem('app_zoom_level_v2', '1.0');
  };

  // Real-time Clock states
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timeFormat, setTimeFormat] = useState<'12hr' | '24hr'>(() => {
    try {
      const saved = localStorage.getItem('clock_time_format_v2');
      if (saved === '12hr' || saved === '24hr') return saved;
    } catch {}
    return '12hr';
  });
  const [dateFormat, setDateFormat] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('clock_date_format_v2');
      if (saved) return saved;
    } catch {}
    return 'DD/MM/YYYY';
  });
  const [timezoneMode, setTimezoneMode] = useState<'device' | 'timezone'>(() => {
    try {
      const saved = localStorage.getItem('clock_timezone_mode_v2');
      if (saved === 'device' || saved === 'timezone') return saved;
    } catch {}
    return 'device';
  });
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('clock_selected_timezone_v2');
      if (saved) return saved;
    } catch {}
    return 'Asia/Kolkata'; // Default to IST (India)
  });
  const [timeHourOffset, setTimeHourOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('clock_hour_offset_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 0;
  });
  const [timeMinuteOffset, setTimeMinuteOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('clock_minute_offset_v2');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 0;
  });
  const [isTimeSettingsOpen, setIsTimeSettingsOpen] = useState<boolean>(false);

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save clocks options changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('clock_time_format_v2', timeFormat);
      localStorage.setItem('clock_date_format_v2', dateFormat);
      localStorage.setItem('clock_timezone_mode_v2', timezoneMode);
      localStorage.setItem('clock_selected_timezone_v2', selectedTimezone);
      localStorage.setItem('clock_hour_offset_v2', String(timeHourOffset));
      localStorage.setItem('clock_minute_offset_v2', String(timeMinuteOffset));
    } catch {}
  }, [timeFormat, dateFormat, timezoneMode, selectedTimezone, timeHourOffset, timeMinuteOffset]);

  const getFormattedDateTime = () => {
    let date = new Date(currentTime);

    // Apply Timezone Standard Offsets if selected
    if (timezoneMode === 'timezone') {
      try {
        const tzString = date.toLocaleString('en-US', { timeZone: selectedTimezone });
        date = new Date(tzString);
      } catch (e) {
        console.warn('Failed to convert timezone:', e);
      }
    }

    // Apply Manual Hour & Minute offsets
    if (timeHourOffset !== 0 || timeMinuteOffset !== 0) {
      date = new Date(date.getTime() + (timeHourOffset * 60 * 60 * 1000) + (timeMinuteOffset * 60 * 1000));
    }

    // Formatted time with seconds
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    let ampm = '';
    if (timeFormat === '12hr') {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // convert 0 to 12
    }
    
    const displayHours = String(hours).padStart(2, '0');
    const displayMinutes = String(minutes).padStart(2, '0');
    const displaySeconds = String(seconds).padStart(2, '0');
    const timeString = `${displayHours}:${displayMinutes}:${displaySeconds}${ampm}`;

    // Formatted Date
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

    let dateString = '';
    if (dateFormat === 'DD/MM/YYYY') {
      dateString = `${dd}/${mm}/${yyyy}`;
    } else if (dateFormat === 'MM/DD/YYYY') {
      dateString = `${mm}/${dd}/${yyyy}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      dateString = `${yyyy}-${mm}-${dd}`;
    } else {
      dateString = `${day} ${monthNamesFull[monthIdx]} ${yyyy}`;
    }

    return { dateString, timeString };
  };

  const formattedClock = getFormattedDateTime();
  const [workerToEdit, setWorkerToEdit] = useState<Worker | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState<boolean>(false);
  const [isShareAppUrlOpen, setIsShareAppUrlOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('custom');
  const [isQuickTapOpen, setIsQuickTapOpen] = useState<boolean>(false);
  const [quickTapTarget, setQuickTapTarget] = useState<{ worker: Worker; day: number } | null>(null);
  const [isBatchFillOpen, setIsBatchFillOpen] = useState<boolean>(false);
  const [isFormulaHelpOpen, setIsFormulaHelpOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [isTransferDataModalOpen, setIsTransferDataModalOpen] = useState<boolean>(false);
  const [isProfilesReportModalOpen, setIsProfilesReportModalOpen] = useState<boolean>(false);
  const [isMonthlyShiftNotesReportOpen, setIsMonthlyShiftNotesReportOpen] = useState<boolean>(false);
  const [reloadToast, setReloadToast] = useState<string | null>(null);
  const [isAIInsightsOpen, setIsAIInsightsOpen] = useState<boolean>(false);
  const lastServerSyncTimeRef = useRef<number>(0);

  // Ref to prevent feedback ping-pong loops when receiving remote updates
  const isRemoteSyncingRef = useRef<boolean>(false);

  // Derived current month key: e.g. "2026-10"
  const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const currentMonthKeyRef = useRef<string>(currentMonthKey);

  useEffect(() => {
    currentMonthKeyRef.current = currentMonthKey;
  }, [currentMonthKey]);

  // Manual Cloud Sync Trigger (Sync Now & Refresh) - Unified Multi-Source Server Sync & Firestore Reconciliation
  const handleManualSync = async () => {
    setSyncStatus('syncing');
    try {
      const accountKey = currentUser?.email || (currentUser?.uid ? `user_${currentUser.uid}` : `guest_${localDeviceIdRef.current}`);
      const curMonth = currentMonthKeyRef.current;

      // 1. Pull latest from Server Sync
      let serverData: any = null;
      try {
        serverData = await pullFromServerSync(accountKey);
      } catch (e) {
        console.warn('Server sync pull notice:', e);
      }

      // 2. Pull from Firestore if user is logged in
      let cloudData: any = null;
      if (currentUser) {
        try {
          cloudData = await fetchUserCloudData(currentUser.uid, currentUser.email || '');
        } catch (e) {
          console.warn('Firestore cloud fetch notice:', e);
        }
      }

      let mergedMaster = [...masterWorkersRef.current];
      let mergedMonthly = { ...monthlyWorkersDbRef.current };
      let mergedAtt = { ...attendanceDbRef.current };
      let mergedAllocation = { ...monthlyAllocationDbRef.current };
      let mergedDayNotes = { ...dayNotesDbRef.current };

      const sources = [serverData, cloudData].filter(Boolean);

      sources.forEach((sourceData) => {
        if (Array.isArray(sourceData.deletedWorkerIds)) {
          sourceData.deletedWorkerIds.forEach((dId: string) => recordWorkerDeletion(dId));
        }

        if (sourceData.dayNotesDb) {
          mergedDayNotes = { ...mergedDayNotes, ...sourceData.dayNotesDb };
        }

        const loadedRawMaster = safeNormalizeWorkersList([
          ...(sourceData.masterWorkers || []),
          ...(sourceData.workers || []),
        ]);
        mergedMaster = mergeWorkersWithLWW(mergedMaster, loadedRawMaster);

        const loadedMonthly: Record<string, Worker[]> = sourceData.monthlyWorkersDb || {};
        const loadedAtt: AttendanceDatabase = sourceData.attendance || {};
        const loadedAllocation: MonthlyAllocationDatabase = sourceData.monthlyAllocationDb || {};

        mergedMonthly = mergeRosterWithLWW(mergedMonthly, loadedMonthly);
        mergedAtt = mergeAttendanceWithLWW(mergedAtt, loadedAtt);
        mergedAllocation = mergeMonthlyAllocationWithLWW(mergedAllocation, loadedAllocation);
      });

      const deletedIds = new Set(getDeletedWorkerIds());
      const activeMaster = mergedMaster.filter(
        (w) => w && w.id && w.name && !w.isDeleted && w.status !== 'inactive' && !deletedIds.has(w.id)
      );
      deletedIds.forEach((dId) => delete mergedAtt[dId]);
      const curActiveStaff = getActiveWorkersForMonth(activeMaster, mergedAllocation, curMonth);

      isRemoteSyncingRef.current = true;
      setMasterWorkers(activeMaster);
      setMonthlyWorkersDb(mergedMonthly);
      setAttendanceDb(mergedAtt);
      setMonthlyAllocationDb(mergedAllocation);
      setDayNotesDb(mergedDayNotes);
      setWorkers(curActiveStaff);

      try {
        localStorage.setItem('plant_master_workers_v3', JSON.stringify(activeMaster));
        localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(mergedMonthly));
        localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(mergedAllocation));
        localStorage.setItem('plant_day_notes_db_v1', JSON.stringify(mergedDayNotes));
        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(mergedAtt));
        localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(curActiveStaff));
        localStorage.removeItem('plant_pending_cloud_sync');
      } catch {}

      // Write merged state to both Server Sync AND Firestore
      try {
        await pushToServerSync({
          accountKey,
          userEmail: currentUser?.email || '',
          userId: currentUser?.uid,
          workers: curActiveStaff,
          attendance: mergedAtt,
          monthlyWorkersDb: mergedMonthly,
          masterWorkers: activeMaster,
          monthlyAllocationDb: mergedAllocation,
          dayNotesDb: mergedDayNotes,
          deletedWorkerIds: getDeletedWorkerIds(),
          timestamp: Date.now(),
        });
        lastServerSyncTimeRef.current = Date.now();
      } catch (sErr) {
        console.warn('Server sync push notice:', sErr);
      }

      if (currentUser) {
        try {
          await syncUserDataToFirestore(
            currentUser.uid,
            curActiveStaff,
            mergedAtt,
            mergedMonthly,
            activeMaster,
            currentUser.email || '',
            getDeletedWorkerIds(),
            localDeviceIdRef.current,
            undefined,
            mergedAllocation,
            mergedDayNotes
          );
        } catch (fErr) {
          console.warn('Firestore sync notice:', fErr);
        }
      }

      setTimeout(() => {
        isRemoteSyncingRef.current = false;
      }, 100);

      setSyncStatus('synced');
      setReloadToast('⚡ Refresh Successful! Pulled all latest entries from mobile & cloud.');
      setTimeout(() => setReloadToast(null), 3500);
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
      setReloadToast('⚠️ Sync issue: checking connection...');
      setTimeout(() => setReloadToast(null), 3500);
    }
  };

  // Connection test & Auth listener (runs once on mount with clean unmount)
  useEffect(() => {
    testFirestoreConnection();
    getRedirectResult(auth).catch(() => {});

    let unsubData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubData) {
        unsubData();
        unsubData = null;
      }

      if (user) {
        const hasPendingSync = typeof window !== 'undefined' && localStorage.getItem('plant_pending_cloud_sync') === 'true';

        // When user logs in, check if there is an incoming one-time data transfer for their email
        if (user.email) {
          try {
            const incomingTransfer = await checkIncomingAccountTransfer(user.email);
            if (incomingTransfer && incomingTransfer.data) {
              const d = incomingTransfer.data;
              isRemoteSyncingRef.current = true;
              if (d.workers && Array.isArray(d.workers)) setWorkers(d.workers);
              if (d.masterWorkers && Array.isArray(d.masterWorkers)) setMasterWorkers(d.masterWorkers);
              if (d.monthlyWorkersDb) setMonthlyWorkersDb(d.monthlyWorkersDb);
              if (d.attendanceDb) setAttendanceDb(d.attendanceDb);
              setReloadToast(`🎉 Account Data transferred from ${incomingTransfer.senderEmail || 'previous account'} restored successfully!`);
              setTimeout(() => {
                isRemoteSyncingRef.current = false;
                setReloadToast(null);
              }, 4000);
            }
          } catch (e) {
            console.warn('Incoming transfer check notice:', e);
          }
        }

        // Subscribe to user cloud documents for instant multi-device sync
        setSyncStatus('syncing');
        unsubData = subscribeToUserCloudData(
          user.uid,
          (cloudWorkers, cloudAttendance, cloudMonthlyWorkersDb, cloudMasterWorkers, cloudDeletedIds, cloudAllocationDb, cloudDayNotesDb) => {
            isRemoteSyncingRef.current = true;
            const curMonth = currentMonthKeyRef.current;
            
            // 1. Record any cloud tombstones locally
            if (Array.isArray(cloudDeletedIds)) {
              cloudDeletedIds.forEach((dId) => {
                recordWorkerDeletion(dId);
              });
            }
            const deletedWorkerIds = new Set(getDeletedWorkerIds());

            // 2. Unify and merge master workers
            const incomingMaster = safeNormalizeWorkersList([
              ...(cloudMasterWorkers || []),
              ...(cloudWorkers || []),
            ]);
            const finalMaster = mergeWorkersWithLWW(masterWorkersRef.current, incomingMaster);
            const activeMaster = finalMaster.filter(
              (w) => w && w.id && w.name && !w.isDeleted && w.status !== 'inactive' && !deletedWorkerIds.has(w.id)
            );

            setMasterWorkers(activeMaster);
            try {
              localStorage.setItem('plant_master_workers_v3', JSON.stringify(activeMaster));
            } catch {}

            // 3. Unify monthly management roster with LWW
            let finalMonthly = mergeRosterWithLWW(monthlyWorkersDbRef.current, cloudMonthlyWorkersDb || {});
            setMonthlyWorkersDb(finalMonthly);
            try {
              localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(finalMonthly));
            } catch {}

            // 4. Unify monthly allocation database with LWW
            let finalAllocation = monthlyAllocationDbRef.current;
            if (cloudAllocationDb) {
              finalAllocation = mergeMonthlyAllocationWithLWW(monthlyAllocationDbRef.current, cloudAllocationDb);
              setMonthlyAllocationDb(finalAllocation);
              try {
                localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(finalAllocation));
              } catch {}
            }

            // 5. Current month staff derived accurately from Master Directory + Monthly Allocation
            const currentMonthStaff = getActiveWorkersForMonth(activeMaster, finalAllocation, curMonth);
            setWorkers(currentMonthStaff);
            try {
              localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(currentMonthStaff));
            } catch {}

            if (cloudAttendance) {
              const mergedAtt = mergeAttendanceWithLWW(attendanceDbRef.current, cloudAttendance);
              deletedWorkerIds.forEach((dId) => {
                delete mergedAtt[dId];
              });
              setAttendanceDb(mergedAtt);
              try {
                localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(mergedAtt));
              } catch {}
            }

            if (cloudDayNotesDb) {
              setDayNotesDb(cloudDayNotesDb);
              try {
                localStorage.setItem('plant_day_notes_db_v1', JSON.stringify(cloudDayNotesDb));
              } catch {}
            }

            setSyncStatus('synced');

            if (hasPendingSync) {
              try {
                localStorage.removeItem('plant_pending_cloud_sync');
              } catch {}
            }

            setTimeout(() => {
              isRemoteSyncingRef.current = false;
            }, 100);
          },
          user.email || '',
          localDeviceIdRef.current
        );
      } else {
        setSyncStatus('offline');
      }
    });

    return () => {
      if (unsubData) unsubData();
      unsubAuth();
    };
  }, []);

  // Instant Cloud Synchronization Push Helper (Sub-50ms)
  const pushToCloudNow = async (
    updatedWorkers?: Worker[],
    updatedAttendance?: AttendanceDatabase,
    updatedMonthlyDb?: Record<string, Worker[]>,
    updatedMaster?: Worker[],
    updatedAllocation?: MonthlyAllocationDatabase,
    updatedDayNotesDb?: Record<string, Record<number, string>>
  ) => {
    const workers = updatedWorkers || workersRef.current;
    const attendance = updatedAttendance || attendanceDbRef.current;
    const monthlyDb = updatedMonthlyDb || monthlyWorkersDbRef.current;
    const master = updatedMaster || masterWorkersRef.current;
    const allocation = updatedAllocation || monthlyAllocationDbRef.current;
    const dayNotes = updatedDayNotesDb || dayNotesDbRef.current;

    // 1. Instant Push to Dedicated Server Sync (works unconditionally across all devices & browsers)
    try {
      const serverAccountKey = currentUser?.email || (currentUser?.uid ? `user_${currentUser.uid}` : `guest_${localDeviceIdRef.current}`);
      await pushToServerSync({
        accountKey: serverAccountKey,
        userEmail: currentUser?.email || '',
        userId: currentUser?.uid,
        senderDeviceId: localDeviceIdRef.current,
        workers: workers,
        attendance: attendance,
        monthlyWorkersDb: monthlyDb,
        masterWorkers: master,
        monthlyAllocationDb: allocation,
        deletedWorkerIds: getDeletedWorkerIds(),
        timestamp: Date.now(),
      });
      lastServerSyncTimeRef.current = Date.now();
      setSyncStatus('synced');
    } catch (sErr) {
      console.warn('Server sync push notice:', sErr);
    }

    // 2. Parallel push to Firebase Firestore (if logged in)
    if (currentUser) {
      try {
        await syncUserDataToFirestore(
          currentUser.uid,
          workers,
          attendance,
          monthlyDb,
          master,
          currentUser.email || '',
          getDeletedWorkerIds(),
          localDeviceIdRef.current,
          undefined,
          allocation,
          dayNotes
        );
        try {
          localStorage.removeItem('plant_pending_cloud_sync');
        } catch {}
      } catch (fErr) {
        console.warn('Firestore real-time sync notice:', fErr);
      }
    }
  };

  // Apply incoming authoritative remote sync data (from SSE or Firestore snapshot)
  const applyIncomingSyncData = useCallback((serverData: any) => {
    if (!serverData) return;

    // If this update was broadcast by this exact device/tab, ignore echo
    if (serverData.senderDeviceId && serverData.senderDeviceId === localDeviceIdRef.current) {
      return;
    }

    const incomingRev = Number(serverData.revision) || 0;
    const incomingTs = Number(serverData.timestamp) || 0;
    if (incomingRev > 0 && incomingRev <= lastAppliedRevisionRef.current) {
      return;
    }
    if (incomingRev === 0 && incomingTs <= lastServerSyncTimeRef.current) {
      return;
    }

    if (incomingRev > 0) lastAppliedRevisionRef.current = incomingRev;
    lastServerSyncTimeRef.current = Math.max(lastServerSyncTimeRef.current, incomingTs);

    if (isRemoteSyncingRef.current) return;
    const curMonth = currentMonthKeyRef.current;

    // Record server-side deleted tombstones locally
    (serverData.deletedWorkerIds || []).forEach((dId: string) => {
      recordWorkerDeletion(dId);
    });
    const deletedWorkerIds = new Set(getDeletedWorkerIds());
    
    // Merge day notes
    if (serverData.dayNotesDb) {
      setDayNotesDb(prev => ({...prev, ...serverData.dayNotesDb}));
      try {
        localStorage.setItem('plant_day_notes_db_v1', JSON.stringify({...dayNotesDb, ...serverData.dayNotesDb}));
      } catch {}
    }

    const rawServerMaster = safeNormalizeWorkersList([
      ...(serverData.masterWorkers || []),
      ...(serverData.workers || []),
    ]);
    const mergedMaster = mergeWorkersWithLWW(masterWorkersRef.current, rawServerMaster);
    const activeMaster = mergedMaster.filter(
      (w) => w && w.id && w.name && !w.isDeleted && w.status !== 'inactive' && !deletedWorkerIds.has(w.id)
    );

    const incomingMonthlyDb = serverData.monthlyWorkersDb && typeof serverData.monthlyWorkersDb === 'object' && !Array.isArray(serverData.monthlyWorkersDb) ? serverData.monthlyWorkersDb : {};
    const mergedMonthly = mergeRosterWithLWW(monthlyWorkersDbRef.current, incomingMonthlyDb);
    
    let mergedAllocation = monthlyAllocationDbRef.current;
    if (serverData.monthlyAllocationDb) {
      mergedAllocation = mergeMonthlyAllocationWithLWW(monthlyAllocationDbRef.current, serverData.monthlyAllocationDb);
      setMonthlyAllocationDb(mergedAllocation);
      try {
        localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(mergedAllocation));
      } catch {}
    }

    const activeStaff = getActiveWorkersForMonth(activeMaster, mergedAllocation, curMonth);
    const loadedAtt = mergeAttendanceWithLWW(
      attendanceDbRef.current,
      serverData.attendance || {}
    );
    deletedWorkerIds.forEach((dId) => {
      delete loadedAtt[dId];
    });

    isRemoteSyncingRef.current = true;
    setMasterWorkers(activeMaster);
    setMonthlyWorkersDb(mergedMonthly);
    setAttendanceDb(loadedAtt);
    setWorkers(activeStaff);

    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(activeMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(mergedMonthly));
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(loadedAtt));
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(activeStaff));
    } catch {}

    setSyncStatus('synced');
    setTimeout(() => {
      isRemoteSyncingRef.current = false;
    }, 100);
  }, []);

  // 100% Real-Time Cross-Device Sync Watcher (Sub-50ms SSE live stream + fallback polling)
  useEffect(() => {
    let isCancelled = false;
    const accountKey = currentUser?.email || (currentUser?.uid ? `user_${currentUser.uid}` : `guest_${localDeviceIdRef.current}`);

    // 1. Instant Real-Time Server-Sent Events (SSE) Stream Listener
    const unsubscribeStream = subscribeToServerSyncStream(accountKey, (serverData) => {
      if (isCancelled || !serverData) return;
      applyIncomingSyncData(serverData);
    });

    // 2. Periodic background verification check
    const syncCheckInterval = setInterval(async () => {
      if (isCancelled || isRemoteSyncingRef.current) return;
      try {
        const serverData = await pullFromServerSync(accountKey);
        if (serverData && !isCancelled) {
          applyIncomingSyncData(serverData);
        }
      } catch {
        // Quiet background check
      }
    }, 4000);

    return () => {
      isCancelled = true;
      unsubscribeStream();
      clearInterval(syncCheckInterval);
    };
  }, [currentUser, applyIncomingSyncData]);


  // Check URL query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('install') === 'android' || params.get('download') === 'apk') {
        setIsAndroidModalOpen(true);
      }
    }
  }, []);

  // Full JSON database backup exporter
  const handleExportJSON = () => {
    const backupData = {
      appName: 'Staff Attendance & Payroll Manager',
      exportDate: new Date().toISOString(),
      year,
      month,
      monthName: monthNames[month - 1],
      workers,
      attendanceDb,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Staff_Attendance_Backup_${monthNames[month - 1]}_${year}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    // Landscape A4 for full attendance sheet table
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Title
    doc.setFontSize(14);
    doc.text(`${headerDetails.contractorName || 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES'}`, 14, 12);
    doc.setFontSize(10);
    doc.text(`Attendance & Salary Register - ${monthNames[month - 1]} ${year}`, 14, 18);

    // Columns: Name, Designation, Unit, Phone, Account, Total Days, Payout Salary
    const tableColumn = [
      "Worker Name",
      "Designation",
      "Unit",
      "Mobile",
      "A/C Number",
      "Total Days",
      "Payout Salary"
    ];

    const tableRows = workers.map(worker => {
      const calc = calculations[worker.id] || { totalWorkingDays: 0, payoutSalary: 0 };
      return [
        worker.name,
        worker.designation,
        worker.unit,
        worker.phone || '—',
        worker.accountNumber || '—',
        calc.totalWorkingDays.toFixed(1),
        formatCurrency(calc.payoutSalary)
      ];
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] }, // Indigo
    });

    doc.save(`Attendance_Register_${monthNames[month - 1]}_${year}.pdf`);
  };


  // Month Allocation Architecture:
  // 1. Permanent company-wide profiles in Master Directory are preserved.
  // 2. By default, every month inherits all active profiles from Master Directory.
  // 3. Exclusions configured in monthlyAllocationDb are respected strictly for their month.
  useEffect(() => {
    const activeStaff = getActiveWorkersForMonth(masterWorkers, monthlyAllocationDb, currentMonthKey);
    setWorkers(activeStaff);
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(activeStaff));
    } catch {}
  }, [currentMonthKey, masterWorkers, monthlyAllocationDb]);

  // Save masterWorkers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(masterWorkers));
    } catch (e) {
      console.warn('Failed to save master workers:', e);
    }
  }, [masterWorkers]);

  // Save active workers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(workers));
    } catch (e) {
      console.warn('Failed to save workers to storage:', e);
    }

    setMonthlyWorkersDb((prev) => {
      const existing = prev[currentMonthKey];
      if (JSON.stringify(existing) !== JSON.stringify(workers)) {
        const updated = {
          ...prev,
          [currentMonthKey]: workers,
        };
        try {
          localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  }, [workers]);

  // Save attendanceDb to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(attendanceDb));
    } catch (e) {
      console.warn('Failed to save attendance to storage:', e);
    }
  }, [attendanceDb]);

  // Flattened attendance data for current month: workerId -> day -> code
  // UI queries filter out records with status === 'cleared' or isDeleted === true (rendered as blank/unmarked)
  const currentMonthAttendance = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    if (!Array.isArray(workers)) return map;
    workers.forEach((w) => {
      if (!w || !w.id) return;
      const workerMonth = (attendanceDb && attendanceDb[w.id] && attendanceDb[w.id][currentMonthKey]) || {};
      const dayMap: Record<number, string> = {};
      if (typeof workerMonth === 'object' && workerMonth !== null) {
        Object.keys(workerMonth).forEach((dayStr) => {
          const day = Number(dayStr);
          if (!isNaN(day) && day >= 1 && day <= 31) {
            const code = getAttendanceCode((workerMonth as any)[day]);
            if (code) {
              dayMap[day] = code;
            }
          }
        });
      }
      map[w.id] = dayMap;
    });
    return map;
  }, [workers, attendanceDb, currentMonthKey]);

  // Calculations for all workers in current month (filter out soft-deleted tombstones)
  const calculations = useMemo(() => {
    const map: Record<string, AttendanceCalculation> = {};
    if (!Array.isArray(workers)) return map;
    workers.forEach((w) => {
      if (!w || !w.id || w.isDeleted || w.status === 'inactive') return;
      const workerRecords = currentMonthAttendance[w.id] || {};
      try {
        map[w.id] = calculateWorkerMonthlyAttendance(workerRecords, w, daysInCurrentMonth || 31, currentMonthKey);
      } catch {
        map[w.id] = {
          totalDaysInMonth: daysInCurrentMonth || 31,
          baseWorkingDays: 0,
          totalExtraHours: 0,
          convertedDaysFromHours: 0,
          remainingHours: 0,
          totalWorkingDays: 0,
          totalEquivalentDaysWithFraction: 0,
          monthlySalary: w.salary || 0,
          perDayRate: 0,
          perHourRate: 0,
          payoutSalary: 0,
          presentDaysCount: 0,
          absentDaysCount: 0,
          weeklyOffDaysCount: 0,
        };
      }
    });
    return map;
  }, [workers, currentMonthAttendance, daysInCurrentMonth, currentMonthKey]);

  // =========================================================================
  // Independent Ledger Derived Calculations & Data
  // =========================================================================
  const ledgerMonthKey = `${ledgerYear}-${String(ledgerMonth).padStart(2, '0')}`;
  const daysInLedgerMonth = getDaysInMonth(ledgerYear, ledgerMonth);

  const ledgerWorkers = useMemo(() => {
    const list = (monthlyWorkersDb && monthlyWorkersDb[ledgerMonthKey]) || masterWorkers;
    return Array.isArray(list) ? list : (Array.isArray(masterWorkers) ? masterWorkers : []);
  }, [monthlyWorkersDb, masterWorkers, ledgerMonthKey]);

  const ledgerWorkersFiltered = useMemo(() => {
    if (!Array.isArray(ledgerWorkers)) return [];
    return ledgerWorkers.filter((w) => {
      if (!w || !w.id || w.isDeleted || w.status === 'inactive') return false;
      let matchUnit = true;
      const wUnit = w.unit || '';
      if (selectedUnit === 'All') {
        matchUnit = true;
      } else if (selectedUnit === 'Both Furnaces (A + B)') {
        matchUnit = wUnit === 'Furnace A' || wUnit === 'Furnace B';
      } else {
        matchUnit = wUnit === selectedUnit;
      }
      return matchUnit;
    });
  }, [ledgerWorkers, selectedUnit]);

  const ledgerMonthAttendance = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    if (!Array.isArray(ledgerWorkersFiltered)) return map;
    ledgerWorkersFiltered.forEach((w) => {
      if (!w || !w.id) return;
      const workerMonth = (attendanceDb && attendanceDb[w.id] && attendanceDb[w.id][ledgerMonthKey]) || {};
      const dayMap: Record<number, string> = {};
      if (typeof workerMonth === 'object' && workerMonth !== null) {
        Object.keys(workerMonth).forEach((dayStr) => {
          const day = Number(dayStr);
          if (!isNaN(day) && day >= 1 && day <= 31) {
            const code = getAttendanceCode((workerMonth as any)[day]);
            if (code) {
              dayMap[day] = code;
            }
          }
        });
      }
      map[w.id] = dayMap;
    });
    return map;
  }, [ledgerWorkersFiltered, attendanceDb, ledgerMonthKey]);

  const ledgerCalculations = useMemo(() => {
    const map: Record<string, AttendanceCalculation> = {};
    if (!Array.isArray(ledgerWorkersFiltered)) return map;
    ledgerWorkersFiltered.forEach((w) => {
      if (!w || !w.id) return;
      const workerRecords = ledgerMonthAttendance[w.id] || {};
      try {
        map[w.id] = calculateWorkerMonthlyAttendance(workerRecords, w, daysInLedgerMonth || 31, ledgerMonthKey);
      } catch {
        map[w.id] = {
          totalDaysInMonth: daysInLedgerMonth || 31,
          baseWorkingDays: 0,
          totalExtraHours: 0,
          convertedDaysFromHours: 0,
          remainingHours: 0,
          totalWorkingDays: 0,
          totalEquivalentDaysWithFraction: 0,
          monthlySalary: w.salary || 0,
          perDayRate: 0,
          perHourRate: 0,
          payoutSalary: 0,
          presentDaysCount: 0,
          absentDaysCount: 0,
          weeklyOffDaysCount: 0,
        };
      }
    });
    return map;
  }, [ledgerWorkersFiltered, ledgerMonthAttendance, daysInLedgerMonth]);

  // Filtered workers list based on Unit, Search query & SORT BY option (strictly exclude tombstones)
  const filteredWorkers = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    const list = workers.filter((w) => {
      if (!w || !w.id || w.isDeleted || w.status === 'inactive') return false;
      let matchUnit = true;
      const wUnit = w.unit || '';
      if (selectedUnit === 'All') {
        matchUnit = true;
      } else if (selectedUnit === 'Both Furnaces (A + B)') {
        matchUnit = wUnit === 'Furnace A' || wUnit === 'Furnace B';
      } else {
        matchUnit = wUnit === selectedUnit;
      }
      const q = (searchQuery || '').toLowerCase().trim();
      const matchSearch =
        q === '' ||
        (w.name || '').toLowerCase().includes(q) ||
        (w.designation || '').toLowerCase().includes(q) ||
        (w.employeeCode || '').toLowerCase().includes(q);
      return matchUnit && matchSearch;
    });

    if (sortBy === 'name_asc') {
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (sortBy === 'name_desc') {
      return [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }
    if (sortBy === 'designation') {
      return [...list].sort((a, b) => (a.designation || '').localeCompare(b.designation || ''));
    }
    if (sortBy === 'unit') {
      return [...list].sort((a, b) => (a.unit || '').localeCompare(b.unit || ''));
    }
    if (sortBy === 'salary_desc') {
      return [...list].sort((a, b) => (b.salary || 0) - (a.salary || 0));
    }
    if (sortBy === 'salary_asc') {
      return [...list].sort((a, b) => (a.salary || 0) - (b.salary || 0));
    }
    if (sortBy === 'employee_code') {
      return [...list].sort((a, b) => (a.employeeCode || '').localeCompare(b.employeeCode || ''));
    }

    return list;
  }, [workers, selectedUnit, searchQuery, sortBy]);

  // Total plant payout sum
  const totalPlantPayout = useMemo(() => {
    if (!Array.isArray(filteredWorkers)) return 0;
    return filteredWorkers.reduce((sum, w) => {
      if (!w || !w.id) return sum;
      const calc = calculations[w.id];
      return sum + (calc && typeof calc.payoutSalary === 'number' && !isNaN(calc.payoutSalary) ? calc.payoutSalary : 0);
    }, 0);
  }, [filteredWorkers, calculations]);

  // Active master workers excluding tombstones
  const activeMasterWorkers = useMemo(() => {
    if (!Array.isArray(masterWorkers)) return [];
    return masterWorkers.filter((w) => w && w.id && !w.isDeleted && w.status !== 'inactive');
  }, [masterWorkers]);

  // Keep selectedLedgerWorker strictly synchronized with active list when unit/search/workers change
  useEffect(() => {
    const activeList = viewMode === 'ledger' ? ledgerWorkersFiltered : filteredWorkers;
    if (activeList.length === 0) {
      setSelectedLedgerWorker(null);
    } else if (!selectedLedgerWorker || !activeList.some((w) => w.id === selectedLedgerWorker.id)) {
      setSelectedLedgerWorker(activeList[0]);
    }
  }, [viewMode, selectedUnit, searchQuery, filteredWorkers, ledgerWorkersFiltered]);

  // Worker-to-worker index tracking for ledger next/prev shifting
  const selectedWorkerIndex = useMemo(() => {
    if (!selectedLedgerWorker) return -1;
    const activeList = viewMode === 'ledger' ? ledgerWorkersFiltered : filteredWorkers;
    return activeList.findIndex((w) => w.id === selectedLedgerWorker.id);
  }, [viewMode, ledgerWorkersFiltered, filteredWorkers, selectedLedgerWorker]);

  const handleNextWorker = () => {
    const activeList = viewMode === 'ledger' ? ledgerWorkersFiltered : filteredWorkers;
    if (selectedWorkerIndex !== -1 && selectedWorkerIndex < activeList.length - 1) {
      setSelectedLedgerWorker(activeList[selectedWorkerIndex + 1]);
    }
  };

  const handlePrevWorker = () => {
    const activeList = viewMode === 'ledger' ? ledgerWorkersFiltered : filteredWorkers;
    if (selectedWorkerIndex > 0) {
      setSelectedLedgerWorker(activeList[selectedWorkerIndex - 1]);
    }
  };

  // Cell click handler: opens Quick Tap modal
  const handleCellClick = (worker: Worker, day: number) => {
    setQuickTapTarget({ worker, day });
    setIsQuickTapOpen(true);
  };

  // Quick tap apply handler (Instant Sub-50ms sync to mobile & laptop)
  const handleApplyQuickTapCode = (
    code: string,
    shift1Reason?: string,
    shift2Reason?: string,
    shift3Reason?: string,
    shift1Type?: 'Day' | 'Night',
    shift2Type?: 'Day' | 'Night',
    shift3Type?: 'Day' | 'Night',
    monthKey: string = currentMonthKey
  ) => {
    if (!quickTapTarget) return;
    const { worker, day } = quickTapTarget;

    saveToHistory(workers, attendanceDb);

    const workerId = worker.id;
    let updatedDb: AttendanceDatabase;
    if (!code || code.trim() === '') {
      // Tombstone Soft-Delete (status: "cleared", attendance: null, isDeleted: true, updatedAt: Date.now())
      const res = clearAttendance(attendanceDb, workerId, day, monthKey);
      updatedDb = res.updatedDb;
      recordCellClear(`${workerId}_${monthKey}_${day}`);
    } else {
      // High-resolution timestamp & Last-Write-Wins update
      clearRecordedCellClear(`${workerId}_${monthKey}_${day}`);
      const res = markAttendance(attendanceDb, workerId, code.trim(), day, monthKey);
      updatedDb = res.updatedDb;

      const workerRecords = updatedDb[workerId] || {};
      const monthRecords = { ...(workerRecords[monthKey] || {}) };
      const existingRecord = monthRecords[day];
      const recordObj: any = typeof existingRecord === 'object' && existingRecord !== null
        ? { ...existingRecord }
        : { status: code.trim(), attendance: code.trim(), updatedAt: Date.now() };

      if (shift1Reason !== undefined) {
        if (shift1Reason.trim()) recordObj.shift1Reason = shift1Reason.trim();
        else delete recordObj.shift1Reason;
      }
      if (shift2Reason !== undefined) {
        if (shift2Reason.trim()) recordObj.shift2Reason = shift2Reason.trim();
        else delete recordObj.shift2Reason;
      }
      if (shift3Reason !== undefined) {
        if (shift3Reason.trim()) recordObj.shift3Reason = shift3Reason.trim();
        else delete recordObj.shift3Reason;
      }

      if (shift1Type) recordObj.shift1Type = shift1Type;
      if (shift2Type) recordObj.shift2Type = shift2Type;
      if (shift3Type) recordObj.shift3Type = shift3Type;

      // Sync otReason as combined string
      const parts: string[] = [];
      if (recordObj.shift1Reason) parts.push(`1st Shift (${recordObj.shift1Type || 'Day'}): ${recordObj.shift1Reason}`);
      if (recordObj.shift2Reason) parts.push(`2nd Shift (${recordObj.shift2Type || 'Night'}): ${recordObj.shift2Reason}`);
      if (recordObj.shift3Reason) parts.push(`3rd Shift (${recordObj.shift3Type || 'Night'}): ${recordObj.shift3Reason}`);

      if (parts.length > 0) {
        recordObj.otReason = parts.join(' | ');
      } else {
        delete recordObj.otReason;
      }

      monthRecords[day] = recordObj;
      updatedDb = {
        ...updatedDb,
        [workerId]: {
          ...workerRecords,
          [monthKey]: monthRecords,
        },
      };
    }

    setAttendanceDb(updatedDb);
    pushToCloudNow(workers, updatedDb, monthlyWorkersDb, masterWorkers);
  };


  // Worker Shifting (Move Up / Down relative to current filtered unit / search list)
  const handleMoveWorkerUp = (filteredIndex: number) => {
    if (filteredIndex <= 0 || filteredIndex >= filteredWorkers.length) return;
    const currentWorker = filteredWorkers[filteredIndex];
    const prevWorker = filteredWorkers[filteredIndex - 1];

    saveToHistory();
    const copy = [...workers];
    const currentIdx = copy.findIndex((w) => w.id === currentWorker.id);
    const prevIdx = copy.findIndex((w) => w.id === prevWorker.id);
    if (currentIdx === -1 || prevIdx === -1) return;

    const [movedWorker] = copy.splice(currentIdx, 1);
    const targetInsertIndex = copy.findIndex((w) => w.id === prevWorker.id);
    copy.splice(targetInsertIndex, 0, movedWorker);

    const now = Date.now();
    const reordered = copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now }));
    setWorkers(reordered);

    const updatedMaster = mergeWorkersWithLWW(masterWorkers, reordered);
    setMasterWorkers(updatedMaster);

    const updatedMonthly = { ...monthlyWorkersDb, [currentMonthKey]: reordered };
    setMonthlyWorkersDb(updatedMonthly);
    pushToCloudNow(reordered, attendanceDb, updatedMonthly, updatedMaster);
  };

  const handleMoveWorkerDown = (filteredIndex: number) => {
    if (filteredIndex < 0 || filteredIndex >= filteredWorkers.length - 1) return;
    const currentWorker = filteredWorkers[filteredIndex];
    const nextWorker = filteredWorkers[filteredIndex + 1];

    saveToHistory();
    const copy = [...workers];
    const currentIdx = copy.findIndex((w) => w.id === currentWorker.id);
    const nextIdx = copy.findIndex((w) => w.id === nextWorker.id);
    if (currentIdx === -1 || nextIdx === -1) return;

    const [movedWorker] = copy.splice(currentIdx, 1);
    const targetNextIndex = copy.findIndex((w) => w.id === nextWorker.id);
    copy.splice(targetNextIndex + 1, 0, movedWorker);

    const now = Date.now();
    const reordered = copy.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now }));
    setWorkers(reordered);

    const updatedMaster = mergeWorkersWithLWW(masterWorkers, reordered);
    setMasterWorkers(updatedMaster);

    const updatedMonthly = { ...monthlyWorkersDb, [currentMonthKey]: reordered };
    setMonthlyWorkersDb(updatedMonthly);
    pushToCloudNow(reordered, attendanceDb, updatedMonthly, updatedMaster);
  };

  // Lock currently sorted order as the permanent manual custom order
  const handleLockSortAsDefault = () => {
    if (sortBy === 'custom') return;
    const sortedIds = filteredWorkers.map((w) => w.id);
    saveToHistory();
    const copy = [...workers];
    const sortedSubset = [...filteredWorkers];
    const nonSubset = copy.filter((w) => !sortedIds.includes(w.id));
    const combined = [...sortedSubset, ...nonSubset];

    const now = Date.now();
    const reordered = combined.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now }));
    setWorkers(reordered);

    const updatedMaster = mergeWorkersWithLWW(masterWorkers, reordered);
    setMasterWorkers(updatedMaster);

    const updatedMonthly = { ...monthlyWorkersDb, [currentMonthKey]: reordered };
    setMonthlyWorkersDb(updatedMonthly);
    setSortBy('custom');
    pushToCloudNow(reordered, attendanceDb, updatedMonthly, updatedMaster);
  };

  const handleSaveWorkerOrder = (reorderedWorkers: Worker[]) => {
    saveToHistory();
    const now = Date.now();
    const indexed = reorderedWorkers.map((w, i) => ({ ...w, orderIndex: i, updatedAt: now }));
    setWorkers(indexed);

    const updatedMaster = mergeWorkersWithLWW(masterWorkers, indexed);
    setMasterWorkers(updatedMaster);

    const updatedMonthly = { ...monthlyWorkersDb, [currentMonthKey]: indexed };
    setMonthlyWorkersDb(updatedMonthly);
    pushToCloudNow(indexed, attendanceDb, updatedMonthly, updatedMaster);
  };

  // Add or edit worker (linked with Master Directory and forward-propagated)
  const handleSaveWorker = async (workerData: Omit<Worker, 'id'>, editId?: string) => {
    saveToHistory();
    if (editId) {
      clearRecordedDeletion(editId);
      const updatedWorkers = workers.map((w) => (w.id === editId ? { ...w, ...workerData } : w));
      const updatedMaster = masterWorkers.some((mw) => mw.id === editId)
        ? masterWorkers.map((mw) => (mw.id === editId ? { ...mw, ...workerData } : mw))
        : [...masterWorkers, { ...workerData, id: editId, orderIndex: masterWorkers.length }];
      const updatedMonthly = { ...monthlyWorkersDb };
      Object.keys(updatedMonthly).forEach((k) => {
        updatedMonthly[k] = updatedMonthly[k].map((w) => (w.id === editId ? { ...w, ...workerData } : w));
      });
      if (!updatedMonthly[currentMonthKey]) {
        updatedMonthly[currentMonthKey] = updatedWorkers;
      }

      setWorkers(updatedWorkers);
      setMasterWorkers(updatedMaster);
      setMonthlyWorkersDb(updatedMonthly);
      await pushToCloudNow(updatedWorkers, attendanceDb, updatedMonthly, updatedMaster);
    } else {
      const newWorker: Worker = {
        ...workerData,
        id: `w-${Date.now()}`,
        orderIndex: workerData.orderIndex ?? workers.length,
        addedInMonthKey: currentMonthKey,
      };

      clearRecordedDeletion(newWorker.id);

      let nextWorkers: Worker[] = [];
      if (typeof workerData.orderIndex === 'number' && Number.isFinite(workerData.orderIndex)) {
        const targetPos = Math.ceil(workerData.orderIndex);
        const copy = [...workers];
        copy.splice(targetPos, 0, newWorker);
        nextWorkers = copy.map((w, i) => ({ ...w, orderIndex: i }));
      } else {
        nextWorkers = [...workers, newWorker];
      }

      const nextMaster = masterWorkers.some((mw) => mw.id === newWorker.id)
        ? masterWorkers
        : [...masterWorkers, newWorker];

      const nextMonthly = { ...monthlyWorkersDb };
      const curList = nextMonthly[currentMonthKey] || [];
      if (!curList.some((w) => w.id === newWorker.id)) {
        nextMonthly[currentMonthKey] = [...curList, newWorker];
      } else {
        nextMonthly[currentMonthKey] = curList.map((w) => (w.id === newWorker.id ? newWorker : w));
      }
      Object.keys(nextMonthly).forEach((k) => {
        if (k > currentMonthKey) {
          if (!nextMonthly[k].some((w) => w.id === newWorker.id)) {
            nextMonthly[k] = [...nextMonthly[k], { ...newWorker, orderIndex: nextMonthly[k].length }];
          }
        }
      });

      setWorkers(nextWorkers);
      setMasterWorkers(nextMaster);
      setMonthlyWorkersDb(nextMonthly);
      await pushToCloudNow(nextWorkers, attendanceDb, nextMonthly, nextMaster);
    }
  };

  // Delete/Exclude worker from current month ONLY (Tombstone per Month)
  // Master Directory and other months remain 100% untouched
  const handleDeleteWorker = async (workerId: string) => {
    if (!workerId) return;

    saveToHistory();

    // 1. Exclude worker ONLY from currentMonthKey in monthlyAllocationDb
    const { updatedDb: nextAllocationDb } = excludeWorkerFromMonth(
      monthlyAllocationDb,
      workerId,
      currentMonthKey
    );
    setMonthlyAllocationDb(nextAllocationDb);
    try {
      localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(nextAllocationDb));
    } catch {}

    // 2. Clear attendance for current month using tombstone
    const updatedAttendance = { ...attendanceDb };
    if (updatedAttendance[workerId] && updatedAttendance[workerId][currentMonthKey]) {
      const monthMap = { ...updatedAttendance[workerId][currentMonthKey] };
      Object.keys(monthMap).forEach((dayStr) => {
        const day = Number(dayStr);
        const res = clearAttendance(updatedAttendance, workerId, day, currentMonthKey);
        updatedAttendance[workerId] = res.updatedDb[workerId];
      });
      setAttendanceDb(updatedAttendance);
      try {
        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updatedAttendance));
      } catch {}
    }

    // 3. Recompute active month workers (Master Directory is untouched!)
    const nextWorkers = getActiveWorkersForMonth(masterWorkers, nextAllocationDb, currentMonthKey);
    setWorkers(nextWorkers);
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextWorkers));
    } catch {}

    if (selectedLedgerWorker?.id === workerId) {
      setSelectedLedgerWorker(null);
      setViewMode('master');
    }

    // Multi-device real-time sync (Preserves Master Directory permanently!)
    await pushToCloudNow(nextWorkers, updatedAttendance, monthlyWorkersDb, masterWorkers, nextAllocationDb);
  };

  // Save Selective Month Allocation (Offline First + Instant Cloud Sync)
  const handleSaveAllocation = (updatedAllocationDb: MonthlyAllocationDatabase, targetMonthKey: string) => {
    saveToHistory();
    setMonthlyAllocationDb(updatedAllocationDb);
    try {
      localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify(updatedAllocationDb));
    } catch {}

    if (targetMonthKey === currentMonthKey) {
      const nextMonthWorkers = getActiveWorkersForMonth(masterWorkers, updatedAllocationDb, currentMonthKey);
      setWorkers(nextMonthWorkers);
      try {
        localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextMonthWorkers));
      } catch {}
      pushToCloudNow(nextMonthWorkers, attendanceDb, monthlyWorkersDb, masterWorkers, updatedAllocationDb);
    } else {
      pushToCloudNow(workers, attendanceDb, monthlyWorkersDb, masterWorkers, updatedAllocationDb);
    }
  };

  const handleImportWorkerFromMaster = (mw: Worker) => {
    if (workers.some((w) => w.id === mw.id && !w.isDeleted)) {
      return;
    }
    saveToHistory();
    const copy: Worker = {
      ...mw,
      isDeleted: false,
      status: 'active',
      orderIndex: workers.length,
      updatedAt: Date.now(),
    };
    const { updatedWorkers: nextWorkers } = addOrUpdateWorker(workers, copy);
    const nextMonthly = { ...monthlyWorkersDb, [currentMonthKey]: nextWorkers };
    setWorkers(nextWorkers);
    setMonthlyWorkersDb(nextMonthly);
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextWorkers));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(nextMonthly));
    } catch {}
    pushToCloudNow(nextWorkers, attendanceDb, nextMonthly, masterWorkers);
  };

  const handleUpdateRoster = (selectedWorkers: Worker[]) => {
    saveToHistory();
    const basePossibleWorkers = masterWorkers.filter(
      (w) => !w.isDeleted && (!w.addedInMonthKey || w.addedInMonthKey <= currentMonthKey)
    );
    const selectedIds = new Set(selectedWorkers.map((w) => w.id));
    const removedIdsForMonth = basePossibleWorkers
      .filter((w) => !selectedIds.has(w.id))
      .map((w) => w.id);

    const nextRemovedDb = {
      ...monthlyRemovedWorkersDb,
      [currentMonthKey]: removedIdsForMonth,
    };
    setMonthlyRemovedWorkersDb(nextRemovedDb);
    try {
      localStorage.setItem('plant_monthly_removed_workers_v3', JSON.stringify(nextRemovedDb));
    } catch {}

    // Apply tombstone logic to Management Roster entries:
    // Any deselected worker in currentMonthRoster is converted to a tombstone (isDeleted: true, updatedAt: Date.now())
    const nextRosterWorkers = updateRosterWithTombstones(
      monthlyWorkersDb[currentMonthKey] || workers,
      selectedWorkers,
      basePossibleWorkers
    );

    const nextMonthly = { ...monthlyWorkersDb, [currentMonthKey]: nextRosterWorkers };
    setWorkers(nextRosterWorkers);
    setMonthlyWorkersDb(nextMonthly);
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextRosterWorkers));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(nextMonthly));
    } catch {}
    pushToCloudNow(nextRosterWorkers, attendanceDb, nextMonthly, masterWorkers);
  };

  const handleAddWorkerToMaster = (newWorker: Worker) => {
    const { updatedWorkers: nextMaster, worker: savedWorker } = addOrUpdateWorker(masterWorkers, newWorker);
    const { updatedWorkers: nextCurList } = addOrUpdateWorker(workers, savedWorker);

    const nextMonthly = { ...monthlyWorkersDb };
    nextMonthly[currentMonthKey] = nextCurList;

    setMasterWorkers(nextMaster);
    setMonthlyWorkersDb(nextMonthly);
    setWorkers(nextCurList);
    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(nextMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(nextMonthly));
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextCurList));
    } catch {}
    pushToCloudNow(nextCurList, attendanceDb, nextMonthly, nextMaster);
  };

  const handleEditMasterWorker = (workerId: string, updatedData: Partial<Worker>, editGlobally: boolean) => {
    saveToHistory();
    const existingWorker = masterWorkers.find((w) => w.id === workerId) || workers.find((w) => w.id === workerId);
    if (!existingWorker) return;

    const mergedData = { ...existingWorker, ...updatedData, id: workerId };
    const { updatedWorkers: nextMaster } = addOrUpdateWorker(masterWorkers, mergedData);
    const { updatedWorkers: nextWorkers } = addOrUpdateWorker(workers, mergedData);

    const nextMonthly = { ...monthlyWorkersDb };
    if (editGlobally) {
      Object.keys(nextMonthly).forEach((key) => {
        nextMonthly[key] = addOrUpdateWorker(nextMonthly[key] || [], mergedData).updatedWorkers;
      });
    } else {
      nextMonthly[currentMonthKey] = addOrUpdateWorker(nextMonthly[currentMonthKey] || [], mergedData).updatedWorkers;
    }

    setMasterWorkers(nextMaster);
    setMonthlyWorkersDb(nextMonthly);
    setWorkers(nextWorkers);

    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(nextMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(nextMonthly));
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(nextWorkers));
    } catch {}

    pushToCloudNow(nextWorkers, attendanceDb, nextMonthly, nextMaster);
  };

  const handleDeleteAllWorkers = () => {
    saveToHistory();
    masterWorkers.forEach((w) => recordWorkerDeletion(w.id));
    workers.forEach((w) => recordWorkerDeletion(w.id));

    // Convert all to tombstones
    const tombstoneMaster = masterWorkers.map((w) => ({
      ...w,
      isDeleted: true,
      status: 'inactive' as const,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    }));
    const tombstoneWorkers = workers.map((w) => ({
      ...w,
      isDeleted: true,
      status: 'inactive' as const,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    }));

    setMasterWorkers(tombstoneMaster);
    setWorkers(tombstoneWorkers);
    setMonthlyWorkersDb({});
    setAttendanceDb(getInitialAttendanceData(year, month));
    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(tombstoneMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify({}));
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(tombstoneWorkers));
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(getInitialAttendanceData(year, month)));
    } catch {}
    pushToCloudNow(tombstoneWorkers, {}, {}, tombstoneMaster);
  };

  const handleDeleteMasterProfile = async (workerId: string) => {
    if (!workerId) return;
    recordWorkerDeletion(workerId);
    saveToHistory();

    // 1. Tombstone Soft-Delete for Master Workers and Active Workers
    const { updatedWorkers: updatedMaster } = deleteWorker(masterWorkers, workerId);
    const { updatedWorkers } = deleteWorker(workers, workerId);

    // 2. Tombstone Soft-Delete for Monthly Rosters
    const updatedMonthly = { ...monthlyWorkersDb };
    Object.keys(updatedMonthly).forEach((k) => {
      updatedMonthly[k] = deleteWorker(updatedMonthly[k] || [], workerId).updatedWorkers;
    });

    // 3. Clear attendance records with tombstones
    const updatedAttendance = { ...attendanceDb };
    if (updatedAttendance[workerId]) {
      Object.keys(updatedAttendance[workerId]).forEach((mKey) => {
        const monthMap = updatedAttendance[workerId][mKey];
        Object.keys(monthMap || {}).forEach((dStr) => {
          const d = Number(dStr);
          const cRes = clearAttendance(updatedAttendance, workerId, d, mKey);
          updatedAttendance[workerId] = cRes.updatedDb[workerId];
        });
      });
    }

    setMasterWorkers(updatedMaster);
    setWorkers(updatedWorkers);
    setMonthlyWorkersDb(updatedMonthly);
    setAttendanceDb(updatedAttendance);

    try {
      localStorage.setItem('plant_master_workers_v3', JSON.stringify(updatedMaster));
      localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify(updatedMonthly));
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(updatedWorkers));
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updatedAttendance));
    } catch {}

    await pushToCloudNow(updatedWorkers, updatedAttendance, updatedMonthly, updatedMaster);
    if (currentUser) {
      try {
        await deleteWorkerFromFirestore(currentUser.uid, workerId);
      } catch {}
    }
  };

  // Batch fill attendance (Instant Cloud Sync)
  const handleApplyBatchFill = (targetWorkerIds: string[], days: number[], code: string) => {
    saveToHistory(workers, attendanceDb);

    let updated: AttendanceDatabase = { ...attendanceDb };
    targetWorkerIds.forEach((wId) => {
      days.forEach((day) => {
        if (!code || code.trim() === '') {
          const res = clearAttendance(updated, wId, day, currentMonthKey);
          updated = res.updatedDb;
          recordCellClear(`${wId}_${currentMonthKey}_${day}`);
        } else {
          clearRecordedCellClear(`${wId}_${currentMonthKey}_${day}`);
          const res = markAttendance(updated, wId, code.trim(), day, currentMonthKey);
          updated = res.updatedDb;
        }
      });
    });

    setAttendanceDb(updated);
    pushToCloudNow(workers, updated, monthlyWorkersDb, masterWorkers);
  };

  const handleApplyIndividualBatch = (updates: { workerId: string; day: number; code: string }[]) => {
    saveToHistory(workers, attendanceDb);
    let updated: AttendanceDatabase = { ...attendanceDb };
    updates.forEach(({ workerId, day, code }) => {
      if (!code || code.trim() === '') {
        const res = clearAttendance(updated, workerId, day, currentMonthKey);
        updated = res.updatedDb;
        recordCellClear(`${workerId}_${currentMonthKey}_${day}`);
      } else {
        clearRecordedCellClear(`${workerId}_${currentMonthKey}_${day}`);
        const res = markAttendance(updated, workerId, code.trim(), day, currentMonthKey);
        updated = res.updatedDb;
      }
    });

    setAttendanceDb(updated);
    pushToCloudNow(workers, updated, monthlyWorkersDb, masterWorkers);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Plant Unit filter options
  const safeWorkers = Array.isArray(workers) ? workers : [];
  const unitFilterOptions = [
    { id: 'All', label: 'All Staff', count: safeWorkers.length },
    {
      id: 'Both Furnaces (A + B)',
      label: '🔥 Both Furnaces (A + B)',
      count: safeWorkers.filter((w) => w && (w.unit === 'Furnace A' || w.unit === 'Furnace B')).length,
    },
    { id: 'Furnace A', label: 'Furnace A', count: safeWorkers.filter((w) => w && w.unit === 'Furnace A').length },
    { id: 'Furnace B', label: 'Furnace B', count: safeWorkers.filter((w) => w && w.unit === 'Furnace B').length },
    { id: 'CCM', label: 'CCM', count: safeWorkers.filter((w) => w && w.unit === 'CCM').length },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden">
      {/* Live Sync Status Notice when not signed in */}


      {/* Top App Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-2.5 sticky top-0 z-30 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Plant Identity */}
          <div className="flex items-center space-x-3">
            {headerDetails.appIconBase64 ? (
              <img
                src={headerDetails.appIconBase64}
                alt="App Logo"
                className="w-10 h-10 rounded-2xl object-cover shadow-md border border-slate-200 dark:border-slate-800 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-md shadow-orange-500/20 text-white flex-shrink-0">
                <Flame className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {headerDetails.appName || 'Staff Attendance and Pay Out'}
                </h1>

                {/* Customizable Header Details Lock / Edit Button */}
                <button
                  type="button"
                  onClick={() => {
                    setTempHeaderDetails(headerDetails);
                    setIsHeaderEditModalOpen(true);
                  }}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                    headerDetails.isLocked
                      ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                  }`}
                  title="Customize App Name, Tagline, Contractor Name or Association Name"
                >
                  {headerDetails.isLocked ? (
                    <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Unlock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>{headerDetails.isLocked ? 'Locked Header' : 'Edit Header'}</span>
                  <Pencil className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                </button>
              </div>

              {/* Customizable Tagline */}
              {headerDetails.tagline && (
                <p className="text-xs text-slate-500 hidden sm:block font-medium">
                  {headerDetails.tagline}
                </p>
              )}

              {/* Customizable Contractor Name & Association Name */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {headerDetails.contractorName && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span>Contractor: <strong className="text-slate-900 dark:text-white uppercase">{headerDetails.contractorName}</strong></span>
                  </span>
                )}
                {headerDetails.contractorName && headerDetails.associationName && (
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-700">&bull;</span>
                )}
                {headerDetails.associationName && (
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                    <span>Association: <strong className="text-slate-700 dark:text-slate-300">{headerDetails.associationName}</strong></span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Month/Year Selector & Action Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">

            {/* UNLIMITED Month & Year Picker */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-slate-500 ml-1.5 hidden sm:block" />
              
              {/* Previous Month Button */}
              <button
                type="button"
                onClick={() => {
                  if (month === 1) {
                    setMonth(12);
                    setYear((prev) => prev - 1);
                  } else {
                    setMonth((prev) => prev - 1);
                  }
                }}
                title="Previous Month"
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Month Selector Display Button with Custom Popover Dropdown (no native arrows) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMonthMenuOpen(!isMonthMenuOpen)}
                  className="px-2.5 py-1 font-extrabold text-xs text-indigo-700 dark:text-indigo-400 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg outline-none text-center min-w-[76px] cursor-pointer transition-colors"
                  title="Select Month"
                >
                  {monthNames[month - 1]}
                </button>

                {isMonthMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMonthMenuOpen(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1 divide-y divide-slate-100 dark:divide-slate-750 max-h-60 overflow-y-auto">
                      {monthNames.map((mName, idx) => (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            setMonth(idx + 1);
                            setIsMonthMenuOpen(false);
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
                    setMonth(1);
                    setYear((prev) => prev + 1);
                  } else {
                    setMonth((prev) => prev + 1);
                  }
                }}
                title="Next Month"
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors mr-1 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Unlimited Year Controls with direct input + steppers (supports any year like 2250) */}
              <div className="flex items-center space-x-0.5 border-l border-slate-200 dark:border-slate-700 pl-1">
                <button
                  type="button"
                  onClick={() => setYear((prev) => prev - 1)}
                  title="Previous Year"
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <input
                  type="number"
                  value={year}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!isNaN(parsed)) setYear(parsed);
                  }}
                  className="w-16 text-center font-extrabold text-xs text-slate-800 dark:text-slate-200 bg-transparent outline-none py-1 focus:bg-white dark:focus:bg-slate-900 rounded-md"
                  title="Type any unlimited year (e.g. 2026, 2250, 3000)"
                />

                <button
                  type="button"
                  onClick={() => setYear((prev) => prev + 1)}
                  title="Next Year"
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Prominent One-Click Refresh & Reload Sync Button */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncStatus === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer border border-indigo-500 disabled:opacity-50"
              title="Click to instantly pull and refresh all entries made on mobile or other devices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{syncStatus === 'syncing' ? 'Syncing Data...' : 'Refresh Data'}</span>
            </button>

            {/* Subtle Green Status Dot Showing Live Real-Time Sync Connection */}
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 select-none shadow-2xs"
              title={
                syncStatus === 'syncing'
                  ? 'Syncing changes to Google Cloud in real-time...'
                  : syncStatus === 'error'
                  ? 'Connection notice: Retrying sync...'
                  : 'Real-Time Cloud Connected • Auto-Sync Active on Google Account'
              }
            >
              <span className="relative flex h-2 w-2">
                {syncStatus === 'syncing' ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                ) : syncStatus === 'error' ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                ) : (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    syncStatus === 'syncing'
                      ? 'bg-amber-500'
                      : syncStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                  }`}
                ></span>
              </span>
              <span className="text-[11px] font-semibold hidden md:inline">
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Retrying...' : 'Connected'}
              </span>
            </div>

            {/* Google Account Profile & One-Click Sign In / Sign Out in Header */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
                  title={`Logged in as ${currentUser.email || 'User'}`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Google User'}
                      className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden sm:block max-w-[130px]">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-3 space-y-3">
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                        {currentUser.photoURL ? (
                          <img
                            src={currentUser.photoURL}
                            alt={currentUser.displayName || ''}
                            className="w-10 h-10 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                            {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {currentUser.displayName || 'Google Account'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate font-mono">
                            {currentUser.email}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Cloud Auto-Sync Active</span>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          await logoutUser();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    console.warn('Google sign in notice:', err);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Sign in with Google to auto-sync attendance across all phones & laptops"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}

            {/* Real-time Clock, Date to Time & Settings Button */}

            {/* Real-time Clock, Date to Time & Settings Button (Positioned next to AI Insights) */}
            <div className="relative inline-flex items-center space-x-1.5 sm:space-x-2 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-xs select-none">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="text-left leading-tight">
                  <div className="text-[11px] font-black font-mono text-slate-800 dark:text-slate-100 tracking-tight">
                    {formattedClock.timeString}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-400 dark:text-slate-400">
                    {formattedClock.dateString}
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700" />

              {/* Settings button to trigger popover settings */}
              <button
                type="button"
                onClick={() => setIsTimeSettingsOpen(!isTimeSettingsOpen)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Date, Time & Timezone Settings"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              {isTimeSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTimeSettingsOpen(false)} />
                  <div className="absolute right-0 top-10 sm:right-auto sm:left-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3.5 animate-fadeIn text-xs text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                        <span>🕒 Time &amp; Clock Settings</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsTimeSettingsOpen(false)}
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 1. Time Format: 12hr / 24hr */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase">Time Format</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTimeFormat('12hr')}
                          className={`py-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                            timeFormat === '12hr'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          12-Hour (AM/PM)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeFormat('24hr')}
                          className={`py-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                            timeFormat === '24hr'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          24-Hour Military
                        </button>
                      </div>
                    </div>

                    {/* 2. Date Format */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase">Date Format</label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                        <option value="DD MMMM YYYY">DD Month YYYY (Verbose)</option>
                      </select>
                    </div>

                    {/* 3. Timezone Mode */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase">Standard Clock Source</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTimezoneMode('device')}
                          className={`py-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                            timezoneMode === 'device'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          My Device Time
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimezoneMode('timezone')}
                          className={`py-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                            timezoneMode === 'timezone'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          World standard
                        </button>
                      </div>
                    </div>

                    {/* 4. Target Country / Timezone */}
                    {timezoneMode === 'timezone' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase">Select World Timezone</label>
                        <select
                          value={selectedTimezone}
                          onChange={(e) => setSelectedTimezone(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="Asia/Kolkata">🇮🇳 India (IST - GMT+5:30)</option>
                          <option value="Asia/Dubai">🇦🇪 Gulf/Dubai (GST - GMT+4:00)</option>
                          <option value="Asia/Dhaka">🇧🇩 Bangladesh (BST - GMT+6:00)</option>
                          <option value="Asia/Kathmandu">🇳🇵 Nepal (NPT - GMT+5:45)</option>
                          <option value="Europe/London">🇬🇧 United Kingdom (GMT/BST)</option>
                          <option value="America/New_York">🇺🇸 USA Eastern (EST/EDT)</option>
                          <option value="America/Los_Angeles">🇺🇸 USA Pacific (PST/PDT)</option>
                          <option value="Asia/Singapore">🇸🇬 Singapore/Malay (SGT - GMT+8:00)</option>
                        </select>
                      </div>
                    )}

                    {/* 5. Manual Time Shift Adjustments */}
                    <div className="space-y-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase">Manual Time Adjust</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTimeHourOffset(0);
                            setTimeMinuteOffset(0);
                          }}
                          className="text-[9px] text-red-500 hover:text-red-700 font-bold underline cursor-pointer"
                        >
                          Reset Manual
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1.5">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Hours ({timeHourOffset > 0 ? `+${timeHourOffset}` : timeHourOffset}h)</span>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setTimeHourOffset((prev) => prev - 1)}
                              className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-black hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold text-slate-800 dark:text-slate-200 min-w-8 text-center">{timeHourOffset}h</span>
                            <button
                              type="button"
                              onClick={() => setTimeHourOffset((prev) => prev + 1)}
                              className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-black hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block mb-0.5">Minutes ({timeMinuteOffset > 0 ? `+${timeMinuteOffset}` : timeMinuteOffset}m)</span>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setTimeMinuteOffset((prev) => Math.max(prev - 5, -59))}
                              className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-black hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold text-slate-800 dark:text-slate-200 min-w-8 text-center">{timeMinuteOffset}m</span>
                            <button
                              type="button"
                              onClick={() => setTimeMinuteOffset((prev) => Math.min(prev + 5, 59))}
                              className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-black hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>



            {/* Transfer Data to Another Email ID Button */}
            <button
              type="button"
              onClick={() => setIsTransferDataModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors cursor-pointer"
              title="Transfer all worker and attendance data to another email ID"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xl:inline">Transfer to Email</span>
            </button>

            {/* All Workers Full Profile Dossier & PDF Exporter */}
            <button
              type="button"
              onClick={() => setIsProfilesReportModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100/60 text-purple-700 dark:text-purple-300 text-xs font-bold transition-colors cursor-pointer"
              title="Download & Print All Worker Profiles, Account Details & Government IDs as PDF"
            >
              <FileText className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Profiles PDF</span>
            </button>

            {/* Worker Reordering / Shifting Button */}
            <button
              type="button"
              onClick={() => setIsReorderModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              title="Shift newly added workers into position or auto-group by role"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Reorder Staff</span>
            </button>

            {/* Quick Batch Fill */}
            <button
              type="button"
              onClick={() => setIsBatchFillOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              title="Fast auto-fill Sundays as WO or weekdays as P4"
            >
              <FastForward className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Batch Fill</span>
            </button>

            {/* Export CSV / Excel */}
            <button
              type="button"
              onClick={() =>
                exportAttendanceToCSV(
                  filteredWorkers,
                  daysInCurrentMonth,
                  year,
                  month,
                  currentMonthAttendance,
                  calculations
                )
              }
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              title="Download Excel / CSV Attendance Register"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Download Full Colorful Table Button */}
            <button
              type="button"
              onClick={() => setIsColorfulTableModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              title="Download entire monthly attendance table in colorful format with all shift badges (PDF / Image / HTML)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Colorful Table</span>
            </button>

            {/* 1-Click Install App on Device Button */}
            <PWAInstallButton onOpenDownloadModal={() => setIsAndroidModalOpen(true)} />

            {/* Share App URL / Direct Install Link Button */}
            <button
              type="button"
              onClick={() => setIsShareAppUrlOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
              title="Generate URL & QR code to open and install app on phone or laptop"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Share App Link</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('master')}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'master'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Master Monthly Grid View (Dates 1-31 Columns)"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Master Grid</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filteredWorkers.length > 0) {
                    setSelectedLedgerWorker(filteredWorkers[0]);
                  }
                  setViewMode('ledger');
                }}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'ledger'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Worker Daily Ledger View (Dates 1-31 Rows)"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Daily Ledger</span>
              </button>
            </div>

            {/* Table vs Single-Screen Overview Switcher (Visible only in Master View) */}
            {viewMode === 'master' && (
              <div className="flex items-center bg-indigo-50 dark:bg-indigo-950/40 p-0.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <button
                  type="button"
                  onClick={() => setGridDisplayMode('overview')}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    gridDisplayMode === 'overview'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                  }`}
                  title="Single-Screen Overview (Fit-to-Screen / No-Scroll View)"
                >
                  <span>📱 Single-Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridDisplayMode('table')}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    gridDisplayMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                  }`}
                  title="Full Scrollable Table View (Dates 1-31 Columns)"
                >
                  <span>📊 Full Table</span>
                </button>
              </div>
            )}

            {/* Professional Theme Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Force Light Mode Theme"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-white dark:bg-slate-700 text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Force Dark Mode Theme"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  themeMode === 'system'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="System Default Auto Theme (Follows your phone / computer preference)"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Default</span>
              </button>
            </div>

            {/* Manage Month Roster Button (Safe storage and Selective activation) */}
            <button
              type="button"
              onClick={() => setIsManageRosterOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Safely select who is active on this month from Master Directory"
            >
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Manage Month Roster</span>
            </button>

            {/* Selective Month Allocation Button */}
            <button
              type="button"
              onClick={() => setIsMonthAllocationOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 text-xs font-extrabold hover:bg-violet-100/60 dark:hover:bg-violet-950/60 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Selectively include or exclude workers per month without touching Master Directory"
            >
              <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span>Month Allocation</span>
            </button>

            {/* Plant Salary Analytics Button */}
            <button
              type="button"
              onClick={() => setIsAnalyticsOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="View Plant Salary Analytics & Month-over-Month Comparison"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Analytics</span>
            </button>

            {/* Shift OT & Task Reason Notes Monthly Audit Register Button */}
            <button
              type="button"
              onClick={() => setIsMonthlyShiftNotesReportOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs font-extrabold hover:bg-amber-100/60 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="View & Print Monthly Overtime & Shift Task Reason Register"
            >
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Shift OT Notes</span>
            </button>

            {/* Add Worker Button (High Priority) */}
            <button
              type="button"
              onClick={() => {
                setWorkerToEdit(null);
                setIsAddWorkerOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Worker in Attendance</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filter Strip & Statistics Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Unit Filter Tabs & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
              Unit:
            </span>
            {unitFilterOptions.map((unitOpt) => (
              <button
                key={unitOpt.id}
                type="button"
                onClick={() => setSelectedUnit(unitOpt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedUnit === unitOpt.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{unitOpt.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                    selectedUnit === unitOpt.id
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {unitOpt.count}
                </span>
              </button>
            ))}

            {/* Standard Search Bar */}
            <div className="ml-1 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search worker, role..."
                className="w-48 sm:w-60 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* SORT BY Option Dropdown */}
            <div className="flex items-center space-x-1 ml-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 ml-1.5" />
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 px-1 uppercase tracking-wide">
                SORT BY:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none px-1.5 py-0.5 cursor-pointer"
                title="Sort workers by Name, Role, Unit, or Salary"
              >
                <option value="custom" className="dark:bg-slate-900">Custom / Drag Order</option>
                <option value="name_asc" className="dark:bg-slate-900">A to Z (Name)</option>
                <option value="name_desc" className="dark:bg-slate-900">Z to A (Name)</option>
                <option value="designation" className="dark:bg-slate-900">Designation / Role</option>
                <option value="unit" className="dark:bg-slate-900">Plant Unit</option>
                <option value="salary_desc" className="dark:bg-slate-900">Salary (High &rarr; Low)</option>
                <option value="salary_asc" className="dark:bg-slate-900">Salary (Low &rarr; High)</option>
                <option value="employee_code" className="dark:bg-slate-900">Staff ID Code</option>
              </select>

              {sortBy !== 'custom' && (
                <button
                  type="button"
                  onClick={handleLockSortAsDefault}
                  className="px-2 py-0.5 ml-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
                  title="Permanently save this sorted order into the database"
                >
                  <Check className="w-3 h-3" />
                  <span>Lock Order</span>
                </button>
              )}
            </div>
          </div>

          {/* Plant Stats & Formula Overview */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-600 dark:text-slate-300">Total Payout:</span>
              <span className="font-extrabold font-mono text-emerald-700 dark:text-emerald-300 text-sm">
                {formatCurrency(totalPlantPayout)}
              </span>
            </div>

            <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-xl text-slate-700 dark:text-slate-300">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold">{filteredWorkers.length} Workers</span>
            </div>

            {/* Attendance History Undo/Redo Action Buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs gap-0.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center gap-1 cursor-pointer"
                title={`Undo Last attendance change (${undoStack.length} actions in history)`}
              >
                <Undo className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center gap-1 cursor-pointer"
                title={`Redo Undone change (${redoStack.length} actions in redo stack)`}
              >
                <Redo className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Redo</span>
              </button>
            </div>

            {/* Workspace Zoom In / Out Controls */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs gap-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.7}
                className="px-2 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-all"
                title="Zoom Out Dashboard Grid & Payslip"
              >
                <ZoomOut className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
                title="Reset Zoom to 100%"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 1.4}
                className="px-2 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer flex items-center justify-center transition-all"
                title="Zoom In Dashboard Grid & Payslip"
              >
                <ZoomIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </button>
            </div>

            {/* Question Mark Key Notes Icon Button */}
            <button
              type="button"
              onClick={() => setIsFormulaHelpOpen(true)}
              className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 transition-all shadow-xs active:scale-95 flex items-center justify-center"
              title="Key Notes & Formula"
            >
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main style={{ zoom: zoomLevel }} className="flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-4 flex flex-col">
        {viewMode === 'master' ? (
          gridDisplayMode === 'overview' ? (
            <SingleScreenWorkerOverview
              workers={filteredWorkers}
              daysInMonth={daysInCurrentMonth}
              year={year}
              month={month}
              monthName={monthNames[month - 1]}
              attendanceData={currentMonthAttendance}
              calculations={calculations}
              onCellClick={handleCellClick}
              onSelectWorkerForLedger={(w) => {
                setSelectedLedgerWorker(w);
                setLedgerYear(year);
                setLedgerMonth(month);
                setViewMode('ledger');
              }}
            />
          ) : (
            <MonthlyMasterGrid
              workers={filteredWorkers}
              daysInMonth={daysInCurrentMonth}
              year={year}
              month={month}
              attendanceData={currentMonthAttendance}
              calculations={calculations}
              onCellClick={handleCellClick}
              onEditWorker={(w) => {
                setWorkerToEdit(w);
                setIsAddWorkerOpen(true);
              }}
              onDeleteWorker={handleDeleteWorker}
              onSelectWorkerForLedger={(w) => {
                setSelectedLedgerWorker(w);
                // Reset ledger date to active master grid date when entering ledger/payslip view for a worker
                setLedgerYear(year);
                setLedgerMonth(month);
                setViewMode('ledger');
              }}
              onMoveWorkerUp={handleMoveWorkerUp}
              onMoveWorkerDown={handleMoveWorkerDown}
              onOpenReorderModal={() => setIsReorderModalOpen(true)}
              dayNotes={dayNotesDb[currentMonthKey]}
              onDayHeaderClick={handleOpenDayNoteModal}
              onOpenColorfulExport={() => setIsColorfulTableModalOpen(true)}
            />
          )
        ) : selectedLedgerWorker && ledgerWorkersFiltered.some((w) => w.id === selectedLedgerWorker.id) ? (
          <WorkerLedgerView
            worker={selectedLedgerWorker}
            daysInMonth={daysInLedgerMonth}
            year={ledgerYear}
            month={ledgerMonth}
            attendanceRecords={ledgerMonthAttendance[selectedLedgerWorker.id] || {}}
            rawAttendanceRecords={attendanceDb[selectedLedgerWorker.id]?.[ledgerMonthKey] || {}}
            dayNotes={dayNotesDb[ledgerMonthKey] || {}}
            calc={
              ledgerCalculations[selectedLedgerWorker.id] || {
                baseWorkingDays: 0,
                totalExtraHours: 0,
                convertedDaysFromHours: 0,
                remainingHours: 0,
                totalWorkingDays: 0,
                totalEquivalentDaysWithFraction: 0,
                payoutSalary: 0,
                monthlySalary: selectedLedgerWorker.salary,
                totalDaysInMonth: daysInLedgerMonth,
                perDayRate: selectedLedgerWorker.salary / daysInLedgerMonth,
                perHourRate: selectedLedgerWorker.salary / daysInLedgerMonth / 12,
                presentDaysCount: 0,
                absentDaysCount: 0,
                weeklyOffDaysCount: 0,
              }
            }
            onBack={() => setViewMode('master')}
            onNextWorker={handleNextWorker}
            onPrevWorker={handlePrevWorker}
            hasNextWorker={selectedWorkerIndex !== -1 && selectedWorkerIndex < ledgerWorkersFiltered.length - 1}
            hasPrevWorker={selectedWorkerIndex > 0}
            onUpdateCode={(day, code) => {
              setQuickTapTarget({ worker: selectedLedgerWorker, day });
              handleApplyQuickTapCode(code, undefined, ledgerMonthKey);
            }}
            onOpenQuickTapModal={(day) => {
              setQuickTapTarget({ worker: selectedLedgerWorker, day });
              setIsQuickTapOpen(true);
            }}
            onChangeMonth={(m) => setLedgerMonth(m)}
            onChangeYear={(y) => setLedgerYear(y)}
            allWorkers={ledgerWorkersFiltered}
            onSelectWorker={(w) => setSelectedLedgerWorker(w)}
            onEditWorker={(w) => {
              setSelectedLedgerWorker(null);
              setViewMode('master');
              setWorkerToEdit(w);
              setIsAddWorkerOpen(true);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-xl font-bold">
              🔥
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              No worker is here
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              There are zero workers in {selectedUnit}. Select another unit filter or add a worker.
            </p>
          </div>
        )}
      </main>

      {/* Quick Tap Modal */}
      {quickTapTarget && (
        <QuickTapModal
          isOpen={isQuickTapOpen}
          onClose={() => {
            setIsQuickTapOpen(false);
            setQuickTapTarget(null);
          }}
          workerName={quickTapTarget.worker.name}
          designation={quickTapTarget.worker.designation}
          unit={quickTapTarget.worker.unit}
          day={quickTapTarget.day}
          dateString={`${quickTapTarget.day} ${monthNames[month - 1]} ${year}`}
          currentCode={currentMonthAttendance[quickTapTarget.worker.id]?.[quickTapTarget.day]}
          currentShift1Reason={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift1Reason || ''
          }
          currentShift2Reason={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift2Reason || ''
          }
          currentShift3Reason={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift3Reason || ''
          }
          currentShift1Type={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift1Type || 'Day'
          }
          currentShift2Type={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift2Type || 'Night'
          }
          currentShift3Type={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.shift3Type || 'Night'
          }
          currentOtReason={
            (attendanceDb[quickTapTarget.worker.id]?.[currentMonthKey]?.[quickTapTarget.day] as any)?.otReason || ''
          }
          activeDayDesignation={getWorkerActiveDesignation(quickTapTarget.worker, quickTapTarget.day, currentMonthKey).designation}
          activeDaySalary={getWorkerActiveDesignation(quickTapTarget.worker, quickTapTarget.day, currentMonthKey).salary}
          isTransferredDay={getWorkerActiveDesignation(quickTapTarget.worker, quickTapTarget.day, currentMonthKey).isTransferred}
          onSelectCode={handleApplyQuickTapCode}
        />
      )}

      {/* Day Maintenance / Shutdown Note Modal */}
      {isDayNoteModalOpen && activeDayNoteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-base">
                  📅
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Day Event / Shutdown Note
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Date: {activeDayNoteTarget} {monthNames[month - 1]} {year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDayNoteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Reason / Maintenance / Shutdown Note (Optional):
                </label>
                <input
                  type="text"
                  value={dayNoteInputValue}
                  onChange={(e) => setDayNoteInputValue(e.target.value)}
                  placeholder="e.g. Plant Shutdown - Power Maintenance, Furnace Repair..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Leave blank to clear the day note. Displays as 'Maint' tag on date column header.
                </span>
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setDayNoteInputValue('');
                  handleSaveDayNote('');
                }}
                className="text-[11px] text-red-500 hover:text-red-700 font-bold underline cursor-pointer"
              >
                Clear Note
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDayNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDayNote()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add or Edit Worker Modal */}
      <AddWorkerModal
        isOpen={isAddWorkerOpen}
        onClose={() => {
          setIsAddWorkerOpen(false);
          setWorkerToEdit(null);
        }}
        onSaveWorker={handleSaveWorker}
        workerToEdit={workerToEdit}
        existingWorkers={filteredWorkers}
        masterStaffDirectory={activeMasterWorkers}
        onImportWorker={handleImportWorkerFromMaster}
        onDeleteMasterProfile={handleDeleteMasterProfile}
      />

      {/* Roster Management Modal (Selectively apply workers to current month & safely store identities) */}
      <ManageRosterModal
        isOpen={isManageRosterOpen}
        onClose={() => setIsManageRosterOpen(false)}
        year={year}
        month={month}
        monthName={monthNames[month - 1]}
        masterWorkers={activeMasterWorkers}
        currentMonthWorkers={filteredWorkers}
        onUpdateRoster={handleUpdateRoster}
        onAddWorkerToMaster={handleAddWorkerToMaster}
        onEditMasterWorker={handleEditMasterWorker}
        onDeleteMasterWorker={handleDeleteMasterProfile}
        onDeleteAllWorkers={handleDeleteAllWorkers}
      />

      {/* Selective Month Allocation Manager (Offline First + Instant Cloud Sync) */}
      <MonthAllocationManager
        isOpen={isMonthAllocationOpen}
        onClose={() => setIsMonthAllocationOpen(false)}
        masterWorkers={activeMasterWorkers}
        initialYear={year}
        initialMonth={month}
        monthlyAllocationDb={monthlyAllocationDb}
        onSaveAllocation={handleSaveAllocation}
      />

      {/* Plant Salary Analytics Dashboard (MoM Insights & Breakdown) */}
      <PlantAnalyticsDashboard
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        masterWorkers={masterWorkers}
        currentMonthWorkers={workers}
        monthlyAllocationDb={monthlyAllocationDb}
        attendanceDb={attendanceDb}
        year={year}
        month={month}
        monthNames={monthNames}
      />

      {/* Worker Shifting & Reordering Modal */}
      <ReorderWorkersModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        workers={filteredWorkers}
        onSaveWorkerOrder={handleSaveWorkerOrder}
        initialUnit={selectedUnit}
      />

      {/* Share App URL & Live Sync Modal */}
      <ShareAppUrlModal
        isOpen={isShareAppUrlOpen}
        onClose={() => setIsShareAppUrlOpen(false)}
        userEmail={currentUser?.email}
      />

      {/* Transfer Data to Another Email ID Modal */}
      <TransferDataModal
        isOpen={isTransferDataModalOpen}
        onClose={() => setIsTransferDataModalOpen(false)}
        currentUser={currentUser}
        workers={filteredWorkers}
        masterWorkers={activeMasterWorkers}
        attendanceDb={attendanceDb}
        monthlyWorkersDb={monthlyWorkersDb}
        onDataImport={handleDataImport}
      />

      {/* All Workers Full Profile Dossier & PDF Exporter Modal */}
      <WorkerProfilesReportModal
        isOpen={isProfilesReportModalOpen}
        onClose={() => setIsProfilesReportModalOpen(false)}
        workers={filteredWorkers}
        masterWorkers={activeMasterWorkers}
        year={year}
        month={month}
        monthName={monthNames[month - 1]}
        attendanceDb={attendanceDb}
        calculations={calculations}
        contractorName={headerDetails.contractorName || 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES'}
      />

      {/* Monthly Overtime & Shift Reason Notes Audit Register Modal */}
      <MonthlyShiftNotesReportModal
        isOpen={isMonthlyShiftNotesReportOpen}
        onClose={() => setIsMonthlyShiftNotesReportOpen(false)}
        year={year}
        month={month}
        monthName={monthNames[month - 1]}
        workers={filteredWorkers}
        attendanceDb={attendanceDb}
        dayNotes={dayNotesDb[currentMonthKey]}
        contractorName={headerDetails.contractorName || 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES'}
      />

      {/* Full Colorful Attendance Table Modal (PDF • Image • HTML) */}
      <ColorfulAttendanceTableModal
        isOpen={isColorfulTableModalOpen}
        onClose={() => setIsColorfulTableModalOpen(false)}
        workers={filteredWorkers}
        daysInMonth={daysInCurrentMonth}
        year={year}
        month={month}
        monthName={monthNames[month - 1]}
        attendanceData={currentMonthAttendance}
        calculations={calculations}
        contractorName={headerDetails.contractorName || 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES'}
        dayNotes={dayNotesDb[currentMonthKey]}
      />

      {/* Cloud Account & Multi-Device Sync Modal */}


      {/* Fast Reload Floating Toast */}
      {reloadToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900/95 text-white dark:bg-white dark:text-slate-900 shadow-2xl border border-indigo-500/30 flex items-center gap-3 animate-fadeIn text-xs font-bold">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
          <span>{reloadToast}</span>
        </div>
      )}

      {/* Batch Fill Attendance Modal */}
      <BatchFillModal
        isOpen={isBatchFillOpen}
        onClose={() => setIsBatchFillOpen(false)}
        workers={workers}
        daysInMonth={daysInCurrentMonth}
        month={month}
        year={year}
        currentAttendance={currentMonthAttendance}
        onApplyBatch={handleApplyBatchFill}
        onApplyIndividualBatch={handleApplyIndividualBatch}
      />



      {/* Key Notes & Formula Explanation Modal */}
      {isFormulaHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-base">
                  ?
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Key Notes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormulaHelpOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Key Notes:</h4>
              <ol className="list-decimal pl-5 space-y-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                <li>
                  <strong>P4</strong> means one working day.
                </li>
                <li>
                  <strong>P4 (hours)</strong> means one working day + hours.
                </li>
                <li>
                  <strong>12 hours</strong> means one working day.
                </li>
                <li>
                  <strong>Payment Formula:</strong> Payout Salary = (Monthly Salary ÷ Number of Days in Month) × (Working Days + Overtime Hours ÷ 12)
                </li>
              </ol>
            </div>
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFormulaHelpOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download App Modal */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onExportCSV={() => {
          exportAttendanceToCSV(
            filteredWorkers,
            daysInCurrentMonth,
            year,
            month,
            currentMonthAttendance,
            calculations
          );
        }}
        onExportJSON={handleExportJSON}
        onExportPDF={handleExportPDF}
        onExportColorfulTable={() => setIsColorfulTableModalOpen(true)}
      />


      {/* Android APK Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        onDownloadOfflineApp={() => downloadStandaloneAppHtmlFile(workers, attendanceDb, year, month)}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Header Customization Modal */}
      {isHeaderEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-base">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Customize App Header
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Set Logo, App Name, Tagline, Contractor &amp; Association
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHeaderEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              {/* Customizable App Icon Section */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="block font-bold text-slate-800 dark:text-slate-200">
                  🎯 Customizable App Icon (Logo)
                </span>
                <div className="flex items-center space-x-4">
                  {tempHeaderDetails.appIconBase64 ? (
                    <img
                      src={tempHeaderDetails.appIconBase64}
                      alt="Custom Logo Preview"
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-lg text-white">
                      <Flame className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1.5">
                    <label className="block">
                      <span className="sr-only">Choose Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setTempHeaderDetails((prev) => ({
                                ...prev,
                                appIconBase64: reader.result as string,
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[11px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </label>
                    {tempHeaderDetails.appIconBase64 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTempHeaderDetails((prev) => ({ ...prev, appIconBase64: '' }))
                        }
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold underline"
                      >
                        Reset to Default Flame Icon
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  App Name:
                </label>
                <input
                  type="text"
                  value={tempHeaderDetails.appName}
                  onChange={(e) =>
                    setTempHeaderDetails((prev) => ({ ...prev, appName: e.target.value }))
                  }
                  placeholder="e.g. Staff Attendance and Pay Out"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Tagline (under app name):
                </label>
                <input
                  type="text"
                  value={tempHeaderDetails.tagline}
                  onChange={(e) =>
                    setTempHeaderDetails((prev) => ({ ...prev, tagline: e.target.value }))
                  }
                  placeholder="e.g. Steel Plant Manpower, Shift Attendance & Wage Payouts"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Contractor Name:
                </label>
                <input
                  type="text"
                  value={tempHeaderDetails.contractorName}
                  onChange={(e) =>
                    setTempHeaderDetails((prev) => ({
                      ...prev,
                      contractorName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Company or Contractor Name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Association / License Details:
                </label>
                <input
                  type="text"
                  value={tempHeaderDetails.associationName}
                  onChange={(e) =>
                    setTempHeaderDetails((prev) => ({
                      ...prev,
                      associationName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Authorized Manpower Contractor - Furnace & CCM Division"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={tempHeaderDetails.isLocked}
                    onChange={(e) =>
                      setTempHeaderDetails((prev) => ({ ...prev, isLocked: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Lock Header Details (Prevents accidental editing)
                  </span>
                </label>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleSaveHeaderDetails(DEFAULT_HEADER_DETAILS);
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-semibold"
              >
                Reset Default
              </button>
              <button
                type="button"
                onClick={() => handleSaveHeaderDetails(tempHeaderDetails)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20"
              >
                Save &amp; Lock Header
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
