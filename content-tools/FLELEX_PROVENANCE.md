# FLELex oracle provenance

- File: `FleLex_TT_Beacco.tsv.gz` (lossless gzip archive of the upstream TSV)
- Upstream: `https://cental.uclouvain.be/cefrlex/static/resources/fr/FleLex_TT_Beacco.tsv`
- Download page: `https://cental.uclouvain.be/cefrlex/flelex/download/`
- Retrieved: 2026-07-13
- SHA-256: `E0CBDB672FA4F83155ACEC4C8F01F179B30BE08CB3D2D6CF0D9F25042B01E3D4`
- Format after decompression: UTF-8, tab-separated values; the upstream bytes are preserved exactly.
- Licence stated on the download page: [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- Requested citation: Pintard, A. and François, T. (2020), *Combining expert knowledge with frequency information to infer CEFR levels for words*, READI 2020, pp. 85–92.

`FleLex_TT_Beacco.csv` is the deterministic comma-separated conversion used by
the verification scripts. Each tab was replaced by a comma; the source contains
no commas or quotes, so quoting or other semantic rewriting was unnecessary. Its
SHA-256 is `C0A3F8C53183D365EC5BEF9AE6AA6AB95DED533D283B379A2E177E4C028A97C8`.

The source archive is unchanged. The CSV is a format-only adaptation and remains
under the same CC BY-NC-SA 4.0 terms. See `THIRD_PARTY_NOTICES.md`.

The verification scripts read these vendored files only. They never fetch or
replace the oracle at runtime. The source archive is decompressed in memory and
its original-byte SHA-256 is checked, alongside the CSV SHA-256 and the explicit
`level` column in the expected header, before lexical levels are trusted.

Redistributing or using this non-commercial dataset in a commercial product needs
separate licence clearance. Keeping the oracle in the repository records the
current audit input; it is not a claim that broader product use is licensed.
