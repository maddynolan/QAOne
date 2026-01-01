import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - Blue in light, Amber gradient in dark
        default: [
          "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
          "dark:bg-gradient-to-r dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-400 dark:hover:to-orange-400",
        ].join(" "),
        // Destructive - Red in both themes
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        // Outline - Clean border style
        outline: [
          "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm",
          "dark:border-gray-700 dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:hover:border-gray-600",
        ].join(" "),
        // Secondary - Subtle background
        secondary: [
          "bg-gray-100 text-gray-700 hover:bg-gray-200",
          "dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
        ].join(" "),
        // Ghost - No background until hover
        ghost: [
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
        ].join(" "),
        // Link style
        link: [
          "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
          "dark:text-amber-400 dark:hover:text-amber-300",
        ].join(" "),
        // Success variant
        success: [
          "bg-green-600 text-white hover:bg-green-700 shadow-sm",
          "dark:bg-green-600 dark:hover:bg-green-500",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
