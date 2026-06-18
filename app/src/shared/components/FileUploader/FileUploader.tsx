import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

import CommonCancelButton from "@/shared/components/CommonCancelButton";
import CommonSubmitButton from "@/shared/components/CommonSubmitButton";
import EducationalTooltip from "@/shared/components/EducationalTooltip";
import GxCard from "@/shared/components/GxCard";
import GxSectionHeader from "@/shared/components/GxSectionHeader";
import {
  BORDER,
  BODY_TEXT,
  CORAL,
  BORDER_RADIUS,
  BORDER_RADIUS_2X,
  FONT_SIZE_BODY_SM,
  FONT_WEIGHT_LABEL,
  GRAY,
  INPUT_BORDER,
  NAVY,
  PADDING,
  TINT,
} from "@/constants";
import { Metadata } from "@/api/common";

import FileUploadStatusPill from "./FileUploadStatusPill";
import { createFileUploaderConfig, FileUploaderConfigInput, getFileExtension } from "./fileUploaderConfig";
import { validateFileForGroundXUpload } from "./fileUploaderValidation";

export type FileUploadQueueStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "ingesting"
  | "complete"
  | "error"
  | "cancelled";

export interface FileUploadQueueItem {
  id: string;
  file: File;
  status: FileUploadQueueStatus;
  progress: number;
  errors: string[];
  requiresPreparation: boolean;
  processId?: string;
}

export interface FileUploaderProps {
  bucketId: number;
  bucketName?: string;
  filter?: Metadata;
  searchData?: Metadata;
  processLevel?: "full" | "none";
  config?: FileUploaderConfigInput;
  onUploadFiles: (files: FileUploadQueueItem[]) => Promise<void | { processIds?: string[] }>;
  onIngestStarted?: (processIds: string[]) => void;
  onUploadComplete?: (items: FileUploadQueueItem[]) => void;
  onUploadError?: (items: FileUploadQueueItem[]) => void;
}

function createQueueId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified || Date.now()}`;
}

function toBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

export function FileUploader({
  bucketId,
  bucketName,
  config: configInput,
  onUploadFiles,
  onIngestStarted,
  onUploadComplete,
  onUploadError,
}: FileUploaderProps) {
  const config = useMemo(() => createFileUploaderConfig(configInput), [configInput]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<FileUploadQueueItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = (files: File[]) => {
    setItems((current) => {
      const next = [...current];
      for (const file of files.slice(0, Math.max(0, config.limits.maxFiles - current.length))) {
        const validation = validateFileForGroundXUpload({
          file,
          config,
          existingNames: next.map((item) => item.file.name),
        });
        next.push({
          id: createQueueId(file),
          file,
          status: validation.valid ? "queued" : "error",
          progress: 0,
          errors: validation.reasons,
          requiresPreparation: validation.requiresPreparation,
        });
      }
      return next;
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const upload = async () => {
    const uploadableItems = items.filter((item) => item.status === "queued");
    if (!uploadableItems.length) return;
    setIsUploading(true);
    setItems((current) =>
      current.map((item) =>
        uploadableItems.some((candidate) => candidate.id === item.id)
          ? { ...item, status: item.requiresPreparation ? "preparing" : "uploading", progress: item.requiresPreparation ? 10 : 20 }
          : item
      )
    );

    try {
      const processIds: string[] = [];
      for (const batch of toBatches(uploadableItems, config.limits.batchSize)) {
        const result = await onUploadFiles(batch);
        processIds.push(...(result?.processIds ?? []));
      }
      const completed = uploadableItems.map((item) => ({
        ...item,
        status: "complete" as const,
        progress: 100,
        processId: processIds.length === 1 ? processIds[0] : item.processId,
      }));
      setItems((current) => current.map((item) => completed.find((done) => done.id === item.id) ?? item));
      if (processIds.length) onIngestStarted?.(processIds);
      onUploadComplete?.(completed);
    } catch (error) {
      const errored = uploadableItems.map((item) => ({
        ...item,
        status: "error" as const,
        progress: item.progress,
        errors: [(error as Error)?.message || "Upload failed"],
      }));
      setItems((current) => current.map((item) => errored.find((failed) => failed.id === item.id) ?? item));
      onUploadError?.(errored);
    } finally {
      setIsUploading(false);
    }
  };

  const retry = (itemId: string) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status: "queued", progress: 0, errors: [] } : item))
    );
  };

  const cancel = (itemId: string) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status: "cancelled", progress: 0 } : item))
    );
  };

  const clearCompleted = () => {
    setItems((current) => current.filter((item) => item.status !== "complete" && item.status !== "cancelled"));
  };

  const acceptedTypes = config.limits.acceptedExtensions.map((extension) => `.${extension}`).join(",");
  const hasQueuedFiles = items.some((item) => item.status === "queued");

  return (
    <GxCard>
      <Stack spacing={PADDING}>
        <GxSectionHeader
          label={config.copy.title}
          education={
            <EducationalTooltip ariaLabel={config.copy.educationAriaLabel} title={config.copy.educationCopy} />
          }
          action={bucketName ? <FileUploadStatusPill variant="info">{bucketName}</FileUploadStatusPill> : undefined}
        />

        <Box
          role="button"
          tabIndex={0}
          aria-label={config.copy.selectFilesLabel}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          sx={{
            border: "1px dashed",
            borderColor: isDragActive ? CORAL : INPUT_BORDER,
            backgroundColor: isDragActive ? TINT : GRAY,
            borderRadius: BORDER_RADIUS_2X,
            p: PADDING,
            cursor: "pointer",
            outline: "none",
            "&:focus-visible": {
              borderColor: NAVY,
            },
          }}
        >
          <input
            ref={inputRef}
            hidden
            multiple
            type="file"
            accept={acceptedTypes}
            aria-label={config.copy.selectFilesLabel}
            onChange={handleInputChange}
          />
          <Stack spacing={1} alignItems="center" textAlign="center">
            <CloudUploadOutlinedIcon sx={{ color: CORAL }} />
            <Typography sx={{ color: NAVY, fontWeight: FONT_WEIGHT_LABEL }}>{config.copy.dropzoneLabel}</Typography>
            <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY_SM }}>{config.copy.dropzoneHint}</Typography>
          </Stack>
        </Box>

        {!items.length ? (
          <Typography sx={{ color: BODY_TEXT }}>{config.copy.emptyState}</Typography>
        ) : (
          <Stack spacing={1} aria-label="File upload queue">
            {items.map((item) => (
              <Box
                key={item.id}
                sx={{
                  border: "1px solid",
                  borderColor: BORDER,
                  borderRadius: BORDER_RADIUS,
                  p: PADDING,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: NAVY, fontWeight: FONT_WEIGHT_LABEL }} noWrap>
                        {item.file.name}
                      </Typography>
                      <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY_SM }}>
                        {getFileExtension(item.file.name).toUpperCase()} - {Math.ceil(item.file.size / 1024)} KB
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {item.requiresPreparation && item.status !== "complete" ? (
                        <FileUploadStatusPill variant="warning">
                          {getFileExtension(item.file.name) === "pdf" ? config.copy.splittingLabel : config.copy.conversionLabel}
                        </FileUploadStatusPill>
                      ) : null}
                      <FileUploadStatusPill variant={item.status === "error" ? "error" : "info"}>
                        {item.status.toUpperCase()}
                      </FileUploadStatusPill>
                    </Stack>
                  </Stack>
                  <LinearProgress
                    aria-label={`${item.file.name} upload progress`}
                    variant="determinate"
                    value={item.status === "complete" ? 100 : item.progress}
                  />
                  {item.errors.map((error) => (
                    <Typography key={error} role="alert" sx={{ color: CORAL, fontSize: FONT_SIZE_BODY_SM }}>
                      {error}
                    </Typography>
                  ))}
                  <Stack direction="row" spacing={1}>
                    {item.status === "error" ? (
                      <CommonSubmitButton size="small" isUppercase={false} invert startIcon={<ReplayIcon />} onClick={() => retry(item.id)}>
                        {config.copy.retryLabel}
                      </CommonSubmitButton>
                    ) : null}
                    {item.status === "queued" || item.status === "uploading" || item.status === "preparing" ? (
                      <CommonCancelButton size="small" startIcon={<DeleteOutlineIcon />} onClick={() => cancel(item.id)}>
                        {config.copy.cancelLabel}
                      </CommonCancelButton>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={1}>
          <CommonCancelButton onClick={clearCompleted}>{config.copy.clearCompletedLabel}</CommonCancelButton>
          <CommonSubmitButton onClick={upload} disabled={!hasQueuedFiles || isUploading || !bucketId}>
            {config.copy.uploadLabel}
          </CommonSubmitButton>
        </Stack>
      </Stack>
    </GxCard>
  );
}

export default FileUploader;
