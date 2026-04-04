import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MotionButton = motion.button
const MotionDiv = motion.div

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
)

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
)

export function ContinuousPagination({ totalPages = 5, defaultPage = 1, onPageChange }) {
  const [currentPage, setCurrentPage] = useState(defaultPage)

  // Determine window of visible pages to handle "continuous" slicing gracefully if totalPages is large
  const visibleCount = 5
  let startPage = Math.max(1, currentPage - Math.floor(visibleCount / 2))
  let endPage = startPage + visibleCount - 1

  if (endPage > totalPages) {
    endPage = totalPages
    startPage = Math.max(1, endPage - visibleCount + 1)
  }

  const pages = Array.from({ length: endPage - startPage + 1 }).map((_, i) => startPage + i)

  const handleSetPage = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    onPageChange?.(page)
  }

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-[var(--border-color)] rounded-full p-1.5 shadow-sm">
      <button 
        onClick={() => handleSetPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft />
      </button>

      <div className="flex items-center gap-1 mx-1 layout-group">
        <AnimatePresence initial={false} mode="popLayout">
          {pages.map((page) => {
            const isActive = currentPage === page
            return (
              <MotionButton
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                key={page}
                onClick={() => handleSetPage(page)}
                className={`relative w-8 h-8 rounded-full text-[13px] font-medium z-10 transition-colors duration-300 ${
                  isActive ? 'text-[var(--action-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {isActive && (
                  <MotionDiv
                    layoutId="active-pagination-indicator"
                    className="absolute inset-0 bg-[#3279f9]/10 rounded-full border border-[#3279f9]/20 -z-10"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center">{page}</span>
              </MotionButton>
            )
          })}
        </AnimatePresence>
      </div>

      <button 
        onClick={() => handleSetPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Next page"
      >
        <ChevronRight />
      </button>
    </div>
  )
}

export function ContinuousPaginationDemo({ totalPages = 10, defaultPage = 1 }) {
  return (
    <div className="flex flex-col items-center justify-center mt-12 py-8 border-t border-[var(--border-color)]">
      <ContinuousPagination totalPages={totalPages} defaultPage={defaultPage} />
    </div>
  )
}
