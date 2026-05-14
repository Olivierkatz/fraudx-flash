import type {
  AuthResponse,
  ConfirmPasswordInput,
  GroundXClient,
  GroundXPartnerClient,
  LoginCustomerInput,
  RegisterCustomerInput,
  LlmClient,
} from "../types.js";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function devUsername(email: string): string {
  return email.trim().toLowerCase() || "dev-user@example.com";
}

function parseBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== "string") return {};
  try {
    const parsed = JSON.parse(init.body) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export class DevGroundXPartnerClient implements GroundXPartnerClient {
  async registerCustomer(input: RegisterCustomerInput): Promise<AuthResponse> {
    return { username: devUsername(input.email), token: "dev-register-token" };
  }

  async loginCustomer(input: LoginCustomerInput): Promise<AuthResponse> {
    return { username: devUsername(input.email), token: "dev-login-token" };
  }

  async getCustomer(username: string): Promise<{ customer: Record<string, unknown> }> {
    return { customer: { username, email: username, first: "Dev", last: "User" } };
  }

  async requestPasswordReset(email: string): Promise<unknown> {
    return { message: `Development reset requested for ${email}` };
  }

  async confirmPasswordReset(_input: ConfirmPasswordInput): Promise<unknown> {
    return { message: "Development password reset confirmed" };
  }

  async createApiKey(username: string, name: string): Promise<string> {
    return `dev-api-key:${username}:${name}`;
  }

  async forward(path: string, init: RequestInit & { customerKey?: string }): Promise<Response> {
    const method = init.method ?? "GET";
    if (path.startsWith("/project")) {
      return json({
        mode: "development",
        projects: [
          { projectId: "demo-project", name: "Demo Project", status: "active" },
          { projectId: "contracts", name: "Contract Review", status: "active" },
        ],
        path,
        method,
        customerKey: init.customerKey ?? null,
      });
    }
    if (path.startsWith("/bucket")) {
      return json({
        mode: "development",
        buckets: [
          { bucketId: "demo-bucket", name: "Demo Knowledge Base", documentCount: 42 },
          { bucketId: "support-bucket", name: "Support Library", documentCount: 86 },
        ],
        path,
        method,
        customerKey: init.customerKey ?? null,
      });
    }
    if (path.startsWith("/group")) {
      return json({
        mode: "development",
        groups: [
          { groupId: "demo-group", name: "Demo Users" },
          { groupId: "admin-group", name: "Administrators" },
        ],
        path,
        method,
        customerKey: init.customerKey ?? null,
      });
    }
    if (path.startsWith("/apikey")) {
      return json({
        mode: "development",
        apiKeys: [
          {
            apiKey: "dev-groundx-api-key",
            name: "Development key",
            prefix: "dev_1234",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        path,
        method,
        customerKey: init.customerKey ?? null,
      });
    }
    return json({ mode: "development", path, method, customerKey: init.customerKey ?? null });
  }
}

export class DevGroundXClient implements GroundXClient {
  async forward(path: string, init: RequestInit & { apiKey: string }): Promise<Response> {
    const method = init.method ?? "GET";
    const body = parseBody(init);
    if (path.startsWith("/search/")) {
      return json({
        mode: "development",
        query: body.query ?? "demo query",
        search: {
          results: [
            {
              documentId: "demo-doc-1",
              fileName: "customer-onboarding-guide.pdf",
              pageNumber: 2,
              score: 0.93,
              text: "GroundX Studio uses managed workspaces, grounded search, and middleware-owned credentials.",
              suggestedText: "Managed workspaces keep generated UI work durable while middleware owns secrets.",
              multimodalUrl: "https://example.com/mock/customer-onboarding-guide-page-2.png",
            },
            {
              documentId: "demo-doc-2",
              fileName: "support-workflow.md",
              pageNumber: 1,
              score: 0.87,
              text: "Support workflows combine semantic retrieval, structured state, and source review.",
              suggestedText: "Support workflow answers should cite individual search results.",
            },
          ],
        },
        path,
        method,
        hasApiKey: Boolean(init.apiKey),
      });
    }
    if (/^\/document\/[^/]+\/xray/.test(path)) {
      return json({
        mode: "development",
        document: {
          documentId: path.split("/")[2],
          pages: [
            {
              pageNumber: 1,
              multimodalUrl: "https://example.com/mock/xray-page-1.png",
              elements: [
                {
                  id: "heading-1",
                  type: "heading",
                  text: "Customer Onboarding",
                  bbox: { left: 0.12, top: 0.08, width: 0.45, height: 0.05 },
                },
                {
                  id: "paragraph-1",
                  type: "paragraph",
                  text: "Invite teammates, upload source documents, and run grounded workflows.",
                  bbox: { left: 0.12, top: 0.17, width: 0.72, height: 0.12 },
                },
              ],
            },
          ],
        },
        path,
        method,
        hasApiKey: Boolean(init.apiKey),
      });
    }
    if (path.startsWith("/ingest/")) {
      return json({
        mode: "development",
        ingest: { processId: "mock-process-1", status: "complete", documentId: "demo-doc-1" },
        path,
        method,
        hasApiKey: Boolean(init.apiKey),
      });
    }
    if (path.startsWith("/workflow")) {
      return json({
        mode: "development",
        workflows: [
          { workflowId: "extract-invoice-fields", name: "Extract invoice fields", status: "active" },
          { workflowId: "summarize-support-ticket", name: "Summarize support ticket", status: "active" },
        ],
        path,
        method,
        hasApiKey: Boolean(init.apiKey),
      });
    }
    return json({ mode: "development", path, method, hasApiKey: Boolean(init.apiKey) });
  }
}

export class DevLlmClient implements LlmClient {
  async forward(path: string, init: RequestInit): Promise<Response> {
    const method = init.method ?? "GET";
    const body = parseBody(init);
    if (path.includes("/chat/completions")) {
      return json({
        mode: "development",
        id: "mock-chat-completion",
        object: "chat.completion",
        model: "mock-groundx-studio-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                "This is a deterministic development response. Replace MOCK_MODE=true with real provider credentials when validating model behavior.",
            },
            finish_reason: "stop",
          },
        ],
        requestMessageCount: Array.isArray(body.messages) ? body.messages.length : 0,
      });
    }
    return json({ mode: "development", path, method, answer: "Development LLM response" });
  }
}
