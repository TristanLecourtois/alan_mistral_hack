import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useNav, SCREENS } from '../navigation'
import { DEMO_BIOMETRICS } from '../services/thryveService'
import { colors, font, shadow } from '../theme'

const METRIC_CARDS = [
  { key: 'sleep', icon: '💤', label: 'Sleep' },
  { key: 'hrv', icon: '❤️', label: 'HRV' },
  { key: 'steps', icon: '🏃', label: 'Activity' },
  { key: 'basalTemp', icon: '🌡️', label: 'Basal temp.' },
]

function trendColor(status) {
  if (status === 'ok') return colors.green
  if (status === 'warn') return colors.orangeWarn
  return colors.mid
}

function trendBg(status) {
  if (status === 'ok') return 'rgba(0,201,153,0.15)'
  if (status === 'warn') return 'rgba(245,158,11,0.2)'
  return 'rgba(0,0,0,0.06)'
}

export default function HealthScreen() {
  const { goBack } = useNav()
  const insets = useSafeAreaInsets()
  const biometrics = DEMO_BIOMETRICS
  const [devices, setDevices] = useState(biometrics.devices)

  function connectDevice(deviceId) {
    // Phase 2: Replace with Thryve OAuth flow
    Alert.alert(
      'Connect device',
      'In the full version, this will open the Thryve OAuth flow to securely connect your wearable.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demo: Connect',
          onPress: () => setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, connected: true } : d)),
        },
      ]
    )
  }

  function disconnectDevice(deviceId) {
    Alert.alert('Disconnect', 'Disconnect this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)) },
    ])
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.tag}>CONNECTED HEALTH</Text>
        <Text style={styles.title}>My health profile</Text>
        <Text style={styles.sub}>Real-time biometrics · Powered by Thryve</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>

        {/* Devices */}
        <Text style={styles.sectionLabel}>CONNECTED DEVICES</Text>
        <View style={styles.devicesRow}>
          {devices.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.devicePill, d.connected && styles.deviceConnected]}
              onPress={() => d.connected ? disconnectDevice(d.id) : connectDevice(d.id)}
            >
              <Text style={styles.dIcon}>{d.icon}</Text>
              <View>
                <Text style={styles.dName}>{d.name}</Text>
                <Text style={[styles.dStatus, { color: d.connected ? colors.teal : colors.mid }]}>
                  {d.connected ? 'Connected' : 'Tap to connect'}
                </Text>
              </View>
              {d.connected && <View style={styles.connDot} />}
            </TouchableOpacity>
          ))}
          <View style={[styles.devicePill, { borderStyle: 'dashed' }]}>
            <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.3)' }}>＋</Text>
            <Text style={{ fontSize: 10, color: colors.mid }}>Add</Text>
          </View>
        </View>

        {/* Thryve banner */}
        <View style={[styles.thryveBanner, shadow.sm]}>
          <Text style={styles.thryveIcon}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.thryveTitle}>Powered by Thryve</Text>
            <Text style={styles.thryveSub}>Secure health data aggregation · Apple Health, Oura, Fitbit, Garmin and more</Text>
          </View>
        </View>

        {/* Biometrics grid */}
        <Text style={[styles.sectionLabel, { marginTop: 6 }]}>TODAY'S BIOMETRICS</Text>
        <View style={styles.bioGrid}>
          {METRIC_CARDS.map((card) => {
            const metric = biometrics.metrics[card.key]
            return (
              <View key={card.key} style={[styles.bioCard, metric?.trendStatus === 'warn' && styles.bioCardHighlight, shadow.sm]}>
                <Text style={styles.bcIcon}>{card.icon}</Text>
                <Text style={styles.bcVal}>{metric?.value || '—'}</Text>
                <Text style={styles.bcUnit}>{metric?.unit || ''}</Text>
                <Text style={styles.bcLabel}>{card.label}</Text>
                {metric?.trend && (
                  <View style={[styles.bcTrend, { backgroundColor: trendBg(metric.trendStatus) }]}>
                    <Text style={[styles.bcTrendText, { color: trendColor(metric.trendStatus) }]}>{metric.trend}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* Personalized insights */}
        <Text style={styles.recoTitle}>🤖 PERSONALIZED INSIGHTS</Text>
        {biometrics.insights.map((r, i) => (
          <View key={i} style={[styles.recoCard, { backgroundColor: r.severity === 'warn' ? 'rgba(244,96,124,0.06)' : 'rgba(0,201,153,0.08)', borderColor: r.severity === 'warn' ? 'rgba(244,96,124,0.2)' : 'rgba(0,201,153,0.15)' }]}>
            <Text style={styles.recoIcon}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoName}>{r.title}</Text>
              <Text style={styles.recoDesc}>{r.desc}</Text>
              {r.source && <Text style={styles.recoSource}>{r.source}</Text>}
            </View>
          </View>
        ))}

        {/* Share with doctor */}
        <TouchableOpacity style={{ borderRadius: 16, overflow: 'hidden', marginTop: 4 }}>
          <LinearGradient colors={[colors.teal, '#00A87F']} style={styles.shareBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={{ fontSize: 24 }}>👨‍⚕️</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.shareTitle}>Share with my doctor</Text>
              <Text style={styles.shareSub}>Full biometric report · Last 30 days · AI-generated</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightgray },
  header: { paddingHorizontal: 18, paddingBottom: 10 },
  back: { fontSize: 13, color: colors.mid, marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 2, color: colors.teal, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: font.black, color: colors.dark },
  sub: { fontSize: 11, color: colors.mid, marginTop: 3 },
  body: { flex: 1, paddingHorizontal: 14 },
  sectionLabel: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.mid, marginBottom: 10 },
  devicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  devicePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  deviceConnected: { borderColor: 'rgba(0,201,153,0.5)', backgroundColor: 'rgba(0,201,153,0.1)' },
  dIcon: { fontSize: 16 },
  dName: { fontSize: 11, fontWeight: font.bold, color: colors.dark },
  dStatus: { fontSize: 9 },
  connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal, marginLeft: 2 },
  thryveBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(64,86,244,0.15)' },
  thryveIcon: { fontSize: 20 },
  thryveTitle: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  thryveSub: { fontSize: 10, color: colors.mid, lineHeight: 15 },
  bioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  bioCard: { width: '47.5%', backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)' },
  bioCardHighlight: { borderColor: 'rgba(64,86,244,0.4)', backgroundColor: 'rgba(232,115,74,0.07)' },
  bcIcon: { fontSize: 18, marginBottom: 6 },
  bcVal: { fontSize: 22, fontWeight: font.black, color: colors.dark, lineHeight: 24 },
  bcUnit: { fontSize: 10, color: colors.mid, marginTop: 1 },
  bcLabel: { fontSize: 10, color: colors.mid, marginTop: 5 },
  bcTrend: { position: 'absolute', top: 10, right: 10, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  bcTrendText: { fontSize: 9, fontWeight: font.bold },
  recoTitle: { fontSize: 10, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 1.5, color: colors.blue, marginBottom: 10 },
  recoCard: { borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', gap: 10, borderWidth: 1 },
  recoIcon: { fontSize: 20, marginTop: 1 },
  recoName: { fontSize: 12, fontWeight: font.bold, color: colors.dark, marginBottom: 3 },
  recoDesc: { fontSize: 11, color: colors.mid, lineHeight: 16 },
  recoSource: { fontSize: 9, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  shareBanner: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  shareTitle: { fontSize: 13, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  shareSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 16 },
})
