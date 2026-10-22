import React, { useState, useEffect } from 'react';
import { ClassroomCanvas } from './ClassroomCanvas.tsx';
import { FaceDetection, AttendanceSession } from '../types.ts';
import { Camera, Upload, CheckCircle2, AlertOctagon, HelpCircle, Save, Plus, Calendar, Clock, RefreshCw } from 'lucide-react';

interface FaceAttendanceProps {
  onAttendanceSaved: () => void;
}

// Built-in high-quality classroom scenarios
const SAMPLE_SCENARIOS = [
  {
    id: 'cs101_lecture',
    name: 'CS101 Lecture Hall (High Attendance)',
    class: 'CS101',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    description: 'Computer Science lecture with enrolled students seated at group tables.',
  },
  {
    id: 'unknown_visitor',
    name: 'Lab Session with Unknown Visitor (Intruder Flagged)',
    class: 'CS101',
    imageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
    description: 'Enrolled students working on project with an unregistered visitor in the perimeter.',
  },
  {
    id: 'ds202_seminar',
    name: 'DS202 Data Science Seminar',
    class: 'DS202',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
    description: 'Interactive classroom discussion with high biometric detection certainty.',
  },
];

export const FaceAttendance: React.FC<FaceAttendanceProps> = ({ onAttendanceSaved }) => {
  const [selectedClass, setSelectedClass] = useState<string>('CS101');
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // New session modal / quick create
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);

  // Image & Detection
  const [currentImage, setCurrentImage] = useState<string>(SAMPLE_SCENARIOS[0].imageUrl);
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch sessions for current class
  const fetchSessions = async (cls: string) => {
    try {
      const res = await fetch(`/api/sessions?class_name=${cls}`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0) {
          setSelectedSessionId(data.sessions[0].id);
        } else {
          setSelectedSessionId(null);
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessions(selectedClass);
  }, [selectedClass]);

  // Run face recognition scan
  const runRecognition = async (imgUrl: string, cls: string) => {
    setProcessing(true);
    setCommitMessage(null);
    try {
      // Convert image to base64 or pass payload
      const res = await fetch('/api/recognize_classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_name: cls,
          image_base64: imgUrl,
          threshold: 0.55,
        }),
      });

      const data = await res.json();
      if (data.detections) {
        setDetections(data.detections);
      }
    } catch (err) {
      console.error('Error during recognition:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Initial scan on mount or scenario change
  useEffect(() => {
    runRecognition(currentImage, selectedClass);
  }, [currentImage, selectedClass]);

  // Handle Scenario Click
  const handleSelectScenario = (scenario: typeof SAMPLE_SCENARIOS[0]) => {
    setSelectedClass(scenario.class);
    setCurrentImage(scenario.imageUrl);
  };

  // Custom File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCurrentImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Create New Session Inline
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_name: selectedClass,
          session_name: newSessionName.trim(),
          session_date: newSessionDate,
          created_by: 'Prof. Eleanor Vance',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewSession(false);
        setNewSessionName('');
        await fetchSessions(selectedClass);
        setSelectedSessionId(data.sessionId);
        setCommitMessage({ type: 'success', text: `Session created with ID #${data.sessionId}. Ready for roll-call!` });
      }
    } catch (err: any) {
      setCommitMessage({ type: 'error', text: `Error creating session: ${err.message}` });
    }
  };

  // Toggle status for student in roll-call review
  const handleToggleStatus = (boxId: string, newStatus: 'Present' | 'Late' | 'Absent' | 'Excused') => {
    setDetections((prev) =>
      prev.map((d) => (d.boxId === boxId ? { ...d, status: newStatus } : d))
    );
  };

  // Commit Attendance to SQLite Database
  const handleCommitAttendance = async () => {
    if (!selectedSessionId) {
      setCommitMessage({ type: 'error', text: 'Please select or create an attendance session target first.' });
      return;
    }

    setCommitting(true);
    setCommitMessage(null);

    // Prepare batch records
    const records = detections
      .filter((d) => d.studentId !== null)
      .map((d) => ({
        studentId: d.studentId,
        status: d.status || 'Present',
        confidence: d.confidence,
        auditNote: d.auditNote || 'Automated biometric match',
      }));

    try {
      const res = await fetch('/api/submit_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          className: selectedClass,
          records,
          markedBy: 'Prof. Eleanor Vance',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCommitMessage({ type: 'error', text: data.error || 'Failed to commit attendance.' });
      } else {
        setCommitMessage({
          type: 'success',
          text: `Attendance committed successfully! ${records.length} student records committed into session #${selectedSessionId}. Duplicate entries prevented by SQLite ON CONFLICT index.`,
        });
        onAttendanceSaved();
        fetchSessions(selectedClass);
      }
    } catch (err: any) {
      setCommitMessage({ type: 'error', text: err.message || 'Network error saving attendance' });
    } finally {
      setCommitting(false);
    }
  };

  const recognizedCount = detections.filter((d) => d.matchType === 'recognized').length;
  const uncertainCount = detections.filter((d) => d.matchType === 'uncertain').length;
  const unknownCount = detections.filter((d) => d.matchType === 'unknown').length;

  return (
    <div className="space-y-8">
      {/* Configuration Header */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span>Take Classroom Biometric Attendance</span>
            </h1>
            <p className="text-sm text-slate-400">
              Facial biometric scanner matches classroom faces against enrolled database vectors and flags unknown persons.
            </p>
          </div>

          {/* Quick Scenario Buttons */}
          <div className="flex flex-wrap gap-2">
            {SAMPLE_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectScenario(s)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  currentImage === s.imageUrl
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {s.name}
              </button>
            ))}

            <label className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer flex items-center space-x-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Class and Session Selector Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Class Roster
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="CS101">CS101: Computer Architecture</option>
              <option value="DS202">DS202: Data Science & ML</option>
              <option value="AI301">AI301: Artificial Intelligence</option>
            </select>
          </div>

          {/* Session Select */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Attendance Session Target
              </label>
              <button
                onClick={() => setShowNewSession(!showNewSession)}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showNewSession ? 'Cancel' : 'New Session'}</span>
              </button>
            </div>

            {showNewSession ? (
              <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-lg border border-slate-700">
                <input
                  type="text"
                  placeholder="e.g. Midterm Lab Practical"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white px-3 py-1.5 rounded focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white px-2 py-1.5 rounded focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleCreateSession}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded font-medium shadow"
                >
                  Create
                </button>
              </div>
            ) : (
              <select
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                {sessions.length === 0 ? (
                  <option value="">No sessions found for {selectedClass}. Click 'New Session'.</option>
                ) : (
                  sessions.map((sess) => (
                    <option key={sess.id} value={sess.id}>
                      #{sess.id} • {sess.session_name} ({sess.session_date})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Classroom Canvas with Overlay Bounding Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <span>
                Detected: <strong className="text-white">{detections.length} faces</strong>
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{recognizedCount} Recognized</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{uncertainCount} Uncertain</span>
              <span>•</span>
              <span className="text-red-400 font-semibold">{unknownCount} Unknown</span>
            </div>

            <button
              onClick={() => runRecognition(currentImage, selectedClass)}
              disabled={processing}
              className="text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
              <span>{processing ? 'Scanning...' : 'Re-scan'}</span>
            </button>
          </div>

          <ClassroomCanvas
            imageSrc={currentImage}
            detections={detections}
            selectedBoxId={selectedBoxId}
            onSelectBox={setSelectedBoxId}
          />

          {/* Unknown Intruder Warning Banner */}
          {unknownCount > 0 && (
            <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl flex items-start space-x-3 text-red-300">
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-red-200">
                  {unknownCount} Unregistered / Unknown Face{unknownCount > 1 ? 's' : ''} Detected
                </h4>
                <p className="text-xs text-red-300/90 mt-1">
                  The biometric engine flagged individuals whose Euclidean feature distance exceeds the similarity tolerance
                  threshold. These persons are NOT enrolled in {selectedClass} and will not be marked as enrolled students.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Roll Call Review Table & Commit */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-bold text-white text-base">Attendance Roll Call</h2>
                <p className="text-xs text-slate-400">Review and toggle status before saving</p>
              </div>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono">
                {selectedClass}
              </span>
            </div>

            {/* List of Detected Students */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {detections.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {processing ? 'Detecting faces...' : 'No faces detected in current image.'}
                </div>
              ) : (
                detections.map((det) => {
                  const isUnknown = det.matchType === 'unknown';
                  const isSelected = selectedBoxId === det.boxId;

                  return (
                    <div
                      key={det.boxId}
                      onClick={() => setSelectedBoxId(isSelected ? null : det.boxId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-500 shadow-md'
                          : isUnknown
                          ? 'bg-red-950/20 border-red-500/30'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              isUnknown ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'
                            }`}
                          >
                            {isUnknown ? '?' : det.studentName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white flex items-center space-x-1.5">
                              <span>{det.studentName}</span>
                              {det.studentId && (
                                <span className="font-mono text-[10px] text-slate-400">({det.studentId})</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(det.confidence * 100)}% match • dist: {det.distance.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        {/* Status Buttons */}
                        {!isUnknown && (
                          <div
                            className="flex items-center space-x-1 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(['Present', 'Late', 'Absent'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleToggleStatus(det.boxId, st)}
                                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                  det.status === st
                                    ? st === 'Present'
                                      ? 'bg-emerald-500 text-slate-950'
                                      : st === 'Late'
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-red-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Commit Button */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <button
                onClick={handleCommitAttendance}
                disabled={committing || detections.filter((d) => d.studentId).length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{committing ? 'Committing to SQLite...' : 'Commit & Save Attendance'}</span>
              </button>

              {commitMessage && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                    commitMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border border-red-500/30 text-red-300'
                  }`}
                >
                  {commitMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>{commitMessage.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
