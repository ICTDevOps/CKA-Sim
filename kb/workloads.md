# Workloads

## Creating pods with kubectl run

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#run

Since Kubernetes 1.18, `kubectl run` creates a pod (not a deployment):

```bash
k run nginx --image=nginx:1.27 -n web
```

`--image` is required. To override the default command, separate the
container args with `--`:

```bash
k run tester --image=busybox -- sleep 3600
```

Combined with `--dry-run=client -o yaml`, this is the fastest way to
generate a pod manifest.

## Creating deployments

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#create-deployment

Since 1.19, `create deployment` accepts `--replicas`:

```bash
k create deployment api --image=nginx --replicas=3 -n web
```

Before 1.19 you had to `create` then `scale`. The `deployment` resource
also has alias `deploy`.

## Scaling

> Source: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#scaling-a-deployment

```bash
k scale deployment api --replicas=5 -n web
```

`scale` works on `deployment`, `replicaset`, `statefulset`, and
`replicationcontroller`. Both `deployment/api` and `deployment api`
syntaxes are accepted.

## Updating images

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#set-image

`kubectl set image` is faster than `edit` for bumping a container image:

```bash
k set image deployment/api api=nginx:1.27 -n web
```

Format: `<container-name>=<image>`. The container name must match the
one in the deployment's pod spec.

## Rollout history and rollbacks

> Source: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment

```bash
k rollout history deployment/api -n web      # list revisions
k rollout undo deployment/api -n web         # rollback to previous
k rollout undo deployment/api --to-revision=3 -n web
k rollout status deployment/api -n web       # watch progress
k rollout restart deployment/api -n web      # force a new rollout
```

`undo` without arguments goes back one revision.

## Draining a node

> Source: https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/

Before maintenance, drain the node to evict its pods:

```bash
k drain worker-2 --ignore-daemonsets
k drain worker-2 --ignore-daemonsets --delete-emptydir-data --force
```

`--ignore-daemonsets` is almost always required (DaemonSet pods are
node-bound and can't be evicted). `--delete-emptydir-data` is needed
if any pod uses an `emptyDir` volume. After maintenance:

```bash
k uncordon worker-2
```
