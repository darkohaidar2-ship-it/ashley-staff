
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { id?: string }
>(({ className, style, id, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement>(null);
  const [persistedHeight, setPersistedHeight] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      const saved = localStorage.getItem(`card_h_${id}`);
      if (saved) setPersistedHeight(saved);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id || !localRef.current) return;
    
    let timer: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          localStorage.setItem(`card_h_${id}`, `${Math.round(entry.contentRect.height)}px`);
        }, 500);
      }
    });

    observer.observe(localRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [id]);

  const combinedRef = (node: HTMLDivElement) => {
    // @ts-ignore
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as any).current = node;
  };

  return (
    <div
      ref={combinedRef}
      style={{ 
        height: persistedHeight || (style?.height),
        ...style 
      }}
      className={cn(
        "border border-white/60 bg-white/60 backdrop-blur-xl text-card-foreground shadow-md shadow-slate-100/30 rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
      {...props}
    />
  );
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6 bg-white/20 border-b border-white/40", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, style, ...props }, ref) => (
  <h3
    ref={ref}
    style={{ 
        fontSize: 'var(--dashboard-font-size)', 
        color: 'hsl(var(--dashboard-title-color))', 
        textTransform: 'var(--dashboard-text-transform)' as any,
        ...style 
    }}
    className={cn(
      "font-bold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[12px] text-muted-foreground/80", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div ref={ref} 
    style={{ 
        fontSize: 'var(--dashboard-font-size)', 
        color: 'hsl(var(--dashboard-text-color))', 
        textTransform: 'var(--dashboard-text-transform)' as any,
        ...style 
    }}
    className={cn("p-6 pt-6", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 text-[12px]", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
