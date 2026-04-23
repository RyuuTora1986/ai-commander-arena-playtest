import {
  validateCommanderDefinition,
  validateMapDefinition,
  validateUnitDefinition
} from '../../shared-types/src/index.mjs';

export const unitArchetypes = [
  {
    id: 'guardian',
    name: '守卫者',
    role: 'frontline',
    maxHp: 260,
    attackDamage: 15,
    attackRange: 55,
    moveSpeed: 48,
    attackCooldownMs: 900,
    ability: {
      id: 'shield-pulse',
      type: 'ally-burst-heal',
      cooldownMs: 12000,
      radius: 110,
      power: 18
    }
  },
  {
    id: 'striker',
    name: '射击手',
    role: 'damage',
    maxHp: 175,
    attackDamage: 24,
    attackRange: 78,
    moveSpeed: 54,
    attackCooldownMs: 800,
    ability: {
      id: 'burst-round',
      type: 'self-buff',
      cooldownMs: 10000,
      power: 22
    }
  },
  {
    id: 'support',
    name: '支援者',
    role: 'support',
    maxHp: 155,
    attackDamage: 10,
    attackRange: 82,
    moveSpeed: 50,
    attackCooldownMs: 1000,
    ability: {
      id: 'triage-link',
      type: 'single-heal',
      cooldownMs: 14000,
      radius: 130,
      power: 26
    }
  },
  {
    id: 'artillery',
    name: '炮术师',
    role: 'aoe',
    maxHp: 135,
    attackDamage: 18,
    attackRange: 135,
    moveSpeed: 44,
    attackCooldownMs: 1200,
    ability: {
      id: 'relay-bomb',
      type: 'aoe-damage',
      cooldownMs: 16000,
      radius: 95,
      power: 20
    }
  },
  {
    id: 'assassin',
    name: '突袭者',
    role: 'flanker',
    maxHp: 150,
    attackDamage: 26,
    attackRange: 52,
    moveSpeed: 62,
    attackCooldownMs: 700,
    ability: {
      id: 'dash-cut',
      type: 'execute-dash',
      cooldownMs: 14000,
      radius: 140,
      power: 28
    }
  }
];

export const defaultSquadTemplate = ['guardian', 'striker', 'support', 'artillery', 'assassin'];

export const launchMap = {
  id: 'neon-foundry',
  name: '霓虹铸港',
  size: {
    width: 1000,
    height: 600
  },
  commanderSpawns: {
    blue: [
      { x: 160, y: 140 },
      { x: 160, y: 300 },
      { x: 160, y: 460 }
    ],
    red: [
      { x: 840, y: 140 },
      { x: 840, y: 300 },
      { x: 840, y: 460 }
    ]
  },
  corePositions: {
    blue: { x: 90, y: 300 },
    red: { x: 910, y: 300 }
  },
  objectives: {
    topBeacon: {
      id: 'top-beacon',
      label: '上路信标',
      type: 'beacon',
      x: 500,
      y: 120,
      radius: 72,
      captureMs: 6000,
      captureScore: 2,
      scorePulseMs: 5000,
      scorePerPulse: 1
    },
    botBeacon: {
      id: 'bot-beacon',
      label: '下路信标',
      type: 'beacon',
      x: 500,
      y: 480,
      radius: 72,
      captureMs: 6000,
      captureScore: 2,
      scorePulseMs: 5000,
      scorePerPulse: 1
    },
    primeRelay: {
      id: 'prime-relay',
      label: 'Prime Relay',
      type: 'prime-relay',
      x: 500,
      y: 300,
      radius: 86,
      spawnMs: 60000,
      captureMs: 8000,
      captureScore: 3,
      buffMs: 30000,
      respawnMs: 90000
    }
  },
  routes: {
    hold_mid: {
      blue: [
        { x: 260, y: 300 },
        { x: 430, y: 300 }
      ],
      red: [
        { x: 740, y: 300 },
        { x: 570, y: 300 }
      ]
    },
    hold_top: {
      blue: [
        { x: 260, y: 170 },
        { x: 430, y: 140 }
      ],
      red: [
        { x: 740, y: 170 },
        { x: 570, y: 140 }
      ]
    },
    hold_bot: {
      blue: [
        { x: 260, y: 430 },
        { x: 430, y: 460 }
      ],
      red: [
        { x: 740, y: 430 },
        { x: 570, y: 460 }
      ]
    },
    retreat_home: {
      blue: [
        { x: 180, y: 300 },
        { x: 120, y: 300 }
      ],
      red: [
        { x: 820, y: 300 },
        { x: 880, y: 300 }
      ]
    },
    top_lane_pressure: {
      blue: [
        { x: 260, y: 165 },
        { x: 500, y: 120 },
        { x: 760, y: 165 },
        { x: 900, y: 220 }
      ],
      red: [
        { x: 740, y: 165 },
        { x: 500, y: 120 },
        { x: 240, y: 165 },
        { x: 100, y: 220 }
      ]
    },
    bot_lane_pressure: {
      blue: [
        { x: 260, y: 435 },
        { x: 500, y: 480 },
        { x: 760, y: 435 },
        { x: 900, y: 380 }
      ],
      red: [
        { x: 740, y: 435 },
        { x: 500, y: 480 },
        { x: 240, y: 435 },
        { x: 100, y: 380 }
      ]
    },
    rotate_mid_to_top: {
      blue: [
        { x: 320, y: 300 },
        { x: 480, y: 240 },
        { x: 600, y: 160 }
      ],
      red: [
        { x: 680, y: 300 },
        { x: 520, y: 240 },
        { x: 400, y: 160 }
      ]
    },
    rotate_mid_to_bot: {
      blue: [
        { x: 320, y: 300 },
        { x: 480, y: 360 },
        { x: 600, y: 440 }
      ],
      red: [
        { x: 680, y: 300 },
        { x: 520, y: 360 },
        { x: 400, y: 440 }
      ]
    },
    collapse_mid: {
      blue: [
        { x: 320, y: 300 },
        { x: 500, y: 300 }
      ],
      red: [
        { x: 680, y: 300 },
        { x: 500, y: 300 }
      ]
    },
    defend_base: {
      blue: [
        { x: 220, y: 300 },
        { x: 140, y: 300 }
      ],
      red: [
        { x: 780, y: 300 },
        { x: 860, y: 300 }
      ]
    },
    siege_core: {
      blue: [
        { x: 500, y: 300 },
        { x: 760, y: 300 },
        { x: 900, y: 300 }
      ],
      red: [
        { x: 500, y: 300 },
        { x: 240, y: 300 },
        { x: 100, y: 300 }
      ]
    }
  }
};

export const commanderTemplates = [
  {
    id: 'lie-mai',
    name: '烈脉',
    persona: 'aggressive',
    styleLabel: '高压强开',
    styleHook: '抓住短时人数差就强开，宁可压深也不愿放窗口。',
    strengthText: '短时窗口兑现很快，Prime 团前压迫感最强。',
    riskText: '一旦第一波没打穿，容易给对手反打空间。',
    preferredLane: 'top',
    defaultFormation: 'wedge',
    defaultRisk: 'high',
    defaultBrain: 'rule-based',
    intentBias: ['push_lane', 'collapse_target', 'contest_prime_relay']
  },
  {
    id: 'mistveil',
    name: '雾纱',
    persona: 'trickster',
    styleLabel: '欺骗埋伏',
    styleHook: '喜欢假撤退、卡视野和延迟进场，不正面硬碰。',
    strengthText: '能把零散窗口变成反包和收割机会。',
    riskText: '如果对手不给破绽，正面持续压制能力偏弱。',
    preferredLane: 'top',
    defaultFormation: 'screen',
    defaultRisk: 'medium',
    defaultBrain: 'mock',
    intentBias: ['collapse_target', 'split_push', 'contest_prime_relay']
  },
  {
    id: 'shouheng',
    name: '守衡',
    persona: 'defensive',
    styleLabel: '防守反打',
    styleHook: '更愿意先守住路权和据点，再等对手失误反打。',
    strengthText: '领先后能稳定把优势转成控图和防守。',
    riskText: '追击与终结速度慢，容易给落后方再找一波。',
    preferredLane: 'mid',
    defaultFormation: 'line',
    defaultRisk: 'low',
    defaultBrain: 'rule-based',
    intentBias: ['hold_lane', 'defend_core', 'contest_prime_relay']
  },
  {
    id: 'baileng',
    name: '白棱',
    persona: 'kite',
    styleLabel: '拉扯控距',
    styleHook: '靠边线拉扯、消耗和距离管理拖出优势。',
    strengthText: '只要战线够长，就能持续扩大血量和站位优势。',
    riskText: '终结节奏偏慢，窗口转瞬即逝时容易保守。',
    preferredLane: 'bot',
    defaultFormation: 'screen',
    defaultRisk: 'medium',
    defaultBrain: 'mock',
    intentBias: ['hold_lane', 'split_push', 'collapse_target']
  },
  {
    id: 'chizhang',
    name: '赤账',
    persona: 'macro',
    styleLabel: '资源运营',
    styleHook: '更看重控图、换点和把小优势滚成大优势。',
    strengthText: 'Prime、信标和线路压力会被他转成稳定分差。',
    riskText: '局面突然加速时，容易显得决断偏慢。',
    preferredLane: 'bot',
    defaultFormation: 'line',
    defaultRisk: 'medium',
    defaultBrain: 'rule-based',
    intentBias: ['push_lane', 'contest_prime_relay', 'protect_carry']
  },
  {
    id: 'gui-ling',
    name: '归零',
    persona: 'berserker',
    styleLabel: '极限搏命',
    styleHook: '比分落后时会主动搏命翻盘，不愿慢性等死。',
    strengthText: '逆风局里最容易制造突然翻盘感。',
    riskText: '顺风时也可能上头，把稳局打成对赌。',
    preferredLane: 'mid',
    defaultFormation: 'column',
    defaultRisk: 'all_in',
    defaultBrain: 'rule-based',
    intentBias: ['collapse_target', 'push_lane', 'contest_prime_relay']
  }
];

export const doctrineCatalog = [
  {
    id: 'balanced',
    label: '均衡推进',
    summary: '沿用当前默认节奏，优先跟随既有路线与目标窗口。',
    riskBias: 'medium',
    lineBias: 'preferred',
    targetBias: 'weakest',
    intentBias: ['push_lane', 'contest_prime_relay', 'hold_lane']
  },
  {
    id: 'pressure',
    label: '压线强攻',
    summary: '更早转压和抢目标，愿意用更高风险换先手。',
    riskBias: 'high',
    lineBias: 'pressure',
    targetBias: 'weakest',
    intentBias: ['push_lane', 'collapse_target', 'contest_prime_relay']
  },
  {
    id: 'anchor',
    label: '稳守反打',
    summary: '优先保线、守点和撤退重整，把失误成本压低。',
    riskBias: 'low',
    lineBias: 'hold',
    targetBias: 'nearest',
    intentBias: ['hold_lane', 'defend_core', 'contest_prime_relay']
  },
  {
    id: 'flank',
    label: '侧翼穿插',
    summary: '偏向转线和绕后，用机动换局部多打少。',
    riskBias: 'medium',
    lineBias: 'rotate',
    targetBias: 'weakest',
    intentBias: ['split_push', 'collapse_target', 'push_lane']
  }
];

const doctrineById = new Map(doctrineCatalog.map((doctrine) => [doctrine.id, doctrine]));

function cloneDoctrine(doctrine) {
  return {
    ...doctrine,
    intentBias: [...doctrine.intentBias]
  };
}

function resolveDoctrineId(value) {
  if (typeof value !== 'string') {
    return 'balanced';
  }

  return doctrineById.has(value) ? value : 'balanced';
}

export function getDoctrineDefinition(doctrineId) {
  return cloneDoctrine(doctrineById.get(resolveDoctrineId(doctrineId)));
}

export function resolveDoctrineSelection(selection = {}) {
  const normalizedSelection =
    typeof selection === 'string'
      ? { blue: selection, red: selection }
      : selection ?? {};

  return {
    blue: getDoctrineDefinition(normalizedSelection.blue),
    red: getDoctrineDefinition(normalizedSelection.red)
  };
}

export const matchupPresetCatalog = {
  default: {
    value: 'default',
    label: '强开压迫 vs 防守反打',
    title: '强开压迫 vs 防守反打',
    summary: '不是看 provider，而是看蓝方能否用前中期强开压迫，把红方拖进被迫应战的节奏。',
    watchFocus: '重点看 Prime 前后的先手窗口，以及红方能否把第一波冲击转成守点反打。'
  },
  mirror: {
    value: 'mirror',
    label: '欺骗埋伏 vs 资源运营',
    title: '欺骗埋伏 vs 资源运营',
    summary: '不是看 provider，而是看局部骗招和延迟进场，能不能压过更稳定的控图运营。',
    watchFocus: '重点看反包、分推牵扯和资源点交换，谁能把零散窗口滚成持续优势。'
  },
  'all-rule': {
    value: 'all-rule',
    label: '极限搏命 vs 稳健控图',
    title: '极限搏命 vs 稳健控图',
    summary: '不是看 provider，而是看高风险翻盘倾向，能不能冲破更稳的线路与目标控制。',
    watchFocus: '重点看比分落后后的搏命指令，以及领先方能否把优势锁进信标和 Prime。'
  }
};

export const defaultRules = {
  tickMs: 500,
  commanderDecisionMs: 2000,
  maxMatchMs: 360000,
  overclockStartMs: 300000,
  baseRespawnMs: 15000,
  overclockRespawnMs: 25000,
  killScore: 1,
  coreHp: 1400,
  coreDamage: 18,
  unitVisionRange: 220,
  unitLeashRange: 260,
  objectiveCaptureRatePerUnit: 500,
  coreAttackRange: 85,
  laneHoldRadius: 95
};

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function createCommanderRoster(teamId, brainOverrides = [], doctrine) {
  const source =
    teamId === 'blue'
      ? commanderTemplates.slice(0, 3)
      : commanderTemplates.slice(3, 6);

  return source.map((template, index) => ({
    ...template,
    teamId,
    slot: index,
    brainType: brainOverrides[index] ?? template.defaultBrain,
    doctrineId: doctrine.id,
    doctrine: cloneDoctrine(doctrine)
  }));
}

function assertValidDefinitions() {
  for (const unit of unitArchetypes) {
    const validation = validateUnitDefinition(unit);
    if (!validation.ok) {
      throw new Error(`Invalid unit definition: ${validation.errors.join(' ')}`);
    }
  }

  for (const commander of commanderTemplates) {
    const validation = validateCommanderDefinition(commander);
    if (!validation.ok) {
      throw new Error(`Invalid commander definition: ${validation.errors.join(' ')}`);
    }
  }

  const mapValidation = validateMapDefinition(launchMap);
  if (!mapValidation.ok) {
    throw new Error(`Invalid map definition: ${mapValidation.errors.join(' ')}`);
  }
}

assertValidDefinitions();

export function createDefaultMatchConfig(options = {}) {
  const blueBrains = options.blueBrains ?? [];
  const redBrains = options.redBrains ?? [];
  const doctrine = resolveDoctrineSelection(options.doctrine ?? options.doctrineSelection);

  return {
    matchId: options.matchId ?? 'match-local-001',
    contentVersion: 'phase1-web-prototype',
    doctrine,
    rules: {
      ...defaultRules,
      ...(options.rules ?? {})
    },
    map: {
      ...launchMap,
      commanderSpawns: {
        blue: launchMap.commanderSpawns.blue.map(clonePoint),
        red: launchMap.commanderSpawns.red.map(clonePoint)
      },
      corePositions: {
        blue: clonePoint(launchMap.corePositions.blue),
        red: clonePoint(launchMap.corePositions.red)
      }
    },
    teamConfigs: {
      blue: {
        id: 'blue',
        name: '蓝方矩阵',
        color: '#2dd4bf',
        accent: '#93c5fd',
        doctrineId: doctrine.blue.id,
        doctrine: doctrine.blue,
        commanders: createCommanderRoster('blue', blueBrains, doctrine.blue)
      },
      red: {
        id: 'red',
        name: '红方脉冲',
        color: '#fb7185',
        accent: '#fca5a5',
        doctrineId: doctrine.red.id,
        doctrine: doctrine.red,
        commanders: createCommanderRoster('red', redBrains, doctrine.red)
      }
    },
    squadTemplate: [...defaultSquadTemplate],
    unitArchetypes: unitArchetypes.map((unit) => ({
      ...unit,
      ability: { ...unit.ability }
    }))
  };
}
