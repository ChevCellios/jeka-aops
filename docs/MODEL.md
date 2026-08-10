# Model detekcije vozila

## Status javne distribucije

Javni repozitorij namjerno **ne sadrži binarni AI model**. Raniji razvojni artefakt identificirao se kao EfficientDet Lite0 V1, ali nije postojao izvorni zapis preuzimanja ni upstream checksum kojim bi se nedvojbeno potvrdili porijeklo i pravo redistribucije. Zbog toga je uklonjen prije javne objave.

`detectVehiclesInFrames` trenutačno je stabilna neutralna implementacija koja vraća prazan skup detekcija. Snimanje, lokalna pohrana, audio uzorkovanje, izdvajanje kadrova i izvještaji mogu se razvijati neovisno o odabiru modela.

## Uvjeti za novi model

Prije dodavanja ili automatskog preuzimanja modela pull request mora sadržavati:

1. naziv modela, izdavača, verziju, izvorni URL i datum preuzimanja;
2. SHA-256 preuzete datoteke i reproducibilan postupak provjere;
3. licencu modela, obavezne obavijesti i licencu skupa podataka;
4. dopušta li licenca redistribuciju binarnog artefakta i komercijalnu uporabu;
5. ulazni tip, oblik, RGB raspored i normalizaciju;
6. redoslijed, tipove i oblike izlaznih tenzora;
7. mapu klasa, confidence/NMS pragove i poznata ograničenja;
8. testove na sintetičkim ili pravilno licenciranim snimkama bez osobnih podataka.

## Integracijska granica

Adapter se implementira u `src/analysis/vehicleDetectionModel.ts` i mora zadržati potpis:

```ts
detectVehiclesInFrames(frames: EvidenceFrame[]): Promise<VehicleDetection[]>
```

Native biblioteka i config plugin dodaju se tek kada je odabrani model odobren. Model ne treba commitati ako se može reproducibilno preuzeti tijekom lokalne pripreme ili builda uz provjeru očekivanog SHA-256.

## Ograničenja rezultata

Detekcija, OCR i korelacija buke eksperimentalne su procjene. Ne smiju se predstavljati kao identifikacija osobe, certificirano mjerenje, forenzički dokaz ili automatski zaključak o prometnom prekršaju.
