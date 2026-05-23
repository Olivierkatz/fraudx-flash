import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function commandExists(command) {
  return spawnSync(command, ["version"], { stdio: "ignore" }).status === 0;
}

function countRenderedKinds(rendered, kind) {
  return rendered.split(/^---$/m).filter((doc) => new RegExp(`kind:\\s*${kind}\\b`).test(doc)).length;
}

for (const file of [
  "Dockerfile.frontend",
  "Dockerfile.middleware",
  "deploy/helm/groundx-web-ui/Chart.yaml",
  "deploy/helm/groundx-web-ui/values.yaml",
  "deploy/helm/groundx-web-ui/templates/frontend-deployment.yaml",
  "deploy/helm/groundx-web-ui/templates/middleware-deployment.yaml",
  "deploy/helm/groundx-web-ui/templates/middleware-service.yaml",
  "deploy/helm/groundx-web-ui/templates/ingress.yaml",
  "deploy/nginx/default.conf.template",
]) {
  assert(existsSync(join(root, file)), `${file} must exist`);
}

const frontendDockerfile = read("Dockerfile.frontend");
assert(frontendDockerfile.includes("npm --workspace app run build"), "frontend image must build the Vite app");
assert(frontendDockerfile.includes("/etc/nginx/templates/default.conf.template"), "frontend image must install nginx proxy template");

const middlewareDockerfile = read("Dockerfile.middleware");
assert(middlewareDockerfile.includes("npm --workspace middleware run build"), "middleware image must build TypeScript");
assert(middlewareDockerfile.includes('"npm", "--workspace", "middleware", "run", "start"'), "middleware image must run the middleware start script");

const nginxTemplate = read("deploy/nginx/default.conf.template");
assert(nginxTemplate.includes("location /api/"), "nginx must proxy /api/*");
assert(nginxTemplate.includes("proxy_pass ${MIDDLEWARE_SERVICE_URL};"), "nginx must proxy to middleware service URL");

const middlewareService = read("deploy/helm/groundx-web-ui/templates/middleware-service.yaml");
assert(/type:\s*ClusterIP/.test(middlewareService), "middleware Service must be ClusterIP");

const ingress = read("deploy/helm/groundx-web-ui/templates/ingress.yaml");
assert(ingress.includes('eq .Values.publicAccess "ingress"'), "Ingress must only render in public ingress mode");
assert(!ingress.includes("middleware"), "Ingress must never route directly to middleware");

const workflow = read(".github/workflows/deploy.yml");
assert(workflow.includes("branches:\n      - main"), "deploy workflow must run on merge/push to main");
assert(workflow.includes("workflow_dispatch:"), "deploy workflow must support manual runs");
assert(workflow.includes("type: choice") && workflow.includes("- dev") && workflow.includes("- prod"), "manual deploy environment must be dev|prod");
assert(workflow.includes('kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -'), "namespace creation must be idempotent");
assert(workflow.includes("Dockerfile.frontend") && workflow.includes("Dockerfile.middleware"), "workflow must build both Docker images");

const dispatchInputs = workflow.match(/workflow_dispatch:\n    inputs:\n(?<body>[\s\S]*?)\n\npermissions:/)?.groups?.body ?? "";
const dispatchInputNames = [...dispatchInputs.matchAll(/^ {6}([A-Za-z0-9_]+):/gm)].map((match) => match[1]);
const forbiddenInputNames = dispatchInputNames.filter((name) => {
  if (/SecretName$/.test(name)) return false;
  return /(password|token|credential|kube|config)/i.test(name);
});
assert(forbiddenInputNames.length === 0, `workflow_dispatch inputs must not accept secret values: ${forbiddenInputNames.join(", ")}`);

if (commandExists("helm")) {
  execFileSync("helm", ["lint", "deploy/helm/groundx-web-ui"], { cwd: root, stdio: "inherit" });

  const devTemplate = execFileSync(
    "helm",
    [
      "template",
      "groundx-web-ui",
      "deploy/helm/groundx-web-ui",
      "--namespace",
      "gx-dev",
      "--set-string",
      "environment=dev",
      "--set-string",
      "publicAccess=none",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert(countRenderedKinds(devTemplate, "Ingress") === 0, "internal-only mode must render no Ingress");
  assert(countRenderedKinds(devTemplate, "Namespace") === 0, "default Helm render must leave namespace creation to the workflow");
  assert(/name:\s*groundx-web-ui-middleware[\s\S]*type:\s*ClusterIP/.test(devTemplate), "rendered middleware Service must be ClusterIP");

  const prodTemplate = execFileSync(
    "helm",
    [
      "template",
      "groundx-web-ui",
      "deploy/helm/groundx-web-ui",
      "--namespace",
      "gx-prod",
      "--set-string",
      "environment=prod",
      "--set-string",
      "publicAccess=ingress",
      "--set-string",
      "publicHost=ui.example.com",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert(countRenderedKinds(prodTemplate, "Ingress") === 1, "public mode must render exactly one frontend Ingress");
  assert(/kind:\s*Ingress[\s\S]*name:\s*groundx-web-ui-frontend/.test(prodTemplate), "Ingress must target the frontend only");

  const namespaceTemplate = execFileSync(
    "helm",
    [
      "template",
      "groundx-web-ui",
      "deploy/helm/groundx-web-ui",
      "--namespace",
      "gx-managed",
      "--set",
      "namespace.create=true",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert(countRenderedKinds(namespaceTemplate, "Namespace") === 1, "chart must support opt-in Namespace rendering");
} else {
  console.warn("helm not found; static deploy asset checks passed, Helm render checks skipped locally");
}
