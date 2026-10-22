import React, { useState, useEffect } from 'react';
import { Student } from '../types.ts';
import { Users, UserPlus, Trash2, Search, CheckCircle2, AlertTriangle, Fingerprint, Mail, Camera, Sparkles, Image as ImageIcon } from 'lucide-react';

interface StudentRosterProps {
  onStudentChanged: () => void;
}

// Preset verified student portrait avatars for quick enrollment testing
const PRESET_AVATARS = [
  {
    name: 'Chloe Bennett',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    gender: 'f',
  },
  {
    name: 'Alexander Wright',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    gender: 'm',
  },
  {
    name: 'Sophia Chen',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    gender: 'f',
  },
  {
    name: 'Marcus Williams',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    gender: 'm',
  },
  {
    name: 'Zainab Al-Mansoor',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    gender: 'f',
  },
  {
    name: 'Lucas Silva',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    gender: 'm',
  },
];

export const StudentRoster: React.FC<StudentRosterProps> = ({ onStudentChanged }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration Modal State
  const [showModal, setShowModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newClass, setNewClass] = useState('CS101');
  const [newEmail, setNewEmail] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(PRESET_AVATARS[0].url);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // In-UI Deletion Confirmation Modal (avoids window.confirm iFrame sandbox block)
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students?class_name=${selectedClass}`);
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  // Generate automatic student ID and email when opening modal or selecting preset avatar
  const handleOpenRegister = () => {
    const nextNum = Math.floor(1000 + Math.random() * 9000);
    const defaultAvatar = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
    setNewStudentId(`STU-${nextNum}`);
    setNewFullName(defaultAvatar.name);
    setNewClass(selectedClass !== 'all' ? selectedClass : 'CS101');
    setNewEmail(`${defaultAvatar.name.toLowerCase().replace(/\s+/g, '.')}@university.edu`);
    setSelectedAvatarUrl(defaultAvatar.url);
    setNewPhotoBase64(null);
    setRegisterError(null);
    setRegisterSuccess(null);
    setShowModal(true);
  };

  const handleSelectPresetAvatar = (avatar: typeof PRESET_AVATARS[0]) => {
    setSelectedAvatarUrl(avatar.url);
    setNewPhotoBase64(null);
    setNewFullName(avatar.name);
    setNewEmail(`${avatar.name.toLowerCase().replace(/\s+/g, '.')}@university.edu`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setNewPhotoBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Student Insert
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId.trim() || !newFullName.trim() || !newClass.trim()) {
      setRegisterError('Please fill in Student ID, Full Name, and Class.');
      return;
    }

    const photoToSubmit = newPhotoBase64 || selectedAvatarUrl;
    if (!photoToSubmit) {
      setRegisterError('Please select or upload a student portrait.');
      return;
    }

    setRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(null);

    try {
      const res = await fetch('/api/register_student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: newStudentId.trim(),
          full_name: newFullName.trim(),
          class_name: newClass.trim(),
          email: newEmail.trim() || `${newStudentId.toLowerCase()}@university.edu`,
          photo_base64: photoToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegisterError(data.error || 'Registration failed.');
      } else {
        setRegisterSuccess(`Student ${newFullName} enrolled with biometric face encoding!`);
        setActionNotice({
          type: 'success',
          message: `Student "${newFullName}" (${newStudentId}) was registered and inserted into SQLite.`,
        });
        setTimeout(() => setActionNotice(null), 5000);
        setTimeout(() => {
          setShowModal(false);
          setRegisterSuccess(null);
        }, 1200);
        await fetchStudents();
        onStudentChanged();
      }
    } catch (err: any) {
      setRegisterError(err.message || 'Network error enrolling student.');
    } finally {
      setRegistering(false);
    }
  };

  // Student Delete (In-UI confirmation handler, no window.confirm)
  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/students/${studentToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          message: `Student "${studentToDelete.name}" (${studentToDelete.id}) and all associated attendance records were permanently deleted from SQLite.`,
        });
        setTimeout(() => setActionNotice(null), 5000);
        setStudentToDelete(null);
        await fetchStudents();
        onStudentChanged();
      } else {
        setActionNotice({
          type: 'error',
          message: data.error || 'Failed to delete student.',
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Network error deleting student.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Enrolled Student Biometric Profiles</span>
          </h1>
          <p className="text-sm text-slate-400">
            Enrolled students are stored in SQLite with 128-d vectors and cascading attendance integrity.
          </p>
        </div>

        <button
          onClick={handleOpenRegister}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Student</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Class Filter Tabs */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          {['all', 'CS101', 'DS202', 'AI301'].map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedClass === cls ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {cls === 'all' ? 'All Classes' : cls}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-white pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-emerald-500 w-full sm:w-72"
          />
        </div>
      </div>

      {/* Student Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading student profiles...</div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center text-slate-500 space-y-3">
          <p>No student profiles found.</p>
          <button
            onClick={handleOpenRegister}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
          >
            Insert Student Profile Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 shadow-lg flex flex-col justify-between transition-all group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={s.image_path || PRESET_AVATARS[0].url}
                      alt={s.full_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PRESET_AVATARS[0].url;
                      }}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                        {s.full_name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">{s.student_id}</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {s.class_name}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  {s.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Fingerprint className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400/90 font-mono text-[11px]">128-d Biometric Encoded</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Enrolled: {s.created_at ? s.created_at.split('T')[0] : 'N/A'}
                </span>
                <button
                  onClick={() => setStudentToDelete({ id: s.student_id, name: s.full_name })}
                  title="Delete student profile and cascading attendance records"
                  className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal (In-UI, no window.confirm) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Student Profile?</h3>
                <p className="text-xs text-slate-400">Cascading SQLite Deletion</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{studentToDelete.name}</strong> (
              <span className="font-mono text-emerald-400">{studentToDelete.id}</span>)?
            </p>

            <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-[11px] text-red-300 space-y-1">
              <span className="font-bold block">Cascading Integrity Notice:</span>
              <span>All biometric face embeddings and historical attendance logs for this student will be permanently removed.</span>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting from SQLite...' : 'Yes, Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration / Insert Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Insert New Student Profile</span>
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STU-1006"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Class *</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CS101">CS101: Computer Architecture</option>
                    <option value="DS202">DS202: Data Science & ML</option>
                    <option value="AI301">AI301: Artificial Intelligence</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Institutional Email</label>
                <input
                  type="email"
                  placeholder="e.g. jane.doe@university.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quick Preset Portrait Avatar Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Student Reference Photo (1-Click Preset or Upload)
                  </label>
                  <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Preset Avatars Ready</span>
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-3">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(av)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                        !newPhotoBase64 && selectedAvatarUrl === av.url
                          ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105'
                          : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {/* Or Custom Upload */}
                <div className="flex items-center space-x-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                    <img
                      src={newPhotoBase64 || selectedAvatarUrl}
                      alt="Selected Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-slate-400 mb-1">Or choose custom image file:</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                    />
                  </div>
                </div>
              </div>

              {registerError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              {registerSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{registerSuccess}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer"
                >
                  {registering ? 'Validating & Inserting...' : 'Insert Student Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
