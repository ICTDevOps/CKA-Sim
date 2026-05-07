# kubectl fundamentals

> Source: https://kubernetes.io/docs/reference/kubectl/cheatsheet/

## The k alias

The `kubectl` binary is verbose for an exam where every keystroke counts.
Set the alias before doing anything else:

```bash
alias k=kubectl
complete -F __start_kubectl k
```

Use `k` everywhere from now on. The exam terminals come pre-configured with
this alias.

## Listing resources

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#get

`kubectl get <resource>` lists objects. Common variants:

- `k get pods -n web` — pods in the `web` namespace
- `k get pods -A` — pods in all namespaces (`-A` is the alias for
  `--all-namespaces`)
- `k get pods -o wide` — adds IP, node, nominated node, readiness gates
- `k get pods --watch` — stream changes
- `k get pods -l app=nginx` — filter by label

`pods` has the alias `po`. Most resources have short forms: `deploy`,
`svc`, `ns`, `sa`, `pv`, `pvc`, `ep`.

## Getting nodes

> Source: https://kubernetes.io/docs/concepts/architecture/nodes/

`k get nodes -o wide` shows IP, OS, container runtime version. Add
`--show-labels` to see node labels (used by node selectors and affinity).

## Output formats and JSONPath

> Source: https://kubernetes.io/docs/reference/kubectl/jsonpath/

Use `-o jsonpath` to extract specific fields. The exam often asks to
print only one piece of data — JSONPath beats `grep`/`awk` here.

- `k get nodes -o jsonpath='{.items[*].metadata.name}'` — all node names
  on one line
- `k get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'`
  — one node name per line
- `k get pv --sort-by=.spec.capacity.storage` — sort PVs by capacity

`{range ...}{end}` iterates over arrays and lets you control the
separator (here `\n`).

## --dry-run=client -o yaml

> Source: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/

The single most important flag combination for the CKA. Generate a manifest
without creating the resource, edit it, then apply:

```bash
k run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
# edit pod.yaml as needed
k apply -f pod.yaml
```

Works for `run`, `create`, `expose`, etc. Saves minutes vs. writing YAML
from scratch.

## Setting the default namespace

> Source: https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/

Typing `-n web` on every command is wasted time. Pin the namespace once:

```bash
k config set-context --current --namespace=web
```

The current context's `namespace` field is updated. All subsequent
commands target `web` until you change it again.
