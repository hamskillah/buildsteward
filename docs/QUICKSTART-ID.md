# Mulai memakai BuildSteward

Dengan Node.js 22 atau lebih baru, instal CLI sekali:

```bash
npm install -g github:hamskillah/buildsteward
```

Masuk ke folder proyek dan ketik `buildsteward`. Pilih **Install or update the skill**, lalu pilih coding agent kamu atau tekan Enter jika pilihan yang terdeteksi sudah benar.

Buka sesi agent baru, lalu minta:

> Pakai BuildSteward untuk memperbaiki bug ini. Reproduksi bug sebelum mengubah kode dan laporkan hasil test sesudahnya.

Kalau mau langsung ke perintah tertentu, coba `buildsteward inspect`, `buildsteward doctor`, atau `buildsteward help`.

[Panduan lengkap dan setup per agent](INSTALLATION.md) · [Agent dan skenario yang sudah diuji](../BUILD_STATUS.md).
