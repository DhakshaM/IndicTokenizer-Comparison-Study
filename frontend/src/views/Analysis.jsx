// frontend/src/views/Analysis.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar, Cell, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
  ScatterChart, Scatter,
} from 'recharts'
import { getCorpusMetrics } from '../api'
import { tokenizeText }    from '../api'
import { decodeBBPEToken, decodeBBPETokens } from '../bbpe'

const METRICS_META = [
  { key:'fertility', label:'Fertility',  desc:'Tokens per word. Lower = more efficient.', lowerIsBetter: true },
  { key:'nsl',       label:'NSL',        desc:'Tokens per character. ', lowerIsBetter: true },
  { key:'cpt',       label:'CPT',        desc:'Chars per token. Higher = coarser tokens.', lowerIsBetter: false },
  { key:'pcw',       label:'PCW',        desc:'Fragmented word fraction. Lower = less splitting.', lowerIsBetter: true },
  { key:'vocab_size',label:'Vocab',      desc:'Vocabulary size (# unique subword tokens). Lower = smaller model.', lowerIsBetter: true },
]

const STRATEGY_COLORS = {
  'Whitespace':             'var(--tok-0)',
  'Word (IndicNLP)':        'var(--tok-1)',
  'Character (Grapheme Clusters)': 'var(--tok-2)',
  'BPE':                    'var(--tok-3)',
  'WordPiece':              'var(--tok-4)',
  'Unigram LM':             'var(--tok-5)',
  'Byte-Level BPE':         'var(--tok-6)',
}
const STRATEGY_ABBR = {
  'Whitespace': 'WS',
  'Whitespace (Baseline)': 'WS',
  'Word (IndicNLP)': 'WD',
  'Character (Grapheme Clusters)': 'CH',
  BPE: 'BP',
  WordPiece: 'WP',
  'Unigram LM': 'UG',
  'Byte-Level BPE': 'BB',
}

/** Growing snippets for the length sweep (must stay in the script the backend expects per language). */
const LENGTH_PRESETS_BY_LANGUAGE = {
  hindi: [
  'भारत', 'भारत एक', 'भारत एक महान', 'भारत एक महान देश',
  'भारत एक महान देश है', 'भारत एक महान देश है।',
  'भारत एक महान और विविध देश है जहाँ अनेक भाषाएँ बोली जाती हैं।',
    'भारत एक संघीय संरचना वाला लोकतांत्रिक देश है जहाँ संसद, न्यायपालिका और कार्यपालिका अपनी भूमिका निभाते हैं।',
    'भारत की आधिकारिक भाषाओं में हिंदी और अंग्रेज़ी शामिल हैं; राज्य अपनी राजभाषा चुनते हैं और विभिन्न भाषाओं में शिक्षा व प्रशासन चलता है।',
    'दुनिया का सातवाँ सबसे बड़ा देश भारत विशाल भौगोलिक विविधता से भरा है; यहाँ हिमालय से समुद्र तट तक जलवायु परिवर्तित होती है और संस्कृति व व्यवसाय के स्वरूप भी भिन्न हैं।',
    'संविधान ने भारत को धर्मनिरपेक्ष लोकतांत्रिक गणराज्य घोषित किया है जिसमें संसदीय व्यवस्था, स्वतंत्र न्यायपालिका और बहुलवादी राजनीति का समन्वय है और नागरिकों को मौलिक अधिकार व कर्तव्य प्राप्त हैं।',
    'भारतीय अर्थव्यवस्था विश्व की प्रमुख अर्थव्यवस्थाओं में से एक है जहाँ कृषि, उद्योग और सेवा क्षेत्र सहकारी भूमिका निभाते हैं और विभिन्न राज्यों में स्थानीय उद्यमों से लेकर बड़े औद्योगिक केंद्रों तक रोज़गार के अवसर फैले हुए हैं।',
  ],
  marathi: [
    'भारत', 'भारत एक', 'भारत एक महान', 'भारत एक महान देश',
    'भारत एक महान देश आहे', 'भारत एक महान देश आहे.',
    'भारत एक महान आणि विविध देश आहे जिथे अनेक भाषा बोलल्या जातात.',
    'भारत हा संघराज्यीय लोकशाही असलेला देश आहे जिथे संसद, न्यायपालिका आणि कार्यकारी मंडळ स्वतःच्या भूमिका पार पाडतात.',
    'भारताच्या अधिकृत भाषांमध्ये हिंदी आणि इंग्रजी समाविष्ट आहेत; प्रत्येक राज्य आपली राजभाषा निवडू शकते आणि विविध भाषांमध्ये शिक्षण व प्रशासन चालते.',
    'जगातील सातव्या क्रमांकाचा सर्वात मोठा देश भारत भौगोलिक विविधतेने समृद्ध आहे; येथे हिमालयापासून समुद्रकाठापर्यंत हवामान बदलते आणि संस्कृतीही विविध आहे.',
    'संविधानाने भारतला धर्मनिरपेक्ष लोकशाही गणराज्य घोषित केले असून संसदीय व्यवस्था, स्वतंत्र न्यायपालिका आणि बहुपक्षीय राजकारण यांचे एकत्र काम करते.',
    'भारतीय अर्थव्यवस्था जगातील प्रमुख अर्थव्यवस्थांपैकी एक आहे जिथे शेती, उद्योग आणि सेवा क्षेत्र महत्त्वाची भूमिका बजावतात आणि राज्यांमध्ये रोजगाराच्या संधी विस्तृत आहेत.',
  ],
  tamil: [
    'இந்தியா', 'இந்தியா ஒரு', 'இந்தியா ஒரு பெரிய', 'இந்தியா ஒரு பெரிய நாடு',
    'இந்தியா ஒரு பெரிய நாடு ஆகும்', 'இந்தியா ஒரு பெரிய நாடு ஆகும்.',
    'இந்தியா ஒரு பெரிய மற்றும் பல்துறை நாடு ஆகும்; இங்கு அனேக மொழிகள் பேசப்படுகின்றன.',
    'இந்தியா கூட்டாட்சி அமைப்புள்ள ஜனநாயக நாடு; இங்கு நாடாளுமன்றம், நீதித்துறை மற்றும் நிர்வாகம் தனித்தனிப் பங்களிப்புகளைச் செய்கின்றன.',
    'இந்தியாவின் அதிகாரப்பூர்வ மொழிகளில் இந்தியும் ஆங்கிலமும் அடங்கும்; மாநிலங்கள் தங்கள் அலுவல் மொழியைத் தேர்ந்தெடுக்கின்றன மற்றும் பல மொழிகளில் கல்வி நடைபெறுகிறது.',
    'உலகின் ஏழாவது பெரிய நாடான இந்தியா பெரும் புவியியல் வேறுபாடுகளைக் கொண்டது; இமயமலையிலிருந்து கடற்கரை வரை காலநிலை மாறுகிறது மற்றும் கலாச்சாரமும் வேறுபடுகிறது.',
    'அரசியலமைப்பு இந்தியாவை மதச்சார்பற்ற ஜனநாயக குடியரசாக அறிவிக்கிறது; நாடாளுமன்ற முறை, சுயமான நீதித்துறை மற்றும் பல கட்சிகளின் அரசியல் இணைந்து செயல்படுகின்றன.',
    'இந்திய பொருளாதாரம் உலகின் முக்கிய பொருளாதாரங்களில் ஒன்று; விவசாயம், தொழில் மற்றும் சேவைத்துறை முக்கிய பங்கு வகிக்கின்றன மற்றும் மாநிலங்களில் வேலைவாய்ப்புகள் பரவியுள்ளன.',
  ],
}

/** Default CPT sample phrases (script-appropriate; editable in UI). */
const CPT_SAMPLE_BY_LANGUAGE = {
  hindi: 'हिन्दी भाषा भारत की राजभाषा है',
  marathi: 'मराठी ही महाराष्ट्राची राजभाषा आहे',
  tamil: 'தமிழ் தமிழ்நாட்டின் அதிகாரப்பூர்வ மொழி',
}

const NSL_REF_CHARS = 100
/** Fixed token “slots” for one conceptual 100-character run (one thin vertical cell per token at rate NSL). */
const NSL_SLOT_COUNT = 100

function bareTokDisplay(t) {
  return String(t ?? '')
    .replace(/^[▁Ġ]+/, '')
    .replace(/^##/, '')
}

function tokenCharWeight(t) {
  const b = bareTokDisplay(t)
  return Math.max(1, [...b].length)
}

const NSL_LABEL_COL = 128
const NSL_NS_COL = 52
const NSL_TOKEN_BADGE_W = 96
const NSL_ROW_GAP = 12
/** CPT: tighter label column + gap so abbreviations sit closer to the segment bar (heatmap uses full names in a wider column). */
const CPT_LABEL_COL = 44
const CPT_ROW_GAP = 6
/** Keeps PCW / fertility / NSL / CPT from shifting the card layout when switching tabs. */
const METRIC_PRIMARY_MIN_HEIGHT = 340
/** Fixed pixel width per NSL “tooth” so 100 cells stay visible (flex-1 was collapsing them to one bar). */
const NSL_CELL_W = 4
const NSL_CELL_GAP = 2
const NSL_COMB_WIDTH = NSL_SLOT_COUNT * (NSL_CELL_W + NSL_CELL_GAP) - NSL_CELL_GAP

/** Horizontal comb ruler: thin vertical cells, fixed 100-slot budget, sorted low → high token cost. */
function NSLTokenCells({ corpusMetrics, colorList }) {
  const axisTicks = [0, 25, 50, 75, NSL_SLOT_COUNT]

  const rows = corpusMetrics
    .map((s, idx) => {
      const nsl = Math.max(0, Number(s.nsl) || 0)
      const tokenCells = Math.max(0, Math.round(nsl * NSL_REF_CHARS))
      const filledSlots = Math.min(tokenCells, NSL_SLOT_COUNT)
      return {
        strategyFull: s.strategy,
        nsl,
        tokenCells,
        filledSlots,
        color: colorList[idx % colorList.length],
      }
    })
    .sort((a, b) => a.tokenCells - b.tokenCells)

  const colStyle = { display: 'flex', alignItems: 'center', gap: NSL_ROW_GAP, marginBottom: 12 }

  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.strategyFull}
          style={colStyle}
          title={`${row.strategyFull}\n≈ ${row.tokenCells} tokens for ${NSL_REF_CHARS} characters\nNSL = ${row.nsl.toFixed(3)} tok/chr`}
        >
          <div style={{
            width: NSL_LABEL_COL,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            color: row.color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          >
            {row.strategyFull}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', minHeight: 36 }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'stretch',
              minWidth: 0,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            >
              <div style={{
                flex: 1,
                minWidth: 0,
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '5px 6px',
                boxSizing: 'border-box',
              }}
              >
                <div style={{
                  display: 'flex',
                  gap: NSL_CELL_GAP,
                  width: NSL_COMB_WIDTH,
                  minHeight: 24,
                  alignItems: 'stretch',
                }}
                >
                  {Array.from({ length: NSL_SLOT_COUNT }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: NSL_CELL_W,
                        flex: '0 0 auto',
                        borderRadius: 1,
                        background: i < row.filledSlots
                          ? row.color
                          : 'rgba(255,255,255,0.045)',
                        opacity: i < row.filledSlots ? 0.93 : 0.5,
                        boxShadow: i < row.filledSlots ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{
                flexShrink: 0,
                width: NSL_TOKEN_BADGE_W,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-1)',
                borderLeft: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.14)',
                whiteSpace: 'nowrap',
              }}
              >
                {row.tokenCells} tokens
              </div>
            </div>
          </div>
          <div style={{
            width: NSL_NS_COL,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-0)',
            textAlign: 'right',
          }}
          >
            {row.nsl.toFixed(3)}
          </div>
        </div>
      ))}

      <div style={{ ...colStyle, marginBottom: 4, marginTop: 2 }}>
        <div style={{ width: NSL_LABEL_COL, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: NSL_TOKEN_BADGE_W }}>
          <div style={{
            position: 'relative',
            height: 18,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-2)',
          }}
          >
            {axisTicks.map((t) => (
              <span
                key={t}
                style={{
                  position: 'absolute',
                  left: `${(t / NSL_SLOT_COUNT) * 100}%`,
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-2)',
            textAlign: 'center',
            opacity: 0.9,
            marginTop: 2,
            letterSpacing: '0.02em',
          }}
          >
            ( tokens needed for 100 chars of input )
          </div>
        </div>
        <div style={{ width: NSL_NS_COL, flexShrink: 0 }} />
      </div>
    </div>
  )
}

/** Ruler spans from live /tokenize; CPT number under label = precomputed IndicCorp aggregate only. */
function CPTTokenRuler({
  phraseDraft,
  setPhraseDraft,
  onApplyPhrase,
  tokensByStrategy,
  loadingTokens,
  strategies,
  corpusMetrics,
  colorList,
}) {
  const rows = corpusMetrics.map((s, i) => {
    const key = strategies?.[i]?.key
    const tokens = key && tokensByStrategy ? (tokensByStrategy[key] ?? []) : []
    const totalW = tokens.reduce((a, t) => a + tokenCharWeight(t), 0) || 1
    const isBBPE = key === 'bbpe'
    const decoded = isBBPE && tokens.length > 0 ? decodeBBPETokens(tokens) : null
    return {
      strategyFull: s.strategy,
      name: STRATEGY_ABBR[s.strategy] || s.strategy.slice(0, 4),
      tokens,
      totalW,
      color: colorList[i % colorList.length],
      cptCorp: Number(s.cpt) || 0,
      isBBPE,
      decoded,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '10px 12px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <span style={{ color: 'var(--text-2)', fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 8 }}>
          SAMPLE PHRASE
        </span>
        <textarea
          value={phraseDraft}
          onChange={(e) => setPhraseDraft(e.target.value)}
          rows={2}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 44,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-0)',
            color: 'var(--text-0)',
            fontFamily: 'var(--font-ui), sans-serif',
            fontSize: 14,
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onApplyPhrase}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              border: '1px solid var(--cyan)',
              background: 'var(--cyan-dim)',
              color: 'var(--cyan)',
              cursor: 'pointer',
            }}
          >
            Segment phrase
          </button>
          {loadingTokens && (
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>Updating…</span>
          )}
        </div>
        {/* <p style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
          Bands = live tokenizer output on this text (width ∝ stripped character length → visual “bite size”).
          CPT next to each name is the corpus-wide aggregate from metrics JSON—not recomputed from this phrase.
        </p> */}
      </div>
      {rows.map((row) => (
        <div
          key={row.strategyFull}
          style={{ display: 'flex', alignItems: 'center', gap: CPT_ROW_GAP, marginBottom: 10 }}
          title={row.strategyFull}
        >
          <div style={{
            width: CPT_LABEL_COL,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            color: row.color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'left',
          }}
          >
            {row.name}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{
              textAlign: 'right',
              marginBottom: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-2)',
            }}
            >
              {row.tokens.length} span{row.tokens.length === 1 ? '' : 's'} on this phrase
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'stretch',
              width: '100%',
              minHeight: 40,
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              boxSizing: 'border-box',
              padding: '5px 6px',
            }}
            >
              {row.tokens.length === 0 ? (
                <div style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                  {loadingTokens ? '…' : '—'}
                </div>
              ) : (
                row.tokens.map((t, j) => {
                  const wch = tokenCharWeight(t)
                  const pct = (wch / row.totalW) * 100
                  const label = bareTokDisplay(t) || String(t)
                  return (
                    <div
                      key={`${row.strategyFull}-${j}-${label.slice(0, 32)}`}
                      title={`${row.strategyFull}\n«${label}» · ${wch} char(s)`}
                      style={{
                        boxSizing: 'border-box',
                        flexGrow: pct,
                        flexShrink: pct,
                        flexBasis: 0,
                        minWidth: 0,
                        minHeight: 36,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        padding: '6px 4px',
                        borderRight: j < row.tokens.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: row.color,
                          opacity: 0.22,
                          borderRadius: 3,
                          boxShadow: `inset 0 0 0 1px ${row.color}`,
                        }}
                      />
                      <span style={{
                        position: 'relative',
                        zIndex: 1,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-0)',
                        fontWeight: 600,
                        textAlign: 'center',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        lineHeight: 1.35,
                        hyphens: 'auto',
                        width: '100%',
                        alignSelf: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      >
                        {label}
                        {row.isBBPE && (() => {
                          const dec = decodeBBPEToken(t)
                          return dec ? (
                            <span style={{
                              fontSize: 10, fontFamily: 'var(--font-ui)',
                              color: 'var(--cyan)', opacity: 0.9,
                              fontWeight: 400, lineHeight: 1,
                            }}>{dec}</span>
                          ) : null
                        })()}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            {row.decoded && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderTop: '1px dashed var(--border-hi)',
                borderRadius: '0 0 10px 10px',
                marginTop: -1,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-2)', textTransform: 'uppercase',
                  letterSpacing: '0.12em', flexShrink: 0,
                }}>decoded</span>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 13,
                  color: 'var(--cyan)',
                }}>{row.decoded}</span>
              </div>
            )}
          </div>
          <div style={{
            width: NSL_NS_COL,
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-0)',
            textAlign: 'right',
          }}
            title="Corpus-wide CPT from IndicCorp metrics JSON"
          >
            {row.cptCorp.toFixed(3)}
          </div>
        </div>
      ))}
    </div>
  )
}

function AggregateMetricBarChart({ rows, metricLabel }) {
  const renderTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload
    return (
      <div style={{ ...CHART_TOOLTIP_STYLE, padding: '10px 12px', maxWidth: 320 }}>
        <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-0)' }}>{row.strategyFull}</div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
          {metricLabel}:{' '}
          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{row.value}</span>
        </div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={246}>
      <BarChart data={rows} margin={{ top: 12, right: 10, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--text-1)' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={54}
        />
        <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip content={renderTip} cursor={{ fill: '#ffffff08' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: 'top', fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-1)' }}>
          {rows.map((r, i) => (
            <Cell key={`${r.strategyFull}-${i}`} fill={r.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Nice ticks on a log₁₀ axis (1–9 × 10^k), deduped; avoids duplicate labels from rounded auto-ticks. */
function buildLogAxisTicks(lo, hi, maxTicks = 11) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= lo) {
    return [1, 2, 3, 5, 8, 12]
  }
  const logL = Math.log10(lo)
  const logH = Math.log10(hi)
  const eMin = Math.floor(logL - 1e-12)
  const eMax = Math.ceil(logH + 1e-12)
  const mults = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const raw = []
  for (let e = eMin; e <= eMax; e++) {
    for (const m of mults) {
      const t = m * 10 ** e
      if (t >= lo * 0.998 && t <= hi * 1.002) raw.push(t)
    }
  }
  const uniq = [...new Set(raw.map((x) => +String(Number.parseFloat(x.toPrecision(12)))))]
    .sort((a, b) => a - b)
  if (uniq.length <= maxTicks) return uniq
  const step = Math.ceil(uniq.length / maxTicks)
  const out = uniq.filter((_, i) => i % step === 0)
  const last = uniq[uniq.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return [...new Set(out)].sort((a, b) => a - b)
}

/** Readable labels for token counts on log axis (unique strings per tick value). */
function formatSweepLogTick(v) {
  if (!Number.isFinite(v)) return ''
  const x = Number.parseFloat(Number(v).toPrecision(10))
  if (x >= 100) return `${Math.round(x)}`
  if (x >= 10) {
    const r = Math.round(x * 10) / 10
    return Number.isInteger(r) ? `${r}` : r.toFixed(1).replace(/\.0$/, '')
  }
  const nearInt = Math.round(x)
  if (Math.abs(x - nearInt) < 0.02) return `${nearInt}`
  return `${Math.round(x * 100) / 100}`
}

/** Drop log-scale ticks whose formatted label matches the previous tick (stops two “5”s, etc.). */
function dedupeLogTicksByFormattedLabel(ticks, formatFn) {
  const out = []
  let prevLabel = null
  for (const t of ticks) {
    const lbl = formatFn(t)
    if (lbl === prevLabel) continue
    prevLabel = lbl
    out.push(t)
  }
  return out.length >= 2 ? out : ticks
}

/** Matches app chrome (see index.css): mono for data UI, theme colours. */
const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--text-0)',
}

/** RGB approximations of --red / --green; alpha keeps numerals readable on heat cells. */
const HEAT_BAD = [240, 80, 80]
const HEAT_GOOD = [74, 222, 128]

/** score ∈ [0,1]: 1 = best (green), 0 = worst (red). */
function lerpHeatBg(score, alpha = 0.38) {
  const t = Math.max(0, Math.min(1, score))
  const r = Math.round(HEAT_BAD[0] + (HEAT_GOOD[0] - HEAT_BAD[0]) * t)
  const g = Math.round(HEAT_BAD[1] + (HEAT_GOOD[1] - HEAT_BAD[1]) * t)
  const b = Math.round(HEAT_BAD[2] + (HEAT_GOOD[2] - HEAT_BAD[2]) * t)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Uniform circle dots; opacity from legend isolation. */
const SWEEP_DOT_R = 4

function SweepDot({ cx, cy, fill, stroke, opacity = 1, rScale = 1 }) {
  if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return null
  const R = SWEEP_DOT_R * rScale
  const c = fill || stroke || 'var(--cyan)'
  const muted = opacity < 0.55
  const outline = muted ? 'var(--border)' : 'var(--bg-0)'
  return (
    <g opacity={opacity} style={{ pointerEvents: 'none' }}>
      <circle cx={cx} cy={cy} r={R} fill={c} stroke={outline} strokeWidth={1.15} />
    </g>
  )
}

/** Stroke/dot opacity for non-focused series while hovering the legend (was ~0.07; bump so curves stay comparable). */
const SWEEP_DEEMPHASIS_OPACITY = 0.38

function fmtTok(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}

function SweepTooltipContent({ active, payload, label, strategies }) {
  if (!active || !payload?.length) return null
  const rows = [...payload]
    .filter((p) => p && p.dataKey != null && p.value != null && !Number.isNaN(Number(p.value)))
    .sort((a, b) => Number(b.value) - Number(a.value))

  const stratLabel = (dataKey) =>
    strategies?.find((s) => s.key === dataKey)?.abbr ?? strategies?.find((s) => s.key === dataKey)?.label ?? String(dataKey)

  const pt0 = payload[0]?.payload
  const wordsHint = pt0 && typeof pt0.words === 'number' ? pt0.words : null

  return (
    <div style={{ ...CHART_TOOLTIP_STYLE, padding: '12px 14px', minWidth: 200, maxWidth: 280 }}>
      <div style={{
        marginBottom: 10,
        fontSize: 11,
        color: 'var(--cyan)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        <span style={{ color: 'var(--text-0)' }}>{label}</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 8 }}>chars</span>
        {wordsHint != null && (
          <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 10 }}>
            · {wordsHint} words
          </span>
        )}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((p, rank) => (
          <li
            key={String(p.dataKey)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '4px 0',
              borderBottom: rank < rows.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: 11,
              color: 'var(--text-1)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-2)', width: 18 }}>{rank + 1}.</span>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }} />
              <span>{stratLabel(p.dataKey)}</span>
            </span>
            <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{fmtTok(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SweepLegendContent({ payload, activeSeries, setActiveSeries }) {
  if (!payload?.length) return null
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px 18px',
      justifyContent: 'center',
      paddingTop: 10,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
    }}>
      {payload.map((entry) => {
        const dim = activeSeries != null && activeSeries !== entry.dataKey
        return (
          <span
            key={entry.dataKey}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setActiveSeries(entry.dataKey)}
            onMouseLeave={() => setActiveSeries(null)}
            onFocus={() => setActiveSeries(entry.dataKey)}
            onBlur={() => setActiveSeries(null)}
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              opacity: dim ? 0.82 : 1,
              color: dim ? 'var(--text-2)' : 'var(--text-1)',
              outline: 'none',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: entry.color,
                border: '1px solid var(--border)',
                flexShrink: 0,
                opacity: dim ? 0.75 : 1,
              }}
            />
            <span>{entry.value}</span>
          </span>
        )
      })}
    </div>
  )
}

function PCWStackTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row?.strategyFull) return null
  return (
    <div style={{ ...CHART_TOOLTIP_STYLE, padding: '10px 12px', maxWidth: 300 }}>
      <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-0)' }}>
        {row.strategyFull}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 10, fontFamily: 'var(--font-mono)', lineHeight: 1.45 }}>
        <div><span style={{ color: 'var(--green)' }}>Whole words</span>: {row.wholePct.toFixed(3)}% (~{Math.round(row.wholeWords).toLocaleString()} of ~{Math.round(row.wordsEst).toLocaleString()} words)</div>
        <div style={{ marginTop: 4 }}><span style={{ color: 'var(--amber)' }}>Split words</span>: {row.fragPct.toFixed(3)}% (~{Math.round(row.fragWords).toLocaleString()} words)</div>
      </div>
      {/* <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 10, opacity: 0.85, lineHeight: 1.4 }}>
        Shares follow the headline PCW score only—there is no per-token attribution here.
      </div> */}
    </div>
  )
}

/** Compact axis / tooltip numbers so labels don’t overflow the plot. */
function formatScatterAxisTick(v) {
  if (!Number.isFinite(v)) return ''
  const x = Number(v)
  const a = Math.abs(x)
  if (a >= 100) return `${Math.round(x)}`
  return x.toFixed(3)
}

function FertCptScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (!p?.strategyFull) return null
  const cpt = Number(p.cpt)
  const fert = Number(p.fertility)
  return (
    <div style={{ ...CHART_TOOLTIP_STYLE, padding: '10px 12px', maxWidth: 220, wordBreak: 'break-word' }}>
      <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-0)', fontSize: 11 }}>
        {p.strategyFull}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
        CPT <span style={{ color: 'var(--text-1)' }}>{formatScatterAxisTick(cpt)}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
        Fert. <span style={{ color: 'var(--text-1)' }}>{formatScatterAxisTick(fert)}</span>
      </div>
    </div>
  )
}

/** Corpus-level scatter: fertility (Y) vs CPT (X); one point per strategy. */
function FertilityCptScatter({ corpusMetrics, colorList }) {
  const data = corpusMetrics.map((s, i) => ({
    cpt: Math.max(0, Number(s.cpt) || 0),
    fertility: Math.max(0, Number(s.fertility) || 0),
    name: STRATEGY_ABBR[s.strategy] || s.strategy.slice(0, 4),
    strategyFull: s.strategy,
    color: colorList[i % colorList.length],
  }))
  const cpts = data.map((d) => d.cpt)
  const ferts = data.map((d) => d.fertility)
  const padX = (Math.max(...cpts, 1) - Math.min(...cpts, 0)) * 0.08 || 0.5
  const padY = (Math.max(...ferts, 1) - Math.min(...ferts, 0)) * 0.08 || 0.05
  const x0 = Math.max(0, Math.min(...cpts) - padX)
  const x1 = Math.max(...cpts) + padX
  const y0 = Math.max(0, Math.min(...ferts) - padY)
  const y1 = Math.max(...ferts) + padY

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 28, left: 52 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="cpt"
          domain={[x0, x1]}
          name="CPT"
          tickFormatter={formatScatterAxisTick}
          tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-2)' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'CPT (chr / tok)', position: 'insideBottom', offset: -4, fill: 'var(--text-2)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
        />
        <YAxis
          type="number"
          dataKey="fertility"
          domain={[y0, y1]}
          name="Fertility"
          width={40}
          tickFormatter={formatScatterAxisTick}
          tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-2)' }}
          axisLine={false}
          tickLine={false}
          label={{
            value: 'Tok / word',
            angle: -90,
            position: 'insideLeft',
            offset: 0,
            dx: -36,
            style: { textAnchor: 'middle' },
            fill: 'var(--text-2)',
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <ZAxis range={[96, 96]} />
        <Tooltip content={<FertCptScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={`${entry.strategyFull}-${i}`} fill={entry.color} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/* ══════════════════════════════════════════════════════════════════
 *  PROMPT-ENGINEERING PANELS
 *    1. Context window simulator
 *    2. Relative cost meter
 *  Both live in <PromptBudgetPanels /> because the cost meter's
 *  "My input" mode reuses the simulator's tokenization result.
 * ══════════════════════════════════════════════════════════════════ */

/** The four strategies that need a trained vocabulary ("learned"). Used to pick a practical baseline. */
const LEARNED_KEYS = ['bpe', 'wordpiece', 'unigram', 'bbpe']
const HIDDEN_CONTEXT_STRATEGY_KEYS = new Set(['whitespace', 'word'])

/** Metrics-JSON strategy name → backend/strategy key. */
const STRATEGY_KEY_BY_NAME = {
  Whitespace: 'whitespace',
  'Whitespace (Baseline)': 'whitespace',
  'Word (IndicNLP)': 'word',
  'Character (Grapheme Clusters)': 'character',
  BPE: 'bpe',
  WordPiece: 'wordpiece',
  'Unigram LM': 'unigram',
  'Byte-Level BPE': 'bbpe',
}

const STRATEGY_FULL_NAME = {
  whitespace: 'Whitespace',
  word: 'Word (IndicNLP)',
  character: 'Character (grapheme)',
  bpe: 'BPE',
  wordpiece: 'WordPiece',
  unigram: 'Unigram LM',
  bbpe: 'Byte-Level BPE',
}

const STRATEGY_SHORT_NAME = {
  whitespace: 'Whitespace',
  word: 'Word',
  character: 'Character',
  bpe: 'BPE',
  wordpiece: 'WordPiece',
  unigram: 'Unigram LM',
  bbpe: 'BBPE',
}

const CTX_WINDOWS = [
  { key: 'w512',   label: '512',   size: 512,    scenario: 'Short paragraph' },
  { key: 'w2k',    label: '2,048', size: 2048,   scenario: 'A few paragraphs' },
  { key: 'w4k',    label: '4,096', size: 4096,   scenario: 'Multi-page brief' },
  { key: 'w8k',    label: '8,192', size: 8192,   scenario: 'Long report' },
  { key: 'w128k',  label: '128K',  size: 128000, scenario: 'Book-length document' },
]

/**
 * Default document length ≈ this many WORDS per window slot. Chosen so that a low-fertility
 * tokenizer (~1.1–1.7 tokens/word) lands well inside the window while a high-fertility one
 * (byte-level BPE, ~3.3–6.7 tokens/word on these corpora) lands near or beyond 100 %.
 */
const CTX_TARGET_WORDS_PER_SLOT = 0.3
/** Cap on the passage sent to /tokenize (the backend's live PCW loop grows with words × tokens). */
const CTX_TEXT_MAX_CHARS = 3000
const CTX_REPEAT_MAX = 100000

const CTX_LABEL_COL = 128
const CTX_STAT_COL = 176
const CTX_ROW_GAP = 12

function countWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length
}

function fmtInt(n) {
  const x = Number(n)
  return Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—'
}

function fmtPct(p) {
  if (!Number.isFinite(p)) return '—'
  if (p < 0.1) return '<0.1%'
  if (p < 10) return `${p.toFixed(2)}%`
  if (p < 100) return `${p.toFixed(1)}%`
  return `${Math.round(p).toLocaleString('en-US')}%`
}

function parseRepeat(draft) {
  const n = parseInt(draft, 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(CTX_REPEAT_MAX, Math.max(1, n))
}

/**
 * Default example for (language, window size).
 * Text = full sentences taken from the length-sweep presets (indexes 6–11), so no new
 * Indic text is introduced. 512 uses the first three sentences; larger windows use all six.
 * Repeat count scales the passage up to ≈ CTX_TARGET_WORDS_PER_SLOT × window words.
 */
function ctxDefaultExample(language, windowKey) {
  const all = LENGTH_PRESETS_BY_LANGUAGE[language] ?? LENGTH_PRESETS_BY_LANGUAGE.hindi
  const sentences = all.slice(6)
  const win = CTX_WINDOWS.find((w) => w.key === windowKey) ?? CTX_WINDOWS[0]
  const text = (windowKey === 'w512' ? sentences.slice(0, 3) : sentences).join(' ')
  const words = Math.max(1, countWords(text))
  const repeat = Math.max(1, Math.round((CTX_TARGET_WORDS_PER_SLOT * win.size) / words))
  return { text, repeat }
}

/**
 * Builds the rows for the relative cost meter.
 *  source 'corpus' → total tokens over the whole evaluation corpus (from the metrics JSON)
 *  source 'input'  → token count of the simulator's passage (one pass)
 * Baseline 'auto' → the learned strategy (BPE / WordPiece / Unigram / BBPE) with the fewest tokens.
 */
function buildCostModel({ strategies, corpusByKey, tokens, source, baselineChoice }) {
  const rows = (strategies ?? []).map((s, i) => {
    const m = corpusByKey[s.key]
    let count = null
    if (source === 'corpus') {
      const t = m ? Number(m.total_tokens) : NaN
      count = Number.isFinite(t) && t > 0 ? t : null
    } else {
      const c = tokens?.[s.key]?.length
      count = typeof c === 'number' && c > 0 ? c : null
    }
    const vocab = m ? Number(m.vocab_size) : null
    return { key: s.key, index: i, count, vocab: Number.isFinite(vocab) ? vocab : null }
  })

  const valid = rows.filter((r) => r.count != null)
  if (!valid.length) return { ready: false, rows: [], baseline: null, autoBase: null }

  const learned = valid.filter((r) => LEARNED_KEYS.includes(r.key))
  const pool = learned.length ? learned : valid
  const autoBase = pool.reduce((a, b) => (b.count < a.count ? b : a))
  const chosen = baselineChoice !== 'auto' ? valid.find((r) => r.key === baselineChoice) : null
  const baseline = chosen ?? autoBase

  return {
    ready: true,
    baseline,
    autoBase,
    rows: valid.map((r) => ({ ...r, mult: r.count / baseline.count })),
  }
}

const PANEL_CARD_STYLE = {
  background: 'var(--bg-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  padding: '20px',
}

const PANEL_TITLE_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--amber)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const PANEL_DESC_STYLE = {
  fontSize: 11,
  color: 'var(--text-2)',
  marginBottom: 14,
  lineHeight: 1.45,
}

const PANEL_LABEL_STYLE = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--text-2)',
  letterSpacing: '0.08em',
}

function toggleBtnStyle(active) {
  return {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
    background: active ? 'var(--cyan-dim)' : 'transparent',
    color: active ? 'var(--cyan)' : 'var(--text-1)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
}

function PromptBudgetPanels({ language, strategies, corpusMetrics, colorList }) {
  /* ── simulator state ── */
  const [winKey, setWinKey] = useState(CTX_WINDOWS[0].key)
  const [text, setText] = useState(() => ctxDefaultExample(language, CTX_WINDOWS[0].key).text)
  const [repeatDraft, setRepeatDraft] = useState(
    () => String(ctxDefaultExample(language, CTX_WINDOWS[0].key).repeat),
  )
  /** true once the user edits the passage or repeat → window switches no longer overwrite their example */
  const [customised, setCustomised] = useState(false)
  const [tokens, setTokens] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /* ── cost meter state ── */
  const [costSource, setCostSource] = useState('corpus')
  const [costBaseline, setCostBaseline] = useState('auto')

  /* Language change → load that language's default example for the current window. */
  useEffect(() => {
    const d = ctxDefaultExample(language, winKey)
    setText(d.text)
    setRepeatDraft(String(d.repeat))
    setCustomised(false)
    setTokens(null)
    setError(null)
  }, [language])

  /* Tokenize the passage (one pass) with a short debounce. */
  useEffect(() => {
    const q = String(text ?? '').trim()
    if (!q) {
      setTokens(null)
      setLoading(false)
      setError(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(() => {
      tokenizeText(q, language)
        .then((res) => {
          if (cancelled) return
          setTokens(res.tokens)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setTokens(null)
          setError(err?.message ? String(err.message).slice(0, 200) : 'Tokenization failed')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [text, language])

  /* Metrics JSON rows keyed by strategy key (matched by name, falling back to position). */
  const corpusByKey = useMemo(() => {
    const out = {}
    ;(corpusMetrics ?? []).forEach((s, i) => {
      const k = STRATEGY_KEY_BY_NAME[s.strategy] ?? strategies?.[i]?.key
      if (k) out[k] = s
    })
    return out
  }, [corpusMetrics, strategies])

  /* ── handlers ── */
  const selectWindow = (key) => {
    setWinKey(key)
    if (!customised) {
      const d = ctxDefaultExample(language, key)
      setText(d.text)
      setRepeatDraft(String(d.repeat))
    }
  }

  const resetToDefault = () => {
    const d = ctxDefaultExample(language, winKey)
    setText(d.text)
    setRepeatDraft(String(d.repeat))
    setCustomised(false)
  }

  /* ── simulator derived values ── */
  const win = CTX_WINDOWS.find((w) => w.key === winKey) ?? CTX_WINDOWS[0]
  const repeat = parseRepeat(repeatDraft)
  const wordsPerPass = countWords(text)
  const docWords = wordsPerPass * repeat

  const simRows = (strategies ?? []).map((s, i) => {
    const perPass = tokens?.[s.key]?.length
    const ok = typeof perPass === 'number'
    const total = ok ? perPass * repeat : null
    const pct = ok ? (total / win.size) * 100 : null
    return {
      key: s.key,
      name: STRATEGY_FULL_NAME[s.key] ?? s.label ?? s.key,
      color: colorList[i % colorList.length],
      ok,
      perPass,
      total,
      pct,
      over: ok ? Math.max(0, total - win.size) : 0,
      wordsFit: ok && perPass > 0 ? Math.floor((win.size * wordsPerPass) / perPass) : null,
    }
  }).filter((r) => !HIDDEN_CONTEXT_STRATEGY_KEYS.has(r.key))
  const okSim = simRows.filter((r) => r.ok)
  const sortedSim = [...okSim].sort((a, b) => a.total - b.total)
  const learnedSim = okSim.filter((r) => LEARNED_KEYS.includes(r.key))
  const bestSim = learnedSim.length ? learnedSim.reduce((a, b) => (b.total < a.total ? b : a)) : null
  const worstSim = okSim.length ? okSim.reduce((a, b) => (b.total > a.total ? b : a)) : null

  const simInsight =
    bestSim && worstSim && worstSim.key !== bestSim.key && bestSim.total > 0
      ? `${worstSim.name} uses ${fmtPct(worstSim.pct)} of the window; the most efficient learned tokenizer (${bestSim.name}) uses ${fmtPct(bestSim.pct)} — ${(worstSim.total / bestSim.total).toFixed(2)}× the tokens for the same text.`
      : null

  /* ── cost meter derived values ── */
  const costModel = buildCostModel({
    strategies,
    corpusByKey,
    tokens,
    source: costSource,
    baselineChoice: costBaseline,
  })
  const costRows = costModel.ready
    ? costModel.rows.filter((r) => !HIDDEN_CONTEXT_STRATEGY_KEYS.has(r.key)).sort((a, b) => a.mult - b.mult)
    : []
  const maxMult = costRows.length ? Math.max(...costRows.map((r) => r.mult), 1) : 1
  const baseKey = costModel.ready ? costModel.baseline.key : null
  const baseName = baseKey ? (STRATEGY_SHORT_NAME[baseKey] ?? baseKey) : '—'
  const autoName = costModel.ready ? (STRATEGY_SHORT_NAME[costModel.autoBase.key] ?? costModel.autoBase.key) : '—'
  const worstCost = costRows.length
    ? costRows.reduce((a, b) => (b.mult > a.mult ? b : a))
    : null
  const axisTicks = [0, 25, 50, 75, 100]

  return (
    <>
      {/* ════════════ 1. CONTEXT WINDOW SIMULATOR ════════════ */}
      <div style={PANEL_CARD_STYLE}>
        <div style={PANEL_TITLE_STYLE}>Context Window Simulator</div>
        <div style={PANEL_DESC_STYLE}>
          How much of a model&apos;s context window does the same prompt consume under each tokenizer?
          Pick a window size, then edit the example (or the repeat count) to try your own text.
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ ...PANEL_LABEL_STYLE, marginRight: 4 }}>Window (tokens):</span>
          {CTX_WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => selectWindow(w.key)}
              style={toggleBtnStyle(winKey === w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--text-1)' }}>{fmtInt(win.size)} tokens</span>
          {' · '}{win.scenario}
          {' · '}{customised ? 'your example' : 'default example'}
        </div>

        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 16,
        }}>
          <span style={{ ...PANEL_LABEL_STYLE, display: 'block', marginBottom: 8 }}>EXAMPLE PASSAGE</span>
          <textarea
            value={text}
            maxLength={CTX_TEXT_MAX_CHARS}
            rows={4}
            onChange={(e) => {
              setText(e.target.value)
              setCustomised(true)
            }}
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: 64,
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-0)',
              color: 'var(--text-0)',
              fontFamily: 'var(--font-ui), sans-serif',
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...PANEL_LABEL_STYLE }}>
              Repeat passage ×
              <input
                type="number"
                min={1}
                max={CTX_REPEAT_MAX}
                value={repeatDraft}
                onChange={(e) => {
                  setRepeatDraft(e.target.value)
                  setCustomised(true)
                }}
                onBlur={() => setRepeatDraft(String(repeat))}
                style={{
                  width: 84,
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-0)',
                  color: 'var(--text-0)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              />
            </label>
            <button
              type="button"
              onClick={resetToDefault}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-1)',
                cursor: 'pointer',
              }}
            >
              Reset to default for this window
            </button>
            <span style={{ ...PANEL_LABEL_STYLE, color: 'var(--text-1)' }}>
              {fmtInt(wordsPerPass)} words × {fmtInt(repeat)} = {fmtInt(docWords)} words
            </span>
            {loading && <span style={{ ...PANEL_LABEL_STYLE, color: 'var(--amber)' }}>Tokenizing…</span>}
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 14,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--red)',
            color: 'var(--red)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            ⚠ {error}
          </div>
        )}

        {!tokens ? (
          <div style={{ padding: '18px 0', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {loading
              ? 'Tokenizing…'
              : (String(text).trim() ? 'No token counts yet.' : 'Enter a passage above to see how much of the window it uses.')}
          </div>
        ) : (
          <div>
            <div style={{ ...PANEL_LABEL_STYLE, marginBottom: 12, color: 'var(--text-2)' }}>
              {repeat === 1
                ? 'EXACT TOKEN COUNTS FOR THIS PASSAGE'
                : `ESTIMATE: TOKENS(PASSAGE) × ${fmtInt(repeat)}`}
            </div>

            {sortedSim.map((r) => {
              const over = r.pct > 100
              const fillPct = Math.min(100, r.pct)
              const pctColor = over ? 'var(--red)' : (r.pct >= 75 ? 'var(--amber)' : 'var(--green)')
              return (
                <div
                  key={r.key}
                  style={{ display: 'flex', alignItems: 'center', gap: CTX_ROW_GAP, marginBottom: 12 }}
                  title={`${r.name}\n${fmtInt(r.perPass)} tokens per passage × ${fmtInt(repeat)} = ${fmtInt(r.total)} tokens\nWindow: ${fmtInt(win.size)} tokens`}
                >
                  <div style={{
                    width: CTX_LABEL_COL,
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: r.color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {r.name}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      position: 'relative',
                      height: 22,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-2)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${fillPct}%`,
                        height: '100%',
                        background: over
                          ? 'repeating-linear-gradient(45deg, #f05050, #f05050 6px, #b83a3a 6px, #b83a3a 12px)'
                          : r.color,
                        opacity: over ? 0.95 : 0.9,
                        transition: 'width 0.25s ease',
                      }} />
                      {over && (
                        <span style={{
                          position: 'absolute',
                          right: 8,
                          top: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fff',
                          textShadow: '0 0 3px rgba(0,0,0,0.7)',
                        }}>
                          OVERFLOW +{fmtInt(r.over)} tok
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ width: CTX_STAT_COL, flexShrink: 0, textAlign: 'right', lineHeight: 1.35 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: pctColor }}>
                      {fmtPct(r.pct)}
                    </div>
                    {/* <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                      {fmtInt(r.total)} / {fmtInt(win.size)} tok
                    </div> */}
                    {/* <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                      ≈ {fmtInt(r.wordsFit)} words fit
                    </div> */}
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', alignItems: 'center', gap: CTX_ROW_GAP, marginBottom: 4, marginTop: 2 }}>
              <div style={{ width: CTX_LABEL_COL, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', height: 18, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                  {axisTicks.map((t) => (
                    <span
                      key={t}
                      style={{
                        position: 'absolute',
                        left: `${t}%`,
                        transform: t === 0 ? 'none' : (t === 100 ? 'translateX(-100%)' : 'translateX(-50%)'),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t}%
                    </span>
                  ))}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-2)',
                  textAlign: 'center',
                  marginTop: 2,
                }}>
                  ( share of the {fmtInt(win.size)}-token window used by the document )
                </div>
              </div>
              <div style={{ width: CTX_STAT_COL, flexShrink: 0 }} />
            </div>

            {simInsight && (
              <div style={{
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--amber)',
                background: 'var(--bg-2)',
                fontSize: 12,
                color: 'var(--text-1)',
                lineHeight: 1.5,
              }}>
                {simInsight}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ════════════ 2. RELATIVE COST METER ════════════ */}
      <div style={PANEL_CARD_STYLE}>
        <div style={PANEL_TITLE_STYLE}>Relative Cost Meter</div>
        <div style={PANEL_DESC_STYLE}>
          For the same text, how many times more tokens does each strategy need than the baseline?
          Context usage and per-token pricing both scale linearly with token count, so this multiplier is
          also the relative cost for any model that budgets or bills per token.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span style={PANEL_LABEL_STYLE}>Source:</span>
          <button type="button" onClick={() => setCostSource('corpus')} style={toggleBtnStyle(costSource === 'corpus')}>
            Corpus average
          </button>
          <button type="button" onClick={() => setCostSource('input')} style={toggleBtnStyle(costSource === 'input')}>
            My input (simulator)
          </button>
          <span style={{ ...PANEL_LABEL_STYLE, marginLeft: 8 }}>Baseline:</span>
          <select
            value={costBaseline}
            onChange={(e) => setCostBaseline(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-2)',
              color: 'var(--text-0)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <option value="auto">Auto: best learned ({autoName})</option>
            {(strategies ?? []).filter((s) => !HIDDEN_CONTEXT_STRATEGY_KEYS.has(s.key)).map((s) => (
              <option key={s.key} value={s.key}>{STRATEGY_SHORT_NAME[s.key] ?? s.label}</option>
            ))}
          </select>
        </div>

        {!costModel.ready ? (
          <div style={{ padding: '18px 0', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {costSource === 'input'
              ? (loading ? 'Tokenizing your input…' : 'Enter a passage in the simulator above to compare token counts for your own text.')
              : 'Corpus token totals are not available in the metrics file for this language.'}
          </div>
        ) : (
          <div>
            {worstCost && worstCost.key !== baseKey && (
              <div style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--red)',
                background: 'var(--bg-2)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>
                  {STRATEGY_SHORT_NAME[worstCost.key] ?? worstCost.key}: {worstCost.mult.toFixed(2)}× {baseName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  {costSource === 'corpus'
                    ? 'Tokens needed for the same evaluation corpus.'
                    : 'Tokens needed for your passage.'}
                </div>
              </div>
            )}

            {costRows.map((r) => {
              const isBase = r.key === baseKey
              const strategyIdx = r.index
              const color = colorList[strategyIdx % colorList.length]
              const q = r.mult <= 1.15 ? 'var(--green)' : (r.mult <= 2 ? 'var(--amber)' : 'var(--red)')
              const widthPct = (r.mult / maxMult) * 100
              return (
                <div
                  key={r.key}
                  style={{ display: 'flex', alignItems: 'center', gap: CTX_ROW_GAP, marginBottom: 12 }}
                  title={`${STRATEGY_FULL_NAME[r.key] ?? r.key}: ${r.mult.toFixed(3)}× ${baseName}\n${fmtInt(r.count)} tokens`}
                >
                  <div style={{
                    width: 104,
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {STRATEGY_SHORT_NAME[r.key] ?? r.key}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      position: 'relative',
                      height: 22,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-2)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: color,
                        opacity: 0.9,
                        transition: 'width 0.25s ease',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(1 / maxMult) * 100}%`,
                        width: 2,
                        background: 'var(--text-0)',
                        opacity: 0.85,
                      }} />
                    </div>
                  </div>

                  <div style={{ width: 230, flexShrink: 0, textAlign: 'right', lineHeight: 1.35 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: q }}>
                      {isBase ? '1.00× (baseline)' : `${r.mult.toFixed(2)}× ${baseName}`}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                      {fmtInt(r.count)} tok · vocab {r.vocab != null ? fmtInt(r.vocab) : '—'}
                    </div>
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', alignItems: 'center', gap: CTX_ROW_GAP, marginTop: 2 }}>
              <div style={{ width: 104, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', height: 18, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                  <span style={{
                    position: 'absolute',
                    left: `${(1 / maxMult) * 100}%`,
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                  }}>
                    1× = {baseName}
                  </span>
                  {maxMult > 1.6 && (
                    <span style={{ position: 'absolute', right: 0, whiteSpace: 'nowrap' }}>
                      {maxMult.toFixed(2)}×
                    </span>
                  )}
                </div>
              </div>
              <div style={{ width: 230, flexShrink: 0 }} />
            </div>

          </div>
        )}
      </div>
    </>
  )
}

export default function Analysis({ language, liveResult: _liveResult, strategies }) {
  const [corpusMetrics, setCorpusMetrics] = useState(null)
  const [sweepData, setSweepData]         = useState([])
  /** Tokens per strategy for CPT ruler (live /tokenize on applied phrase) */
  const [cptSampleTokens, setCptSampleTokens] = useState(null)
  const [cptPhraseDraft, setCptPhraseDraft] = useState(CPT_SAMPLE_BY_LANGUAGE.hindi)
  const [cptPhraseApplied, setCptPhraseApplied] = useState(CPT_SAMPLE_BY_LANGUAGE.hindi)
  const [cptTokenizeLoading, setCptTokenizeLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [activeMetric, setActiveMetric]   = useState('fertility')
  /** Left panel: tab-specific chart vs corpus aggregate bars */
  const [leftPanelChart, setLeftPanelChart] = useState('main')
  /** Legend hover: isolate one length-sweep series */
  const [activeSeries, setActiveSeries]   = useState(null)

  useEffect(() => {
    setLeftPanelChart('main')
  }, [activeMetric])
  useEffect(() => {
    setLoading(true)
    getCorpusMetrics(language)
      .then(setCorpusMetrics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [language])

  useEffect(() => {
    const phrase = CPT_SAMPLE_BY_LANGUAGE[language] ?? CPT_SAMPLE_BY_LANGUAGE.hindi
    setCptPhraseDraft(phrase)
    setCptPhraseApplied(phrase)
  }, [language])

  useEffect(() => {
    const q = String(cptPhraseApplied ?? '').trim()
    if (!q) {
      setCptSampleTokens(null)
      setCptTokenizeLoading(false)
      return undefined
    }
    let cancelled = false
    setCptTokenizeLoading(true)
    setCptSampleTokens(null)
    tokenizeText(q, language)
      .then((res) => {
        if (!cancelled) setCptSampleTokens(res.tokens)
      })
      .catch(() => {
        if (!cancelled) setCptSampleTokens(null)
      })
      .finally(() => {
        if (!cancelled) setCptTokenizeLoading(false)
      })
    return () => { cancelled = true }
  }, [cptPhraseApplied, language])

  // Length sweep line chart (one tokenize batch per preset)
  useEffect(() => {
    const presets = LENGTH_PRESETS_BY_LANGUAGE[language] ?? LENGTH_PRESETS_BY_LANGUAGE.hindi
    Promise.all(presets.map(text => tokenizeText(text, language)))
      .then(results => {
        setSweepData(
          results.map((res, i) => ({
            chars: presets[i].length,
            words: presets[i].trim().split(/\s+/).filter(Boolean).length,
          ...Object.fromEntries(
              Object.entries(res.tokens).map(([tk, v]) => [tk, v.length]),
          ),
          })),
      )
      })
      .catch(console.error)
  }, [language])

  /** Log Y-axis domain + explicit ticks; labels deduped so e.g. 4.99 and 5.01 don’t both read “5”. */
  const sweepLogYAxis = useMemo(() => {
    const keys = (strategies ?? []).map(s => s.key)
    if (!sweepData?.length || !keys.length) {
      const domain = [0.65, 12]
      const raw = buildLogAxisTicks(domain[0], domain[1])
      return { domain, ticks: dedupeLogTicksByFormattedLabel(raw, formatSweepLogTick) }
    }
    let minPos = Infinity
    let maxV = 0
    for (const row of sweepData) {
      for (const k of keys) {
        const v = row[k]
        if (typeof v !== 'number' || Number.isNaN(v)) continue
        maxV = Math.max(maxV, v)
        if (v > 0) minPos = Math.min(minPos, v)
      }
    }
    if (!isFinite(minPos)) minPos = 0.65
    if (maxV <= 0) maxV = 10
    const lo = Math.max(0.55, minPos * 0.82)
    const hi = Math.max(lo * 1.5, maxV * 1.18)
    const rawTicks = buildLogAxisTicks(lo, hi)
    const ticks = dedupeLogTicksByFormattedLabel(rawTicks, formatSweepLogTick)
    return { domain: [lo, hi], ticks }
  }, [sweepData, strategies])

  /** X = character length of preset (non-decreasing along the ladder); unique tick values only. */
  const sweepCharAxisTicks = useMemo(() => {
    if (!sweepData?.length) return undefined
    return [...new Set(sweepData.map((d) => d.chars))].sort((a, b) => a - b)
  }, [sweepData])

  /** Plot sweep with strictly positive Y values for log scale (zeros → epsilon). Sorted by `chars` so X is monotonic (word count can step backward on longer presets). */
  const sweepDataLogPlot = useMemo(() => {
    const keys = (strategies ?? []).map(s => s.key)
    const eps = 0.65
    const rows = sweepData.map(row => {
      const next = { ...row }
      for (const k of keys) {
        const v = row[k]
        if (typeof v !== 'number' || Number.isNaN(v)) continue
        next[k] = v > 0 ? v : eps
      }
      return next
    })
    return [...rows].sort((a, b) => (a.chars ?? 0) - (b.chars ?? 0) || (a.words ?? 0) - (b.words ?? 0))
  }, [sweepData, strategies])

  const renderSweepTooltip = useCallback(
    (props) => <SweepTooltipContent {...props} strategies={strategies ?? []} />,
    [strategies],
  )

  const renderSweepLegend = useCallback(
    (props) => (
      <SweepLegendContent {...props} activeSeries={activeSeries} setActiveSeries={setActiveSeries} />
    ),
    [activeSeries],
  )

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100%', color:'#fff', fontFamily:'var(--font-mono)', fontSize:13,
    }}>Loading corpus metrics…</div>
  )

  if (!corpusMetrics) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100%', color:'var(--red)', fontFamily:'var(--font-mono)', fontSize:13,
    }}>Could not load corpus metrics for {language}.</div>
  )

  // ── heatmap: column-wise min–max norm → goodness (invert where lower raw is better)
  const normalize = (metricKey, val) => {
    const vals = corpusMetrics.map(s => s[metricKey] ?? 0)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return max === min ? 0.5 : (val - min) / (max - min)
  }

  const goodness = (meta, rawVal) => {
    const n = normalize(meta.key, rawVal)
    return meta.lowerIsBetter ? 1 - n : n
  }

  const heatRows = corpusMetrics.map(s => {
    const scores = METRICS_META.map(m => goodness(m, s[m.key] ?? 0))
    const overall = scores.reduce((a, b) => a + b, 0) / scores.length
    return { strategy: s, scores, overall }
  })

  const colorList = ['#f0a832','#2dd4bf','#a78bfa','#f472b6','#4ade80','#60a5fa','#fb923c']

  const aggBarRows = corpusMetrics.map((s, idx) => {
    const dec = 3
    const raw = s[activeMetric]
    const v = typeof raw === 'number' ? raw : parseFloat(raw) || 0
    return {
      name: STRATEGY_ABBR[s.strategy] || s.strategy.slice(0, 4),
      strategyFull: s.strategy,
      value: parseFloat(v.toFixed(dec)),
      color: colorList[idx % colorList.length],
    }
  })

  const pcwStackData = corpusMetrics.map((s, idx) => {
    const pcw = Math.min(1, Math.max(0, Number(s.pcw) || 0))
    const fert = Math.max(1e-9, Number(s.fertility) || 1)
    const tw = Number(s.total_tokens) || 0
    const wordsEst = tw / fert
    const fragWords = pcw * wordsEst
    const wholeWords = Math.max(0, wordsEst - fragWords)
    return {
      name: STRATEGY_ABBR[s.strategy] || s.strategy.slice(0, 4),
      strategyFull: s.strategy,
      wholePct: (1 - pcw) * 100,
      fragPct: pcw * 100,
      wholeWords,
      fragWords,
      wordsEst,
      pcw,
      color: colorList[idx % colorList.length],
    }
  })

  const metricLabel = METRICS_META.find(m => m.key === activeMetric)?.label ?? activeMetric

  const chartCardTitle =
    activeMetric === 'pcw'
      ? 'PCW — Whole vs split words'
      : activeMetric === 'fertility'
        ? 'Fertility vs CPT'
      : activeMetric === 'nsl'
        ? `NSL — ${NSL_REF_CHARS} characters as token cells`
      : activeMetric === 'cpt'
        ? 'CPT — Bite sizes on one phrase'
      : activeMetric === 'vocab_size'
        ? 'Vocab size — All strategies'
      : `${metricLabel} — All strategies`

  const chartCardDesc =
      activeMetric === 'vocab_size'
        ? 'Size of vocabularies of each tokenizer method.'
      : (METRICS_META.find(m => m.key === activeMetric)?.desc ?? '')

  const aggregateCardTitle = 'Aggregate'
  const aggregateCardDesc = `${metricLabel} per strategy from pre-computed corpus.`

  return (
    <div style={{
      height:'100%', overflowY:'auto', padding: '28px 32px',
      '--text-1':'#fff', '--text-2':'#fff',
    }}>
      <div style={{
        fontFamily:'var(--font-display)', fontSize:26, fontWeight:700,
        color:'var(--text-0)', marginBottom: 4,
        letterSpacing:'-0.02em',
      }}>
        Corpus Analysis - How Does It Affect Prompts
        <span style={{
          fontFamily:'var(--font-mono)', fontSize:12, color:'var(--cyan)',
          marginLeft:14, fontWeight:400, letterSpacing:'0.08em',
        }}>{language.toUpperCase()}</span>
      </div>
      

      {/* ── metric selector ── */}
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        {METRICS_META.map(m => (
          <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{
            padding:'6px 16px', borderRadius:'var(--radius-sm)',
            fontFamily:'var(--font-mono)', fontSize:11,
            border:`1px solid ${activeMetric === m.key ? 'var(--cyan)' : 'var(--border)'}`,
            background: activeMetric === m.key ? 'var(--cyan-dim)' : 'transparent',
            color: activeMetric === m.key ? 'var(--cyan)' : 'var(--text-1)',
            transition:'all 0.15s',
          }}>{m.label}</button>
        ))}
      </div>
      {/* <div style={{
        fontSize: 10,
        color: 'var(--text-2)',
        lineHeight: 1.5,
        marginBottom: 20,
        maxWidth: 900,
      }}>
        <strong style={{ color: 'var(--text-1)' }}>Layout:</strong>{' '}
        Left: main chart or corpus aggregate bars (toggle). Right: strategy heatmap. Length sweep and full metrics table are full width below.
      </div> */}

      <div style={{ display:'flex', flexDirection:'column', gap:20, marginBottom:20 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 20,
          alignItems: 'stretch',
        }}>
        <div style={{
          background:'var(--bg-1)', borderRadius:'var(--radius-lg)',
          border:'1px solid var(--border)', padding:'20px',
            minWidth: 0,
        }}>
          <div style={{
            fontFamily:'var(--font-mono)', fontSize:11, color:'var(--amber)',
            letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:16,
          }}>
              {leftPanelChart === 'aggregate' ? aggregateCardTitle : chartCardTitle}
          </div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:14, lineHeight:1.45 }}>
              {leftPanelChart === 'aggregate' ? aggregateCardDesc : chartCardDesc}
          </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeMetric !== 'vocab_size' && (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', marginRight: 4 }}>View:</span>
                  <button
                    type="button"
                    onClick={() => setLeftPanelChart('main')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      border: `1px solid ${leftPanelChart === 'main' ? 'var(--cyan)' : 'var(--border)'}`,
                      background: leftPanelChart === 'main' ? 'var(--cyan-dim)' : 'transparent',
                      color: leftPanelChart === 'main' ? 'var(--cyan)' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    {activeMetric === 'pcw'
                      ? 'PCW chart'
                      : activeMetric === 'fertility'
                        ? 'Fertility vs CPT'
                        : activeMetric === 'nsl'
                          ? 'NSL chart'
                          : activeMetric === 'cpt'
                            ? 'CPT ruler'
                            : `${metricLabel} chart`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftPanelChart('aggregate')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      border: `1px solid ${leftPanelChart === 'aggregate' ? 'var(--cyan)' : 'var(--border)'}`,
                      background: leftPanelChart === 'aggregate' ? 'var(--cyan-dim)' : 'transparent',
                      color: leftPanelChart === 'aggregate' ? 'var(--cyan)' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Aggregate bars
                  </button>
                </>
              )}
            </div>

            <div style={{ minHeight: METRIC_PRIMARY_MIN_HEIGHT, display: 'flex', flexDirection: 'column' }}>
              {leftPanelChart === 'aggregate' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '100%' }}>
                    <AggregateMetricBarChart rows={aggBarRows} metricLabel={metricLabel} />
                  </div>
                </div>
              ) : (
                <>
                  {activeMetric === 'pcw' && (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={pcwStackData} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--text-1)' }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontFamily:'var(--font-mono)', fontSize:10, fill:'var(--text-2)' }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                        />
                        <Tooltip content={<PCWStackTooltip />} cursor={{ fill:'#ffffff08' }} />
                        <Legend wrapperStyle={{ fontFamily:'var(--font-mono)', fontSize:10, paddingTop: 4 }} />
                        <Bar dataKey="wholePct" stackId="pcw" fill="var(--green)" name="Whole words (est.)" />
                        <Bar dataKey="fragPct" stackId="pcw" fill="var(--amber)" name="Split words (est.)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
                  )}

                  {activeMetric === 'fertility' && (
                    <FertilityCptScatter corpusMetrics={corpusMetrics} colorList={colorList} />
                  )}

                  {activeMetric === 'nsl' && (
                    <NSLTokenCells corpusMetrics={corpusMetrics} colorList={colorList} />
                  )}

                  {activeMetric === 'cpt' && (
                    <CPTTokenRuler
                      phraseDraft={cptPhraseDraft}
                      setPhraseDraft={setCptPhraseDraft}
                      onApplyPhrase={() => {
                        const t = String(cptPhraseDraft ?? '').trim()
                        const fallback = CPT_SAMPLE_BY_LANGUAGE[language] ?? CPT_SAMPLE_BY_LANGUAGE.hindi
                        setCptPhraseApplied(t || fallback)
                      }}
                      tokensByStrategy={cptSampleTokens}
                      loadingTokens={cptTokenizeLoading}
                      strategies={strategies}
                      corpusMetrics={corpusMetrics}
                      colorList={colorList}
                    />
                  )}

                  {activeMetric === 'vocab_size' && (
                    <AggregateMetricBarChart rows={aggBarRows} metricLabel="Vocab size" />
                  )}
                </>
              )}
            </div>
        </div>

        <div style={{
          background:'var(--bg-1)', borderRadius:'var(--radius-lg)',
          border:'1px solid var(--border)', padding:'20px',
            minWidth: 0,
        }}>
          <div style={{
            fontFamily:'var(--font-mono)', fontSize:11, color:'var(--amber)',
              letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8,
            }}>Strategy profile</div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:14, lineHeight:1.45 }}>
              Per-metric column-wise normalised scores. Overall = mean of those scores.
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{
                width:'100%', borderCollapse:'separate', borderSpacing:0,
                fontFamily:'var(--font-mono)', fontSize:11,
              }}>
                <thead>
                  <tr>
                    <th style={{
                      textAlign:'left', padding:'8px 10px 10px 0',
                      color:'var(--text-2)', fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase',
                      borderBottom:'1px solid var(--border)', whiteSpace:'nowrap',
                      width: 25,
                    }}></th>
                    {METRICS_META.map(m => (
                      <th key={m.key} style={{
                        textAlign:'center', padding:'8px 8px 10px',
                        color:'var(--text-2)', fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase',
                        borderBottom:'1px solid var(--border)', minWidth:88,
                      }} title={m.desc}>{m.label}</th>
                    ))}
                    <th style={{
                      textAlign:'center', padding:'8px 0 10px 8px',
                      color:'var(--text-2)', fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase',
                      borderBottom:'1px solid var(--border)', minWidth:76,
                    }} title="Mean of column goodness scores">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {heatRows.map((row, i) => (
                    <tr key={row.strategy.strategy}>
                      <td style={{
                        padding:'10px 6px 10px 0', verticalAlign:'middle',
                        fontWeight:700, color: colorList[i % colorList.length], whiteSpace:'nowrap',
                        borderBottom:'1px solid var(--border)',
                        width: 25,
                      }} title={row.strategy.strategy}>
                        {STRATEGY_ABBR[row.strategy.strategy] || row.strategy.strategy}
                      </td>
                      {METRICS_META.map((m, j) => {
                        const raw = row.strategy[m.key] ?? 0
                        const g = row.scores[j]
                        const pct = Math.round(g * 100)
                        const dec = 3
                        const displayRaw =
                          m.key === 'vocab_size'
                            ? (typeof raw === 'number' ? Math.round(raw).toLocaleString() : String(raw))
                            : (typeof raw === 'number' ? raw.toFixed(dec) : raw)
                        return (
                          <td
                            key={m.key}
                            style={{
                              textAlign:'center', padding:8,
                              borderBottom:'1px solid var(--border)',
                              background: lerpHeatBg(g),
                              borderLeft: '1px solid var(--border)',
                              color:'var(--text-0)',
                            }}
                          >
                            <div style={{ fontSize:12, fontWeight:600, lineHeight:1.35 }}>
                              {displayRaw}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text-1)', opacity:0.95, marginTop:2 }}>
                              {pct}%
                            </div>
                          </td>
                        )
                      })}
                      <td style={{
                        textAlign:'center', padding:8,
                        borderBottom:'1px solid var(--border)',
                        background: lerpHeatBg(row.overall),
                        borderLeft: '1px solid var(--border)',
                        color:'var(--text-0)',
                      }}>
                        <div style={{ fontSize:12, fontWeight:700, lineHeight:1.35 }}>
                          {Math.round(row.overall * 100)}%
                        </div>
                        <div style={{ fontSize:9, color:'var(--text-1)', marginTop:2 }}>mean rank</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      <div style={{
        background:'var(--bg-1)', borderRadius:'var(--radius-lg)',
          border:'1px solid var(--border)', padding:'20px',
      }}>
        <div style={{
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--amber)',
          letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6,
        }}>Token Count vs Input Length</div>
        {/* <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:16 }}>
          X-axis is character length - monotonic, not word count as it can dip or stall as phrases grow.
        </div> */}
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sweepDataLogPlot} margin={{ top: 14, right: 10, bottom: 8, left: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="chars"
              domain={['dataMin', 'dataMax']}
              ticks={sweepCharAxisTicks}
              allowDecimals={false}
              label={{ value:'characters (preset)', position:'insideBottom', offset:-2, fill:'var(--text-2)', fontSize:10, fontFamily:'var(--font-mono)' }}
              tick={{ fontFamily:'var(--font-mono)', fontSize:10, fill:'var(--text-2)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              scale="log"
              domain={sweepLogYAxis.domain}
              ticks={sweepLogYAxis.ticks}
              tick={{ fontFamily:'var(--font-mono)', fontSize:10, fill:'var(--text-2)' }}
              axisLine={false}
              tickLine={false}
              width={48}
              allowDataOverflow={false}
              tickFormatter={formatSweepLogTick}
            />
            <Tooltip
              shared
              cursor={{ stroke: 'var(--cyan)', strokeWidth: 1, opacity: 0.85 }}
              content={renderSweepTooltip}
              wrapperStyle={{ outline: 'none' }}
            />
            <Legend content={renderSweepLegend} />
            {(strategies ?? []).map((s, i) => {
              const isolated = activeSeries != null
              const focused = activeSeries === s.key
              const dim = isolated && !focused ? SWEEP_DEEMPHASIS_OPACITY : 1
              const strokeWidth = focused ? 3 : 2
              const color = colorList[i % colorList.length]
              return (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={dim}
                  dot={(dotProps) => (
                    <SweepDot {...dotProps} opacity={dim} />
                  )}
                  activeDot={(dotProps) => (
                    <SweepDot {...dotProps} opacity={dim} rScale={1.4} />
                  )}
                  name={s.abbr ?? s.label}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        background:'var(--bg-1)', borderRadius:'var(--radius-lg)',
        border:'1px solid var(--border)', padding:'20px',
      }}>
        <div style={{
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--amber)',
          letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:16,
        }}>Overall Metrics </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 3px' }}>
            <thead>
              <tr> 
                {['Strategy','Fertility','NSL','CPT','PCW','Vocab','Tokens'].map(h => (
                  <th key={h} style={{
                    textAlign:'left', fontFamily:'var(--font-mono)', fontSize:10,
                    color:'var(--text-2)', letterSpacing:'0.1em', textTransform:'uppercase',
                    padding:'0 12px 10px', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpusMetrics.map((s, i) => (
                <tr key={i} style={{ background:'var(--bg-2)' }}>
                  {[
                    <td key="s" style={{
                      padding:'9px 12px', borderRadius:'var(--radius-sm) 0 0 var(--radius-sm)',
                      fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700,
                      color:colorList[i], whiteSpace:'nowrap',
                    }}>
                      {STRATEGY_ABBR[s.strategy] || s.strategy}
                    </td>,
                    ...['fertility','nsl','cpt','pcw'].map(k => (
                      <td key={k} style={{
                        padding:'9px 12px',
                        fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-1)',
                      }}>{(s[k]||0).toFixed(4)}</td>
                    )),
                    <td key="vs" style={{
                      padding:'9px 12px',
                      fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-1)',
                    }}>{(s.vocab_size||0).toLocaleString()}</td>,
                    <td key="tt" style={{
                      padding:'9px 12px', borderRadius:'0 var(--radius-sm) var(--radius-sm) 0',
                      fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-1)',
                    }}>{(s.total_tokens||0).toLocaleString()}</td>,
                  ]}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── NEW: prompt-engineering panels (context window simulator + relative cost meter) ── */}
      <PromptBudgetPanels
        language={language}
        strategies={strategies}
        corpusMetrics={corpusMetrics}
        colorList={colorList}
      />
      </div>
    </div>
  )
}