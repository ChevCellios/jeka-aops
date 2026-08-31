# Model detekcije vozila

JEKA AOPS uključuje lokalni **EfficientDet-Lite0 int8, verzija 1** za početnu detekciju cestovnih vozila. Model radi na uređaju; snimke i kadrovi ne šalju se vanjskom AI servisu.

## Podrijetlo i licenca

- Izdavač: Google / TensorFlow
- Arhitektura: EfficientDet-Lite0
- Skup podataka: COCO 2017, 80 klasa
- Fiksni izvor: <https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite>
- Službena kartica: <https://www.kaggle.com/models/tensorflow/efficientdet/tfLite/lite0-detection-metadata/1>
- Službeni vodič: <https://developers.google.com/edge/mediapipe/solutions/vision/object_detector>
- Licenca modela: Apache License 2.0
- Datum preuzimanja: 2026-09-01
- Veličina: 4.602.795 bajtova
- SHA-256: `0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb`

Model je spremljen kao `assets/models/efficientdet-lite0-int8-v1.tflite`. Runtime `react-native-fast-tflite` distribuira se pod MIT licencom.

## Ulaz i izlaz

- Ulaz: RGB `uint8`, `[1, 320, 320, 3]`
- Predobrada: očuvanje omjera slike uz letterbox rubove vrijednosti 114
- Izlazi: okviri `[top, left, bottom, right]`, COCO klase, confidence i broj detekcija
- Prag: 0,32
- Prihvaćene klase: bicycle, car, motorcycle, bus i truck
- Koordinate: nakon izvođenja vraćaju se u normalizirane koordinate izvornog kadra

Kadrovi se izdvajaju lokalno iz videozapisa. Model se izvršava CPU delegatom radi predvidljive kompatibilnosti; kasnije se može zasebno provjeriti GPU delegat.

## OCR fallback

Ako detektor ne pronađe vozilo, aplikacija ipak zadržava do tri najkvalitetnija cijela kadra i na njima pokreće OCR. Takvi kandidati nisu prostorno pridruženi vozilu i moraju biti jasno označeni kao nepouzdani. Registracijska oznaka ne prikazuje se kao potvrđena bez ponavljanja kroz više različitih kadrova.

## Poznata ograničenja

- COCO model prepoznaje opće klase vozila; ne prepoznaje marku, model, identitet ni prometni prekršaj.
- Mala, zamućena, zaklonjena i noćna vozila mogu biti propuštena.
- Confidence nije dokaz točnosti niti certificirana mjera.
- OCR može zamijeniti slične znakove; rezultat ostaje kandidat dok se ne potvrdi kroz više kadrova.
- Zvuk u videozapisu uvezenom iz galerije lokalno se dekodira i svodi na RMS dBFS očitanja u prozorima od 250 ms. To omogućuje vremensku korelaciju s vizualnim tragom vozila, ali nije kalibrirano mjerenje razine zvučnog tlaka u dB(A) niti dokaz da je baš opaženo vozilo izvor zvuka.
- Bez kalibracije scene aplikacija ne mjeri stvarnu brzinu vozila.

Detekcija, OCR i korelacija buke eksperimentalne su procjene. Ne smiju se predstavljati kao identifikacija osobe, certificirano mjerenje, forenzički dokaz ili automatski zaključak o prometnom prekršaju.

## Promjena modela

Pull request koji mijenja model mora navesti izvorni URL, verziju, licencu, SHA-256, skup podataka, ulazno-izlazni ugovor, mapu klasa, pragove i rezultate provjere na stvarnom Android uređaju. Nova binarna datoteka ne prihvaća se bez provjerljivog podrijetla i prava redistribucije.
