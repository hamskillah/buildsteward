# BuildSteward: panduan cepat (Bahasa Indonesia)

BuildSteward adalah fondasi **skill + CLI** untuk membuat AI coding agent bekerja dengan alur developer yang lebih disiplin, tanpa memasukkan semua referensi ke konteks model.

## Mulai

Persyaratan: Node.js 22+ dan repository proyek yang ingin dikerjakan. Dari folder BuildSteward:

```bash
npm test
node bin/buildsteward.js --root /lokasi/proyek init --mode approval
node bin/buildsteward.js --root /lokasi/proyek inspect
node bin/buildsteward.js route "Perbaiki bug login dan buat regression test"
node bin/buildsteward.js library search "dependency security"
```

Jika ingin memberi agent lebih banyak kebebasan **mengambil keputusan dalam scope yang telah disetujui**:

```bash
node bin/buildsteward.js --root /lokasi/proyek config set autonomy.mode autonomous
```

Ini tidak memberi izin otomatis untuk deploy production, menghapus data atau menggunakan kredensial. Batas eksekusi sesungguhnya tetap di pengaturan permission coding agent/host.

## Integrasi skill

Salin `skills/buildsteward/` ke direktori Agent Skills yang dikenali coding agent. Jika agent mendukung `.agents/skills/`, salin ke `.agents/skills/buildsteward/`. Lihat dokumentasi agent terkait untuk lokasi dan dukungan CLI-nya.

Agent boleh menjalankan skill walaupun CLI tidak ada. CLI menambahkan decision policy, evidence, checkpoint, dan loop detection.

## Memory Graph opsional

Jika Codebase Memory MCP sudah terpasang dan repository sudah diindeks dengan tool tersebut:

```bash
node bin/buildsteward.js --root /lokasi/proyek config set memory.codeGraph.mode on
node bin/buildsteward.js --root /lokasi/proyek graph status
node bin/buildsteward.js --root /lokasi/proyek graph search AuthHandler --project nama-project-di-CBM
```

Untuk mematikan: `config set memory.codeGraph.mode off`. BuildSteward tetap berjalan tanpa graph.

## Status saat ini

Ini fondasi fungsional yang sudah ditest lokal, **bukan keseluruhan produk otonom**. Dependency online memerlukan koneksi. Approval CLI belum menjadi batas keamanan terhadap agent yang bisa memakai shell bebas. Jangan mengklaim sebuah aplikasi sudah production-ready hanya karena perintah BuildSteward sukses.
