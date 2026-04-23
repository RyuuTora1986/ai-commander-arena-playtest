export const TEAM_IDS = ['blue', 'red'];
export const MATCH_PHASES = ['opening', 'midgame', 'endgame', 'overclock'];
export const INTENTS = [
  'hold_lane',
  'push_lane',
  'collapse_target',
  'retreat_reset',
  'contest_prime_relay',
  'split_push',
  'protect_carry',
  'defend_core'
];
export const FORMATIONS = ['line', 'wedge', 'screen', 'column'];
export const PATH_PLANS = [
  'hold_mid',
  'hold_top',
  'hold_bot',
  'retreat_home',
  'top_lane_pressure',
  'bot_lane_pressure',
  'rotate_mid_to_top',
  'rotate_mid_to_bot',
  'collapse_mid',
  'defend_base',
  'siege_core'
];
export const ENGAGE_RULES = [
  'commit_if_numbers_advantage',
  'poke_until_pick',
  'protect_low_hp_ally',
  'disengage_on_low_hp',
  'trade_for_objective'
];
export const ABILITY_POLICIES = [
  'save_ultimate_for_backline',
  'use_on_cooldown',
  'hold_for_counter_engage',
  'stagger_for_cleanup',
  'protect_carry'
];
export const RISK_LEVELS = ['low', 'medium', 'high', 'all_in'];
export const RATIONALE_TAGS = [
  'objective_spawn_soon',
  'nearby_allies_ready',
  'enemy_ult_down',
  'enemy_low_hp',
  'numbers_advantage',
  'numbers_disadvantage',
  'core_under_threat',
  'need_score_swing',
  'lane_open',
  'holding_lead',
  'fallback_safe_order',
  'previous_order_reused'
];

const ENUM_LOOKUPS = {
  intent: INTENTS,
  formation: FORMATIONS,
  path_plan: PATH_PLANS,
  engage_rule: ENGAGE_RULES,
  ability_policy: ABILITY_POLICIES,
  risk_level: RISK_LEVELS
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toUniqueStrings(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => typeof value === 'string'))];
}

function validateEnumField(errors, input, fieldName, allowedValues) {
  if (typeof input[fieldName] !== 'string') {
    errors.push(`${fieldName} must be a string.`);
    return;
  }

  if (!allowedValues.includes(input[fieldName])) {
    errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
  }
}

function validateStringArray(errors, input, fieldName, allowedValues) {
  if (!Array.isArray(input[fieldName])) {
    errors.push(`${fieldName} must be an array of strings.`);
    return;
  }

  for (const value of input[fieldName]) {
    if (typeof value !== 'string') {
      errors.push(`${fieldName} entries must be strings.`);
      continue;
    }

    if (allowedValues && !allowedValues.includes(value)) {
      errors.push(`${fieldName} contains unsupported value "${value}".`);
    }
  }
}

function selectSafePath(snapshot, desiredIntent) {
  const pathOptions = toUniqueStrings(snapshot?.path_options);
  const preferredOrder = {
    retreat_reset: ['retreat_home', 'defend_base', 'hold_mid'],
    contest_prime_relay: ['collapse_mid', 'hold_mid', 'rotate_mid_to_top', 'rotate_mid_to_bot'],
    collapse_target: ['collapse_mid', 'rotate_mid_to_top', 'rotate_mid_to_bot'],
    push_lane: ['top_lane_pressure', 'bot_lane_pressure', 'hold_mid'],
    hold_lane: ['hold_mid', 'hold_top', 'hold_bot'],
    split_push: ['bot_lane_pressure', 'top_lane_pressure'],
    defend_core: ['defend_base', 'retreat_home', 'hold_mid'],
    protect_carry: ['hold_mid', 'retreat_home']
  };

  const preferredPaths = preferredOrder[desiredIntent] ?? ['hold_mid', 'retreat_home'];
  const selectedPath = preferredPaths.find((path) => pathOptions.includes(path));
  return selectedPath ?? pathOptions[0] ?? 'hold_mid';
}

function selectSafeTarget(snapshot) {
  const visibleTargets = toUniqueStrings(snapshot?.self?.visible_enemies);
  return visibleTargets[0] ?? null;
}

export function createValidationContextFromSnapshot(snapshot) {
  return {
    allowedIntents: toUniqueStrings(snapshot?.allowed_intents),
    allowedPathPlans: toUniqueStrings(snapshot?.path_options),
    visibleTargetIds: toUniqueStrings(snapshot?.self?.visible_enemies)
  };
}

export function createSafeCommanderOrder({
  snapshot,
  previousOrder = null,
  fallbackIntent = 'hold_lane'
} = {}) {
  const allowedIntents = toUniqueStrings(snapshot?.allowed_intents);
  const safeIntent = allowedIntents.includes(fallbackIntent)
    ? fallbackIntent
    : previousOrder?.intent && allowedIntents.includes(previousOrder.intent)
      ? previousOrder.intent
      : allowedIntents[0] ?? 'hold_lane';

  const order = {
    intent: safeIntent,
    formation: previousOrder?.formation && FORMATIONS.includes(previousOrder.formation)
      ? previousOrder.formation
      : safeIntent === 'retreat_reset'
        ? 'column'
        : 'line',
    path_plan: selectSafePath(snapshot, safeIntent),
    target_entity_id:
      safeIntent === 'collapse_target' || safeIntent === 'protect_carry'
        ? selectSafeTarget(snapshot)
        : null,
    engage_rule:
      safeIntent === 'retreat_reset' || safeIntent === 'defend_core'
        ? 'disengage_on_low_hp'
        : 'commit_if_numbers_advantage',
    ability_policy:
      safeIntent === 'protect_carry'
        ? 'protect_carry'
        : safeIntent === 'retreat_reset'
          ? 'hold_for_counter_engage'
          : 'use_on_cooldown',
    risk_level: safeIntent === 'retreat_reset' ? 'low' : 'medium',
    confidence: 0.35,
    rationale_tags: ['fallback_safe_order']
  };

  const validation = validateCommanderOrder(order, createValidationContextFromSnapshot(snapshot));
  return validation.ok ? validation.value : {
    ...order,
    intent: 'hold_lane',
    path_plan: 'hold_mid'
  };
}

export function validateCommanderOrder(input, context = {}) {
  const errors = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: ['CommanderOrder must be an object.']
    };
  }

  for (const [fieldName, allowedValues] of Object.entries(ENUM_LOOKUPS)) {
    validateEnumField(errors, input, fieldName, allowedValues);
  }

  if (input.target_entity_id !== null && input.target_entity_id !== undefined) {
    if (typeof input.target_entity_id !== 'string') {
      errors.push('target_entity_id must be a string or null.');
    } else if (
      Array.isArray(context.visibleTargetIds) &&
      context.visibleTargetIds.length > 0 &&
      !context.visibleTargetIds.includes(input.target_entity_id)
    ) {
      errors.push('target_entity_id must refer to a currently visible target.');
    }
  }

  if (typeof input.confidence !== 'number' || Number.isNaN(input.confidence)) {
    errors.push('confidence must be a number.');
  } else if (input.confidence < 0 || input.confidence > 1) {
    errors.push('confidence must be between 0 and 1.');
  }

  validateStringArray(errors, input, 'rationale_tags', RATIONALE_TAGS);

  if (
    Array.isArray(context.allowedIntents) &&
    context.allowedIntents.length > 0 &&
    typeof input.intent === 'string' &&
    !context.allowedIntents.includes(input.intent)
  ) {
    errors.push('intent is not allowed in the current battle snapshot.');
  }

  if (
    Array.isArray(context.allowedPathPlans) &&
    context.allowedPathPlans.length > 0 &&
    typeof input.path_plan === 'string' &&
    !context.allowedPathPlans.includes(input.path_plan)
  ) {
    errors.push('path_plan is not allowed in the current battle snapshot.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      intent: input.intent,
      formation: input.formation,
      path_plan: input.path_plan,
      target_entity_id: input.target_entity_id ?? null,
      engage_rule: input.engage_rule,
      ability_policy: input.ability_policy,
      risk_level: input.risk_level,
      confidence: Number(input.confidence.toFixed(2)),
      rationale_tags: toUniqueStrings(input.rationale_tags).slice(0, 3)
    }
  };
}

export function sanitizeCommanderOrder(
  candidate,
  {
    snapshot,
    previousOrder = null,
    fallbackIntent = 'hold_lane'
  } = {}
) {
  const context = createValidationContextFromSnapshot(snapshot);

  if (candidate) {
    const directValidation = validateCommanderOrder(candidate, context);
    if (directValidation.ok) {
      return directValidation.value;
    }
  }

  if (previousOrder) {
    const previousValidation = validateCommanderOrder(previousOrder, context);
    if (previousValidation.ok) {
      return {
        ...previousValidation.value,
        rationale_tags: ['previous_order_reused']
      };
    }
  }

  return createSafeCommanderOrder({
    snapshot,
    previousOrder,
    fallbackIntent
  });
}

export function validateBattleSnapshot(snapshot) {
  const errors = [];

  if (!isPlainObject(snapshot)) {
    return { ok: false, errors: ['BattleSnapshot must be an object.'] };
  }

  if (typeof snapshot.match_time_sec !== 'number') {
    errors.push('match_time_sec must be a number.');
  }

  if (!MATCH_PHASES.includes(snapshot.phase)) {
    errors.push(`phase must be one of: ${MATCH_PHASES.join(', ')}.`);
  }

  if (!isPlainObject(snapshot.self)) {
    errors.push('self must be an object.');
  } else {
    validateStringArray(errors, snapshot.self, 'visible_enemies');
  }

  validateStringArray(errors, snapshot, 'allowed_intents', INTENTS);
  validateStringArray(errors, snapshot, 'path_options', PATH_PLANS);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: snapshot };
}

export function validateReplayEvent(event) {
  const errors = [];

  if (!isPlainObject(event)) {
    return { ok: false, errors: ['ReplayEvent must be an object.'] };
  }

  if (typeof event.type !== 'string') {
    errors.push('type must be a string.');
  }

  if (typeof event.tick !== 'number') {
    errors.push('tick must be a number.');
  }

  if (typeof event.match_time_sec !== 'number') {
    errors.push('match_time_sec must be a number.');
  }

  if (!isPlainObject(event.payload)) {
    errors.push('payload must be an object.');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: event };
}

export function validateUnitDefinition(unit) {
  const errors = [];

  if (!isPlainObject(unit)) {
    return { ok: false, errors: ['UnitDefinition must be an object.'] };
  }

  for (const field of ['id', 'name', 'role']) {
    if (typeof unit[field] !== 'string') {
      errors.push(`${field} must be a string.`);
    }
  }

  for (const field of ['maxHp', 'attackDamage', 'attackRange', 'moveSpeed', 'attackCooldownMs']) {
    if (typeof unit[field] !== 'number') {
      errors.push(`${field} must be a number.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: unit };
}

export function validateMapDefinition(map) {
  const errors = [];

  if (!isPlainObject(map)) {
    return { ok: false, errors: ['MapDefinition must be an object.'] };
  }

  if (typeof map.id !== 'string' || typeof map.name !== 'string') {
    errors.push('MapDefinition must include id and name.');
  }

  if (!isPlainObject(map.size)) {
    errors.push('MapDefinition must include size.');
  }

  if (!isPlainObject(map.routes)) {
    errors.push('MapDefinition must include routes.');
  } else {
    for (const routeName of Object.keys(map.routes)) {
      if (!PATH_PLANS.includes(routeName)) {
        errors.push(`Unsupported route "${routeName}" declared in map.`);
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: map };
}

export function validateCommanderDefinition(commander) {
  const errors = [];

  if (!isPlainObject(commander)) {
    return { ok: false, errors: ['CommanderDefinition must be an object.'] };
  }

  for (const field of ['id', 'name', 'persona', 'preferredLane', 'defaultFormation', 'defaultRisk']) {
    if (typeof commander[field] !== 'string') {
      errors.push(`${field} must be a string.`);
    }
  }

  if (!FORMATIONS.includes(commander.defaultFormation)) {
    errors.push('defaultFormation must use a supported formation.');
  }

  if (!RISK_LEVELS.includes(commander.defaultRisk)) {
    errors.push('defaultRisk must use a supported risk level.');
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: commander };
}
