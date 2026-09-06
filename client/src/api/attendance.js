import { apiDownload } from './http.js';

export async function getAttendanceGrid(authenticatedRequest, year, month) {
  return authenticatedRequest(`/attendance?year=${year}&month=${month}`);
}

export async function markAttendance(authenticatedRequest, workDate, records) {
  await authenticatedRequest('/attendance', {
    method: 'POST',
    body: JSON.stringify({ workDate, records })
  });
}

export async function getEmployeeCalendar(authenticatedRequest, employeeId, year, month) {
  const data = await authenticatedRequest(
    `/attendance/${employeeId}/calendar?year=${year}&month=${month}`
  );
  return data.calendar;
}

export async function exportAttendanceCsv(accessToken, year, month) {
  const padMonth = String(month).padStart(2, '0');
  return apiDownload(
    `/attendance/export?year=${year}&month=${month}&format=csv`,
    `attendance_${year}_${padMonth}.csv`,
    accessToken
  );
}

export async function downloadAttendancePdf(accessToken, year, month) {
  const padMonth = String(month).padStart(2, '0');
  return apiDownload(
    `/attendance/export?year=${year}&month=${month}&format=pdf`,
    `Attendance_${year}_${padMonth}.pdf`,
    accessToken
  );
}

export async function downloadAttendanceExcel(accessToken, year, month) {
  const padMonth = String(month).padStart(2, '0');
  return apiDownload(
    `/attendance/export?year=${year}&month=${month}&format=xlsx`,
    `Attendance_${year}_${padMonth}.xlsx`,
    accessToken
  );
}

