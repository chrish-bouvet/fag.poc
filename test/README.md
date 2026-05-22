# Lokal testharness

Denne mappen brukes for lokal testing av parser, validering og generering.

- Legg markdown-issues i `test/issues/`
- Bruk filnavn pa formen `issue-5.md`
- Issue-nummeret leses fra filnavnet
- Label-mapping ligger i `test/labels.json`

Eksempel:

- `test/issues/issue-5.md`
- `test/labels.json` inneholder `"5": ["source:issue-form", "status:approved"]`

Kommandoer:

```sh
npm run validate:test
npm run build:test
npm run nightly:test
```