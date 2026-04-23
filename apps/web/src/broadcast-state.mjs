const TEAM_LABEL = {
  blue: '蓝方',
  red: '红方'
};

const EVENT_PRIORITY = {
  match_ended: 120,
  prime_relay_activated: 110,
  objective_captured: 80,
  overclock_started: 70,
  unit_eliminated: 60
};

function getTeamLabel(teamId) {
  return TEAM_LABEL[teamId] ?? '未知方';
}

function getLeadingTeam(score) {
  if (score.blue === score.red) {
    return null;
  }
  return score.blue > score.red ? 'blue' : 'red';
}

function getScoreDiff(score) {
  return Math.abs(score.blue - score.red);
}

function getEventPriority(eventType) {
  return EVENT_PRIORITY[eventType] ?? -1;
}

function getKillerTeamFromEvent(event) {
  if (event?.payload?.attackerId?.startsWith('blue-')) {
    return 'blue';
  }
  if (event?.payload?.attackerId?.startsWith('red-')) {
    return 'red';
  }
  if (event?.payload?.teamId === 'blue') {
    return 'red';
  }
  if (event?.payload?.teamId === 'red') {
    return 'blue';
  }
  return null;
}

function getEventRecencyRank(event, index) {
  if (Number.isFinite(event?.tick)) {
    return event.tick * 1_000_000 + index;
  }
  if (Number.isFinite(event?.match_time_sec)) {
    return event.match_time_sec * 1_000_000 + index;
  }
  return index;
}

function chooseBestEvent(events = []) {
  let selected = null;
  let bestPriority = -1;
  let bestRecency = -1;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const priority = getEventPriority(event.type);
    const recency = getEventRecencyRank(event, index);

    if (priority > bestPriority || (priority === bestPriority && recency >= bestRecency)) {
      selected = event;
      bestPriority = priority;
      bestRecency = recency;
    }
  }

  return selected;
}

function createHeadline({ key, type, priority, tone, title, impact, kicker = null }) {
  return {
    key,
    type,
    priority,
    tone,
    title,
    impact,
    kicker
  };
}

function createEventHeadlineKey(event) {
  const parts = [
    event?.type ?? 'unknown',
    Number.isFinite(event?.tick) ? `tick:${event.tick}` : null,
    Number.isFinite(event?.match_time_sec) ? `sec:${event.match_time_sec}` : null,
    event?.payload?.objectiveId ? `obj:${event.payload.objectiveId}` : null,
    event?.payload?.winner ? `winner:${event.payload.winner}` : null,
    event?.payload?.owner ? `owner:${event.payload.owner}` : null,
    event?.payload?.attackerId ? `attacker:${event.payload.attackerId}` : null,
    event?.payload?.targetId ? `target:${event.payload.targetId}` : null
  ].filter(Boolean);
  return parts.join('|');
}

function buildEventHeadline(event) {
  if (!event) {
    return null;
  }

  if (event.type === 'prime_relay_activated') {
    return createHeadline({
      key: createEventHeadlineKey(event),
      type: event.type,
      priority: EVENT_PRIORITY.prime_relay_activated,
      tone: 'alert',
      title: 'Prime Relay 已激活',
      impact: 'high',
      kicker: '双方即将争夺关键增益'
    });
  }

  if (event.type === 'objective_captured') {
    return createHeadline({
      key: createEventHeadlineKey(event),
      type: event.type,
      priority: EVENT_PRIORITY.objective_captured,
      tone: 'swing',
      title: `${getTeamLabel(event.payload?.owner)}拿下据点`,
      impact: 'medium',
      kicker: event.payload?.objectiveId ?? null
    });
  }

  if (event.type === 'unit_eliminated') {
    return createHeadline({
      key: createEventHeadlineKey(event),
      type: event.type,
      priority: EVENT_PRIORITY.unit_eliminated,
      tone: 'swing',
      title: `${getTeamLabel(getKillerTeamFromEvent(event))}完成一次击杀`,
      impact: 'medium'
    });
  }

  if (event.type === 'overclock_started') {
    return createHeadline({
      key: createEventHeadlineKey(event),
      type: event.type,
      priority: EVENT_PRIORITY.overclock_started,
      tone: 'alert',
      title: 'Overclock 阶段开启',
      impact: 'high',
      kicker: '战局进入加速决胜窗口'
    });
  }

  if (event.type === 'match_ended') {
    return createHeadline({
      key: createEventHeadlineKey(event),
      type: event.type,
      priority: EVENT_PRIORITY.match_ended,
      tone: 'final',
      title: `比赛结束，${getTeamLabel(event.payload?.winner)}获胜`,
      impact: 'high'
    });
  }

  return null;
}

function buildLeadSwitchHeadline(view, previousView) {
  if (!view?.score || !previousView?.score) {
    return null;
  }

  const currentLeader = getLeadingTeam(view.score);
  const previousLeader = getLeadingTeam(previousView.score);
  if (!currentLeader || currentLeader === previousLeader) {
    return null;
  }

  const key = [
    'lead_switched',
    `${previousLeader ?? 'tie'}->${currentLeader}`,
    `blue:${view.score.blue}`,
    `red:${view.score.red}`
  ].join('|');

  return createHeadline({
    key,
    type: 'lead_switched',
    priority: 85,
    tone: 'swing',
    title: `${getTeamLabel(currentLeader)}完成反超`,
    impact: 'high'
  });
}

function clampRatio(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function buildLeadSummary(view, events = []) {
  const score = view?.score ?? { blue: 0, red: 0 };
  const leadingTeam = getLeadingTeam(score);
  const diff = getScoreDiff(score);

  if (!leadingTeam) {
    return {
      leadingTeam: null,
      scoreDiff: 0,
      primaryCause: '均势',
      detail: '当前比分持平',
      text: '双方当前打平，局势仍在拉扯'
    };
  }

  const objectivePressure = { blue: 0, red: 0 };
  const killPressure = { blue: 0, red: 0 };
  const corePressure = { blue: 0, red: 0 };

  for (const event of events) {
    if (event.type === 'objective_captured') {
      const owner = event.payload?.owner;
      if (owner === 'blue' || owner === 'red') {
        objectivePressure[owner] += 1;
      }
    }

    if (event.type === 'unit_eliminated') {
      const killerTeam = getKillerTeamFromEvent(event);
      if (killerTeam) {
        killPressure[killerTeam] += 1;
      }
    }

    if (event.type === 'core_damage') {
      const attackerTeam = event.payload?.teamId;
      if (attackerTeam === 'blue' || attackerTeam === 'red') {
        corePressure[attackerTeam] += Number(event.payload?.amount ?? 0);
      }
    }
  }

  const blueCoreLostHp = (view?.structures?.blueCore?.maxHp ?? 0) - (view?.structures?.blueCore?.hp ?? 0);
  const redCoreLostHp = (view?.structures?.redCore?.maxHp ?? 0) - (view?.structures?.redCore?.hp ?? 0);
  corePressure.blue += Math.max(0, redCoreLostHp);
  corePressure.red += Math.max(0, blueCoreLostHp);

  const rivalTeam = leadingTeam === 'blue' ? 'red' : 'blue';
  const causes = [
    {
      key: '控图',
      value: objectivePressure[leadingTeam] - objectivePressure[rivalTeam]
    },
    {
      key: '击杀',
      value: killPressure[leadingTeam] - killPressure[rivalTeam]
    },
    {
      key: '核心压制',
      value: corePressure[leadingTeam] - corePressure[rivalTeam]
    }
  ];

  causes.sort((left, right) => right.value - left.value);
  const bestCause = causes[0];
  const primaryCause = bestCause.value > 0 ? bestCause.key : '控图';

  let detail = '节奏优势尚不明显';
  if (primaryCause === '控图') {
    detail = `最近据点控制更偏向${getTeamLabel(leadingTeam)}`;
  } else if (primaryCause === '击杀') {
    detail = `${getTeamLabel(leadingTeam)}最近团战交换更赚`;
  } else if (primaryCause === '核心压制') {
    const enemyCore = leadingTeam === 'blue' ? view?.structures?.redCore : view?.structures?.blueCore;
    const hpRatio = clampRatio((enemyCore?.hp ?? 0) / (enemyCore?.maxHp ?? 1));
    detail = `对手核心当前仅剩 ${(hpRatio * 100).toFixed(0)}% 血量`;
  }

  return {
    leadingTeam,
    scoreDiff: diff,
    primaryCause,
    detail,
    text: `${getTeamLabel(leadingTeam)}领先 ${diff.toFixed(1)} 分，优势主要来自${primaryCause}`
  };
}

export function buildCommanderHighlightMap(view, previousView) {
  const previousById = new Map(
    (previousView?.commanders ?? []).map((commander) => [commander.id, commander])
  );
  const result = new Map();

  for (const commander of view?.commanders ?? []) {
    const previousCommander = previousById.get(commander.id);
    if (!previousCommander) {
      result.set(commander.id, false);
      continue;
    }

    result.set(
      commander.id,
      previousCommander.intent !== commander.intent ||
        previousCommander.riskLevel !== commander.riskLevel ||
        previousCommander.target !== commander.target
    );
  }

  return result;
}

export function buildBroadcastState({ view, previousView, events }) {
  const recentEvents = events ?? view?.recentEvents ?? [];
  const leadSummary = buildLeadSummary(view, recentEvents);
  const commanderHighlights = buildCommanderHighlightMap(view, previousView);
  const eventHeadline = buildEventHeadline(chooseBestEvent(recentEvents));
  const leadSwitchHeadline = buildLeadSwitchHeadline(view, previousView);

  let headline = eventHeadline;
  if (leadSwitchHeadline && (!headline || leadSwitchHeadline.priority > headline.priority)) {
    headline = leadSwitchHeadline;
  }

  if (!headline) {
    if (leadSummary.leadingTeam) {
      headline = createHeadline({
        key: `lead_status|team:${leadSummary.leadingTeam}|diff:${leadSummary.scoreDiff.toFixed(1)}`,
        type: 'lead_status',
        priority: 10,
        tone: 'status',
        title: `${getTeamLabel(leadSummary.leadingTeam)}暂时占优`,
        impact: 'low'
      });
    } else {
      headline = createHeadline({
        key: `neutral_status|blue:${view?.score?.blue ?? 0}|red:${view?.score?.red ?? 0}`,
        type: 'neutral_status',
        priority: 10,
        tone: 'status',
        title: '双方暂时势均力敌',
        impact: 'low'
      });
    }
  }

  return {
    headline,
    leadSummary,
    commanderHighlights
  };
}
