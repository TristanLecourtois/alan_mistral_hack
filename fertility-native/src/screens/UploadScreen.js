import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav, SCREENS } from '../navigation'
import { colors, font, shadow } from '../theme'

const docs = [
  { icon: '📊', bg: '#FDE3D4', name: 'SpermAnalysis_March2025.pdf', meta: 'Added March 15 · 245 KB' },
  { icon: '🔬', bg: '#D4EDF9', name: 'Bilan_hormonal_Fev2025.pdf', meta: 'Added Feb 3 · 189 KB' },
  { icon: '🩺', bg: '#E8F5E8', name: 'Echo_pelvienne_Jan2025.pdf', meta: 'Added Jan 20 · 892 KB' },
]

export default function UploadScreen() {
  const { navigate, goBack } = useNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Text style={styles.title}>My documents</Text>
        <Text style={styles.sub}>Import your medical reports. I'll analyze and translate them into plain language.</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.uploadZone} onPress={() => navigate(SCREENS.ANALYSE)}>
          <Text style={styles.uploadIcon}>📄</Text>
          <Text style={styles.uploadTitle}>Import a document</Text>
          <Text style={styles.uploadText}>Sperm analysis, hormonal panel,{'\n'}ultrasound, follicle count…</Text>
          <View style={styles.typeTags}>
            {['PDF', 'JPG', 'PNG', 'DOCX'].map(t => (
              <View key={t} style={styles.typeTag}><Text style={styles.typeTagText}>{t}</Text></View>
            ))}
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>RECENT DOCUMENTS</Text>

        {docs.map((doc, i) => (
          <TouchableOpacity key={i} style={[styles.docItem, shadow.sm]} onPress={() => navigate(SCREENS.ANALYSE)}>
            <View style={[styles.docIcon, { backgroundColor: doc.bg }]}>
              <Text style={{ fontSize: 18 }}>{doc.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>{doc.name}</Text>
              <Text style={styles.docMeta}>{doc.meta}</Text>
            </View>
            <Text style={styles.docArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.docItem, { borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.25)' }, shadow.sm]}>
          <View style={[styles.docIcon, { backgroundColor: 'rgba(0,201,153,0.1)' }]}>
            <Text style={{ fontSize: 18 }}>➕</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.docName, { color: colors.teal }]}>Add from my gallery</Text>
            <Text style={styles.docMeta}>Photos, scans…</Text>
          </View>
          <Text style={[styles.docArrow, { color: colors.teal }]}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  top: { paddingHorizontal: 20, paddingVertical: 12 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: font.black, color: colors.navy, marginBottom: 4 },
  sub: { fontSize: 12, color: colors.mid, lineHeight: 18 },
  body: { flex: 1, paddingHorizontal: 16 },
  uploadZone: { borderWidth: 2, borderColor: 'rgba(64,86,244,0.3)', borderStyle: 'dashed', borderRadius: 20, padding: 28, alignItems: 'center', backgroundColor: colors.white, marginBottom: 16, marginTop: 4 },
  uploadIcon: { fontSize: 36, marginBottom: 10 },
  uploadTitle: { fontSize: 14, fontWeight: font.bold, color: colors.navy, marginBottom: 6 },
  uploadText: { fontSize: 11, color: colors.mid, textAlign: 'center', lineHeight: 17 },
  typeTags: { flexDirection: 'row', gap: 6, marginTop: 12 },
  typeTag: { backgroundColor: colors.lightgray, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typeTagText: { fontSize: 10, fontWeight: font.semibold, color: colors.mid },
  sectionLabel: { fontSize: 11, fontWeight: font.bold, color: colors.mid, letterSpacing: 1, marginBottom: 10 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  docIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 13, fontWeight: font.semibold, color: colors.dark },
  docMeta: { fontSize: 10, color: colors.mid, marginTop: 2 },
  docArrow: { fontSize: 18, color: colors.mid },
})
