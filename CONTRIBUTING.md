# Doprinos projektu

Hvala na interesu za JEKA AOPS. Prije većeg zahvata otvorite issue i opišite problem, očekivano ponašanje i način provjere.

## Lokalni razvoj

1. Instalirajte podržani Node.js LTS.
2. Pokrenite `npm ci`.
3. Prije slanja promjene pokrenite `npm run check` i `npx expo-doctor`.
4. Za native module koristite Expo development build; Expo Go nije dovoljan.

Pull request treba biti malen, imati jasan opis rizika i sadržavati testove za novu logiku. Ne uključujte snimke stvarnih osoba ili vozila, GPS lokacije, ključeve, certifikate, `.env` datoteke ili binarne modele nejasne licence.

## AI modeli i skupovi podataka

Svaki prijedlog modela mora navesti izdavača, izvorni URL, verziju, datum preuzimanja, SHA-256, licencu modela, licencu skupa podataka te ulazne i izlazne tenzore. Model se ne dodaje u repozitorij dok pravo redistribucije nije jasno.

Slanjem doprinosa pristajete da se doprinos licencira pod Apache-2.0 licencom projekta.
