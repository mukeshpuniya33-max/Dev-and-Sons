import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Share2,
  Phone,
  Copy,
  Check,
  Printer,
  FileText,
  Building2,
  CreditCard,
  Hash,
  Sparkles,
  Send,
  Sliders,
  ExternalLink,
  Download,
  ShieldCheck,
  MapPin,
  FileCheck,
  Mail,
  Award,
  Calendar,
  Layers,
  MessageSquare,
  User,
  ArrowRight,
  FileType,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { Worker, AttendanceCalculation } from '../types/attendance';
import { formatCurrency, calculateAge } from '../utils/attendanceCalculator';
import { printElementDirect } from '../utils/printHelper';

interface SharePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker;
  monthName: string;
  year: number;
  daysInMonth: number;
  calc: AttendanceCalculation;
  attendanceRecords: Record<number, string>;
  includeBank: boolean;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  includePhone: boolean;
  phone: string;
  includeAadhar?: boolean;
  aadharNumber?: string;
  includeAddress?: boolean;
  address?: string;
  includeDailyBreakdown: boolean;
  includeBaseSalary?: boolean;
  includeDailyRate?: boolean;
  includePayoutSalary?: boolean;
  includeFormulaNote?: boolean;
  includeContractor?: boolean;
  contractorName?: string;
  contractorAssociation?: string;
  contractorPhone?: string;
  contractorEmail?: string;
  contractorLicense?: string;
  workerShiftNotes?: Array<{
    day: number;
    dateStr: string;
    code: string;
    combinedReason: string;
    salaryJustification?: string;
  }>;
  onPrint: () => void;
  onDownloadPdf?: () => void;
  printedSharedOn?: string;
}

export const SharePayslipModal: React.FC<SharePayslipModalProps> = ({
  isOpen,
  onClose,
  worker,
  monthName,
  year,
  daysInMonth,
  calc,
  attendanceRecords,
  includeBank,
  accountNumber,
  ifscCode,
  bankName,
  includePhone,
  phone,
  includeAadhar = true,
  aadharNumber = '',
  includeAddress = true,
  address = '',
  includeDailyBreakdown,
  includeBaseSalary = true,
  includeDailyRate = true,
  includePayoutSalary = true,
  includeFormulaNote = true,
  includeContractor = true,
  contractorName = '',
  contractorAssociation = '',
  contractorPhone = '',
  contractorEmail = '',
  contractorLicense = '',
  workerShiftNotes = [],
  onPrint,
  onDownloadPdf,
  printedSharedOn = '',
}) => {
  const payslipVoucherRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState<boolean>(false);
  const [shareMode, setShareMode] = useState<'full' | 'payslip_only' | 'attendance_only' | 'account_only'>('full');
  const [targetEmail, setTargetEmail] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [showEmailInput, setShowEmailInput] = useState<boolean>(false);
  const [workerQrDataUrl, setWorkerQrDataUrl] = useState<string>('');
  const [includeQrCode, setIncludeQrCode] = useState<boolean>(true);

  useEffect(() => {
    // Generate a URL that points back to the app with query parameters for the payslip view
    const baseUrl = window.location.origin;
    const qrPayload = `${baseUrl}?view=payslip&id=${worker.id}&month=${monthName}&year=${year}&downloadPdf=true`;
    
    QRCode.toDataURL(qrPayload, { width: 160, margin: 1 }, (err, url) => {
      if (!err && url) {
        setWorkerQrDataUrl(url);
      }
    });
  }, [worker, monthName, year]);

  // Generate clean WhatsApp font formatted text (bold, monospace, emojis)
  const payslipText = useMemo(() => {
    let text = '';

    if (shareMode === 'attendance_only') {
      text += `📅 *WORKER ATTENDANCE REPORT*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `👤 *Worker Name:* ${worker.name}\n`;
      text += `👔 *Designation:* ${worker.designation.toUpperCase()}\n`;
      text += `🏢 *Plant Section:* ${worker.unit}\n`;
      if (worker.employeeCode) text += `🆔 *Staff ID:* ${worker.employeeCode}\n`;
      text += `📅 *Period:* ${monthName} ${year} (${daysInMonth} Days)\n\n`;
      text += `📊 *ATTENDANCE SUMMARY:*\n`;
      text += `• Total Present Days: *${calc.totalWorkingDays} Days*\n`;
      text += `• Base Shift Days: ${calc.baseWorkingDays} Days\n`;
      text += `• Overtime Hours: ${calc.totalExtraHours} Hours\n\n`;

      text += `📋 *DAILY SHIFTS (Dates 1-${daysInMonth}):*\n`;
      const markedDays: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const code = attendanceRecords[day];
        if (code) {
          markedDays.push(`${day}:${code}`);
        }
      }
      if (markedDays.length > 0) {
        text += markedDays.join(' | ') + `\n`;
      }
      text += `\n✨ _Steel Plant Attendance Register_`;
      return text;
    }

    if (shareMode === 'account_only') {
      text += `🏦 *EMPLOYEE BANK ACCOUNT DETAILS*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `👤 *Worker Name:* ${worker.name}\n`;
      text += `👔 *Designation:* ${worker.designation.toUpperCase()}\n`;
      text += `🏢 *Plant Section:* ${worker.unit}\n`;
      if (worker.employeeCode) text += `🆔 *Staff ID:* ${worker.employeeCode}\n`;
      text += `📅 *Period:* ${monthName} ${year}\n\n`;

      if (includeBank && accountNumber) {
        text += `🏦 *BANK ACCOUNT INFO:*\n`;
        text += `• Account No: *${accountNumber}*\n`;
        if (ifscCode) text += `• IFSC Code: *${ifscCode}*\n`;
        if (bankName) text += `• Bank Name: ${bankName}\n`;
      } else {
        text += `• Bank Account: Pending / On File\n`;
      }
      text += `• Net Payout Amount: *${formatCurrency(calc.payoutSalary)}*\n`;
      text += `\n✨ _Steel Plant Payroll Department_`;
      return text;
    }

    if (shareMode === 'payslip_only') {
      text += `💰 *OFFICIAL PAYMENT SLIP*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      if (includeContractor && contractorName) {
        text += `🏢 *Contractor:* ${contractorName}\n`;
      }
      text += `👤 *Worker Name:* ${worker.name}\n`;
      text += `👔 *Designation:* ${worker.designation.toUpperCase()}\n`;
      text += `🏢 *Plant Section:* ${worker.unit}\n`;
      if (worker.employeeCode) text += `🆔 *Staff ID:* ${worker.employeeCode}\n`;
      text += `📅 *Period:* ${monthName} ${year} (${daysInMonth} Days)\n\n`;

      text += `💰 *SALARY & PAYOUT:*\n`;
      if (includeBaseSalary) text += `• Base Monthly Salary: ₹${worker.salary.toLocaleString('en-IN')}\n`;
      if (includeDailyRate) text += `• Per Day Wage Rate: ₹${Math.round(calc.perDayRate)}/day\n`;
      text += `• Total Working Days: ${calc.totalWorkingDays} Days (${calc.baseWorkingDays}d + ${calc.totalExtraHours}h OT)\n`;
      if (includePayoutSalary) text += `• Net Payout Salary: *${formatCurrency(calc.payoutSalary)}*\n`;
      text += `\n✨ _Steel Plant Salary Voucher_`;
      return text;
    }

    // Default: 'full' (Full Payslip & Attendance Statement in WhatsApp Font format)
    text += `🏭 *OFFICIAL SALARY PAYSLIP & STATEMENT*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    if (includeContractor && contractorName) {
      text += `🏢 *Contractor:* ${contractorName}\n`;
      if (contractorAssociation) text += `🏷️ *Association:* ${contractorAssociation}\n`;
      if (contractorPhone) text += `📞 *Contractor Mob:* ${contractorPhone}\n`;
      if (contractorEmail) text += `✉️ *Contractor Email:* ${contractorEmail}\n`;
      if (contractorLicense) text += `📜 *License Reg:* ${contractorLicense}\n`;
      text += `─────────────────────\n`;
    }

    text += `👤 *Worker Name:* *${worker.name}*\n`;
    if (worker.fatherName) text += `👨 *Father Name:* ${worker.fatherName}\n`;
    text += `👔 *Designation:* *${worker.designation.toUpperCase()}*\n`;
    text += `🏢 *Plant Section:* ${worker.unit}\n`;
    if (worker.employeeCode) text += `🆔 *Staff ID:* ${worker.employeeCode}\n`;
    if (includePhone && phone) text += `📱 *Mobile Number:* ${phone}\n`;
    if (includeAadhar && aadharNumber) text += `🪪 *Aadhaar No:* ${aadharNumber}\n`;
    if (includeAddress && address) text += `📍 *Address:* ${address}\n`;
    if (worker.joiningDate) text += `📅 *Date of Joining:* ${worker.joiningDate}\n`;
    if (worker.dateOfBirth) {
      text += `🎂 *Date of Birth:* ${new Date(worker.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
      const ageObj = calculateAge(worker.dateOfBirth);
      if (ageObj) {
        text += `⏳ *Employee Age:* ${ageObj.years} Years, ${ageObj.days} Days\n`;
      }
    }
    text += `📅 *Period:* ${monthName} ${year} (${daysInMonth} Days)\n\n`;

    text += `💰 *SALARY & ATTENDANCE DETAILS:*\n`;
    if (includeBaseSalary) text += `• Base Monthly Salary: ₹${worker.salary.toLocaleString('en-IN')}\n`;
    text += `• Base Shift Days: ${calc.baseWorkingDays} Days\n`;
    text += `• Overtime Hours: ${calc.totalExtraHours} Hours\n`;
    text += `• OT Converted Days (12h=1d): +${calc.convertedDaysFromHours} Days\n`;
    if (calc.remainingHours > 0) {
      text += `• Remaining OT Hours: +${calc.remainingHours} Hours\n`;
    }
    text += `• Total Working Days: *${calc.totalWorkingDays} Days* ${calc.remainingHours > 0 ? `+ ${calc.remainingHours}h` : ''}\n`;
    if (includeDailyRate) text += `• Daily Wage Rate: ₹${Math.round(calc.perDayRate)}/day\n`;
    if (includeFormulaNote) text += `• Formula: (Salary ÷ ${daysInMonth}d) × (${calc.baseWorkingDays}d + ${calc.totalExtraHours}h/12)\n`;
    text += `\n`;

    if (calc.hasSplitDesignation && calc.splitBreakdown && calc.splitBreakdown.length > 0) {
      text += `🔄 *MID-MONTH DESIGNATION & SPLIT SALARY BREAKDOWN:*\n`;
      calc.splitBreakdown.forEach((period, idx) => {
        text += `• *Period ${idx + 1} (Days ${period.startDay}–${period.endDay}):* ${period.designation} (${period.unit})\n`;
        text += `  Monthly Base: ₹${period.monthlySalary.toLocaleString('en-IN')}/mo (₹${period.perDayRate.toFixed(2)}/day)\n`;
        text += `  Shifts: ${period.totalWorkingDays} Working Days (${period.baseWorkingDays}d + ${period.totalExtraHours}h OT)\n`;
        text += `  Period Earnings: *${formatCurrency(period.periodPayoutSalary)}*\n`;
        if (period.notes) text += `  Duty Assignment Note: ${period.notes}\n`;
      });
      text += `\n`;
    }

    if (includePayoutSalary) text += `💵 *NET PAYOUT SALARY: ${formatCurrency(calc.payoutSalary)}*\n`;

    if (includeBank && accountNumber) {
      text += `\n🏦 *BANK ACCOUNT DETAILS:*\n`;
      text += `• Account No: *${accountNumber}*\n`;
      if (ifscCode) text += `• IFSC Code: *${ifscCode}*\n`;
      if (bankName) text += `• Bank Name: ${bankName}\n`;
    }

    if (includeDailyBreakdown) {
      text += `\n📊 *DAILY SHIFTS (Dates 1-${daysInMonth}):*\n`;
      const markedDays: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const code = attendanceRecords[day];
        if (code) {
          markedDays.push(`${day}:${code}`);
        }
      }
      if (markedDays.length > 0) {
        text += markedDays.join(' | ') + `\n`;
      }
    }

    if (workerShiftNotes && workerShiftNotes.length > 0) {
      text += `\n📌 *SHIFT DUTY TASK NOTES & WAGE APPROVAL:*\n`;
      workerShiftNotes.forEach((note) => {
        text += `• Date ${note.day} (${note.code}): ${note.combinedReason} [Verified & Wage Approved]\n`;
      });
    }

    if (printedSharedOn) {
      text += `\n🕒 *Printed/Shared on:* ${printedSharedOn}\n`;
    }
    text += `\n✨ _Generated by Steel Plant Staff Attendance & Payroll System_`;
    return text;
  }, [
    shareMode,
    worker,
    monthName,
    year,
    daysInMonth,
    calc,
    attendanceRecords,
    includeBank,
    accountNumber,
    ifscCode,
    bankName,
    includePhone,
    phone,
    includeAadhar,
    aadharNumber,
    includeAddress,
    address,
    includeDailyBreakdown,
    includeContractor,
    contractorName,
    contractorAssociation,
    contractorPhone,
    contractorEmail,
    contractorLicense,
    workerShiftNotes,
    printedSharedOn,
  ]);

  if (!isOpen) return null;

  // Generate PDF blob
  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!payslipVoucherRef.current) return null;
    try {
      const canvas = await toCanvas(payslipVoucherRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 285));
      return pdf.output('blob');
    } catch (e) {
      console.warn('PDF blob generation fallback:', e);
      return null;
    }
  };

  // 1. Share in WhatsApp Font (Direct formatted message to WhatsApp)
  const handleShareWhatsAppFontText = () => {
    const rawPhone = phone ? phone.replace(/\D/g, '') : '';
    const formattedPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const url = formattedPhone
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(payslipText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(payslipText)}`;

    window.open(url, '_blank');
  };

  // 2. Share PDF Document (Actual PDF File)
  const handleShareWhatsAppPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdfBlob();
      const fileName = `Payslip_${worker.name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;

      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: `Salary Payslip - ${worker.name} (${monthName} ${year})`,
        });
      } else {
        // Direct PDF download without sending text to WhatsApp
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.warn('Share error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. Share PDF via Email (Downloads PDF and opens Email draft)
  const handleSharePDFEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGeneratingPdf(true);
    try {
      const blob = await generatePdfBlob();
      if (blob) {
        const fileName = `Payslip_${worker.name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const subject = encodeURIComponent(`Salary Payslip & Statement - ${worker.name} (${monthName} ${year})`);
      const body = encodeURIComponent(
        `Dear Sir/Madam,\n\nPlease find the attached salary payslip PDF and statement details for ${worker.name} below:\n\n${payslipText}\n\nGenerated securely from Staff Attendance & Payroll Manager.`
      );
      const recipient = targetEmail.trim();
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
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
      console.warn('Email share notice:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 4. Download PDF Payslip
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      if (payslipVoucherRef.current) {
        const canvas = await toCanvas(payslipVoucherRef.current, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 285));
        pdf.save(`Payslip_${worker.name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
      } else if (onDownloadPdf) {
        onDownloadPdf();
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      if (onDownloadPdf) onDownloadPdf();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payslipText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handlePrintPayslip = async () => {
    if (payslipVoucherRef.current) {
      await printElementDirect(
        payslipVoucherRef.current,
        'portrait',
        `Payslip_${worker.name}_${monthName}_${year}`
      );
    } else {
      onPrint();
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn modal-print-active print:static print:inset-auto print:block print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Share Payslip (WhatsApp Font • PDF • Email • Print)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {worker.name} &bull; {worker.unit} &bull; {monthName} {year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Share Mode Selector Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Select Sharing View / Mode:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setShareMode('full')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  shareMode === 'full'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Full Payslip
              </button>
              <button
                type="button"
                onClick={() => setShareMode('payslip_only')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  shareMode === 'payslip_only'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Payment Slip Only
              </button>
              <button
                type="button"
                onClick={() => setShareMode('attendance_only')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  shareMode === 'attendance_only'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Attendance Only
              </button>
              <button
                type="button"
                onClick={() => setShareMode('account_only')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  shareMode === 'account_only'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                Account Info Only
              </button>
            </div>
          </div>

          {/* QR Code Customization Toggle Bar */}
          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between">
            <label className="flex items-center gap-2 font-bold text-xs text-indigo-900 dark:text-indigo-200 cursor-pointer">
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Include Unique Worker Account QR Code</span>
            </label>
            <input
              type="checkbox"
              checked={includeQrCode}
              onChange={(e) => setIncludeQrCode(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5">
            {/* Top Row: WhatsApp Font + WhatsApp PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Share in WhatsApp Font (Direct Text) */}
              <button
                type="button"
                onClick={handleShareWhatsAppFontText}
                className="py-3 px-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                title="Share formatted statement in WhatsApp Font (bold/monospace text)"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Share in WhatsApp Font (Text Format)</span>
              </button>

              {/* Share PDF Document (Actual File) */}
              <button
                type="button"
                onClick={handleShareWhatsAppPDF}
                disabled={isGeneratingPdf}
                className="py-3 px-3.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-green-600/20 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                title="Share official Payslip as a real PDF file"
              >
                <FileType className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Share PDF Document (File)'}</span>
              </button>
            </div>

            {/* Middle Row: Share PDF via Email + Download PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Share PDF via Email */}
              <button
                type="button"
                onClick={() => setShowEmailInput(!showEmailInput)}
                className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Send payslip statement & PDF to an email address"
              >
                <Mail className="w-4 h-4" />
                <span>Share PDF via Email</span>
              </button>

              {/* Download PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="py-2.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                title="Download direct .PDF voucher file"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Creating PDF...' : 'Download PDF'}</span>
              </button>
            </div>

            {/* Email Recipient Input Drawer */}
            {showEmailInput && (
              <form
                onSubmit={handleSharePDFEmail}
                className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-2 animate-fadeIn text-xs"
              >
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Enter Recipient Email Address:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="e.g. worker@gmail.com or hr@plant.com"
                    className="flex-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <span>Send PDF Email</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* Bottom Utility Row: Print + Copy in WhatsApp Font */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrintPayslip}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>Print Official Sheet</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  copied
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-500" />}
                <span>{copied ? 'Copied WhatsApp Font!' : 'Copy WhatsApp Font Text'}</span>
              </button>
            </div>
          </div>

          {/* Printable Payslip Card Template (Rendered in DOM for html-to-image & Print) */}
          <div
            id="payslip-printable-card"
            ref={payslipVoucherRef}
            className="p-4 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white space-y-3"
          >
            {/* Voucher Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-2.5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                  OFFICIAL SALARY & ATTENDANCE VOUCHER
                </span>
                <h4 className="text-base font-black uppercase text-slate-900 dark:text-white">
                  {contractorName.toUpperCase() || 'STEEL PLANT MANPOWER & CONTRACTOR SERVICES'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                  MONTH PERIOD: {monthName.toUpperCase()} {year} ({daysInMonth} DAYS)
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Net Payout</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(calc.payoutSalary)}
                </span>
              </div>
            </div>

            {/* Worker Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase block font-bold">Worker Name:</span>
                <strong className="text-sm uppercase block text-slate-900 dark:text-white">{worker.name.toUpperCase()}</strong>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase block">
                  {worker.unit} &bull; {worker.designation.toUpperCase()}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase block font-bold">Attendance Shifts:</span>
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  {calc.baseWorkingDays}d Shifts + {calc.convertedDaysFromHours}d OT = {calc.totalWorkingDays} Days
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Base: ₹{worker.salary.toLocaleString('en-IN')} &bull; Rate: ₹{Math.round(calc.perDayRate)}/d
                </span>
              </div>
            </div>

            {/* Split Designation Breakdown in Preview */}
            {calc.hasSplitDesignation && calc.splitBreakdown && calc.splitBreakdown.length > 0 && (
              <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs space-y-1.5">
                <span className="text-[10px] text-indigo-900 dark:text-indigo-200 font-bold uppercase block font-sans">
                  Mid-Month Role Split Salary Breakdown:
                </span>
                <div className="space-y-1 font-mono text-[11px]">
                  {calc.splitBreakdown.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-950">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Days {p.startDay}–{p.endDay}: </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{p.designation}</span>
                        <span className="text-[9px] text-slate-400 block font-sans">₹{p.monthlySalary.toLocaleString('en-IN')}/m &bull; {p.totalWorkingDays}d</span>
                      </div>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                        {formatCurrency(p.periodPayoutSalary)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Details */}
            {accountNumber && (
              <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs flex items-center justify-between font-mono">
                <div>
                  <span className="text-[9px] text-blue-800 dark:text-blue-300 font-bold block uppercase font-sans">
                    Bank Account No:
                  </span>
                  <strong className="text-slate-900 dark:text-white text-xs">{accountNumber}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block uppercase font-sans">IFSC Code:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{ifscCode || '—'}</span>
                </div>
              </div>
            )}

            {/* Shift Duty Task Notes in Preview Voucher */}
            {workerShiftNotes && workerShiftNotes.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs space-y-1.5">
                <span className="text-[10px] text-amber-900 dark:text-amber-200 font-bold uppercase block flex items-center gap-1 font-sans">
                  <FileText className="w-3 h-3 text-amber-600" />
                  Shift Duty Task Notes &amp; Wage Approval ({workerShiftNotes.length} Entries):
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {workerShiftNotes.map((note) => (
                    <div key={note.day} className="text-[11px] text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40 space-y-0.5">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-bold text-slate-900 dark:text-white">Date {note.day}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Shift: {note.code}</span>
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{note.combinedReason}</div>
                      <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">✓ Wage Disbursal Approved</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dedicated Large Worker QR Code Section */}
            {includeQrCode && workerQrDataUrl && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-indigo-300 dark:border-indigo-800 flex flex-col items-center text-center space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider">
                  <QrCode className="w-4 h-4" />
                  <span>UNIQUE WORKER VERIFICATION QR</span>
                </div>
                
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
                  <img
                    src={workerQrDataUrl}
                    alt={`QR Code for ${worker.name}`}
                    className="w-48 h-48 object-contain rounded-xl"
                  />
                </div>

                <div className="space-y-2 w-full pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {worker.name.toUpperCase()}
                  </div>
                  
                  <div className="flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    <span>DESIGNATION: {worker.designation.toUpperCase()}</span>
                    <span>UNIT: {worker.unit.toUpperCase()}</span>
                    <span>STAFF ID: {(worker.employeeCode || worker.id).toUpperCase()}</span>
                    <span>MOBILE: {(phone || worker.phone || 'N/A').toUpperCase()}</span>
                  </div>
                </div>

                {/* WhatsApp Share Button and Download QR Button for Card */}
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={async () => {
                      if (payslipVoucherRef.current) {
                         const canvas = await toCanvas(payslipVoucherRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
                         canvas.toBlob(async (blob) => {
                           if (blob) {
                             const file = new File([blob], `CARD_${worker.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
                             
                             // 1. Try native share
                             if (navigator.share && navigator.canShare({ files: [file] })) {
                               try {
                                 await navigator.share({
                                   files: [file],
                                   title: `Worker Card: ${worker.name}`,
                                 });
                               } catch (shareErr) {
                                 console.warn('Native share failed, triggering download fallback', shareErr);
                                 // Trigger download if native share fails/is cancelled
                                 const url = URL.createObjectURL(blob);
                                 const link = document.createElement('a');
                                 link.href = url;
                                 link.download = `CARD_${worker.name.replace(/\s+/g, '_')}.png`;
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                               }
                             } else {
                               // 2. Fallback: Trigger download if native share is not available/supported
                               const url = URL.createObjectURL(blob);
                               const link = document.createElement('a');
                               link.href = url;
                               link.download = `CARD_${worker.name.replace(/\s+/g, '_')}.png`;
                               document.body.appendChild(link);
                               link.click();
                               document.body.removeChild(link);
                             }
                           }
                         });
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>SHARE FULL CARD (QR + DETAILS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (workerQrDataUrl) {
                        const link = document.createElement('a');
                        link.href = workerQrDataUrl;
                        link.download = `QR_${worker.name.replace(/\s+/g, '_')}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>DOWNLOAD QR</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Formatted Text Preview Box (WhatsApp Font Mode) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>WhatsApp Font Preview ({shareMode.replace('_', ' ').toUpperCase()}):</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">WhatsApp Markdown Ready</span>
            </label>
            <textarea
              readOnly
              rows={6}
              value={payslipText}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none select-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-semibold">
            {worker.name} &bull; Net Salary: {formatCurrency(calc.payoutSalary)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
