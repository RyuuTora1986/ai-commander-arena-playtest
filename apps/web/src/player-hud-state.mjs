import { getCommanderPortraitAsset } from './scene-art-assets.mjs';

function clampNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function toMissionLabel(intent) {
  const labels = {
    contest_prime_relay: '抢 Prime',
    hold_lane: '稳线守点',
    split_push: '边路施压',
    collapse_target: '准备强开',
    defend_core: '回防核心',
    pressure_lane: '边路施压',
    push_lane: '推进压线'
  };

  return labels[intent] ?? '临场调度';
}

export function toStanceLabel(riskLevel) {
  const labels = {
    low: '稳守',
    medium: '均衡',
    high: '压上',
    all_in: '搏命'
  };

  return labels[riskLevel] ?? '观察';
}

export function buildCommanderSeatModels(view, identityPayoffMap = new Map()) {
  const seats = {
    blue: [],
    red: []
  };

  for (const commander of view?.commanders ?? []) {
    const teamId = commander.teamId === 'red' ? 'red' : 'blue';
    seats[teamId].push({
      id: commander.id,
      teamId,
      displayName: commander.name ?? commander.id ?? '未知指挥官',
      styleLabel: commander.styleLabel ?? '风格待定',
      missionLabel: toMissionLabel(commander.intent),
      stanceLabel: toStanceLabel(commander.riskLevel),
      payoffChipLabel: identityPayoffMap.get(commander.id)?.label ?? null,
      portraitAsset: getCommanderPortraitAsset(commander.id)
    });
  }

  return seats;
}

function buildReplayLabels(replayFrames = [], replayMode = 'live', replayFrameIndex = 0) {
  const lastIndex = Math.max(0, replayFrames.length - 1);
  const safeIndex = Math.max(0, Math.min(replayFrameIndex, lastIndex));
  return {
    replayModeLabel: replayMode === 'replay' ? 'Replay Scrub' : 'Live',
    replayFrameLabel: `Frame ${replayMode === 'replay' ? safeIndex : lastIndex} / ${lastIndex}`,
    replayFrameMax: lastIndex,
    replayFrameValue: replayMode === 'replay' ? safeIndex : lastIndex
  };
}

export function buildDevPanelModel({
  view,
  report,
  artifact,
  defaultOpen = false,
  replayMode = 'live',
  replayFrameIndex = 0
}) {
  const frames = artifact?.replay?.frames ?? [];
  const averageLatencyMs =
    (view?.commanders?.length ?? 0) === 0
      ? 0
      : Math.round(
          view.commanders.reduce((total, commander) => total + clampNumber(commander.latencyMs), 0) /
            view.commanders.length
        );

  return {
    defaultOpen,
    eventLog: Array.isArray(view?.recentEvents) ? view.recentEvents : [],
    commanders: Array.isArray(report?.commanders) ? report.commanders : [],
    totals: {
      totalCommands: report?.totalCommands ?? 0,
      totalEliminations: report?.totalEliminations ?? 0,
      blueObjectives: report?.objectiveCaptures?.blue ?? 0,
      redObjectives: report?.objectiveCaptures?.red ?? 0
    },
    structures: {
      blueCore: view?.structures?.blueCore ?? null,
      redCore: view?.structures?.redCore ?? null,
      winner: view?.winner ?? null
    },
    viewMetrics: {
      fallbackCount: clampNumber(view?.commanders?.reduce?.(
        (total, commander) => total + (commander.fallbackUsed ? 1 : 0),
        0
      )),
      averageLatencyMs
    },
    ...buildReplayLabels(frames, replayMode, replayFrameIndex)
  };
}
