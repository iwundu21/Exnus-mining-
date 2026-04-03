import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface StatTooltipProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function StatTooltip({ title, description, children }: StatTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div className="cursor-help">
        {children}
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-surface border border-white/10 rounded-2xl shadow-2xl z-[100] pointer-events-none"
          >
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">{title}</h4>
              <p className="text-[10px] leading-relaxed text-muted font-medium">
                {description}
              </p>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-surface" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
