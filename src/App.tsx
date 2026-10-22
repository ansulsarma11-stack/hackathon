import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { FaceAttendance } from './components/FaceAttendance.tsx';
import { AttendanceCalendar } from './components/AttendanceCalendar.tsx';
import { DbInspector } from './components/DbInspector.tsx';
import { StudentRoster } from './components/StudentRoster.tsx';
import { AttendanceRecords } from './components/AttendanceRecords.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { SecurityPolicyModal } from './components/SecurityPolicyModal.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { DatabaseHealth } from './types.ts';
import { Database, ShieldCheck, Cpu, Share2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'calendar' | 'database' | 'roster' | 'records' | 'analytics'>('calendar');
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchDbHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.database) {
        setDbHealth(data.database);
      }
    } catch (err) {
      console.error('Error fetching DB health:', err);
    }
  };

  useEffect(() => {
    fetchDbHealth();
  }, [refreshTrigger]);

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbHealth={dbHealth}
        onOpenPrivacy={() => setPrivacyModalOpen(true)}
        onRefreshHealth={fetchDbHealth}
        onOpenShare={() => setShareModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'attendance' && (
          <FaceAttendance onAttendanceSaved={handleDataChanged} />
        )}

        {activeTab === 'calendar' && (
          <AttendanceCalendar onRefreshTrigger={handleDataChanged} />
        )}

        {activeTab === 'database' && (
          <DbInspector dbHealth={dbHealth} onRefreshHealth={fetchDbHealth} />
        )}

        {activeTab === 'roster' && (
          <StudentRoster onStudentChanged={handleDataChanged} />
        )}

        {activeTab === 'records' && (
          <AttendanceRecords refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'analytics' && (
          <Dashboard onNavigateTab={setActiveTab} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/80 border-t border-slate-800/80 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-400">VisionAttend Biometric Engine</span>
            <span>•</span>
            <span className="font-mono text-emerald-400">attendance.sqlite (WAL Mode)</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShareModalOpen(true)}
              className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
            >
              <Database className="w-3.5 h-3.5" />
              <span>SQL Studio</span>
            </button>
            <button
              onClick={() => setPrivacyModalOpen(true)}
              className="hover:text-teal-400 transition-colors flex items-center space-x-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Biometric Ethics</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Share App Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      {/* Privacy Safeguards Modal */}
      <SecurityPolicyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}
