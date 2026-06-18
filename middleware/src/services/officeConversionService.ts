import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface OfficeConversionConfig {
  enabled: boolean;
  command: string;
  timeoutMs: number;
}

export async function convertOfficeToPdf(input: {
  fileName: string;
  bytes: Buffer;
  config: OfficeConversionConfig;
}): Promise<{ fileName: string; bytes: Buffer }> {
  if (!input.config.enabled) {
    throw new Error("Server-side PDF conversion is not configured");
  }

  const workDir = await mkdtemp(join(tmpdir(), "groundx-file-uploader-"));
  try {
    const sourcePath = join(workDir, input.fileName);
    await writeFile(sourcePath, input.bytes);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(input.config.command, ["--headless", "--convert-to", "pdf", "--outdir", workDir, sourcePath], {
        stdio: "ignore",
      });
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Office to PDF conversion timed out"));
      }, input.config.timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Office to PDF conversion failed: ${error.message}`));
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error("Office to PDF conversion failed"));
      });
    });

    const output = (await readdir(workDir)).find((file) => file.toLowerCase().endsWith(".pdf"));
    if (!output) throw new Error("Office to PDF conversion did not produce a PDF");
    return {
      fileName: input.fileName.replace(/\.[^.]+$/, ".pdf"),
      bytes: await readFile(join(workDir, output)),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

