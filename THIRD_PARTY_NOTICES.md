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
speaker 0 of the [`fr_FR-mls-medium` Piper voice](https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/mls/medium).
The neural-network model and Piper runtime are build inputs only; they are not
redistributed with this repository.

- Voice repository licence: [MIT](https://huggingface.co/rhasspy/piper-voices) (as declared by the repository).
- Voice dataset: [Multilingual LibriSpeech (MLS), SLR94](https://openslr.org/94/), [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The voice's [model card](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/mls/medium/MODEL_CARD) states that it was trained from scratch.
- Generation runtime: [Piper release 2023.11.14-2](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2), MIT, copyright (c) 2022 Michael Hansen.
- Voice model SHA-256: `0ED223F78466917F2BAE05EE90096CE69AB1FDEB251F55590D0E7422D234E162`.
- Voice configuration SHA-256: `252B0B0A6E4CC4949E23ECCB956F9C779986C32F934F2F7E2191E5FDC2EDCA61`.

Requested dataset citation:

> Pratap, V., Xu, Q., Sriram, A., Synnaeve, G. and Collobert, R. (2020). MLS: A Large-Scale Multilingual Dataset for Speech Research. arXiv:2012.03411.

The clips were rendered at 22.05 kHz mono and compressed as MP3. They are used as
the dependable first playback path for fixed learning prompts; device speech
synthesis remains a fallback.
