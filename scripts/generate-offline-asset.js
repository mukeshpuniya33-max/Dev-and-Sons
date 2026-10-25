import fs from 'fs';
import path from 'path';
import { DEFAULT_WORKERS, getInitialAttendanceData } from '../src/data/sampleStaff.js';
import { generateStandaloneAppHtml } from '../src/utils/generateStandaloneHtml.js';

const targetFile = process.argv[2] || 'public/Staff-Attendance-Android-App.html';
const targetDir = path.dirname(targetFile);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const html = generateStandaloneAppHtml(DEFAULT_WORKERS, getInitialAttendanceData(2026, 10), 2026, 10);
fs.writeFileSync(targetFile, html, 'utf8');

console.log(`Successfully generated standalone HTML at ${targetFile}`);
