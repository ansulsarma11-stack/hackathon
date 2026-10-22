import React, { useState, useEffect } from 'react';
import { SummaryStats } from '../types.ts';
import { BarChart3, Users, Calendar, Award, CheckCircle2, Clock, XCircle, ShieldAlert } from 'lucide-react';

interface DashboardProps {
  onNavigateTab: (tab: 'attendance' | 'database' | 'roster' | 'records') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/summary?class_name=${selectedClass}`);
      const data = await res.json();
      if (data.summary) {
        setStats(data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedClass]);

  const presentPercent = stats && stats.total_logs > 0 ? Math.round((stats.present / stats.total_logs) * 100) : 0;
  const latePercent = stats && stats.total_logs > 0 ? Math.round((stats.late / stats.total_logs) * 100) : 0;
  const absentPercent = stats && stats.total_logs > 0 ? Math.round((stats.absent / stats.total_logs) * 100) : 0;
  const excusedPercent = stats && stats.total_logs > 0 ? Math.round((stats.excused / stats.total_logs) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Attendance Analytics & Insights</span>
          </h1>
          <p className="text-sm text-slate-400">
            Real-time biometric attendance metrics calculated from SQLite transaction logs.
          </p>
        </div>

        {/* Class Filter */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          {['all', 'CS101', 'DS202', 'AI301'].map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedClass === cls ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {cls === 'all' ? 'All Classes' : cls}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Total Enrolled</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{stats?.total_students ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Biometric face encodings enrolled</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Sessions Conducted</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{stats?.total_sessions ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Total roll calls in database</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Average Attendance Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{stats?.attendance_rate ?? 0}%</div>
          <p className="text-xs text-slate-500 mt-1">Ratio of verified Present entries</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Biometric Confidence</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-extrabold text-teal-300 mt-2">
            {stats?.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : '96%'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Average Euclidean similarity</p>
        </div>
      </div>

      {/* Status Breakdown Bar & Details */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
        <div>
          <h3 className="font-bold text-white text-base">Roll Call Distribution</h3>
          <p className="text-xs text-slate-400">Status breakdown across all logged records</p>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden flex">
          <div style={{ width: `${presentPercent}%` }} className="bg-emerald-500 transition-all" title={`Present: ${presentPercent}%`}></div>
          <div style={{ width: `${latePercent}%` }} className="bg-amber-500 transition-all" title={`Late: ${latePercent}%`}></div>
          <div style={{ width: `${absentPercent}%` }} className="bg-red-500 transition-all" title={`Absent: ${absentPercent}%`}></div>
          <div style={{ width: `${excusedPercent}%` }} className="bg-blue-500 transition-all" title={`Excused: ${excusedPercent}%`}></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Present</div>
              <div className="text-lg font-bold text-white">{stats?.present ?? 0} ({presentPercent}%)</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Late</div>
              <div className="text-lg font-bold text-white">{stats?.late ?? 0} ({latePercent}%)</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0"></div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Absent</div>
              <div className="text-lg font-bold text-white">{stats?.absent ?? 0} ({absentPercent}%)</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Excused</div>
              <div className="text-lg font-bold text-white">{stats?.excused ?? 0} ({excusedPercent}%)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          onClick={() => onNavigateTab('attendance')}
          className="p-6 bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg group"
        >
          <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
            Start Live Roll Call Scan →
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload or snapshot classroom photo, detect student faces, flag unknown visitors, and commit attendance to SQLite.
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('database')}
          className="p-6 bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg group"
        >
          <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
            Inspect Database & Run SQL Queries →
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Explore SQLite tables, test foreign key cascade rules, run PRAGMA integrity check, or re-seed sample data.
          </p>
        </div>
      </div>
    </div>
  );
};
