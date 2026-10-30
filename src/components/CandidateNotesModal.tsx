import React, { useState, useEffect } from 'react';
import { X, Save, Star, Tag, FileText, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PipelineStage } from '../types';
import { PIPELINE_STAGES, PRESET_CANDIDATE_TAGS } from '../utils/recruiterPipelineHelpers';

interface CandidateNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  filename: string;
  currentNotes: string;
  currentRating: number;
  currentStage: PipelineStage;
  currentTags: string[];
  onSave: (payload: { notes: string; rating: number; stage: PipelineStage; tags: string[] }) => void;
  isEn: boolean;
}

export const CandidateNotesModal: React.FC<CandidateNotesModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  filename,
  currentNotes,
  currentRating,
  currentStage,
  currentTags,
  onSave,
  isEn
}) => {
  const [notes, setNotes] = useState<string>(currentNotes || '');
  const [rating, setRating] = useState<number>(currentRating || 0);
  const [stage, setStage] = useState<PipelineStage>(currentStage || 'INBOX');
  const [tags, setTags] = useState<string[]>(currentTags || []);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setNotes(currentNotes || '');
      setRating(currentRating || 0);
      setStage(currentStage || 'INBOX');
      setTags(Array.isArray(currentTags) ? currentTags : []);
      setCustomTagInput('');
    }
  }, [isOpen, currentNotes, currentRating, currentStage, currentTags]);

  if (!isOpen) return null;

  const handleTogglePresetTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setCustomTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    onSave({
      notes,
      rating,
      stage,
      tags
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {candidateName || filename}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{filename}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Pipeline Stage Select */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                {isEn ? 'Hiring Pipeline Stage' : 'Giai Đoạn Tuyển Dụng'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(PIPELINE_STAGES) as PipelineStage[]).map((stgKey) => {
                  const cfg = PIPELINE_STAGES[stgKey];
                  const isSelected = stage === stgKey;
                  return (
                    <button
                      key={stgKey}
                      type="button"
                      onClick={() => setStage(stgKey)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? `${cfg.badgeClass} ring-2 ring-indigo-500/30`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{isEn ? cfg.labelEn : cfg.labelVi}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick 1-5 Star Rating */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                {isEn ? 'Recruiter Rating (1 - 5 Stars)' : 'Đánh Giá Của HR (1 - 5 Sao)'}
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((starNum) => {
                  const isFilled = starNum <= rating;
                  return (
                    <button
                      key={starNum}
                      type="button"
                      onClick={() => setRating(starNum === rating ? 0 : starNum)}
                      className="p-1 text-slate-300 hover:text-amber-400 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          isFilled ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="text-xs font-bold text-slate-500 ml-2">
                  {rating > 0 ? `${rating} / 5` : isEn ? 'Unrated' : 'Chưa chấm sao'}
                </span>
              </div>
            </div>

            {/* Tags Selection */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                {isEn ? 'Candidate Tags' : 'Gắn Nhãn Phân Loại'}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {PRESET_CANDIDATE_TAGS.map((pTag) => {
                  const isTagged = tags.includes(pTag);
                  return (
                    <button
                      key={pTag}
                      type="button"
                      onClick={() => handleTogglePresetTag(pTag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isTagged
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {pTag}
                    </button>
                  );
                })}
              </div>

              {/* Custom Tag input */}
              <form onSubmit={handleAddCustomTag} className="flex gap-2">
                <input
                  type="text"
                  placeholder={isEn ? 'Add custom tag...' : 'Thêm nhãn tùy chọn...'}
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!customTagInput.trim()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Current active tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Internal Notes Textarea */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                {isEn ? 'Internal Recruiter Notes' : 'Ghi Chú Nội Bộ Của Tuyển Dụng'}
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isEn
                    ? 'Write confidential screening notes (e.g. salary expectation, availability, interview remarks)...'
                    : 'Ghi chú thẩm định sơ bộ (VD: Mức lương mong muốn, thời gian có thể onboard, ấn tượng phỏng vấn)...'
                }
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-indigo-500 font-medium leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Hủy bỏ'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-black text-white shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEn ? 'Save Notes & Status' : 'Lưu Ghi Chú & Trạng Thái'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
