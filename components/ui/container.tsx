import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ContainerSize = "default" | "narrow" | "wide";

const sizes: Record<ContainerSize, string> = {
  default: "max-w-7xl",
  narrow: "max-w-2xl",
  wide: "max-w-[1600px]",
};

export function Container({
  size = "default",
  className,
  children,
}: {
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizes[size], className)}>
      {children}
    </div>
  );
}
