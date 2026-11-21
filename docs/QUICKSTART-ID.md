# Mulai memakai BuildSteward

## Instal skill dari GitHub

Jalankan dari folder proyek, lalu pilih coding agent kamu:

```bash
npx skills add hamskillah/buildsteward --skill buildsteward
```

Buka sesi agent baru dan coba:

> Pakai BuildSteward untuk memperbaiki bug ini. Jaga perilaku yang sudah ada dan sebutkan cek yang lulus.

## Tambahkan CLI opsional dari npm

```bash
npm install -g @hamskillah/buildsteward
buildsteward
```

Jalankan `buildsteward` dari proyek untuk membuka menu setup. [Panduan instalasi](INSTALLATION.md) · [Hasil pengujian agent](../BUILD_STATUS.md).
