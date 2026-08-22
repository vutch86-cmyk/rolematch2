import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  X,
  List,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  FileText
} from 'lucide-react';

import candidateGuideVi from '../../docs/HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md?raw';
import candidateGuideEn from '../../docs/CANDIDATE_USER_GUIDE_EN.md?raw';

export interface CandidateGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'vi' | 'en';
}

export interface TocItem {
  id: string;
  title: string;
  numberPrefix?: string;
}

const slugifyHeading = (text: string, index: number): string => {
  const clean = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return `section-${index}-${clean}`;
};

const extractNodeText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (node && node.props && node.props.children) {
    return extractNodeText(node.props.children);
  }
  return '';
};

export const CandidateGuideDrawer: React.FC<CandidateGuideDrawerProps> = ({
  isOpen,
  onClose,
  lang = 'vi'
}) => {
  const isEn = lang === 'en';
  const guideContent = isEn ? candidateGuideEn : candidateGuideVi;
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lines = guideContent.split('\n');
    const parsedToc: TocItem[] = [];
    let h2Count = 0;

    for (const line of lines) {
      const match = line.match(/^##\s+(.+)$/);
      if (match) {
        const title = match[1].trim();
        const id = slugifyHeading(title, h2Count);
        parsedToc.push({ id, title });
        h2Count++;
      }
    }
    setTocItems(parsedToc);
    setActiveHeadingId('');
    setIsTocOpen(false);
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }, [guideContent]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    triggerElementRef.current = document.activeElement as HTMLElement;

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const getFocusableElements = (): HTMLElement[] => {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusableElements();
        if (focusables.length === 0) return;

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const handleScroll = () => {
      const headingElements = container.querySelectorAll<HTMLElement>('h2[id]');
      let currentActiveId = '';
      const containerTop = container.getBoundingClientRect().top;

      headingElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 120) {
          currentActiveId = el.id;
        }
      });

      if (currentActiveId) {
        setActiveHeadingId(currentActiveId);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  const handleTocClick = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetEl = container.querySelector<HTMLElement>(`#${id}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(id);
      setIsTocOpen(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 w-screen h-[100dvh] bg-slate-50 flex flex-col overflow-hidden text-slate-800"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-guide-title"
          aria-describedby="candidate-guide-desc"
        >
          {/* Top Sticky Header Bar */}
          <header className="p-4 sm:px-8 bg-slate-900 text-white shrink-0 z-30 border-b border-slate-800 flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-400/30 shrink-0">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                    {isEn ? 'CANDIDATE GUIDE' : 'HƯỚNG DẪN ỨNG VIÊN'}
                  </span>
                </div>
                <h1 id="candidate-guide-title" className="text-base sm:text-xl font-black text-white leading-tight">
                  {isEn ? 'Candidate User Guide' : 'Hướng dẫn sử dụng dành cho Ứng viên'}
                </h1>
                <p id="candidate-guide-desc" className="text-xs text-slate-300 hidden sm:block font-medium mt-0.5">
                  {isEn ? 'How to optimize your CV and match with Job Descriptions using AI' : 'Cách tối ưu hóa CV và đối chiếu với JD bằng AI'}
                </p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={isEn ? 'Close user guide' : 'Đóng hướng dẫn'}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer border border-slate-700/80 shrink-0 flex items-center gap-2 text-xs sm:text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              <span className="hidden sm:inline">{isEn ? 'Close user guide' : 'Đóng hướng dẫn'}</span>
            </button>
          </header>

          {/* Collapsible Mobile/Tablet Table of Contents Bar (< lg) */}
          {tocItems.length > 0 && (
            <div className="bg-white border-b border-slate-200 shrink-0 z-20 block lg:hidden">
              <button
                type="button"
                aria-expanded={isTocOpen}
                aria-controls="mobile-candidate-toc-dropdown"
                onClick={() => setIsTocOpen(!isTocOpen)}
                className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-indigo-600" />
                  <span>{isEn ? 'Table of Contents' : 'Mục lục hướng dẫn'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                    {tocItems.length} {isEn ? 'sections' : 'mục'}
                  </span>
                </div>
                {isTocOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              <AnimatePresence>
                {isTocOpen && (
                  <motion.div
                    id="mobile-candidate-toc-dropdown"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50 border-t border-slate-200 max-h-[260px] overflow-y-auto"
                  >
                    <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs sm:text-sm">
                      {tocItems.map((item) => {
                        const isActive = activeHeadingId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-current={isActive ? 'location' : undefined}
                            onClick={() => handleTocClick(item.id)}
                            className={`text-left px-3 py-2 rounded-lg transition-all truncate cursor-pointer font-medium ${
                              isActive
                                ? 'bg-indigo-600 text-white font-extrabold shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                            }`}
                          >
                            {item.title}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Desktop Two-Column Reader Body Container */}
          <div className="w-full max-w-[1440px] mx-auto flex-1 flex overflow-hidden">
            {/* Desktop Sticky Left Sidebar TOC (lg+) */}
            {tocItems.length > 0 && (
              <aside className="w-[280px] xl:w-[320px] shrink-0 border-r border-slate-200 bg-white p-6 overflow-y-auto hidden lg:flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                    <List className="w-4 h-4 text-indigo-600" />
                    <span>{isEn ? 'Table of Contents' : 'Mục lục hướng dẫn'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {tocItems.length}
                  </span>
                </div>

                <nav className="space-y-1 text-xs xl:text-sm">
                  {tocItems.map((item) => {
                    const isActive = activeHeadingId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'location' : undefined}
                        onClick={() => handleTocClick(item.id)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer font-semibold leading-snug flex items-center gap-2 ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-800 font-extrabold border border-indigo-200/90 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                            isActive ? 'bg-indigo-600 scale-125' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>
            )}

            {/* Right Main Article Column */}
            <main
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 bg-slate-50/60"
            >
              <article className="max-w-3xl lg:max-w-4xl mx-auto bg-white rounded-2xl p-6 sm:p-10 md:p-12 shadow-sm border border-slate-200/80 space-y-6">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl lg:text-3xl font-black text-slate-900 border-b-2 border-slate-200 pb-4 mb-8 mt-2 flex items-center gap-3">
                        <FileText className="w-7 h-7 text-indigo-600 shrink-0" />
                        <span>{children}</span>
                      </h1>
                    ),
                    h2: ({ children }) => {
                      const text = extractNodeText(children);
                      const tocMatch = tocItems.find((item) => item.title === text);
                      const id = tocMatch ? tocMatch.id : slugifyHeading(text, 0);

                      return (
                        <h2
                          id={id}
                          className="text-xl lg:text-2xl font-black text-slate-900 border-b border-slate-200 pb-3 mb-5 mt-10 scroll-mt-24 flex items-center gap-2 group"
                        >
                          <span className="flex-1">{children}</span>
                        </h2>
                      );
                    },
                    h3: ({ children }) => (
                      <h3 className="text-base lg:text-lg font-extrabold text-slate-900 mb-3 mt-6">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm sm:text-base text-slate-700 leading-7 sm:leading-8 mb-5 font-normal">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside ml-6 text-sm sm:text-base text-slate-700 space-y-2.5 mb-5">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside ml-6 text-sm sm:text-base text-slate-700 space-y-2.5 mb-5">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed text-slate-700">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/70 rounded-r-xl p-4 sm:p-5 my-6 text-sm sm:text-base font-medium text-slate-800 shadow-2xs">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="font-mono text-xs sm:text-sm bg-slate-100 text-indigo-700 px-2 py-0.5 rounded border border-slate-200 font-bold">
                        {children}
                      </code>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-6 rounded-xl border border-slate-200/90 shadow-2xs max-w-full bg-white">
                        <table className="w-full text-left text-xs sm:text-sm text-slate-700 border-collapse min-w-[580px]">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-slate-100/90 text-slate-900 font-extrabold border-b border-slate-200">
                        {children}
                      </thead>
                    ),
                    th: ({ children }) => (
                      <th className="p-3.5 sm:p-4 font-extrabold text-slate-900">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="p-3.5 sm:p-4 border-b border-slate-100 text-slate-700 leading-relaxed">
                        {children}
                      </td>
                    ),
                    input: (props) => {
                      if (props.type === 'checkbox') {
                        return props.checked ? (
                          <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 inline-block mr-2.5 shrink-0 align-text-bottom" />
                        ) : (
                          <Square className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 inline-block mr-2.5 shrink-0 align-text-bottom" />
                        );
                      }
                      return <input {...props} />;
                    }
                  }}
                >
                  {guideContent}
                </ReactMarkdown>
              </article>
            </main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
