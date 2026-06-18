import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

import type { ChatWithSourcesCitation } from "@/api/entities/chatWithSourcesEntity";
import {
  BORDER,
  BORDER_RADIUS,
  FONT_SIZE_BODY,
  FONT_WEIGHT_LABEL,
  BODY_TEXT,
  NAVY,
} from "@/constants";
import EducationalTooltip from "@/shared/components/EducationalTooltip";
import GxCard from "@/shared/components/GxCard";
import GxPill from "@/shared/components/GxPill";
import CommonSubmitButton from "@/shared/components/CommonSubmitButton";

import type { ChatWithSourcesConfig } from "./chatWithSourcesConfig";

export interface SourceViewerDrawerProps {
  citation: ChatWithSourcesCitation | null;
  config: ChatWithSourcesConfig;
  onClose(): void;
  onRefine(citation: ChatWithSourcesCitation): void;
}

function pageImageFromCitation(citation: ChatWithSourcesCitation): string | undefined {
  if (citation.pageImages?.[0]) return citation.pageImages[0];
  const page = citation.pages?.find(
    (item): item is { imageUrl?: string; image?: string; url?: string; pageNumber?: number; number?: number } =>
      Boolean(item && typeof item === "object")
  );
  return page?.imageUrl ?? page?.image ?? page?.url;
}

function pageLabelFromCitation(citation: ChatWithSourcesCitation): string | undefined {
  const values = citation.pages
    ?.map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const page = item as { pageNumber?: unknown; number?: unknown; page?: unknown };
      return page.pageNumber ?? page.number ?? page.page;
    })
    .filter((item): item is string | number => typeof item === "string" || typeof item === "number");
  if (!values?.length) return undefined;
  return `Page${values.length === 1 ? "" : "s"} ${values.join(", ")}`;
}

export function SourceViewerDrawer({
  citation,
  config,
  onClose,
  onRefine,
}: SourceViewerDrawerProps) {
  const pageImage = citation ? pageImageFromCitation(citation) : undefined;
  const pageLabel = citation ? pageLabelFromCitation(citation) : undefined;

  return (
    <Drawer
      anchor="right"
      open={Boolean(citation)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: "40%" },
          maxWidth: { md: 640 },
          p: 2,
        },
      }}
    >
      {citation && (
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              <Typography sx={{ color: NAVY, fontWeight: FONT_WEIGHT_LABEL, fontSize: FONT_SIZE_BODY }}>
                {config.copy.sourceViewerTitle}
              </Typography>
              <EducationalTooltip
                ariaLabel={config.copy.sourceViewerEducationAriaLabel}
                title={config.copy.sourceViewerEducationCopy}
              />
            </Box>
            <IconButton type="button" aria-label={config.copy.closeSourceLabel} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          <GxCard radius="sm">
            <Stack spacing={1.5}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <GxPill variant="info" dense>{`SOURCE ${citation.sourceIndex}`}</GxPill>
                {citation.fileType && <GxPill dense>{citation.fileType.toUpperCase()}</GxPill>}
              </Box>
              <Typography sx={{ color: NAVY, fontWeight: FONT_WEIGHT_LABEL }}>
                {citation.fileName ?? citation.documentId}
              </Typography>
              {citation.chunkText && (
                <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY }}>
                  {citation.chunkText}
                </Typography>
              )}
              {pageImage && (
                <Box
                  component="img"
                  src={pageImage}
                  alt={`Preview for ${citation.fileName ?? citation.documentId}`}
                  sx={{
                    width: "100%",
                    border: `1px solid ${BORDER}`,
                    borderRadius: BORDER_RADIUS,
                    objectFit: "contain",
                  }}
                />
              )}
              {pageLabel ? (
                <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY }}>
                  {pageLabel}
                </Typography>
              ) : null}
              {citation.boundingBoxes?.length ? (
                <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY }}>
                  {`${citation.boundingBoxes.length} source coordinate${citation.boundingBoxes.length === 1 ? "" : "s"} available.`}
                </Typography>
              ) : null}
              {citation.multimodalUrl && (
                <CommonSubmitButton
                  isUppercase={false}
                  startIcon={<OpenInNewIcon />}
                  onClick={() => window.open(citation.multimodalUrl, "_blank", "noreferrer")}
                >
                  Open multimodal source
                </CommonSubmitButton>
              )}
              {citation.sourceUrl && (
                <CommonSubmitButton
                  isUppercase={false}
                  startIcon={<OpenInNewIcon />}
                  onClick={() => window.open(citation.sourceUrl, "_blank", "noreferrer")}
                >
                  Open source
                </CommonSubmitButton>
              )}
              {config.features.citationRefinement && (
                <CommonSubmitButton isUppercase={false} invert onClick={() => onRefine(citation)}>
                  {config.copy.refineLabel}
                </CommonSubmitButton>
              )}
            </Stack>
          </GxCard>
        </Stack>
      )}
    </Drawer>
  );
}

export default SourceViewerDrawer;
