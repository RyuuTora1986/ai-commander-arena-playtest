import { validateReplayEvent } from '../../shared-types/src/index.mjs';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractCommanderIdFromUnitId(unitId) {
  if (typeof unitId !== 'string') {
    return null;
  }

  const parts = unitId.split('-');
  if (parts.length < 2) {
    return null;
  }

  return `${parts[0]}-${parts[1]}`;
}

function getTeamIdFromEntityId(entityId) {
  if (typeof entityId !== 'string') {
    return null;
  }

  if (entityId.startsWith('blue-')) {
    return 'blue';
  }

  if (entityId.startsWith('red-')) {
    return 'red';
  }

  return null;
}

function deriveWinPattern({ winner, reason, objectiveCaptures, teamEliminations }) {
  if (reason === 'core_destroyed' || reason === 'core_tiebreak') {
    return '核心压制';
  }

  const objectiveDelta =
    (objectiveCaptures[winner] ?? 0) -
    (objectiveCaptures[winner === 'blue' ? 'red' : 'blue'] ?? 0);
  const killDelta =
    (teamEliminations[winner] ?? 0) -
    (teamEliminations[winner === 'blue' ? 'red' : 'blue'] ?? 0);

  if (objectiveDelta >= killDelta) {
    return '控图';
  }

  return '击杀';
}

function deriveSwingObjective(events, winner) {
  const winnerObjectiveEvents = events.filter(
    (event) => event.type === 'objective_captured' && event.payload?.owner === winner
  );

  const primeCapture = winnerObjectiveEvents.find(
    (event) => event.payload?.objectiveId === 'prime-relay' || event.payload?.objectiveId === 'primeRelay'
  );
  if (primeCapture) {
    return 'prime-relay';
  }

  return winnerObjectiveEvents.at(-1)?.payload?.objectiveId ?? 'core-pressure';
}

function deriveStyleStandouts(commanders) {
  return [...commanders]
    .sort((left, right) => {
      if (right.eliminations !== left.eliminations) {
        return right.eliminations - left.eliminations;
      }

      return right.commandCount - left.commandCount;
    })
    .slice(0, 2)
    .map((commander) =>
      commander.eliminations > 0
        ? `${commander.name}：${commander.eliminations} 次击倒，持续制造终结压力`
        : `${commander.name}：${commander.commandCount} 次命令，持续维持战线调度`
    );
}

export function createReplayArtifact({ config, replay, summary }) {
  return {
    version: 'phase1-replay-v1',
    exportedAt: new Date().toISOString(),
    match: {
      matchId: config.matchId,
      contentVersion: config.contentVersion,
      mapId: config.map.id,
      mapName: config.map.name,
      tickMs: config.rules.tickMs,
      commanderDecisionMs: config.rules.commanderDecisionMs,
      maxMatchMs: config.rules.maxMatchMs
    },
    teams: {
      blue: config.teamConfigs.blue.commanders.map((commander) => ({
        id: `blue-c${commander.slot + 1}`,
        name: commander.name,
        brainType: commander.brainType
      })),
      red: config.teamConfigs.red.commanders.map((commander) => ({
        id: `red-c${commander.slot + 1}`,
        name: commander.name,
        brainType: commander.brainType
      }))
    },
    summary,
    events: replay.events,
    frames: replay.frames
  };
}

export function parseReplayArtifact(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: ['Replay artifact must be an object.']
    };
  }

  if (typeof input.version !== 'string') {
    errors.push('version must be a string.');
  }

  if (!isPlainObject(input.match)) {
    errors.push('match metadata must exist.');
  }

  if (!isPlainObject(input.summary)) {
    errors.push('summary must exist.');
  }

  if (!Array.isArray(input.events)) {
    errors.push('events must be an array.');
  } else {
    for (const event of input.events) {
      const validation = validateReplayEvent(event);
      if (!validation.ok) {
        errors.push(...validation.errors);
        break;
      }
    }
  }

  if (!Array.isArray(input.frames)) {
    errors.push('frames must be an array.');
  } else {
    for (const frame of input.frames) {
      if (!isPlainObject(frame)) {
        errors.push('each frame must be an object.');
        break;
      }

      if (typeof frame.tick !== 'number' || typeof frame.match_time_sec !== 'number') {
        errors.push('each frame must include tick and match_time_sec.');
        break;
      }

      if (!Array.isArray(frame.units) || !Array.isArray(frame.commanders)) {
        errors.push('each frame must include units and commanders.');
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: input };
}

export function buildReplayReport(artifact) {
  const commanderSeeds = [
    ...(artifact.teams?.blue ?? []),
    ...(artifact.teams?.red ?? [])
  ];

  const commanders = new Map(
    commanderSeeds.map((commander) => [
      commander.id,
      {
        id: commander.id,
        name: commander.name,
        brainType: commander.brainType,
        commandCount: 0,
        fallbackCount: 0,
        eliminations: 0,
        deaths: 0
      }
    ])
  );
  const objectiveCaptures = {
    blue: 0,
    red: 0
  };
  const teamEliminations = {
    blue: 0,
    red: 0
  };
  let totalCommands = 0;
  let totalEliminations = 0;
  let totalFallbacks = 0;

  for (const event of artifact.events) {
    if (event.type === 'command_issued') {
      totalCommands += 1;
      const commander = commanders.get(event.payload.commanderId);
      if (commander) {
        commander.commandCount += 1;
      }

      if (typeof event.payload.source === 'string' && event.payload.source.includes('fallback')) {
        totalFallbacks += 1;
        if (commander) {
          commander.fallbackCount += 1;
        }
      }
    }

    if (event.type === 'unit_eliminated') {
      totalEliminations += 1;
      const attackerCommanderId = extractCommanderIdFromUnitId(event.payload.attackerId);
      const targetCommanderId = extractCommanderIdFromUnitId(event.payload.targetId);
      const attackerTeamId = getTeamIdFromEntityId(event.payload.attackerId);

      if (attackerCommanderId && commanders.has(attackerCommanderId)) {
        commanders.get(attackerCommanderId).eliminations += 1;
      }

      if (attackerTeamId) {
        teamEliminations[attackerTeamId] += 1;
      }

      if (targetCommanderId && commanders.has(targetCommanderId)) {
        commanders.get(targetCommanderId).deaths += 1;
      }
    }

    if (event.type === 'objective_captured') {
      const owner = event.payload.owner;
      if (owner === 'blue' || owner === 'red') {
        objectiveCaptures[owner] += 1;
      }
    }
  }

  const commanderList = [...commanders.values()];
  const winner = artifact.summary.winner;
  const reason = artifact.summary.reason;

  return {
    winner,
    reason,
    durationSec: artifact.summary.durationSec,
    totalCommands,
    totalEliminations,
    totalFallbacks,
    objectiveCaptures,
    winPattern: deriveWinPattern({
      winner,
      reason,
      objectiveCaptures,
      teamEliminations
    }),
    swingObjective: deriveSwingObjective(artifact.events, winner),
    styleStandouts: deriveStyleStandouts(
      commanderList.filter((commander) => commander.id.startsWith(winner))
    ),
    commanders: commanderList
  };
}
