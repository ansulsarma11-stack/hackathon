import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'attendance.sqlite');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  let SQL;
  try {
    // Locate sql-wasm.wasm in node_modules if needed
    const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
    if (fs.existsSync(wasmPath)) {
      const wasmBuffer = fs.readFileSync(wasmPath);
      const wasmBinary = wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength);
      SQL = await initSqlJs({ wasmBinary });
    } else {
      SQL = await initSqlJs();
    }
  } catch (err) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Ensure Foreign Keys and WAL pragmas
  dbInstance.run('PRAGMA foreign_keys = ON;');

  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      email TEXT,
      face_encoding TEXT,
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      session_date TEXT NOT NULL,
      session_name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      class_name TEXT NOT NULL,
      session_id INTEGER NOT NULL,
      attendance_date TEXT NOT NULL,
      attendance_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Present',
      confidence REAL DEFAULT 1.0,
      marked_by TEXT NOT NULL,
      audit_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE,
      UNIQUE(student_id, session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(attendance_date);
    CREATE INDEX IF NOT EXISTS idx_att_class ON attendance(class_name);
    CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_att_session ON attendance(session_id);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
  `);

  // Seed default admin and teacher users if missing
  const res = db.exec('SELECT COUNT(*) AS count FROM users');
  const count = res.length > 0 && res[0].values.length > 0 ? Number(res[0].values[0][0]) : 0;
  if (count === 0) {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO users (username, password_hash, full_name, role, created_at)
       VALUES 
        ('admin', 'admin123', 'System Administrator', 'admin', ?),
        ('teacher', 'teacher123', 'Prof. Eleanor Vance', 'teacher', ?)`,
      [now, now]
    );
  }

  // Seed initial sample data if students empty
  const studentRes = db.exec('SELECT COUNT(*) FROM students');
  const studentCount = studentRes.length > 0 && studentRes[0].values.length > 0 ? Number(studentRes[0].values[0][0]) : 0;
  if (studentCount === 0) {
    seedInitialData(db);
  }
}

export function seedInitialData(db: Database): void {
  const now = new Date();
  const dateToday = now.toISOString().split('T')[0];
  const isoNow = now.toISOString();

  // Clear existing if re-seeding
  db.run('DELETE FROM attendance;');
  db.run('DELETE FROM attendance_sessions;');
  db.run('DELETE FROM students;');

  const sampleStudents = [
    ['STU-1001', 'Emma Watson', 'CS101', 'emma.w@university.edu', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'],
    ['STU-1002', 'Liam Smith', 'CS101', 'liam.s@university.edu', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80'],
    ['STU-1003', 'Aaliyah Patel', 'CS101', 'aaliyah.p@university.edu', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'],
    ['STU-1004', 'Marcus Chen', 'CS101', 'marcus.c@university.edu', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'],
    ['STU-1005', 'Sophia Rodriguez', 'CS101', 'sophia.r@university.edu', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'],
    ['STU-2001', 'Noah Kim', 'DS202', 'noah.k@university.edu', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'],
    ['STU-2002', 'Olivia Martinez', 'DS202', 'olivia.m@university.edu', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80'],
    ['STU-2003', 'Ethan Becker', 'DS202', 'ethan.b@university.edu', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80'],
    ['STU-3001', 'Maya Lin', 'AI301', 'maya.l@university.edu', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80'],
    ['STU-3002', 'David Okafor', 'AI301', 'david.o@university.edu', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80'],
  ];

  for (let i = 0; i < sampleStudents.length; i++) {
    const [sId, name, cls, email, img] = sampleStudents[i];
    // Generate synthetic 128-d vector
    const vector = Array.from({ length: 128 }, (_, j) => Math.round((Math.sin(i * 10 + j) * 0.5 + 0.5) * 1000) / 1000);
    const encStr = JSON.stringify({ encoding: vector, extracted_at: isoNow });

    db.run(
      `INSERT INTO students (student_id, full_name, class_name, email, face_encoding, image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sId, name, cls, email, encStr, img, isoNow]
    );
  }

  // Sessions across the 2026 Academic Year (August - November) to populate Annual Attendance
  const sampleSessions = [
    // August 2026
    { class_name: 'CS101', date: '2026-08-24', name: 'Course Welcome & Orientation' },
    { class_name: 'CS101', date: '2026-08-27', name: 'Intro to Binary Representation' },
    { class_name: 'DS202', date: '2026-08-31', name: 'Foundations of Data Science' },
    // September 2026
    { class_name: 'CS101', date: '2026-09-03', name: 'Boolean Algebra & De Morgan Laws' },
    { class_name: 'CS101', date: '2026-09-07', name: 'Combinational Logic Circuits' },
    { class_name: 'AI301', date: '2026-09-10', name: 'History of Artificial Intelligence' },
    { class_name: 'CS101', date: '2026-09-14', name: 'Sequential Circuits & Flip-Flops' },
    { class_name: 'DS202', date: '2026-09-17', name: 'Linear Algebra for Machine Learning' },
    { class_name: 'CS101', date: '2026-09-21', name: 'Finite State Machines' },
    { class_name: 'CS101', date: '2026-09-24', name: 'Registers & Shift Operations' },
    { class_name: 'DS202', date: '2026-09-28', name: 'Data Cleaning & Feature Engineering' },
    // October 2026
    { class_name: 'CS101', date: '2026-10-01', name: 'Module 1: Computer Architecture Foundations' },
    { class_name: 'CS101', date: '2026-10-02', name: 'Lab 1: Logic Gates & Breadboard Simulation' },
    { class_name: 'CS101', date: '2026-10-05', name: 'Lecture: Arithmetic Logic Unit (ALU)' },
    { class_name: 'DS202', date: '2026-10-07', name: 'Seminar: Exploratory Data Analysis with Python' },
    { class_name: 'CS101', date: '2026-10-08', name: 'Lecture: Memory Hierarchy & Cache Mapping' },
    { class_name: 'CS101', date: '2026-10-12', name: 'Lecture: RISC-V Instruction Set Architecture' },
    { class_name: 'AI301', date: '2026-10-14', name: 'Lecture: Heuristic Search & A* Algorithm' },
    { class_name: 'CS101', date: '2026-10-15', name: 'Lab 2: Assembly Subroutines & Stack Frames' },
    { class_name: 'DS202', date: '2026-10-19', name: 'Lecture: Probability Distributions & Bayes Theorem' },
    { class_name: 'CS101', date: '2026-10-21', name: 'Midterm Review & Q&A Workshop' },
    { class_name: 'CS101', date: '2026-10-22', name: 'Lecture: Pipelining & Hazard Resolution' },
    { class_name: 'CS101', date: '2026-10-22', name: 'Afternoon Practicum: Pipeline Benchmarking' },
    // November 2026
    { class_name: 'CS101', date: '2026-11-02', name: 'Virtual Memory & Page Tables' },
    { class_name: 'DS202', date: '2026-11-05', name: 'Supervised Learning & Decision Trees' },
    { class_name: 'AI301', date: '2026-11-09', name: 'Neural Networks Fundamentals' },
    { class_name: 'CS101', date: '2026-11-12', name: 'I/O Interfacing & Interrupt Handlers' },
  ];

  for (let sIdx = 0; sIdx < sampleSessions.length; sIdx++) {
    const s = sampleSessions[sIdx];
    db.run(
      `INSERT INTO attendance_sessions (class_name, session_date, session_name, created_by, created_at)
       VALUES (?, ?, ?, 'Prof. Eleanor Vance', ?)`,
      [s.class_name, s.date, s.name, isoNow]
    );

    const sessId = sIdx + 1;
    // Relevant students for this class
    const classStudents = sampleStudents.filter((stu) => stu[2] === s.class_name);

    for (let cIdx = 0; cIdx < classStudents.length; cIdx++) {
      const studentId = classStudents[cIdx][0];
      // Generate realistic status variation
      let status: 'Present' | 'Late' | 'Absent' | 'Excused' = 'Present';
      let confidence = 0.94 + ((cIdx * 7 + sIdx * 3) % 6) * 0.01;
      let auditNote = 'Automated biometric match';

      if ((sIdx + cIdx) % 11 === 0) {
        status = 'Late';
        confidence = 0.89;
        auditNote = 'Arrived 10 mins post roll-call';
      } else if ((sIdx * 3 + cIdx) % 13 === 0) {
        status = 'Absent';
        confidence = 0.0;
        auditNote = 'Unexcused absence - not detected in classroom scan';
      } else if ((sIdx + cIdx) % 17 === 0) {
        status = 'Excused';
        confidence = 0.0;
        auditNote = 'Athletics department excuse on file';
      }

      const timeStr = `09:${10 + (cIdx * 2)}:15`;
      db.run(
        `INSERT INTO attendance 
          (student_id, class_name, session_id, attendance_date, attendance_time, status, confidence, marked_by, audit_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Prof. Eleanor Vance', ?, ?)`,
        [studentId, s.class_name, sessId, s.date, timeStr, status, confidence, auditNote, isoNow]
      );
    }
  }
}

// Helper to convert sql.js exec result to array of objects
function formatExecResult(res: any[]): any[] {
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, idx: number) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// ----------------------------------------------------------------------------
// Database API methods
// ----------------------------------------------------------------------------

export async function checkDbHealth(): Promise<any> {
  const db = await getDb();
  const integrityRes = db.exec('PRAGMA integrity_check;');
  const integrity = integrityRes[0]?.values[0]?.[0] || 'unknown';

  const tables = ['users', 'students', 'attendance_sessions', 'attendance'];
  const counts: Record<string, number> = {};

  for (const tbl of tables) {
    const r = db.exec(`SELECT COUNT(*) FROM ${tbl}`);
    counts[tbl] = Number(r[0]?.values[0]?.[0] || 0);
  }

  const verRes = db.exec('SELECT sqlite_version();');
  const sqliteVer = verRes[0]?.values[0]?.[0] || '3.x';

  return {
    status: integrity === 'ok' ? 'ok' : 'error',
    integrity_check: integrity,
    table_counts: counts,
    database_file: DB_FILE,
    sqlite_version: String(sqliteVer),
  };
}

export async function getStudents(className?: string): Promise<any[]> {
  const db = await getDb();
  if (className && className !== 'all' && className !== '*') {
    const stmt = db.prepare('SELECT * FROM students WHERE class_name = ? ORDER BY full_name ASC');
    stmt.bind([className]);
    const list: any[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  } else {
    const res = db.exec('SELECT * FROM students ORDER BY class_name ASC, full_name ASC');
    return formatExecResult(res);
  }
}

export async function getStudentById(studentId: string): Promise<any | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM students WHERE student_id = ?');
  stmt.bind([studentId.trim()]);
  let result: any = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export async function addStudent(data: {
  student_id: string;
  full_name: string;
  class_name: string;
  email?: string;
  face_encoding: any;
  image_path: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  let encodingJson = '';
  if (typeof data.face_encoding === 'string') {
    encodingJson = data.face_encoding;
  } else if (Array.isArray(data.face_encoding)) {
    encodingJson = JSON.stringify({ encoding: data.face_encoding, extracted_at: now });
  } else {
    encodingJson = JSON.stringify(data.face_encoding || { encoding: [], extracted_at: now });
  }

  try {
    db.run(
      `INSERT INTO students (student_id, full_name, class_name, email, face_encoding, image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.student_id.trim(), data.full_name.trim(), data.class_name.trim(), data.email?.trim() || null, encodingJson, data.image_path, now]
    );
    saveDb();
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Student ID "${data.student_id}" is already registered.`);
    }
    throw err;
  }
}

export async function deleteStudent(identifier: string | number): Promise<boolean> {
  const db = await getDb();
  const idStr = String(identifier).trim();

  // Find the student_id first if numeric id was passed
  let studentId = idStr;
  const num = Number(idStr);
  if (!isNaN(num) && !idStr.startsWith('STU-') && !idStr.startsWith('stu-')) {
    const findRes = db.exec(`SELECT student_id FROM students WHERE id = ${num}`);
    if (findRes.length > 0 && findRes[0].values.length > 0) {
      studentId = String(findRes[0].values[0][0]);
    }
  }

  // Delete from both attendance and students to guarantee consistency
  db.run('DELETE FROM attendance WHERE student_id = ?', [studentId]);
  db.run('DELETE FROM students WHERE student_id = ? OR id = ?', [studentId, num || -1]);
  saveDb();
  return true;
}

export async function getSessions(className?: string, date?: string): Promise<any[]> {
  const db = await getDb();
  let query = `
    SELECT 
      s.*,
      COUNT(a.id) AS total_records,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) AS excused_count
    FROM attendance_sessions s
    LEFT JOIN attendance a ON s.id = a.session_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (className && className !== 'all' && className !== '*') {
    query += ' AND s.class_name = ?';
    params.push(className);
  }
  if (date) {
    query += ' AND s.session_date = ?';
    params.push(date);
  }
  query += ' GROUP BY s.id ORDER BY s.session_date DESC, s.id DESC';

  const stmt = db.prepare(query);
  stmt.bind(params);
  const list: any[] = [];
  while (stmt.step()) {
    list.push(stmt.getAsObject());
  }
  stmt.free();
  return list;
}

export async function getSessionById(sessionId: number): Promise<any | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?');
  stmt.bind([sessionId]);
  let result: any = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export async function createSession(data: {
  class_name: string;
  session_date: string;
  session_name: string;
  created_by: string;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO attendance_sessions (class_name, session_date, session_name, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [data.class_name.trim(), data.session_date.trim(), data.session_name.trim(), data.created_by.trim(), now]
  );

  const res = db.exec('SELECT last_insert_rowid() AS id');
  const sessionId = Number(res[0]?.values[0]?.[0] || 0);
  saveDb();
  return sessionId;
}

export async function deleteSession(sessionId: number): Promise<boolean> {
  const db = await getDb();
  db.run('DELETE FROM attendance_sessions WHERE id = ?', [sessionId]);
  saveDb();
  return true;
}

export async function recordAttendanceBatch(
  sessionId: number,
  className: string,
  records: any[],
  markedBy: string = 'Teacher'
): Promise<{ inserted: number; updated: number }> {
  const db = await getDb();

  // Validate session exists
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} does not exist.`);
  }

  const sessionDate = session.session_date;
  const targetClass = className || session.class_name;
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const nowIso = now.toISOString();

  let insertedCount = 0;

  for (const rec of records) {
    const studentId = (rec.studentId || rec.student_id || '').toString().trim();
    if (!studentId) continue;

    const status = rec.status || 'Present';
    const confidence = typeof rec.confidence === 'number' ? rec.confidence : 1.0;
    const auditNote = rec.auditNote || rec.audit_note || 'Automated biometric match';
    const recDate = rec.date || sessionDate;

    // Use SQLite ON CONFLICT to upsert atomically and prevent duplicate violations
    db.run(
      `INSERT INTO attendance 
        (student_id, class_name, session_id, attendance_date, attendance_time, status, confidence, marked_by, audit_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, session_id) DO UPDATE SET
        status = excluded.status,
        confidence = excluded.confidence,
        marked_by = excluded.marked_by,
        audit_note = excluded.audit_note,
        attendance_time = excluded.attendance_time,
        updated_at = excluded.updated_at`,
      [studentId, targetClass, sessionId, recDate, timeStr, status, confidence, markedBy, auditNote, nowIso, nowIso]
    );
    insertedCount++;
  }

  saveDb();
  return { inserted: insertedCount, updated: 0 };
}

export async function getAttendanceRecords(filter: {
  sessionId?: number;
  className?: string;
  date?: string;
  studentId?: string;
}): Promise<any[]> {
  const db = await getDb();
  let query = `
    SELECT 
      a.id,
      a.student_id,
      COALESCE(s.full_name, a.student_id) AS student_name,
      s.email AS student_email,
      a.class_name,
      a.session_id,
      sess.session_name,
      a.attendance_date,
      a.attendance_time,
      a.status,
      a.confidence,
      a.marked_by,
      a.audit_note,
      a.created_at,
      a.updated_at
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    LEFT JOIN attendance_sessions sess ON a.session_id = sess.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filter.sessionId) {
    query += ' AND a.session_id = ?';
    params.push(filter.sessionId);
  }
  if (filter.className && filter.className !== 'all' && filter.className !== '*') {
    query += ' AND a.class_name = ?';
    params.push(filter.className);
  }
  if (filter.date) {
    query += ' AND a.attendance_date = ?';
    params.push(filter.date);
  }
  if (filter.studentId) {
    query += ' AND a.student_id = ?';
    params.push(filter.studentId);
  }
  query += ' ORDER BY a.attendance_date DESC, a.attendance_time DESC, a.id DESC';

  const stmt = db.prepare(query);
  stmt.bind(params);
  const list: any[] = [];
  while (stmt.step()) {
    list.push(stmt.getAsObject());
  }
  stmt.free();
  return list;
}

export async function updateAttendanceStatus(
  recordId: number,
  status: string,
  auditNote: string,
  markedBy: string
): Promise<boolean> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  db.run(
    `UPDATE attendance 
     SET status = ?, audit_note = ?, marked_by = ?, updated_at = ?
     WHERE id = ?`,
    [status, auditNote, markedBy, nowIso, recordId]
  );
  saveDb();
  return true;
}

export async function deleteAttendanceRecord(recordId: number): Promise<boolean> {
  const db = await getDb();
  db.run('DELETE FROM attendance WHERE id = ?', [recordId]);
  saveDb();
  return true;
}

export async function getAttendanceSummary(className?: string): Promise<any> {
  const db = await getDb();
  let studentCount = 0;
  let sessionCount = 0;
  let stats: any = {};

  if (className && className !== 'all' && className !== '*') {
    const sRes = db.exec(`SELECT COUNT(*) FROM students WHERE class_name = '${className}'`);
    studentCount = Number(sRes[0]?.values[0]?.[0] || 0);

    const sessRes = db.exec(`SELECT COUNT(*) FROM attendance_sessions WHERE class_name = '${className}'`);
    sessionCount = Number(sessRes[0]?.values[0]?.[0] || 0);

    const attRes = db.exec(`
      SELECT 
        COUNT(*) AS total_logs,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
        AVG(confidence) AS avg_confidence
      FROM attendance
      WHERE class_name = '${className}'
    `);
    stats = formatExecResult(attRes)[0] || {};
  } else {
    const sRes = db.exec('SELECT COUNT(*) FROM students');
    studentCount = Number(sRes[0]?.values[0]?.[0] || 0);

    const sessRes = db.exec('SELECT COUNT(*) FROM attendance_sessions');
    sessionCount = Number(sessRes[0]?.values[0]?.[0] || 0);

    const attRes = db.exec(`
      SELECT 
        COUNT(*) AS total_logs,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
        AVG(confidence) AS avg_confidence
      FROM attendance
    `);
    stats = formatExecResult(attRes)[0] || {};
  }

  const totalLogs = Number(stats.total_logs || 0);
  const present = Number(stats.present || 0);
  const absent = Number(stats.absent || 0);
  const late = Number(stats.late || 0);
  const excused = Number(stats.excused || 0);
  const avgConf = Math.round(Number(stats.avg_confidence || 1.0) * 100) / 100;
  const rate = totalLogs > 0 ? Math.round((present / totalLogs) * 1000) / 10 : 0;

  return {
    total_students: studentCount,
    total_sessions: sessionCount,
    total_logs: totalLogs,
    present,
    absent,
    late,
    excused,
    attendance_rate: rate,
    avg_confidence: avgConf,
  };
}

export async function runRawQuery(sql: string): Promise<{ columns: string[]; rows: any[]; rowCount: number }> {
  const db = await getDb();
  const startTime = Date.now();
  const res = db.exec(sql);
  saveDb();

  if (!res || res.length === 0) {
    return { columns: [], rows: [], rowCount: 0 };
  }

  const columns = res[0].columns;
  const rows = res[0].values.map((r: any[]) => {
    const obj: any = {};
    columns.forEach((c: string, i: number) => {
      obj[c] = r[i];
    });
    return obj;
  });

  return {
    columns,
    rows,
    rowCount: rows.length,
  };
}

export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  seedInitialData(db);
  saveDb();
}

export async function getMonthlyAttendance(params: {
  year: number;
  month: number;
  className?: string;
  studentId?: string;
}): Promise<any> {
  const db = await getDb();
  const year = Number(params.year) || new Date().getFullYear();
  const month = Number(params.month) || (new Date().getMonth() + 1);

  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const monthPrefix = `${year}-${monthStr}-%`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1] || `Month ${month}`;

  // Query records
  let recQuery = `
    SELECT 
      a.id,
      a.student_id,
      COALESCE(s.full_name, a.student_id) AS student_name,
      s.email AS student_email,
      a.class_name,
      a.session_id,
      sess.session_name,
      a.attendance_date,
      a.attendance_time,
      a.status,
      a.confidence,
      a.marked_by,
      a.audit_note,
      a.created_at,
      a.updated_at
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    LEFT JOIN attendance_sessions sess ON a.session_id = sess.id
    WHERE a.attendance_date LIKE ?
  `;
  const recParams: any[] = [monthPrefix];

  if (params.className && params.className !== 'all' && params.className !== '*') {
    recQuery += ' AND a.class_name = ?';
    recParams.push(params.className);
  }
  if (params.studentId && params.studentId !== 'all') {
    recQuery += ' AND a.student_id = ?';
    recParams.push(params.studentId);
  }
  recQuery += ' ORDER BY a.attendance_date ASC, a.attendance_time ASC';

  const stmt = db.prepare(recQuery);
  stmt.bind(recParams);
  const allRecords: any[] = [];
  while (stmt.step()) {
    allRecords.push(stmt.getAsObject());
  }
  stmt.free();

  // Query sessions in this month
  let sessQuery = `
    SELECT id, session_name, class_name, session_date
    FROM attendance_sessions
    WHERE session_date LIKE ?
  `;
  const sessParams: any[] = [monthPrefix];
  if (params.className && params.className !== 'all' && params.className !== '*') {
    sessQuery += ' AND class_name = ?';
    sessParams.push(params.className);
  }
  sessQuery += ' ORDER BY session_date ASC, id ASC';

  const sessStmt = db.prepare(sessQuery);
  sessStmt.bind(sessParams);
  const allSessions: any[] = [];
  while (sessStmt.step()) {
    allSessions.push(sessStmt.getAsObject());
  }
  sessStmt.free();

  // Aggregate by date (day)
  const days: Record<string, any> = {};

  // First group sessions by date
  for (const s of allSessions) {
    const dStr = s.session_date;
    if (!days[dStr]) {
      const parts = dStr.split('-');
      const dayNum = parseInt(parts[2], 10);
      days[dStr] = {
        date: dStr,
        dayNumber: dayNum,
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        rate: 0,
        sessions: [],
        records: []
      };
    }
    days[dStr].sessions.push({
      id: s.id,
      name: s.session_name,
      class_name: s.class_name,
    });
  }

  // Then group attendance records by date
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalExcused = 0;

  for (const r of allRecords) {
    const dStr = r.attendance_date;
    if (!days[dStr]) {
      const parts = dStr.split('-');
      const dayNum = parseInt(parts[2], 10);
      days[dStr] = {
        date: dStr,
        dayNumber: dayNum,
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        rate: 0,
        sessions: [],
        records: []
      };
    }

    days[dStr].records.push(r);
    days[dStr].total += 1;

    if (r.status === 'Present') {
      days[dStr].present += 1;
      totalPresent += 1;
    } else if (r.status === 'Late') {
      days[dStr].late += 1;
      totalLate += 1;
    } else if (r.status === 'Absent') {
      days[dStr].absent += 1;
      totalAbsent += 1;
    } else if (r.status === 'Excused') {
      days[dStr].excused += 1;
      totalExcused += 1;
    }
  }

  // Compute daily rates
  for (const dStr of Object.keys(days)) {
    const d = days[dStr];
    d.rate = d.total > 0 ? Math.round((d.present / d.total) * 1000) / 10 : 0;
  }

  const totalRecords = allRecords.length;
  const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 1000) / 10 : 0;

  return {
    year,
    month,
    monthName,
    days,
    summary: {
      total_days_active: Object.keys(days).length,
      total_sessions: allSessions.length,
      total_records: totalRecords,
      present: totalPresent,
      late: totalLate,
      absent: totalAbsent,
      excused: totalExcused,
      attendance_rate: overallRate,
    }
  };
}

export async function getYearlyAttendance(params: {
  year: number;
  className?: string;
  studentId?: string;
}): Promise<any> {
  const db = await getDb();
  const year = Number(params.year) || 2026;
  const yearPrefix = `${year}-%`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Query records for the entire year
  let recQuery = `
    SELECT 
      a.id,
      a.student_id,
      COALESCE(s.full_name, a.student_id) AS student_name,
      a.class_name,
      a.session_id,
      a.attendance_date,
      a.status,
      SUBSTR(a.attendance_date, 6, 2) AS month_str
    FROM attendance a
    LEFT JOIN students s ON a.student_id = s.student_id
    WHERE a.attendance_date LIKE ?
  `;
  const recParams: any[] = [yearPrefix];

  if (params.className && params.className !== 'all' && params.className !== '*') {
    recQuery += ' AND a.class_name = ?';
    recParams.push(params.className);
  }
  if (params.studentId && params.studentId !== 'all') {
    recQuery += ' AND a.student_id = ?';
    recParams.push(params.studentId);
  }
  recQuery += ' ORDER BY a.attendance_date ASC';

  const stmt = db.prepare(recQuery);
  stmt.bind(recParams);
  const allRecords: any[] = [];
  while (stmt.step()) {
    allRecords.push(stmt.getAsObject());
  }
  stmt.free();

  // Query sessions for the entire year
  let sessQuery = `
    SELECT id, session_name, class_name, session_date, SUBSTR(session_date, 6, 2) AS month_str
    FROM attendance_sessions
    WHERE session_date LIKE ?
  `;
  const sessParams: any[] = [yearPrefix];
  if (params.className && params.className !== 'all' && params.className !== '*') {
    sessQuery += ' AND class_name = ?';
    sessParams.push(params.className);
  }
  sessQuery += ' ORDER BY session_date ASC';

  const sessStmt = db.prepare(sessQuery);
  sessStmt.bind(sessParams);
  const allSessions: any[] = [];
  while (sessStmt.step()) {
    allSessions.push(sessStmt.getAsObject());
  }
  sessStmt.free();

  // Initialize all 12 months (1 to 12)
  const monthDataMap: Record<number, any> = {};
  for (let m = 1; m <= 12; m++) {
    monthDataMap[m] = {
      month: m,
      monthName: monthNames[m - 1],
      total_days_active: 0,
      total_sessions: 0,
      total_records: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      attendance_rate: 0,
      datesSet: new Set<string>(),
    };
  }

  for (const s of allSessions) {
    const m = parseInt(s.month_str, 10);
    if (monthDataMap[m]) {
      monthDataMap[m].total_sessions += 1;
      monthDataMap[m].datesSet.add(s.session_date);
    }
  }

  let totalYearPresent = 0;
  let totalYearLate = 0;
  let totalYearAbsent = 0;
  let totalYearExcused = 0;
  const yearDatesSet = new Set<string>();

  for (const r of allRecords) {
    const m = parseInt(r.month_str, 10);
    if (monthDataMap[m]) {
      monthDataMap[m].total_records += 1;
      monthDataMap[m].datesSet.add(r.attendance_date);
      yearDatesSet.add(r.attendance_date);

      if (r.status === 'Present') {
        monthDataMap[m].present += 1;
        totalYearPresent += 1;
      } else if (r.status === 'Late') {
        monthDataMap[m].late += 1;
        totalYearLate += 1;
      } else if (r.status === 'Absent') {
        monthDataMap[m].absent += 1;
        totalYearAbsent += 1;
      } else if (r.status === 'Excused') {
        monthDataMap[m].excused += 1;
        totalYearExcused += 1;
      }
    }
  }

  // Calculate percentage rates
  const monthsList = [];
  for (let m = 1; m <= 12; m++) {
    const mObj = monthDataMap[m];
    mObj.total_days_active = mObj.datesSet.size;
    mObj.attendance_rate = mObj.total_records > 0
      ? Math.round((mObj.present / mObj.total_records) * 1000) / 10
      : 0;
    delete mObj.datesSet;
    monthsList.push(mObj);
  }

  const totalYearRecords = allRecords.length;
  const annualRate = totalYearRecords > 0
    ? Math.round((totalYearPresent / totalYearRecords) * 1000) / 10
    : 0;

  return {
    year,
    annual_attendance_rate: annualRate,
    total_days_active: yearDatesSet.size,
    total_sessions: allSessions.length,
    total_records: totalYearRecords,
    present: totalYearPresent,
    late: totalYearLate,
    absent: totalYearAbsent,
    excused: totalYearExcused,
    months: monthsList,
  };
}

