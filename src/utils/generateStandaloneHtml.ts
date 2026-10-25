import { Worker, AttendanceDatabase, CCM_DESIGNATIONS, FURNACE_DESIGNATIONS } from '../types/attendance';

export function generateStandaloneAppHtml(
  workers: Worker[],
  attendanceDb: AttendanceDatabase,
  year: number,
  month: number
): string {
  const serializedWorkers = JSON.stringify(workers);
  const serializedDb = JSON.stringify(attendanceDb);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Staff Attendance & Payroll Manager</title>
  <meta name="theme-color" content="#ea580c">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    /* Robust offline fallback styles if CDN is not reachable */
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; background-color: #f8fafc; color: #0f172a; }
    table { border-collapse: collapse; }
    button, select, input { font-family: inherit; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
  <header class="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center space-x-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white font-black text-xl shadow-md">
        🔥
      </div>
      <div>
        <h1 class="text-base sm:text-lg font-black text-slate-900 leading-tight">Staff Attendance &amp; Payroll</h1>
        <p class="text-xs text-slate-500">Furnace A • Furnace B • CCM (12h OT = 1 Day)</p>
      </div>
    </div>
    <div class="flex items-center space-x-2">
      <select id="monthSelect" class="bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"></select>
      <input id="yearInput" type="number" min="1990" max="2100" class="bg-slate-100 border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold w-20 outline-none cursor-pointer" />
      <button id="addWorkerBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all">
        + Add Worker
      </button>
      <button id="exportCsvBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all">
        Export CSV
      </button>
    </div>
  </header>

  <!-- Unit filter tabs -->
  <div class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs">
    <div class="flex items-center space-x-1.5">
      <span class="font-bold text-slate-400 mr-1">Unit:</span>
      <button onclick="setFilter('All')" id="btnFilterAll" class="px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white">All Staff</button>
      <button onclick="setFilter('Both Furnaces (A + B)')" id="btnFilterBoth" class="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-700">🔥 Both Furnaces (A + B)</button>
      <button onclick="setFilter('Furnace A')" id="btnFilterFA" class="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-700">Furnace A</button>
      <button onclick="setFilter('Furnace B')" id="btnFilterFB" class="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-700">Furnace B</button>
      <button onclick="setFilter('CCM')" id="btnFilterCCM" class="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-700">CCM</button>
    </div>
    <div id="statsSummary" class="font-mono text-xs font-bold text-slate-600"></div>
  </div>

  <!-- Formula Banner -->
  <div class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] font-mono text-amber-900 flex items-center justify-between">
    <span>📐 <strong>Formula:</strong> Payout = (Monthly Salary ÷ Month Days) × (Working Days + Remaining Hours ÷ 12) &bull; <em>12h OT = 1 Full Working Day</em></span>
    <span class="bg-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">Offline Local App</span>
  </div>

  <!-- Main Grid Area -->
  <main class="flex-1 p-3 overflow-auto">
    <div id="gridContainer" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-auto"></div>
  </main>

  <!-- Quick Tap Modal -->
  <div id="quickTapModal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 hidden flex items-center justify-center p-3">
    <div class="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h3 id="modalWorkerTitle" class="text-base font-bold text-slate-900"></h3>
          <p id="modalDateSubtitle" class="text-xs text-slate-500"></p>
        </div>
        <button onclick="closeQuickTapModal()" class="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
      </div>

      <!-- Quick Taps -->
      <div class="space-y-3 text-xs">
        <div>
          <span class="font-bold text-slate-700 block mb-1">Single Shift (P4 + OT):</span>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button onclick="applyCode('P4')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4 (1d)</button>
            <button onclick="applyCode('P4(2)')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4(2)</button>
            <button onclick="applyCode('P4(4)')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4(4)</button>
            <button onclick="applyCode('P4(6)')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4(6)</button>
            <button onclick="applyCode('P4(8)')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4(8)</button>
            <button onclick="applyCode('P4(12)')" class="p-2 border rounded-xl font-bold bg-slate-50 hover:bg-indigo-50">P4(12)</button>
          </div>
        </div>

        <div>
          <span class="font-bold text-slate-700 block mb-1">Double Shift (P4 + P4):</span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button onclick="applyCode('P4 + P4')" class="p-2 border border-blue-200 rounded-xl font-bold bg-blue-50 text-blue-800">P4 + P4 (2d)</button>
            <button onclick="applyCode('P4(4)+P4(4)')" class="p-2 border border-blue-200 rounded-xl font-bold bg-blue-50 text-blue-800">P4(4)+P4(4)</button>
            <button onclick="applyCode('P4(6)+P4(6)')" class="p-2 border border-blue-200 rounded-xl font-bold bg-blue-50 text-blue-800">P4(6)+P4(6)</button>
            <button onclick="applyCode('P4(8)+P4(4)')" class="p-2 border border-blue-200 rounded-xl font-bold bg-blue-50 text-blue-800">P4(8)+P4(4)</button>
          </div>
        </div>

        <div>
          <span class="font-bold text-slate-700 block mb-1">Triple Shift (P4 + P4 + P4):</span>
          <div class="grid grid-cols-2 gap-1.5">
            <button onclick="applyCode('P4+P4+P4')" class="p-2 border border-purple-200 rounded-xl font-bold bg-purple-50 text-purple-800">P4 + P4 + P4 (3d)</button>
            <button onclick="applyCode('P4(4)+P4(4)+P4(4)')" class="p-2 border border-purple-200 rounded-xl font-bold bg-purple-50 text-purple-800">P4(4)+P4(4)+P4(4)</button>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-1.5 pt-1">
          <button onclick="applyCode('A')" class="p-2 border border-rose-200 bg-rose-50 text-rose-700 rounded-xl font-bold">Absent (A)</button>
          <button onclick="applyCode('WO')" class="p-2 border border-slate-200 bg-slate-100 text-slate-700 rounded-xl font-bold">Weekly Off (WO)</button>
          <button onclick="applyCode('HD')" class="p-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl font-bold">Half Day (HD)</button>
          <button onclick="applyCode('')" class="p-2 border border-slate-200 text-slate-500 rounded-xl font-semibold">Clear</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    // State initialization
    let workers = JSON.parse(localStorage.getItem('plant_workers_offline') || '${serializedWorkers.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
    let attendanceDb = JSON.parse(localStorage.getItem('plant_attendance_offline') || '${serializedDb.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
    let currentYear = ${year};
    let currentMonth = ${month};
    let currentUnitFilter = 'All';
    let currentTarget = null;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Setup Month/Year selectors (Unlimited Years)
    const mSelect = document.getElementById('monthSelect');
    monthNames.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = name;
      if (i + 1 === currentMonth) opt.selected = true;
      mSelect.appendChild(opt);
    });

    const yInput = document.getElementById('yearInput');
    yInput.value = currentYear;

    mSelect.onchange = (e) => { currentMonth = parseInt(e.target.value); render(); };
    yInput.onchange = (e) => { currentYear = parseInt(e.target.value) || 2026; render(); };

    function parseCode(code) {
      if (!code) return { days: 0, hours: 0, isA: false, isWO: false };
      const c = code.trim().toUpperCase();
      if (c === 'A') return { days: 0, hours: 0, isA: true, isWO: false };
      if (c === 'WO') return { days: 0, hours: 0, isA: false, isWO: true };
      if (c === 'HD') return { days: 0.5, hours: 0, isA: false, isWO: false };

      const parts = c.split('+');
      let d = 0, h = 0;
      parts.forEach(p => {
        const withH = p.trim().match(/^P\\s*4?\\s*\\(\\s*(\\d+)\\s*\\)$/i);
        if (withH) { d += 1; h += parseInt(withH[1]) || 0; return; }
        if (p.trim().match(/^P\\s*4?$/i)) { d += 1; return; }
      });
      return { days: d, hours: h, isA: false, isWO: false };
    }

    function calculateWorker(wId, salary, daysInMonth, monthKey) {
      const records = (attendanceDb[wId] && attendanceDb[wId][monthKey]) || {};
      let baseDays = 0, extraHours = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const parsed = parseCode(records[day]);
        baseDays += parsed.days;
        extraHours += parsed.hours;
      }
      const converted = Math.floor(extraHours / 12);
      const remainingH = extraHours % 12;
      const totalWorkingDays = baseDays + converted;
      const perDay = salary / daysInMonth;
      const payout = perDay * (totalWorkingDays + (remainingH / 12));
      return { baseDays, extraHours, converted, remainingH, totalWorkingDays, payout: Math.round(payout) };
    }

    function setFilter(unit) {
      currentUnitFilter = unit;
      ['All','Both','FA','FB','CCM'].forEach(id => {
        const targetUnit = id === 'FA' ? 'Furnace A' : id === 'FB' ? 'Furnace B' : id === 'Both' ? 'Both Furnaces (A + B)' : id === 'All' ? 'All' : 'CCM';
        const b = document.getElementById('btnFilter' + id);
        if (b) b.className = 'px-3 py-1.5 rounded-xl font-bold ' + (unit === targetUnit ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700');
      });
      render();
    }

    function moveWorker(index, dir) {
      const target = index + dir;
      if (target < 0 || target >= workers.length) return;
      const temp = workers[index];
      workers[index] = workers[target];
      workers[target] = temp;
      localStorage.setItem('plant_workers_offline', JSON.stringify(workers));
      render();
    }

    function openQuickTap(wId, day) {
      const worker = workers.find(w => w.id === wId);
      if (!worker) return;
      currentTarget = { wId, day };
      document.getElementById('modalWorkerTitle').textContent = worker.name + ' (' + worker.unit + ')';
      document.getElementById('modalDateSubtitle').textContent = 'Date: Day ' + day + ' ' + monthNames[currentMonth - 1] + ' ' + currentYear;
      document.getElementById('quickTapModal').classList.remove('hidden');
    }

    function closeQuickTapModal() {
      document.getElementById('quickTapModal').classList.add('hidden');
    }

    function applyCode(code) {
      if (!currentTarget) return;
      const { wId, day } = currentTarget;
      const monthKey = currentYear + '-' + String(currentMonth).padStart(2, '0');
      attendanceDb[wId] = attendanceDb[wId] || {};
      attendanceDb[wId][monthKey] = attendanceDb[wId][monthKey] || {};
      if (code) attendanceDb[wId][monthKey][day] = code;
      else delete attendanceDb[wId][monthKey][day];

      localStorage.setItem('plant_attendance_offline', JSON.stringify(attendanceDb));
      closeQuickTapModal();
      render();
    }

    function render() {
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const monthKey = currentYear + '-' + String(currentMonth).padStart(2, '0');
      const filtered = workers.filter(w => {
        if (currentUnitFilter === 'All') return true;
        if (currentUnitFilter === 'Both Furnaces (A + B)') return w.unit === 'Furnace A' || w.unit === 'Furnace B';
        return w.unit === currentUnitFilter;
      });

      let totalPayout = 0;
      let html = '<table class="w-full text-xs text-left border-collapse select-none"><thead class="bg-slate-100 text-slate-700 sticky top-0 z-20"><tr>';
      html += '<th class="py-2.5 px-1.5 border-b border-r min-w-[50px] text-center font-bold">Shift</th>';
      html += '<th class="py-2.5 px-3 border-b border-r min-w-[170px] sticky left-0 z-30 bg-slate-100 font-bold">Worker & Role</th>';
      html += '<th class="py-2.5 px-2 border-b border-r min-w-[100px] text-center font-bold">Unit</th>';
      html += '<th class="py-2.5 px-2 border-b border-r min-w-[90px] text-right font-bold">Salary</th>';

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(currentYear, currentMonth - 1, day);
        const isSun = d.getDay() === 0;
        html += '<th class="py-1 px-1 border-b border-r text-center min-w-[40px] ' + (isSun ? 'bg-rose-50 text-rose-600' : '') + '">';
        html += '<div class="text-[9px] text-slate-400 uppercase">' + ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()] + '</div>';
        html += '<div class="font-bold">' + day + '</div></th>';
      }

      html += '<th class="py-2.5 px-2 border-b border-r text-center font-bold bg-indigo-50 text-indigo-700">Days</th>';
      html += '<th class="py-2.5 px-2 border-b border-r text-center font-bold bg-amber-50 text-amber-700">OT (h)</th>';
      html += '<th class="py-2.5 px-2.5 border-b text-right font-bold bg-emerald-50 text-emerald-800">Payout (₹)</th>';
      html += '</tr></thead><tbody class="divide-y divide-slate-100">';

      filtered.forEach((w, idx) => {
        const calc = calculateWorker(w.id, w.salary, daysInMonth, monthKey);
        totalPayout += calc.payout;
        const records = (attendanceDb[w.id] && attendanceDb[w.id][monthKey]) || {};

        html += '<tr class="' + (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40') + '">';
        html += '<td class="py-1 px-1 border-r text-center"><button onclick="moveWorker(' + idx + ',-1)" class="px-1 text-slate-400 hover:text-indigo-600">▲</button><button onclick="moveWorker(' + idx + ',1)" class="px-1 text-slate-400 hover:text-indigo-600">▼</button></td>';
        html += '<td class="py-2 px-3 border-r sticky left-0 z-10 bg-inherit font-bold text-slate-900">' + w.name + '<div class="text-[10px] font-normal text-slate-500 uppercase">' + w.designation + '</div></td>';
        html += '<td class="py-2 px-2 border-r text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ' + (w.unit === 'Furnace A' ? 'bg-amber-100 text-amber-800' : w.unit === 'Furnace B' ? 'bg-orange-100 text-orange-800' : 'bg-cyan-100 text-cyan-800') + '">' + w.unit + '</span></td>';
        html += '<td class="py-2 px-2 border-r text-right font-mono font-semibold">₹' + w.salary.toLocaleString('en-IN') + '</td>';

        for (let day = 1; day <= daysInMonth; day++) {
          const code = records[day] || '-';
          const isSun = new Date(currentYear, currentMonth - 1, day).getDay() === 0;
          let badgeClass = 'bg-slate-50 text-slate-400';
          if (code === 'A') badgeClass = 'bg-rose-100 text-rose-700 font-bold border-rose-300';
          else if (code === 'WO') badgeClass = 'bg-slate-100 text-slate-500 font-bold';
          else if (code.includes('P4')) badgeClass = code.includes('+') ? 'bg-blue-100 text-blue-800 font-bold' : (code.includes('(') ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-emerald-50 text-emerald-800 font-bold');

          html += '<td onclick="openQuickTap(\\'' + w.id + '\\', ' + day + ')" class="p-0.5 border-r text-center cursor-pointer hover:scale-105 ' + (isSun ? 'bg-rose-50/20' : '') + '">';
          html += '<div class="h-6 rounded border text-[10px] flex items-center justify-center ' + badgeClass + '">' + code + '</div></td>';
        }

        html += '<td class="py-2 px-1 border-r text-center font-bold text-indigo-700">' + calc.totalWorkingDays + 'd</td>';
        html += '<td class="py-2 px-1 border-r text-center font-bold text-amber-700">' + calc.extraHours + 'h</td>';
        html += '<td class="py-2 px-2.5 text-right font-bold font-mono text-emerald-700">₹' + calc.payout.toLocaleString('en-IN') + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      document.getElementById('gridContainer').innerHTML = html;
      document.getElementById('statsSummary').textContent = filtered.length + ' Workers | Total Payout: ₹' + totalPayout.toLocaleString('en-IN');
    }

    document.getElementById('addWorkerBtn').onclick = () => {
      const name = prompt('Enter Worker Name:');
      if (!name) return;
      const unit = prompt('Enter Unit (Furnace A, Furnace B, CCM):', 'Furnace A') || 'Furnace A';
      const isCCM = unit.toUpperCase() === 'CCM';
      const sampleRoles = isCCM ? 'CCM MANAGER, CCM INCHARGE, MOLD OPERATOR, FITTER, FITTER HELPER, PUMP OPERATOR, BELDER' : 'MELTER, BARIMAN, FURNACE HELPER, CRANE OPERATOR, SUPERVISOR, INCHARGE';
      const designation = (prompt('Enter Designation in ALL CAPS (e.g. ' + sampleRoles + '):', isCCM ? 'MOLD OPERATOR' : 'MELTER') || 'MELTER').toUpperCase();
      const salary = parseFloat(prompt('Enter Monthly Base Salary (₹):', '26000')) || 26000;
      workers.push({ id: 'w-' + Date.now(), name, designation, unit, salary });
      localStorage.setItem('plant_workers_offline', JSON.stringify(workers));
      render();
    };

    document.getElementById('exportCsvBtn').onclick = () => {
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const monthKey = currentYear + '-' + String(currentMonth).padStart(2, '0');
      let csv = 'Name,Designation,Unit,Monthly Salary,Mobile,Aadhaar Number,Address,Account Number,IFSC Code,Bank Name,';
      for (let day = 1; day <= daysInMonth; day++) csv += 'Day ' + day + ',';
      csv += 'Total Days,OT Hours,Payout Salary\\n';

      workers.forEach(w => {
        const calc = calculateWorker(w.id, w.salary, daysInMonth, monthKey);
        const records = (attendanceDb[w.id] && attendanceDb[w.id][monthKey]) || {};
        csv += '"' + w.name + '","' + w.designation + '","' + w.unit + '",' + w.salary + ',"' + (w.phone || '') + '","' + (w.aadharNumber || '') + '","' + (w.address || '') + '","' + (w.accountNumber || '') + '","' + (w.ifscCode || '') + '","' + (w.bankName || '') + '",';
        for (let day = 1; day <= daysInMonth; day++) csv += '"' + (records[day] || '') + '",';
        csv += calc.totalWorkingDays + ',' + calc.extraHours + ',' + calc.payout + '\\n';
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Staff_Attendance_' + monthNames[currentMonth - 1] + '_' + currentYear + '.csv';
      a.click();
    };

    render();
  </script>
</body>
</html>`;
}

export function downloadStandaloneAppHtmlFile(
  workers: Worker[],
  attendanceDb: AttendanceDatabase,
  year: number,
  month: number
) {
  const htmlContent = generateStandaloneAppHtml(workers, attendanceDb, year, month);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Staff-Attendance-Android-App.html');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
