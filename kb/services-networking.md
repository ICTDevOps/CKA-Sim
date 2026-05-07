# Services & Networking

## Exposing a deployment

> Source: https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#expose

`kubectl expose` creates a Service for an existing deployment, pod, or
replication controller:

```bash
k expose deployment api --port=80 -n web
```

Default service type is `ClusterIP`. Use `--type=NodePort` or
`--type=LoadBalancer` to change it. The service inherits the
deployment's name unless you pass `--name=...`.

## Services and Endpoints

> Source: https://kubernetes.io/docs/concepts/services-networking/service/

A Service selects pods via labels and exposes them as a stable virtual IP.
The matching pod IPs are recorded as `Endpoints` (legacy) or
`EndpointSlices` (modern API):

```bash
k get endpoints api -n web                                        # legacy
k get ep api -n web                                                # alias
k get endpointslices -l kubernetes.io/service-name=api -n web      # modern
```

If `Endpoints` is empty, the Service has no matching ready pods —
common cause: label selector typo, or pods not in `Ready` state.

## Service types

> Source: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types

- `ClusterIP` (default): in-cluster only, virtual IP
- `NodePort`: exposes on a static port on every node (range 30000-32767)
- `LoadBalancer`: provisions an external LB (cloud provider)
- `ExternalName`: CNAME to an arbitrary DNS

## NetworkPolicies

> Source: https://kubernetes.io/docs/concepts/services-networking/network-policies/

NetworkPolicies are namespaced firewall rules selecting pods by labels.
Default behavior with no NetworkPolicy: all traffic allowed. Once a
NetworkPolicy selects a pod, only matching ingress/egress is allowed —
default deny becomes implicit.

A common pattern is a "deny-all" policy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

Then layered allow-policies for the legitimate flows.
