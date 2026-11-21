# Mulai memakai BuildSteward

BuildSteward membantu coding agent memeriksa proyek, mengambil keputusan dengan bukti, dan melaporkan test yang benar-benar dijalankan.

Dari folder proyek, dengan Node.js 22.20 atau lebih baru:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Pilih agent, buka sesi baru, lalu minta:

> Pakai BuildSteward untuk memperbaiki bug ini. Reproduksi bug sebelum mengubah kode dan laporkan hasil test sesudahnya.

Cara ini memasang skill dari GitHub. Kalau kamu butuh penyimpanan work plan, catatan keputusan, atau inventaris lockfile npm offline, lihat [cara memasang CLI opsional](INSTALLATION.md). Pakai satu installer per direktori skill agar bundel CLI tidak tertimpa.

[Lihat agent dan skenario yang sudah diuji](../BUILD_STATUS.md).
