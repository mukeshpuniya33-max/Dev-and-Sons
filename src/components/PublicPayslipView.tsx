import React, { useEffect, useRef, useState } from 'react';
import { toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';
import { Worker, AttendanceCalculation, AttendanceDatabase } from '../types/attendance';
import { calculateWorkerMonthlyAttendance, formatCurrency } from '../utils/attendanceCalculator';
import { getAttendanceCode } from '../utils/attendanceSyncEngine';

export const PublicPayslipView: React.FC = () => {
  const payslipVoucherRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ worker: Worker, calc: AttendanceCalculation, month: string, year: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const month = params.get('month');
    const year = parseInt(params.get('year') || '2026');

    // Load data from localStorage to find the worker
    try {
      const workers: Worker[] = JSON.parse(localStorage.getItem('plant_attendance_workers_v2') || '[]');
      const worker = workers.find(w => w.id === id);
      if (worker) {
        const attendanceDb: AttendanceDatabase = JSON.parse(localStorage.getItem('plant_attendance_data_v2') || '{}');
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const rawAttendance = attendanceDb[worker.id]?.[monthKey] || {};
        const attendanceRecords: Record<number, string> = {};
        Object.keys(rawAttendance).forEach((d) => {
          const day = Number(d);
          const code = getAttendanceCode(rawAttendance[day]);
          if (code) attendanceRecords[day] = code;
        });
        const daysInMonth = 31; // Simplified, or calculate properly using getDaysInMonth
        const calc = calculateWorkerMonthlyAttendance(attendanceRecords, worker.salary, daysInMonth);
        setData({ worker, calc, month: month || '', year });
      }
    } catch (e) {
        console.error("Failed to load data for payslip view", e);
    }
  }, []);

  // Auto-generate PDF on load
  useEffect(() => {
    if (data && payslipVoucherRef.current) {
        // Delay to allow rendering
        setTimeout(async () => {
          try {
             const canvas = await toCanvas(payslipVoucherRef.current!, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
             const imgData = canvas.toDataURL('image/png');
             const pdf = new jsPDF('p', 'mm', 'a4');
             const pdfWidth = pdf.internal.pageSize.getWidth();
             const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
             pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 285));
             pdf.save(`Payslip_${data.worker.name}_${data.month}_${data.year}.pdf`);
          } catch (err) {
             console.error("Failed to render PDF canvas:", err);
          }
        }, 1000);
    }
  }, [data]);

  if (!data) return <div>Loading Payslip...</div>;

  return (
    <div className="p-4 bg-white min-h-screen">
      <div id="payslip-printable-card" ref={payslipVoucherRef} className="p-4 rounded-2xl border-2 border-slate-900 bg-white text-slate-900 space-y-3">
        {/* Simplified View of Payslip */}
        <h1 className="text-xl font-bold uppercase">{data.worker.name}</h1>
        <p>Designation: {data.worker.designation}</p>
        <p>Net Salary: {formatCurrency(data.calc.payoutSalary)}</p>
        <p>Period: {data.month} {data.year}</p>
      </div>
    </div>
  );
};
