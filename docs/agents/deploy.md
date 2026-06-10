# Deploy

Managed scaffold deployments use GitHub Actions, Docker images, Helm, and
Kubernetes. Agents should use the `groundx-studio` MCP tools for lifecycle
actions when available.

## Configuration

Use deploy-config before publishing a new environment. Non-secret values belong
in deploy variables; secrets belong in deploy secrets. Do not pass secrets
through publish inputs.

Important deploy variables include:

- `PUBLIC_ACCESS`
- `PUBLIC_DOMAIN` or `PUBLIC_HOST`
- `INGRESS_CLASS_NAME`
- `INGRESS_ANNOTATIONS_JSON`
- `ACM_CERTIFICATE_ARN`
- `ALB_GROUP_NAME`
- `TLS_SECRET_NAME`
- `DEPLOY_RUNNER`
- `EKS_CLUSTER_NAME_DEV` / `EKS_CLUSTER_REGION_DEV`
- `EKS_CLUSTER_NAME_PROD` / `EKS_CLUSTER_REGION_PROD`

## Publish

Publish dispatches the managed repo workflow for `dev` or `prod`. It should
not be used to smuggle deploy settings or secrets. Configure first, then
publish.

## Diagnostics

The scaffold ships `diagnose.yml` and `uninstall.yml`. Use Workspace
diagnostics through MCP or the Workspace facade to read workflow status/logs,
dispatch pod logs/describes, and check Helm status. Use `deployment_teardown`
to remove a managed deployment without deleting the project/repo; reserve
`helm_uninstall` / `uninstall.yml` for lower-level fallback removal.

For on-prem or air-gapped readiness, start with
[`airgap-audit.md`](airgap-audit.md) and inventory every production runtime host
before claiming the deploy can run without public egress.

Do not claim a hosted URL is ready until public access is configured and the
agent verifies that the URL responds.
