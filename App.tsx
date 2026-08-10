import * as DocumentPicker from 'expo-document-picker';
import { CameraType, CameraView, type VideoQuality, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import type { AnalysisReport, NoiseSample } from './src/analysis/types';
import type { CaptureLocation } from './src/analysis/sessionAnalysis';
import { useAnalysisQueue } from './src/hooks/useAnalysisQueue';
import { useSessionStore } from './src/hooks/useSessionStore';
import { SessionList } from './src/components/SessionList';
import { AppMenu, SessionPlayer } from './src/components/AppOverlays';
import type { Session } from './src/models/session';
import { persistCameraRecording, persistImportedVideo } from './src/services/recordingService';
import { shareRecording, shareSessionReport } from './src/services/reportService';
import { deleteSessionFiles } from './src/services/sessionStorage';
import { analysisLabel, formatDbfs, formatDuration, formatFrameTime, formatLocation } from './src/utils/formatters';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const brandLogo = require('./assets/jeka-aops-logo-v1.png');

function VehicleAnalysisSheet({ session, onClose, onRequestAnalysis }: { session: Session; onClose: () => void; onRequestAnalysis: (session: Session) => Promise<void> }) {
  const [isPreparing, setIsPreparing] = useState(false);
  const analysis: AnalysisReport | null = session.analysis?.report ?? null;
  const analysisInProgress = isPreparing || session.analysis?.status === 'running';

  async function prepareAnalysis() {
    if (analysisInProgress) return;
    setIsPreparing(true);
    try {
      await onRequestAnalysis(session);
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible transparent>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.analysisSheet}>
          <View style={styles.playerHeader}>
            <View>
              <Text style={styles.playerTitle}>Analiza vozila</Text>
              <Text style={styles.analysisSubtitle}>Lokalna obrada na ureÄ‘aju</Text>
            </View>
            <Pressable accessibilityLabel="Zatvori analizu" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Zatvori</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.analysisScrollContent} showsVerticalScrollIndicator>
            <View style={styles.analysisFlow}>
              <Text style={styles.analysisStep}>1. Odabrana videosesija</Text>
              <Text style={styles.analysisStep}>2. Ekstrakcija kadrova</Text>
              <Text style={styles.analysisStep}>3. Detekcija i praÄ‡enje vozila</Text>
              <Text style={styles.analysisStep}>4. Procjena kretanja</Text>
            </View>

            {analysis ? (
            <View style={styles.modelNotice}>
              <Text style={styles.modelNoticeTitle}>{analysis.status === 'completed' ? 'Lokalna analiza je dovrĹˇena' : 'Lokalna analiza nije dostupna'}</Text>
              <Text style={styles.modelNoticeText}>
                Analiza koristi lokalni model vozila i OCR. Rezultati oznake ostaju kandidati dok se ne potvrde kroz viĹˇe kadrova.
              </Text>
              <Text style={styles.modelNoticeText}>Dokazni kadrovi: {analysis.evidenceFrames.length} Â· tragovi vozila: {analysis.vehicleTracks.length}</Text>
              {analysis.vehicleTracks.map(track => (
                <View key={`${track.id}-evidence`} style={styles.trackEvidence}>
                  {track.evidenceCropUri
                    ? <Image source={{ uri: track.evidenceCropUri }} style={styles.trackEvidenceImage} />
                    : <View style={styles.trackEvidenceUnavailable}><Text style={styles.trackEvidenceUnavailableText}>Izrez nije dostupan</Text></View>}
                  <Text style={styles.trackEvidenceLabel}>Vozilo {track.id} Â· {formatFrameTime(track.evidenceFrameTimeMs)}</Text>
                  <Text style={styles.trackEvidenceMeta}>Detekcije: {track.detections.length} Â· najviĹˇe {Math.round(Math.max(...track.detections.map(detection => detection.confidence), 0) * 100)}%</Text>
                  <View style={styles.trackDiagnostics}>
                    <Text style={styles.trackDiagnosticsTitle}>Razvojna dijagnostika</Text>
                    {track.detections.map((detection, index) => (
                      <Text key={`${track.id}-diagnostic-${detection.frameTimeMs}-${index}`} style={styles.trackDiagnosticsText}>
                        {formatFrameTime(detection.frameTimeMs)} Â· {Math.round(detection.confidence * 100)}% Â· x {detection.boundingBox.x.toFixed(3)} Â· y {detection.boundingBox.y.toFixed(3)} Â· w {detection.boundingBox.width.toFixed(3)} Â· h {detection.boundingBox.height.toFixed(3)}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
              {analysis.vehicleTracks.flatMap(track => track.plateCandidates.filter(candidate => candidate.confirmationCount >= 2).map(candidate => (
                <Text key={`${track.id}-${candidate.normalizedText}`} style={styles.associatedPlateText}>
                  Vozilo {track.id}: {candidate.normalizedText} Â· {candidate.confirmationCount} kadar(a) Â· {candidate.confidenceLevel} Â· {candidate.supportingFrameIds.map(id => analysis.evidenceFrames.find(frame => frame.id === id)).filter(Boolean).map(frame => formatFrameTime(frame?.frameTimeMs)).join(', ')}
                </Text>
              )))}
              {analysis.vehicleTracks.flatMap(track => track.noise ? (
                <Text key={`${track.id}-noise`} style={styles.associatedNoiseText}>
                  Vozilo {track.id}: buka {formatDbfs(track.noise.averageDbfs)} Â· vrh {formatDbfs(track.noise.peakDbfs)} Â· {track.noise.confidenceLevel}
                </Text>
              ) : [])}
              {analysis.unassignedPlateCandidates.length > 0 && (
                <View style={styles.ocrCandidates}>
                  <Text style={styles.ocrCandidatesTitle}>OCR kandidati â€” nisu pridruĹľeni vozilu</Text>
                  {analysis.unassignedPlateCandidates.map(candidate => (
                    <Text key={candidate.normalizedText} style={styles.ocrCandidateText}>
                      {candidate.normalizedText} Â· {candidate.confirmationCount} kadar(a) Â· {candidate.confidenceLevel}
                    </Text>
                  ))}
                </View>
              )}
              {analysis.evidenceFrames.length > 0 && (
                <View style={styles.evidenceRow}>
                  {analysis.evidenceFrames.map((frame, index) => (
                    <View key={frame.id} style={styles.evidenceItem}>
                      <View style={[styles.evidenceVisual, { aspectRatio: (frame.width ?? 16) / (frame.height ?? 9) }]}>
                        {frame.uri && <Image source={{ uri: frame.uri }} style={styles.evidenceImage} />}
                        {analysis.vehicleTracks.flatMap(track => track.detections
                          .filter(detection => detection.frameTimeMs === frame.frameTimeMs)
                          .map((detection, detectionIndex) => (
                            <View key={`${track.id}-${detection.frameTimeMs}-${detectionIndex}`} pointerEvents="none" style={[styles.detectionBox, {
                              left: `${detection.boundingBox.x * 100}%`,
                              top: `${detection.boundingBox.y * 100}%`,
                              width: `${detection.boundingBox.width * 100}%`,
                              height: `${detection.boundingBox.height * 100}%`,
                            }]}>
                              <Text numberOfLines={1} style={styles.detectionLabel}>{track.id.replace('track-', 'VOZILO ')} Â· {Math.round(detection.confidence * 100)}%</Text>
                            </View>
                          )))}
                      </View>
                      <Text style={styles.evidenceLabel}>#{index + 1} Â· {Math.round((frame.overallScore ?? 0) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              )}
              {analysis.limitations.map(limitation => (
                <Text key={limitation} style={styles.reportLimitation}>â€˘ {limitation}</Text>
              ))}
            </View>
            ) : (
            <Text style={styles.analysisHint}>
              Analiza joĹˇ nije pokrenuta. Odaberite lokalnu analizu za izdvajanje kadrova, detekciju vozila i OCR kandidata.
            </Text>
            )}

            <Pressable accessibilityRole="button" disabled={analysisInProgress} onPress={() => void prepareAnalysis()} style={[styles.primaryButton, analysisInProgress && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonText}>{analysisInProgress ? 'Lokalna analiza u tijekuâ€¦' : analysis ? 'Ponovno analiziraj lokalno' : 'Pokreni lokalnu analizu'}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ReportSheet({ session, onClose, onExport }: { session: Session; onClose: () => void; onExport: (session: Session) => void }) {
  const report = session.analysis?.report;
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible transparent>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.reportSheet}>
          <View style={styles.playerHeader}>
            <View>
              <Text style={styles.playerTitle}>IzvjeĹˇÄ‡e sesije</Text>
              <Text style={styles.analysisSubtitle}>{new Date(session.createdAt).toLocaleString('hr-HR')}</Text>
            </View>
            <Pressable accessibilityLabel="Zatvori izvjeĹˇÄ‡e" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Zatvori</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.reportScrollContent} showsVerticalScrollIndicator>
            <View style={styles.reportSummary}>
              <Text style={styles.reportSummaryText}>Trajanje: {formatDuration(session.durationSeconds)}</Text>
              <Text style={styles.reportSummaryText}>Lokacija: {formatLocation(session.location)}</Text>
              <Text style={styles.reportSummaryText}>Buka: prosjek {formatDbfs(session.noiseAverageDbfs)} Â· vrh {formatDbfs(session.noisePeakDbfs)}</Text>
              <Text style={styles.reportSummaryText}>{analysisLabel(session.analysis)}</Text>
            </View>
            {report ? (
              <>
                <Text style={styles.reportHeading}>Vozila i oznake</Text>
                {report.vehicleTracks.length ? report.vehicleTracks.map(track => (
                  <View key={track.id} style={styles.reportTrack}>
                    <Text style={styles.reportTrackTitle}>{track.id} Â· {formatFrameTime(track.evidenceFrameTimeMs)}</Text>
                    {track.evidenceCropUri && <Image source={{ uri: track.evidenceCropUri }} style={styles.reportTrackImage} />}
                    {track.plateCandidates.some(candidate => candidate.confirmationCount >= 2) ? track.plateCandidates.filter(candidate => candidate.confirmationCount >= 2).map(candidate => (
                      <Text key={candidate.normalizedText} style={styles.reportPlateText}>{candidate.normalizedText} Â· {candidate.confirmationCount} kadar(a) Â· {candidate.confidenceLevel}</Text>
                    )) : <Text style={styles.reportMuted}>Nema potvrÄ‘enog kandidata oznake.</Text>}
                  </View>
                )) : <Text style={styles.reportMuted}>U dokaznim kadrovima nisu pronaÄ‘ena vozila.</Text>}
                {report.unassignedPlateCandidates.length > 0 && (
                  <View style={styles.reportSection}>
                    <Text style={styles.reportHeading}>NepridruĹľeni OCR kandidati</Text>
                    {report.unassignedPlateCandidates.map(candidate => <Text key={candidate.normalizedText} style={styles.reportMuted}>{candidate.normalizedText} Â· {candidate.confidenceLevel}</Text>)}
                  </View>
                )}
                <View style={styles.reportSection}>
                  <Text style={styles.reportHeading}>OgraniÄŤenja</Text>
                  {report.limitations.map(item => <Text key={item} style={styles.reportMuted}>â€˘ {item}</Text>)}
                </View>
              </>
            ) : <Text style={styles.reportMuted}>Analiza joĹˇ nije pokrenuta. Otvorite â€žAnalizirajâ€ť za ovu sesiju.</Text>}
            <Pressable accessibilityRole="button" onPress={() => onExport(session)} style={styles.exportReportButton}>
              <Text style={styles.exportReportButtonText}>Izvezi tekstualno izvjeĹˇÄ‡e</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function App() {
  const cameraRef = useRef<CameraView>(null);
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const audioRecorderState = useAudioRecorderState(audioRecorder, 250);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [collectLocation, setCollectLocation] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('720p');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [facing, setFacing] = useState<CameraType>('back');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [analysisSessionId, setAnalysisSessionId] = useState<string | null>(null);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const startedAt = useRef<number | null>(null);
  const noisePeakRef = useRef<number | null>(null);
  const noiseSumRef = useRef(0);
  const noiseSamplesRef = useRef(0);
  const noiseTimelineRef = useRef<NoiseSample[]>([]);
  const { sessions, prepend, remove, updateAnalysis } = useSessionStore();
  const { progress: analysisProgress, run: runSessionAnalysis } = useAnalysisQueue(updateAnalysis);
  const analysisSession = sessions.find(session => session.id === analysisSessionId) ?? null;
  const reportSession = sessions.find(session => session.id === reportSessionId) ?? null;
  const noiseDbfs = isRecording && typeof audioRecorderState.metering === 'number' ? audioRecorderState.metering : null;

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      if (startedAt.current) setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const metering = audioRecorderState.metering;
    if (!isRecording || typeof metering !== 'number') return;
    noisePeakRef.current = noisePeakRef.current === null ? metering : Math.max(noisePeakRef.current, metering);
    noiseSumRef.current += metering;
    noiseSamplesRef.current += 1;
    if (startedAt.current) noiseTimelineRef.current.push({ timeMs: Date.now() - startedAt.current, dbfs: metering });
  }, [audioRecorderState.metering, isRecording]);

  async function importVideoSession() {
    if (isImporting || isRecording) return;
    try {
      setIsImporting(true);
      const selection = await DocumentPicker.getDocumentAsync({ type: ['video/*'], copyToCacheDirectory: true });
      if (selection.canceled || !selection.assets?.[0]) return;
      const asset = selection.assets[0];
      const importedSession = await persistImportedVideo(asset);
      await prepend(importedSession);
      void runSessionAnalysis(importedSession);
    } catch (error) {
      Alert.alert('Uvoz nije uspio', error instanceof Error ? error.message : 'Odaberite podrĹľanu videodatoteku i pokuĹˇajte ponovno.');
    } finally {
      setIsImporting(false);
    }
  }

  async function requestPermissions() {
    await Promise.all([requestCameraPermission(), requestMicrophonePermission()]);
  }

  async function captureLocation(): Promise<CaptureLocation | undefined> {
    if (!collectLocation) return undefined;
    try {
      const permission = locationPermission?.granted ? locationPermission : await requestLocationPermission();
      if (!permission.granted) return undefined;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return {
        // Public-road observations do not need household-level precision.
        latitude: Number(position.coords.latitude.toFixed(3)),
        longitude: Number(position.coords.longitude.toFixed(3)),
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      };
    } catch {
      return undefined;
    }
  }

  async function startRecording() {
    if (!cameraRef.current || !isCameraReady || isRecording || isStopping) return;
    try {
      setIsStopping(false);
      const locationPromise = captureLocation();
      startedAt.current = Date.now();
      setElapsedSeconds(0);
      noisePeakRef.current = null;
      noiseSumRef.current = 0;
      noiseSamplesRef.current = 0;
      noiseTimelineRef.current = [];
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      const result = await cameraRef.current.recordAsync({ maxDuration: 300 });
      if (!result?.uri || !startedAt.current) return;

      if (audioRecorder.isRecording) await audioRecorder.stop();
      const audioUri = audioRecorder.uri;
      const noiseAverageDbfs = noiseSamplesRef.current ? noiseSumRef.current / noiseSamplesRef.current : undefined;
      const location = await locationPromise;
      const newSession = await persistCameraRecording({
        videoUri: result.uri,
        audioUri,
        startedAt: startedAt.current,
        noiseAverageDbfs,
        noisePeakDbfs: noisePeakRef.current ?? undefined,
        noiseSamples: noiseTimelineRef.current,
        location,
      });
      await prepend(newSession);
      void runSessionAnalysis(newSession);
    } catch {
      Alert.alert('Snimanje nije uspjelo', 'Provjerite dozvole kamere i mikrofona pa pokuĹˇajte ponovno.');
    } finally {
      if (audioRecorder.isRecording) await audioRecorder.stop().catch(() => undefined);
      startedAt.current = null;
      setIsRecording(false);
      setIsStopping(false);
      setElapsedSeconds(0);
    }
  }

  function stopRecording() {
    if (!isRecording || isStopping) return;
    // Update the screen immediately; video finalisation can take a moment on
    // some devices after the camera has already accepted the stop request.
    setIsStopping(true);
    setIsRecording(false);
    cameraRef.current?.stopRecording();
  }

  function confirmDelete(session: Session) {
    Alert.alert('Obrisati snimku?', 'Video i unos u dnevniku bit Ä‡e trajno uklonjeni s ureÄ‘aja.', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'ObriĹˇi',
        style: 'destructive',
        onPress: () => void deleteSession(session),
      },
    ]);
  }

  async function deleteSession(session: Session) {
    try {
      await deleteSessionFiles(session);
      await remove(session.id);
      if (previewUri === session.uri) setPreviewUri(null);
    } catch {
      Alert.alert('Brisanje nije uspjelo', 'PokuĹˇajte ponovno.');
    }
  }

  async function shareSession(session: Session) {
    try {
      await shareRecording(session);
    } catch (error) {
      Alert.alert('Izvoz nije uspio', error instanceof Error ? error.message : 'PokuĹˇajte ponovno.');
    }
  }

  async function shareReport(session: Session) {
    try {
      await shareSessionReport(session, analysisProgress[session.id]);
    } catch (error) {
      Alert.alert('Izvoz izvjeĹˇtaja nije uspio', error instanceof Error ? error.message : 'PokuĹˇajte ponovno.');
    }
  }

  const permissionsReady = cameraPermission?.granted && microphonePermission?.granted;

  if (!cameraPermission || !microphonePermission) return <View style={styles.loading} />;

  if (!permissionsReady) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionBrandLockup}>
          <Image source={brandLogo} style={styles.permissionLogo} />
          <Text style={styles.brand}>JEKA AOPS</Text>
        </View>
        <Text style={styles.eyebrow}>LOKALNA VIDEO ANALITIKA</Text>
        <Text style={styles.permissionTitle}>Pristup senzorima</Text>
        <Text style={styles.permissionText}>
          Za snimanje prometne scene potrebni su kamera i mikrofon. Snimke ostaju lokalno na vaĹˇem ureÄ‘aju.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermissions()}>
          <Text style={styles.primaryButtonText}>Dopusti pristup</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {previewUri && <SessionPlayer onClose={() => setPreviewUri(null)} uri={previewUri} />}
      {analysisSession && <VehicleAnalysisSheet onRequestAnalysis={runSessionAnalysis} onClose={() => setAnalysisSessionId(null)} session={analysisSession} />}
      {reportSession && <ReportSheet onClose={() => setReportSessionId(null)} onExport={session => void shareReport(session)} session={reportSession} />}
      {isMenuVisible && <AppMenu collectLocation={collectLocation} onClose={() => setIsMenuVisible(false)} onImport={() => { setIsMenuVisible(false); void importVideoSession(); }} onPermissions={() => { setIsMenuVisible(false); void requestPermissions(); }} onToggleLocation={() => setCollectLocation(current => !current)} onToggleQuality={() => { if (!isRecording && !isStopping) setVideoQuality(current => current === '720p' ? '1080p' : '720p'); }} videoQuality={videoQuality} />}
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <Image accessibilityLabel="JEKA AOPS logo" source={brandLogo} style={styles.headerLogo} />
          <View>
            <Text style={styles.brand}>JEKA AOPS</Text>
            <Text style={styles.subtitle}>v0.2 razvojna - prometna sesija</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isRecording && styles.statusDotRecording]} />
            <Text style={styles.statusText}>{isRecording ? 'SNIMA' : 'SPREMNO'}</Text>
          </View>
          <Pressable accessibilityLabel="Otvori izbornik" accessibilityRole="button" onPress={() => setIsMenuVisible(true)} style={styles.menuButton}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.menuIcon}>
              <View style={styles.menuIconLine} />
              <View style={styles.menuIconLine} />
              <View style={styles.menuIconLine} />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.cameraFrame}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
          mute
          videoQuality={videoQuality}
          onCameraReady={() => setIsCameraReady(true)}
        />
        <View style={styles.cameraOverlay} pointerEvents="none">
          <Text style={styles.overlayText}>VIDEO + MJERENJE BUKE</Text>
          {isRecording && (
            <View style={styles.recordingReadings}>
              <Text style={styles.noiseMeterLabel}>BUKA {formatDbfs(noiseDbfs ?? undefined)}</Text>
              <Text style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.secondaryButton}
          disabled={isRecording}
          onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.secondaryButtonText}>â†» Kamera</Text>
        </Pressable>
        <Pressable
          style={[styles.recordButton, (isRecording || isStopping) && styles.stopButton, isStopping && styles.recordButtonDisabled]}
          disabled={!isCameraReady || isStopping}
          onPress={() => void (isRecording ? stopRecording() : startRecording())}
        >
          <View style={[styles.recordIcon, (isRecording || isStopping) && styles.stopIcon]} />
          <Text style={styles.recordButtonText}>{isStopping ? 'Spremanjeâ€¦' : isRecording ? 'Zaustavi' : 'Snimi'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isImporting || isRecording || isStopping} onPress={() => void importVideoSession()} style={[styles.importButton, (isImporting || isRecording || isStopping) && styles.importButtonDisabled]}>
          <Text style={styles.importButtonText}>{isImporting ? 'Uvozâ€¦' : 'Uvezi MP4'}</Text>
        </Pressable>
      </View>

      <SessionList
        analysisProgress={analysisProgress}
        onAnalyze={session => setAnalysisSessionId(session.id)}
        onDelete={confirmDelete}
        onPlay={session => setPreviewUri(session.uri)}
        onReport={session => setReportSessionId(session.id)}
        onShare={session => void shareSession(session)}
        sessions={sessions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131A' },
  loading: { flex: 1, backgroundColor: '#07131A' },
  permissionScreen: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#07131A' },
  permissionBrandLockup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  permissionLogo: { borderRadius: 14, height: 62, width: 62 },
  eyebrow: { color: '#7BA4AD', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 28 },
  brand: { color: '#57D9C3', fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  permissionTitle: { color: '#F2F7F8', fontSize: 30, fontWeight: '700', marginTop: 20 },
  permissionText: { color: '#AEC1C8', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 28 },
  primaryButton: { alignItems: 'center', backgroundColor: '#57D9C3', borderRadius: 12, padding: 16 },
  primaryButtonText: { color: '#062027', fontSize: 16, fontWeight: '800' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  headerLogo: { borderRadius: 10, height: 40, width: 40 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  subtitle: { color: '#80989F', fontSize: 12, marginTop: 3 },
  statusPill: { alignItems: 'center', backgroundColor: '#10252D', borderRadius: 20, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { backgroundColor: '#57D9C3', borderRadius: 4, height: 8, width: 8 },
  statusDotRecording: { backgroundColor: '#FF5C70' },
  statusText: { color: '#D6E3E6', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  menuButton: { alignItems: 'center', backgroundColor: '#17323B', borderColor: '#31515A', borderRadius: 9, borderWidth: 1, height: 34, justifyContent: 'center', width: 38 },
  menuIcon: { gap: 3.5, width: 17 },
  menuIconLine: { backgroundColor: '#DCE9EB', borderRadius: 2, height: 2, width: '100%' },
  cameraFrame: { backgroundColor: '#0D2027', flex: 1, marginHorizontal: 16, overflow: 'hidden', borderRadius: 18 },
  camera: { flex: 1 },
  cameraOverlay: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', left: 14, position: 'absolute', right: 14, top: 14 },
  recordingReadings: { alignItems: 'flex-end', gap: 4 },
  overlayText: { backgroundColor: '#07131AB8', borderRadius: 6, color: '#D5E7E9', fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 5 },
  timer: { color: '#FFFFFF', fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  noiseMeterLabel: { backgroundColor: '#07131AB8', borderRadius: 6, color: '#B7F7EB', fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '800', letterSpacing: 0.7, paddingHorizontal: 8, paddingVertical: 5 },
  controls: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 16 },
  secondaryButton: { borderColor: '#31515A', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  secondaryButtonText: { color: '#C3D5D9', fontSize: 14, fontWeight: '700' },
  recordButton: { alignItems: 'center', backgroundColor: '#EA3E56', borderRadius: 12, flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  stopButton: { backgroundColor: '#B82E41' },
  recordButtonDisabled: { opacity: 0.7 },
  recordIcon: { backgroundColor: '#FFF', borderRadius: 7, height: 14, width: 14 },
  stopIcon: { borderRadius: 2 },
  recordButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  importButton: { alignItems: 'center', backgroundColor: '#3A3158', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  importButtonDisabled: { opacity: 0.55 },
  importButtonText: { color: '#DED5FF', fontSize: 14, fontWeight: '800' },
  sessionsSection: { flex: 0.5, paddingHorizontal: 20 },
  sectionTitle: { color: '#DCE9EB', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  sessionList: { gap: 8, paddingBottom: 12 },
  emptyText: { color: '#80989F', fontSize: 14, paddingVertical: 10 },
  sessionCard: { alignItems: 'flex-start', backgroundColor: '#10252D', borderRadius: 12, flexDirection: 'row', gap: 10, padding: 13 },
  sessionInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
  sessionTitle: { color: '#DCE9EB', fontSize: 14, fontWeight: '700' },
  sessionDate: { color: '#80989F', fontSize: 12, marginTop: 3 },
  sessionMeta: { color: '#57D9C3', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 5 },
  noiseMeta: { color: '#A9C4CA', fontSize: 10, fontVariant: ['tabular-nums'], marginTop: 4 },
  locationMeta: { color: '#A9C4CA', fontSize: 10, fontVariant: ['tabular-nums'], marginTop: 4 },
  analysisMeta: { color: '#C8D8FF', fontSize: 10, marginTop: 4 },
  sessionActions: { alignItems: 'stretch', flexShrink: 0, gap: 7, width: 92 },
  playButton: { alignItems: 'center', backgroundColor: '#1A4750', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 7 },
  playButtonText: { color: '#9BEBDD', fontSize: 12, fontWeight: '800' },
  analyzeButton: { alignItems: 'center', backgroundColor: '#263E70', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 7 },
  analyzeButtonText: { color: '#C8D8FF', fontSize: 12, fontWeight: '800' },
  shareButton: { alignItems: 'center', backgroundColor: '#1B5D55', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 7 },
  shareButtonText: { color: '#B7F7EB', fontSize: 12, fontWeight: '800' },
  reportButton: { alignItems: 'center', backgroundColor: '#3A3158', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 7 },
  reportButtonText: { color: '#DED5FF', fontSize: 12, fontWeight: '800' },
  deleteButton: { alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  deleteButtonText: { color: '#FF8E9D', fontSize: 12, fontWeight: '700' },
  modalBackdrop: { backgroundColor: '#07131AF2', flex: 1, justifyContent: 'flex-end' },
  playerSheet: { backgroundColor: '#10252D', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  playerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  playerTitle: { color: '#F2F7F8', fontSize: 17, fontWeight: '800' },
  closeButton: { paddingHorizontal: 8, paddingVertical: 6 },
  closeButtonText: { color: '#57D9C3', fontSize: 14, fontWeight: '800' },
  videoPlayer: { alignSelf: 'center', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: 12, maxHeight: 560, width: '100%' },
  analysisSheet: { backgroundColor: '#10252D', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', padding: 20 },
  analysisScrollContent: { paddingBottom: 8 },
  analysisSubtitle: { color: '#80989F', fontSize: 12, marginTop: 2 },
  analysisFlow: { gap: 9, marginVertical: 16 },
  analysisStep: { backgroundColor: '#17323B', borderRadius: 9, color: '#DCE9EB', fontSize: 14, padding: 12 },
  analysisHint: { color: '#AEC1C8', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  primaryButtonDisabled: { opacity: 0.6 },
  modelNotice: { backgroundColor: '#213B4D', borderRadius: 10, marginBottom: 18, padding: 14 },
  modelNoticeTitle: { color: '#D5E8FF', fontSize: 15, fontWeight: '800' },
  modelNoticeText: { color: '#C2D5E8', fontSize: 14, lineHeight: 20, marginTop: 6 },
  associatedPlateText: { color: '#B7F7EB', fontSize: 12, lineHeight: 18, marginTop: 7 },
  trackEvidence: { marginTop: 10 },
  trackEvidenceImage: { width: 176, height: 96, borderRadius: 7, backgroundColor: '#061118', resizeMode: 'contain' },
  trackEvidenceUnavailable: { alignItems: 'center', backgroundColor: '#172E39', borderRadius: 7, height: 72, justifyContent: 'center', width: 176 },
  trackEvidenceUnavailableText: { color: '#80989F', fontSize: 11 },
  trackEvidenceLabel: { color: '#A9C4CA', fontSize: 11, marginTop: 4 },
  trackEvidenceMeta: { color: '#B7F7EB', fontSize: 11, marginTop: 3 },
  trackDiagnostics: { backgroundColor: '#172E39', borderRadius: 7, marginTop: 7, padding: 8 },
  trackDiagnosticsTitle: { color: '#E5C882', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  trackDiagnosticsText: { color: '#B9CDD2', fontFamily: 'monospace', fontSize: 9, lineHeight: 14 },
  associatedNoiseText: { color: '#B6D5FF', fontSize: 12, lineHeight: 18, marginTop: 5 },
  ocrCandidates: { backgroundColor: '#172E39', borderRadius: 7, marginTop: 10, padding: 8 },
  ocrCandidatesTitle: { color: '#E5C882', fontSize: 11, fontWeight: '800' },
  ocrCandidateText: { color: '#E9E1C9', fontSize: 12, marginTop: 5 },
  evidenceRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  evidenceItem: { flex: 1, minWidth: 0 },
  evidenceVisual: { backgroundColor: '#07131A', borderRadius: 6, overflow: 'hidden', position: 'relative', width: '100%' },
  evidenceImage: { height: '100%', resizeMode: 'cover', width: '100%' },
  detectionBox: { borderColor: '#57D9C3', borderRadius: 2, borderWidth: 1.5, position: 'absolute' },
  detectionLabel: { alignSelf: 'flex-start', backgroundColor: '#0B423B', color: '#E7FFFA', fontSize: 7, fontWeight: '800', maxWidth: 76, paddingHorizontal: 3, paddingVertical: 1 },
  evidenceLabel: { color: '#C2D5E8', fontSize: 10, marginTop: 4, textAlign: 'center' },
  reportLimitation: { color: '#C2D5E8', fontSize: 12, lineHeight: 18, marginTop: 6 },
  reportSheet: { backgroundColor: '#10252D', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', padding: 20 },
  reportScrollContent: { paddingBottom: 8 },
  reportSummary: { backgroundColor: '#17323B', borderRadius: 10, gap: 5, padding: 12 },
  reportSummaryText: { color: '#DCE9EB', fontSize: 12, lineHeight: 18 },
  reportHeading: { color: '#F2F7F8', fontSize: 15, fontWeight: '800', marginBottom: 7, marginTop: 18 },
  reportTrack: { backgroundColor: '#213B4D', borderRadius: 10, marginTop: 8, padding: 11 },
  reportTrackTitle: { color: '#B7F7EB', fontSize: 13, fontWeight: '800' },
  reportTrackImage: { alignSelf: 'flex-start', backgroundColor: '#061118', borderRadius: 7, height: 110, marginTop: 8, resizeMode: 'contain', width: 200 },
  reportPlateText: { color: '#E9F8E7', fontSize: 12, lineHeight: 18, marginTop: 7 },
  reportMuted: { color: '#B5C7CB', fontSize: 12, lineHeight: 18, marginTop: 5 },
  reportSection: { marginTop: 2 },
  exportReportButton: { alignItems: 'center', backgroundColor: '#3A3158', borderRadius: 10, marginTop: 22, padding: 13 },
  exportReportButtonText: { color: '#DED5FF', fontSize: 14, fontWeight: '800' },
  menuBackdrop: { backgroundColor: '#07131A99', flex: 1, justifyContent: 'flex-start', paddingTop: 72, paddingRight: 14 },
  menuSheet: { alignSelf: 'flex-end', backgroundColor: '#17323B', borderColor: '#31515A', borderRadius: 12, borderWidth: 1, elevation: 8, padding: 10, width: 260 },
  menuTitle: { color: '#F2F7F8', fontSize: 16, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 6 },
  menuAction: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 10 },
  menuActionText: { color: '#DCE9EB', fontSize: 14, fontWeight: '800' },
  menuActionHint: { color: '#9EB7BD', fontSize: 11, marginTop: 3 },
  menuInfo: { borderTopColor: '#31515A', borderTopWidth: 1, marginTop: 4, paddingHorizontal: 8, paddingTop: 10 },
  menuInfoText: { color: '#B7F7EB', fontSize: 11, lineHeight: 16 },
});
