import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { colors, font, shadow } from '../theme'

export default function UploadScreen() {
  const { navigate } = useNav()
  const { setUploadedDocument } = useApp()
  const insets = useSafeAreaInsets()
  const [picking, setPicking] = useState(false)

  async function pickDocument() {
    if (picking) return
    setPicking(true)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0]
        setUploadedDocument({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType })
        navigate(SCREENS.ANALYSE)
      }
    } finally {
      setPicking(false)
    }
  }

  function useDemoFile() {
    setUploadedDocument({ uri: null, name: 'SpermAnalysis_Demo.pdf', isDemoFile: true })
    navigate(SCREENS.ANALYSE)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <View style={styles.header}>
        <Text style={styles.title}>Upload your results</Text>
        <Text style={styles.sub}>We'll analyze your medical results in seconds.</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity style={[styles.dropZone, picking && styles.dropZoneActive, shadow.md]} onPress={pickDocument} disabled={picking}>
          <Text style={styles.dropIcon}>{picking ? '⏳' : '📄'}</Text>
          <Text style={styles.dropTitle}>{picking ? 'Opening…' : 'Upload spermogram'}</Text>
          <Text style={styles.dropSub}>or any fertility report</Text>
          <View style={styles.formatRow}>
            {['PDF', 'JPG', 'PNG'].map(f => (
              <View key={f} style={styles.formatTag}><Text style={styles.formatText}>{f}</Text></View>
            ))}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.demoBtn} onPress={useDemoFile}>
          <Text style={styles.demoBtnText}>Use a demo file instead →</Text>
        </TouchableOpacity>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.mid, lineHeight: 21 },
  body: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 20 },
  dropZone: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(64,86,244,0.25)',
    borderStyle: 'dashed',
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  dropZoneActive: { borderColor: colors.teal, backgroundColor: 'rgba(0,201,153,0.04)' },
  dropIcon: { fontSize: 48, marginBottom: 8 },
  dropTitle: { fontSize: 17, fontWeight: font.bold, color: colors.navy },
  dropSub: { fontSize: 13, color: colors.mid },
  formatRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  formatTag: { backgroundColor: colors.lightgray, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  formatText: { fontSize: 11, fontWeight: font.semibold, color: colors.mid },
  demoBtn: { alignItems: 'center', paddingVertical: 12 },
  demoBtnText: { fontSize: 14, color: colors.blue, fontWeight: font.semibold },
})
