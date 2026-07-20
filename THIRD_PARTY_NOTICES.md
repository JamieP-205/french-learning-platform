# Third-party notices

## FLELex / Beacco

The files below are redistributed for the app's non-commercial curriculum verification:

- `content-tools/FleLex_TT_Beacco.tsv.gz` — an unchanged gzip archive of the upstream TSV.
- `content-tools/FleLex_TT_Beacco.csv` — a deterministic CSV conversion in which tabs were replaced by commas; lexical data was not changed.

Source: [FLELex download page](https://cental.uclouvain.be/cefrlex/flelex/download/)

Requested citation:

> Pintard, A. and François, T. (2020). Combining expert knowledge with frequency information to infer CEFR levels for words. In Proceedings of the 1st Workshop on Tools and Resources to Empower People with REAding DIfficulties (READI), pp. 85–92.

Licence: [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/).

This notice applies to the FLELex data files above. It does not grant a licence to unrelated source code or original curriculum content in this repository. Commercial use of the dataset requires separate clearance from its rights holders.

## Bundled French speech audio

The fixed French clips in `public/audio/french/` were generated locally from
the single-speaker [`fr_FR-siwis-medium` Piper voice](https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis/medium).
The neural-network model and Piper runtime are build inputs only; they are not
redistributed with this repository.

- Voice repository licence: [MIT](https://huggingface.co/rhasspy/piper-voices) (as declared by the repository).
- Voice dataset: [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353), [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/), as identified by the voice [model card](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/siwis/medium/MODEL_CARD).
- Generation runtime: [Piper release 2023.11.14-2](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2), MIT, copyright (c) 2022 Michael Hansen.
- Voice model SHA-256: `641D1AB097DA2B81128C076810EDB052B385DECC8BE3381814802A64A73BAF99`.
- Voice configuration SHA-256: `39479916C2DB192B5AC9764DADDD0C744D83E023AD890C6976C0633AE4DF8959`.

The clips were rendered at 22.05 kHz mono, loudness-normalised, and delivered as
44.1 kHz mono 96 kbps MP3. They are used as
the dependable first playback path for fixed learning prompts; device speech
synthesis remains a fallback.
