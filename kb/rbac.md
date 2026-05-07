# RBAC & cluster architecture

## Namespaces

> Source: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/

```bash
k create namespace staging
k create ns staging          # alias
```

Namespaces partition cluster resources. Most resources are namespaced
(Pod, Deployment, Service, Role, ConfigMap). Cluster-scoped exceptions:
Node, PersistentVolume, ClusterRole, ClusterRoleBinding, StorageClass.

## ServiceAccounts

> Source: https://kubernetes.io/docs/concepts/security/service-accounts/

```bash
k create serviceaccount ci -n web
k create sa ci -n web        # alias
```

Pods run with a ServiceAccount (defaults to `default` if not set). The
SA is the identity used for in-cluster API calls (e.g., when a pod
calls `kubectl`).

## Roles and ClusterRoles

> Source: https://kubernetes.io/docs/reference/access-authn-authz/rbac/

```bash
# Namespace-scoped
k create role reader \
  --verb=get,list,watch \
  --resource=pods \
  -n web

# Cluster-scoped
k create clusterrole node-reader \
  --verb=get,list \
  --resource=nodes
```

Verbs are comma-separated, no spaces. Common verbs: `get`, `list`,
`watch`, `create`, `update`, `patch`, `delete`, `deletecollection`.

## Bindings

> Source: https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding

```bash
k create rolebinding ci-reader \
  --role=reader \
  --serviceaccount=web:ci \
  -n web

k create clusterrolebinding ci-cluster-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=web:ci
```

A ClusterRole can be referenced by a RoleBinding to grant cluster-wide
permissions inside a single namespace — an important pattern.

## Checking effective permissions

> Source: https://kubernetes.io/docs/reference/access-authn-authz/authorization/#checking-api-access

`kubectl auth can-i` answers yes/no taking all applicable Roles and
ClusterRoles into account:

```bash
k auth can-i create deployments \
  --as=system:serviceaccount:web:ci \
  -n web

k auth can-i --list --as=system:serviceaccount:web:ci -n web
```

Format for the `--as` flag: `system:serviceaccount:<namespace>:<sa-name>`.

## Switching contexts

> Source: https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

```bash
k config get-contexts                        # list
k config current-context                     # show active
k config use-context <name>                  # switch
k config set-context --current --namespace=web
```

Pinning the namespace via `set-context --current --namespace=...`
beats typing `-n` on every command.
