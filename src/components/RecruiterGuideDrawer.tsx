import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  CheckSquare,
  Square,
  FileText
} from 'lucide-react';

import guideContent from '../../docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md?raw';

export interface RecruiterGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'vi' | 'en';
}

export interface TocItem {
  id: string;
  title: string;
  numberPrefix?: string;
}

// Utility to create clean slugs for anchor links
const slugifyHeading = (text: string, index: number): string => {
  const clean = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return `section-${index}-${clean}`;
};

// Utility to extract text content from React children nodes
const extractNodeText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (node && node.props && node.props.children) {
    return extractNodeText(node.props.children);
  }
  return '';
};

export const RecruiterGuideDrawer: React.FC<RecruiterGuideDrawerProps> = ({
  isOpen,
  onClose,
  lang = 'vi'
}) => {
  const isEn = lang === 'en';
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Parse table of contents (## headings) from raw Markdown
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
  }, []);

  // Handle Focus Trap & Keyboard Esc listener
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      // Move focus into the drawer close button
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        triggerElementRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  // Handle active heading tracking on scroll inside drawer
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const handleScroll = () => {
      const headingElements = container.querySelectorAll<HTMLElement>('h2[id]');
      let currentActiveId = '';
      const containerTop = container.getBoundingClientRect().top;

      headingElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Check if top of heading is near top of scroll view
        if (rect.top - containerTop <= 100) {
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

  // Scroll smooth to target heading section
  const handleTocClick = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetEl = container.querySelector<HTMLElement>(`#${id}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(id);
      setIsTocOpen(false); // Auto-close TOC dropdown after click on mobile/tablet
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recruiter-guide-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Sliding Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative z-10 w-full sm:w-[85vw] lg:w-[50vw] max-w-[800px] h-full bg-white shadow-2xl flex flex-col border-l border-slate-200"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white shrink-0 sticky top-0 z-20 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <BookOpen className="w-3 h-3" />
                  <span>{isEn ? 'RECRUITER GUIDE' : 'HƯỚNG DẪN DÀNH CHO NHÀ TUYỂN DỤNG'}</span>
                </div>
                <h2 id="recruiter-guide-title" className="text-lg sm:text-xl font-black text-white leading-snug">
                  {isEn ? 'Recruiter User Guide' : 'Hướng dẫn dành cho Nhà tuyển dụng'}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {isEn ? 'How to read and utilize AI analysis reports effectively' : 'Cách đọc và sử dụng báo cáo phân tích AI'}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label={isEn ? 'Close guide' : 'Đóng hướng dẫn'}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Language Note Banner for English UI */}
            {isEn && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-800 font-medium flex items-center gap-2 shrink-0">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>The current guide content is available in Vietnamese.</span>
              </div>
            )}

            {/* Collapsible Table of Contents Bar */}
            {tocItems.length > 0 && (
              <div className="bg-slate-50 border-b border-slate-200 shrink-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsTocOpen(!isTocOpen)}
                  className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
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

                {/* Dropdown / Expandable TOC Grid */}
                <AnimatePresence>
                  {isTocOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-white border-t border-slate-200 max-h-[220px] overflow-y-auto"
                    >
                      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {tocItems.map((item) => {
                          const isActive = activeHeadingId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleTocClick(item.id)}
                              className={`text-left px-2.5 py-1.5 rounded-lg transition-all truncate cursor-pointer font-medium ${
                                isActive
                                  ? 'bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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

            {/* Main Scrollable Markdown Content Container */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-slate-800 leading-relaxed"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 border-b border-slate-200 pb-3 mb-6 mt-2 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
                      <span>{children}</span>
                    </h1>
                  ),
                  h2: ({ children }) => {
                    const text = extractNodeText(children);
                    // Match heading in parsed TOC to get stable anchor id
                    const tocMatch = tocItems.find((item) => item.title === text);
                    const id = tocMatch ? tocMatch.id : slugifyHeading(text, 0);

                    return (
                      <h2
                        id={id}
                        className="text-lg sm:text-xl font-black text-slate-900 border-b border-slate-200 pb-2.5 mb-4 mt-8 scroll-mt-6 flex items-center gap-2 group"
                      >
                        <span className="flex-1">{children}</span>
                      </h2>
                    );
                  },
                  h3: ({ children }) => (
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-2 mt-5">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4 font-normal">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-outside ml-5 text-xs sm:text-sm text-slate-700 space-y-1.5 mb-4">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-outside ml-5 text-xs sm:text-sm text-slate-700 space-y-2 mb-4">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed text-slate-700">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/70 rounded-r-xl p-3.5 my-4 text-xs font-medium text-slate-800 shadow-2xs">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-[11px] sm:text-xs bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                      {children}
                    </code>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-xl border border-slate-200 shadow-2xs max-w-full">
                      <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[500px]">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-100 text-slate-900 font-extrabold border-b border-slate-200">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="p-3 font-extrabold text-slate-900">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="p-3 border-b border-slate-100 text-slate-700 leading-normal">
                      {children}
                    </td>
                  ),
                  input: (props) => {
                    if (props.type === 'checkbox') {
                      return props.checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 inline-block mr-2 shrink-0 align-text-bottom" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 inline-block mr-2 shrink-0 align-text-bottom" />
                      );
                    }
                    return <input {...props} />;
                  }
                }}
              >
                {guideContent}
              </ReactMarkdown>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
