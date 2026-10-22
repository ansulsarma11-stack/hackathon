"""
VisionAttend - Flask Web Application Entry Point
Image-Based Attendance System Using Face Recognition & Robust SQLite Database Layer
"""

import os
import json
import sqlite3
import base64
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_file, Response
from werkzeug.utils import secure_filename
import database as db
from face_engine import FaceEngine

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'vision-attend-secret-key-2026')
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 # 32 MB max upload

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database schema and seed default data
db.init_db()
db.seed_sample_data()
engine = FaceEngine(tolerance=0.55)


@app.route('/health')
@app.route('/api/health')
def health_check():
    health = db.check_db_health()
    return jsonify({
        "status": "healthy",
        "service": "VisionAttend Flask API",
        "timestamp": datetime.now().isoformat(),
        "database": health
    })


@app.route('/api/students', methods=['GET'])
def get_students():
    class_name = request.args.get('class_name')
    students = db.get_students_by_class(class_name)
    return jsonify({"students": students})


@app.route('/api/students/<student_id>', methods=['GET'])
def get_student(student_id):
    student = db.get_student_by_id(student_id)
    if not student:
        return jsonify({"success": False, "error": "Student not found"}), 404
    return jsonify({"student": student})


@app.route('/api/students/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    deleted = db.delete_student(student_id)
    if not deleted:
        return jsonify({"success": False, "error": "Student not found"}), 404
    return jsonify({"success": True, "message": f"Student {student_id} and attendance history deleted"})


@app.route('/api/register_student', methods=['POST'])
def register_student():
    """
    Validates face in student reference photograph and stores biometric encoding.
    """
    student_id = request.form.get('student_id')
    full_name = request.form.get('full_name')
    class_name = request.form.get('class_name')
    email = request.form.get('email', '')

    if not student_id or not full_name or not class_name:
        return jsonify({"success": False, "error": "Missing student ID, name, or class"}), 400

    file = request.files.get('photo')
    if not file:
        return jsonify({"success": False, "error": "No student photo provided"}), 400

    image_bytes = file.read()
    try:
        rgb_image = engine.load_image(image_bytes)
        is_valid, encoding, msg = engine.extract_face_encoding(rgb_image)

        if not is_valid or encoding is None:
            return jsonify({"success": False, "error": msg}), 422

        # Save image file securely
        filename = secure_filename(f"{student_id}_{int(datetime.now().timestamp())}.jpg")
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        with open(save_path, 'wb') as f:
            f.write(image_bytes)

        try:
            db.add_student(student_id, full_name, class_name, email, encoding, save_path)
        except ValueError as dup:
            if os.path.exists(save_path):
                os.remove(save_path)
            return jsonify({"success": False, "error": str(dup)}), 409
        return jsonify({"success": True, "message": f"Student {full_name} registered successfully."}), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/recognize_classroom', methods=['POST'])
def recognize_classroom():
    """
    Detects faces in uploaded classroom photo and matches them against enrolled students.
    Flags unknown faces.
    """
    class_name = request.form.get('class_name', 'all')
    threshold = float(request.form.get('threshold', 0.55))

    file = request.files.get('image')
    if not file:
        return jsonify({"success": False, "error": "No classroom photo uploaded"}), 400

    image_bytes = file.read()
    try:
        classroom_rgb = engine.load_image(image_bytes)

        # Retrieve enrolled students and their encodings
        enrolled = db.get_students_by_class(class_name)
        known_encodings = []
        known_ids = []
        known_names = []

        for s in enrolled:
            enc_str = s.get('face_encoding')
            if enc_str:
                try:
                    enc = json.loads(enc_str)
                    if isinstance(enc, dict) and 'encoding' in enc:
                        enc = enc['encoding']
                    if isinstance(enc, list) and len(enc) > 0:
                        known_encodings.append(enc)
                        known_ids.append(s['student_id'])
                        known_names.append(s['full_name'])
                except Exception:
                    continue

        detections = engine.detect_and_recognize_classroom(
            classroom_rgb,
            known_encodings,
            known_ids,
            known_names,
            custom_tolerance=threshold
        )

        return jsonify({
            "success": True,
            "detections": detections,
            "total_detected": len(detections),
            "recognized": len([d for d in detections if d['matchType'] == 'recognized']),
            "uncertain": len([d for d in detections if d['matchType'] == 'uncertain']),
            "unknown": len([d for d in detections if d['matchType'] == 'unknown'])
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    class_name = request.args.get('class_name')
    date = request.args.get('date')
    sessions = db.get_sessions(class_name, date)
    return jsonify({"sessions": sessions})


@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json or {}
    class_name = data.get('class_name')
    session_date = data.get('session_date', datetime.now().strftime("%Y-%m-%d"))
    session_name = data.get('session_name')
    created_by = data.get('created_by', 'Teacher')

    if not class_name or not session_name:
        return jsonify({"success": False, "error": "Class name and session name are required"}), 400

    session_id = db.create_session(class_name, session_date, session_name, created_by)
    return jsonify({"success": True, "sessionId": session_id}), 201


@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    deleted = db.delete_session(session_id)
    if not deleted:
        return jsonify({"success": False, "error": "Session not found"}), 404
    return jsonify({"success": True, "message": f"Session {session_id} deleted"})


@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    session_id = request.args.get('session_id', type=int)
    class_name = request.args.get('class_name')
    date = request.args.get('date')
    student_id = request.args.get('student_id')

    records = db.get_attendance_records(session_id, class_name, date, student_id)
    return jsonify({"records": records})


@app.route('/api/attendance/<int:record_id>', methods=['PATCH'])
def update_attendance_record(record_id):
    data = request.json or {}
    status = data.get('status', 'Present')
    audit_note = data.get('audit_note', 'Manual update')
    marked_by = data.get('marked_by', 'Teacher')

    updated = db.update_attendance_status(record_id, status, audit_note, marked_by)
    if not updated:
        return jsonify({"success": False, "error": "Record not found"}), 404
    return jsonify({"success": True, "message": "Record updated"})


@app.route('/api/attendance/<int:record_id>', methods=['DELETE'])
def delete_attendance_record(record_id):
    deleted = db.delete_attendance_record(record_id)
    if not deleted:
        return jsonify({"success": False, "error": "Record not found"}), 404
    return jsonify({"success": True, "message": "Record deleted"})


@app.route('/api/submit_attendance', methods=['POST'])
def submit_attendance():
    data = request.json or {}
    session_id = data.get('sessionId')
    class_name = data.get('className')
    records = data.get('records', [])
    marked_by = data.get('markedBy', 'Teacher')

    if not session_id or not class_name:
        return jsonify({"success": False, "error": "Missing session or class"}), 400

    try:
        inserted, updated = db.record_attendance_batch(session_id, class_name, records, marked_by)
    except sqlite3.IntegrityError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({
        "success": True,
        "message": f"Attendance committed: {inserted} inserted/upserted.",
        "inserted": inserted,
        "updated": updated
    })


@app.route('/api/summary', methods=['GET'])
def get_summary():
    class_name = request.args.get('class_name')
    summary = db.get_attendance_summary(class_name)
    return jsonify({"summary": summary})


@app.route('/api/calendar/month', methods=['GET'])
def get_monthly_calendar():
    year = request.args.get('year', type=int) or datetime.now().year
    month = request.args.get('month', type=int) or datetime.now().month
    class_name = request.args.get('class_name')
    student_id = request.args.get('student_id')

    calendar_data = db.get_monthly_attendance(year, month, class_name, student_id)
    return jsonify(calendar_data)


@app.route('/api/calendar/year', methods=['GET'])
def get_yearly_calendar():
    year = request.args.get('year', type=int) or datetime.now().year
    class_name = request.args.get('class_name')
    student_id = request.args.get('student_id')

    yearly_data = db.get_yearly_attendance(year, class_name, student_id)
    return jsonify(yearly_data)



@app.route('/api/export_csv', methods=['GET'])
def export_csv():
    class_name = request.args.get('class_name')
    date = request.args.get('date')
    df_or_rows = db.export_attendance_dataframe(class_name, date)

    if hasattr(df_or_rows, 'to_csv'):
        output = BytesIO()
        df_or_rows.to_csv(output, index=False)
        output.seek(0)
        return send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"attendance_report_{datetime.now().strftime('%Y%m%d')}.csv"
        )
    else:
        # Fallback csv text
        csv_text = "Record_ID,Student_ID,Student_Name,Class,Session_Name,Date,Time,Status,Confidence,Marked_By,Audit_Note\n"
        for r in df_or_rows:
            csv_text += f"{r.get('Record_ID')},{r.get('Student_ID')},\"{r.get('Student_Name')}\",\"{r.get('Class')}\",\"{r.get('Session_Name')}\",{r.get('Date')},{r.get('Time')},{r.get('Status')},{r.get('Confidence')},\"{r.get('Marked_By')}\",\"{r.get('Audit_Note')}\"\n"
        return Response(
            csv_text,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=attendance.csv"}
        )


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
