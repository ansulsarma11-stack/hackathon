import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import * as db from './src/server/db.ts';
import * as faceService from './src/server/faceService.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers
app.use(express.json({ limit: '32mb' }));
app.use(express.urlencoded({ extended: true, limit: '32mb' }));

// Multer in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

// Initialize database
db.getDb()
  .then(() => {
    console.log('VisionAttend SQLite database initialized successfully.');
  })
  .catch((err) => {
    console.error('Error initializing database:', err);
  });

// ----------------------------------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------------------------------

// Health Check & Database Integrity
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    const health = await db.checkDbHealth();
    res.json({
      status: 'healthy',
      service: 'VisionAttend API Server',
      timestamp: new Date().toISOString(),
      database: health,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Students
app.get('/api/students', async (req, res) => {
  try {
    const className = req.query.class_name as string;
    const students = await db.getStudents(className);
    res.json({ students });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const student = await db.getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    res.json({ student });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    await db.deleteStudent(req.params.id);
    res.json({ success: true, message: `Student ${req.params.id} and attendance records deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/register_student', upload.single('photo'), async (req, res) => {
  try {
    const studentId = req.body.student_id || req.body.studentId;
    const fullName = req.body.full_name || req.body.fullName;
    const className = req.body.class_name || req.body.className;
    const email = req.body.email || '';
    let photoBase64 = req.body.photo_base64 || '';

    if (!studentId || !fullName || !className) {
      return res.status(400).json({ success: false, error: 'Missing student ID, name, or class' });
    }

    if (req.file) {
      photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    if (!photoBase64) {
      return res.status(400).json({ success: false, error: 'No student reference photo provided' });
    }

    // Biometric face validation: check exactly 1 face is present
    const validation = await faceService.validateRegistrationPhoto(photoBase64);
    if (!validation.isValid) {
      return res.status(422).json({ success: false, error: validation.message });
    }

    await db.addStudent({
      student_id: studentId,
      full_name: fullName,
      class_name: className,
      email,
      face_encoding: validation.encoding,
      image_path: photoBase64,
    });

    res.status(201).json({
      success: true,
      message: `Student ${fullName} registered successfully with verified facial biometric encoding.`,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('already registered')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Classroom Recognition
app.post('/api/recognize_classroom', upload.single('image'), async (req, res) => {
  try {
    const className = (req.body.class_name || req.body.className || 'all') as string;
    const threshold = parseFloat(req.body.threshold || '0.55');
    let imageBase64 = req.body.image_base64 || '';

    if (req.file) {
      imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No classroom photo provided' });
    }

    const students = await db.getStudents(className);
    const detections = await faceService.processClassroomImage(imageBase64, students, threshold);

    const recognized = detections.filter((d) => d.matchType === 'recognized').length;
    const uncertain = detections.filter((d) => d.matchType === 'uncertain').length;
    const unknown = detections.filter((d) => d.matchType === 'unknown').length;

    res.json({
      success: true,
      detections,
      total_detected: detections.length,
      recognized,
      uncertain,
      unknown,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Attendance Sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const className = req.query.class_name as string;
    const date = req.query.date as string;
    const sessions = await db.getSessions(className, date);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { class_name, session_date, session_name, created_by } = req.body;
    if (!class_name || !session_name) {
      return res.status(400).json({ success: false, error: 'Class name and session name are required' });
    }

    const sessionId = await db.createSession({
      class_name,
      session_date: session_date || new Date().toISOString().split('T')[0],
      session_name,
      created_by: created_by || 'Teacher',
    });

    res.status(201).json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    await db.deleteSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} deleted` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Attendance Records
app.get('/api/attendance', async (req, res) => {
  try {
    const sessionId = req.query.session_id ? Number(req.query.session_id) : undefined;
    const className = req.query.class_name as string;
    const date = req.query.date as string;
    const studentId = req.query.student_id as string;

    const records = await db.getAttendanceRecords({ sessionId, className, date, studentId });
    res.json({ records });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/attendance/:id', async (req, res) => {
  try {
    const recordId = Number(req.params.id);
    const { status, audit_note, marked_by } = req.body;
    await db.updateAttendanceStatus(recordId, status || 'Present', audit_note || 'Manual correction', marked_by || 'Teacher');
    res.json({ success: true, message: 'Attendance record updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/attendance/:id', async (req, res) => {
  try {
    const recordId = Number(req.params.id);
    await db.deleteAttendanceRecord(recordId);
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/submit_attendance', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || req.body.session_id;
    const className = req.body.className || req.body.class_name;
    const records = req.body.records || [];
    const markedBy = req.body.markedBy || req.body.marked_by || 'Teacher';

    if (!sessionId || !className) {
      return res.status(400).json({ success: false, error: 'Missing session ID or class name' });
    }

    const result = await db.recordAttendanceBatch(Number(sessionId), className, records, markedBy);
    res.json({
      success: true,
      message: `Attendance committed: ${result.inserted} records saved.`,
      ...result,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('does not exist')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Analytics Summary
app.get('/api/summary', async (req, res) => {
  try {
    const className = req.query.class_name as string;
    const summary = await db.getAttendanceSummary(className);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Monthly Calendar Endpoint
app.get('/api/calendar/month', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const className = req.query.class_name as string;
    const studentId = req.query.student_id as string;

    const calendarData = await db.getMonthlyAttendance({ year, month, className, studentId });
    res.json(calendarData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full Year Attendance Endpoint (Annual % and all 12 months)
app.get('/api/calendar/year', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const className = req.query.class_name as string;
    const studentId = req.query.student_id as string;

    const yearlyData = await db.getYearlyAttendance({ year, className, studentId });
    res.json(yearlyData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export CSV / Records Data
app.get('/api/export_csv', async (req, res) => {
  try {
    const className = req.query.class_name as string;
    const date = req.query.date as string;
    const records = await db.getAttendanceRecords({ className, date });

    let csv = 'Record_ID,Student_ID,Student_Name,Class,Session_Name,Date,Time,Status,Confidence,Marked_By,Audit_Note\n';
    for (const r of records) {
      csv += `${r.id},"${r.student_id}","${(r.student_name || '').replace(/"/g, '""')}","${r.class_name}","${(r.session_name || '').replace(/"/g, '""')}",${r.attendance_date},${r.attendance_time},${r.status},${r.confidence},"${r.marked_by}","${(r.audit_note || '').replace(/"/g, '""')}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct SQL Studio Query Runner
app.post('/api/db/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL query string required' });
    }
    const result = await db.runRawQuery(sql);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reset & Seed Database
app.post('/api/db/reset', async (req, res) => {
  try {
    await db.resetDatabase();
    res.json({ success: true, message: 'Database reset and sample data seeded successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// VITE DEV SERVER / STATIC SERVING
// ----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VisionAttend server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
