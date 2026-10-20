# HUNO — Perencana Kelistrikan Booth

Dashboard pribadi berbahasa Indonesia untuk merencanakan LED strip/modul DC 12 V dan 24 V pada booth pameran.

## Menjalankan aplikasi

Gunakan Node.js 22 dan npm:

~~~sh
npm install
npm run dev
~~~

Buka alamat Vite yang ditampilkan. Untuk mengakses dari HP pada jaringan Wi-Fi yang sama, gunakan alamat IP komputer dan port Vite. Aplikasi juga dapat dipasang pada hosting statis menggunakan hasil folder dist.

~~~sh
npm test
npm run build
npm run preview
~~~

Pengujian browser:

~~~sh
npx playwright install chromium
npm run test:e2e
~~~

GitHub Actions menjalankan pengujian perhitungan/cadangan, pemeriksaan TypeScript, build produksi, dan pengujian Chromium untuk layar komputer serta HP. Hasil build dan laporan browser tersedia sebagai artifact pada halaman Actions. Artifact build merupakan berkas aplikasi; repository ini belum otomatis menerbitkan website.

## Alur penggunaan

1. Coba proyek berlabel **Contoh** atau buat proyek baru.
2. Tambahkan area booth, lalu rangkaian LED. Isi panjang dan W/m untuk strip; jumlah dan W/unit untuk modul, berdasarkan datasheet.
3. Periksa power supply yang disarankan. Katalog awal adalah contoh kapasitas dan dapat diedit sesuai perangkat yang benar-benar digunakan.
4. Ubah target beban atau atur penempatan rangkaian dan model PSU secara manual jika diperlukan.
5. Periksa skema DC, tambahkan komponen pelengkap secara manual, lalu cetak rencana dan daftar komponen.

## Perhitungan dan batasan

- Daya strip = panjang × W/m; daya modul = jumlah × W/unit.
- Arus DC = daya ÷ tegangan; arus 12 V dan 24 V ditampilkan terpisah.
- Target beban awal adalah 80%. Contoh: 5 m × 14,4 W/m = 72 W; kebutuhan kapasitas minimum 72 ÷ 0,8 = 90 W, sehingga katalog menyarankan PSU 100 W.
- Pembagian dilakukan terpisah menurut area dan tegangan. Rangkaian diurutkan dari beban terbesar, dikelompokkan dengan best-fit decreasing berdasarkan PSU kompatibel terbesar, kemudian setiap kelompok memakai kapasitas katalog terkecil yang mencukupi. Ini rekomendasi deterministik, bukan jaminan optimasi jumlah PSU global.
- Satu rangkaian terhubung ke satu PSU. Rangkaian yang melampaui kapasitas PSU terbesar harus dipecah oleh pengguna. Keluaran beberapa PSU tidak diparalelkan dalam skema.
- Pilihan manual tetap disimpan sampai pengguna meminta rekomendasi ulang. Tegangan tidak sesuai, rangkaian belum terpasang, referensi katalog hilang, dan kapasitas kurang ditandai.
- Melewati target beban merupakan peringatan; melewati kapasitas nominal PSU merupakan kesalahan.
- Perhitungan memakai presisi asli. Pembulatan hanya pada tampilan.
- Skema mencakup sisi DC. Ukuran kabel, jatuh tegangan, proteksi AC, konsumsi AC, stok, dan biaya tidak dihitung pada versi ini.

## Penyimpanan dan cadangan

Aplikasi tidak menggunakan login, backend, pelacakan, atau API eksternal. Data tersimpan pada localStorage browser dan perangkat yang sama. Menghapus data browser dapat menghapus proyek; gunakan **Ekspor cadangan** untuk menyimpan JSON atau memindahkannya ke perangkat lain.

**Cadangan dibatasi 2 MB dalam UTF-8.** Impor memvalidasi versi dan struktur sebelum meminta konfirmasi penggantian data. Data lokal rusak tidak ditimpa otomatis: penyimpanan dijeda sampai pengguna memilih pemulihan. Jika browser menolak penyimpanan, antarmuka menampilkan kesalahan dan cadangan tetap dapat diekspor.

Struktur cadangan versi 1 memuat katalog PSU dan proyek dengan area, rangkaian, penempatan PSU, serta komponen tambahan. Data yang belum lengkap tetap dapat diedit, tetapi tidak mendapat status sesuai perhitungan.
