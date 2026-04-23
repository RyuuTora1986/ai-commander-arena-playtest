import { resolveCommanderOrder } from '../../ai-gateway/src/index.mjs';
import { createSafeCommanderOrder, validateReplayEvent } from '../../shared-types/src/index.mjs';
import { averagePosition, clamp, distance, moveTowards, sum, teamEnemy } from './helpers.mjs';
import { buildBattleSnapshot } from './snapshot.mjs';
import { createReplayFrame } from './view.mjs';

const FORMATION_OFFSETS = {
  line: [
    { x: -24, y: -28 },
    { x: 18, y: -12 },
    { x: 0, y: 20 },
    { x: 42, y: 16 },
    { x: -38, y: 18 }
  ],
  wedge: [
    { x: 0, y: -34 },
    { x: 24, y: -6 },
    { x: -24, y: -6 },
    { x: 38, y: 22 },
    { x: -38, y: 22 }
  ],
  screen: [
    { x: -32, y: -18 },
    { x: 0, y: -8 },
    { x: 32, y: -18 },
    { x: -18, y: 22 },
    { x: 18, y: 22 }
  ],
  column: [
    { x: 0, y: -42 },
    { x: 0, y: -14 },
    { x: 0, y: 14 },
    { x: 0, y: 42 },
    { x: 0, y: 70 }
  ]
};

function clonePosition(position) {
  return { x: position.x, y: position.y };
}

function emitReplayEvent(state, event) {
  const validated = validateReplayEvent(event);
  if (!validated.ok) {
    throw new Error(`Invalid replay event: ${validated.errors.join(' ')}`);
  }

  state.replay.events.push(validated.value);
}

function captureReplayFrame(state) {
  state.replay.frames.push(createReplayFrame(state));
}

function awardScore(state, teamId, value, reason) {
  state.score[teamId] = Number((state.score[teamId] + value).toFixed(2));
  emitReplayEvent(state, {
    type: 'score_changed',
    tick: state.clock.tick,
    match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
    payload: {
      teamId,
      value,
      total: state.score[teamId],
      reason
    }
  });
}

function addTeamBuff(state, teamId, buff) {
  state.buffs[teamId].push({
    ...buff,
    expiresAtMs: state.clock.elapsedMs + buff.durationMs
  });
}

function getTeamBuffMultiplier(state, teamId) {
  const hasPrimeBuff = state.buffs[teamId].some((buff) => buff.type === 'prime-relay');
  return hasPrimeBuff ? 1.15 : 1;
}

function getCommanderUnits(state, commanderId) {
  return state.units.filter((unit) => unit.commanderId === commanderId);
}

function getLivingCommanderUnits(state, commanderId) {
  return getCommanderUnits(state, commanderId).filter((unit) => unit.alive);
}

function getSquadAnchor(state, commander) {
  const livingUnits = getLivingCommanderUnits(state, commander.id);
  return livingUnits.length > 0
    ? averagePosition(livingUnits.map((unit) => unit.position))
    : clonePosition(state.spawnAnchors[commander.id]);
}

function getRoute(state, teamId, pathPlan) {
  return state.map.routes[pathPlan]?.[teamId] ?? state.map.routes.hold_mid[teamId];
}

function determineRouteTarget(state, commander) {
  const order = commander.currentOrder;
  const route = getRoute(state, commander.teamId, order.path_plan);

  if (order.intent === 'collapse_target' && order.target_entity_id) {
    const targetCommander = state.commanders.find((candidate) => candidate.id === order.target_entity_id);
    if (targetCommander) {
      const targetUnits = getLivingCommanderUnits(state, targetCommander.id);
      if (targetUnits.length > 0) {
        return averagePosition(targetUnits.map((unit) => unit.position));
      }
    }
  }

  if (order.intent === 'defend_core') {
    return clonePosition(state.structures[`${commander.teamId}Core`].position);
  }

  const currentWaypoint = route[Math.min(commander.routeIndex, route.length - 1)];
  return clonePosition(currentWaypoint);
}

function updateCommanderRouteProgress(state, commander, targetPoint) {
  const route = getRoute(state, commander.teamId, commander.currentOrder.path_plan);
  if (route.length <= 1) {
    commander.routeIndex = 0;
    return;
  }

  const anchor = getSquadAnchor(state, commander);
  const waypoint = route[Math.min(commander.routeIndex, route.length - 1)];
  const arrivalThreshold = 52;

  if (distance(anchor, waypoint) <= arrivalThreshold && commander.routeIndex < route.length - 1) {
    commander.routeIndex += 1;
  }

  if (commander.currentOrder.intent === 'retreat_reset') {
    commander.routeIndex = 0;
  }

  commander.anchorTarget = targetPoint;
}

function shouldEngage(state, unit, commander) {
  const order = commander.currentOrder;
  if (order.intent === 'retreat_reset') {
    return false;
  }

  const alliedUnits = state.units.filter(
    (candidate) =>
      candidate.alive &&
      candidate.teamId === unit.teamId &&
      distance(candidate.position, unit.position) <= 180
  );
  const enemyUnits = state.units.filter(
    (candidate) =>
      candidate.alive &&
      candidate.teamId !== unit.teamId &&
      distance(candidate.position, unit.position) <= 180
  );

  if (order.engage_rule === 'commit_if_numbers_advantage') {
    return alliedUnits.length >= enemyUnits.length;
  }

  if (order.engage_rule === 'protect_low_hp_ally') {
    return alliedUnits.some((ally) => ally.hp / ally.maxHp < 0.45);
  }

  if (order.engage_rule === 'disengage_on_low_hp') {
    return unit.hp / unit.maxHp > 0.5;
  }

  return true;
}

function findNearestEnemy(state, unit, extraRange = 0) {
  const candidates = state.units.filter(
    (enemy) => enemy.alive && enemy.teamId !== unit.teamId
  );

  let selected = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const currentDistance = distance(unit.position, candidate.position);
    if (currentDistance <= unit.attackRange + extraRange && currentDistance < bestDistance) {
      bestDistance = currentDistance;
      selected = candidate;
    }
  }

  return selected;
}

function findLowestHpAlly(state, unit, radius) {
  const allies = state.units.filter(
    (candidate) =>
      candidate.alive &&
      candidate.teamId === unit.teamId &&
      distance(candidate.position, unit.position) <= radius
  );

  return allies.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0] ?? null;
}

function applyDamage(state, attacker, target, amount, reason) {
  if (!attacker || !target || !target.alive) {
    return;
  }

  target.hp = Math.max(0, target.hp - amount);
  emitReplayEvent(state, {
    type: 'damage',
    tick: state.clock.tick,
    match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
    payload: {
      attackerId: attacker.id,
      targetId: target.id,
      amount,
      reason
    }
  });

  if (target.hp === 0) {
    target.alive = false;
    target.respawnAtMs =
      state.clock.elapsedMs +
      (state.phase === 'overclock' ? state.rules.overclockRespawnMs : state.rules.baseRespawnMs);
    state.metrics.kills[target.teamId] += 1;
    awardScore(state, attacker.teamId, state.rules.killScore, 'elimination');
    emitReplayEvent(state, {
      type: 'unit_eliminated',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {
        attackerId: attacker.id,
        targetId: target.id,
        teamId: target.teamId
      }
    });
  }
}

function applyHealing(unit, amount) {
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
}

function useAbilityIfReady(state, unit, commander) {
  if (!unit.alive || unit.abilityCooldownMs > 0) {
    return;
  }

  const ability = unit.ability;

  if (ability.type === 'single-heal') {
    const ally = findLowestHpAlly(state, unit, ability.radius);
    if (ally && ally.hp / ally.maxHp < 0.85) {
      applyHealing(ally, ability.power);
      unit.abilityCooldownMs = ability.cooldownMs;
      emitReplayEvent(state, {
        type: 'ability_used',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          unitId: unit.id,
          abilityId: ability.id,
          targetId: ally.id
        }
      });
    }
    return;
  }

  if (ability.type === 'ally-burst-heal') {
    const allies = state.units.filter(
      (candidate) =>
        candidate.alive &&
        candidate.teamId === unit.teamId &&
        distance(candidate.position, unit.position) <= ability.radius
    );

    if (allies.some((ally) => ally.hp / ally.maxHp < 0.9)) {
      for (const ally of allies) {
        applyHealing(ally, ability.power);
      }
      unit.abilityCooldownMs = ability.cooldownMs;
      emitReplayEvent(state, {
        type: 'ability_used',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          unitId: unit.id,
          abilityId: ability.id
        }
      });
    }
    return;
  }

  if (ability.type === 'aoe-damage') {
    const enemies = state.units.filter(
      (candidate) =>
        candidate.alive &&
        candidate.teamId !== unit.teamId &&
        distance(candidate.position, unit.position) <= unit.attackRange + 35
    );

    if (enemies.length >= 2) {
      for (const enemy of enemies.slice(0, 3)) {
        applyDamage(state, unit, enemy, ability.power, ability.id);
      }
      unit.abilityCooldownMs = ability.cooldownMs;
      emitReplayEvent(state, {
        type: 'ability_used',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          unitId: unit.id,
          abilityId: ability.id
        }
      });
    }
    return;
  }

  if (ability.type === 'execute-dash') {
    const enemies = state.units.filter(
      (candidate) =>
        candidate.alive &&
        candidate.teamId !== unit.teamId &&
        distance(candidate.position, unit.position) <= ability.radius
    );
    const target = enemies.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0] ?? null;
    if (target && target.hp / target.maxHp < 0.7) {
      unit.position = moveTowards(unit.position, target.position, 30);
      applyDamage(state, unit, target, ability.power, ability.id);
      unit.abilityCooldownMs = ability.cooldownMs;
      emitReplayEvent(state, {
        type: 'ability_used',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          unitId: unit.id,
          abilityId: ability.id,
          targetId: target.id
        }
      });
    }
    return;
  }

  if (ability.type === 'self-buff') {
    const target = findNearestEnemy(state, unit, 16);
    if (target) {
      applyDamage(state, unit, target, ability.power, ability.id);
      unit.abilityCooldownMs = ability.cooldownMs;
      emitReplayEvent(state, {
        type: 'ability_used',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          unitId: unit.id,
          abilityId: ability.id,
          targetId: target.id
        }
      });
    }
  }
}

function attackEnemyIfPossible(state, unit, commander) {
  if (!unit.alive || unit.attackCooldownMsRemaining > 0 || !shouldEngage(state, unit, commander)) {
    return false;
  }

  const target = findNearestEnemy(state, unit, 8);
  if (!target) {
    return false;
  }

  const damageMultiplier = getTeamBuffMultiplier(state, unit.teamId);
  applyDamage(state, unit, target, Math.round(unit.attackDamage * damageMultiplier), 'basic_attack');
  unit.attackCooldownMsRemaining = unit.attackCooldownMs;
  return true;
}

function moveUnit(state, unit, commander, targetAnchor) {
  if (!unit.alive) {
    return;
  }

  const offsets = FORMATION_OFFSETS[commander.currentOrder.formation] ?? FORMATION_OFFSETS.line;
  const offset = offsets[unit.slotIndex] ?? { x: 0, y: 0 };
  const targetPosition = {
    x: clamp(targetAnchor.x + (commander.teamId === 'blue' ? offset.x : -offset.x), 48, state.map.size.width - 48),
    y: clamp(targetAnchor.y + offset.y, 48, state.map.size.height - 48)
  };

  if (commander.currentOrder.intent === 'retreat_reset' && unit.hp / unit.maxHp < 0.5) {
    unit.position = moveTowards(unit.position, targetPosition, unit.moveSpeed * (state.rules.tickMs / 1000));
    return;
  }

  const threat = findNearestEnemy(state, unit, state.rules.unitLeashRange);
  if (threat && distance(unit.position, threat.position) <= unit.attackRange + 12) {
    return;
  }

  unit.position = moveTowards(unit.position, targetPosition, unit.moveSpeed * (state.rules.tickMs / 1000));
}

function updateObjectives(state) {
  const objectiveEntries = [state.objectives.topBeacon, state.objectives.botBeacon];

  for (const objective of objectiveEntries) {
    const blueCount = state.units.filter(
      (unit) => unit.alive && unit.teamId === 'blue' && distance(unit.position, objective.position) <= objective.radius
    ).length;
    const redCount = state.units.filter(
      (unit) => unit.alive && unit.teamId === 'red' && distance(unit.position, objective.position) <= objective.radius
    ).length;

    if (blueCount > 0 && redCount === 0) {
      objective.captureTeam = 'blue';
      objective.captureProgress += state.rules.objectiveCaptureRatePerUnit * Math.min(3, blueCount) / 2;
    } else if (redCount > 0 && blueCount === 0) {
      objective.captureTeam = 'red';
      objective.captureProgress += state.rules.objectiveCaptureRatePerUnit * Math.min(3, redCount) / 2;
    } else {
      objective.captureProgress = Math.max(0, objective.captureProgress - state.rules.tickMs);
      if (objective.captureProgress === 0) {
        objective.captureTeam = null;
      }
    }

    if (objective.captureTeam && objective.captureProgress >= objective.captureMs) {
      if (objective.owner !== objective.captureTeam) {
        objective.owner = objective.captureTeam;
        awardScore(state, objective.owner, objective.captureScore, `${objective.id}_capture`);
        emitReplayEvent(state, {
          type: 'objective_captured',
          tick: state.clock.tick,
          match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
          payload: {
            objectiveId: objective.id,
            owner: objective.owner
          }
        });
      }
      objective.captureProgress = 0;
      objective.captureTeam = null;
    }

    if (objective.owner) {
      objective.scorePulseRemainingMs -= state.rules.tickMs;
      if (objective.scorePulseRemainingMs <= 0) {
        awardScore(
          state,
          objective.owner,
          state.phase === 'overclock' ? objective.scorePerPulse * 2 : objective.scorePerPulse,
          `${objective.id}_control`
        );
        objective.scorePulseRemainingMs = objective.scorePulseMs;
      }
    }
  }

  const prime = state.objectives.primeRelay;
  if (!prime.active && state.clock.elapsedMs >= prime.nextSpawnMs) {
    prime.active = true;
    prime.owner = null;
    prime.captureProgress = 0;
    prime.captureTeam = null;
    emitReplayEvent(state, {
      type: 'prime_relay_activated',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {
        objectiveId: prime.id
      }
    });
  }

  if (!prime.active) {
    return;
  }

  const blueCount = state.units.filter(
    (unit) => unit.alive && unit.teamId === 'blue' && distance(unit.position, prime.position) <= prime.radius
  ).length;
  const redCount = state.units.filter(
    (unit) => unit.alive && unit.teamId === 'red' && distance(unit.position, prime.position) <= prime.radius
  ).length;

  if (blueCount > 0 && redCount === 0) {
    prime.captureTeam = 'blue';
    prime.captureProgress += state.rules.objectiveCaptureRatePerUnit * Math.min(3, blueCount) / 2;
  } else if (redCount > 0 && blueCount === 0) {
    prime.captureTeam = 'red';
    prime.captureProgress += state.rules.objectiveCaptureRatePerUnit * Math.min(3, redCount) / 2;
  } else {
    prime.captureProgress = Math.max(0, prime.captureProgress - state.rules.tickMs);
    if (prime.captureProgress === 0) {
      prime.captureTeam = null;
    }
  }

  if (prime.captureTeam && prime.captureProgress >= prime.captureMs) {
    prime.owner = prime.captureTeam;
    awardScore(state, prime.owner, prime.captureScore, 'prime_relay_capture');
    addTeamBuff(state, prime.owner, {
      type: 'prime-relay',
      durationMs: prime.buffMs
    });
    emitReplayEvent(state, {
      type: 'objective_captured',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {
        objectiveId: prime.id,
        owner: prime.owner
      }
    });
    prime.active = false;
    prime.captureProgress = 0;
    prime.captureTeam = null;
    prime.nextSpawnMs = state.clock.elapsedMs + prime.respawnMs;
  }
}

function updateCorePressure(state) {
  for (const attackerTeam of ['blue', 'red']) {
    const defenderTeam = teamEnemy(attackerTeam);
    const enemyCore = state.structures[`${defenderTeam}Core`];
    const attackers = state.units.filter(
      (unit) =>
        unit.alive &&
        unit.teamId === attackerTeam &&
        distance(unit.position, enemyCore.position) <= state.rules.coreAttackRange &&
        state.commanders.find((commander) => commander.id === unit.commanderId)?.currentOrder.intent !== 'retreat_reset'
    );

    if (attackers.length === 0) {
      continue;
    }

    const totalDamage = attackers.length * state.rules.coreDamage * (state.phase === 'overclock' ? 1.35 : 1);
    enemyCore.hp = Math.max(0, enemyCore.hp - totalDamage);
    emitReplayEvent(state, {
      type: 'core_damage',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {
        teamId: attackerTeam,
        targetCore: defenderTeam,
        amount: totalDamage,
        hpRemaining: enemyCore.hp
      }
    });
  }
}

function updateRespawns(state) {
  for (const unit of state.units) {
    unit.attackCooldownMsRemaining = Math.max(0, unit.attackCooldownMsRemaining - state.rules.tickMs);
    unit.abilityCooldownMs = Math.max(0, unit.abilityCooldownMs - state.rules.tickMs);

    if (unit.alive || unit.respawnAtMs === null || state.clock.elapsedMs < unit.respawnAtMs) {
      continue;
    }

    unit.alive = true;
    unit.hp = unit.maxHp;
    unit.respawnAtMs = null;
    unit.position = clonePosition(state.spawnAnchors[unit.commanderId]);
    emitReplayEvent(state, {
      type: 'unit_respawned',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {
        unitId: unit.id,
        teamId: unit.teamId
      }
    });
  }
}

function expireBuffs(state) {
  for (const teamId of ['blue', 'red']) {
    state.buffs[teamId] = state.buffs[teamId].filter((buff) => buff.expiresAtMs > state.clock.elapsedMs);
  }
}

export function createMatchState(config) {
  const state = {
    matchId: config.matchId,
    contentVersion: config.contentVersion,
    map: config.map,
    rules: config.rules,
    clock: {
      tick: 0,
      elapsedMs: 0
    },
    phase: 'opening',
    score: {
      blue: 0,
      red: 0
    },
    metrics: {
      invalidOrderCount: 0,
      fallbackCount: 0,
      commandLatencyMsTotal: 0,
      ordersIssued: 0,
      kills: {
        blue: 0,
        red: 0
      }
    },
    replay: {
      events: [],
      frames: []
    },
    buffs: {
      blue: [],
      red: []
    },
    structures: {
      blueCore: {
        id: 'blue-core',
        position: clonePosition(config.map.corePositions.blue),
        hp: config.rules.coreHp,
        maxHp: config.rules.coreHp
      },
      redCore: {
        id: 'red-core',
        position: clonePosition(config.map.corePositions.red),
        hp: config.rules.coreHp,
        maxHp: config.rules.coreHp
      }
    },
    objectives: {
      topBeacon: {
        ...config.map.objectives.topBeacon,
        position: { x: config.map.objectives.topBeacon.x, y: config.map.objectives.topBeacon.y },
        owner: null,
        captureProgress: 0,
        captureTeam: null,
        scorePulseRemainingMs: config.map.objectives.topBeacon.scorePulseMs
      },
      botBeacon: {
        ...config.map.objectives.botBeacon,
        position: { x: config.map.objectives.botBeacon.x, y: config.map.objectives.botBeacon.y },
        owner: null,
        captureProgress: 0,
        captureTeam: null,
        scorePulseRemainingMs: config.map.objectives.botBeacon.scorePulseMs
      },
      primeRelay: {
        ...config.map.objectives.primeRelay,
        position: { x: config.map.objectives.primeRelay.x, y: config.map.objectives.primeRelay.y },
        owner: null,
        active: false,
        nextSpawnMs: config.map.objectives.primeRelay.spawnMs,
        captureProgress: 0,
        captureTeam: null
      }
    },
    commanders: [],
    units: [],
    spawnAnchors: {},
    summary: null
  };

  for (const teamId of ['blue', 'red']) {
    const teamConfig = config.teamConfigs[teamId];
    for (const commander of teamConfig.commanders) {
      const commanderId = `${teamId}-c${commander.slot + 1}`;
      const spawnAnchor = clonePosition(config.map.commanderSpawns[teamId][commander.slot]);
      state.spawnAnchors[commanderId] = spawnAnchor;
      state.commanders.push({
        ...commander,
        id: commanderId,
        currentOrder: createSafeCommanderOrder({
          snapshot: {
            allowed_intents: ['hold_lane', 'push_lane', 'retreat_reset'],
            path_options: ['hold_mid', 'retreat_home'],
            self: {
              visible_enemies: []
            }
          },
          fallbackIntent: commander.persona === 'defensive' ? 'hold_lane' : 'push_lane'
        }),
        lastOrderMeta: null,
        routeIndex: 0,
        anchorTarget: spawnAnchor
      });

      config.squadTemplate.forEach((roleId, index) => {
        const archetype = config.unitArchetypes.find((unit) => unit.id === roleId);
        const unitId = `${commanderId}-${roleId}-${index + 1}`;
        state.units.push({
          id: unitId,
          commanderId,
          teamId,
          roleId,
          slotIndex: index,
          position: {
            x: spawnAnchor.x + index * 8,
            y: spawnAnchor.y + (index % 2 === 0 ? -12 : 12)
          },
          hp: archetype.maxHp,
          maxHp: archetype.maxHp,
          attackDamage: archetype.attackDamage,
          attackRange: archetype.attackRange,
          moveSpeed: archetype.moveSpeed,
          attackCooldownMs: archetype.attackCooldownMs,
          attackCooldownMsRemaining: 0,
          ability: { ...archetype.ability },
          abilityCooldownMs: 0,
          alive: true,
          respawnAtMs: null
        });
      });
    }
  }

  emitReplayEvent(state, {
    type: 'match_started',
    tick: 0,
    match_time_sec: 0,
    payload: {
      contentVersion: state.contentVersion
    }
  });

  captureReplayFrame(state);

  return state;
}

export function resolveWinner(state) {
  if (state.structures.blueCore.hp <= 0) {
    return { winner: 'red', reason: 'core_destroyed' };
  }

  if (state.structures.redCore.hp <= 0) {
    return { winner: 'blue', reason: 'core_destroyed' };
  }

  if (state.clock.elapsedMs < state.rules.maxMatchMs) {
    return null;
  }

  if (state.score.blue !== state.score.red) {
    return {
      winner: state.score.blue > state.score.red ? 'blue' : 'red',
      reason: 'score_timeout'
    };
  }

  const blueCoreRatio = state.structures.blueCore.hp / state.structures.blueCore.maxHp;
  const redCoreRatio = state.structures.redCore.hp / state.structures.redCore.maxHp;
  if (blueCoreRatio !== redCoreRatio) {
    return {
      winner: blueCoreRatio > redCoreRatio ? 'blue' : 'red',
      reason: 'core_tiebreak'
    };
  }

  if (state.metrics.kills.blue !== state.metrics.kills.red) {
    return {
      winner: state.metrics.kills.blue < state.metrics.kills.red ? 'blue' : 'red',
      reason: 'kill_tiebreak'
    };
  }

  return {
    winner: 'blue',
    reason: 'deterministic_tiebreak'
  };
}

function finalizeMatch(state, winnerInfo) {
  if (state.summary) {
    return state.summary;
  }

  state.summary = {
    winner: winnerInfo.winner,
    reason: winnerInfo.reason,
    durationSec: Math.floor(state.clock.elapsedMs / 1000),
    commandersPerTeam: 3,
    unitsPerCommander: 5,
    score: { ...state.score },
    invalidOrderCount: state.metrics.invalidOrderCount,
    fallbackCount: state.metrics.fallbackCount
  };

  emitReplayEvent(state, {
    type: 'match_ended',
    tick: state.clock.tick,
    match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
    payload: state.summary
  });

  captureReplayFrame(state);

  return state.summary;
}

export async function stepMatch(state) {
  if (state.summary) {
    return state.summary;
  }

  state.clock.tick += 1;
  state.clock.elapsedMs += state.rules.tickMs;

  if (state.clock.elapsedMs >= state.rules.overclockStartMs && state.phase !== 'overclock') {
    state.phase = 'overclock';
    emitReplayEvent(state, {
      type: 'overclock_started',
      tick: state.clock.tick,
      match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
      payload: {}
    });
  } else if (state.clock.elapsedMs >= state.rules.maxMatchMs * 0.4 && state.phase === 'opening') {
    state.phase = 'midgame';
  } else if (state.clock.elapsedMs >= state.rules.maxMatchMs * 0.72 && state.phase === 'midgame') {
    state.phase = 'endgame';
  }

  const isDecisionTick = state.clock.elapsedMs % state.rules.commanderDecisionMs === 0;

  if (isDecisionTick) {
    for (const commander of state.commanders) {
      const snapshot = buildBattleSnapshot(state, commander);
      const result = await resolveCommanderOrder({
        commander,
        snapshot,
        previousOrder: commander.currentOrder
      });
      commander.currentOrder = result.order;
      commander.lastOrderMeta = result.meta;
      commander.routeIndex = 0;
      state.metrics.ordersIssued += 1;
      state.metrics.commandLatencyMsTotal += result.meta.latencyMs;
      if (result.meta.fallbackUsed) {
        state.metrics.fallbackCount += 1;
        state.metrics.invalidOrderCount += 1;
      }
      emitReplayEvent(state, {
        type: 'command_issued',
        tick: state.clock.tick,
        match_time_sec: Math.floor(state.clock.elapsedMs / 1000),
        payload: {
          commanderId: commander.id,
          teamId: commander.teamId,
          order: commander.currentOrder,
          source: result.meta.source
        }
      });
    }
  }

  updateRespawns(state);
  expireBuffs(state);

  for (const commander of state.commanders) {
    const targetPoint = determineRouteTarget(state, commander);
    updateCommanderRouteProgress(state, commander, targetPoint);
  }

  for (const commander of state.commanders) {
    const targetAnchor = commander.anchorTarget;
    const squadUnits = getCommanderUnits(state, commander.id);
    for (const unit of squadUnits) {
      useAbilityIfReady(state, unit, commander);
      attackEnemyIfPossible(state, unit, commander);
      moveUnit(state, unit, commander, targetAnchor);
    }
  }

  updateObjectives(state);
  updateCorePressure(state);

  const winnerInfo = resolveWinner(state);
  if (winnerInfo) {
    return finalizeMatch(state, winnerInfo);
  }

  captureReplayFrame(state);

  return null;
}

export async function runMatchToCompletion(config) {
  const state = createMatchState(config);
  const hardTickCap = Math.ceil(config.rules.maxMatchMs / config.rules.tickMs) + 10;

  for (let index = 0; index < hardTickCap; index += 1) {
    const result = await stepMatch(state);
    if (result) {
      break;
    }
  }

  const summary = state.summary ?? finalizeMatch(state, resolveWinner(state) ?? {
    winner: 'blue',
    reason: 'safety_exit'
  });

  return {
    summary,
    replay: state.replay,
    state
  };
}
