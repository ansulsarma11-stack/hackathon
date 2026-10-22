import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, Play, RefreshCw, Trash2, Shield, AlertTriangle, Code2, Layers, Search, ArrowRight, Zap } from 'lucide-react';
import { DatabaseHealth } from '../types.ts';

interface DbInspectorProps {
  dbHealth: DatabaseHealth | null;
  onRefreshHealth: () => void;
}

export const DbInspector: React.FC<DbInspectorProps> = ({ dbHealth, onRefreshHealth }) => {
  const [selectedTable, setSelectedTable] = useState<'students' | 'attendance_sessions' | 'attendance' | 'users'>('students');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // SQL Studio states
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM students LIMIT 10;');
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[]; rowCount: number } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLatency, setQueryLatency] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load table data when selected table changes
  const fetchTableData = async (table: string) => {
    setLoadingTable(true);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `SELECT * FROM ${table} ORDER BY id DESC LIMIT 50;` }),
      });
      const data = await res.json();
      if (data.error) {
        console.error(data.error);
      } else {
        setTableColumns(data.columns || []);
        setTableData(data.rows || []);
      }
    } catch (err) {
      console.error('Error fetching table data:', err);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchTableData(selectedTable);
  }, [selectedTable]);

  // Execute custom SQL
  const handleExecuteSql = async (queryToRun?: string) => {
    const query = queryToRun || sqlQuery;
    if (!query.trim()) return;

    setExecuting(true);
    setQueryError(null);
    setQueryResult(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: query }),
      });
      const latency = Math.round(performance.now() - start);
      setQueryLatency(latency);

      const data = await res.json();
      if (!res.ok || data.error) {
        setQueryError(data.error || 'Failed to execute query');
      } else {
        setQueryResult(data);
        fetchTableData(selectedTable);
        onRefreshHealth();
      }
    } catch (err: any) {
      setQueryError(err.message || 'Network error running query');
    } finally {
      setExecuting(false);
    }
  };

  // Re-seed Database
  const handleResetDatabase = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/db/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Database re-seeded with fresh sample students, sessions, and attendance records!');
        setTimeout(() => setActionSuccess(null), 5000);
        fetchTableData(selectedTable);
        onRefreshHealth();
      }
    } catch (err: any) {
      setQueryError(`Error resetting database: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  // Delete row directly
  const handleDeleteRow = async (table: string, id: number) => {
    try {
      let endpoint = '';
      if (table === 'students') {
        const row = tableData.find((r) => r.id === id);
        if (row) endpoint = `/api/students/${row.student_id}`;
      } else if (table === 'attendance_sessions') {
        endpoint = `/api/sessions/${id}`;
      } else if (table === 'attendance') {
        endpoint = `/api/attendance/${id}`;
      }

      if (endpoint) {
        await fetch(endpoint, { method: 'DELETE' });
      } else {
        await fetch('/api/db/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: `DELETE FROM ${table} WHERE id = ${id};` }),
        });
      }

      setActionSuccess(`Record #${id} deleted from ${table}. Cascading constraints executed.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchTableData(selectedTable);
      onRefreshHealth();
    } catch (err: any) {
      setQueryError(`Error deleting row: ${err.message}`);
    }
  };

  const filteredRows = tableData.filter((row) => {
    if (!tableSearch) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(tableSearch.toLowerCase())
    );
  });

  return (
    <div className="space-y-8">
      {/* Top Banner: Database Health & Applied Fixes */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700/80 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span>SQLite Database Engine & Schema Inspector</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                    HEALTH: {dbHealth?.integrity_check?.toUpperCase() || 'OK'}
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Storage: <span className="font-mono text-slate-300">attendance.sqlite</span> • Engine:{' '}
                  <span className="font-mono text-emerald-400">SQLite {dbHealth?.sqlite_version || '3.x'} (WAL & Foreign Keys Enabled)</span>
                </p>
              </div>
            </div>

            {/* Fixes Summary Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center space-x-1.5 text-xs bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cascading Foreign Keys (ON DELETE CASCADE)</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 text-xs bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Atomic Upserts (ON CONFLICT DO UPDATE)</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 text-xs bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Session Validation on Batch Commit</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 text-xs bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Safe Context Connection Management</span>
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleExecuteSql('PRAGMA integrity_check;')}
              className="flex items-center space-x-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3.5 py-2 rounded-lg transition-colors"
            >
              <Shield className="w-4 h-4 text-teal-400" />
              <span>Verify Integrity</span>
            </button>
            <button
              onClick={handleResetDatabase}
              disabled={resetting}
              className="flex items-center space-x-2 text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Resetting...' : 'Re-Seed Demo Data'}</span>
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
      </div>

      {/* Row Count Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'students', label: 'Registered Students', count: dbHealth?.table_counts?.students ?? 0, color: 'text-blue-400', desc: 'Biometric 128-d profiles' },
          { key: 'attendance_sessions', label: 'Attendance Sessions', count: dbHealth?.table_counts?.attendance_sessions ?? 0, color: 'text-purple-400', desc: 'Class roll-call events' },
          { key: 'attendance', label: 'Attendance Logs', count: dbHealth?.table_counts?.attendance ?? 0, color: 'text-emerald-400', desc: 'Audit verified records' },
          { key: 'users', label: 'Staff Accounts', count: dbHealth?.table_counts?.users ?? 0, color: 'text-amber-400', desc: 'Teachers & Admins' },
        ].map((item) => (
          <div
            key={item.key}
            onClick={() => setSelectedTable(item.key as any)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedTable === item.key
                ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-slate-400">{item.label}</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className={`text-2xl font-bold mt-1 ${item.color}`}>{item.count}</div>
            <p className="text-xs text-slate-500 mt-1 font-mono">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Interactive SQL Studio */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white text-sm">Interactive SQL Studio (Query Runner)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">SQLite WebAssembly ACID Transaction Engine</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 py-1 font-medium">Quick Queries:</span>
            {[
              {
                label: 'PRAGMA integrity_check',
                sql: 'PRAGMA integrity_check;',
              },
              {
                label: 'Student Enrolments by Class',
                sql: 'SELECT class_name, COUNT(*) as enrolled_students FROM students GROUP BY class_name;',
              },
              {
                label: 'Recent Attendance with Student Info',
                sql: `SELECT a.id, a.student_id, COALESCE(s.full_name, a.student_id) as student_name, a.class_name, a.status, a.confidence, a.attendance_date 
FROM attendance a 
LEFT JOIN students s ON a.student_id = s.student_id 
ORDER BY a.id DESC LIMIT 10;`,
              },
              {
                label: 'Audit Attendance Rate by Session',
                sql: `SELECT s.session_name, s.class_name, s.session_date, COUNT(a.id) as total_students,
SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count
FROM attendance_sessions s
LEFT JOIN attendance a ON s.id = a.session_id
GROUP BY s.id;`,
              },
              {
                label: 'Test Foreign Key Integrity',
                sql: 'PRAGMA foreign_key_check;',
              },
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSqlQuery(preset.sql);
                  handleExecuteSql(preset.sql);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* SQL Input Box */}
          <div className="relative">
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={3}
              placeholder="Enter any SQLite query (SELECT, INSERT, UPDATE, DELETE, PRAGMA)..."
              className="w-full bg-slate-950 font-mono text-xs text-emerald-300 p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <button
                onClick={() => handleExecuteSql()}
                disabled={executing}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded shadow transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{executing ? 'Executing...' : 'Run Query'}</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {queryError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>SQL Execution Error: {queryError}</span>
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Returned <strong className="text-white">{queryResult.rowCount}</strong> rows
                </span>
                {queryLatency !== null && <span className="font-mono">Execution time: {queryLatency}ms</span>}
              </div>

              <div className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950">
                {queryResult.rows.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Query executed successfully with no returned rows.</div>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 sticky top-0 border-b border-slate-800">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-3 py-2 text-slate-300 font-semibold uppercase tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {queryResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/60 transition-colors">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="px-3 py-2 text-slate-300 truncate max-w-xs">
                              {String(row[col] ?? 'NULL')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Data Viewer */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        {/* Table Selector Header */}
        <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-medium">Browse Table:</span>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-700/80">
              {(['students', 'attendance_sessions', 'attendance', 'users'] as const).map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  className={`px-3 py-1 text-xs rounded-md font-mono transition-colors ${
                    selectedTable === tbl ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={`Search ${selectedTable}...`}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
              />
            </div>
            <button
              onClick={() => fetchTableData(selectedTable)}
              title="Refresh table"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTable ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loadingTable ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading table data...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No records found in table "{selectedTable}".</div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col} className="px-4 py-3 text-slate-300 font-semibold">
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-slate-300 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    {tableColumns.map((col) => {
                      const val = row[col];
                      const isEncoding = col === 'face_encoding';
                      return (
                        <td key={col} className="px-4 py-2.5 text-slate-300 truncate max-w-xs">
                          {isEncoding ? (
                            <span className="text-emerald-400/90 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-emerald-500/20">
                              [128-d Biometric Vector]
                            </span>
                          ) : col === 'status' ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                val === 'Present'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : val === 'Late'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : val === 'Absent'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {val}
                            </span>
                          ) : (
                            String(val ?? 'NULL')
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right">
                      {row.id && (
                        <button
                          onClick={() => handleDeleteRow(selectedTable, row.id)}
                          title="Delete row (tests cascade delete)"
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
