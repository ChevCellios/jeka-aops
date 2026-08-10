import type { VideoQuality } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SessionPlayer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer({ uri }, instance => { instance.loop = false; });
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible transparent>
      <View style={styles.modalBackdrop}><SafeAreaView style={styles.playerSheet}>
        <View style={styles.header}><Text style={styles.title}>Pregled snimke</Text><CloseButton onClose={onClose} /></View>
        <VideoView fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} contentFit="contain" nativeControls player={player} style={styles.video} />
      </SafeAreaView></View>
    </Modal>
  );
}

export function AppMenu({ collectLocation, onClose, onImport, onPermissions, onToggleLocation, onToggleQuality, videoQuality }: {
  collectLocation: boolean; onClose: () => void; onImport: () => void; onPermissions: () => void; onToggleLocation: () => void; onToggleQuality: () => void; videoQuality: VideoQuality;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <Pressable accessibilityLabel="Zatvori izbornik" onPress={onClose} style={styles.menuBackdrop}>
        <Pressable accessibilityLabel="Izbornik aplikacije" onPress={() => undefined} style={styles.menuSheet}>
          <Text style={styles.menuTitle}>Izbornik</Text>
          <MenuAction hint="MP4, MOV ili drugi video" label="Uvezi snimku" onPress={onImport} />
          <MenuAction hint="Kamera i mikrofon" label="Provjeri dozvole" onPress={onPermissions} />
          <MenuAction hint={collectLocation ? 'Sprema približnu lokaciju (oko 100 m)' : 'Lokacija se ne prikuplja'} label={`Lokacija: ${collectLocation ? 'uključena' : 'isključena'}`} onPress={onToggleLocation} />
          <MenuAction hint={`Dodirnite za ${videoQuality === '720p' ? '1080p' : '720p'}`} label={`Kvaliteta snimanja: ${videoQuality}`} onPress={onToggleQuality} />
          <View style={styles.menuInfo}><Text style={styles.menuInfoText}>Snimke i analiza ostaju lokalno na uređaju.</Text></View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return <Pressable accessibilityLabel="Zatvori pregled" onPress={onClose} style={styles.close}><Text style={styles.closeText}>Zatvori</Text></Pressable>;
}

function MenuAction({ hint, label, onPress }: { hint: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuAction}><Text style={styles.menuActionText}>{label}</Text><Text style={styles.menuActionHint}>{hint}</Text></Pressable>;
}

const styles = StyleSheet.create({
  modalBackdrop: { backgroundColor: '#07131AF2', flex: 1, justifyContent: 'flex-end' }, playerSheet: { backgroundColor: '#10252D', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, title: { color: '#F2F7F8', fontSize: 17, fontWeight: '800' },
  close: { paddingHorizontal: 8, paddingVertical: 6 }, closeText: { color: '#57D9C3', fontSize: 14, fontWeight: '800' }, video: { alignSelf: 'center', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: 12, maxHeight: 560, width: '100%' },
  menuBackdrop: { backgroundColor: '#07131A99', flex: 1, justifyContent: 'flex-start', paddingRight: 14, paddingTop: 72 }, menuSheet: { alignSelf: 'flex-end', backgroundColor: '#17323B', borderColor: '#31515A', borderRadius: 12, borderWidth: 1, elevation: 8, padding: 10, width: 260 },
  menuTitle: { color: '#F2F7F8', fontSize: 16, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 6 }, menuAction: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 10 }, menuActionText: { color: '#DCE9EB', fontSize: 14, fontWeight: '800' }, menuActionHint: { color: '#9EB7BD', fontSize: 11, marginTop: 3 },
  menuInfo: { borderTopColor: '#31515A', borderTopWidth: 1, marginTop: 4, paddingHorizontal: 8, paddingTop: 10 }, menuInfoText: { color: '#B7F7EB', fontSize: 11, lineHeight: 16 },
});
