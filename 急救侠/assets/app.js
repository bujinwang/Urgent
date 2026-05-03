<script>
// ============ 通用浮层控制 ============
function openSheet(title, content) {
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('bottom-sheet').classList.add('active');
  // 禁止背景滚动
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('bottom-sheet').classList.remove('active');
  document.body.style.overflow = '';
}

function simulateScan() {
  const content = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <div style="font-family:var(--serif);font-size:22px;font-weight:700;margin-bottom:8px;">路人扫描成功</div>
      <div style="font-size:14px;color:var(--ink-soft);line-height:1.6;margin-bottom:24px;">
        对方手机已进入<strong>“路人协助模式”</strong>。系统正引导其进行视频连线指路。
      </div>
      <div style="background:var(--green-soft);padding:14px;border-radius:12px;margin-bottom:24px;display:flex;align-items:center;gap:10px;text-align:left;">
        <div style="width:10px;height:10px;background:var(--green);border-radius:50%;animation:blink 1.2s infinite;"></div>
        <div style="font-size:12px;color:var(--green);font-weight:700;">协作连接已建立 · 视频信号收信中</div>
      </div>
      <button onclick="closeSheet()" style="width:100%;background:var(--ink);color:white;border:none;padding:16px;border-radius:14px;font-weight:700;">知道了</button>
    </div>
  `;
  openSheet('系统通知', content);
  speak('路人已加入协助，正在开启视频指路');
}

// ============ 急救图谱详情 ============
const ATLAS_DATA = {
  cpr: {
    title: '心脏骤停急救',
    content: `
      <div style="background:var(--rescue-red-soft);padding:14px;border-radius:12px;margin-bottom:16px;color:var(--rescue-red);font-size:13px;display:flex;gap:10px;align-items:center;">
        <span style="font-size:20px;">⚡</span>
        <strong>黄金 4 分钟：</strong> 每延迟 1 分钟，存活率下降 10%。
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--rescue-red);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">1</div>
          <div style="font-size:14px;">确认环境安全，拍肩呼喊确认无意识。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--rescue-red);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">2</div>
          <div style="font-size:14px;">指派专人拨打 120 并寻找附近的 AED。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--rescue-red);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">3</div>
          <div style="font-size:14px;">立即开始胸外按压：两乳头连线中点，深度 5-6cm，频率 100-120次/分。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--rescue-red);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">4</div>
          <div style="font-size:14px;">配合 AED：一旦 AED 到达，立即开机并按语音提示操作。</div>
        </div>
      </div>
      <button onclick="closeSheet();goPage('cpr-rhythm')" style="width:100%;background:var(--rescue-red);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">立即开始节拍训练 →</button>
    `
  },
  choking: {
    title: '异物窒息 (海姆立克)',
    content: `
      <div style="background:var(--paper-warm);padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.5;">
        <strong>典型体征：</strong> 患者无法说话、无法咳嗽、皮肤发紫，双手抓喉（海姆立克征）。
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--gold);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">1</div>
          <div style="font-size:14px;">站在患者背后，双臂环抱其腰部。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--gold);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">2</div>
          <div style="font-size:14px;">一手握拳，大拇指侧放在患者肚脐上方两横指处。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--gold);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">3</div>
          <div style="font-size:14px;">另一手握住此拳，快速向内、向上冲击腹部。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--gold);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">4</div>
          <div style="font-size:14px;">重复直到异物排出或患者失去意识。</div>
        </div>
      </div>
      <button onclick="closeSheet();goPage('train-heimlich')" style="width:100%;background:var(--gold);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">查看分人群详细手法 →</button>
    `
  },
  aed: {
    title: 'AED 使用指引',
    content: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:var(--paper-warm);padding:12px;border-radius:12px;text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">🔌</div>
          <div style="font-size:11px;font-weight:700;">自动开机</div>
        </div>
        <div style="background:var(--paper-warm);padding:12px;border-radius:12px;text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">🗣️</div>
          <div style="font-size:11px;font-weight:700;">听从语音</div>
        </div>
      </div>
      <div style="font-size:14px;line-height:1.6;color:var(--ink-soft);">
        <p style="margin-bottom:8px;">1. <strong>开机：</strong> 揭开盖子即可自动开机。</p>
        <p style="margin-bottom:8px;">2. <strong>贴片：</strong> 按照图示将电极片贴在患者裸露胸部（右上+左下）。</p>
        <p style="margin-bottom:8px;">3. <strong>分析：</strong> 机器分析心律时，确保没有人触碰患者。</p>
        <p style="margin-bottom:8px;">4. <strong>电击：</strong> 若机器提示建议电击，确保周围人离开，按下闪烁按钮。</p>
        <p style="margin-top:12px;padding:10px;background:var(--rescue-red-soft);border-radius:8px;font-size:12px;color:var(--rescue-red);"><strong>注意：</strong> AED 必须配合 CPR 使用。在电击前后都应尽可能保持按压。</p>
      </div>
      <button onclick="closeSheet();goPage('train-aed')" style="width:100%;background:var(--rescue-red);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">模拟设备操作训练 →</button>
    `
  },
  bleeding: {
    title: '出血止血处理',
    content: `
      <div style="background:var(--paper-warm);padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.5;">
        <strong>止血原则：</strong> 优先使用直接加压止血法。
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:#EF4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">1</div>
          <div style="font-size:14px;"><strong>加压：</strong> 用干净敷料直接覆盖伤口并持续加压。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:#EF4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">2</div>
          <div style="font-size:14px;"><strong>包扎：</strong> 用绷带加压包扎，不要过紧影响血液循环。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:#EF4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">3</div>
          <div style="font-size:14px;"><strong>止血带：</strong> 仅在四肢大动脉出血且加压无效时使用，记录使用时间。</div>
        </div>
      </div>
      <button onclick="closeSheet();goPage('learn')" style="width:100%;background:#EF4444;color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">学习包扎教学视频 →</button>
    `
  },
  fracture: {
    title: '骨折固定与搬运',
    content: `
      <div style="background:var(--paper-warm);padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.5;">
        <strong>核心禁忌：</strong> 怀疑脊柱受损时，绝对禁止随意搬动患者。
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--silver);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">1</div>
          <div style="font-size:14px;"><strong>制动：</strong> 减少伤处活动，不要试图复位断骨。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--silver);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">2</div>
          <div style="font-size:14px;"><strong>固定：</strong> 利用夹板、木棍或躯干健肢进行临时固定。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--silver);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">3</div>
          <div style="font-size:14px;"><strong>搬运：</strong> 必须移动时，采用“平托法”或“滚动法”，保持身体轴线一致。</div>
        </div>
      </div>
      <button onclick="closeSheet();goPage('learn')" style="width:100%;background:var(--ink-soft);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">查看搬运手法图解 →</button>
    `
  },
  epilepsy: {
    title: '癫痫（羊角风）急救',
    content: `
      <div style="background:var(--paper-warm);padding:14px;border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.5;">
        <strong>错误做法：</strong> 不要往嘴里塞任何东西（包括毛巾、手指），不要强行按压肢体。
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--diamond);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">1</div>
          <div style="font-size:14px;"><strong>保护：</strong> 移走周围尖锐物体，垫软物在头下。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--diamond);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">2</div>
          <div style="font-size:14px;"><strong>顺畅呼吸：</strong> 解开衣领，抽搐停止后将患者转为侧卧位。</div>
        </div>
        <div style="display:flex;gap:14px;">
          <div style="width:28px;height:28px;background:var(--diamond);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">3</div>
          <div style="font-size:14px;"><strong>记录：</strong> 观察发作持续时间。若超过5分钟请立即送医。</div>
        </div>
      </div>
      <button onclick="closeSheet();" style="width:100%;background:var(--diamond);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:24px;">知道了</button>
    `
  }
};

function showAtlasDetail(id) {
  const data = ATLAS_DATA[id];
  if (data) {
    openSheet(data.title, data.content);
  } else {
    alert('演示：更多急救知识正在完善中');
  }
}

// ============ 场景模拟系统 ============
const SCENARIO_STEPS = {
  subway: [
    {
      q: '你在地铁站看到一名男子突然倒地，周围人群开始围观。你第一步该做什么？',
      options: [
        { text: '立即拨打 120', feedback: '对，但首先要确认现场安全并检查患者。', correct: false },
        { text: '拍肩呼喊并确认环境安全', feedback: '正确！确保自己安全是救人的前提。', correct: true },
        { text: '立即开始胸外按压', feedback: '太快了，先确认患者是否真的需要 CPR。', correct: false }
      ]
    },
    {
      q: '你确认现场安全，患者无意识且无呼吸。周围有人想帮忙但很慌乱，你该怎么办？',
      options: [
        { text: '请路人去找附近的 AED 并打 120', feedback: '完全正确！分工明确能极大提高效率。', correct: true },
        { text: '让路人走开，不要围观', feedback: '围观确实不好，但此时更需要路人的协助。', correct: false },
        { text: '自己一边打 120 一边按压', feedback: '这会让你精疲力竭且效率低下。', correct: false }
      ]
    },
    {
      q: '你已经按压了 2 分钟，感觉体力不支，此时另一名路人说他学过急救，想接替你。',
      options: [
        { text: '拒绝他，坚持到 120 到达', feedback: '疲劳会导致按压质量下降，应该接受接力。', correct: false },
        { text: '立即停下让他接手', feedback: '按压中断不能超过 10 秒，需有节奏地切换。', correct: false },
        { text: '在完成 30 次按压后快速切换', feedback: '正确！利用人工呼吸间隙快速切换，保证质量。', correct: true }
      ]
    }
  ]
};

let currentScenarioId = '';
let currentScenarioStep = 0;
let scenarioScore = 0;

function startScenario(id) {
  currentScenarioId = id;
  currentScenarioStep = 0;
  scenarioScore = 0;
  renderScenarioStep();
}

function renderScenarioStep() {
  const step = SCENARIO_STEPS[currentScenarioId][currentScenarioStep];
  const total = SCENARIO_STEPS[currentScenarioId].length;
  
  let html = `
    <div style="font-size:12px;color:var(--ink-mute);margin-bottom:12px;font-family:var(--mono);">
      SCENARIO · ${currentScenarioStep + 1} / ${total}
    </div>
    <div style="font-family:var(--serif);font-size:18px;font-weight:700;line-height:1.5;margin-bottom:24px;">
      ${step.q}
    </div>
    <div id="scenario-options">
  `;
  
  step.options.forEach((opt, idx) => {
    html += `
      <button class="scenario-opt" onclick="checkScenarioAnswer(${idx})">
        <div class="scenario-opt-idx">${String.fromCharCode(65 + idx)}</div>
        <div style="font-size:14px;">${opt.text}</div>
      </button>
    `;
  });
  
  html += `</div><div id="scenario-feedback" class="scenario-feedback"></div>`;
  
  openSheet('情境挑战：地铁站救援', html);
}

function checkScenarioAnswer(idx) {
  const step = SCENARIO_STEPS[currentScenarioId][currentScenarioStep];
  const opt = step.options[idx];
  const feedbackEl = document.getElementById('scenario-feedback');
  const optionsEl = document.getElementById('scenario-options');
  
  // 禁用所有按钮
  optionsEl.querySelectorAll('button').forEach(btn => btn.style.pointerEvents = 'none');
  
  feedbackEl.textContent = opt.feedback;
  feedbackEl.className = 'scenario-feedback ' + (opt.correct ? 'correct' : 'wrong');
  
  if (opt.correct) scenarioScore++;
  
  // 添加继续按钮
  const nextBtn = document.createElement('button');
  const isLast = currentScenarioStep === SCENARIO_STEPS[currentScenarioId].length - 1;
  nextBtn.textContent = isLast ? '查看最终评价 →' : '进入下一步 →';
  nextBtn.style = 'width:100%;background:var(--ink);color:white;border:none;padding:16px;border-radius:14px;font-family:var(--serif);font-size:15px;font-weight:700;margin-top:10px;';
  nextBtn.onclick = isLast ? showScenarioResult : () => {
    currentScenarioStep++;
    renderScenarioStep();
  };
  feedbackEl.appendChild(nextBtn);
}

function showScenarioResult() {
  const total = SCENARIO_STEPS[currentScenarioId].length;
  const grade = scenarioScore === total ? 'S · 完美处置' : scenarioScore >= total/2 ? 'A · 表现良好' : 'B · 仍需练习';
  const color = scenarioScore === total ? 'var(--green)' : 'var(--rescue-red)';
  
  let html = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-family:var(--serif);font-size:64px;font-weight:900;color:${color};line-height:1;margin-bottom:12px;">
        ${scenarioScore}/${total}
      </div>
      <div style="font-family:var(--serif);font-size:24px;font-weight:700;margin-bottom:8px;">${grade}</div>
      <div style="font-size:14px;color:var(--ink-soft);line-height:1.6;margin-bottom:24px;">
        在紧急情况下保持冷静是关键。您的决策能为抢救赢得宝贵时间。建议定期进行此类模拟练习。
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="startScenario('${currentScenarioId}')" style="flex:1;background:var(--paper-warm);color:var(--ink);border:none;padding:14px;border-radius:14px;font-weight:700;">再试一次</button>
        <button onclick="closeSheet()" style="flex:1;background:var(--rescue-red);color:white;border:none;padding:14px;border-radius:14px;font-weight:700;">获得 +100 积分</button>
      </div>
    </div>
  `;
  
  openSheet('挑战结算', html);
}

// ============ 学习训练 tab 切换 ============
function switchLearnTab(tab) {
  const knowledgeContent = document.getElementById('learn-content-knowledge');
  const trainingContent = document.getElementById('learn-content-training');
  const knowledgeTab = document.getElementById('learn-tab-knowledge');
  const trainingTab = document.getElementById('learn-tab-training');

  if (tab === 'knowledge') {
    knowledgeContent.style.display = '';
    trainingContent.style.display = 'none';
    knowledgeTab.classList.add('learn-tab-active');
    trainingTab.classList.remove('learn-tab-active');
  } else {
    knowledgeContent.style.display = 'none';
    trainingContent.style.display = '';
    knowledgeTab.classList.remove('learn-tab-active');
    trainingTab.classList.add('learn-tab-active');
  }
}

// ============ CPR 节拍训练 ============
let rhythmActive = false;
let rhythmCount = 0;
let rhythmTimestamps = [];  // 每次按压的时间戳
let rhythmStartTime = 0;

function startRhythmTraining() {
  initAudio();
  rhythmActive = true;
  rhythmCount = 0;
  rhythmTimestamps = [];
  rhythmStartTime = Date.now();

  // 切换UI
  document.getElementById('rhythm-state-ready').style.display = 'none';
  document.getElementById('rhythm-state-active').style.display = '';
  document.getElementById('rhythm-state-result').style.display = 'none';
  document.getElementById('rhythm-bottom-ready').style.display = 'none';
  document.getElementById('rhythm-bottom-active').style.display = '';
  document.getElementById('rhythm-meter').style.display = '';

  // 圆圈文字变化
  document.getElementById('rhythm-target-text').textContent = '按这里';
  document.getElementById('rhythm-target-sub').textContent = '110 BPM 节奏';

  // 重置数据
  document.getElementById('rhythm-count').textContent = '0';
  document.getElementById('rhythm-bpm').textContent = '--';
  document.getElementById('rhythm-eval').textContent = '--';
  document.getElementById('rhythm-tip').textContent = '';

  speak('开始训练，跟着 110 BPM 节奏按压', { rate: 1.1 });
}

function onRhythmPress() {
  // 圆圈"按下"动画
  const target = document.getElementById('rhythm-target');
  target.style.transform = 'scale(0.94)';
  setTimeout(() => target.style.transform = '', 80);

  // 振动+音效
  if (navigator.vibrate) navigator.vibrate(20);
  playClick();

  // 还没开始训练？只是预演
  if (!rhythmActive) {
    return;
  }

  rhythmCount++;
  const now = Date.now();
  rhythmTimestamps.push(now);
  document.getElementById('rhythm-count').textContent = rhythmCount;

  // 计算瞬时 BPM（用最近 3 次按压间隔）
  if (rhythmTimestamps.length >= 4) {
    const recent = rhythmTimestamps.slice(-4);
    const totalGap = recent[3] - recent[0];
    const avgGap = totalGap / 3;
    const bpm = Math.round(60000 / avgGap);
    document.getElementById('rhythm-bpm').textContent = bpm;

    // 节奏指示器位置（100-120 范围内 0%-100%）
    const indicatorEl = document.getElementById('rhythm-indicator');
    let pct = ((bpm - 90) / 40) * 100;
    pct = Math.max(0, Math.min(100, pct));
    indicatorEl.style.left = pct + '%';

    // 节奏评价
    const evalEl = document.getElementById('rhythm-eval');
    const tipEl = document.getElementById('rhythm-tip');
    if (bpm >= 100 && bpm <= 120) {
      evalEl.textContent = '👍 棒';
      evalEl.style.color = '#34D277';
      tipEl.textContent = '节奏很好，保持';
      tipEl.style.color = '#34D277';
    } else if (bpm >= 90 && bpm < 100) {
      evalEl.textContent = '快点';
      evalEl.style.color = '#F59E0B';
      tipEl.textContent = '稍微快一点';
      tipEl.style.color = '#F59E0B';
    } else if (bpm > 120 && bpm <= 130) {
      evalEl.textContent = '慢点';
      evalEl.style.color = '#F59E0B';
      tipEl.textContent = '稍微慢一点';
      tipEl.style.color = '#F59E0B';
    } else if (bpm < 90) {
      evalEl.textContent = '太慢';
      evalEl.style.color = '#FF6B5B';
      tipEl.textContent = '加快节奏！100-120';
      tipEl.style.color = '#FF6B5B';
    } else {
      evalEl.textContent = '太快';
      evalEl.style.color = '#FF6B5B';
      tipEl.textContent = '慢一点！100-120';
      tipEl.style.color = '#FF6B5B';
    }
  }

  // 完成 30 次
  if (rhythmCount >= 30) {
    finishRhythmTraining();
  }
}

function finishRhythmTraining() {
  rhythmActive = false;
  const totalTime = (Date.now() - rhythmStartTime) / 1000;

  // 计算各项数据
  const intervals = [];
  for (let i = 1; i < rhythmTimestamps.length; i++) {
    intervals.push(rhythmTimestamps[i] - rhythmTimestamps[i-1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const avgBpm = Math.round(60000 / avgInterval);

  // 稳定性：标准差越小越稳定
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const stability = Math.max(0, Math.round(100 - (stdDev / avgInterval * 100 * 2)));

  // 评分逻辑
  let grade = 'C';
  let title = '继续努力';
  let color = '#F59E0B';
  const bpmInRange = (avgBpm >= 100 && avgBpm <= 120);

  if (bpmInRange && stability >= 90) {
    grade = 'A';
    title = '非常棒！节奏稳定';
    color = '#34D277';
  } else if (bpmInRange && stability >= 75) {
    grade = 'A-';
    title = '很好，节奏基本稳定';
    color = '#34D277';
  } else if (bpmInRange) {
    grade = 'B';
    title = '频率达标，再练稳定性';
    color = '#C8A656';
  } else if (Math.abs(avgBpm - 110) <= 15) {
    grade = 'B-';
    title = '接近标准，再练频率';
    color = '#C8A656';
  } else {
    grade = 'C';
    title = '还需多练';
    color = '#F59E0B';
  }

  // 切换UI到结果页
  document.getElementById('rhythm-state-active').style.display = 'none';
  document.getElementById('rhythm-state-result').style.display = '';
  document.getElementById('rhythm-bottom-active').style.display = 'none';
  document.getElementById('rhythm-meter').style.display = 'none';
  document.getElementById('rhythm-feedback').style.display = 'none';
  // 隐藏圆圈
  document.getElementById('rhythm-target').style.display = 'none';

  document.getElementById('rhythm-result-grade').textContent = grade;
  document.getElementById('rhythm-result-grade').style.color = color;
  document.getElementById('rhythm-result-title').textContent = title;
  document.getElementById('rhythm-result-bpm').textContent = avgBpm + ' BPM';
  document.getElementById('rhythm-result-stability').textContent = stability + '%';
  document.getElementById('rhythm-result-time').textContent = totalTime.toFixed(1) + ' 秒';

  speak('训练完成', { rate: 1.1 });
}

function stopRhythmTraining(showConfirm) {
  if (showConfirm && rhythmActive && rhythmCount > 0) {
    if (!confirm('确定要放弃本次训练吗？已完成 ' + rhythmCount + ' 次按压')) {
      return;
    }
  }
  rhythmActive = false;
  rhythmCount = 0;
  rhythmTimestamps = [];

  // 重置 UI
  document.getElementById('rhythm-state-ready').style.display = '';
  document.getElementById('rhythm-state-active').style.display = 'none';
  document.getElementById('rhythm-state-result').style.display = 'none';
  document.getElementById('rhythm-bottom-ready').style.display = '';
  document.getElementById('rhythm-bottom-active').style.display = 'none';
  document.getElementById('rhythm-meter').style.display = 'none';
  document.getElementById('rhythm-feedback').style.display = '';
  document.getElementById('rhythm-target').style.display = '';
  document.getElementById('rhythm-target-text').textContent = '点这里开始';
  document.getElementById('rhythm-target-sub').textContent = '用手指持续点击';
  document.getElementById('rhythm-tip').textContent = '';
}

// ============ 页面导航 ============
let currentPage = 'home';
function goPage(id) {
  stopContextVoiceForPage(id);

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  currentPage = id;
  window.scrollTo(0, 0);

  // 更新底部 tab 高亮
  const pageToTab = { home: 'home', aed: 'aed', learn: 'learn', cert: 'cert', train: 'learn', volunteer: 'cert', atlas: 'home' };
  const activeTab = pageToTab[id];
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.page === activeTab);
  });

  // 紧急救援/路人协助/志愿者任务 页隐藏底部导航
  const tabbar = document.getElementById('tabbar');
  const hiddenPages = ['rescue', 'helper', 'aed-contact', 'aed-mission', 'aed-running', 'aed-arrived', 'cpr-rhythm', 'train-cpr-flow', 'train-aed', 'train-heimlich', 'train-scenario', 'news', 'case-detail'];
  tabbar.style.display = hiddenPages.includes(id) ? 'none' : 'flex';

  // 停止地图模拟
  if (id !== 'aed-running' && missionMapTimer) {
    clearInterval(missionMapTimer);
    missionMapTimer = null;
  }
  if (id !== 'aed-running' && missionStartTimer) {
    clearTimeout(missionStartTimer);
    missionStartTimer = null;
  }

  if (id !== 'home' && id !== 'aed-mission') {
    stopMissionAlertLoop();
  }

  // 重置紧急页阶段
  if (id === 'rescue') {
    document.querySelectorAll('.rescue-stage').forEach(s => s.classList.remove('active'));
    document.getElementById('rescue-decision').classList.add('active');
    flowAborted = true;
    stopCPR();
    flowAborted = false;
  }
}

function stopContextVoiceForPage(nextPage) {
  if (!currentPage || currentPage === nextPage) return;

  const voicePages = ['rescue', 'helper', 'aed-mission', 'aed-running', 'aed-arrived', 'cpr-rhythm', 'train-cpr-flow', 'train-aed', 'train-heimlich', 'train-scenario'];
  if (voicePages.includes(currentPage) || voicePages.includes(nextPage)) {
    stopVoice();
  }
}

// ============ 紧急页阶段切换 ============
function showCPR() {
  document.getElementById('rescue-decision').classList.remove('active');
  document.getElementById('rescue-cpr').classList.add('active');
  startCPR();
}
function backToDecision() {
  document.getElementById('rescue-cpr').classList.remove('active');
  document.getElementById('rescue-decision').classList.add('active');
  stopCPR();
}

// ============ CPR 多阶段流程 ============
let cprInterval = null;
let cprCount = 0;
let cprRounds = 0;
let cprTotalSeconds = 0;
let cprTotalTimer = null;
let breathTimer = null;
let consciousTimer = null;
let helpTimer = null;
let loopTimer = null;
let ventTimer = null;
let aedTimer = null;
let flowTimeouts = [];
let audioCtx = null;
let currentStep = 0;
let ventStep = 0;
let ventRound = 1;
let flowAborted = false;

function initAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {}
}

function playClick() {
  try {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch(e) {}
}

// 紧急任务警报音效
function playMissionAlertSound() {
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // 模拟类似手机警报的急促双音
    for(let i=0; i<3; i++) {
      const start = now + i * 0.4;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, start);
      osc.frequency.exponentialRampToValueAtTime(1200, start + 0.1);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
      gain.gain.linearRampToValueAtTime(0, start + 0.2);
      osc.start(start);
      osc.stop(start + 0.3);
    }
  } catch(e) {}
}

// 处理首页演示任务的音效自动触发
let missionAlertPlayed = false;
let missionAlertTimer = null;

function startMissionAlertLoop() {
  if (missionAlertTimer) return;
  
  const playAlert = () => {
    // 只有在首页或任务详情页才播报提醒
    if (currentPage === 'home' || currentPage === 'aed-mission') {
      playMissionAlertSound();
      speakSequence([
        { text: '紧急任务！100米外需要 C P R 协作！', rate: 1.25, pitch: 1.1, volume: 1.0 },
        { text: '系统正在呼叫三人小队，你负责 A E D 准备和轮替！', rate: 1.2, pitch: 1.1, volume: 1.0 }
      ]);
    } else {
      stopMissionAlertLoop();
    }
  };

  playAlert();
  // 每 8 秒重复播报一次
  missionAlertTimer = setInterval(playAlert, 8000);
}

function stopMissionAlertLoop() {
  if (missionAlertTimer) {
    clearInterval(missionAlertTimer);
    missionAlertTimer = null;
  }
  stopVoice(); // 停止当前正在播报的紧急语音，即使定时器已被清掉也要执行
}

// 启动遮罩：点击即解锁音频 + 触发任务语音
(function() {
  const overlay = document.getElementById('launch-overlay');
  if (!overlay) return;

  function launch(e) {
    e.stopPropagation();
    overlay.classList.add('hidden');
    overlay.removeEventListener('click', launch);
    overlay.removeEventListener('touchstart', launch);
    // 遮罩消失后立即触发任务语音（此时已有用户手势，浏览器不会拦截）
    if (!missionAlertPlayed) {
      startMissionAlertLoop();
      missionAlertPlayed = true;
    }
  }

  overlay.addEventListener('click', launch);
  overlay.addEventListener('touchstart', launch);
})();

// ============ 语音系统 V3 (VoiceManager) ============
class VoiceManager {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.bestVoice = null;
    this.voicesReady = false;
    this.audioCtx = null;
    this.stopToken = 0;
    this.init();
  }

  init() {
    if (!window.speechSynthesis) return;
    const load = () => {
      this.bestVoice = this.pickBestVoice();
      this.voicesReady = true;
    };
    window.speechSynthesis.onvoiceschanged = load;
    load();
    // 兜底加载
    setTimeout(load, 500);
  }

  pickBestVoice() {
    const voices = window.speechSynthesis.getVoices();
    const priorities = [
      v => v.name === 'Tingting' || v.name === '婷婷',
      v => /Microsoft.*Xiaoxiao/i.test(v.name),
      v => /Google.*Chinese/i.test(v.name),
      v => v.lang === 'zh-CN' && /female|woman|女/i.test(v.name),
      v => v.lang === 'zh-CN',
      v => true
    ];
    for (const matcher of priorities) {
      const found = voices.find(matcher);
      if (found) return found;
    }
    return voices[0];
  }

  // 核心播报方法
  speak(text, options = {}) {
    const {
      rate = 1.05,
      pitch = 1.0,
      volume = 1.0,
      priority = 'NORMAL', // NORMAL, URGENT, SYSTEM
      onstart,
      onend
    } = options;

    // 预处理文本：字母逐字化 + 符号停顿
    let processedText = String(text)
      .replace(/A\s*E\s*D/gi, 'A, E, D, 自动体外除颤器')
      .replace(/C\s*P\s*R/gi, 'C, P, R, 心肺复苏')
      .replace(/!|！/g, ', ') // 惊叹号转为短停顿
      .replace(/\?|？/g, ', ') 
      .replace(/\.\.\./g, '... '); // 省略号转为长停顿

    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.voice = this.bestVoice;
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    if (priority === 'URGENT') {
      // 紧急任务：清空队列直接插播
      this.stop();
      this.queue = [];
    }

    this.queue.push({ utterance, onstart, onend, token: this.stopToken });
    if (!this.isPlaying) this.processQueue();
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const { utterance, onstart, onend, token } = this.queue.shift();
    if (token !== this.stopToken) {
      this.processQueue();
      return;
    }

    utterance.onstart = () => {
      if (token !== this.stopToken) return;
      if (onstart) onstart();
    };

    utterance.onend = () => {
      if (token !== this.stopToken) return;
      if (onend) onend();
      // 模拟人类“呼吸感”停顿：指令之间自动停 200ms
      setTimeout(() => {
        if (token === this.stopToken) this.processQueue();
      }, 200);
    };

    utterance.onerror = () => {
      if (token === this.stopToken) this.processQueue();
    };

    if (window.speechSynthesis) window.speechSynthesis.speak(utterance);
  }

  // 快捷播报：指令型
  command(text) {
    this.speak(text, { rate: 1.25, pitch: 1.1, volume: 1.0 });
  }

  // 快捷播报：引导型
  guide(text) {
    this.speak(text, { rate: 1.05, pitch: 1.0, volume: 0.9 });
  }

  // 快捷播报：安抚型
  comfort(text) {
    this.speak(text, { rate: 0.9, pitch: 0.95, volume: 0.8 });
  }

  // 停止所有播报
  stop() {
    this.stopToken++;
    this.queue = [];
    this.isPlaying = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
}

// 实例化全局语音管理器
const voice = new VoiceManager();

function stopVoice() {
  if (voice && typeof voice.stop === 'function') {
    voice.stop();
  } else if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// 兼容旧的 speak 函数
function speak(text, opts = {}) {
  voice.speak(text, opts);
}
function speakUrgent(text) {
  voice.speak(text, { rate: 1.25, pitch: 1.1, priority: 'URGENT' });
}
function speakCalm(text) {
  voice.comfort(text);
}
function speakNumber(n) {
  const text = (n <= 10) ? ['零','一','二','三','四','五','六','七','八','九','十'][n] : String(n);
  voice.speak(text, { rate: 1.7, volume: 1.0 });
}

// 多句连续播报（V3 自动处理停顿）
function speakSequence(phrases, callback) {
  if (!phrases || phrases.length === 0) {
    if (callback) callback();
    return;
  }
  phrases.forEach((p, idx) => {
    const isLast = (idx === phrases.length - 1);
    const text = typeof p === 'string' ? p : p.text;
    const opts = typeof p === 'object' ? p : {};
    if (isLast && callback) {
      const originalEnd = opts.onend;
      opts.onend = () => { if (originalEnd) originalEnd(); callback(); };
    }
    voice.speak(text, opts);
  });
}

function startTotalTimer() {
  if (cprTotalTimer) return;
  cprTotalTimer = setInterval(() => {
    cprTotalSeconds++;
    const min = Math.floor(cprTotalSeconds / 60).toString().padStart(2, '0');
    const sec = (cprTotalSeconds % 60).toString().padStart(2, '0');
    const el = document.getElementById('cpr-time');
    if (el) el.textContent = `${min}:${sec}`;
  }, 1000);
}

// 启动救护流程：从呼救开始
function startRescueFlow() {
  initAudio();
  flowAborted = false;
  cprCount = 0;
  cprRounds = 0;
  cprTotalSeconds = 0;

  // 切到 CPR 阶段
  document.getElementById('rescue-decision').classList.remove('active');
  document.getElementById('rescue-cpr').classList.add('active');

  goStep(1);
}

function abortFlow(reason) {
  flowAborted = true;
  stopAllTimers();
  stopVoice();
  alert(`已暂停流程：${reason}\n\n实际场景下：\n• "有反应"→ 安抚患者+继续观察\n• "有正常呼吸"→ 转为侧卧位+持续监测\n• 始终保持联系 120`);
}

function goStep(n) {
  if (flowAborted) return;
  initAudio();

  document.querySelectorAll('.cpr-step').forEach(el => el.style.display = 'none');
  if (n === 'loop') {
    document.getElementById('step-loop').style.display = 'block';
    const el = document.getElementById('loop-rounds');
    if (el) el.textContent = cprRounds;
  } else {
    const el = document.getElementById(`step-${n}`);
    if (el) el.style.display = 'block';
  }
  currentStep = n;

  updateStepProgress(n);
  updateStepTitle(n);

  stopAllTimers();
  if (n === 1) startHelpStep();
  if (n === 2) startConsciousStep();
  if (n === 3) startBreathStep();
  if (n === 4) startCompression();
  if (n === 5) startVentilation();
  if (n === 'loop') startLoopStep();

  if (n === 4 && !cprTotalTimer) startTotalTimer();

  document.getElementById('rescue').scrollTop = 0;
  window.scrollTo(0, 0);
}

function updateStepProgress(n) {
  const num = (typeof n === 'number') ? n : 5;
  document.querySelectorAll('.step-pill').forEach(p => {
    const s = parseInt(p.dataset.step);
    p.classList.remove('active', 'done');
    if (s < num) p.classList.add('done');
    else if (s === num) p.classList.add('active');
  });
  document.querySelectorAll('.step-line').forEach((l, i) => {
    l.classList.toggle('done', (i+1) < num);
  });
}

function updateStepTitle(n) {
  const titles = {
    1: '第 1 步 · 呼救',
    2: '第 2 步 · 判断意识',
    3: '第 3 步 · 判断呼吸',
    4: '第 4 步 · 胸外按压',
    5: '第 5 步 · 人工呼吸',
    'loop': '循环 · 持续救护'
  };
  const el = document.getElementById('cpr-stage-title');
  if (el) el.textContent = titles[n] || 'CPR 进行中';
}

function stopAllTimers() {
  clearFlowTimeouts();
  if (cprInterval) { clearInterval(cprInterval); cprInterval = null; }
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  if (consciousTimer) { clearInterval(consciousTimer); consciousTimer = null; }
  if (helpTimer) { clearInterval(helpTimer); helpTimer = null; }
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (ventTimer) { clearInterval(ventTimer); ventTimer = null; }
  if (aedTimer) { clearInterval(aedTimer); aedTimer = null; }
}

function setFlowTimeout(callback, delay) {
  const timer = setTimeout(() => {
    flowTimeouts = flowTimeouts.filter(t => t !== timer);
    callback();
  }, delay);
  flowTimeouts.push(timer);
  return timer;
}

function clearFlowTimeouts() {
  flowTimeouts.forEach(timer => clearTimeout(timer));
  flowTimeouts = [];
}

// 步骤 1：呼救（5 秒后自动进下一步）
function startHelpStep() {
  // 用紧迫语气连续播报
  speakSequence([
    { text: '请这位先生', rate: 1.15, pause: 100 },
    { text: '立即拨打120！', rate: 1.25, pitch: 1.1, pause: 600 },
    { text: '系统已派三名志愿者', rate: 1.1, pause: 100 },
    { text: '分别负责按压，A E D，和现场记录', rate: 1.1, pause: 500 },
    { text: '您不用自己去找', rate: 1.0, pause: 400 },
    { text: '准备开始按压', rate: 1.1, pitch: 1.05 },
  ]);

  let t = 0;
  const fill = document.getElementById('timer-1');
  if (fill) fill.style.width = '0%';
  helpTimer = setInterval(() => {
    if (flowAborted) { clearInterval(helpTimer); return; }
    t += 0.1;
    const pct = Math.min(t / 7 * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (t >= 7) {
      clearInterval(helpTimer);
      goStep(2);
    }
  }, 100);
}

// 步骤 2：5 秒判断意识 → 自动进下一步
function startConsciousStep() {
  speakSequence([
    { text: '轻拍患者双肩', rate: 1.1, pause: 300 },
    { text: '在耳边大声呼喊', rate: 1.1, pause: 400 },
    { text: '大爷！', rate: 1.3, pitch: 1.15, pause: 200 },
    { text: '你怎么啦！', rate: 1.3, pitch: 1.15 },
  ]);

  let t = 0;
  const fill = document.getElementById('timer-2');
  if (fill) fill.style.width = '0%';
  consciousTimer = setInterval(() => {
    if (flowAborted) { clearInterval(consciousTimer); return; }
    t += 0.1;
    const pct = Math.min(t / 5 * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (t >= 5) {
      clearInterval(consciousTimer);
      goStep(3);
    }
  }, 100);
}

// 步骤 3：7 秒判断呼吸 → 自动进按压
function startBreathStep() {
  speakSequence([
    { text: '把脸贴近患者口鼻', rate: 1.1, pause: 300 },
    { text: '同时看胸口起伏', rate: 1.1, pause: 200 },
    { text: '听呼吸声', rate: 1.1, pause: 400 },
    { text: '跟我一起数', rate: 1.15 },
  ]);

  let count = 1001;
  const counter = document.getElementById('breath-counter');
  const fill = document.getElementById('timer-3');
  if (fill) fill.style.width = '0%';
  if (counter) counter.textContent = count;

  let elapsed = 0;
  let lastShown = 1000;
  let breathSpeaking = false;

  // 5.5 秒后开始报数（让前面的语音播完）
  setFlowTimeout(() => {
    breathTimer = setInterval(() => {
      if (flowAborted) { clearInterval(breathTimer); return; }
      elapsed += 0.1;

      const newCount = 1001 + Math.floor(elapsed);
      if (newCount <= 1007 && newCount !== lastShown) {
        if (counter) counter.textContent = newCount;
        lastShown = newCount;

        // 语音只在不忙时说
        if (!breathSpeaking && window.speechSynthesis) {
          try {
            stopVoice();
            const u = new SpeechSynthesisUtterance(String(newCount));
            u.voice = voice.bestVoice;
            u.lang = 'zh-CN';
            u.rate = 1.5;
            u.onstart = () => { breathSpeaking = true; };
            u.onend = () => { breathSpeaking = false; };
            u.onerror = () => { breathSpeaking = false; };
            window.speechSynthesis.speak(u);
          } catch(e) {}
        }
      }

      if (elapsed >= 7) {
        clearInterval(breathTimer);
        stopVoice();
        setFlowTimeout(() => goStep(4), 300);
      }
    }, 100);
  }, 5500);

  // 进度条单独走
  let totalT = 0;
  const totalTimer = setInterval(() => {
    if (flowAborted) { clearInterval(totalTimer); return; }
    totalT += 0.1;
    const pct = Math.min(totalT / 12.5 * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (totalT >= 12.5) clearInterval(totalTimer);
  }, 100);
}

// 步骤 4：30 次按压 + 人声报数
function startCompression() {
  cprCount = 0;
  document.getElementById('cpr-count').textContent = '0';
  document.getElementById('press-num').textContent = '准备';
  document.getElementById('cpr-rounds').textContent = cprRounds;

  // 第一组先讲解，后续组直接开始
  if (cprRounds === 0) {
    setFlowTimeout(() => speak('开始胸外按压'), 200);
    setFlowTimeout(() => speak('双掌交叠，按在胸骨中下段'), 2000);
    setFlowTimeout(() => speak('用力下压5到6厘米，跟我数'), 4500);

    setFlowTimeout(() => startPressLoop(), 7500);
  } else {
    setFlowTimeout(() => speak('继续按压，跟我数'), 200);
    setFlowTimeout(() => startPressLoop(), 1800);
  }
}

function startPressLoop() {
  cprCount = 0;
  let isSpeaking = false;  // 跟踪 TTS 是否正在说话

  function tick() {
    if (flowAborted) return;
    cprCount++;

    if (cprCount > 30) {
      clearInterval(cprInterval);
      cprInterval = null;
      // 取消所有未播完的 TTS 队列
      stopVoice();
      setFlowTimeout(() => speak('完成30次，准备人工呼吸'), 200);
      setFlowTimeout(() => goStep(5), 1800);
      return;
    }

    // 屏幕数字 + 节拍音 + 振动 - 这三个永远准时
    document.getElementById('cpr-count').textContent = cprCount;
    document.getElementById('press-num').textContent = cprCount;
    playClick();
    if (navigator.vibrate) navigator.vibrate(30);

    // TTS 报数 - 关键策略：
    // 1. 只在不忙的时候报
    // 2. 关键节点（5, 10, 15, 20, 25, 30）必报
    // 3. 数字 1-9 用单字（一二三..），10+ 太长就跳过
    if (!isSpeaking) {
      const isMilestone = (cprCount % 5 === 0);
      const isShortNumber = cprCount <= 9;

      if (isMilestone || isShortNumber) {
        try {
          if (window.speechSynthesis) {
            // 清空队列避免堆积
            stopVoice();

            const word = numberToChinese(cprCount);
            const u = new SpeechSynthesisUtterance(word);
            u.lang = 'zh-CN';
            u.rate = 1.7;  // 加快语速避免拖延
            u.volume = 1.0;
            u.onstart = () => { isSpeaking = true; };
            u.onend = () => { isSpeaking = false; };
            u.onerror = () => { isSpeaking = false; };
            window.speechSynthesis.speak(u);
          }
        } catch(e) {}
      }
    }
  }

  // 立即触发第一次
  tick();
  cprInterval = setInterval(tick, 545); // 110 BPM
}

// 数字转中文短读法（避免TTS引擎"二十三"拖太长）
function numberToChinese(n) {
  if (n <= 10) {
    return ['零','一','二','三','四','五','六','七','八','九','十'][n];
  }
  // 11-30 用阿拉伯数字让 TTS 自动读，但用更短的形式
  // 实测 TTS 读 "23" 比 "二十三" 短
  return String(n);
}

// 步骤 5：人工呼吸（2 次自动推进）
function startVentilation() {
  ventStep = 0;
  ventRound = 1;
  document.getElementById('vent-counter').textContent = '第 1 次';
  const numEl = document.getElementById('vent-counter-num');
  if (numEl) numEl.textContent = '1';
  document.querySelectorAll('.vent-item').forEach(el => el.classList.remove('active', 'done'));

  // 第一组才详细讲解，后续直接进入
  if (cprRounds === 0) {
    setFlowTimeout(() => speak('开始人工呼吸，仰头抬下巴'), 200);
    setFlowTimeout(() => speak('清理口腔异物'), 2200);
    setFlowTimeout(() => speak('捏住鼻子，吹一口气'), 4200);
    setFlowTimeout(() => runVentRound(), 6200);
  } else {
    setFlowTimeout(() => speak('人工呼吸 2 次'), 200);
    setFlowTimeout(() => runVentRound(), 1500);
  }
}

// 单次人工呼吸的倒计时（每次约 4 秒）
function runVentRound() {
  if (flowAborted) return;

  document.getElementById('vent-counter').textContent = `第 ${ventRound} 次`;
  const numEl = document.getElementById('vent-counter-num');
  if (numEl) numEl.textContent = ventRound;
  document.getElementById('vent-timer-label').textContent =
    ventRound === 1 ? '吹气中... 看到胸部鼓起' : '第 2 次吹气...';

  // 高亮"吹一口气"步骤
  document.querySelectorAll('.vent-item').forEach(el => el.classList.remove('active'));
  document.getElementById('vent-4').classList.add('active');

  // 语音引导
  if (ventRound === 1 && cprRounds > 0) {
    speak('吹气');
  } else if (ventRound === 2) {
    speak('再吹一次');
  }

  let t = 0;
  const fill = document.getElementById('timer-vent');
  if (fill) fill.style.width = '0%';
  const total = 3.5;  // 每次人工呼吸 3.5 秒（吹气 1 秒+恢复 2.5 秒）

  if (ventTimer) clearInterval(ventTimer);
  ventTimer = setInterval(() => {
    if (flowAborted) { clearInterval(ventTimer); return; }
    t += 0.1;
    const pct = Math.min(t / total * 100, 100);
    if (fill) fill.style.width = pct + '%';

    if (t >= total) {
      clearInterval(ventTimer);
      ventTimer = null;
      // 标记本次人工呼吸完成
      document.getElementById('vent-4').classList.remove('active');
      document.getElementById('vent-4').classList.add('done');

      ventRound++;
      if (ventRound <= 2) {
        // 自动开始第 2 次
        setFlowTimeout(() => runVentRound(), 600);
      } else {
        // 完成 2 次人工呼吸，进入循环
        cprRounds++;
        speak('完成一组循环');
        setFlowTimeout(() => goStep('loop'), 1200);
      }
    }
  }, 100);
}

// 兼容旧函数（已不再使用按钮触发）
function completeVent() {
  // 留空 - 现在由 runVentRound 自动推进
}

// 重置当前按压计数（点击圆圈触发）
let lastResetTime = 0;
function resetCprCount() {
  // 防止误触：500ms 内多次点击只算一次
  const now = Date.now();
  if (now - lastResetTime < 500) return;
  lastResetTime = now;

  // 短振动反馈
  if (navigator.vibrate) navigator.vibrate(80);

  // 停掉当前节拍循环
  if (cprInterval) {
    clearInterval(cprInterval);
    cprInterval = null;
  }
  stopVoice();

  // 重置计数
  cprCount = 0;
  document.getElementById('cpr-count').textContent = '0';
  document.getElementById('press-num').textContent = '0';
  document.getElementById('press-label').textContent = '已重置 · 即将重新开始';

  // 语音提示
  speak('已重置，从 1 开始', { rate: 1.15 });

  // 1.5 秒后重新开始
  setFlowTimeout(() => {
    if (flowAborted) return;
    document.getElementById('press-label').textContent = '跟屏幕数字按压';
    startPressLoop();
  }, 1500);
}

// AED 介入流程（暂停按压 + 引导分析/电击）
let aedStage = 0; // 0=分析中 1=建议电击 2=电击后恢复

function startAedInterrupt() {
  if (cprInterval) {
    clearInterval(cprInterval);
    cprInterval = null;
  }
  stopVoice();
  if (aedTimer) { clearInterval(aedTimer); aedTimer = null; }

  // 隐藏按压页 + 显示AED介入页
  document.getElementById('step-4').style.display = 'none';
  document.getElementById('step-aed').style.display = 'block';
  aedStage = 0;
  runAedStage();
}

function runAedStage() {
  if (flowAborted) return;
  const labelEl = document.getElementById('aed-stage-label');
  const quoteEl = document.getElementById('aed-stage-quote');
  const detailEl = document.getElementById('aed-stage-detail');
  const timerLabelEl = document.getElementById('aed-timer-label');
  const fill = document.getElementById('timer-aed');

  if (aedStage === 0) {
    // 阶段 0：分析心律（10 秒）
    labelEl.textContent = 'AED 分析中 · 停止按压';
    quoteEl.textContent = '所有人离开患者！';
    detailEl.innerHTML = 'AED 正在<strong style="color:#F59E0B;">分析心律</strong>，请离开患者，不要触碰。<br>机器会告诉您下一步怎么做。';
    timerLabelEl.textContent = '分析中... 约 10 秒';

    speakSequence([
      { text: '所有人离开患者！', rate: 1.25, pitch: 1.1, pause: 400 },
      { text: 'A E D 正在分析心律', rate: 1.05, pause: 400 },
      { text: '不要触碰患者', rate: 1.1 },
    ]);

    runAedTimer(10, () => {
      aedStage = 1;
      runAedStage();
    });
  } else if (aedStage === 1) {
    // 阶段 1：建议电击（3 秒等待按下）
    labelEl.textContent = 'AED 建议电击 · 再次离开';
    quoteEl.textContent = '"离开！按下电击键！"';
    detailEl.innerHTML = '机器闪烁<strong style="color:#FF6B5B;">电击按钮</strong>，再次确认所有人离开患者。<br>按下闪烁的按钮 · 立即继续按压。';
    timerLabelEl.textContent = '准备电击... 5 秒';
    if (fill) fill.style.width = '0%';

    speakSequence([
      { text: '再次离开！', rate: 1.3, pitch: 1.15, pause: 300 },
      { text: '按下电击按钮', rate: 1.2, pitch: 1.1 },
    ]);

    runAedTimer(5, () => {
      aedStage = 2;
      runAedStage();
    });
  } else if (aedStage === 2) {
    // 阶段 2：电击完成，立即恢复按压（重置计数）
    labelEl.textContent = '电击完成 · 立即恢复按压';
    quoteEl.textContent = '"立即按压！"';
    detailEl.innerHTML = '电击已完成。<br><strong style="color:#FF8B5B;">不要等待心跳</strong>，立即从 1 开始重新按压 30 次。';
    timerLabelEl.textContent = '即将自动开始按压';
    if (fill) fill.style.width = '0%';

    speak('立即恢复按压，从 1 开始', { rate: 1.2 });

    runAedTimer(2.5, () => {
      // 恢复到按压页 + 重置计数
      document.getElementById('step-aed').style.display = 'none';
      document.getElementById('step-4').style.display = 'block';
      cprCount = 0;
      document.getElementById('cpr-count').textContent = '0';
      document.getElementById('press-num').textContent = '0';
      document.getElementById('press-label').textContent = '电击后 · 重新开始';
      setFlowTimeout(() => {
        if (flowAborted) return;
        document.getElementById('press-label').textContent = '跟屏幕数字按压';
        startPressLoop();
      }, 800);
    });
  }
}

function runAedTimer(seconds, callback) {
  let t = 0;
  const fill = document.getElementById('timer-aed');
  if (fill) fill.style.width = '0%';
  if (aedTimer) clearInterval(aedTimer);
  aedTimer = setInterval(() => {
    if (flowAborted) { clearInterval(aedTimer); return; }
    t += 0.1;
    const pct = Math.min(t / seconds * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (t >= seconds) {
      clearInterval(aedTimer);
      aedTimer = null;
      callback();
    }
  }, 100);
}

function cancelAedInterrupt() {
  if (aedTimer) { clearInterval(aedTimer); aedTimer = null; }
  stopVoice();
  document.getElementById('step-aed').style.display = 'none';
  document.getElementById('step-4').style.display = 'block';
  // 重置计数（因为按压已经中断了几秒）
  cprCount = 0;
  document.getElementById('cpr-count').textContent = '0';
  document.getElementById('press-num').textContent = '0';
  document.getElementById('press-label').textContent = '从 1 重新开始';
  setFlowTimeout(() => {
    if (flowAborted) return;
    document.getElementById('press-label').textContent = '跟屏幕数字按压';
    startPressLoop();
  }, 800);
}

// 志愿者接受 AED 任务
// ============ 志愿者任务地图动画 ============
let missionMapTimer = null;
let missionStartTimer = null;
let missionDistance = 240;
let missionTimeRemaining = 100;

function startAedRunningSimulation() {
  const marker = document.getElementById('run-marker');
  const distEl = document.getElementById('run-dist');
  const timeEl = document.getElementById('run-time');
  if (!marker) return;
  
  missionDistance = 240;
  missionTimeRemaining = 100;
  
  if (missionMapTimer) clearInterval(missionMapTimer);
  
  missionMapTimer = setInterval(() => {
    missionDistance -= 6; // 步进 6 米 (加快一点演示效果)
    missionTimeRemaining -= 1;
    
    // 更新 UI
    if (distEl) distEl.textContent = missionDistance + 'm';
    if (timeEl) {
      const min = Math.floor(missionTimeRemaining/60);
      const sec = missionTimeRemaining%60;
      timeEl.textContent = (min > 0 ? min + ' 分 ' : '') + sec + ' 秒';
    }
    
    // 模拟坐标移动
    // 路径点: (12, 55) -> (42, 30) -> (92, 60)
    const progress = (240 - missionDistance) / 240;
    let currentX, currentY;
    
    if (progress <= 0.4) { // 第一段 (12,55) -> (42,30)
      const p = progress / 0.4;
      currentX = 12 + (42 - 12) * p;
      currentY = 55 + (30 - 55) * p;
    } else { // 第二段 (42,30) -> (92,60)
      const p = (progress - 0.4) / 0.6;
      currentX = 42 + (92 - 42) * p;
      currentY = 30 + (60 - 30) * p;
    }
    
    marker.style.left = currentX + '%';
    marker.style.top = currentY + '%';
    
    if (missionDistance <= 0) {
      clearInterval(missionMapTimer);
      goPage('aed-arrived');
      return;
    }
    
    // 触发语音里程碑
    if (missionDistance === 180) speak('继续保持步伐，距离现场 180 米');
    if (missionDistance === 120) speak('还有 120 米，准备好贴 A E D 电极片，并在两分钟后轮替');
    if (missionDistance === 30) speak('即将到达现场，请大声喊：继续按压，我来贴片');
    
  }, 1000);
}

function confirmMission() {
  const content = `
    <div style="padding:10px 0;">
      <div style="background:rgba(192,57,43,0.1);padding:16px;border-radius:14px;margin-bottom:20px;border:1px solid rgba(192,57,43,0.2);">
        <div style="color:var(--rescue-red);font-weight:700;font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <span>⚠</span> 责任与义务确认
        </div>
        <div style="font-size:13px;line-height:1.6;color:var(--ink-soft);">
          这是一个<strong>真实</strong>的急救任务。恶意抢单、虚假响应将导致救援资源浪费，情节严重者将承担法律责任及治安处罚。
        </div>
      </div>
      
      <div style="margin-bottom:24px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">系统将记录并开启：</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-mute);">
            <span style="color:var(--green);">✓</span> 您的实时地理位置 (GPS)
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-mute);">
            <span style="color:var(--green);">✓</span> AED 取用、到场与电击时间戳
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-mute);">
            <span style="color:var(--green);">✓</span> 小队分工、轮替与现场记录同步
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:var(--ink-mute);margin-bottom:20px;text-align:center;">
        点击“确认前往”即代表您接受 AED 准备/轮替角色并承诺尽力施救
      </div>

      <div style="display:flex;gap:12px;">
        <button onclick="closeSheet()" style="flex:1;background:var(--paper-warm);color:var(--ink);border:none;padding:16px;border-radius:14px;font-weight:700;">取消</button>
        <button onclick="closeSheet();acceptAedMission();" style="flex:1;background:var(--rescue-red);color:white;border:none;padding:16px;border-radius:14px;font-weight:700;box-shadow:0 6px 16px rgba(192,57,43,0.3);">确认前往</button>
      </div>
    </div>
  `;
  openSheet('任务确认', content);
}

function acceptAedMission() {
  stopMissionAlertLoop();
  goPage('aed-running');
  startAedRunningGuide();
  if (missionStartTimer) clearTimeout(missionStartTimer);
  missionStartTimer = setTimeout(() => {
    missionStartTimer = null;
    if (currentPage === 'aed-running') startAedRunningSimulation();
  }, 1000);
}

// 跑动中的语音引导
function startAedRunningGuide() {
  initAudio();
  speakSequence([
    { text: '已接受任务', rate: 1.05, pause: 200 },
    { text: '请保持步伐', rate: 1.1, pitch: 1.05, pause: 800 },
    { text: '现在边跑边听', rate: 1.05, pause: 400 },
    { text: '我会告诉您 A E D 怎么用，以及什么时候轮替', rate: 1.05, pause: 1200 },
    { text: '揭开盖子', rate: 1.1, pause: 200 },
    { text: 'A E D 自动开机', rate: 1.1, pause: 800 },
    { text: '电极片', rate: 1.1, pause: 100 },
    { text: '一片贴右胸上方', rate: 1.05, pause: 200 },
    { text: '一片贴左侧腋下', rate: 1.05, pause: 1000 },
    { text: '到现场后', rate: 1.05, pause: 200 },
    { text: '告诉压缩手', rate: 1.05, pause: 200 },
    { text: '继续按压不要停，我来贴片！', rate: 1.2, pitch: 1.1, pause: 800 },
    { text: '两分钟后准备轮替压缩', rate: 1.05 },
  ]);
}

// 循环页：3 秒后自动开始下一组
function startLoopStep() {
  speak('继续按压，不要停', { rate: 1.2 });

  let t = 0;
  const fill = document.getElementById('timer-loop');
  if (fill) fill.style.width = '0%';
  loopTimer = setInterval(() => {
    if (flowAborted) { clearInterval(loopTimer); return; }
    t += 0.1;
    const pct = Math.min(t / 3 * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (t >= 3) {
      clearInterval(loopTimer);
      goStep(4);
    }
  }, 100);
}

// 兼容旧函数名
function showCPR() { startRescueFlow(); }

function stopCPR() {
  flowAborted = true;
  stopAllTimers();
  if (cprTotalTimer) { clearInterval(cprTotalTimer); cprTotalTimer = null; }
  stopVoice();
  cprCount = 0;
  cprRounds = 0;
  cprTotalSeconds = 0;
}

// ============ 测验答题 ============
function quizAnswer(btn, isCorrect) {
  const all = btn.parentElement.querySelectorAll('.quiz-opt');
  all.forEach(o => o.style.pointerEvents = 'none');
  btn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) {
    // 也显示正确答案
    all.forEach(o => {
      if (o.onclick.toString().includes('true')) {
        o.classList.add('correct');
      }
    });
  }
  setTimeout(() => {
    if (isCorrect) {
      alert('答对了！+10 积分');
    } else {
      alert('答错了，看上面绿色为正确答案');
    }
  }, 400);
}

// 入口动画 - 数字滚动
function animateNumber(el, target, duration = 1200) {
  const start = 0;
  const startTime = Date.now();
  const update = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString();
  };
  update();
}

window.addEventListener('load', () => {
  document.querySelectorAll('.home-stat-num').forEach((el, i) => {
    const target = parseInt(el.textContent.replace(/,/g, ''));
    el.textContent = '0';
    setTimeout(() => animateNumber(el, target), 200 + i * 150);
  });

  // 紧急任务 banner 倒计时
  const countdownEl = document.getElementById('mission-countdown');
  if (countdownEl) {
    let secs = 23;
    setInterval(() => {
      secs = secs > 0 ? secs - 1 : 23;
      countdownEl.textContent = secs + 's';
    }, 1000);
  }
});

// ============ 救援责任确认弹层 ============
function showRescueConfirm() {
  const overlay = document.getElementById('rescue-confirm-overlay');
  const checkbox = document.getElementById('rescue-confirm-checkbox');
  const btn = document.getElementById('rescue-confirm-btn');
  // 每次打开重置勾选状态
  checkbox.classList.remove('checked');
  btn.className = 'rescue-confirm-btn disabled';
  overlay.classList.add('active');
}

function closeRescueConfirm() {
  document.getElementById('rescue-confirm-overlay').classList.remove('active');
}

function toggleRescueConfirm() {
  const checkbox = document.getElementById('rescue-confirm-checkbox');
  const btn = document.getElementById('rescue-confirm-btn');
  const checked = checkbox.classList.toggle('checked');
  btn.className = 'rescue-confirm-btn ' + (checked ? 'ready' : 'disabled');
}

function confirmAndStartRescue() {
  const checked = document.getElementById('rescue-confirm-checkbox').classList.contains('checked');
  if (!checked) return;
  closeRescueConfirm();
  startRescueFlow();
}

// ============ AED 责任人联络流程 ============
let aedContactTimer = null;

function startAedContactFlow() {
  // 重置到初始状态
  const bar = document.getElementById('aed-connect-bar');
  const title = document.getElementById('aed-connect-title');
  const sub = document.getElementById('aed-connect-sub');
  const spinner = document.getElementById('aed-connect-spinner');
  const ownerCard = document.getElementById('aed-owner-card');
  const ownerStatus = document.getElementById('aed-owner-status');
  const ownerStatusText = document.getElementById('aed-owner-status-text');
  const chatArea = document.getElementById('aed-chat-area');

  bar.className = 'aed-connect-bar connecting';
  title.textContent = '正在通知设备责任人…';
  sub.textContent = '系统正在建立联系，请稍候';
  spinner.style.display = 'block';
  ownerCard.style.opacity = '0.4';
  chatArea.style.opacity = '0';
  ownerStatusText.textContent = '等待响应中…';
  ownerStatus.style.background = 'var(--paper-warm)';
  ownerStatus.style.borderColor = 'var(--line)';
  ownerStatus.querySelector('.aed-owner-status-dot').style.background = 'var(--ink-mute)';

  if (aedContactTimer) clearTimeout(aedContactTimer);

  // 1.8s 后：责任人已响应
  aedContactTimer = setTimeout(() => {
    bar.className = 'aed-connect-bar connected';
    title.textContent = '李明 已响应 ✓';
    sub.textContent = '责任人已收到通知，正前往设备柜';
    spinner.style.display = 'none';
    ownerCard.style.opacity = '1';
    ownerStatus.style.background = 'var(--green-soft)';
    ownerStatus.style.borderColor = 'rgba(31,138,91,0.2)';
    ownerStatus.querySelector('.aed-owner-status-dot').style.background = 'var(--green)';

    // 0.4s 后显示沟通气泡
    setTimeout(() => {
    chatArea.style.opacity = '1';
    ownerStatusText.textContent = '已前往设备柜，30 秒内到位';
  }, 400);
}

// ============ 救援动态页 Tab 切换 ============
function switchNewsTab(tab, btn) {
  // 更新 tab 按钮状态
  document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // 隐藏所有列表
  const lists = ['all', 'live', 'case', 'news'];
  lists.forEach(t => {
    const el = document.getElementById('news-list-' + t);
    if (el) el.style.display = 'none';
  });

  // 显示当前列表
  const currentList = document.getElementById('news-list-' + tab);
  if (currentList) currentList.style.display = 'block';
}

// ============ 初始化：给首页动态添加救援动态入口 ============
window.addEventListener('load', () => {
  // 给首页动态区域添加"查看更多"链接
  const homeActivity = document.querySelector('.home-activity-list');
  if (homeActivity) {
    const moreBtn = document.createElement('div');
    moreBtn.style.cssText = 'text-align:center;padding:8px 0 16px;';
    moreBtn.innerHTML = '<a href="javascript:void(0);" onclick="goPage(\\'news\\');return false;" style="color:var(--rescue-red);font-size:13px;cursor:pointer;font-family:var(--serif);font-weight:700;">查看全部救援动态 →</a>';
    homeActivity.after(moreBtn);
  }
});

</body>
</html>
