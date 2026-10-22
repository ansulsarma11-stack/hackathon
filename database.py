"""
Database layer for SQLite storage of students, users, attendance sessions, and attendance logs.
Features ACID transactions, integrity checks, cascading deletes, analytical reporting, and Pandas export.
"""

import sqlite3
import json
import os
import hashlib
from datetime import datetime
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Tuple

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

DB_FILE = os.environ.get(
    "SQLITE_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "attendance.sqlite"),
)


def get_db_connection() -> sqlite3.Connection:
    """
    Creates a new SQLite connection with foreign keys and WAL mode enabled.
    """
    conn = sqlite3.connect(DB_FILE, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def get_db():
    """Context manager for safe connection opening, automatic closing, and error rollback."""
    conn = get_db_connection()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def hash_password(password: str) -> str:
    """Returns SHA-256 hash with salt for secure storage."""
    salt = "vision_attend_salt_2026"
    return hashlib.sha256(f"{salt}_{password}".encode()).hexdigest()


def init_db():
    """
    Initializes database tables, creates performance indexes, and seeds initial users if not present.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'teacher',
            created_at TEXT NOT NULL
        );
        """)

        # Students Table
        cursor.execute("""
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
        """)

        # Attendance Sessions Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT NOT NULL,
            session_date TEXT NOT NULL,
            session_name TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)

        # Attendance Records Table with cascading foreign keys
        cursor.execute("""
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
        """)

        # Performance Indexes for rapid multi-class queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(attendance_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_class ON attendance(class_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_session ON attendance(session_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sess_class_date ON attendance_sessions(class_name, session_date);")

        # Seed default administrative and teacher accounts if users table is empty
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            now = datetime.now().isoformat()
            cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, created_at)
            VALUES 
                ('admin', ?, 'System Administrator', 'admin', ?),
                ('teacher', ?, 'Prof. Eleanor Vance', 'teacher', ?)
            """, (hash_password('admin123'), now, hash_password('teacher123'), now))

        conn.commit()


def check_db_health() -> Dict[str, Any]:
    """Runs PRAGMA integrity_check and counts rows in all tables."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        integrity = cursor.fetchone()[0]

        counts = {}
        for table in ["users", "students", "attendance_sessions", "attendance"]:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]

        return {
            "status": "ok" if integrity == "ok" else "error",
            "integrity_check": integrity,
            "table_counts": counts,
            "database_file": DB_FILE,
            "sqlite_version": sqlite3.sqlite_version
        }


# ============================================================================
# STUDENT MANAGEMENT
# ============================================================================

def add_student(student_id: str, full_name: str, class_name: str, email: str, face_encoding: Any, image_path: str):
    """
    Registers a new student profile and stores their biometric facial encoding vector.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Handle face_encoding format (list, dict, or json string)
        if isinstance(face_encoding, str):
            try:
                parsed = json.loads(face_encoding)
                enc_data = parsed
            except Exception:
                enc_data = {"raw": face_encoding}
            encoding_json = json.dumps(enc_data)
        elif isinstance(face_encoding, list):
            encoding_json = json.dumps({"encoding": face_encoding, "extracted_at": now})
        elif isinstance(face_encoding, dict):
            encoding_json = json.dumps(face_encoding)
        else:
            encoding_json = json.dumps({"encoding": [], "extracted_at": now})

        try:
            cursor.execute("""
            INSERT INTO students (student_id, full_name, class_name, email, face_encoding, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (student_id.strip(), full_name.strip(), class_name.strip(), email.strip() if email else None, encoding_json, image_path, now))
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f'Student ID "{student_id}" is already registered.')


def get_students_by_class(class_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns list of students filtered by class name or all if not specified."""
    with get_db() as conn:
        cursor = conn.cursor()
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            cursor.execute("SELECT * FROM students WHERE class_name = ? ORDER BY full_name ASC", (class_name.strip(),))
        else:
            cursor.execute("SELECT * FROM students ORDER BY class_name ASC, full_name ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_student_by_id(student_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single student by their unique student_id."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM students WHERE student_id = ?", (student_id.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_student(student_id: str, full_name: str, class_name: str, email: Optional[str] = None) -> bool:
    """Updates an existing student's name, class, or email."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute("""
        UPDATE students
        SET full_name = ?, class_name = ?, email = ?, updated_at = ?
        WHERE student_id = ?
        """, (full_name.strip(), class_name.strip(), email.strip() if email else None, now, student_id.strip()))
        conn.commit()
        return cursor.rowcount > 0


def delete_student(student_id: str) -> bool:
    """Deletes a student and cascades deletion to their attendance history."""
    with get_db() as conn:
        cursor = conn.cursor()
        clean_id = str(student_id).strip()
        # Find actual student_id if numeric id was provided
        cursor.execute("SELECT student_id FROM students WHERE student_id = ? OR id = ?", (clean_id, int(clean_id) if clean_id.isdigit() else -1))
        row = cursor.fetchone()
        actual_id = row["student_id"] if row else clean_id

        # Delete from attendance and students
        cursor.execute("DELETE FROM attendance WHERE student_id = ?", (actual_id,))
        cursor.execute("DELETE FROM students WHERE student_id = ? OR id = ?", (actual_id, int(clean_id) if clean_id.isdigit() else -1))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def create_session(class_name: str, session_date: str, session_name: str, created_by: str) -> int:
    """Creates a new attendance session and returns its auto-generated ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute("""
        INSERT INTO attendance_sessions (class_name, session_date, session_name, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (class_name.strip(), session_date.strip(), session_name.strip(), created_by.strip(), now))
        session_id = cursor.lastrowid
        conn.commit()
        return session_id


def get_sessions(class_name: Optional[str] = None, date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves sessions with attendee count metrics."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
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
        """
        params = []
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            query += " AND s.class_name = ?"
            params.append(class_name.strip())
        if date:
            query += " AND s.session_date = ?"
            params.append(date.strip())

        query += " GROUP BY s.id ORDER BY s.session_date DESC, s.id DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_session_by_id(session_id: int) -> Optional[Dict[str, Any]]:
    """Fetches details for a specific session by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attendance_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_session(session_id: int) -> bool:
    """Deletes an attendance session and cascades deletion of attendance records."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attendance_sessions WHERE id = ?", (session_id,))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# ATTENDANCE RECORDING & BATCH COMMITS
# ============================================================================

def record_attendance_batch(
    session_id: int,
    class_name: str,
    records: List[Dict[str, Any]],
    marked_by: str = "Teacher"
) -> Tuple[int, int]:
    """
    Validates session existence and commits attendance batch using atomic upsert (INSERT ... ON CONFLICT).
    Prevents duplicate entries and ensures foreign key integrity.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Step 1: Validate session exists and retrieve session date
        cursor.execute("SELECT id, session_date, class_name FROM attendance_sessions WHERE id = ?", (session_id,))
        session = cursor.fetchone()
        if not session:
            raise sqlite3.IntegrityError(f"Session {session_id} does not exist.")

        session_date = session["session_date"]
        target_class = class_name or session["class_name"]

        now = datetime.now()
        time_str = now.strftime("%H:%M:%S")
        now_iso = now.isoformat()

        inserted = 0
        updated = 0

        for rec in records:
            student_id = rec.get("studentId") or rec.get("student_id")
            if not student_id:
                continue

            student_id = str(student_id).strip()
            status = rec.get("status", "Present")
            confidence = float(rec.get("confidence", 1.0))
            audit_note = rec.get("auditNote") or rec.get("audit_note") or "Automated biometric match"
            rec_date = rec.get("date") or session_date

            # Upsert using SQLite ON CONFLICT
            cursor.execute("""
            INSERT INTO attendance 
                (student_id, class_name, session_id, attendance_date, attendance_time, status, confidence, marked_by, audit_note, created_at, updated_at)
            VALUES 
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, session_id) DO UPDATE SET
                status = excluded.status,
                confidence = excluded.confidence,
                marked_by = excluded.marked_by,
                audit_note = excluded.audit_note,
                attendance_time = excluded.attendance_time,
                updated_at = excluded.updated_at
            """, (student_id, target_class, session_id, rec_date, time_str, status, confidence, marked_by, audit_note, now_iso, now_iso))

            # In SQLite, changes() is 1 for insert or update
            # We determine insert vs update by checking if row existed before
            if cursor.rowcount > 0:
                inserted += 1

        conn.commit()
        return inserted, updated


def get_attendance_records(
    session_id: Optional[int] = None,
    class_name: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns rich attendance records joined with student and session details.
    Uses LEFT JOIN so records remain intact even if a student profile is missing or altered.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
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
        """
        params = []
        if session_id is not None:
            query += " AND a.session_id = ?"
            params.append(session_id)
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            query += " AND a.class_name = ?"
            params.append(class_name.strip())
        if date:
            query += " AND a.attendance_date = ?"
            params.append(date.strip())
        if student_id:
            query += " AND a.student_id = ?"
            params.append(student_id.strip())

        query += " ORDER BY a.attendance_date DESC, a.attendance_time DESC, a.id DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def update_attendance_status(record_id: int, status: str, audit_note: str, marked_by: str) -> bool:
    """Updates the status and audit log of an existing attendance entry."""
    with get_db() as conn:
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        cursor.execute("""
        UPDATE attendance
        SET status = ?, audit_note = ?, marked_by = ?, updated_at = ?
        WHERE id = ?
        """, (status, audit_note, marked_by, now_iso, record_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_attendance_record(record_id: int) -> bool:
    """Removes a single attendance log entry."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attendance WHERE id = ?", (record_id,))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# ANALYTICS & EXPORT
# ============================================================================

def get_attendance_summary(class_name: Optional[str] = None) -> Dict[str, Any]:
    """Computes high-level analytics: total students, sessions, rates, and status distribution."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Total enrolled students
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            cursor.execute("SELECT COUNT(*) FROM students WHERE class_name = ?", (class_name.strip(),))
            total_students = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM attendance_sessions WHERE class_name = ?", (class_name.strip(),))
            total_sessions = cursor.fetchone()[0]

            cursor.execute("""
            SELECT 
                COUNT(*) AS total_logs,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
                AVG(confidence) AS avg_confidence
            FROM attendance
            WHERE class_name = ?
            """, (class_name.strip(),))
        else:
            cursor.execute("SELECT COUNT(*) FROM students")
            total_students = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM attendance_sessions")
            total_sessions = cursor.fetchone()[0]

            cursor.execute("""
            SELECT 
                COUNT(*) AS total_logs,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
                AVG(confidence) AS avg_confidence
            FROM attendance
            """)

        stat_row = cursor.fetchone()
        total_logs = stat_row[0] or 0
        present = stat_row[1] or 0
        absent = stat_row[2] or 0
        late = stat_row[3] or 0
        excused = stat_row[4] or 0
        avg_confidence = round(stat_row[5] or 1.0, 3)

        attendance_rate = round((present / total_logs * 100), 1) if total_logs > 0 else 0.0

        return {
            "total_students": total_students,
            "total_sessions": total_sessions,
            "total_logs": total_logs,
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "attendance_rate": attendance_rate,
            "avg_confidence": avg_confidence
        }


def get_monthly_attendance(year: int, month: int, class_name: Optional[str] = None, student_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes daily aggregated calendar metrics and overall rate for a specified month.
    """
    month_str = f"{month:02d}"
    month_prefix = f"{year}-{month_str}-%"
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    month_name = month_names[month - 1] if 1 <= month <= 12 else f"Month {month}"

    with get_db() as conn:
        cursor = conn.cursor()

        # Query records for month
        rec_query = """
        SELECT 
            a.id, a.student_id, COALESCE(s.full_name, a.student_id) AS student_name,
            s.email AS student_email, a.class_name, a.session_id, sess.session_name,
            a.attendance_date, a.attendance_time, a.status, a.confidence, a.marked_by,
            a.audit_note
        FROM attendance a
        LEFT JOIN students s ON a.student_id = s.student_id
        LEFT JOIN attendance_sessions sess ON a.session_id = sess.id
        WHERE a.attendance_date LIKE ?
        """
        rec_params = [month_prefix]
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            rec_query += " AND a.class_name = ?"
            rec_params.append(class_name.strip())
        if student_id and student_id.strip().lower() not in ("all", ""):
            rec_query += " AND a.student_id = ?"
            rec_params.append(student_id.strip())

        rec_query += " ORDER BY a.attendance_date ASC, a.attendance_time ASC"
        cursor.execute(rec_query, rec_params)
        all_records = [dict(r) for r in cursor.fetchall()]

        # Query sessions in month
        sess_query = "SELECT id, session_name, class_name, session_date FROM attendance_sessions WHERE session_date LIKE ?"
        sess_params = [month_prefix]
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            sess_query += " AND class_name = ?"
            sess_params.append(class_name.strip())
        sess_query += " ORDER BY session_date ASC, id ASC"

        cursor.execute(sess_query, sess_params)
        all_sessions = [dict(s) for s in cursor.fetchall()]

        days = {}
        for s in all_sessions:
            d_str = s["session_date"]
            if d_str not in days:
                day_num = int(d_str.split("-")[2])
                days[d_str] = {
                    "date": d_str,
                    "dayNumber": day_num,
                    "total": 0,
                    "present": 0,
                    "late": 0,
                    "absent": 0,
                    "excused": 0,
                    "rate": 0.0,
                    "sessions": [],
                    "records": []
                }
            days[d_str]["sessions"].append({
                "id": s["id"],
                "name": s["session_name"],
                "class_name": s["class_name"]
            })

        total_present = 0
        total_late = 0
        total_absent = 0
        total_excused = 0

        for r in all_records:
            d_str = r["attendance_date"]
            if d_str not in days:
                day_num = int(d_str.split("-")[2])
                days[d_str] = {
                    "date": d_str,
                    "dayNumber": day_num,
                    "total": 0,
                    "present": 0,
                    "late": 0,
                    "absent": 0,
                    "excused": 0,
                    "rate": 0.0,
                    "sessions": [],
                    "records": []
                }

            days[d_str]["records"].append(r)
            days[d_str]["total"] += 1

            status = r.get("status")
            if status == "Present":
                days[d_str]["present"] += 1
                total_present += 1
            elif status == "Late":
                days[d_str]["late"] += 1
                total_late += 1
            elif status == "Absent":
                days[d_str]["absent"] += 1
                total_absent += 1
            elif status == "Excused":
                days[d_str]["excused"] += 1
                total_excused += 1

        for d_str, d in days.items():
            d["rate"] = round((d["present"] / d["total"] * 100), 1) if d["total"] > 0 else 0.0

        total_records = len(all_records)
        overall_rate = round((total_present / total_records * 100), 1) if total_records > 0 else 0.0

        return {
            "year": year,
            "month": month,
            "monthName": month_name,
            "days": days,
            "summary": {
                "total_days_active": len(days),
                "total_sessions": len(all_sessions),
                "total_records": total_records,
                "present": total_present,
                "late": total_late,
                "absent": total_absent,
                "excused": total_excused,
                "attendance_rate": overall_rate
            }
        }


def get_yearly_attendance(year: int, class_name: Optional[str] = None, student_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes annual overall attendance percentage and individual 12-month percentage trends.
    """
    year_prefix = f"{year}-%"
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    with get_db() as conn:
        cursor = conn.cursor()

        rec_query = """
        SELECT 
            a.id, a.student_id, a.class_name, a.session_id, a.attendance_date, a.status,
            SUBSTR(a.attendance_date, 6, 2) AS month_str
        FROM attendance a
        WHERE a.attendance_date LIKE ?
        """
        rec_params = [year_prefix]
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            rec_query += " AND a.class_name = ?"
            rec_params.append(class_name.strip())
        if student_id and student_id.strip().lower() not in ("all", ""):
            rec_query += " AND a.student_id = ?"
            rec_params.append(student_id.strip())

        rec_query += " ORDER BY a.attendance_date ASC"
        cursor.execute(rec_query, rec_params)
        all_records = [dict(r) for r in cursor.fetchall()]

        sess_query = """
        SELECT id, session_name, class_name, session_date, SUBSTR(session_date, 6, 2) AS month_str
        FROM attendance_sessions
        WHERE session_date LIKE ?
        """
        sess_params = [year_prefix]
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            sess_query += " AND class_name = ?"
            sess_params.append(class_name.strip())
        sess_query += " ORDER BY session_date ASC"
        cursor.execute(sess_query, sess_params)
        all_sessions = [dict(s) for s in cursor.fetchall()]

        months_map = {}
        for m in range(1, 13):
            months_map[m] = {
                "month": m,
                "monthName": month_names[m - 1],
                "total_days_active": 0,
                "total_sessions": 0,
                "total_records": 0,
                "present": 0,
                "late": 0,
                "absent": 0,
                "excused": 0,
                "attendance_rate": 0.0,
                "dates_set": set()
            }

        for s in all_sessions:
            m = int(s["month_str"])
            if m in months_map:
                months_map[m]["total_sessions"] += 1
                months_map[m]["dates_set"].add(s["session_date"])

        total_year_present = 0
        total_year_late = 0
        total_year_absent = 0
        total_year_excused = 0
        year_dates = set()

        for r in all_records:
            m = int(r["month_str"])
            if m in months_map:
                months_map[m]["total_records"] += 1
                months_map[m]["dates_set"].add(r["attendance_date"])
                year_dates.add(r["attendance_date"])

                st = r.get("status")
                if st == "Present":
                    months_map[m]["present"] += 1
                    total_year_present += 1
                elif st == "Late":
                    months_map[m]["late"] += 1
                    total_year_late += 1
                elif st == "Absent":
                    months_map[m]["absent"] += 1
                    total_year_absent += 1
                elif st == "Excused":
                    months_map[m]["excused"] += 1
                    total_year_excused += 1

        months_list = []
        for m in range(1, 13):
            m_obj = months_map[m]
            m_obj["total_days_active"] = len(m_obj["dates_set"])
            m_obj["attendance_rate"] = round((m_obj["present"] / m_obj["total_records"] * 100), 1) if m_obj["total_records"] > 0 else 0.0
            del m_obj["dates_set"]
            months_list.push(m_obj) if hasattr(months_list, 'push') else months_list.append(m_obj)

        total_year_records = len(all_records)
        annual_rate = round((total_year_present / total_year_records * 100), 1) if total_year_records > 0 else 0.0

        return {
            "year": year,
            "annual_attendance_rate": annual_rate,
            "total_days_active": len(year_dates),
            "total_sessions": len(all_sessions),
            "total_records": total_year_records,
            "present": total_year_present,
            "late": total_year_late,
            "absent": total_year_absent,
            "excused": total_year_excused,
            "months": months_list
        }


def export_attendance_dataframe(class_name: Optional[str] = None, date: Optional[str] = None):
    """Generates an exportable dataset of attendance records for CSV/Excel generation."""
    with get_db() as conn:
        query = """
        SELECT 
            a.id AS Record_ID,
            a.student_id AS Student_ID,
            COALESCE(s.full_name, a.student_id) AS Student_Name,
            a.class_name AS Class,
            COALESCE(sess.session_name, 'General Session') AS Session_Name,
            a.attendance_date AS Date,
            a.attendance_time AS Time,
            a.status AS Status,
            ROUND(a.confidence, 2) AS Confidence,
            a.marked_by AS Marked_By,
            COALESCE(a.audit_note, '') AS Audit_Note
        FROM attendance a
        LEFT JOIN students s ON a.student_id = s.student_id
        LEFT JOIN attendance_sessions sess ON a.session_id = sess.id
        WHERE 1=1
        """
        params = []
        if class_name and class_name.strip().lower() not in ("all", "*", ""):
            query += " AND a.class_name = ?"
            params.append(class_name.strip())
        if date:
            query += " AND a.attendance_date = ?"
            params.append(date.strip())

        query += " ORDER BY a.attendance_date DESC, a.attendance_time DESC"

        if PANDAS_AVAILABLE:
            df = pd.read_sql_query(query, conn, params=params)
            return df
        else:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            cols = [desc[0] for desc in cursor.description]
            return [dict(zip(cols, row)) for row in rows]


# ============================================================================
# SEEDING INITIAL REALISTIC DATA FOR OUT-OF-THE-BOX OPERATION
# ============================================================================

def seed_sample_data():
    """Seeds sample classes, students with face encodings, and historic sessions."""
    init_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM students")
        if cursor.fetchone()[0] > 0:
            return  # Already seeded

        now = datetime.now()
        date_today = now.strftime("%Y-%m-%d")
        iso_now = now.isoformat()

        # Sample student roster across CS101, DS202, AI301
        sample_students = [
            ("STU-1001", "Emma Watson", "CS101", "emma.w@university.edu", [0.05 * (i % 7) for i in range(128)], "/uploads/emma_sample.jpg"),
            ("STU-1002", "Liam Smith", "CS101", "liam.s@university.edu", [0.04 * (i % 9) for i in range(128)], "/uploads/liam_sample.jpg"),
            ("STU-1003", "Aaliyah Patel", "CS101", "aaliyah.p@university.edu", [0.06 * (i % 5) for i in range(128)], "/uploads/aaliyah_sample.jpg"),
            ("STU-1004", "Marcus Chen", "CS101", "marcus.c@university.edu", [0.03 * (i % 8) for i in range(128)], "/uploads/marcus_sample.jpg"),
            ("STU-1005", "Sophia Rodriguez", "CS101", "sophia.r@university.edu", [0.07 * (i % 6) for i in range(128)], "/uploads/sophia_sample.jpg"),
            ("STU-2001", "Noah Kim", "DS202", "noah.k@university.edu", [0.02 * (i % 11) for i in range(128)], "/uploads/noah_sample.jpg"),
            ("STU-2002", "Olivia Martinez", "DS202", "olivia.m@university.edu", [0.08 * (i % 4) for i in range(128)], "/uploads/olivia_sample.jpg"),
            ("STU-2003", "Ethan Becker", "DS202", "ethan.b@university.edu", [0.05 * (i % 9) for i in range(128)], "/uploads/ethan_sample.jpg"),
            ("STU-3001", "Maya Lin", "AI301", "maya.l@university.edu", [0.06 * (i % 7) for i in range(128)], "/uploads/maya_sample.jpg"),
            ("STU-3002", "David Okafor", "AI301", "david.o@university.edu", [0.04 * (i % 10) for i in range(128)], "/uploads/david_sample.jpg"),
        ]

        for s_id, name, cls, email, enc, img in sample_students:
            enc_str = json.dumps({"encoding": enc, "extracted_at": iso_now})
            cursor.execute("""
            INSERT INTO students (student_id, full_name, class_name, email, face_encoding, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (s_id, name, cls, email, enc_str, img, iso_now))

        # Sample Attendance Sessions
        cursor.execute("""
        INSERT INTO attendance_sessions (class_name, session_date, session_name, created_by, created_at)
        VALUES 
            ('CS101', ?, 'Morning Lecture: Computer Architecture', 'Prof. Eleanor Vance', ?),
            ('CS101', ?, 'Lab Session: Data Structures in Practice', 'Prof. Eleanor Vance', ?),
            ('DS202', ?, 'Statistics for Machine Learning', 'Prof. Eleanor Vance', ?)
        """, (date_today, iso_now, date_today, iso_now, date_today, iso_now))

        sess1_id = 1
        # Attendance logs for session 1
        attendance_seeds = [
            ("STU-1001", "CS101", sess1_id, date_today, "09:05:12", "Present", 0.98, "Teacher", "Biometric face verification high confidence", iso_now),
            ("STU-1002", "CS101", sess1_id, date_today, "09:06:01", "Present", 0.95, "Teacher", "Biometric face verification", iso_now),
            ("STU-1003", "CS101", sess1_id, date_today, "09:12:45", "Late", 0.91, "Teacher", "Arrived after 09:10 roll call", iso_now),
            ("STU-1004", "CS101", sess1_id, date_today, "09:05:44", "Present", 0.96, "Teacher", "Biometric face verification", iso_now),
            ("STU-1005", "CS101", sess1_id, date_today, "09:00:00", "Absent", 0.0, "Teacher", "Unexcused absence - not detected in classroom photo", iso_now),
        ]

        for att in attendance_seeds:
            cursor.execute("""
            INSERT INTO attendance 
                (student_id, class_name, session_id, attendance_date, attendance_time, status, confidence, marked_by, audit_note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, att)

        conn.commit()


if __name__ == "__main__":
    print(f"Initializing database at: {DB_FILE}")
    init_db()
    seed_sample_data()
    health = check_db_health()
    print("Database initialization complete!")
    print(json.dumps(health, indent=2))
