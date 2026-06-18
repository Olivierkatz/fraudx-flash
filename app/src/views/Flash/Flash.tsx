import { useEffect, useState } from "react";
import BoltIcon from "@mui/icons-material/BoltOutlined";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { GxCard } from "@/shared/components/GxCard";
import { GxSectionHeader } from "@/shared/components/GxSectionHeader";
import { EducationalTooltip } from "@/shared/components/EducationalTooltip";
import { FileUploaderProvider } from "@/contexts/FileUploaderContext";
import { ChatWithSourcesProvider } from "@/contexts/ChatWithSourcesContext";
import { GroundXFileUploader } from "@/shared/components/FileUploader";
import { ChatWithSources } from "@/shared/components/ChatWithSources";
import { NAVY, BODY_TEXT, GREEN } from "@/constants";

interface Bucket {
  bucketId: number;
  name: string;
}

interface OpenAIModel {
  id: string;
  object: string;
}

export const Flash = () => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucketId, setSelectedBucketId] = useState<number | "">("");
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    fetch("/api/v1/bucket")
      .then((r) => r.json())
      .then((data) => {
        const list: Bucket[] = data.buckets ?? [];
        setBuckets(list);
        if (list.length > 0) setSelectedBucketId(list[0].bucketId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/flash/models")
      .then((r) => r.json())
      .then((data) => {
        const list: OpenAIModel[] = (data.data ?? []).filter(
          (m: OpenAIModel) => m.id.startsWith("gpt-")
        );
        list.sort((a, b) => a.id.localeCompare(b.id));
        setModels(list);
        const preferred = list.find((m) => m.id === "gpt-4o") ?? list[0];
        if (preferred) setSelectedModel(preferred.id);
      })
      .catch(() => {});
  }, []);

  const scope = selectedBucketId
    ? {
        searchTarget: { type: "bucket" as const, bucketId: selectedBucketId },
        modelId: selectedModel || undefined,
      }
    : null;

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <BoltIcon sx={{ color: GREEN, fontSize: 28 }} aria-hidden="true" />
          <Typography component="h1" variant="h4" fontWeight={700} color={NAVY}>
            FraudX Flash
          </Typography>
          <EducationalTooltip
            ariaLabel="About FraudX Flash"
            title="Upload any claim document and query it instantly. Flash indexes the file into your claim bucket in the background — no waiting for manual ingestion."
          />
        </Stack>
        <Typography variant="body1" color={BODY_TEXT} sx={{ maxWidth: 760 }}>
          Upload a new claim file and get instant sourced answers. The document is added to
          your claim bucket automatically while you work.
        </Typography>
      </Stack>

      {/* Controls row */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="bucket-label">Claim bucket</InputLabel>
          <Select
            labelId="bucket-label"
            label="Claim bucket"
            value={selectedBucketId}
            onChange={(e) => setSelectedBucketId(e.target.value as number)}
          >
            {buckets.map((b) => (
              <MenuItem key={b.bucketId} value={b.bucketId}>
                {b.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="model-label">AI model</InputLabel>
          <Select
            labelId="model-label"
            label="AI model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Upload */}
      {selectedBucketId !== "" && (
        <GxCard>
          <GxSectionHeader
            label="UPLOAD DOCUMENT"
            education={
              <EducationalTooltip
                ariaLabel="About document upload"
                title="Upload PDFs, Word docs, Excel files, or images. Flash queries the document immediately and ingests it into your claim bucket in the background."
              />
            }
          />
          <Divider sx={{ my: 2 }} />
          <FileUploaderProvider>
            <GroundXFileUploader
              bucketId={selectedBucketId as number}
              bucketName={buckets.find((b) => b.bucketId === selectedBucketId)?.name}
              onIngestStarted={(processIds) => {
                console.info("Ingest started", processIds);
              }}
            />
          </FileUploaderProvider>
        </GxCard>
      )}

      {/* Chat */}
      {scope && (
        <GxCard sx={{ minHeight: 520 }}>
          <GxSectionHeader
            label="ASK A QUESTION"
            education={
              <EducationalTooltip
                ariaLabel="About the chat interface"
                title="Ask anything about the documents in this bucket. Every answer is grounded — citations link back to the exact source passage in the original document."
              />
            }
          />
          <Divider sx={{ my: 2 }} />
          <Box sx={{ height: 440 }}>
            <ChatWithSourcesProvider>
              <ChatWithSources
                scope={scope}
                config={{
                  starterPrompts: [
                    "Summarize the key facts in this claim",
                    "Are there any inconsistencies in the treatment history?",
                    "What dates of service are mentioned?",
                    "Who are the treating providers?",
                  ],
                }}
              />
            </ChatWithSourcesProvider>
          </Box>
        </GxCard>
      )}
    </Stack>
  );
};
