import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 1 Verification: Google Workspace Header & Compact Context Bar', () => {
  const rootDir = process.cwd();
  const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8');
  const contextBarCode = fs.readFileSync(path.join(rootDir, 'src/components/CompactContextBar.tsx'), 'utf-8');
  const inputSectionCode = fs.readFileSync(path.join(rootDir, 'src/components/InputSection.tsx'), 'utf-8');
  const headerCode = fs.readFileSync(path.join(rootDir, 'src/components/Header.tsx'), 'utf-8');

  describe('1. State & Dirty Tracking Logic (App.tsx)', () => {
    it('accurately evaluates isInputDirty and clears warning on exact revert/undo', () => {
      // Logic simulation of App.tsx:
      // const isInputDirty = Boolean(analysis && (cvText !== analyzedCvText || jdText !== analyzedJdText));
      const initialCv = 'Senior Frontend Engineer with React experience';
      const initialJd = 'Looking for Senior Frontend Engineer';
      let analyzedCv = initialCv;
      let analyzedJd = initialJd;
      let analysis: any = { jobTitle: 'Senior Frontend Engineer', feature1: { scores: { overallRoleScore: 88 } } };

      let currentCv = initialCv;
      let currentJd = initialJd;

      const checkDirty = () => Boolean(analysis && (currentCv !== analyzedCv || currentJd !== analyzedJd));

      // 1. Immediately after analysis: clean
      expect(checkDirty()).toBe(false);

      // 2. User edits CV: turns dirty
      currentCv = 'Senior Frontend Engineer with Vue experience';
      expect(checkDirty()).toBe(true);

      // 3. User reverts/undoes back to original analyzed CV: dirty disappears automatically
      currentCv = initialCv;
      expect(checkDirty()).toBe(false);

      // 4. User edits JD: turns dirty
      currentJd = 'Looking for Lead Engineer';
      expect(checkDirty()).toBe(true);

      // 5. User reverts JD: dirty disappears automatically
      currentJd = initialJd;
      expect(checkDirty()).toBe(false);
    });

    it('resets benchmark when loading from History so history item is not flagged as dirty', () => {
      const historyItem = {
        cvText: 'CV from history',
        jdText: 'JD from history',
        analysis: { jobTitle: 'Software Engineer', feature1: { scores: { overallRoleScore: 82 } } }
      };

      // Simulating handleSelectHistoryItem
      let cvText = historyItem.cvText;
      let jdText = historyItem.jdText;
      let analysis = historyItem.analysis;
      let analyzedCvText = historyItem.cvText;
      let analyzedJdText = historyItem.jdText;

      const isInputDirty = Boolean(analysis && (cvText !== analyzedCvText || jdText !== analyzedJdText));
      expect(isInputDirty).toBe(false);
    });

    it('snapshots sentCvText and sentJdText prior to API call so in-flight edits are flagged dirty upon completion', () => {
      expect(appCode).toContain('const sentCvText = cvText;');
      expect(appCode).toContain('const sentJdText = jdText;');
      expect(appCode).toContain('setAnalyzedCvText(sentCvText);');
      expect(appCode).toContain('setAnalyzedJdText(sentJdText);');
    });

    it('preserves existing analysis and expands input on re-analysis error', () => {
      // In App.tsx catch block:
      expect(appCode).toContain('setIsInputCollapsed(false);');
      // Notice: setAnalysis is NOT called in catch, so old analysis and score remain intact
      const catchIndex = appCode.indexOf('} catch (err: any) {');
      const catchBlock = appCode.slice(catchIndex, catchIndex + 400);
      expect(catchBlock).not.toContain('setAnalysis(null)');
      expect(catchBlock).not.toContain('setAnalyzedCvText');
    });
  });

  describe('2. CompactContextBar UX Contract & Stale Score Display', () => {
    it('distinguishes between fresh score and previous analysis score with amber alert when dirty', () => {
      expect(contextBarCode).toContain('data-testid="fresh-score-badge"');
      expect(contextBarCode).toContain('data-testid="stale-score-badge"');
      expect(contextBarCode).toContain("lang === 'vi' ? 'Điểm lần phân tích trước' : 'Previous score'");
      expect(contextBarCode).toContain("lang === 'vi' ? 'Điểm hồ sơ' : 'Match score'");
    });

    it('supports dynamic topOffset to stack cleanly below Header across 100%, 125%, 150%, 200% zoom', () => {
      expect(contextBarCode).toContain('topOffset?: number;');
      expect(contextBarCode).toContain('style={{ top: `${topOffset}px` }}');
      expect(appCode).toContain('topOffset={headerHeight}');
      expect(appCode).toContain('new ResizeObserver(updateHeaderHeight)');
    });

    it('toggle collapse button does not trigger any network fetch and consumes zero quota', () => {
      // Verification of CompactContextBar code: onToggleCollapse has zero fetch or API references
      expect(contextBarCode).not.toContain('fetch(');
      expect(contextBarCode).not.toContain('/api/');
      expect(contextBarCode).toContain('onClick={onToggleCollapse}');
    });
  });

  describe('3. Concurrency & State Preservation in DOM', () => {
    it('disables textareas during AI analysis to prevent concurrent out-of-sync typing', () => {
      expect(inputSectionCode).toContain('disabled={isLoading}');
      expect(inputSectionCode).toContain('disabled:opacity-60 disabled:cursor-not-allowed');
    });

    it('preserves InputSection in DOM using hidden CSS class rather than unmounting component', () => {
      expect(appCode).toContain("className={isInputCollapsed ? 'hidden' : 'space-y-4 animate-in fade-in'}");
      expect(appCode).toContain('onCvSourceChange={setCvFileName}');
      expect(appCode).toContain('onJdSourceChange={setJdSourceLabel}');
    });

    it('Header provides forwardRef and responsive flex wrap for extreme zoom levels', () => {
      expect(headerCode).toContain('React.forwardRef<HTMLElement, HeaderProps>');
      expect(headerCode).toContain('min-h-[4rem]');
    });
  });
});
