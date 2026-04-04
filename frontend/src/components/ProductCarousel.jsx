import React from 'react';

export function ProductCarousel({ products = [] }) {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-8 border-b border-[var(--border-color)] pb-6 animate-fade-in-up">
      <h3 className="text-[15px] font-medium text-[var(--text-primary)] mb-4 ml-1">Shop related products</h3>
      
      <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide snap-x">
        {products.map((product, idx) => (
          <a 
            href={product.link}
            target="_blank" 
            rel="noopener noreferrer"
            key={product.position || idx} 
            className="snap-start shrink-0 w-[180px] border border-[var(--border-color)] rounded-2xl bg-white p-3 hover:border-[var(--action-primary)] hover:shadow-md cursor-pointer transition-all duration-300 group block"
          >
            {/* Image Placeholder / Actual Image */}
            <div className="w-full h-36 bg-[var(--bg-elevated)] rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-[var(--border-color)] group-hover:bg-[var(--bg-hover)] transition-colors">
              {product.thumbnail ? (
                <img src={product.thumbnail} alt={product.title} className="w-full h-full object-contain mix-blend-multiply px-2 py-2" />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)] opacity-50">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
            
            {/* Product Info */}
            <div className="flex flex-col h-[100px] justify-between">
              <div>
                <h4 className="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--text-primary)] transition-colors">
                  {product.title}
                </h4>
                {product.rating && (
                  <div className="flex items-center gap-1 mt-1.5 opacity-80">
                    <StarIcon />
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{product.rating}</span>
                    {product.reviews && <span className="text-[10px] text-[var(--text-tertiary)]">({product.reviews})</span>}
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight mt-1">{product.price}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">{product.source}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
