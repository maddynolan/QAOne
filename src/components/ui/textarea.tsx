import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Base styles
        "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm transition-colors",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Light mode
        "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400",
        "focus-visible:ring-blue-500/40 focus-visible:border-blue-500",
        // Dark mode
        "dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500",
        "dark:focus-visible:ring-amber-500/40 dark:focus-visible:border-amber-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
