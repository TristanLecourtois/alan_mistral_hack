import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Animated, ActivityIndicator, Alert, StyleSheet,
  KeyboardAvoidingView, Platform, Dimensions, Linking, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useNav, SCREENS } from '../navigation'
import { useApp } from '../context/AppContext'
import { generateAppointmentQuestions } from '../services/mistralService'
import { colors, font, shadow } from '../theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const APPT_OPTIONS = ['This week', 'In 2 weeks', 'In 1 month', 'Not scheduled yet']

// ─── Helpers ─────────────────────────────────────────────────
function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// French + English keywords for client-side filtering
function getSpecialties(documentType) {
  const t = (documentType || '').toLowerCase()
  if (t.includes('sperm') || t.includes('semen') || t.includes('spermogram'))
    return [
      { label: 'Andrologist',       slug: 'andrologue',               icon: '🔬',
        keywords: ['androlog','urol','fertilit','reproduct','sperm','sperme','spermatolog','masculin'] },
      { label: 'Urologist',         slug: 'urologue',                 icon: '🏥',
        keywords: ['urol','prostat','rein','rénal','bladder','uriner','urinar'] },
      { label: 'Gynaecologist',     slug: 'gynecologue-obstetricien', icon: '👩‍⚕️',
        keywords: ['gynec','gynéc','matern','obstet','fertilit','femme','women','pma','ivf','procréat'] },
    ]
  return [
    { label: 'Gynaecologist',       slug: 'gynecologue-obstetricien', icon: '👩‍⚕️',
      keywords: ['gynec','gynéc','matern','obstet','fertilit','femme','women','pma','ivf','procréat'] },
    { label: 'Fertility specialist', slug: 'gynecologue-medical',      icon: '🌱',
      keywords: ['fertilit','reproduct','pma','ivf','fécond','procréat','assisted','cecos'] },
    { label: 'Endocrinologist',     slug: 'endocrinologue',           icon: '🧬',
      keywords: ['endocrin','hormon','thyro','diabet','métabol','metabol'] },
  ]
}

// Single broad Overpass query — filter client-side by keywords (more reliable)
async function fetchHealthcareFacilities(lat, lon, radiusM = 20000) {
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"~"^(clinic|hospital|doctors)$"](around:${radiusM},${lat},${lon});
      way["amenity"~"^(clinic|hospital)$"](around:${radiusM},${lat},${lon});
      node["healthcare"~"."](around:${radiusM},${lat},${lon});
      way["healthcare"~"."](around:${radiusM},${lat},${lon});
    );
    out center 80;
  `
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const data = await res.json()
  const seen = new Set()
  return (data.elements || [])
    .map(el => {
      const elLat = el.lat ?? el.center?.lat
      const elLon = el.lon ?? el.center?.lon
      const name = el.tags?.name || el.tags?.['name:fr'] || ''
      if (!name || seen.has(el.id)) return null
      seen.add(el.id)
      return {
        id: el.id,
        name,
        address: [
          el.tags?.['addr:housenumber'],
          el.tags?.['addr:street'],
          el.tags?.['addr:postcode'],
          el.tags?.['addr:city'],
        ].filter(Boolean).join(' ') || null,
        type: el.tags?.amenity || el.tags?.healthcare || '',
        nameLower: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        lat: elLat, lon: elLon,
        distKm: elLat && elLon ? haversineKm(lat, lon, elLat, elLon) : 99,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.distKm - b.distKm)
}

function filterBySpecialty(facilities, keywords) {
  const normalizeKw = kw => kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const normKw = keywords.map(normalizeKw)
  const matching = facilities.filter(f => normKw.some(k => f.nameLower.includes(k)))
  // If no specialty match, fall back to all facilities (so list is never empty)
  return matching.length > 0 ? matching.slice(0, 12) : facilities.slice(0, 12)
}

// ─── Specialist sheet ─────────────────────────────────────────
function SpecialistSheet({ visible, onClose, documentType }) {
  const insets = useSafeAreaInsets()
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const bgOp   = useRef(new Animated.Value(0)).current

  const [phase, setPhase]           = useState('idle')
  const [location, setLocation]     = useState(null)
  const [activeSpec, setActiveSpec] = useState(0)
  const [allFacilities, setAllFacilities] = useState([])  // raw broad results
  const specialties = getSpecialties(documentType)

  // Reset and re-geolocate every time sheet opens
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(bgOp,   { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
      setPhase('idle')
      setLocation(null)
      setAllFacilities([])
      setActiveSpec(0)
      startSearch()
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
        Animated.timing(bgOp,   { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  async function startSearch() {
    setPhase('locating')
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setPhase('error'); return }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude: lat, longitude: lon } = pos.coords

      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
      const street = [geo?.streetNumber, geo?.street].filter(Boolean).join(' ')
      const city   = geo?.city || geo?.subregion || geo?.region || ''
      const label  = [street, city].filter(Boolean).join(', ')
      setLocation({ label, city, lat, lon })
      setPhase('searching')

      // Broad fetch once — filter per tab client-side
      const facilities = await fetchHealthcareFacilities(lat, lon, 20000)
      setAllFacilities(facilities)
      setPhase('results')
    } catch {
      setPhase('error')
    }
  }

  // Filtered results for active tab — instant, no extra network call
  const currentResults = allFacilities.length > 0
    ? filterBySpecialty(allFacilities, specialties[activeSpec].keywords)
    : []

  function openDoctolib(specialtySlug, city) {
    const citySlug = slugify(city)
    const url = citySlug
      ? `https://www.doctolib.fr/${specialtySlug}/${citySlug}`
      : `https://www.doctolib.fr/${specialtySlug}`
    Linking.openURL(url)
  }

  function openMaps(name, address) {
    const q = encodeURIComponent(`${name} ${address}`)
    Linking.openURL(Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${q}`
      : `https://maps.google.com/?q=${q}`)
  }

  const showDoctolib = phase !== 'idle' && phase !== 'locating' && phase !== 'error'

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sp.backdrop, { opacity: bgOp }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[sp.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 16 }]}>
        <View style={sp.handle} />

        <View style={sp.headerRow}>
          <Text style={sp.title}>Specialists near you</Text>
          <TouchableOpacity onPress={onClose} style={sp.closeBtn}>
            <Text style={sp.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        {location?.label ? (
          <View style={sp.locationChip}>
            <Text style={sp.locationText}>📍 {location.label}</Text>
          </View>
        ) : null}

        {/* Specialty tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sp.tabsScroll} contentContainerStyle={sp.tabs}>
          {specialties.map((spec, i) => (
            <TouchableOpacity key={i} style={[sp.tab, activeSpec === i && sp.tabActive]} onPress={() => setActiveSpec(i)}>
              <Text style={[sp.tabText, activeSpec === i && sp.tabTextActive]}>{spec.icon} {spec.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView style={sp.scroll} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>

          {/* Doctolib CTA — changes with active tab */}
          {showDoctolib && (
            <TouchableOpacity
              style={sp.doctolibBtn}
              onPress={() => openDoctolib(specialties[activeSpec].slug, location?.city || '')}
            >
              <View style={{ flex: 1 }}>
                <Text style={sp.doctolibTitle}>Book on Doctolib</Text>
                <Text style={sp.doctolibSub}>{specialties[activeSpec].label}{location?.label ? ` · ${location.city}` : ''}</Text>
              </View>
              <Text style={sp.doctolibArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* Loading states */}
          {phase === 'locating' && (
            <View style={sp.loadingCard}>
              <ActivityIndicator color={colors.blue} />
              <Text style={sp.loadingText}>Getting your location…</Text>
            </View>
          )}
          {phase === 'searching' && (
            <View style={sp.loadingCard}>
              <ActivityIndicator color={colors.blue} />
              <Text style={sp.loadingText}>Searching healthcare facilities nearby…</Text>
            </View>
          )}
          {phase === 'error' && (
            <View style={sp.errorCard}>
              <Text style={sp.errorText}>Unable to access your location.</Text>
              <TouchableOpacity style={sp.retryBtn} onPress={startSearch}>
                <Text style={sp.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results */}
          {phase === 'results' && currentResults.map((r, i) => (
            <View key={r.id || i} style={sp.resultCard}>
              <View style={sp.resultLeft}>
                <Text style={sp.resultName}>{r.name}</Text>
                {r.address && <Text style={sp.resultAddr}>{r.address}</Text>}
                <View style={sp.resultTagRow}>
                  {r.type ? <View style={sp.resultTag}><Text style={sp.resultTagText}>{r.type}</Text></View> : null}
                  {r.distKm < 90 && <View style={sp.resultDist}><Text style={sp.resultDistText}>{r.distKm < 1 ? `${Math.round(r.distKm * 1000)}m` : `${r.distKm.toFixed(1)} km`}</Text></View>}
                </View>
              </View>
              <TouchableOpacity style={sp.mapsBtn} onPress={() => openMaps(r.name, r.address)}>
                <Text style={sp.mapsBtnText}>🗺</Text>
              </TouchableOpacity>
            </View>
          ))}

        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

// ─── Typing dots animation ───────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(3 * 160),
        ])
      )
    )
    Animated.parallel(anims).start()
    return () => anims.forEach(a => a.stop())
  }, [])
  return (
    <View style={ty.row}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[ty.dot, { opacity: d, transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }] }]} />
      ))}
    </View>
  )
}

// ─── Question item ───────────────────────────────────────────
function QuestionItem({ q, i, onToggle, entryAnim, onDiscuss }) {
  return (
    <Animated.View style={{ opacity: entryAnim, transform: [{ translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <TouchableOpacity style={[s.qItem, q.checked && s.qItemOn]} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.qCheck, q.checked && s.qCheckOn]}>
          {q.checked && <Text style={{ color: colors.white, fontSize: 11, fontWeight: font.bold }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.qText}>{q.text}</Text>
          {q.badge && (
            <View style={s.qBadge}><Text style={s.qBadgeText}>{q.badge}</Text></View>
          )}
        </View>
        <TouchableOpacity
          style={s.qDiscussBtn}
          onPress={(e) => { e.stopPropagation?.(); onDiscuss(q.text) }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={s.qDiscussBtnText}>💬</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Main screen ─────────────────────────────────────────────
export default function PrepareScreen() {
  const { navigate } = useNav()
  const { analysisResult, onboardingAnswers, appointmentDate, setAppointmentDate, generatedQuestions, setGeneratedQuestions, setPendingCopilotMessage, createConversation } = useApp()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef(null)

  const [phase, setPhase] = useState('appointment') // appointment | generating | questions
  const [questions, setQuestions] = useState([])
  const [questionAnims, setQuestionAnims] = useState([])
  const [newQ, setNewQ] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showSpecialist, setShowSpecialist] = useState(false)

  // If questions already generated (came back to this tab), show them
  useEffect(() => {
    if (generatedQuestions) {
      const flat = [...(generatedQuestions.priority || []), ...(generatedQuestions.general || [])]
      setQuestions(flat)
      setPhase('questions')
    }
  }, [])

  // Animation for each question appearing
  function animateQuestionsIn(flat) {
    const anims = flat.map(() => new Animated.Value(0))
    setQuestionAnims(anims)
    setQuestions(flat)
    setPhase('questions')
    flat.forEach((_, i) => {
      setTimeout(() => {
        Animated.spring(anims[i], { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start()
      }, i * 120)
    })
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 200)
  }

  async function handleGenerate() {
    setPhase('generating')
    try {
      const result = await generateAppointmentQuestions(analysisResult, onboardingAnswers)
      setGeneratedQuestions(result)
      const flat = [...(result.priority || []), ...(result.general || [])]
      animateQuestionsIn(flat)
    } catch {
      Alert.alert('Generation failed', 'Please try again.')
      setPhase('appointment')
    }
  }

  function toggle(i) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, checked: !q.checked } : q))
  }

function addQuestion() {
    if (!newQ.trim()) return
    const newAnim = new Animated.Value(0)
    setQuestionAnims(prev => [...prev, newAnim])
    setQuestions(prev => [...prev, { text: newQ.trim(), checked: true }])
    Animated.spring(newAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start()
    setNewQ('')
  }

  async function handleExport() {
    const checked = questions.filter(q => q.checked)
    if (!checked.length) {
      Alert.alert('No questions selected', 'Select at least one question to export.')
      return
    }
    setExporting(true)
    try {
      const html = buildPDFHtml({ analysisResult, questions, appointmentDate })
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share appointment prep' })
    } catch {
      Alert.alert('Export failed', 'Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const checkedCount = questions.filter(q => q.checked).length

  function discussQuestion(text) {
    setPendingCopilotMessage(`I'd like to understand this question better: "${text}"`)
    navigate(SCREENS.COPILOT)
  }

  function openNewCopilotChat() {
    setPendingCopilotMessage(null)
    createConversation()
    navigate(SCREENS.COPILOT)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.tag}>APPOINTMENT PREP</Text>
          <Text style={s.title}>Prepare my{'\n'}next appointment</Text>
        </View>

        <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Phase: appointment ── */}
          <View style={[s.card, shadow.sm]}>
            <Text style={s.cardHead}>📅 Next appointment</Text>
            {appointmentDate ? (
              <View style={s.apptSet}>
                <Text style={s.apptSetText}>✓ {appointmentDate}</Text>
                <TouchableOpacity onPress={() => setAppointmentDate(null)}>
                  <Text style={s.apptChange}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.cardSub}>When is your next specialist appointment?</Text>
                <View style={s.apptBtns}>
                  {APPT_OPTIONS.map(o => (
                    <TouchableOpacity key={o} style={s.apptBtn} onPress={() => setAppointmentDate(o)}>
                      <Text style={s.apptBtnText}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.findBtn} onPress={() => setShowSpecialist(true)}>
                  <Text style={s.findBtnText}>🔍 Find a specialist near me</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Phase: generate questions ── */}
          {phase === 'appointment' && (
            <TouchableOpacity style={[s.generateBtn, shadow.sm]} onPress={handleGenerate} activeOpacity={0.85}>
              <Text style={s.generateIcon}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.generateTitle}>Help me prepare my appointment</Text>
                <Text style={s.generateSub}>AI will generate questions based on your results</Text>
              </View>
              <Text style={s.generateArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* ── Phase: generating ── */}
          {phase === 'generating' && (
            <View style={[s.card, s.generatingCard, shadow.sm]}>
              <View style={s.generatingRow}>
                <View style={s.botDot}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.generatingTitle}>Copilot is reading your results…</Text>
                  <Text style={s.generatingSub}>Analyzing {analysisResult?.biomarkers?.filter(b => b.status !== 'ok').length || 0} key findings</Text>
                </View>
              </View>

              <View style={s.generatingSteps}>
                {[
                  'Reading biomarkers',
                  'Identifying priority questions',
                  'Adapting to your profile',
                  'Generating questions…',
                ].map((step, i) => (
                  <View key={i} style={s.generatingStepRow}>
                    <TypingDots />
                    <Text style={s.generatingStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Phase: questions ── */}
          {phase === 'questions' && questions.length > 0 && (
            <View style={[s.card, shadow.sm]}>
              <View style={s.cardHeadRow}>
                <Text style={s.cardHead}>🎯 Suggested questions</Text>
                <Text style={s.cardSub2}>{checkedCount}/{questions.length} selected</Text>
              </View>
              <Text style={s.cardSub}>Generated based on your results. Select the ones you want to bring.</Text>

              <View style={{ gap: 6, marginTop: 6 }}>
                {questions.map((q, i) => (
                  <QuestionItem
                    key={i}
                    q={q}
                    i={i}
                    onToggle={() => toggle(i)}
                    entryAnim={questionAnims[i] || new Animated.Value(1)}
                    onDiscuss={discussQuestion}
                  />
                ))}
              </View>

              {/* Add custom question */}
              <View style={s.addQRow}>
                <TextInput
                  style={s.addQInput}
                  placeholder="Add your own question…"
                  placeholderTextColor={colors.mid}
                  value={newQ}
                  onChangeText={setNewQ}
                  onSubmitEditing={addQuestion}
                  returnKeyType="done"
                />
                <TouchableOpacity style={[s.addQBtn, !newQ.trim() && { opacity: 0.4 }]} onPress={addQuestion} disabled={!newQ.trim()}>
                  <Text style={s.addQBtnText}>＋</Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={s.actionsRow}>
                <TouchableOpacity style={s.actionBtnSecondary} onPress={() => {
                  const checked = questions.filter(q => q.checked)
                  if (checked.length > 0) {
                    const msg = `I'd like to discuss these questions for my appointment:\n${checked.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}`
                    setPendingCopilotMessage(msg)
                  }
                  navigate(SCREENS.COPILOT)
                }}>
                  <Text style={s.actionBtnSecondaryText}>💬 Discuss with{'\n'}Copilot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtnPrimary, exporting && { opacity: 0.6 }]}
                  onPress={handleExport}
                  disabled={exporting}
                >
                  {exporting
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <>
                        <Text style={s.actionBtnPrimaryTitle}>📄 Export PDF</Text>
                        <Text style={s.actionBtnPrimarySubtitle}>{checkedCount} question{checkedCount !== 1 ? 's' : ''} + report</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {/* Regenerate */}
              <TouchableOpacity style={s.regenBtn} onPress={() => { setPhase('appointment'); setGeneratedQuestions(null); setQuestions([]) }}>
                <Text style={s.regenBtnText}>↺ Regenerate questions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Copilot chat CTA ── */}
          <TouchableOpacity style={[s.copilotCard, shadow.sm]} onPress={openNewCopilotChat} activeOpacity={0.85}>
            <View style={s.botDot}>
              <Text style={{ fontSize: 16 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.copilotCardTitle}>Have questions you can't formulate?</Text>
              <Text style={s.copilotCardSub}>Chat with Copilot — it knows your results</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.mid }}>→</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>

      <SpecialistSheet
        visible={showSpecialist}
        onClose={() => setShowSpecialist(false)}
        documentType={analysisResult?.documentType}
      />
    </KeyboardAvoidingView>
  )
}

// ─── PDF ─────────────────────────────────────────────────────
function buildPDFHtml({ analysisResult, questions, appointmentDate }) {
  const checked = questions.filter(q => q.checked)
  const biomarkers = analysisResult?.biomarkers || []
  const recs = analysisResult?.recommendations || []
  const score = analysisResult?.globalScore
  const summary = analysisResult?.copilotSummary

  const statusColor = (s) => s === 'ok' ? '#00C999' : s === 'warn' ? '#F59E0B' : '#F4607C'
  const statusLabel = (s) => s === 'ok' ? 'Normal' : s === 'warn' ? 'To monitor' : 'Below norm'
  const statusBg = (s) => s === 'ok' ? '#E6FBF6' : s === 'warn' ? '#FEF9EC' : '#FEF0F2'

  const bioRows = biomarkers.map(b => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827;font-weight:500">${b.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:700;color:${statusColor(b.status)}">${b.value} ${b.unit}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#6B7280">${b.norm}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6">
        <span style="background:${statusBg(b.status)};color:${statusColor(b.status)};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600">${statusLabel(b.status)}</span>
      </td>
    </tr>`).join('')

  const qItems = checked.map((q, i) => `
    <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid #F3F4F6">
      <div style="width:26px;height:26px;min-width:26px;background:#4056F4;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;margin-top:1px">${i + 1}</div>
      <p style="margin:0;font-size:13px;line-height:1.65;color:#111827">${q.text}</p>
    </div>`).join('')

  const recItems = recs.map(r => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #F3F4F6">
      <span style="font-size:18px;margin-top:1px">${r.icon}</span>
      <div>
        <p style="margin:0 0 3px;font-size:13px;color:#111827;font-weight:500">${r.text}</p>
        ${r.timeline ? `<p style="margin:0;font-size:11px;color:#9CA3AF">${r.timeline}</p>` : ''}
      </div>
    </div>`).join('')

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Appointment Preparation — Fertility Copilot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111827; }
    .page { max-width: 680px; margin: 0 auto; padding: 48px 40px; }
    /* Header */
    .header { background: linear-gradient(135deg, #1B2B6B 0%, #4056F4 60%, #7C5CFC 100%); border-radius: 20px; padding: 28px 32px; margin-bottom: 36px; }
    .header-eyebrow { font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .header-title { font-size: 26px; font-weight: 900; color: #fff; margin-bottom: 8px; }
    .header-meta { font-size: 12px; color: rgba(255,255,255,0.55); }
    .header-score { background: rgba(255,255,255,0.15); border-radius: 14px; padding: 12px 18px; display: inline-flex; align-items: center; gap: 10px; margin-top: 16px; }
    .header-score-num { font-size: 28px; font-weight: 900; color: #fff; }
    .header-score-label { font-size: 11px; color: rgba(255,255,255,0.7); }
    /* Sections */
    .section { margin-bottom: 32px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #9CA3AF; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1.5px solid #EEF1FF; }
    /* Summary */
    .summary-box { background: #F8F9FF; border-left: 4px solid #4056F4; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #374151; line-height: 1.7; font-style: italic; }
    /* Table */
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #F8F9FF; }
    th { text-align: left; padding: 10px 14px; font-size: 10px; color: #9CA3AF; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    /* Questions */
    .q-card { background: #F8F9FF; border-radius: 14px; padding: 2px 16px 10px; }
    /* Reco */
    .reco-card { background: #F0FDF8; border-radius: 14px; padding: 2px 16px 10px; }
    /* Footer */
    .footer { margin-top: 48px; padding-top: 18px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 10px; color: #9CA3AF; line-height: 1.8; }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-eyebrow">🧬 Fertility Copilot · Alan × Mistral</div>
    <div class="header-title">Appointment Preparation</div>
    <div class="header-meta">
      ${analysisResult?.documentType || 'Medical Report'}
      ${analysisResult?.date ? ' · ' + analysisResult.date : ''}
      ${appointmentDate ? ' · Appointment: ' + appointmentDate : ''}
      <br>Generated ${date}
    </div>
    ${score != null ? `
    <div class="header-score">
      <div>
        <div class="header-score-num">${score}/100</div>
        <div class="header-score-label">Overall score</div>
      </div>
    </div>` : ''}
  </div>

  ${summary ? `
  <div class="section">
    <div class="section-title">Copilot Summary</div>
    <div class="summary-box">"${summary}"</div>
  </div>` : ''}

  ${bioRows ? `
  <div class="section">
    <div class="section-title">Your Biomarkers</div>
    <table>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Your value</th>
          <th>Reference</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${bioRows}</tbody>
    </table>
  </div>` : ''}

  ${qItems ? `
  <div class="section">
    <div class="section-title">Questions for my doctor (${checked.length} selected)</div>
    <div class="q-card">${qItems}</div>
  </div>` : ''}

  ${recItems ? `
  <div class="section">
    <div class="section-title">Recommended Actions</div>
    <div class="reco-card">${recItems}</div>
  </div>` : ''}

  <div class="footer">
    Generated by Fertility Copilot · Powered by Mistral AI<br>
    This document is not a medical diagnosis. Please discuss with your specialist.
  </div>

</div>
</body>
</html>`
}

// ─── Specialist sheet styles ──────────────────────────────────
const sp = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.82 },
  handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lightgray, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  title:          { flex: 1, fontSize: 16, fontWeight: font.black, color: colors.dark },
  closeBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lightgray, alignItems: 'center', justifyContent: 'center' },
  closeX:         { fontSize: 11, color: colors.mid },
  locationChip:   { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(64,86,244,0.07)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  locationText:   { fontSize: 12, fontWeight: font.semibold, color: colors.blue },
  tabsScroll:     { flexShrink: 0 },
  tabs:           { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  tab:            { backgroundColor: colors.lightgray, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  tabActive:      { backgroundColor: colors.blue },
  tabText:        { fontSize: 12, fontWeight: font.semibold, color: colors.mid },
  tabTextActive:  { color: colors.white },
  scroll:         { flex: 1 },
  doctolibBtn:    { backgroundColor: colors.blue, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  doctolibTitle:  { fontSize: 14, fontWeight: font.black, color: colors.white },
  doctolibSub:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  doctolibArrow:  { fontSize: 20, color: 'rgba(255,255,255,0.7)' },
  loadingCard:    { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.lightgray, borderRadius: 14, padding: 16 },
  loadingText:    { fontSize: 13, color: colors.mid },
  errorCard:      { backgroundColor: 'rgba(244,96,124,0.08)', borderRadius: 14, padding: 16, gap: 10 },
  errorText:      { fontSize: 13, color: colors.coral },
  retryBtn:       { backgroundColor: colors.coral, borderRadius: 10, padding: 10, alignItems: 'center' },
  retryText:      { fontSize: 12, fontWeight: font.bold, color: colors.white },
  emptyCard:      { backgroundColor: colors.lightgray, borderRadius: 14, padding: 16 },
  emptyText:      { fontSize: 13, color: colors.mid, lineHeight: 20 },
  resultCard:     { backgroundColor: colors.lightgray, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultLeft:     { flex: 1, gap: 3 },
  resultName:     { fontSize: 13, fontWeight: font.bold, color: colors.dark },
  resultAddr:     { fontSize: 11, color: colors.mid, lineHeight: 16 },
  resultTagRow:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  resultTag:      { backgroundColor: 'rgba(64,86,244,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  resultTagText:  { fontSize: 9, color: colors.blue, fontWeight: font.semibold },
  resultDist:     { backgroundColor: 'rgba(0,201,153,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  resultDistText: { fontSize: 9, color: colors.teal, fontWeight: font.bold },
  mapsBtn:        { width: 38, height: 38, backgroundColor: colors.white, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  mapsBtnText:    { fontSize: 18 },
})

// ─── Styles ──────────────────────────────────────────────────
const ty = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  tag: { fontSize: 10, fontWeight: font.bold, letterSpacing: 1.5, color: colors.teal, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: font.black, color: colors.navy, lineHeight: 32 },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  // Card
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  cardHead: { fontSize: 14, fontWeight: font.black, color: colors.dark, marginBottom: 8 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardSub: { fontSize: 12, color: colors.mid, lineHeight: 18, marginBottom: 10 },
  cardSub2: { fontSize: 12, fontWeight: font.semibold, color: colors.teal },
  // Appointment
  apptSet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.lightgray, borderRadius: 10, padding: 10 },
  apptSetText: { fontSize: 13, fontWeight: font.bold, color: colors.teal },
  apptChange: { fontSize: 12, color: colors.mid },
  apptBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  apptBtn: { backgroundColor: colors.lightgray, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  apptBtnText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark },
  findBtn: { backgroundColor: 'rgba(64,86,244,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(64,86,244,0.2)' },
  findBtnText: { fontSize: 13, fontWeight: font.semibold, color: colors.blue },
  // Generate CTA
  generateBtn: { backgroundColor: colors.blue, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  generateIcon: { fontSize: 28 },
  generateTitle: { fontSize: 15, fontWeight: font.black, color: colors.white, marginBottom: 3 },
  generateSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  generateArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)' },
  // Generating state
  generatingCard: { borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.15)' },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  botDot: { width: 38, height: 38, backgroundColor: colors.blue, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  generatingTitle: { fontSize: 14, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  generatingSub: { fontSize: 12, color: colors.mid },
  generatingSteps: { gap: 10, paddingLeft: 4 },
  generatingStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generatingStepText: { fontSize: 13, color: colors.dark },
  // Questions
  qItem: { flexDirection: 'row', gap: 10, backgroundColor: colors.lightgray, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'transparent' },
  qItemOn: { borderColor: colors.teal, backgroundColor: 'rgba(0,201,153,0.06)' },
  qCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  qCheckOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  qText: { fontSize: 12, color: colors.dark, lineHeight: 18 },
  qBadge: { marginTop: 4, backgroundColor: 'rgba(0,201,153,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  qBadgeText: { fontSize: 9, fontWeight: font.bold, color: colors.teal },
  qDiscussBtn: { padding: 4, marginLeft: 4 },
  qDiscussBtnText: { fontSize: 16 },
  // Add custom question
  addQRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 6 },
  addQInput: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.dark },
  addQBtn: { width: 40, height: 40, backgroundColor: colors.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addQBtnText: { fontSize: 18, color: colors.white, fontWeight: font.bold },
  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtnSecondary: { flex: 1, backgroundColor: colors.lightgray, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnSecondaryText: { fontSize: 12, fontWeight: font.semibold, color: colors.dark, textAlign: 'center', lineHeight: 18 },
  actionBtnPrimary: { flex: 1.4, backgroundColor: colors.coral, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimaryTitle: { fontSize: 13, fontWeight: font.black, color: colors.white },
  actionBtnPrimarySubtitle: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  regenBtn: { marginTop: 10, alignItems: 'center', padding: 6 },
  regenBtnText: { fontSize: 12, color: colors.mid },
  // Copilot card
  copilotCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'rgba(64,86,244,0.15)' },
  copilotCardTitle: { fontSize: 13, fontWeight: font.bold, color: colors.dark, marginBottom: 2 },
  copilotCardSub: { fontSize: 11, color: colors.mid },
})
