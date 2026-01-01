import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Default - Neutral gray
        default: [
          "border-gray-200 bg-gray-100 text-gray-700",
          "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        ].join(" "),
        // Primary - Blue/Amber
        primary: [
          "border-blue-200 bg-blue-50 text-blue-700",
          "dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
        ].join(" "),
        // Secondary - Subtle
        secondary: [
          "border-gray-200 bg-gray-50 text-gray-600",
          "dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
        ].join(" "),
        // Destructive - Red
        destructive: [
          "border-red-200 bg-red-50 text-red-700",
          "dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
        ].join(" "),
        // Success - Green
        success: [
          "border-green-200 bg-green-50 text-green-700",
          "dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
        ].join(" "),
        // Warning - Amber/Yellow
        warning: [
          "border-amber-200 bg-amber-50 text-amber-700",
          "dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
        ].join(" "),
        // Info - Blue/Cyan
        info: [
          "border-cyan-200 bg-cyan-50 text-cyan-700",
          "dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400",
        ].join(" "),
        // Outline - Just border
        outline: [
          "border-gray-300 bg-transparent text-gray-700",
          "dark:border-gray-600 dark:text-gray-300",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
