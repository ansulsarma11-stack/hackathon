import React, { useState } from 'react';
import { FaceDetection } from '../types.ts';
import { UserCheck, HelpCircle, AlertOctagon, Info } from 'lucide-react';

interface ClassroomCanvasProps {
  imageSrc: string;
  detections: FaceDetection[];
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
}

export const ClassroomCanvas: React.FC<ClassroomCanvasProps> = ({
  imageSrc,
  detections,
  selectedBoxId,
  onSelectBox,
}) => {
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);

  const selectedDetection = detections.find((d) => d.boxId === selectedBoxId);

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group select-none">
        {/* Background Classroom Image */}
        <img
          src={imageSrc}
          alt="Classroom Roll Call Scan"
          className="w-full h-full object-cover"
        />

        {/* SVG Overlay for Bounding Boxes */}
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {detections.map((det) => {
            const { ymin, xmin, ymax, xmax } = det.box;
            const width = xmax - xmin;
            const height = ymax - ymin;
            const isSelected = selectedBoxId === det.boxId;
            const isHovered = hoveredBoxId === det.boxId;

            let strokeColor = '#10b981'; // Green for recognized
            let fillColor = 'rgba(16, 185, 129, 0.15)';
            if (det.matchType === 'uncertain') {
              strokeColor = '#f59e0b'; // Amber
              fillColor = 'rgba(245, 158, 11, 0.15)';
            } else if (det.matchType === 'unknown') {
              strokeColor = '#ef4444'; // Red
              fillColor = 'rgba(239, 68, 68, 0.2)';
            }

            return (
              <g key={det.boxId}>
                {/* Bounding Rectangle */}
                <rect
                  x={xmin}
                  y={ymin}
                  width={width}
                  height={height}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected || isHovered ? 4 : 2.5}
                  strokeDasharray={det.matchType === 'unknown' ? '8,4' : undefined}
                  rx="6"
                  className="transition-all duration-150"
                />

                {/* Corner Accents */}
                <circle cx={xmin} cy={ymin} r={isSelected ? 6 : 4} fill={strokeColor} />
                <circle cx={xmax} cy={ymin} r={isSelected ? 6 : 4} fill={strokeColor} />
                <circle cx={xmin} cy={ymax} r={isSelected ? 6 : 4} fill={strokeColor} />
                <circle cx={xmax} cy={ymax} r={isSelected ? 6 : 4} fill={strokeColor} />
              </g>
            );
          })}
        </svg>

        {/* Clickable HTML Bounding Boxes for Interaction */}
        <div className="absolute inset-0">
          {detections.map((det) => {
            const { ymin, xmin, ymax, xmax } = det.box;
            const isSelected = selectedBoxId === det.boxId;

            return (
              <div
                key={det.boxId}
                style={{
                  top: `${ymin / 10}%`,
                  left: `${xmin / 10}%`,
                  width: `${(xmax - xmin) / 10}%`,
                  height: `${(ymax - ymin) / 10}%`,
                }}
                onClick={() => onSelectBox(isSelected ? null : det.boxId)}
                onMouseEnter={() => setHoveredBoxId(det.boxId)}
                onMouseLeave={() => setHoveredBoxId(null)}
                className="absolute cursor-pointer pointer-events-auto"
              >
                {/* Top Badge */}
                <div
                  className={`absolute -top-7 left-0 whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-semibold flex items-center space-x-1 shadow-md transition-transform ${
                    det.matchType === 'recognized'
                      ? 'bg-emerald-600 text-white'
                      : det.matchType === 'uncertain'
                      ? 'bg-amber-600 text-white'
                      : 'bg-red-600 text-white animate-pulse'
                  } ${isSelected ? 'scale-110 -top-8 z-20' : 'z-10'}`}
                >
                  {det.matchType === 'recognized' ? (
                    <UserCheck className="w-3 h-3" />
                  ) : det.matchType === 'uncertain' ? (
                    <HelpCircle className="w-3 h-3" />
                  ) : (
                    <AlertOctagon className="w-3 h-3" />
                  )}
                  <span>{det.studentName}</span>
                  <span className="opacity-80 text-[10px]">({Math.round(det.confidence * 100)}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] flex items-center space-x-4 text-slate-300">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Recognized</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Review Match</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-300 font-semibold">Unknown Face</span>
          </div>
        </div>
      </div>

      {/* Selected Box Biometric Details Callout */}
      {selectedDetection && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            selectedDetection.matchType === 'recognized'
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : selectedDetection.matchType === 'uncertain'
              ? 'bg-amber-950/40 border-amber-500/40'
              : 'bg-red-950/40 border-red-500/40'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                  selectedDetection.matchType === 'recognized'
                    ? 'bg-emerald-500 text-slate-950'
                    : selectedDetection.matchType === 'uncertain'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-red-500 text-white'
                }`}
              >
                {selectedDetection.matchType === 'unknown' ? '?' : selectedDetection.studentName.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                  <span>{selectedDetection.studentName}</span>
                  {selectedDetection.studentId && (
                    <span className="font-mono text-xs text-slate-400">({selectedDetection.studentId})</span>
                  )}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">{selectedDetection.reasoning}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono text-slate-400">
                Confidence:{' '}
                <strong className="text-white font-bold">{Math.round(selectedDetection.confidence * 100)}%</strong>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Euclidean Dist: <strong className="text-slate-300">{selectedDetection.distance.toFixed(3)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
