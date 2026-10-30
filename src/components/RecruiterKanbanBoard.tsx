import React from 'react';
import {
  Users,
  Star,
  Tag,
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertOctagon,
  Eye,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { PipelineStage } from '../types';
import { PIPELINE_STAGES, ORDERED_PIPELINE_STAGES } from '../utils/recruiterPipelineHelpers';

interface KanbanCandidateItem {
  id?: string;
  filename: string;
  candidateName: string;
  overallScore: number | null;
  weightedScore?: number | null;
  dynamicRank?: number | null;
  isKnockedOut?: boolean;
  knockoutReason?: string;
  matchLevel: string;
  pipelineStage?: PipelineStage;
  notes?: string;
  rating?: number;
  tags?: string[];
  [key: string]: any;
}

interface RecruiterKanbanBoardProps {
  candidates: KanbanCandidateItem[];
  onSelectCandidate: (candidate: KanbanCandidateItem) => void;
  onChangeStage: (idOrFilename: string, newStage: PipelineStage) => void;
  onOpenNotes: (candidate: KanbanCandidateItem) => void;
  isEn: boolean;
}

export const RecruiterKanbanBoard: React.FC<RecruiterKanbanBoardProps> = ({
  candidates,
  onSelectCandidate,
  onChangeStage,
  onOpenNotes,
  isEn
}) => {
  const getStageCandidates = (stage: PipelineStage) => {
    return candidates.filter((c) => (c.pipelineStage || 'INBOX') === stage);
  };

  const getNextStage = (current: PipelineStage): PipelineStage | null => {
    const idx = ORDERED_PIPELINE_STAGES.indexOf(current);
    if (idx >= 0 && idx < ORDERED_PIPELINE_STAGES.length - 1) {
      return ORDERED_PIPELINE_STAGES[idx + 1];
    }
    return null;
  };

  const getPrevStage = (current: PipelineStage): PipelineStage | null => {
    const idx = ORDERED_PIPELINE_STAGES.indexOf(current);
    if (idx > 0) {
      return ORDERED_PIPELINE_STAGES[idx - 1];
    }
    return null;
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 min-w-[900px]">
        {ORDERED_PIPELINE_STAGES.map((stageKey) => {
          const cfg = PIPELINE_STAGES[stageKey];
          const stageList = getStageCandidates(stageKey);

          return (
            <div
              key={stageKey}
              className={`rounded-2xl border ${cfg.borderClass} ${cfg.bgLightClass}/50 flex flex-col max-h-[800px] overflow-hidden shadow-xs`}
            >
              {/* Column Header */}
              <div className="p-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.badgeClass.split(' ')[0]}`} />
                  <h4 className="text-xs font-black text-slate-800 tracking-tight">
                    {isEn ? cfg.labelEn : cfg.labelVi}
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
                  {stageList.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {stageList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    {isEn ? 'No candidates in this stage' : 'Chưa có ứng viên ở giai đoạn này'}
                  </div>
                ) : (
                  stageList.map((cand) => {
                    const score = cand.weightedScore ?? cand.overallScore;
                    const next = getNextStage(stageKey);
                    const prev = getPrevStage(stageKey);

                    return (
                      <div
                        key={cand.id || cand.filename}
                        className="bg-white rounded-xl border border-slate-200/90 hover:border-indigo-400 p-3 shadow-xs hover:shadow-md transition-all space-y-2.5 group"
                      >
                        {/* Top row: Rank & Score */}
                        <div className="flex items-center justify-between">
                          {cand.isKnockedOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                              <AlertOctagon className="w-3 h-3" />
                              <span>{isEn ? 'Disqualified' : 'Loại sàn'}</span>
                            </span>
                          ) : typeof cand.dynamicRank === 'number' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                              #{cand.dynamicRank}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-600">
                              —
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-indigo-600">
                              {typeof score === 'number' ? `${score}%` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Candidate Name & filename */}
                        <div
                          onClick={() => onSelectCandidate(cand)}
                          className="cursor-pointer hover:text-indigo-600 transition-colors"
                        >
                          <h5 className="text-xs font-black text-slate-900 line-clamp-1">
                            {cand.candidateName || cand.filename}
                          </h5>
                          <p className="text-[11px] text-slate-500 font-medium truncate">{cand.filename}</p>
                        </div>

                        {/* Stars Rating */}
                        {typeof cand.rating === 'number' && cand.rating > 0 && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= (cand.rating || 0)
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Tags */}
                        {Array.isArray(cand.tags) && cand.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cand.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80"
                              >
                                {tag}
                              </span>
                            ))}
                            {cand.tags.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold self-center">
                                +{cand.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Knockout reason notice */}
                        {cand.isKnockedOut && cand.knockoutReason && (
                          <p className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-100 line-clamp-2">
                            {cand.knockoutReason}
                          </p>
                        )}

                        {/* Notes preview */}
                        {cand.notes && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] text-slate-600 italic line-clamp-2">
                            "{cand.notes}"
                          </div>
                        )}

                        {/* Action Toolbar */}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => onOpenNotes(cand)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{cand.notes ? (isEn ? 'Edit Note' : 'Sửa ghi chú') : (isEn ? '+ Note' : '+ Ghi chú')}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {prev && (
                              <button
                                type="button"
                                title={isEn ? `Move back to ${PIPELINE_STAGES[prev].labelEn}` : `Chuyển về ${PIPELINE_STAGES[prev].labelVi}`}
                                onClick={() => onChangeStage(cand.id || cand.filename, prev)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {next && (
                              <button
                                type="button"
                                title={isEn ? `Move to ${PIPELINE_STAGES[next].labelEn}` : `Chuyển sang ${PIPELINE_STAGES[next].labelVi}`}
                                onClick={() => onChangeStage(cand.id || cand.filename, next)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              title={isEn ? 'View Analysis Deep-dive' : 'Xem chi tiết phân tích'}
                              onClick={() => onSelectCandidate(cand)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer ml-0.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
