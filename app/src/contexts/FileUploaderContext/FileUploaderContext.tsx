import { createContext, useContext } from "react";

import { Metadata } from "@/api/common";

export interface FileUploaderContextValue {
  uploadFilesToGroundX(input: {
    bucketId: number;
    files: File[];
    filter?: Metadata;
    searchData?: Metadata;
    processLevel?: "full" | "none";
  }): Promise<{ processIds: string[] }>;
}

export const FileUploaderContext = createContext<FileUploaderContextValue | undefined>(undefined);

export function useFileUploaderContext(): FileUploaderContextValue {
  const context = useContext(FileUploaderContext);
  if (!context) throw new Error("useFileUploaderContext must be used within FileUploaderProvider");
  return context;
}

