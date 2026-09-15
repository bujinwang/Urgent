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
      main: 'Someone has collapsed and is unresponsive?',
      sub: 'Breathe. You are not alone in this.',
      start: { drill: 'Start CPR drill', real: 'Start CPR Now' },
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
        drill: '<strong style="color:#FF8B5B;">This is a drill — no real resources will be dispatched</strong>. Follow the voice prompts to practice the full CPR sequence.<br>Put your phone down and get ready to start compressions with the voice guidance.',
        real: '<strong style="color:#FF8B5B;">You do not need to find an AED yourself</strong>. The system has dispatched the compressor, AED and recorder roles in sync.<br>Put your phone down and get ready to start compressions with the voice guidance.',
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
      drillDesc: 'Relax and follow the voice prompts to practice the full flow',
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
      loop: 'Keep going. Thirty compressions, then two rescue breaths. Do not stop.',
    },
  },

  /** `pages/guide/index.vue` — the step-by-step first-aid guide page (see zh-CN for the `rescue.guides` note). */
  guide: {
    stepTag: 'Step {n}',
    navPrev: '← Previous step',
    navNext: 'Next →',
    navDone: '✓ Done',
    warnToggle: '⚠️ Warnings',
    call: 'Call 120',
    legal: '🛡 Good Samaritan protection · Civil Code, Art. 184',
    toastCalling: 'Demo mode: calling 120...',
    /** Spoken whole sentence: zh joins with「，」, en with ', ' — never concatenate in code. */
    voice: {
      step: '{title}, {detail}',
    },
    guides: {
      bleeding: {
        title: 'Severe bleeding',
        steps: {
          s1: { title: 'Apply direct pressure', detail: 'Press hard on the wound with clean gauze or a towel' },
          s2: { title: 'Elevate the injured part', detail: 'Raise the bleeding area above heart level' },
          s3: { title: 'Bandage under pressure', detail: 'Wrap firmly with a bandage, but not too tight' },
          s4: { title: "Don't remove soaked dressings", detail: 'Add new layers on top; do not peel off the old ones' },
          s5: { title: 'Tourniquet (last resort)', detail: 'Apply 5-7cm above the wound on the heart side and note the time' },
        },
        warnings: ['Wear gloves or plastic bags; avoid direct contact with blood', 'If an object is embedded, do not pull it out — pad around it and immobilize', 'Watch face color and breathing closely; tell 120 about any signs of shock'],
      },
      heimlich: {
        title: 'Choking',
        steps: {
          s1: { title: 'Confirm choking', detail: 'They cannot speak, clutch their throat, and their face turns blue' },
          s2: { title: 'Stand behind and wrap your arms', detail: 'Make a fist with one hand and place it two fingers above the navel' },
          s3: { title: 'Thrust upward into the abdomen', detail: 'Grab your fist with the other hand and thrust quickly in and up ×5' },
          s4: { title: 'Check the mouth', detail: 'After each thrust, look in the mouth and remove any object' },
          s5: { title: 'Alternate and repeat', detail: '5 thrusts + a mouth check, repeat until the object is expelled' },
          s6: { title: 'Unconscious → CPR', detail: 'Lay them flat, start chest compressions immediately and call 120' },
        },
        warnings: ['For pregnant or obese casualties, use chest thrusts (fist on the mid-sternum)', 'Infants: alternate 5 back slaps + 5 chest thrusts', 'If they can cough, encourage coughing — do not intervene'],
      },
      fracture: {
        title: 'Fracture / trauma',
        steps: {
          s1: { title: 'Do not move the casualty', detail: 'Keep them still unless there is immediate danger at the scene' },
          s2: { title: 'Splint it', detail: 'Use a board or magazine to splint the joints above and below the fracture' },
          s3: { title: 'Pad for cushioning', detail: 'Pad between the splint and the body with clothing to avoid pressure' },
          s4: { title: 'Sling the upper limb', detail: 'For an arm fracture, sling it with a triangular bandage and keep it level' },
          s5: { title: 'Cool to reduce swelling', detail: 'Apply an ice pack around the injury, 15-20 minutes at a time' },
        },
        warnings: ['Suspected spinal injury: never move them! Keep head, neck and torso in a straight line', 'Open fracture: do not try to push the bone back in', 'Do not give food or drink (surgery may be needed)'],
      },
      transport: {
        title: 'Moving a casualty',
        steps: {
          s1: { title: 'Assess scene safety', detail: 'Make sure you are safe first; only move them when necessary' },
          s2: { title: 'Immobilize head and neck', detail: 'One person cups the ears with both hands, keeping head, neck and torso aligned' },
          s3: { title: 'Roll together', detail: 'One person calls the count; everyone rolls the casualty as a unit along the axis' },
          s4: { title: 'Transfer onto a rigid board', detail: 'Place a door or tabletop against one side and roll them onto it along the axis' },
          s5: { title: 'Secure the whole body', detail: 'Strap forehead → chest → pelvis → thighs → lower legs' },
        },
        warnings: ['With a spinal injury, never: sit them up, lift them, or raise the head and legs', 'Keep the move smooth and avoid jolting', 'Watch breathing and consciousness closely and be ready for CPR'],
      },
      psychological: {
        title: 'Emergency psychological care',
        steps: {
          s1: { title: 'Make them safe', detail: 'Move them away from danger and meet basic needs (water, warmth)' },
          s2: { title: 'Approach gently', detail: 'Use a calm tone, introduce yourself, crouch to their eye level' },
          s3: { title: 'Listen without interrupting', detail: 'Allow all emotions; do not say "stop crying" or "be strong"' },
          s4: { title: 'Give certain information', detail: 'Tell them what is happening, who is helping, and what comes next' },
          s5: { title: 'Redirect attention', detail: 'Deep breaths → clench and release fists → name 3 things you can see' },
        },
        warnings: ['Do not force them to recall traumatic details', 'Do not make promises you cannot keep', 'If severe psychiatric symptoms appear, protect yourself and get help'],
      },
      seizure: {
        title: 'Seizure first aid',
        steps: {
          s1: { title: 'Stay calm and time it', detail: 'Note when the seizure starts. If it lasts over 5 minutes, call 120' },
          s2: { title: 'Clear dangerous objects', detail: 'Move away sharp or hard objects and pad under the head' },
          s3: { title: 'Do not restrain them', detail: 'Do not hold the limbs, do not stop the convulsions, do not put anything in the mouth' },
          s4: { title: 'Recovery position', detail: 'Once the convulsions stop, turn them on their side to let secretions drain' },
          s5: { title: 'Stay beside them', detail: 'They may be confused afterward — reassure them calmly' },
        },
        warnings: ['Never put anything in their mouth', 'Do not force water or medicine', 'Over 5 minutes / repeated seizures / in water / pregnant / first-ever → 120'],
      },
    },
  },

  /** `pages/aed/index.vue` — the standalone AED explorer map page (distinct from the inline `rescue.aed` phase). */
  aed: {
    drillBanner: 'Drill mode · Explore AEDs and pick one up anytime',
    home: 'Home',
    explorerTier: 'Explorer',
    tier: { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', diamond: 'Diamond' },
    progress: '{discovered} / {total} discovered',
    nearby: '{count} AED nearby',
    radarTitle: '🔭 Nearby radar',
    status: { available: 'Available', maintenance: 'Maintenance' },
    viewDetail: 'View details',
    checkIn: '📸 Check in',
    outdoor: 'Outdoor',

    /** `pages/aed/detail.vue` — the AED device detail page (see zh-CN for the D3/D6 boundary notes). */
    detail: {
      outdoor: 'Outdoor',
      nav: 'Navigate',
      checkin: 'Check in',
      retake: 'Retake',
      checkinFormTitle: '📋 Check-in details',
      checkinPhotoTitle: '📸 Taking photo…',
      statusOk: '✅ Device OK',
      statusIssue: '⚠️ Has a problem',
      tipLabel: '💡 Location hint (helps others find it fast)',
      tipPlaceholder: 'e.g. Enter from the south gate, green box left of the guard booth…',
      submit: 'Submit check-in',
      howToFind: '🔍 How to find it',
      deviceInfo: '🔬 Device info',
      label: {
        model: 'Model',
        serial: 'Serial no.',
        batteryExpiry: 'Battery expiry',
        electrodeExpiry: 'Pad expiry',
        lastMaintenance: 'Last maintenance',
        lastCheck: 'Last check-in',
      },
      custodian: {
        title: '👤 Device custodian',
        avatarFallback: 'R',
        nameFallback: 'Registered custodian',
        roleFallback: 'Contact shown after authorization',
        notify: '📞 Notify custodian',
      },
      link: {
        title: '📣 Custodian coordination',
        pickup: 'Log pickup (take first, record later)',
        statusLabel: 'Status',
        countdownLabel: 'Countdown',
        confirmPickup: 'Confirm pickup',
        withdraw: 'Withdraw data sharing',
        note: '"Confirm authorization" only means the custodian is aware and agrees to the pickup — it does not change the device status remotely.',
        noCustodian: 'This device has no custodian — you can take it and log the pickup.',
      },
      timeline: {
        title: '📋 Check-in records ({n})',
        ok: '✅ OK',
        issue: '⚠️ Has a problem',
        emptyTitle: '📋 Check-in records',
      },
      empty: {
        title: 'No check-in records yet',
        sub: 'Be the first rescuer to verify this AED!',
      },
      status: {
        maintenance: '🔧 Maintenance',
        verified: '✅ Verified',
        discovered: '📍 Discovered',
        available: '⚡ Available',
      },
      ca: {
        sent: 'Custodian notified — waiting for authorization',
        pending: 'Notifying the custodian…',
        unreachable: 'Custodian unreachable (awaiting their confirmation)',
        acknowledged: 'Custodian authorized — please take the AED',
        rejected: 'Custodian declined — you can take it and log the pickup',
        expired: 'Custodian did not respond in time — you can take it and log the pickup',
        timeout: 'Timed out',
      },
      consent: {
        title: 'Data-sharing consent',
        content: 'To help coordinate on-scene first aid, your name and location will be shared with this AED custodian. You can withdraw anytime from the request details. Do you agree?',
        confirm: 'Agree',
      },
      notFound: {
        title: 'Device not found',
        sub: 'This AED may have been removed or the link is invalid',
        back: 'Back to the AED map',
      },
      toast: {
        cameraDenied: 'Camera permission not granted',
        checkinOk: '✅ Check-in succeeded +30⭐',
        checkinIssue: '⚠️ Problem reported +15⭐',
        consentCancelled: 'Cancelled — you can take the AED directly',
        notified: 'Custodian notified',
        consentRequired: 'Please agree to data sharing first',
        notifyFailed: 'Notification failed',
        pickupOk: 'Pickup logged — please take the device soon',
        pickupFailed: 'Failed to log the pickup — please take the device directly',
        withdrawOk: 'Data sharing withdrawn',
        withdrawFailed: 'Withdrawal failed',
      },
    },
  },

  /** `pages/drill/index.vue` — the first-aid drill list page (see zh-CN for the D6 boundary note). */
  drill: {
    title: 'First-Aid Drill',
    tab: { upcoming: 'Upcoming', completed: 'Completed', records: 'Records' },
    join: '🤝 Join',
    complete: '✅ Complete drill',
    status: { upcoming: 'Upcoming', completed: 'Completed' },
    scenario: {
      cpr: 'CPR resuscitation',
      aed: 'AED use',
      trauma: 'Trauma first aid',
      choking: 'Choking',
      mass: 'Mass casualty',
    },
    participants: '{current}/{max} people',
    pointsReward: '🎁 +{points} pts',
    recordTrained: 'Completed',
    organizerLine: 'Organizer: {name}',
    empty: { completed: 'No completed drills yet', upcoming: 'No drills yet', records: 'No training records yet' },
    form: {
      title: 'Create drill',
      label: {
        title: 'Title',
        description: 'Description',
        scenario: 'Scenario',
        date: 'Date',
        location: 'Location',
        maxParticipants: 'Capacity',
      },
      defaultLocation: 'Shenzhen Bay Park',
      submit: 'Create',
    },
    toast: { joined: 'Joined', pointsAwarded: 'Points awarded', created: 'Created' },
  },
}
