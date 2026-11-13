# German OCR correction lexicon

The offline correction lexicon is derived from the German output of
[`Luraty/language-packs`](https://github.com/Luraty/language-packs).

- `lemmas.tsv`: German surface forms generated from Wikidata Lexemes, CC0 1.0.
- `frequency.txt`: frequency ordering generated from Leipzig Corpora material;
  see `provenance.json` and the upstream `languages/de/SOURCES.md` for the
  applicable CC BY attribution and exact source records.

The application uses these files only for local OCR post-correction. No text or
handwriting is sent to an external service.

`words.bloom` is a compact membership filter generated from
[`enz/german-wordlist`](https://github.com/enz/german-wordlist), licensed under
CC0 1.0. The application uses it only to recognize valid German word forms;
the full source word list is not shipped to browsers.

`context-frequency.txt` is the German 50,000-word frequency list from
[`hermitdave/FrequencyWords`](https://github.com/hermitdave/FrequencyWords),
generated from OpenSubtitles 2018 and licensed CC BY-SA 4.0. It broadens local
OCR suggestions, especially for common names and conversational vocabulary.
