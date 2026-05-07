# Storage

## PersistentVolumes and Claims

> Source: https://kubernetes.io/docs/concepts/storage/persistent-volumes/

`PersistentVolume` (PV) is a cluster-level storage resource.
`PersistentVolumeClaim` (PVC) is a namespaced request that binds to a PV.

```bash
k get pv                                       # cluster-wide
k get pv --sort-by=.spec.capacity.storage      # smallest first
k get pvc -n web                               # claims in web ns
```

A PV has `accessModes` (`ReadWriteOnce`, `ReadOnlyMany`,
`ReadWriteMany`, `ReadWriteOncePod`) and a `reclaimPolicy`
(`Retain`, `Delete`, `Recycle`).

## StorageClasses

> Source: https://kubernetes.io/docs/concepts/storage/storage-classes/

A `StorageClass` defines a "class" of storage with a provisioner and
parameters. PVCs can request a class via `storageClassName`. The cluster
typically has a default class that PVCs without explicit selection use.

```bash
k get storageclass
k get sc                                        # alias
```

The default class is marked with `(default)` in the output.

## Mounting volumes in pods

> Source: https://kubernetes.io/docs/concepts/storage/volumes/

```yaml
spec:
  containers:
  - name: app
    volumeMounts:
    - mountPath: /data
      name: pv-storage
  volumes:
  - name: pv-storage
    persistentVolumeClaim:
      claimName: my-pvc
```

For the CKA, common volume types to remember: `emptyDir` (pod-local
scratch), `hostPath` (node-local, single node), `configMap` and
`secret` (mount config), `persistentVolumeClaim` (real storage).
