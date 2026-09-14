/**
 * 英文（`en-US`）—— **键集必须 ⊇ `zh-CN`**，由 `src/__tests__/i18n.test.ts` 强制。
 *
 * ⚠️ 新增键时**必须同时加两个文件**：只加 `zh-CN` ⇒ 英文用户看到中文（回落，可接受）；
 * 只加 `en-US` 而不加 `zh-CN` ⇒ 两侧都缺 ⇒ **裸 key**（不可接受，测试会红）。
 *
 * ⚠️ **不要翻译的专有名词**：`AED`、`CPR`、`120`（中国急救电话，保留数字，
 * 英文语境下应写成 `120` 而非 911 —— 本项目是中国境内的急救平台）。
 * `voice.ts:83-84` 会把 `A E D` / `C P R` 规整为 `AED` / `CPR`，两种语言下读字母都对。
 *
 * ⚠️ 语音整句（`rescue.voice.*`）是**朗读文本**：用自然停顿（`.` / `,`）而非中文的「。」，
 * 且**不要机翻成中式英文**。
 */
export default {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    ok: 'OK',
    retry: 'Retry',
    loading: 'Loading…',
    networkError: 'Network error. Please try again later.',
    languageZh: '简体中文',
    languageEn: 'English',
  },

  voice: {
    cprNumbers: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    /** Human-rescue breath count, first utterance (zh counterpart: '一零零一'). */
    breathStart: 'one zero zero one',
  },

  /** `pages/rescue/index.vue` — the SOS emergency flow (see zh-CN for the HTML/`v-html` notes). */
  rescue: {
    title: 'Emergency Rescue',
    banner: {
      title: 'Drill Mode',
      sub: 'This is a walkthrough — 120 will not actually be called',
      compact: 'Drill · 120 will not be called',
    },

    decision: {
      tag: { drill: 'DRILL · Learn the CPR flow', real: 'EMERGENCY · The golden 4 minutes' },
      main: 'Someone collapsed and unresponsive?',
      sub: 'Breathe. You are not alone in this.',
      start: { drill: 'Start CPR Drill', real: 'Start CPR Now' },
      startSub: { drill: 'Full walkthrough · Simulated AED team dispatch', real: 'Auto-calls 120 + dispatches the AED team' },
      autoLabel: { drill: 'Drill mode · The system will simulate:', real: 'Within 5 seconds of tapping, the system will:' },
      other: 'Other emergencies',
      legalSave: '🛡 Good Samaritan protection',
      legalLaw: 'Civil Code, Art. 184',
    },

    auto: {
      call120: 'Call 120',
      call120Drill: 'Simulate calling 120',
      volunteers: 'Call volunteers',
      volunteersDrill: 'Simulate calling volunteers',
      aed: 'Dispatch AED',
      aedDrill: 'Simulate AED dispatch',
    },

    steps: {
      labels: ['Call', 'Check', 'Breathe', 'Compress', 'Ventilate'],
    },

    guides: {
      heimlich: { title: 'Choking', desc: 'Heimlich maneuver' },
      bleeding: { title: 'Severe bleeding', desc: 'Apply pressure and dress the wound' },
      fracture: { title: 'Fracture / trauma', desc: 'Immobilize in place to avoid further injury' },
      transport: { title: 'Moving a casualty', desc: 'Spinal-injury handling technique' },
      psychological: { title: 'Emergency psychological care', desc: 'Calm them and redirect their attention' },
    },

    stepTitle: {
      s1: 'Step 1 · Call for help',
      s2: 'Step 2 · Check response',
      s3: 'Step 3 · Check breathing',
      s4: 'Step 4 · Chest compressions',
      s5: 'Step 5 · Rescue breaths',
      aed: 'AED engaged',
      loop: 'Cycle · Keep going',
      ongoing: 'CPR in progress',
    },

    step1: {
      action: { drill: 'Drill · Simulating dispatch', real: 'Dispatching · Just get ready to compress' },
      quote: '"Help is on the way! Clear the area, get ready to compress!"',
      taskCall: { drill: '[Drill] Simulating a call to 120', real: '120 called automatically' },
      taskCallSubDrill: '(no real call will be made)',
      taskCallSubReal: 'Your exact location has been sent',
      taskVolunteers: { drill: '[Drill] Simulating notice to volunteers within 5km', real: '8 volunteers within 5km notified' },
      taskVolunteersSub: 'Nearest simulated distance 240m · ETA 3 min',
      taskTeam: { drill: '[Drill] 3 volunteer roles assigned (simulated)', real: 'A 3-person volunteer team has split up and responded' },
      taskTeamSub: 'Compressor 240m · AED 100m · Recorder 310m',
      taskHelper: 'Tap here · get a bystander to scan and help',
      detail: {
        drill: '<strong style="color:#FF8B5B;">This is a drill — no real resources will be dispatched</strong> Follow the voice prompts to practice the full CPR sequence.<br>Put your phone down and get ready to start compressions with the voice guidance.',
        real: '<strong style="color:#FF8B5B;">You do not need to find an AED yourself</strong> The system has dispatched the compressor, AED and recorder roles in sync.<br>Put your phone down and get ready to start compressions with the voice guidance.',
      },
      start: 'Called for help · Start now',
    },

    step2: {
      action: 'Check response · 5s',
      quote: '"Hey! Are you okay?"',
      detail: 'Tap both shoulders and shout loudly into their ear. Watch for any response.',
      pause: 'Responsive · Pause',
    },

    step3: {
      action: 'Check breathing · Count 7s',
      detail: 'Put your face near their mouth and nose; watch the chest rise and listen for breathing.',
      pause: 'Breathing normally · Pause',
    },

    cpr: {
      totalLabel: 'Elapsed',
      roundLabel: 'This set',
      roundsLabel: 'Sets done',
      pressNumIdle: 'Ready',
      pressLabel: {
        idle: 'Tap the circle to reset',
        hint: 'Press along with the number',
        reset: 'Reset',
      },
      keyNum: 'Compression tips',
      keyText: 'Stack your palms · lower half of the sternum · press 5–6cm',
      keyDetail: 'Keep your arms <strong style="color:#FF8B5B;">straight</strong> and use your upper body weight.',
      callHelper: 'Get help',
      aedReady: 'AED connected',
      media: 'Photo/video · send the scene to 120',
    },

    aed: {
      label0: 'AED analyzing · Stop compressions',
      label1: 'Shock advised · Stand clear again',
      label2: 'Shock delivered · Resume compressions now',
      quote0: 'Everyone stand clear!',
      quote1: '"Stand clear! Press the shock button!"',
      quote2: '"Start compressions now!"',
      detail2: 'Shock delivered. <strong style="color:#FF8B5B;">Do not wait for a heartbeat</strong> — restart from 1 and give 30 compressions.',
      cancel: 'Cancel · Resume compressions',
    },

    vent: {
      actionLabel: 'Rescue breaths · {round} / 2',
      round1: 'Breath 1',
      round2: 'Breath 2',
      s1: { title: 'Tilt head, lift chin', sub: 'Open the airway' },
      s2: { title: 'Check the mouth', sub: 'Clear any visible obstruction' },
      s3: { title: 'Pinch the nose', sub: 'Seal mouth-to-mouth' },
      s4: { title: 'Give one breath', sub: 'Until the chest rises' },
    },

    loop: {
      actionLabel: 'Completed {rounds} CPR cycles',
      quote: 'Continue 30 compressions + 2 rescue breaths',
      detail: 'Keep cycling until the 120 paramedics arrive. <strong style="color:#FF8B5B;">Do not stop!</strong>',
      start: 'Start the next set',
    },

    confirm: {
      title: { drill: '⚠️ Drill mode · Disclaimer', real: '⚠️ Liability & consent' },
      drillTitle: 'This is a drill — 120 will not actually be called',
      drillDesc: 'Relax and follow the voice prompts to practise the full flow',
      body: {
        drill: 'You are about to enter a CPR practice drill. The system will simulate calling 120 and notifying nearby volunteers to help you learn every step of a real emergency.',
        real: 'You are about to start a real emergency rescue. The system will automatically call 120, notify nearby volunteers, and record the time and account of this trigger for anti-abuse purposes (your exact location is not recorded).',
      },
      check: {
        drill: 'I understand this is a drill and 120 will not actually be called',
        real: 'I have read and understood the Good Samaritan Disclaimer',
      },
      lawSuffix: ' (Civil Code, Article 184)',
      start: { drill: 'Start CPR drill', real: 'Confirm & start CPR' },
    },

    toast: {
      drillCall: 'Drill mode · 120 will not actually be called',
      calling: 'Calling 120...',
      drillPaused: 'Drill paused',
      paused: 'Paused',
      abortedWithReason: '{state}: {reason}',
      reason: {
        responded: 'responsive',
        breathing: 'breathing normally',
      },
    },

    voice: {
      step1Drill: 'Drill mode. Dispatch simulated. Clear the area, get ready to compress.',
      step1: 'Help is on the way. Clear the area, get ready to compress.',
      step2: 'Tap both shoulders and shout loudly into their ear. Watch for any response.',
      aed0: 'Everyone stand clear. The AED is analyzing the heart rhythm.',
      aed1: 'Stand clear. Press the shock button.',
      step5: 'Tilt the head back and lift the chin to open the airway. Check the mouth and clear any visible obstruction. Pinch the nose, seal your mouth over theirs, and give one breath.',
      loop: 'Keep going — thirty compressions, then two rescue breaths. Do not stop.',
    },
  },
}
