# Portal for faglige arrangementer

## Hensikt

Portalen gjor det enkelt a melde inn, kvalitetssikre og publisere faglige arrangementer internt ved hjelp av GitHub-native verktoy.

## Formal

Losningen skal:

- oke synligheten til faglige arrangementer internt
- redusere manuelt publiseringsarbeid
- gi enkel drift og tydelig ansvarsdeling
- gjore det mulig a bytte innmeldingskanal senere uten a bygge om hele portalen

## Arkitektur

Losningen bestar av fire hoveddeler:

- GitHub Issue Form for innmelding av arrangementer
- GitHub Actions for validering, godkjenning, bygg og nattlig vedlikehold
- Node-scripts som parser issues og bygger et canonical datagrunnlag
- GitHub Pages for publisering

Portalen bygges fra genererte datafiler, ikke direkte fra live issue-data i frontend.

## Datakontrakt

Hvert arrangement bestar av folgende felter:

- Tittel
- Ansvarlig
- Fagmiljo
- Kort beskrivelse for infoskjermer
- Tags
- Dato og klokkeslett
- Link til pamelding
- Beskrivelse

Regler:

- alle felter er pakrevd
- alle felter unntatt Beskrivelse behandles som enkeltlinjefelter
- Tags er kommaseparert tekst som normaliseres til en liste
- Dato og klokkeslett skrives som `YYYY-MM-DD HH:mm`
- all tid tolkes som `Europe/Oslo`

## Flyt

1. En bruker oppretter et arrangement via issue form.
2. Validation-workflow validerer innholdet.
3. Gyldige issues far `status:needs-review`.
4. Ugyldige issues far `status:invalid` med forklaring i kommentar.
5. Admin gjor QA og godkjenner ved a sette `status:approved`.
6. Build-workflow genererer siden og publiserer den.
7. Nattlig vedlikehold flytter gamle arrangementer til historisk status og republiserer portalen.

## Statusmodell

Folegende statuser brukes i v1:

- `status:invalid`
- `status:needs-review`
- `status:approved`
- `status:historical`
- `status:cancelled`

Regler:

- kun en `status:*`-label skal vare aktiv om gangen
- `status:cancelled` skal ikke overskrives automatisk av nattjobben

## Historikk

Nattjobben kjorer kl. 01:00 norsk tid.
Ved kjoring markeres alle arrangementer med dato til og med dagen for som historiske.

Dette betyr:

- arrangementer med dagens dato er fortsatt kommende
- historikk i v1 er datobasert, ikke klokkeslettbasert

## Avlyste arrangementer

Avlyste arrangementer skal ikke forsvinne helt. De skal vises som avlyste i historikk eller arkivvisning, og de skal ikke presenteres som kommende arrangementer.

## Drift

Admin-operasjoner:

- godkjenn et arrangement ved a sette `status:approved`
- avlys et arrangement ved a sette `status:cancelled`
- kjor manuell rebuild ved behov
- rett opp issues med `status:invalid` ved a redigere issue og la validation kjore pa nytt

## Lokal verifisering

Kjor disse kommandoene for a sjekke parser og build lokalt:

```sh
npm run validate:example
npm run build:example
```

## Fremtidig retning

Issue parsing er valgt som en enkel v1-losning. Pa sikt kan innmeldingskanalen byttes ut, for eksempel med PR-baserte event-filer eller et lite internt skjema, uten at portalens publiseringsmodell ma endres.