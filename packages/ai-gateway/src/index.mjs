import {
  createValidationContextFromSnapshot,
  sanitizeCommanderOrder,
  validateBattleSnapshot,
  validateCommanderOrder
} from '../../shared-types/src/index.mjs';

const defaultDoctrine = {
  id: 'balanced',
  label: '均衡推进',
  summary: '沿用当前默认节奏，优先跟随既有路线与目标窗口。',
  riskBias: 'medium',
  lineBias: 'preferred',
  targetBias: 'weakest',
  intentBias: ['push_lane', 'contest_prime_relay', 'hold_lane']
};

function getCommanderDoctrine(commander) {
  return commander.doctrine ?? defaultDoctrine;
}

function getPreferredLaneRoutes(commander) {
  return commander.preferredLane === 'top'
    ? {
        hold: 'hold_top',
        push: 'top_lane_pressure',
        rotate: 'rotate_mid_to_top'
      }
    : commander.preferredLane === 'bot'
      ? {
          hold: 'hold_bot',
          push: 'bot_lane_pressure',
          rotate: 'rotate_mid_to_bot'
        }
      : {
          hold: 'hold_mid',
          push: 'collapse_mid',
          rotate: 'collapse_mid'
        };
}

function getDoctrinePath(commander, doctrine, preferredLane) {
  if (doctrine.lineBias === 'pressure') {
    return commander.preferredLane === 'bot' ? 'bot_lane_pressure' : 'top_lane_pressure';
  }

  if (doctrine.lineBias === 'hold') {
    return preferredLane.hold;
  }

  if (doctrine.lineBias === 'rotate') {
    return preferredLane.rotate;
  }

  return preferredLane.push;
}

function getDoctrineIntent(commander, doctrine, preferredLane) {
  if (doctrine.lineBias === 'hold') {
    return 'hold_lane';
  }

  if (doctrine.lineBias === 'rotate') {
    return 'split_push';
  }

  if (doctrine.lineBias === 'pressure') {
    return commander.preferredLane === 'mid' ? 'split_push' : 'push_lane';
  }

  return preferredLane.push === 'collapse_mid' ? 'push_lane' : 'push_lane';
}

function getDoctrineRisk(commander, doctrine) {
  if (doctrine.riskBias === 'high') {
    return commander.defaultRisk === 'all_in' ? 'all_in' : 'high';
  }

  if (doctrine.riskBias === 'low') {
    return 'low';
  }

  return commander.defaultRisk;
}

function getDoctrineTarget(snapshot, doctrine, lowHpEnemy) {
  if (doctrine.targetBias === 'nearest') {
    return snapshot.self.visible_enemies[0] ?? null;
  }

  if (doctrine.targetBias === 'objective') {
    return null;
  }

  return lowHpEnemy?.id ?? snapshot.self.visible_enemies[0] ?? null;
}

function buildBaseOrder(commander, snapshot) {
  const doctrine = getCommanderDoctrine(commander);
  const preferredLane = getPreferredLaneRoutes(commander);
  const lowHpEnemy = snapshot.visible_enemy_details.find((enemy) => enemy.hp_ratio < 0.45) ?? null;

  return {
    formation: commander.defaultFormation,
    intent: getDoctrineIntent(commander, doctrine, preferredLane),
    risk_level: getDoctrineRisk(commander, doctrine),
    path_plan: getDoctrinePath(commander, doctrine, preferredLane),
    target_entity_id: getDoctrineTarget(snapshot, doctrine, lowHpEnemy),
    engage_rule: doctrine.lineBias === 'hold' ? 'protect_low_hp_ally' : 'commit_if_numbers_advantage',
    ability_policy: doctrine.lineBias === 'hold' ? 'hold_for_counter_engage' : 'use_on_cooldown',
    confidence: 0.68,
    rationale_tags: ['lane_open']
  };
}

function pickLowHpEnemy(snapshot) {
  return snapshot.visible_enemy_details.find((enemy) => enemy.hp_ratio < 0.45) ?? null;
}

function hasTag(snapshot, tag) {
  return snapshot.threats.includes(tag);
}

function chooseRuleBasedOrder({ commander, snapshot }) {
  const base = buildBaseOrder(commander, snapshot);
  const doctrine = getCommanderDoctrine(commander);
  const preferredLane = getPreferredLaneRoutes(commander);
  const lowHpEnemy = pickLowHpEnemy(snapshot);
  const primeSoon = snapshot.objectives.prime_relay_spawn_in <= 18;
  const primeActive = snapshot.objectives.prime_relay_active;
  const trailing = snapshot.team_score_delta < 0;
  const holdingLead = snapshot.team_score_delta > 1;
  const coreUnderThreat = hasTag(snapshot, 'core_under_threat');
  const outnumbered = hasTag(snapshot, 'numbers_disadvantage');
  const primeWindowSoon = primeSoon && !primeActive;

  if (snapshot.self.hp_ratio < 0.38 || (outnumbered && commander.persona !== 'berserker')) {
    return {
      ...base,
      intent: 'retreat_reset',
      formation: 'column',
      path_plan: 'retreat_home',
      engage_rule: 'disengage_on_low_hp',
      ability_policy: 'hold_for_counter_engage',
      risk_level: 'low',
      confidence: 0.88,
      rationale_tags: ['numbers_disadvantage']
    };
  }

  if (coreUnderThreat) {
    return {
      ...base,
      intent: 'defend_core',
      path_plan: 'defend_base',
      engage_rule: 'protect_low_hp_ally',
      ability_policy: 'protect_carry',
      confidence: 0.86,
      rationale_tags: ['core_under_threat']
    };
  }

  if (
    holdingLead &&
    snapshot.allowed_intents.includes('hold_lane')
  ) {
    if (doctrine.lineBias === 'hold' || commander.persona === 'defensive') {
      return {
        ...base,
        intent: 'hold_lane',
        path_plan: preferredLane.hold,
        engage_rule: 'protect_low_hp_ally',
        ability_policy: 'protect_carry',
        confidence: 0.83,
        rationale_tags: ['holding_lead']
      };
    }

    if (doctrine.lineBias === 'pressure') {
      return {
        ...base,
        intent: 'push_lane',
        path_plan: preferredLane.push,
        risk_level: 'high',
        confidence: 0.8,
        rationale_tags: ['holding_lead']
      };
    }

    return {
      ...base,
      intent: 'hold_lane',
      path_plan: preferredLane.hold,
      engage_rule: 'protect_low_hp_ally',
      ability_policy: 'protect_carry',
      confidence: 0.83,
      rationale_tags: ['holding_lead']
    };
  }

  if (
    lowHpEnemy &&
    snapshot.allowed_intents.includes('collapse_target')
  ) {
    if (doctrine.lineBias === 'hold' && commander.persona !== 'berserker') {
      return {
        ...base,
        intent: 'hold_lane',
        path_plan: preferredLane.hold,
        target_entity_id: getDoctrineTarget(snapshot, doctrine, lowHpEnemy),
        engage_rule: 'protect_low_hp_ally',
        ability_policy: 'protect_carry',
        risk_level: 'low',
        confidence: 0.8,
        rationale_tags: ['enemy_low_hp']
      };
    }

    if (
      commander.persona === 'aggressive' ||
      commander.persona === 'berserker' ||
      doctrine.lineBias === 'pressure' ||
      doctrine.lineBias === 'rotate'
    ) {
      return {
        ...base,
        intent: 'collapse_target',
        path_plan:
          doctrine.lineBias === 'pressure'
            ? getDoctrinePath(commander, doctrine, preferredLane)
            : preferredLane.rotate,
        target_entity_id: getDoctrineTarget(snapshot, doctrine, lowHpEnemy),
        engage_rule: 'commit_if_numbers_advantage',
        ability_policy: 'save_ultimate_for_backline',
        risk_level:
          doctrine.riskBias === 'low' ? 'medium' : commander.persona === 'berserker' ? 'all_in' : 'high',
        confidence: 0.86,
        rationale_tags: ['enemy_low_hp', 'numbers_advantage']
      };
    }

    return {
      ...base,
      intent: 'push_lane',
      path_plan: preferredLane.push,
      target_entity_id: getDoctrineTarget(snapshot, doctrine, lowHpEnemy),
      engage_rule: 'commit_if_numbers_advantage',
      ability_policy: 'use_on_cooldown',
      risk_level: getDoctrineRisk(commander, doctrine),
      confidence: 0.78,
      rationale_tags: ['enemy_low_hp']
    };
  }

  if (
    trailing &&
    commander.persona === 'macro' &&
    primeWindowSoon &&
    snapshot.phase !== 'opening' &&
    snapshot.allowed_intents.includes('split_push')
  ) {
    return {
      ...base,
      intent: 'split_push',
      path_plan:
        doctrine.lineBias === 'rotate'
          ? preferredLane.rotate
          : commander.preferredLane === 'top'
            ? 'top_lane_pressure'
            : 'bot_lane_pressure',
      engage_rule: 'poke_until_pick',
      ability_policy: 'use_on_cooldown',
      risk_level: doctrine.riskBias === 'high' ? 'high' : 'medium',
      confidence: 0.79,
      rationale_tags: ['need_score_swing']
    };
  }

  if ((primeSoon || primeActive) && snapshot.allowed_intents.includes('contest_prime_relay')) {
    return {
      ...base,
      intent: 'contest_prime_relay',
      path_plan: doctrine.lineBias === 'pressure' ? getDoctrinePath(commander, doctrine, preferredLane) : 'collapse_mid',
      engage_rule:
        commander.persona === 'defensive' ? 'protect_low_hp_ally' : 'trade_for_objective',
      ability_policy:
        commander.persona === 'aggressive' || commander.persona === 'berserker'
          ? 'save_ultimate_for_backline'
          : 'hold_for_counter_engage',
      risk_level: trailing || doctrine.riskBias === 'high' ? 'high' : commander.defaultRisk,
      confidence: 0.84,
      rationale_tags: ['objective_spawn_soon', 'nearby_allies_ready']
    };
  }

  if (lowHpEnemy && snapshot.allowed_intents.includes('collapse_target')) {
    return {
      ...base,
      intent: 'collapse_target',
      path_plan: doctrine.lineBias === 'rotate' ? preferredLane.rotate : preferredLane.push,
      target_entity_id: getDoctrineTarget(snapshot, doctrine, lowHpEnemy),
      engage_rule: 'commit_if_numbers_advantage',
      ability_policy:
        commander.persona === 'trickster' ? 'stagger_for_cleanup' : 'save_ultimate_for_backline',
      risk_level: doctrine.riskBias === 'low' ? 'medium' : commander.persona === 'berserker' ? 'all_in' : 'high',
      confidence: 0.82,
      rationale_tags: ['enemy_low_hp', 'numbers_advantage']
    };
  }

  if (trailing && snapshot.phase !== 'opening' && snapshot.allowed_intents.includes('split_push')) {
    return {
      ...base,
      intent: 'split_push',
      path_plan:
        doctrine.lineBias === 'rotate'
          ? preferredLane.rotate
          : commander.preferredLane === 'top'
            ? 'top_lane_pressure'
            : 'bot_lane_pressure',
      engage_rule: 'poke_until_pick',
      ability_policy: 'use_on_cooldown',
      risk_level: doctrine.riskBias === 'high' ? 'high' : 'medium',
      confidence: 0.73,
      rationale_tags: ['need_score_swing']
    };
  }

  return {
    ...base,
    path_plan: base.path_plan,
    confidence: 0.69,
    rationale_tags: base.rationale_tags
  };
}

function chooseMockOrder({ commander, snapshot }) {
  const allowedIntents = snapshot.allowed_intents;
  const pathOptions = snapshot.path_options;
  const orderIndex = (Math.floor(snapshot.match_time_sec / 20) + commander.slot) % allowedIntents.length;
  const pathIndex = (Math.floor(snapshot.match_time_sec / 14) + commander.slot) % pathOptions.length;
  const intent = allowedIntents[orderIndex];

  return {
    intent,
    formation: commander.defaultFormation,
    path_plan: pathOptions[pathIndex],
    target_entity_id:
      intent === 'collapse_target' ? snapshot.self.visible_enemies[0] ?? null : null,
    engage_rule:
      intent === 'retreat_reset' ? 'disengage_on_low_hp' : 'commit_if_numbers_advantage',
    ability_policy: intent === 'protect_carry' ? 'protect_carry' : 'use_on_cooldown',
    risk_level: intent === 'retreat_reset' ? 'low' : commander.defaultRisk,
    confidence: 0.58,
    rationale_tags:
      snapshot.objectives.prime_relay_spawn_in < 15
        ? ['objective_spawn_soon']
        : ['lane_open']
  };
}

async function chooseLlmOrder() {
  throw new Error('LLM commander is not configured for phase 1.');
}

export function getCommanderProvider(type) {
  if (type === 'rule-based') {
    return chooseRuleBasedOrder;
  }

  if (type === 'llm') {
    return chooseLlmOrder;
  }

  return chooseMockOrder;
}

export async function resolveCommanderOrder({
  commander,
  snapshot,
  previousOrder = null
}) {
  const snapshotValidation = validateBattleSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    throw new Error(`Invalid battle snapshot: ${snapshotValidation.errors.join(' ')}`);
  }

  const provider = getCommanderProvider(commander.brainType);
  const validationContext = createValidationContextFromSnapshot(snapshot);
  const startedAt = Date.now();
  let rawOrder = null;
  let fallbackReason = null;

  try {
    rawOrder = await provider({ commander, snapshot, previousOrder });
  } catch (error) {
    fallbackReason = error instanceof Error ? error.message : 'unknown provider error';
  }

  const rawValidation = rawOrder
    ? validateCommanderOrder(rawOrder, validationContext)
    : { ok: false, errors: [fallbackReason ?? 'provider did not return an order'] };

  const order = sanitizeCommanderOrder(rawOrder, {
    snapshot,
    previousOrder,
    fallbackIntent:
      commander.persona === 'defensive' ? 'hold_lane' : commander.persona === 'berserker' ? 'collapse_target' : 'push_lane'
  });

  return {
    order,
    meta: {
      source: rawValidation.ok ? commander.brainType : `${commander.brainType}:fallback`,
      fallbackUsed: !rawValidation.ok,
      fallbackReason,
      validationErrors: rawValidation.ok ? [] : rawValidation.errors,
      latencyMs: Date.now() - startedAt
    }
  };
}
