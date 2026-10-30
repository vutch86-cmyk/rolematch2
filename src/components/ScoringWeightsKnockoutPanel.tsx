import React from 'react';
import { Sliders, CheckCircle2, RotateCcw, AlertTriangle, ShieldAlert, Award, Sparkles } from 'lucide-react';
import { ScoringWeights, KnockoutCriteria } from '../types';
import {
  SCORING_PRESETS,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_KNOCKOUT_CRITERIA,
  ScoringPresetKey
} from '../utils/recruiterScoringHelpers';

interface ScoringWeightsKnockoutPanelProps {
  weights: ScoringWeights;
  onChangeWeights: (w: ScoringWeights) => void;
  criteria: KnockoutCriteria;
  onChangeCriteria: (c: KnockoutCriteria) => void;
  activePreset: ScoringPresetKey;
  onSelectPreset: (presetKey: ScoringPresetKey) => void;
  onApply: () => void;
  onReset: () => void;
  isEn: boolean;
}

export const ScoringWeightsKnockoutPanel: React.FC<ScoringWeightsKnockoutPanelProps> = ({
  weights,
  onChangeWeights,
  criteria,
  onChangeCriteria,
  activePreset,
  onSelectPreset,
  onApply,
  onReset,
  isEn
}) => {
  const totalWeight = weights.keywordWeight + weights.skillWeight + weights.experienceWeight;
  const isWeightValid = totalWeight === 100;

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    onChangeWeights({
      ...weights,
      [key]: clamped
    });
    if (activePreset !== 'custom') {
      onSelectPreset('custom');
    }
  };

  const handleNormalizeWeights = () => {
    if (totalWeight <= 0) {
      onChangeWeights(DEFAULT_SCORING_WEIGHTS);
      return;
    }
    const kw = Math.round((weights.keywordWeight / totalWeight) * 100);
    const sk = Math.round((weights.skillWeight / totalWeight) * 100);
    const exp = 100 - kw - sk;
    onChangeWeights({
      keywordWeight: kw,
      skillWeight: sk,
      experienceWeight: exp
    });
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200/80 shadow-md p-5 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Sliders className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {isEn ? 'Scoring Weights & Knock-out Rules (Recruiter 2.0)' : 'Cấu Hình Trọng Số & Tiêu Chí Knock-Out (Recruiter 2.0)'}
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {isEn
              ? 'Customize weights to auto-recalculate leaderboard scores dynamically without extra AI token consumption.'
              : 'Tự do điều chỉnh trọng số 3 trục điểm và điều kiện loại thẳng. Bảng xếp hạng tự động tính toán lại tức thì.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Reset Default' : 'Khôi phục chuẩn'}</span>
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-black text-white shadow-sm transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isEn ? 'Apply & Recalculate' : 'Áp Dụng & Xếp Hạng Lại'}</span>
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
          {isEn ? 'Quick Allocation Presets' : 'Mẫu Trọng Số Gợi Ý (Presets)'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {(Object.keys(SCORING_PRESETS) as ScoringPresetKey[]).map((key) => {
            const p = SCORING_PRESETS[key];
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectPreset(key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {isEn ? p.nameEn : p.nameVi}
                  </span>
                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {isEn ? p.descriptionEn : p.descriptionVi}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            {isEn ? 'Weight Distribution (Must Sum to 100%)' : 'Phân Bổ Tỷ Trọng Điểm Số (Tổng = 100%)'}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                isWeightValid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
              }`}
            >
              {isEn ? `Total: ${totalWeight}%` : `Tổng: ${totalWeight}%`}
            </span>
            {!isWeightValid && (
              <button
                type="button"
                onClick={handleNormalizeWeights}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                {isEn ? 'Auto-balance to 100%' : 'Tự cân bằng 100%'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Keywords Weight */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800">
                {isEn ? '1. JD Keywords Match' : '1. Độ Khớp Từ Khóa JD'}
              </span>
              <span className="text-sm font-black text-indigo-600">{weights.keywordWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights.keywordWeight}
              onChange={(e) => handleWeightChange('keywordWeight', Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              {isEn ? 'Keyword coverage & terminologies' : 'Độ phủ từ khóa & thuật ngữ trong JD'}
            </p>
          </div>

          {/* Skills Weight */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800">
                {isEn ? '2. Hard Skills Match' : '2. Năng Lực Kỹ Thuật / Kỹ Năng'}
              </span>
              <span className="text-sm font-black text-indigo-600">{weights.skillWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights.skillWeight}
              onChange={(e) => handleWeightChange('skillWeight', Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              {isEn ? 'Core tools, frameworks & competencies' : 'Công cụ, framework & kỹ năng chuyên môn'}
            </p>
          </div>

          {/* Experience Weight */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800">
                {isEn ? '3. Experience & Impact' : '3. Kinh Nghiệm & Kết Quả Thực Tế'}
              </span>
              <span className="text-sm font-black text-indigo-600">{weights.experienceWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights.experienceWeight}
              onChange={(e) => handleWeightChange('experienceWeight', Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              {isEn ? 'Seniority, scope, scale & proven metrics' : 'Thâm niên, quy mô dự án & tác động định lượng'}
            </p>
          </div>
        </div>
      </div>

      {/* Knock-out Criteria Section */}
      <div className="bg-rose-50/50 rounded-2xl p-4 sm:p-5 border border-rose-200/80 space-y-3.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
            {isEn ? 'Knock-out Conditions (Disqualification Rules)' : 'Tiêu Chí Loại Thẳng (Knock-out Rules)'}
          </h4>
        </div>
        <p className="text-xs text-rose-700">
          {isEn
            ? 'Candidates failing any enabled condition will be flagged as Disqualified and placed at the bottom of the leaderboard.'
            : 'Ứng viên không thỏa mãn các điều kiện bắt buộc dưới đây sẽ bị đánh dấu "Loại sàn" kèm lý do rõ ràng.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Min Skill Score */}
          <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {isEn ? 'Min Skill Score' : 'Điểm Kỹ năng tối thiểu'}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="VD: 50"
                value={criteria.minSkillScore ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  onChangeCriteria({ ...criteria, minSkillScore: val });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-indigo-500"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* Min Experience Score */}
          <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {isEn ? 'Min Experience Score' : 'Điểm Kinh nghiệm tối thiểu'}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="VD: 50"
                value={criteria.minExperienceScore ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  onChangeCriteria({ ...criteria, minExperienceScore: val });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-indigo-500"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* Min Overall Score */}
          <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {isEn ? 'Min Overall Score' : 'Điểm Tổng thể tối thiểu'}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="VD: 60"
                value={criteria.minOverallScore ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  onChangeCriteria({ ...criteria, minOverallScore: val });
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-indigo-500"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* Require Must-Have Skills */}
          <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs flex flex-col justify-between">
            <label className="text-xs font-bold text-slate-800 block">
              {isEn ? 'Must-Have Mandate' : 'Bắt buộc tiêu chí Must-Have'}
            </label>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!criteria.requireMustHaveSkills}
                onChange={(e) => onChangeCriteria({ ...criteria, requireMustHaveSkills: e.target.checked })}
                className="w-4 h-4 text-rose-600 rounded cursor-pointer accent-rose-600"
              />
              <span className="text-xs text-slate-700 font-medium">
                {isEn ? 'Disqualify if missing core Must-Have' : 'Loại nếu thiếu tiêu chí cốt lõi'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
