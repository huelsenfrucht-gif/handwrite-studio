# Lokales Generatormodell

Dieser Ordner nimmt das freigegebene Produktionsmodell auf:

- `manifest.json`
- `model.onnx`

Der Browser erwartet die Eingaben `tokens`, `token_length`, `style` und `seed`.
Das Modell gibt `strokes` mit der Form `[1, points, 4]` aus. Die vier Werte
sind `dx`, `dy`, Druck (0–1) und Stiftheben (0 oder 1). `stroke_length`
enthält die gültige Punktzahl.

Es wird absichtlich kein fremder Forschungscheckpoint als Platzhalter
mitgeliefert. Erst rechtlich freigegebene Gewichte dürfen unter diesen Namen
veröffentlicht werden.
