"""
Database layer for SQLite storage of students, users, attendance sessions, and attendance logs.
Includes Pandas integration for analytical reporting and CSV/Excel export.
"""

import sqlite3
import json
import os
from datetime import datetime
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
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    conn = get_db_connection()
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
        created_at TEXT NOT NULL
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

    # Attendance Records Table
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
        FOREIGN KEY (session_id) REFERENCES attendance_sessions (id),
        UNIQUE(student_id, session_id)
    );
    """)

    # Indexes for rapid querying
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(attendance_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_class ON attendance(class_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_id);")

    conn.commit()
    conn.close()


def add_student(student_id: str, full_name: str, class_name: str, email: str, face_encoding: List[float], image_path: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    try:
        cursor.execute("""
        INSERT INTO students (student_id, full_name, class_name, email, face_encoding, image_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (student_id, full_name, class_name, email, json.dumps({"encoding": face_encoding, "extracted_at": now}), image_path, now))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        raise ValueError(f'Student ID "{student_id}" is already registered.')
    finally:
        conn.close()


def get_students_by_class(class_name: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if class_name and class_name != "all":
        cursor.execute("SELECT * FROM students WHERE class_name = ? ORDER BY full_name ASC", (class_name,))
    else:
        cursor.execute("SELECT * FROM students ORDER BY full_name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_session(class_name: str, session_date: str, session_name: str, created_by: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO attendance_sessions (class_name, session_date, session_name, created_by, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (class_name, session_date, session_name, created_by, now))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id


def record_attendance_batch(session_id: int, class_name: str, records: List[Dict[str, Any]], marked_by: str) -> Tuple[int, int]:
    """
    Records attendance batch and prevents duplicates using ON CONFLICT / REPLACE.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    inserted = 0
    updated = 0

    for rec in records:
        student_id = rec.get("studentId")
        if not student_id:
            continue

        status = rec.get("status", "Present")
        confidence = rec.get("confidence", 1.0)
        audit_note = rec.get("auditNote", "Automated biometric match")

        # Check existing
        cursor.execute("SELECT id FROM attendance WHERE student_id = ? AND session_id = ?", (student_id, session_id))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
            UPDATE attendance 
            SET status = ?, confidence = ?, marked_by = ?, audit_note = ?, attendance_time = ?
            WHERE id = ?
            """, (status, confidence, marked_by, audit_note, time_str, existing["id"]))
            updated += 1
        else:
            cursor.execute("""
            INSERT INTO attendance 
            (student_id, class_name, session_id, attendance_date, attendance_time, status, confidence, marked_by, audit_note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (student_id, class_name, session_id, date_str, time_str, status, confidence, marked_by, audit_note, now.isoformat()))
            inserted += 1

    conn.commit()
    conn.close()
    return inserted, updated


def export_attendance_dataframe(class_name: Optional[str] = None, date: Optional[str] = None):
    """Generates a Pandas DataFrame of attendance records for reporting."""
    conn = get_db_connection()
    query = """
    SELECT 
        a.id AS Record_ID,
        a.student_id AS Student_ID,
        s.full_name AS Student_Name,
        a.class_name AS Class,
        sess.session_name AS Session_Name,
        a.attendance_date AS Date,
        a.attendance_time AS Time,
        a.status AS Status,
        a.confidence AS Confidence,
        a.marked_by AS Marked_By,
        a.audit_note AS Audit_Note
    FROM attendance a
    JOIN students s ON a.student_id = s.student_id
    LEFT JOIN attendance_sessions sess ON a.session_id = sess.id
    WHERE 1=1
    """
    params = []
    if class_name and class_name != "all":
        query += " AND a.class_name = ?"
        params.append(class_name)
    if date:
        query += " AND a.attendance_date = ?"
        params.append(date)

    query += " ORDER BY a.attendance_date DESC, a.attendance_time DESC"

    if PANDAS_AVAILABLE:
        df = pd.read_sql_query(query, conn, params=params)
        conn.close()
        return df
    else:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cols = [desc[0] for desc in cursor.description]
        conn.close()
        return [dict(zip(cols, row)) for row in rows]
