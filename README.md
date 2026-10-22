# VisionAttend: Image-Based Attendance System Using Face Recognition & Fixed SQLite Database

A complete, full-stack biometric attendance management system. A teacher uploads a classroom photograph; the system detects human faces, compares them against a database of registered students using 128-dimensional facial biometric encodings, automatically marks recognized students as Present, and flags unknown individuals.

---

## 🛠️ Database Fixes Applied

1. **Foreign Key Integrity & Cascades**:
   - `attendance` table foreign keys updated with `ON DELETE CASCADE` for both `attendance_sessions (id)` and `students (student_id)`.
   - `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;` enabled for concurrent multi-access without database locking.

2. **Session Validation & Atomic Upsert**:
   - `record_attendance_batch` now validates session existence first and raises explicit `sqlite3.IntegrityError` if session does not exist (returning proper 404 in REST endpoints).
   - Uses SQLite `INSERT ... ON CONFLICT(student_id, session_id) DO UPDATE SET` to prevent race conditions and duplicate logs.
   - Respects session date instead of overriding past sessions with current timestamp.

3. **Safe Connection Management**:
   - Implemented context manager `get_db()` with automatic `conn.close()` and transaction rollback on error, preventing connection leaks.

4. **Data Preservation in Analytical Reporting**:
   - Fixed `export_attendance_dataframe` by replacing `INNER JOIN` with `LEFT JOIN` and `COALESCE(s.full_name, a.student_id)` so records with altered student records are never dropped from exports.

5. **Extended CRUD & Database Health Inspector**:
   - Added `check_db_health()` (`PRAGMA integrity_check`), `delete_student()`, `update_student()`, `delete_session()`, `get_attendance_summary()`, and `seed_sample_data()`.
