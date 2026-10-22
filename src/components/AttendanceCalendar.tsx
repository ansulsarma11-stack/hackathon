import React, { useState, useEffect } from 'react';
import {
  CalendarDayData,
  MonthlyCalendarResponse,
  YearlyCalendarResponse,
  Student
} from '../types.ts';
import {
  downloadAttendancePdf,
  downloadYearlyAttendancePdf
} from '../utils/pdfGenerator.ts';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart3,
  CalendarDays,
  Percent,
  Layers,
  Award,
  AlertTriangle
} from 'lucide-react';

interface AttendanceCalendarProps {
  onRefreshTrigger?: () => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = () => {
  // Navigation & View Mode
  const [timeframeMode, setTimeframeMode] = useState<'month' | 'year'>('month');
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(10); // Default to October 2026

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'class' | 'student'>('class');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  // Data states
  const [calendarData, setCalendarData] = useState<MonthlyCalendarResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyCalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Selected Day Modal (for monthly view)
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);

  // Fetch student roster for student-specific filter
  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data) => {
        if (data.students) setStudents(data.students);
      })
      .catch((err) => console.error('Error fetching students for calendar:', err));
  }, []);

  // Fetch Monthly Calendar Data
  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      let url = `/api/calendar/month?year=${currentYear}&month=${currentMonth}`;
      if (selectedClass !== 'all') url += `&class_name=${encodeURIComponent(selectedClass)}`;
      if (viewMode === 'student' && selectedStudentId !== 'all') {
        url += `&student_id=${encodeURIComponent(selectedStudentId)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setCalendarData(data);
    } catch (err) {
      console.error('Error fetching monthly calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Annual (All Over Year) Data
  const fetchYearlyData = async () => {
    setLoading(true);
    try {
      let url = `/api/calendar/year?year=${currentYear}`;
      if (selectedClass !== 'all') url += `&class_name=${encodeURIComponent(selectedClass)}`;
      if (viewMode === 'student' && selectedStudentId !== 'all') {
        url += `&student_id=${encodeURIComponent(selectedStudentId)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setYearlyData(data);
    } catch (err) {
      console.error('Error fetching annual calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger data fetches
  useEffect(() => {
    if (timeframeMode === 'month') {
      fetchMonthlyData();
    } else {
      fetchYearlyData();
    }
  }, [timeframeMode, currentYear, currentMonth, selectedClass, viewMode, selectedStudentId]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(10);
  };

  // Calendar matrix calculation
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  // Target student label helper
  const getScopeLabel = () => {
    if (viewMode === 'student' && selectedStudentId !== 'all') {
      const target = students.find((s) => s.student_id === selectedStudentId);
      return target ? `${target.full_name} (${target.student_id})` : selectedStudentId;
    }
    return selectedClass === 'all' ? 'All Classes' : selectedClass;
  };

  // Export whole month as PDF
  const handleExportMonthPdf = () => {
    if (!calendarData) return;
    const allRecords = Object.values(calendarData.days).flatMap((d) => d.records);
    if (allRecords.length === 0) {
      setFeedbackMessage('No attendance records found for this month to generate PDF.');
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    downloadAttendancePdf(
      {
        records: allRecords,
        className: getScopeLabel(),
        monthName: `${calendarData.monthName} ${currentYear}`,
        generatedBy: 'Prof. Eleanor Vance',
      },
      `VisionAttend_${calendarData.monthName}_${currentYear}_Report.pdf`
    );
  };

  // Export annual (all over year) attendance report as PDF
  const handleExportYearPdf = () => {
    if (!yearlyData) return;
    if (yearlyData.total_records === 0) {
      setFeedbackMessage('No attendance records logged across this year to generate PDF.');
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    downloadYearlyAttendancePdf(
      {
        yearlyData,
        scopeLabel: getScopeLabel(),
        generatedBy: 'Prof. Eleanor Vance',
      },
      `VisionAttend_Annual_Attendance_${currentYear}_Report.pdf`
    );
  };

  // Export selected day as PDF
  const handleExportDayPdf = () => {
    if (!selectedDay || selectedDay.records.length === 0) return;
    downloadAttendancePdf(
      {
        records: selectedDay.records,
        className: getScopeLabel(),
        dateFilter: selectedDay.date,
        generatedBy: 'Prof. Eleanor Vance',
      },
      `VisionAttend_Attendance_${selectedDay.date}.pdf`
    );
  };

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isTodayDate = (dayNum: number) => {
    return currentYear === 2026 && currentMonth === 10 && dayNum === 22;
  };

  // Helper for attendance rating badge
  const getRateBadge = (rate: number) => {
    if (rate >= 85) {
      return {
        label: 'Excellent Standing',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        badgeColor: 'bg-emerald-500',
      };
    }
    if (rate >= 70) {
      return {
        label: 'Good Standing',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        badgeColor: 'bg-amber-500',
      };
    }
    return {
      label: 'Attention Required',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      badgeColor: 'bg-rose-500',
    };
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast Banner */}
      {feedbackMessage && (
        <div className="bg-amber-950/80 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-amber-400 hover:text-white ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Main Banner & Controls */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span>Attendance Analytics & Calendar</span>
                </h1>
                <p className="text-xs text-slate-400">
                  {timeframeMode === 'month'
                    ? 'Month-by-month calendar distribution, daily roll calls & official PDF export.'
                    : 'Annual academic overview showing total attendance percentage and 12-month progress.'}
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Mode Selector: Monthly vs All Over Year */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setTimeframeMode('month')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeframeMode === 'month'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Monthly Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeframeMode('year')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeframeMode === 'year'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>All Over Year (Annual %)</span>
              </button>
            </div>

            {/* Stepper (Year or Month) */}
            {timeframeMode === 'month' ? (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1 text-xs font-bold text-white font-mono min-w-[130px] text-center">
                  {calendarData?.monthName || 'Month'} {currentYear}
                </div>
                <button
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                <button
                  onClick={() => setCurrentYear((y) => y - 1)}
                  title="Previous Year"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-4 py-1 text-xs font-bold text-white font-mono min-w-[90px] text-center">
                  Year {currentYear}
                </div>
                <button
                  onClick={() => setCurrentYear((y) => y + 1)}
                  title="Next Year"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {timeframeMode === 'month' && (
              <button
                onClick={handleToday}
                className="text-xs font-semibold px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Today
              </button>
            )}

            {/* Official PDF Export Button */}
            {timeframeMode === 'month' ? (
              <button
                onClick={handleExportMonthPdf}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Export Month PDF</span>
              </button>
            ) : (
              <button
                onClick={handleExportYearPdf}
                className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Export Annual PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          {/* Class Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Filter by Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Classes (Full School)</option>
              <option value="CS101">CS101: Computer Architecture</option>
              <option value="DS202">DS202: Data Science & ML</option>
              <option value="AI301">AI301: Artificial Intelligence</option>
            </select>
          </div>

          {/* View Mode: Class vs Student */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Audience Scope
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('class')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'class'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Class-wide
              </button>
              <button
                type="button"
                onClick={() => setViewMode('student')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'student'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Individual Student
              </button>
            </div>
          </div>

          {/* Student Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              {viewMode === 'student' ? 'Selected Student Record' : 'Enrollment Scope'}
            </label>
            {viewMode === 'student' ? (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-slate-950 border border-emerald-500 text-xs text-white px-3 py-2 rounded-xl focus:outline-none"
              >
                <option value="all">Select student for individual audit...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.student_id}>
                    {s.full_name} ({s.student_id} • {s.class_name})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 py-2 italic flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Aggregating all enrolled attendees</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIMEFRAME MODE 1: ALL OVER YEAR (ANNUAL ATTENDANCE PERCENTAGE VIEW)       */}
      {/* ========================================================================= */}
      {timeframeMode === 'year' && (
        <div className="space-y-6">
          {/* Hero Annual Rate Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Prominent Annual Percentage */}
              <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80">
                {/* Radial Gauge Visual */}
                <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-slate-800"
                      fill="transparent"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={364.4}
                      strokeDashoffset={
                        364.4 - (364.4 * (yearlyData?.annual_attendance_rate ?? 0)) / 100
                      }
                      strokeLinecap="round"
                      className={
                        (yearlyData?.annual_attendance_rate ?? 0) >= 85
                          ? 'text-emerald-400'
                          : (yearlyData?.annual_attendance_rate ?? 0) >= 70
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-white tracking-tight">
                      {yearlyData?.annual_attendance_rate ?? 0}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Annual %
                    </span>
                  </div>
                </div>

                {/* Score Summary */}
                <div className="space-y-2 text-center sm:text-left">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {getRateBadge(yearlyData?.annual_attendance_rate ?? 0).label}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    Year {currentYear} Overall Attendance
                  </h2>
                  <p className="text-xs text-slate-400">
                    Calculated across all {yearlyData?.total_records ?? 0} verification events in {currentYear}.
                  </p>
                </div>
              </div>

              {/* Right Column: Key Annual Metrics Grid */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Logs
                  </span>
                  <div className="text-2xl font-bold text-white mt-1">
                    {yearlyData?.total_records ?? 0}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Database entries</p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Days Active
                  </span>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">
                    {yearlyData?.total_days_active ?? 0}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Academic dates</p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Sessions Held
                  </span>
                  <div className="text-2xl font-bold text-purple-400 mt-1">
                    {yearlyData?.total_sessions ?? 0}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Class roll calls</p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Present Logs
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {yearlyData?.present ?? 0}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Late: {yearlyData?.late ?? 0} • Absent: {yearlyData?.absent ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Status Bar Breakdown */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Annual Distribution Breakdown:</span>
                <div className="flex items-center space-x-4">
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                    <span>Present ({yearlyData?.present ?? 0})</span>
                  </span>
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                    <span>Late ({yearlyData?.late ?? 0})</span>
                  </span>
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                    <span>Absent ({yearlyData?.absent ?? 0})</span>
                  </span>
                  <span className="inline-flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                    <span>Excused ({yearlyData?.excused ?? 0})</span>
                  </span>
                </div>
              </div>

              {/* Progress Bar Stack */}
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex">
                {yearlyData && yearlyData.total_records > 0 ? (
                  <>
                    <div
                      style={{
                        width: `${(yearlyData.present / yearlyData.total_records) * 100}%`,
                      }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Present: ${yearlyData.present}`}
                    />
                    <div
                      style={{
                        width: `${(yearlyData.late / yearlyData.total_records) * 100}%`,
                      }}
                      className="bg-amber-500 h-full transition-all"
                      title={`Late: ${yearlyData.late}`}
                    />
                    <div
                      style={{
                        width: `${(yearlyData.absent / yearlyData.total_records) * 100}%`,
                      }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Absent: ${yearlyData.absent}`}
                    />
                    <div
                      style={{
                        width: `${(yearlyData.excused / yearlyData.total_records) * 100}%`,
                      }}
                      className="bg-sky-500 h-full transition-all"
                      title={`Excused: ${yearlyData.excused}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-800 h-full" />
                )}
              </div>
            </div>
          </div>

          {/* 12-Month Detailed Grid (January through December) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>12-Month Attendance Percentage Breakdown ({currentYear})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Click on any month to open its calendar roll call view.
                </p>
              </div>

              <div className="text-xs font-mono text-slate-500">
                Scope: <span className="text-slate-300 font-semibold">{getScopeLabel()}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {yearlyData?.months.map((m) => {
                const hasData = m.total_records > 0;
                let rateColor = 'text-emerald-400';
                let barColor = 'bg-emerald-500';

                if (hasData) {
                  if (m.attendance_rate < 70) {
                    rateColor = 'text-rose-400';
                    barColor = 'bg-rose-500';
                  } else if (m.attendance_rate < 85) {
                    rateColor = 'text-amber-400';
                    barColor = 'bg-amber-500';
                  }
                }

                return (
                  <div
                    key={m.month}
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-600 group ${
                      hasData
                        ? 'border-slate-800 shadow-lg hover:shadow-emerald-500/5'
                        : 'border-slate-800/50 bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Month Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                            Month {m.month < 10 ? `0${m.month}` : m.month}
                          </span>
                          <h4 className="text-sm font-bold text-white">{m.monthName}</h4>
                        </div>

                        {hasData ? (
                          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {m.total_sessions} Session{m.total_sessions > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No Sessions</span>
                        )}
                      </div>

                      {/* Percentage Display */}
                      <div className="py-4">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-xs text-slate-400 font-medium">Monthly Rate:</span>
                          <span className={`text-2xl font-black font-mono tracking-tight ${hasData ? rateColor : 'text-slate-600'}`}>
                            {hasData ? `${m.attendance_rate}%` : '—'}
                          </span>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${hasData ? m.attendance_rate : 0}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          />
                        </div>
                      </div>

                      {/* Month Detailed Counts */}
                      {hasData ? (
                        <div className="grid grid-cols-3 gap-1 py-2 text-center bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs font-mono">
                          <div className="p-1">
                            <span className="text-[10px] text-slate-500 block">Present</span>
                            <span className="font-bold text-emerald-400">{m.present}</span>
                          </div>
                          <div className="p-1 border-x border-slate-800/60">
                            <span className="text-[10px] text-slate-500 block">Late</span>
                            <span className="font-bold text-amber-400">{m.late}</span>
                          </div>
                          <div className="p-1">
                            <span className="text-[10px] text-slate-500 block">Absent</span>
                            <span className="font-bold text-rose-400">{m.absent}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-3 text-center text-xs text-slate-600 italic">
                          Term recess / inactive
                        </div>
                      )}
                    </div>

                    {/* Drill-down action button */}
                    <div className="pt-4 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentMonth(m.month);
                          setTimeframeMode('month');
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer group-hover:bg-slate-700"
                      >
                        <span>View {m.monthName} Calendar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIMEFRAME MODE 2: MONTHLY ATTENDANCE CALENDAR VIEW                        */}
      {/* ========================================================================= */}
      {timeframeMode === 'month' && (
        <div className="space-y-6">
          {/* Monthly Statistics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Days
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {calendarData?.summary?.total_days_active ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Classes logged this month</p>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Sessions
              </span>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {calendarData?.summary?.total_sessions ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Roll call events recorded</p>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Logs
              </span>
              <div className="text-2xl font-bold text-blue-400 mt-1">
                {calendarData?.summary?.total_records ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Verified database entries</p>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Present Count
              </span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {calendarData?.summary?.present ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Late: {calendarData?.summary?.late ?? 0} • Absent: {calendarData?.summary?.absent ?? 0}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Month Rate %
                </span>
                <button
                  type="button"
                  onClick={() => setTimeframeMode('year')}
                  title="Switch to full year view"
                  className="text-[10px] text-emerald-400 hover:underline flex items-center space-x-0.5"
                >
                  <span>See Year</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="text-2xl font-bold text-teal-300 mt-1">
                {calendarData?.summary?.attendance_rate ?? 0}%
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Monthly average rate</p>
            </div>
          </div>

          {/* Main Monthly Calendar Grid */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800 text-center font-mono text-xs font-semibold text-slate-400 py-3">
              {weekDayNames.map((wd, i) => (
                <div key={wd} className={i === 0 || i === 6 ? 'text-slate-600' : ''}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/80 bg-slate-950/40">
              {/* Empty prefix cells for days before the 1st */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[105px] bg-slate-950/70 p-2 opacity-30 select-none"
                />
              ))}

              {/* Actual days of current month */}
              {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateStr = `${currentYear}-${
                  currentMonth < 10 ? `0${currentMonth}` : currentMonth
                }-${dayNum < 10 ? `0${dayNum}` : dayNum}`;
                const dayData = calendarData?.days[dateStr];
                const hasData = dayData && (dayData.sessions.length > 0 || dayData.total > 0);
                const isToday = isTodayDate(dayNum);

                let rateColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                if (dayData && dayData.rate < 75) {
                  rateColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
                } else if (dayData && dayData.rate < 90) {
                  rateColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                }

                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      if (hasData) setSelectedDay(dayData);
                    }}
                    className={`min-h-[105px] p-2.5 transition-all flex flex-col justify-between group ${
                      hasData
                        ? 'cursor-pointer hover:bg-slate-850 hover:border-emerald-500/50'
                        : 'bg-slate-950/30 opacity-70'
                    } ${isToday ? 'ring-2 ring-emerald-500/40 bg-emerald-950/10' : ''}`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-emerald-500 text-slate-950'
                            : hasData
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {isToday && (
                        <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                          Today
                        </span>
                      )}

                      {hasData && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rateColor}`}
                        >
                          {dayData.rate}%
                        </span>
                      )}
                    </div>

                    {/* Day Content */}
                    {hasData ? (
                      <div className="space-y-1 mt-1 text-[11px]">
                        {/* Session Pills */}
                        {dayData.sessions.slice(0, 1).map((s) => (
                          <div
                            key={s.id}
                            className="truncate text-[10px] font-medium text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                            title={s.name}
                          >
                            {s.name}
                          </div>
                        ))}

                        {/* Breakdown Counts */}
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono pt-1">
                          <span className="text-emerald-400 font-semibold">{dayData.present}P</span>
                          <span>•</span>
                          <span className="text-amber-400">{dayData.late}L</span>
                          <span>•</span>
                          <span className="text-rose-400">{dayData.absent}A</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 italic">No classes</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected Day Details Drawer / Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl my-8 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-white text-lg">
                    Roll Call Details: {selectedDay.date}
                  </h3>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/30">
                    {selectedDay.rate}% Attendance
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedDay.sessions.length} session(s) conducted • {selectedDay.records.length} student records
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportDayPdf}
                  className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Day PDF</span>
                </button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-slate-400 hover:text-white text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sessions on this date */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Sessions Conducted:
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedDay.sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center space-x-2 text-slate-300"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <strong className="text-white font-mono">#{sess.id}</strong>
                    <span>{sess.name}</span>
                    <span className="text-slate-500 font-mono">({sess.class_name})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Roll Call Records Table */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-slate-300">Student ID</th>
                    <th className="px-3 py-2 text-slate-300">Name</th>
                    <th className="px-3 py-2 text-slate-300">Class</th>
                    <th className="px-3 py-2 text-slate-300">Status</th>
                    <th className="px-3 py-2 text-slate-300">Confidence</th>
                    <th className="px-3 py-2 text-slate-300">Time</th>
                    <th className="px-3 py-2 text-slate-300">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {selectedDay.records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-3 py-2 text-slate-400 font-bold">{r.student_id}</td>
                      <td className="px-3 py-2 text-white font-sans font-medium">{r.student_name}</td>
                      <td className="px-3 py-2 text-slate-400">{r.class_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.status === 'Present'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : r.status === 'Late'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : r.status === 'Absent'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{Math.round(r.confidence * 100)}%</td>
                      <td className="px-3 py-2 text-slate-400">{r.attendance_time}</td>
                      <td className="px-3 py-2 text-slate-400 font-sans text-[11px] truncate max-w-xs">
                        {r.audit_note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedDay(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
