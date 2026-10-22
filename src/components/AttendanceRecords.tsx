import React, { useState, useEffect } from 'react';
import { AttendanceRecord } from '../types.ts';
import { ClipboardList, Download, Search, Filter, Edit3, Trash2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { downloadAttendancePdf } from '../utils/pdfGenerator.ts';

interface AttendanceRecordsProps {
  refreshTrigger: number;
}

export const AttendanceRecords: React.FC<AttendanceRecordsProps> = ({ refreshTrigger }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit status modal
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'Present' | 'Late' | 'Absent' | 'Excused'>('Present');
  const [editNote, setEditNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = `/api/attendance?class_name=${selectedClass}`;
      if (filterDate) url += `&date=${filterDate}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedClass, filterDate, refreshTrigger]);

  const handleExportPdf = () => {
    if (filteredRecords.length === 0) {
      return;
    }
    downloadAttendancePdf({
      records: filteredRecords,
      className: selectedClass === 'all' ? 'All Classes' : selectedClass,
      dateFilter: filterDate || undefined,
      generatedBy: 'Prof. Eleanor Vance',
    });
  };

  const handleExportCsv = () => {
    let url = `/api/export_csv?class_name=${selectedClass}`;
    if (filterDate) url += `&date=${filterDate}`;
    window.location.href = url;
  };

  const handleOpenEdit = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setEditStatus(rec.status);
    setEditNote(rec.audit_note || 'Teacher manual correction');
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/attendance/${editingRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          audit_note: editNote.trim() || 'Manual adjustment',
          marked_by: 'Prof. Eleanor Vance',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingRecord(null);
        fetchRecords();
      }
    } catch (err: any) {
      console.error(`Error updating record: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    try {
      await fetch(`/api/attendance/${recordId}`, { method: 'DELETE' });
      fetchRecords();
    } catch (err: any) {
      console.error(`Error deleting record: ${err.message}`);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.student_id.toLowerCase().includes(search.toLowerCase()) ||
      (r.session_name && r.session_name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <span>Attendance History & Audit Logs</span>
          </h1>
          <p className="text-sm text-slate-400">
            Immutable SQLite records with foreign-key links, timestamps, and justification audit trails.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF Report</span>
          </button>
          <button
            onClick={handleExportCsv}
            title="Download CSV raw dump"
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs px-3 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Classes</option>
              <option value="CS101">CS101</option>
              <option value="DS202">DS202</option>
              <option value="AI301">AI301</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Date:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student or session..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-white pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading attendance records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No attendance records found matching the filter criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-slate-300 font-semibold">ID</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Student</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Class</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Session</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Status</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Confidence</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold">Audit Note</th>
                  <th className="px-4 py-3 text-slate-300 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-500">#{r.id}</td>
                    <td className="px-4 py-3 text-white font-sans font-medium">
                      <div>{r.student_name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{r.student_id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.class_name}</td>
                    <td className="px-4 py-3 text-slate-300 truncate max-w-xs">{r.session_name || `Session #${r.session_id}`}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <div>{r.attendance_date}</div>
                      <div className="text-[10px] text-slate-500">{r.attendance_time}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.status === 'Present'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : r.status === 'Late'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : r.status === 'Absent'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {Math.round(r.confidence * 100)}%
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs font-sans text-xs">
                      {r.audit_note || 'Automated biometric match'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          title="Edit Status / Add Justification"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          title="Delete Record"
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Adjust Attendance Status</h3>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400">Student:</span>
                <p className="font-semibold text-white text-sm">
                  {editingRecord.student_name} ({editingRecord.student_id})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Present', 'Late', 'Absent', 'Excused'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatus(st)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        editStatus === st
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Required Audit Justification Note
                </label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Verified doctor excuse note submitted by student"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white p-2.5 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow"
                >
                  {updating ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
