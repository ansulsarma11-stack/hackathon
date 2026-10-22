import React from 'react';
import { ShieldCheck, Lock, EyeOff, FileText, UserCheck, Trash2 } from 'lucide-react';

interface SecurityPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityPolicyModal: React.FC<SecurityPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Biometric Ethics & Privacy Safeguards</h2>
              <p className="text-xs text-slate-400">FERPA, GDPR, and Responsible AI Compliance</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>128-Dimensional Irreversible Biometric Descriptors</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Student face data is translated into mathematical 128-dimensional Euclidean feature vectors stored inside
              SQLite. The raw biological template cannot be mathematically reconstructed from these numbers, safeguarding
              student biometric identities.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <EyeOff className="w-4 h-4 text-amber-400" />
              <span>Unknown Faces Are Never Misattributed</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Any individual face detected in the classroom whose Euclidean distance exceeds the tolerance threshold
              (0.55) is tagged as an <strong>[Unknown Face]</strong>. The system will never hallucinate or force-match an
              enrolled student to an unidentified person.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>Human-in-the-Loop Review & Justification Auditing</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Automated AI detections serve as roll-call recommendations. Teachers retain full authority to review, override,
              and adjust attendance status. Manual adjustments are permanently stamped in SQLite with the teacher's audit note.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>Right to Erasure & Cascading Deletion</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              When a student profile is deleted, SQLite's cascading foreign key constraints (
              <code className="text-emerald-400 font-mono">ON DELETE CASCADE</code>) automatically and permanently purge all
              associated biometric vectors and historic attendance records from the database.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-colors"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
