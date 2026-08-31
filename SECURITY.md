# Sigurnosna politika

## Podržane verzije

Projekt je istraživački prototip. Sigurnosne ispravke primjenjuju se na zadnju verziju grane `master`.

## Prijava ranjivosti

Nemojte objavljivati osjetljive detalje u javnom issueu. Upotrijebite GitHubovu opciju **Report a vulnerability** u kartici Security. Ako private vulnerability reporting nije uključen, otvorite issue bez tehničkih detalja i zatražite privatni kanal.

U prijavi navedite pogođenu verziju, korake reprodukcije, mogući učinak i prijedlog ispravka. Cilj je potvrditi primitak u roku od 7 dana i objaviti koordiniranu ispravku prije potpunih detalja.

## Granice povjerenja

- Aplikacija obrađuje video, zvuk, lokaciju i moguće registracijske oznake lokalno na uređaju.
- Projekt nije certificirani mjerni, forenzički ili sustav za automatsko utvrđivanje prekršaja.
- Ne šaljite stvarne snimke, GPS podatke ili osobne podatke u issue, testove ili pull requestove.
- Modeli strojnog učenja smiju se dodati samo uz provjerljiv izvor, licencu, checksum i dokumentirani ulaz/izlaz.

## Poznati upstream nalazi

Na dan 31. kolovoza 2026. `npm audit --omit=dev` prijavljuje 11 umjerenih, bez visokih ili kritičnih nalaza. Preostali nalazi dolaze kroz aktualni Expo config/prebuild lanac i stariji `uuid` koji koristi alat `xcode`. Npm kao automatski "popravak" predlaže regresivni povratak s Expo SDK-a 57 na 46, što nije prihvatljivo niti je stvarna sigurnosna nadogradnja. Održavatelji trebaju primijeniti kompatibilnu službenu Expo nadogradnju čim bude dostupna.

Ovo nije tvrdnja da su svi audit nalazi iskoristivi u runtime aplikaciji. Dependabot prati nove verzije, a svaku nadogradnju treba potvrditi kroz `npm run check`, `npx expo-doctor` i development build na uređaju.
