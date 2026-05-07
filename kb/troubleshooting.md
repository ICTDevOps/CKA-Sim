# Troubleshooting

## Inspecting pod state

> Source: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/

```bash
k describe pod api -n web
k get pod api -n web -o yaml
k get events -n web --sort-by=.lastTimestamp
```

`describe` is the fastest path to seeing scheduling decisions, image
pulls, readiness probe failures, and recent events for a single pod.

## Logs

> Source: https://kubernetes.io/docs/concepts/cluster-administration/logging/

```bash
k logs api -n web
k logs api -c main -n web                    # specific container
k logs api -c main --since=1h -n web         # last hour
k logs api --tail=50 -n web                  # last 50 lines
k logs api --previous -n web                 # previous container instance
k logs deployment/api -n web                 # logs from any pod
```

`--since` accepts duration suffixes: `30s`, `5m`, `1h`, `24h`.

## Resource usage with metrics-server

> Source: https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-usage-monitoring/

Requires `metrics-server` installed:

```bash
k top nodes
k top pods -n web
k top pods --sort-by=memory -n web
k top pods --sort-by=cpu -A
```

`--sort-by` accepts `cpu` or `memory`.

## Editing live resources

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#edit

```bash
k edit deployment api -n web
```

Opens the resource in `$EDITOR` (default `vi`). Save+quit applies the
change. Many fields are immutable — the API server will reject those
updates. For tricky cases, prefer:

```bash
k get deploy api -n web -o yaml > api.yaml
# edit api.yaml
k replace -f api.yaml
```

## Exec into a container

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#exec

```bash
k exec -it api -n web -- /bin/sh
k exec api -n web -- ls /etc
k exec -it api -c sidecar -n web -- /bin/bash
```

`--` separates kubectl flags from the command to run inside the
container.

## kubectl explain

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#explain

The fastest way to look up a resource field's schema during the exam:

```bash
k explain pod.spec.containers
k explain deployment.spec.strategy --recursive
```

Use `--recursive` to print the entire nested schema. Beats opening a
browser to kubernetes.io.
