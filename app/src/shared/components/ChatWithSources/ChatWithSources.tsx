import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { FormEvent, useMemo, useState } from "react";

import type { ChatWithSourcesScope } from "@/api/entities/chatWithSourcesEntity";
import { BODY_TEXT, BORDER, BORDER_RADIUS, FONT_SIZE_BODY, FONT_WEIGHT_LABEL, NAVY, PADDING } from "@/constants";
import { useChatWithSourcesContext } from "@/contexts/ChatWithSourcesContext";
import CommonCancelButton from "@/shared/components/CommonCancelButton";
import CommonSubmitButton from "@/shared/components/CommonSubmitButton";
import CommonTextField from "@/shared/components/CommonTextField";
import EducationalTooltip from "@/shared/components/EducationalTooltip";
import GxCard from "@/shared/components/GxCard";
import GxPill from "@/shared/components/GxPill";
import GxSectionHeader from "@/shared/components/GxSectionHeader";

import {
  ChatWithSourcesConfigInput,
  createChatWithSourcesConfig,
} from "./chatWithSourcesConfig";
import SourceViewerDrawer from "./SourceViewerDrawer";

export interface ChatWithSourcesProps {
  scope: ChatWithSourcesScope;
  config?: ChatWithSourcesConfigInput;
  onMessageSent?: (message: string) => void;
}

export function ChatWithSources({ scope, config: configInput, onMessageSent }: ChatWithSourcesProps) {
  const config = useMemo(() => createChatWithSourcesConfig(configInput), [configInput]);
  const {
    messages,
    isSending,
    error,
    sendMessage,
    clearError,
    activeCitation,
    openSource,
    closeSource,
    refineCitation,
  } = useChatWithSourcesContext();
  const [message, setMessage] = useState("");
  const cleanMessage = message.trim();
  const isMessageValid = cleanMessage.length > 0 && cleanMessage.length <= config.limits.maxMessageLength;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!isMessageValid || isSending) return;
    const outgoing = cleanMessage;
    await sendMessage({ scope, message: outgoing });
    setMessage("");
    onMessageSent?.(outgoing);
  };

  return (
    <GxCard>
      <Stack spacing={2}>
        <GxSectionHeader
          label={config.copy.title}
          education={<EducationalTooltip ariaLabel={config.copy.educationAriaLabel} title={config.copy.educationCopy} />}
          action={config.copy.scopeLabel ? <GxPill variant="info">{config.copy.scopeLabel.toUpperCase()}</GxPill> : undefined}
        />

        {messages.length === 0 && (
          <Box
            sx={{
              border: "1px solid",
              borderColor: BORDER,
              borderRadius: BORDER_RADIUS,
              p: PADDING,
            }}
          >
            <Stack spacing={1.5}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY }}>
                  {config.copy.emptyState}
                </Typography>
                <EducationalTooltip
                  ariaLabel={config.copy.citationEducationAriaLabel}
                  title={config.copy.citationEducationCopy}
                />
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {config.starterPrompts.map((prompt) => (
                  <GxPill key={prompt} onClick={() => setMessage(prompt)}>{prompt}</GxPill>
                ))}
              </Box>
            </Stack>
          </Box>
        )}

        <Stack spacing={1.5} aria-live="polite">
          {messages.map((item) => (
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
                <Typography sx={{ color: NAVY, fontWeight: FONT_WEIGHT_LABEL }}>
                  {item.role === "user" ? "You" : "Assistant"}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                  {item.segments.map((segment, index) =>
                    segment.type === "content" ? (
                      <Typography key={`${item.id}-${index}`} component="span" sx={{ color: BODY_TEXT, fontSize: FONT_SIZE_BODY }}>
                        {segment.text}
                      </Typography>
                    ) : (
                      <GxPill
                        key={segment.citation.id}
                        variant="info"
                        onClick={() => openSource(segment.citation)}
                        dense
                      >
                        {`SOURCE ${segment.citation.sourceIndex}`}
                      </GxPill>
                    )
                  )}
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {isSending && <Alert severity="info">{config.copy.loadingLabel}</Alert>}
        {error && (
          <Alert
            severity="error"
            action={<CommonCancelButton onClick={clearError}>{config.copy.retryLabel}</CommonCancelButton>}
          >
            {config.copy.errorLabel}
          </Alert>
        )}

        <Box component="form" onSubmit={submit}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "flex-end" }}>
            <CommonTextField
              dense
              fullWidth
              multiline
              minRows={2}
              label={config.copy.inputLabel}
              placeholder={config.copy.inputPlaceholder}
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, config.limits.maxMessageLength))}
              inputProps={{ "aria-label": config.copy.inputLabel }}
            />
            <CommonSubmitButton type="submit" disabled={!isMessageValid || isSending} endIcon={<SendIcon />}>
              {config.copy.sendLabel}
            </CommonSubmitButton>
          </Stack>
        </Box>

        <SourceViewerDrawer
          citation={activeCitation}
          config={config}
          onClose={closeSource}
          onRefine={refineCitation}
        />
      </Stack>
    </GxCard>
  );
}

export default ChatWithSources;
