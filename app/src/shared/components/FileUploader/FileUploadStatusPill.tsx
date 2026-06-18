import { ReactNode } from "react";

import GxPill from "@/shared/components/GxPill";

export type FileUploadStatusPillVariant = "default" | "success" | "warning" | "error" | "info";

export interface FileUploadStatusPillProps {
  children: ReactNode;
  variant?: FileUploadStatusPillVariant;
}

export function FileUploadStatusPill({ children, variant = "default" }: FileUploadStatusPillProps) {
  return (
    <GxPill variant={variant} dense>
      {children}
    </GxPill>
  );
}

export default FileUploadStatusPill;
