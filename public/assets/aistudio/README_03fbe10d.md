# VisionAttend: Image-Based Attendance System Using Face Recognition

A complete, full-stack biometric attendance management system. A teacher uploads a classroom photograph; the system detects human faces, compares them against a database of registered students using 128-dimensional facial biometric encodings, automatically marks recognized students as Present, and flags unknown individuals.

---

## 🌟 Key Features

1. **Classroom Image-Based Attendance**:
   - Accepts JPG, JPEG, and PNG classroom images.
   - Detects all visible student faces and computes bounding boxes `[ymin, xmin, ymax, xmax]`.
   - Identifies registered students using configurable similarity/distance thresholds.
   - Highlights recognized students (Green), uncertain matches (Amber), and **Unknown Faces** (Red/Purple).
   - Allows teachers to inspect biometric reasoning, toggle attendance status, and commit attendance records.

2. **Student Registration & Face Validation**:
   - Register students with Student ID, Full Name, Class, Email, and reference photograph.
   - Real-time photo validation: ensures exactly 1 clear front-facing face is visible prior to registration.
   - Generates and securely stores 128-dimensional biometric embeddings.

3. **Attendance Management & Audit Trail**:
   - Uniqueness constraints prevent duplicate attendance entries for the same student in the same session.
   - Filter and query attendance records by date, class, session, and student.
   - Allows manual teacher corrections with documented audit justification notes.
   - 1-Click CSV/Excel report export.

4. **Biometric Privacy Safeguards**:
   - Fallible biometric matching design: human-in-the-loop review prevents misattribution.
   - Strict separation of unknown faces from enrolled student identities.
   - Right to erasure and student privacy policy documentation.

---

## 🏗️ Architecture & Project Structure

The project provides dual implementations:
1. **Live Web App (React + Vite + Express + SQLite)**: Running in the interactive AI Studio environment on port 3000.
2. **Python Flask + OpenCV + face_recognition Reference Code**: Ready to run with Python and standard scientific computing libraries.

```
├── server.ts                    # Express backend entry point & REST API routes
├── database.py                  # Python SQLite database layer with Pandas export
├── face_engine.py               # Python OpenCV & face_recognition biometric engine
├── app.py                       # Python Flask entry point & API endpoints
├── requirements.txt             # Python dependencies
├── src/
│   ├── App.tsx                  # Main React frontend orchestrator
│   ├── types.ts                 # TypeScript interfaces
│   ├── index.css                # Tailwind CSS styling
│   ├── server/
│   │   ├── db.ts                # SQLite (sql.js) database initialization & schema
│   │   └── faceService.ts       # Facial detection, matching & Gemini vision engine
│   └── components/
│       ├── Navbar.tsx           # Navigation header & role switcher
│       ├── Dashboard.tsx        # Analytics dashboard & attendance rate stats
│       ├── FaceAttendance.tsx   # Classroom upload, preset tester & attendance review
│       ├── ClassroomCanvas.tsx  # Interactive bounding box visualizer
│       ├── StudentRoster.tsx    # Student registration, webcam capture & face validation
│       ├── AttendanceRecords.tsx# Filterable attendance logs, audit editor & CSV exporter
│       ├── SecurityPolicyModal.tsx # Biometric ethics & FERPA/GDPR safeguards
│       └── LoginModal.tsx       # Role switcher (Administrator / Teacher)
└── package.json                 # Node dependencies and scripts
```

---

## 🚀 Quickstart & Setup

### Option 1: Running the Live Web Application (Node.js & Express)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000`.

---

### Option 2: Running the Python Flask Application

1. **Set up virtual environment (Linux / macOS / Windows)**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate       # On Windows: venv\Scripts\activate
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask application**:
   ```bash
   python app.py
   ```
   The Flask API will run on `http://localhost:5000`.

---

## 🗄️ Database Schema (SQLite)

- **`students`**:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `student_id`: TEXT UNIQUE NOT NULL
  - `full_name`: TEXT NOT NULL
  - `class_name`: TEXT NOT NULL
  - `email`: TEXT
  - `face_encoding`: TEXT (128-d vector JSON)
  - `image_path`: TEXT NOT NULL
  - `created_at`: TEXT NOT NULL

- **`users`**:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `username`: TEXT UNIQUE NOT NULL
  - `password_hash`: TEXT NOT NULL
  - `full_name`: TEXT NOT NULL
  - `role`: TEXT ('admin' | 'teacher')
  - `created_at`: TEXT NOT NULL

- **`attendance_sessions`**:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `class_name`: TEXT NOT NULL
  - `session_date`: TEXT NOT NULL
  - `session_name`: TEXT NOT NULL
  - `created_by`: TEXT NOT NULL
  - `created_at`: TEXT NOT NULL

- **`attendance`**:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `student_id`: TEXT NOT NULL
  - `class_name`: TEXT NOT NULL
  - `session_id`: INTEGER NOT NULL (FOREIGN KEY)
  - `attendance_date`: TEXT NOT NULL
  - `attendance_time`: TEXT NOT NULL
  - `status`: TEXT ('Present', 'Absent', 'Late', 'Excused')
  - `confidence`: REAL
  - `marked_by`: TEXT NOT NULL
  - `audit_note`: TEXT
  - `created_at`: TEXT NOT NULL
  - `UNIQUE(student_id, session_id)`

---

## 📋 Step-by-Step Teacher & Admin Workflow

1. **Sign In**:
   - Click the user pill in the top-right corner.
   - Use default accounts:
     - **Teacher**: username `teacher` / password `teacher123`
     - **Administrator**: username `admin` / password `admin123`
2. **Review or Register Students**:
   - Go to **Student Roster**.
   - Click **Register New Student** to upload a headshot or use the webcam.
   - The validation engine checks that exactly 1 face is visible and stores its 128-d encoding.
3. **Capture or Upload Classroom Photo**:
   - Open **Take Attendance**.
   - Select your target class roster (e.g. *Computer Science 101*).
   - Click one of the **Quick Test Scenarios** or upload your own classroom photo.
4. **Biometric Face Recognition & Inspection**:
   - The canvas draws green boxes around recognized students, amber boxes around uncertain matches, and red/purple pulsing boxes around **Unknown Faces**.
   - Click any bounding box on the image to inspect biometric reasoning.
5. **Review & Commit Attendance**:
   - Review the generated list in the confirmation table.
   - Toggle any individual status (Present, Absent, Late, Excused).
   - Click **Commit & Save Attendance**. Duplicate submissions in the same session are automatically prevented.
6. **Export Reports**:
   - Navigate to **Records & Export** to filter by class or date.
   - Click **Export CSV Report** to download formatted records.
