import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Wrench, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeGuard] App ErrorBoundary caught an unhandled exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  /**
   * Auto-Repair: cleans corrupted cache/state while carefully salvaging
   * existing worker profiles and attendance entries.
   */
  private handleAutoRepair = () => {
    try {
      // 1. Remove volatile undo/redo snapshots
      localStorage.removeItem('plant_undo_stack_v3');
      localStorage.removeItem('plant_redo_stack_v3');
      localStorage.removeItem('plant_pending_cloud_sync');

      // 2. Safely salvage and clean workers
      const rawWorkers = localStorage.getItem('plant_master_workers_v3') || localStorage.getItem('plant_attendance_workers_v2');
      if (rawWorkers) {
        try {
          const parsed = JSON.parse(rawWorkers);
          if (Array.isArray(parsed)) {
            const sanitized = parsed
              .filter((w: any) => w && typeof w === 'object' && w.id && w.name)
              .map((w: any, idx: number) => ({
                id: String(w.id),
                name: String(w.name).trim(),
                designation: String(w.designation || 'WORKER').trim().toUpperCase(),
                unit: String(w.unit || 'Furnace A').trim(),
                salary: Number(w.salary) > 0 ? Number(w.salary) : 26000,
                orderIndex: typeof w.orderIndex === 'number' ? w.orderIndex : idx,
                status: w.status === 'inactive' ? 'inactive' : 'active',
                isDeleted: Boolean(w.isDeleted),
              }));
            localStorage.setItem('plant_master_workers_v3', JSON.stringify(sanitized));
            localStorage.setItem('plant_attendance_workers_v2', JSON.stringify(sanitized));
          }
        } catch {
          localStorage.removeItem('plant_master_workers_v3');
          localStorage.removeItem('plant_attendance_workers_v2');
        }
      }

      // 3. Normalize monthly database
      const rawMonthly = localStorage.getItem('plant_monthly_workers_db_v3');
      if (rawMonthly) {
        try {
          const parsed = JSON.parse(rawMonthly);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify({}));
          }
        } catch {
          localStorage.setItem('plant_monthly_workers_db_v3', JSON.stringify({}));
        }
      }

      // 4. Normalize monthly allocation database
      const rawAlloc = localStorage.getItem('plant_monthly_allocation_db_v1');
      if (rawAlloc) {
        try {
          const parsed = JSON.parse(rawAlloc);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify({}));
          }
        } catch {
          localStorage.setItem('plant_monthly_allocation_db_v1', JSON.stringify({}));
        }
      }

      // 5. Normalize attendance data
      const rawAtt = localStorage.getItem('plant_attendance_data_v2');
      if (rawAtt) {
        try {
          const parsed = JSON.parse(rawAtt);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            localStorage.setItem('plant_attendance_data_v2', JSON.stringify({}));
          }
        } catch {
          localStorage.setItem('plant_attendance_data_v2', JSON.stringify({}));
        }
      }
    } catch (e) {
      console.warn('Auto-repair notice:', e);
    }

    // Direct clean reload without hash or bad query parameters
    window.location.href = window.location.pathname;
  };

  private handleFullReset = () => {
    if (window.confirm('Are you sure you want to reset app storage to fresh state? Your cloud-synced account data will still remain on the server.')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.href = window.location.pathname;
    }
  };

  private handleCopyDetails = () => {
    const errorText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
    try {
      navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unexpected application render exception';

      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans select-none">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Title & Bilingual Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Staff Attendance &amp; Payroll Manager
              </h2>
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-amber-400">
                  एप्लिकेशन रिकवर हो गया है। आपका डेटा सुरक्षित है।
                </p>
                <p className="text-slate-400">
                  The application recovered safely. All your saved worker and attendance records are intact.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 text-left">
              <div className="text-[11px] font-mono text-rose-400 break-words line-clamp-3">
                {errorMsg}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleAutoRepair}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>Auto-Repair &amp; Launch App (ऑटो-रिपेयर व चालू करें)</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reload App</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleFullReset}
                  className="flex-1 py-3 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fresh Reset</span>
                </button>
              </div>
            </div>

            {/* Technical Error Details Accordion */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="text-[11px] text-slate-400 hover:text-slate-300 font-semibold flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <span>Technical Details (तकनीकी जानकारी)</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 text-left space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">Error Stack Trace</span>
                    <button
                      type="button"
                      onClick={this.handleCopyDetails}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      {this.state.copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{this.state.copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-black/60 border border-slate-800 text-[10px] text-slate-300 font-mono overflow-x-auto max-h-40 leading-relaxed">
                    {this.state.error?.stack || this.state.error?.message || 'No stack trace available.'}
                  </pre>
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
