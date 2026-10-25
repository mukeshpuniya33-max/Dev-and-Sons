import React, { useState, useRef } from 'react';
import {
  X,
  Send,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
  ArrowRight,
  Database,
  Users,
  Calendar,
  Cloud,
  FileJson,
  Sparkles,
  RefreshCw,
  FileText,
  MessageSquare,
  Shield,
  FileType,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { User } from 'firebase/auth';
import { Worker, AttendanceDatabase } from '../types/attendance';
import { createAccountDataTransfer } from '../lib/firebase';
import { transferAccountDataServer } from '../lib/serverSync';

interface TransferDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  workers: Worker[];
  masterWorkers: Worker[];
  attendanceDb: AttendanceDatabase;
  monthlyWorkersDb: Record<string, Worker[]>;
  onDataImport: (importedData: any) => void;
}

export const TransferDataModal: React.FC<TransferDataModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  workers,
  masterWorkers,
  attendanceDb,
  monthlyWorkersDb,
  onDataImport,
}) => {
  const [targetEmail, setTargetEmail] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalWorkers = masterWorkers.length > 0 ? masterWorkers.length : workers.length;
  const totalMonths = Object.keys(monthlyWorkersDb).length || 1;
  const totalAttendanceDays = Object.values(attendanceDb).reduce((acc, workerMonths) => {
    return (
      acc +
      Object.values(workerMonths).reduce((dayAcc, days) => dayAcc + Object.keys(days).length, 0)
    );
  }, 0);

  if (!isOpen) return null;

  // Generate Master Data PDF File Blob
  const generateMasterPdfBlob = (): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const allStaff = masterWorkers.length > 0 ? masterWorkers : workers;
    
    // Page 1: Header & Overview
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('STEEL PLANT MANPOWER & CONTRACTOR SERVICES', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Official Master Staff Directory & Data Transfer Report | Date: ${new Date().toLocaleDateString()}`, 14, 23);

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 38, 182, 22, 3, 3, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Active Workers: ${allStaff.length}`, 20, 46);
    doc.text(`Total Monthly Registers: ${totalMonths}`, 80, 46);
    doc.text(`Recorded Shifts: ${totalAttendanceDays}`, 140, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sender: ${currentUser?.email || 'Plant Admin'}  |  Target: ${targetEmail || 'Universal Backup'}`, 20, 53);

    // Staff Table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MASTER WORKER DIRECTORY & BANK DETAILS REGISTER', 14, 69);

    let startY = 75;
    doc.setFontSize(8);
    doc.setFillColor(79, 70, 229);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, startY, 182, 7, 'F');
    doc.text('S.N.', 16, startY + 5);
    doc.text('Worker Name', 26, startY + 5);
    doc.text('Unit', 68, startY + 5);
    doc.text('Designation', 92, startY + 5);
    doc.text('Base Salary', 124, startY + 5);
    doc.text('Bank A/C No & IFSC', 148, startY + 5);

    startY += 7;
    doc.setTextColor(30, 41, 59);

    allStaff.forEach((w, idx) => {
      if (startY > 270) {
        doc.addPage();
        startY = 20;
        doc.setFontSize(8);
        doc.setFillColor(79, 70, 229);
        doc.setTextColor(255, 255, 255);
        doc.rect(14, startY, 182, 7, 'F');
        doc.text('S.N.', 16, startY + 5);
        doc.text('Worker Name', 26, startY + 5);
        doc.text('Unit', 68, startY + 5);
        doc.text('Designation', 92, startY + 5);
        doc.text('Base Salary', 124, startY + 5);
        doc.text('Bank A/C No & IFSC', 148, startY + 5);
        startY += 7;
        doc.setTextColor(30, 41, 59);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, startY, 182, 6.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.text(String(idx + 1), 16, startY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text(w.name.slice(0, 22), 26, startY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(w.unit, 68, startY + 4.5);
      doc.text(w.designation.slice(0, 16), 92, startY + 4.5);
      doc.text(`Rs. ${w.salary.toLocaleString('en-IN')}`, 124, startY + 4.5);
      doc.text(w.accountNumber ? `${w.accountNumber.slice(0, 14)} (${w.ifscCode || ''})` : 'A/C on file', 148, startY + 4.5);

      startY += 6.5;
    });

    // Verification Footer on last page
    startY += 10;
    if (startY > 260) {
      doc.addPage();
      startY = 30;
    }
    doc.setDrawColor(203, 213, 225);
    doc.line(14, startY, 196, startY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Plant Incharge Signature: _______________________', 14, startY + 10);
    doc.text('Contractor Seal & Stamp: _______________________', 115, startY + 10);

    return doc.output('blob');
  };

  // Helper to safely trigger mailto link without causing iframe reload or navigation errors
  const triggerMailto = (toEmail: string, subject: string, body: string) => {
    try {
      const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

  // 1. Share Master Data PDF to WhatsApp
  const handleShareMasterPDFWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = generateMasterPdfBlob();
      const fileName = `Master_Staff_Data_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: `Master Staff Data Report - ${totalWorkers} Workers`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn('PDF share notice:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Share Master Data PDF via Email
  const handleShareMasterPDFEmail = () => {
    setIsGeneratingPdf(true);
    try {
      const blob = generateMasterPdfBlob();
      const fileName = `Master_Staff_Data_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const subject = `Master Staff Data & Attendance Report - ${totalWorkers} Workers`;
      const body = `Dear Sir/Madam,\n\nPlease find the attached official Master Staff Data & Attendance Report for ${totalWorkers} workers across ${totalMonths} monthly registers.\n\nSender: ${currentUser?.email || 'Plant Admin'}\nTarget Email: ${targetEmail || 'N/A'}\nDate: ${new Date().toLocaleDateString()}\n\nGenerated securely from Staff Attendance & Payroll Manager.\n(The PDF file has also been saved to your downloads for easy attachment)`;

      triggerMailto(targetEmail || '', subject, body);
    } catch (err) {
      console.warn('Email share notice:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. Send Transfer Summary & Access Link to Email
  const handleSendTransferEmailNotice = async () => {
    if (!targetEmail.trim() || !targetEmail.includes('@')) {
      setError('Please enter a valid target email address first.');
      return;
    }
    setError(null);

    // Save cloud transfer record in background across both Firebase and Server Sync
    try {
      await createAccountDataTransfer(currentUser, targetEmail.trim(), {
        workers,
        attendanceDb,
        monthlyWorkersDb,
        masterWorkers,
      });
      await transferAccountDataServer(targetEmail.trim(), {
        workers,
        attendance: attendanceDb,
        monthlyWorkersDb,
        masterWorkers,
      });
      setTransferSuccess(true);
    } catch (e) {
      console.error('Cloud transfer error:', e);
      setError('Data transfer to cloud failed. Please check your internet connection and try again.');
      return; // Stop here, do not trigger mailto
    }

    const subject = `Plant Staff Attendance Database Transfer for ${targetEmail}`;
    const body = `Hello,\n\nA complete transfer of the Staff Attendance & Payroll database has been authorized for your email account: ${targetEmail}\n\nSummary of Data Transferred:\n- Total Active Workers: ${totalWorkers}\n- Total Monthly Registers: ${totalMonths}\n- Total Shifts Recorded: ${totalAttendanceDays}\n- Transferred by: ${currentUser?.email || 'Current Plant Admin'}\n- Date: ${new Date().toLocaleString()}\n\nTo access this roster:\n1. Open the Staff Attendance & Payroll app.\n2. Tap "Cloud Account" in the top header.\n3. Sign in with ${targetEmail}.\n4. Your data will load instantly in real-time!\n\nAll historical records and current wages remain 100% safe.`;

    triggerMailto(targetEmail || '', subject, body);
  };

  // 4. Download Master Data PDF
  const handleDownloadMasterPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const blob = generateMasterPdfBlob();
      const fileName = `Master_Staff_Data_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCloudTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim() || !targetEmail.includes('@')) {
      setError('Please enter a valid target email address (e.g. user@gmail.com).');
      return;
    }

    if (currentUser?.email && currentUser.email.toLowerCase() === targetEmail.trim().toLowerCase()) {
      setError('Target email cannot be the same as your current logged-in email.');
      return;
    }

    setIsTransferring(true);
    setError(null);

    try {
      await createAccountDataTransfer(currentUser, targetEmail.trim(), {
        workers,
        attendanceDb,
        monthlyWorkersDb,
        masterWorkers,
      });
      await transferAccountDataServer(targetEmail.trim(), {
        workers,
        attendance: attendanceDb,
        monthlyWorkersDb,
        masterWorkers,
      });
      setTransferSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Data transfer failed. Please check network connection and try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDownloadBackupPackage = () => {
    const backupBundle = {
      version: '3.0',
      exportType: 'Plant_Staff_Account_Transfer_Bundle',
      exportedBy: currentUser?.email || 'Admin',
      targetEmail: targetEmail.trim() || 'all',
      timestamp: new Date().toISOString(),
      summary: {
        totalWorkers,
        totalMonths,
        totalAttendanceEntries: totalAttendanceDays,
      },
      data: {
        workers,
        masterWorkers,
        monthlyWorkersDb,
        attendanceDb,
      },
    };

    const blob = new Blob([JSON.stringify(backupBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Staff_Database_Transfer_Package_${new Date().toISOString().slice(0, 10)}.plantdata`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyTransferCode = () => {
    const transferSummary = `[STAFF-DATA-TRANSFER]\nSource: ${currentUser?.email || 'Plant Admin'}\nTarget: ${targetEmail}\nWorkers: ${totalWorkers}\nMonths: ${totalMonths}\nDate: ${new Date().toLocaleDateString()}`;
    navigator.clipboard.writeText(transferSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        onDataImport(importedData);
        onClose();
      } catch (err) {
        setError('Invalid file format. Please upload a valid .plantdata or .json file.');
      }
    };
    reader.readAsText(file);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Transfer Data to Another Email ID
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Secure
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Move all workers, attendance history, and plant registers to a new email account
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-700 dark:text-slate-200 block text-xs uppercase tracking-wider">
              📦 Data Package Summary to Transfer:
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Users className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                <span className="text-base font-extrabold text-slate-900 dark:text-white block">
                  {totalWorkers}
                </span>
                <span className="text-[10px] text-slate-500">Worker Profiles</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Calendar className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                <span className="text-base font-extrabold text-slate-900 dark:text-white block">
                  {totalMonths}
                </span>
                <span className="text-[10px] text-slate-500">Monthly Registers</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Database className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                <span className="text-base font-extrabold text-slate-900 dark:text-white block">
                  {totalAttendanceDays}
                </span>
                <span className="text-[10px] text-slate-500">Attendance Shifts</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {transferSuccess ? (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">
                  Data Successfully Transferred to Cloud!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  A complete copy of your worker profiles and attendance has been transferred for{' '}
                  <strong className="underline">{targetEmail}</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 text-left border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                  🚀 How to access your data in the new account:
                </span>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                  <li>Open this app on your mobile or laptop.</li>
                  <li>Tap <strong>Cloud Account</strong> in the top header.</li>
                  <li>
                    Sign in with <strong>{targetEmail}</strong>.
                  </li>
                  <li>
                    Your complete worker directory, bank accounts, and attendance registers will load automatically in real-time!
                  </li>
                </ol>
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackupPackage}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-1.5 transition-all text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Transfer Backup File</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferSuccess(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCloudTransfer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  Enter New / Target Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. yournewaccount@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  When you sign into the app with this new email ID, all your workers and registers will be ready.
                </p>
              </div>

              {/* 100% Data Safety Guarantee Notice */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <strong>100% Data Safety & Multi-Account Guarantee:</strong> All worker profiles, attendance history, and bank registers transferred to your new email ID will <em>also remain 100% safe, active, and intact in your current account ({currentUser?.email || 'this account'})</em>.
                </div>
              </div>

              {/* Master Data PDF Exporter & WhatsApp/Email Sharing Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <FileType className="w-4 h-4 text-indigo-500" />
                    Share All Data in PDF Format:
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Complete Plant Dossier</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Export all worker profiles, bank accounts, wage rates, and shift registers into an official Master PDF document:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Share Master PDF to WhatsApp */}
                  <button
                    type="button"
                    onClick={handleShareMasterPDFWhatsApp}
                    disabled={isGeneratingPdf}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                    title="Share complete staff data as real PDF to WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{isGeneratingPdf ? 'Creating PDF...' : 'PDF to WhatsApp'}</span>
                  </button>

                  {/* Share Master PDF via Email */}
                  <button
                    type="button"
                    onClick={handleShareMasterPDFEmail}
                    disabled={isGeneratingPdf}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                    title="Share complete staff data PDF via Email"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>PDF to Email</span>
                  </button>

                  {/* Download Master PDF */}
                  <button
                    type="button"
                    onClick={handleDownloadMasterPDF}
                    disabled={isGeneratingPdf}
                    className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                    title="Download complete Master PDF file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {isTransferring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transferring Cloud Database...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Transfer All Data to Cloud</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendTransferEmailNotice}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  title="Send transfer confirmation and access instructions directly via Email"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Transfer to Email ID</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackupPackage}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Download .plantdata File</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyTransferCode}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
                
                {/* Import Button */}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".plantdata,.json" style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Read / Import Data File</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
          <span>Protected with 256-bit Firebase End-to-End Encryption</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
