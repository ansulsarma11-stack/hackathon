import React, { useState } from 'react';
import { X, Share2, Copy, Check, ExternalLink, Globe, Smartphone, Sparkles } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use the canonical public shared URL or fallback to current window location
  const publicShareUrl =
    typeof window !== 'undefined' && window.location.origin.includes('localhost')
      ? 'https://ais-pre-onxn2rn7ey5wtzhr5nequz-55206379801.asia-southeast1.run.app'
      : typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-onxn2rn7ey5wtzhr5nequz-55206379801.asia-southeast1.run.app';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicShareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = publicShareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Share VisionAttend App</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                Live Cloud Link
              </span>
            </h3>
            <p className="text-xs text-slate-400">Send this link to anyone to view and test the application</p>
          </div>
        </div>

        {/* Public Link Card */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>Public Shareable URL</span>
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">Ready to view</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicShareUrl}
              className="flex-1 bg-slate-900 border border-slate-700/80 text-xs text-slate-200 rounded-lg px-3 py-2.5 font-mono select-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* How others can use it */}
        <div className="space-y-3 mb-6 text-xs text-slate-300">
          <div className="flex items-start space-x-3 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-200">No Installation Needed</p>
              <p className="text-slate-400 text-[11px]">
                Anyone with this link can open the app in any browser (Chrome, Safari, Edge, Firefox) on laptop, tablet, or mobile phone.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
            <Smartphone className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-200">Mobile Camera & Real-Time Biometrics</p>
              <p className="text-slate-400 text-[11px]">
                Users can test classroom attendance scanning, see monthly and all-over-year annual attendance percentages, and download PDF reports.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors"
          >
            Close
          </button>
          <a
            href={publicShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 rounded-lg transition-all shadow-md shadow-emerald-500/20"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
