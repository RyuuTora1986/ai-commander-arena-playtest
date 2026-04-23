const DOCTRINE_INTEL_BY_ID = {
  balanced: [
    {
      label: '开局意图',
      value: '先稳住中线与比分，再在 Prime 窗口里提速。'
    },
    {
      label: '观战重点',
      value: '留意控图怎样慢慢转成推进，而不是只看单波强开。'
    }
  ],
  pressure: [
    {
      label: '开局意图',
      value: '更早压线抢先手，愿意用更高风险换第一波节奏。'
    },
    {
      label: '观战重点',
      value: '优先看线路压迫和 Prime 激活后的抱团速度。'
    }
  ],
  anchor: [
    {
      label: '开局意图',
      value: '先守路线和据点，不给对手轻易把分差滚大。'
    },
    {
      label: '观战重点',
      value: '留意撤退重整和反打时机，节奏会更慢但更稳。'
    }
  ],
  flank: [
    {
      label: '开局意图',
      value: '更常转线绕后，用机动换局部多打少。'
    },
    {
      label: '观战重点',
      value: '先看侧翼怎么脱离正面，再看包夹如何兑现成击倒。'
    }
  ]
};

function buildDoctrineIntelItems(doctrineId) {
  return (DOCTRINE_INTEL_BY_ID[doctrineId] ?? DOCTRINE_INTEL_BY_ID.balanced).map((item) => ({
    ...item
  }));
}

export function buildPrepSceneViewModel({ preset }) {
  return {
    title: preset?.title ?? '未命名对局',
    blueRoster: Array.isArray(preset?.blueCommanders) ? preset.blueCommanders : preset?.blueRoster ?? [],
    redRoster: Array.isArray(preset?.redCommanders) ? preset.redCommanders : preset?.redRoster ?? [],
    ruleLine: preset?.ruleLine ?? '3v3 AI 对抗 / Prime Relay / 06:00',
    stakes: preset?.summary ?? preset?.stakes ?? '',
    riskNote: preset?.riskNote ?? '',
    currentPreset: preset?.currentPreset ?? 'default',
    presetOptions: Array.isArray(preset?.presetOptions) ? preset.presetOptions : [],
    doctrineOptions: Array.isArray(preset?.doctrineOptions) ? preset.doctrineOptions : [],
    selectedDoctrineId: preset?.selectedDoctrineId ?? 'balanced',
    selectedDoctrineLabel: preset?.selectedDoctrineLabel ?? '均衡推进',
    selectedDoctrineSummary: preset?.selectedDoctrineSummary ?? '',
    doctrineIntelItems: buildDoctrineIntelItems(preset?.selectedDoctrineId ?? 'balanced')
  };
}

function normalizeSwingObjectiveLabel(swingObjective) {
  if (swingObjective === 'prime-relay' || swingObjective === 'primeRelay') {
    return 'Prime Relay';
  }
  if (swingObjective === 'top-beacon') {
    return '上路信标';
  }
  if (swingObjective === 'bot-beacon') {
    return '下路信标';
  }
  if (swingObjective === 'core-pressure') {
    return '核心推进';
  }
  return swingObjective ?? '关键推进';
}

function buildFollowupHint(report) {
  const swingLabel = normalizeSwingObjectiveLabel(report?.swingObjective);
  if (swingLabel === 'Prime Relay') {
    return '先回看 Prime Relay 前后的站位变化，再决定下一局要不要提前提速。';
  }
  if (swingLabel === '核心推进') {
    return '先回看终局推进是怎么被打开的，再决定下一局要不要把风险压低。';
  }
  return `先回看${swingLabel}前后的站位与抱团时机，再决定下一局是否换一种打法。`;
}

function buildResultMetrics(report) {
  const durationSec = report?.durationSec ?? 0;
  const blueObjectiveCaptures = report?.objectiveCaptures?.blue ?? 0;
  const redObjectiveCaptures = report?.objectiveCaptures?.red ?? 0;
  const objectiveLead =
    blueObjectiveCaptures === redObjectiveCaptures
      ? '控点持平'
      : blueObjectiveCaptures > redObjectiveCaptures
        ? `蓝方多拿 ${blueObjectiveCaptures - redObjectiveCaptures} 个据点`
        : `红方多拿 ${redObjectiveCaptures - blueObjectiveCaptures} 个据点`;

  const durationLabel = `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`;
  const durationDetail =
    report?.reason === 'score_timeout'
      ? '双方把拉扯拖满了整局时间。'
      : report?.reason === 'core_destroyed' || report?.reason === 'core_tiebreak'
        ? '胜负在核心压力里被直接兑现。'
        : '这一局很快就分出了走势。';
  const eliminationCount = report?.totalEliminations ?? 0;
  const eliminationDetail =
    eliminationCount > 0
      ? '人数差越多，越容易把局面滚成推进。'
      : '这一局主要靠站位和路线拉扯，没有打出太多正面击倒。';

  return [
    {
      label: '终局时长',
      value: durationLabel,
      detail: durationDetail
    },
    {
      label: '控点转换',
      value: `蓝 ${blueObjectiveCaptures} : 红 ${redObjectiveCaptures}`,
      detail:
        objectiveLead === '控点持平'
          ? '这局没有让据点滚成明显优势。'
          : objectiveLead
    },
    {
      label: '战场击倒',
      value: String(eliminationCount),
      detail: eliminationDetail
    }
  ];
}

export function buildResultSceneViewModel({ report }) {
  const winnerTone = report?.winner === 'red' ? 'red' : 'blue';
  const winnerLabel = winnerTone === 'red' ? '红方获胜' : '蓝方获胜';

  return {
    winnerTone,
    winnerLabel,
    resultKicker: '赛果发布',
    outcomeBadge: winnerTone === 'red' ? 'RED VICTORY' : 'BLUE VICTORY',
    winReasonLabel: report?.winPattern ?? '以比分优势取胜',
    swingObjectiveLabel: normalizeSwingObjectiveLabel(report?.swingObjective),
    followupHint: buildFollowupHint(report),
    doctrineLabel: report?.doctrineLabel ?? '',
    styleStandouts: Array.isArray(report?.styleStandouts) ? report.styleStandouts : [],
    resultMetrics: buildResultMetrics(report)
  };
}
