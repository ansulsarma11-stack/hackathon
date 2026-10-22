import React from 'react';
import { Camera, Calendar, Database, Users, ClipboardList, BarChart3, ShieldCheck, RefreshCw, CheckCircle2, Share2 } from 'lucide-react';
import { DatabaseHealth } from '../types.ts';

interface NavbarProps {
  activeTab: 'attendance' | 'calendar' | 'database' | 'roster' | 'records' | 'analytics';
  setActiveTab: (tab: 'attendance' | 'calendar' | 'database' | 'roster' | 'records' | 'analytics') => void;
  dbHealth: DatabaseHealth | null;
  onOpenPrivacy: () => void;
  onRefreshHealth: () => void;
  onOpenShare: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  dbHealth,
  onOpenPrivacy,
  onRefreshHealth,
  onOpenShare,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Camera className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  VisionAttend
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SQLite
                </span>
              </div>
              <p className="text-xs text-slate-400">Biometric Attendance & Database Engine</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Take Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar & Annual %</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database & SQL</span>
              {dbHealth && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('roster')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'roster'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Student Roster</span>
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'records'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Attendance History</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
          </nav>

          {/* Right Status & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Share Link Button */}
            <button
              onClick={onOpenShare}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              title="Share live link to show others"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share Link</span>
            </button>

            <button
              onClick={onOpenPrivacy}
              title="Biometric Privacy & Safeguards"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </button>

            {/* DB Health Pill */}
            <button
              onClick={onRefreshHealth}
              title="Click to re-verify SQLite DB Health"
              className="hidden lg:flex items-center space-x-2 text-xs bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-mono">
                DB: {dbHealth?.status === 'ok' ? 'Online' : 'Checking...'}
              </span>
            </button>

            {/* User Pill */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-800/60 pl-2 pr-3 py-1 rounded-full border border-slate-700/60">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                EV
              </div>
              <span className="text-xs font-medium text-slate-200">Prof. Vance</span>
            </div>
          </div>
        </div>

        {/* Mobile Submenu */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-1 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'attendance' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'calendar' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            Calendar & Annual %
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'database' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            Database & SQL
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'roster' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'records' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}
          >
            Analytics
          </button>
        </div>
      </div>
    </header>
  );
};
