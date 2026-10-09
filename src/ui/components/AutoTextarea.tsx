import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** A textarea that starts small and grows with its content, up to maxHeight (then scrolls). */
export function AutoTextarea({ minRows = 3, maxHeight = 480, value, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxHeight?: number; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    const next = Math.min(element.scrollHeight + 2, maxHeight);
    element.style.height = `${next}px`;
    element.style.overflowY = element.scrollHeight + 2 > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);
  return <textarea ref={ref} rows={minRows} value={value} style={{ resize: 'none', ...style }} {...props} />;
}
