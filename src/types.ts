export interface Student {
  id: number;
  student_id: string;
  full_name: string;
  class_name: string;
  email?: string;
  face_encoding: string;
  image_path: string;
  created_at: string;
  updated_at?: string;
}

export interface AttendanceSession {
  id: number;
  class_name: string;
  session_date: string;
  session_name: string;
  created_by: string;
  created_at: string;
  total_records?: number;
  present_count?: number;
  absent_count?: number;
  late_count?: number;
  excused_count?: number;
}

export interface AttendanceRecord {
  id: number;
  student_id: string;
  student_name: string;
  student_email?: string;
  class_name: string;
  session_id: number;
  session_name?: string;
  attendance_date: string;
  attendance_time: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  confidence: number;
  marked_by: string;
  audit_note?: string;
  created_at: string;
  updated_at?: string;
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface FaceDetection {
  boxId: string;
  box: BoundingBox;
  studentId: string | null;
  studentName: string;
  confidence: number;
  distance: number;
  matchType: 'recognized' | 'uncertain' | 'unknown';
  reasoning: string;
  status?: 'Present' | 'Absent' | 'Late' | 'Excused';
  auditNote?: string;
}

export interface DatabaseHealth {
  status: string;
  integrity_check: string;
  table_counts: {
    users: number;
    students: number;
    attendance_sessions: number;
    attendance: number;
  };
  database_file: string;
  sqlite_version?: string;
}

export interface SummaryStats {
  total_students: number;
  total_sessions: number;
  total_logs: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
  avg_confidence: number;
}

export interface CalendarDaySession {
  id: number;
  name: string;
  class_name: string;
}

export interface CalendarDayData {
  date: string;
  dayNumber: number;
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
  sessions: CalendarDaySession[];
  records: AttendanceRecord[];
}

export interface MonthlyCalendarResponse {
  year: number;
  month: number;
  monthName: string;
  days: Record<string, CalendarDayData>;
  summary: {
    total_days_active: number;
    total_sessions: number;
    total_records: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendance_rate: number;
  };
}

export interface YearlyMonthData {
  month: number;
  monthName: string;
  total_days_active: number;
  total_sessions: number;
  total_records: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_rate: number;
}

export interface YearlyCalendarResponse {
  year: number;
  annual_attendance_rate: number;
  total_days_active: number;
  total_sessions: number;
  total_records: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  months: YearlyMonthData[];
}
