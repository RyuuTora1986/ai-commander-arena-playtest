import { createDefaultMatchConfig } from '../../../packages/content-data/src/index.mjs';
import {
  doctrineCatalog,
  getDoctrineDefinition
} from '../../../packages/content-data/src/index.mjs';
import { buildReplayReport, createReplayArtifact } from '../../../packages/replay-format/src/index.mjs';
import {
  buildMatchupPreview,
  getCommanderIdentity,
  listMatchupPresetOptions
} from './matchup-presets.mjs';
import {
  createMatchState,
  createSpectatorView,
  stepMatch
} from '../../../packages/sim-core/src/index.mjs';
import { buildBroadcastState } from './broadcast-state.mjs';
import {
  buildCommanderStylePayoffMap,
  buildObjectiveWindowHint
} from './commander-identity-state.mjs';
import {
  renderObjectiveWindowHint
} from './commander-identity-markup.mjs';
import {
  renderBroadcastHeadline,
  renderLeadSummaryCard
} from './broadcast-markup.mjs';
import {
  advanceBroadcastUiState,
  createBroadcastUiState,
  getBroadcastUiPreviousView,
  resetBroadcastUiState
} from './broadcast-ui-state.mjs';
import { createAudioCueController } from './audio-cues.mjs';
import {
  renderArenaPresentationCard,
  renderCommanderSeatCards,
  renderPlayerHudShell
} from './player-hud-markup.mjs';
import { buildCommanderSeatModels, buildDevPanelModel } from './player-hud-state.mjs';
import {
  advanceMatchPresentationState,
  createMatchEndPresentation,
  createMatchIntroPresentation,
  createMatchPresentationState,
  createReplayReviewPresentation,
  pinMatchPresentation,
  resetMatchPresentationState
} from './match-presentation-state.mjs';
import {
  createSceneState,
  setDevPanelOpen,
  transitionScene,
  setActiveOverlay,
  closeActiveOverlay
} from './scene-state.mjs';
import { renderSceneShell } from './scene-shell-markup.mjs';
import {
  renderControlsOverlay,
  renderHelpOverlay
} from './scene-overlay-markup.mjs';
import { renderWelcomeScene } from './welcome-scene-markup.mjs';
import { renderHomeScene } from './home-scene-markup-v2.mjs';
import { renderPrepScene } from './prep-scene-markup-v2.mjs';
import { renderResultScene } from './result-scene-markup.mjs';
import { renderDevPanel } from './dev-panel-markup.mjs';
import {
  buildPrepSceneViewModel,
  buildResultSceneViewModel
} from './scene-view-models.mjs';
import {
  getObjectiveSpriteAsset,
  getUnitSpriteAsset
} from './scene-art-assets.mjs';
import { readRuntimeConfig } from './runtime-config.mjs';

const refs = {
  appRoot: document.querySelector('#app-root')
};
const runtimeConfig = readRuntimeConfig();

const BROADCAST_STICKY_MS = 4_000;
const broadcastUiState = createBroadcastUiState({ stickyMs: BROADCAST_STICKY_MS });
const audioCueController = createAudioCueController();
const matchPresentationState = createMatchPresentationState();

const PRESET_DOCTRINE_DEFAULTS = {
  default: {
    blue: 'pressure',
    red: 'anchor'
  },
  mirror: {
    blue: 'flank',
    red: 'balanced'
  },
  'all-rule': {
    blue: 'pressure',
    red: 'anchor'
  }
};

const VALID_SCENES = new Set(['welcome', 'home', 'prep', 'match', 'result']);
const VALID_OVERLAYS = new Set(['help', 'controls']);

function normalizeSceneId(value) {
  return VALID_SCENES.has(value) ? value : 'welcome';
}

function normalizeOverlayId(value) {
  return VALID_OVERLAYS.has(value) ? value : null;
}

function readBootPreviewState() {
  const params = new URLSearchParams(window.location.search);
  const sceneId = normalizeSceneId(params.get('scene'));
  const activeOverlay = normalizeOverlayId(params.get('overlay'));
  const devPanelOpen = params.get('devPanel') === '1';
  const preset = params.get('preset') ?? 'default';
  const doctrine = params.get('doctrine') ?? null;
  const speed = ['1', '2', '4', '8'].includes(params.get('speed')) ? params.get('speed') : '1';

  return {
    sceneId,
    activeOverlay,
    devPanelOpen,
    preset,
    doctrine,
    speedValue: speed
  };
}

function createBootSceneState(bootState) {
  return {
    ...createSceneState(),
    sceneId: bootState.sceneId,
    activeOverlay: bootState.activeOverlay,
    devPanelOpen: bootState.devPanelOpen
  };
}

function createPreviewResultReport() {
  return {
    winner: 'blue',
    winPattern: '靠 Prime Relay 转出控图优势',
    swingObjective: '蓝方在中期抢下 Prime Relay 并转成双路推进',
    styleStandouts: ['守衡稳住中线', '烈脉强开兑现节奏', '雾纱把资源优势滚成胜势'],
    totalCommands: 148,
    totalEliminations: 26,
    objectiveCaptures: {
      blue: 7,
      red: 4
    },
    commanders: []
  };
}

function getPresetDoctrineSelection(preset, blueDoctrineId = null) {
  const defaults = PRESET_DOCTRINE_DEFAULTS[preset] ?? PRESET_DOCTRINE_DEFAULTS.default;
  return {
    blue: blueDoctrineId ?? defaults.blue,
    red: defaults.red
  };
}

const bootPreviewState = readBootPreviewState();
const bootDoctrineSelection = getPresetDoctrineSelection(
  bootPreviewState.preset,
  bootPreviewState.doctrine
);

let sceneState = createBootSceneState(bootPreviewState);
let runtime = createRuntime(bootPreviewState.preset, bootDoctrineSelection);
let timerHandle = null;
let replayMode = 'live';
let replayFrameIndex = 0;
let processedAudioEventCount = 0;
let speedValue = bootPreviewState.speedValue;
let currentPreset = bootPreviewState.preset;
let currentDoctrineId = bootDoctrineSelection.blue;
let forcedResultViewModel =
  sceneState.sceneId === 'result'
    ? buildResultSceneViewModel({
        report: {
          ...createPreviewResultReport(),
          doctrineLabel: getDoctrineDefinition(currentDoctrineId).label
        }
      })
    : null;
let countdownHandle = null;
let matchCountdownValue = 0;
let resultTransitionHandle = null;
const previousArenaPositions = new Map();

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function describeOwner(owner) {
  return owner === 'blue' ? '蓝方占领' : owner === 'red' ? '红方占领' : '中立';
}

function formatEvent(event) {
  const time = formatTime((event?.match_time_sec ?? 0) * 1000);

  if (event?.type === 'command_issued') {
    return `${time} ${event.payload.commanderId} 下达 ${event.payload.order.intent}`;
  }

  if (event?.type === 'objective_captured') {
    const teamLabel = event.payload.owner === 'blue' ? '蓝方' : '红方';
    return `${time} ${teamLabel} 控下 ${event.payload.objectiveId}`;
  }

  if (event?.type === 'unit_eliminated') {
    return `${time} ${event.payload.attackerId} 击倒 ${event.payload.targetId}`;
  }

  if (event?.type === 'core_damage') {
    const teamLabel = event.payload.teamId === 'blue' ? '蓝方' : '红方';
    return `${time} ${teamLabel} 对核心造成 ${event.payload.amount} 点伤害`;
  }

  if (event?.type === 'prime_relay_activated') {
    return `${time} Prime Relay 激活`;
  }

  if (event?.type === 'overclock_started') {
    return `${time} Overclock 启动，终局节奏加速`;
  }

  if (event?.type === 'match_ended') {
    return `${time} 比赛结束，${event.payload.winner === 'blue' ? '蓝方' : '红方'}获胜`;
  }

  return `${time} ${event?.type ?? 'event'}`;
}

function createPresetConfig(preset, doctrineSelection = getPresetDoctrineSelection(preset, currentDoctrineId)) {
  if (preset === 'mirror') {
    return createDefaultMatchConfig({
      blueBrains: ['rule-based', 'mock', 'rule-based'],
      redBrains: ['mock', 'rule-based', 'mock'],
      doctrineSelection
    });
  }

  if (preset === 'all-rule') {
    return createDefaultMatchConfig({
      blueBrains: ['rule-based', 'rule-based', 'rule-based'],
      redBrains: ['rule-based', 'rule-based', 'rule-based'],
      doctrineSelection
    });
  }

  return createDefaultMatchConfig({
    blueBrains: ['rule-based', 'rule-based', 'rule-based'],
    redBrains: ['mock', 'mock', 'mock'],
    doctrineSelection
  });
}

function createRuntime(preset, doctrineSelection = getPresetDoctrineSelection(preset, currentDoctrineId)) {
  const config = createPresetConfig(preset, doctrineSelection);
  return {
    preset,
    doctrineSelection,
    config,
    state: createMatchState(config)
  };
}

function createCurrentSummary(state) {
  return state.summary ?? {
    winner: null,
    reason: 'in_progress',
    durationSec: Math.floor(state.clock.elapsedMs / 1000),
    commandersPerTeam: 3,
    unitsPerCommander: 5,
    score: { ...state.score },
    invalidOrderCount: state.metrics.invalidOrderCount,
    fallbackCount: state.metrics.fallbackCount
  };
}

function getReplayArtifact() {
  return createReplayArtifact({
    config: runtime.config,
    replay: runtime.state.replay,
    summary: createCurrentSummary(runtime.state)
  });
}

function stopResultTransition() {
  if (resultTransitionHandle !== null) {
    window.clearTimeout(resultTransitionHandle);
    resultTransitionHandle = null;
  }
}

function getDoctrineOptions() {
  return doctrineCatalog.map((doctrine) => ({
    id: doctrine.id,
    label: doctrine.label,
    summary: doctrine.summary
  }));
}

function getSelectedDoctrine() {
  return getDoctrineDefinition(currentDoctrineId);
}

function buildCurrentResultViewModel(report = buildReplayReport(getReplayArtifact())) {
  if (report?.winnerTone && report?.outcomeBadge) {
    return report;
  }

  return buildResultSceneViewModel({
    report: {
      ...report,
      doctrineLabel: getSelectedDoctrine().label
    }
  });
}

function setReplayMode(nextMode) {
  if (replayMode !== nextMode) {
    resetBroadcastUiState(broadcastUiState);
  }
  replayMode = nextMode;
}

function getDisplayView() {
  if (replayMode === 'replay' && runtime.state.replay.frames.length > 0) {
    const safeIndex = Math.max(0, Math.min(replayFrameIndex, runtime.state.replay.frames.length - 1));
    return runtime.state.replay.frames[safeIndex];
  }

  return createSpectatorView(runtime.state);
}

function buildArenaOverlayHtml(view) {
  return '';
}

function buildArenaMarkup(view) {
  const objectiveStroke = (teamId) => {
    if (teamId === 'blue') {
      return '#2dd4bf';
    }
    if (teamId === 'red') {
      return '#fb7185';
    }
    return 'rgba(229, 238, 247, 0.28)';
  };

  const liveUnits = view.units.filter((unit) => unit.alive);
  const liveUnitIds = new Set(liveUnits.map((unit) => unit.id));
  Array.from(previousArenaPositions.keys()).forEach((unitId) => {
    if (!liveUnitIds.has(unitId)) {
      previousArenaPositions.delete(unitId);
    }
  });

  const unitNodes = liveUnits
    .map((unit) => {
      const hpRatio = Math.max(0, unit.hp / unit.maxHp);
      const hpWidth = 28 * hpRatio;
      const spriteHref = getUnitSpriteAsset(unit.role, unit.teamId);
      const previous = previousArenaPositions.get(unit.id) ?? { x: unit.x, y: unit.y };
      previousArenaPositions.set(unit.id, { x: unit.x, y: unit.y });

      return `
        <g class="arena-unit-node ${unit.teamId}" transform="translate(${previous.x.toFixed(1)} ${previous.y.toFixed(1)})">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="${previous.x.toFixed(1)} ${previous.y.toFixed(1)}"
            to="${unit.x.toFixed(1)} ${unit.y.toFixed(1)}"
            dur="320ms"
            fill="freeze"
          />
          <ellipse class="unit-shadow" cx="0" cy="10" rx="24" ry="12"></ellipse>
          <ellipse class="unit-plate ${unit.teamId}" cx="0" cy="6" rx="22" ry="15"></ellipse>
          <circle class="unit-glow ${unit.teamId}" r="24"></circle>
          <circle class="unit-team-ring ${unit.teamId}" r="18"></circle>
          <circle class="unit-role-dot ${unit.teamId}" cx="18" cy="14" r="5"></circle>
          ${spriteHref ? `<image class="unit-sprite" href="${spriteHref}" x="-30" y="-30" width="60" height="60" preserveAspectRatio="xMidYMid meet"></image>` : ''}
          <rect class="hp-bar-bg" x="-14" y="-32" width="28" height="4" rx="2"></rect>
          <rect class="hp-bar-fill ${unit.teamId}" x="-14" y="-32" width="${hpWidth.toFixed(1)}" height="4" rx="2"></rect>
        </g>
      `;
    })
    .join('');

  const prime = view.objectives.primeRelay;
  const primeProgress = Math.max(0, Math.min(1, prime.progressRatio));
  const topProgress = Math.max(0, Math.min(1, view.objectives.topBeacon.progressRatio));
  const botProgress = Math.max(0, Math.min(1, view.objectives.botBeacon.progressRatio));
  const blueCoreSprite = getObjectiveSpriteAsset('blueCore');
    const redCoreSprite = getObjectiveSpriteAsset('redCore');
    const primeSprite = getObjectiveSpriteAsset('primeRelay');
    const beaconSprite = getObjectiveSpriteAsset('beacon');
    const objectiveLabelPlate = (text, width = 66) => `
      <g class="objective-label-plate" transform="translate(${-width / 2} 34)">
        <rect width="${width}" height="22" rx="11"></rect>
        <text class="objective-label" x="${width / 2}" y="15" text-anchor="middle">${text}</text>
      </g>
    `;

    return `
      <defs>
        <radialGradient id="arenaGlow" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="rgba(19, 34, 53, 0.1)"></stop>
        <stop offset="100%" stop-color="rgba(4, 9, 15, 0.96)"></stop>
      </radialGradient>
      <linearGradient id="laneTint" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(45, 212, 191, 0.18)"></stop>
        <stop offset="100%" stop-color="rgba(251, 113, 133, 0.18)"></stop>
      </linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.08)" stroke-width="1"></path>
        </pattern>
        <filter id="unitShadowFilter" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="rgba(0, 0, 0, 0.42)"></feDropShadow>
        </filter>
        <filter id="objectiveShadowFilter" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="rgba(0, 0, 0, 0.38)"></feDropShadow>
        </filter>
      </defs>
      <rect class="arena-bg" x="0" y="0" width="1000" height="600"></rect>
      <rect x="0" y="0" width="1000" height="600" fill="url(#arenaGlow)"></rect>
      <rect x="24" y="24" width="952" height="552" rx="28" fill="url(#grid)" opacity="0.7"></rect>
      <rect x="40" y="40" width="920" height="520" rx="24" fill="url(#laneTint)" opacity="0.2"></rect>
    <path class="lane-outline" d="M 100 300 Q 280 120 500 120 T 900 220"></path>
    <path class="lane-outline" d="M 100 300 Q 280 480 500 480 T 900 380"></path>
    <path class="lane-outline" d="M 90 300 L 910 300"></path>
    <path class="lane" d="M 100 300 Q 280 120 500 120 T 900 220"></path>
    <path class="lane" d="M 100 300 Q 280 480 500 480 T 900 380"></path>
    <path class="lane" d="M 90 300 L 910 300"></path>

      <g class="core-assembly blue" transform="translate(90 300)">
        <ellipse class="objective-shadow" cx="0" cy="12" rx="58" ry="26"></ellipse>
        <circle class="core-node" r="52" stroke="#2dd4bf"></circle>
        ${blueCoreSprite ? `<image href="${blueCoreSprite}" x="-72" y="-72" width="144" height="144" preserveAspectRatio="xMidYMid meet"></image>` : ''}
        ${objectiveLabelPlate('BLUE CORE', 94)}
      </g>
      <g class="core-assembly red" transform="translate(910 300)">
        <ellipse class="objective-shadow" cx="0" cy="12" rx="58" ry="26"></ellipse>
        <circle class="core-node" r="52" stroke="#fb7185"></circle>
        ${redCoreSprite ? `<image href="${redCoreSprite}" x="-72" y="-72" width="144" height="144" preserveAspectRatio="xMidYMid meet"></image>` : ''}
        ${objectiveLabelPlate('RED CORE', 88)}
      </g>

      <g class="objective-node beacon" transform="translate(500 120)">
        <ellipse class="objective-shadow" cx="0" cy="14" rx="54" ry="22"></ellipse>
        <circle class="objective-pedestal" r="44"></circle>
        ${beaconSprite ? `<image href="${beaconSprite}" x="-56" y="-56" width="112" height="112" preserveAspectRatio="xMidYMid meet"></image>` : ''}
        <circle class="objective-ring" r="54"></circle>
        <circle class="capture-progress" r="48" stroke="${objectiveStroke(view.objectives.topBeacon.progressTeam)}"
          stroke-dasharray="${topProgress * 301} 301" transform="rotate(-90)"></circle>
        ${objectiveLabelPlate('TOP')}
      </g>
      <g class="objective-node beacon" transform="translate(500 480)">
        <ellipse class="objective-shadow" cx="0" cy="14" rx="54" ry="22"></ellipse>
        <circle class="objective-pedestal" r="44"></circle>
        ${beaconSprite ? `<image href="${beaconSprite}" x="-56" y="-56" width="112" height="112" preserveAspectRatio="xMidYMid meet"></image>` : ''}
        <circle class="objective-ring" r="54"></circle>
        <circle class="capture-progress" r="48" stroke="${objectiveStroke(view.objectives.botBeacon.progressTeam)}"
          stroke-dasharray="${botProgress * 301} 301" transform="rotate(-90)"></circle>
        ${objectiveLabelPlate('BOT')}
      </g>
      <g class="objective-node prime" transform="translate(500 300)">
        <ellipse class="objective-shadow prime" cx="0" cy="18" rx="70" ry="28"></ellipse>
        <circle class="objective-pedestal prime" r="56"></circle>
        ${primeSprite ? `<image href="${primeSprite}" x="-72" y="-72" width="144" height="144" preserveAspectRatio="xMidYMid meet"></image>` : ''}
        <circle class="objective-ring prime-ring" r="66"></circle>
        <circle class="capture-progress prime-progress" r="60" stroke="${objectiveStroke(prime.progressTeam)}"
          stroke-dasharray="${primeProgress * 377} 377" transform="rotate(-90)"></circle>
        ${objectiveLabelPlate('PRIME', 74)}
      </g>
      ${unitNodes}
    `;
  }

function getSceneContext() {
  const artifact = getReplayArtifact();
  const view = getDisplayView();
  const report = sceneState.sceneId === 'result' && !runtime.state.summary
    ? createPreviewResultReport()
    : buildReplayReport(artifact);
  return { artifact, view, report };
}

function renderMatchControlStrip(view) {
  const totalFrames = runtime.state.replay.frames.length;
  const liveFrame = Math.max(0, totalFrames - 1);
  const selectedDoctrine = getSelectedDoctrine();
  const frameLabel =
    replayMode === 'replay'
      ? `回放帧 ${Math.max(0, Math.min(replayFrameIndex, liveFrame))} / ${liveFrame}`
      : `直播帧 ${liveFrame}`;
  const primeOwnerLabel = view.objectives.primeRelay.owner
    ? `Prime ${describeOwner(view.objectives.primeRelay.owner)}`
    : 'Prime 中立';

  return `
    <div class="control-strip-main">
      <div class="control-strip-cluster">
        <label class="control-speed-field">
          <span>播放速度</span>
          <select id="speed-select">
            <option value="1"${speedValue === '1' ? ' selected' : ''}>1x</option>
            <option value="2"${speedValue === '2' ? ' selected' : ''}>2x</option>
            <option value="4"${speedValue === '4' ? ' selected' : ''}>4x</option>
            <option value="8"${speedValue === '8' ? ' selected' : ''}>8x</option>
          </select>
        </label>
        <button id="pause-toggle" type="button" class="scene-button scene-button-utility">${timerHandle === null ? '继续' : '暂停'}</button>
        <button id="live-button" type="button" class="scene-button scene-button-utility">返回直播</button>
        <button id="audio-toggle" type="button" class="scene-button scene-button-utility">${audioCueController.isMuted() ? '音效关' : '音效开'}</button>
      </div>
    </div>
    <div class="control-strip-meta">
      <span class="meta-pill">${replayMode === 'replay' ? '回放' : '实时'}</span>
      <span class="meta-pill">${frameLabel}</span>
      <span class="meta-pill">蓝方手册 ${selectedDoctrine.label}</span>
      <span class="meta-pill">${primeOwnerLabel}</span>
    </div>
  `;
}

function renderMatchCountdown() {
  if (matchCountdownValue <= 0) {
    return '';
  }

  return `
    <div class="match-countdown-layer" aria-live="polite">
      <span class="match-countdown-value">${matchCountdownValue}</span>
    </div>
  `;
}

function renderMatchScene(view) {
  const broadcastState = buildBroadcastState({
    view,
    previousView: getBroadcastUiPreviousView(broadcastUiState),
    events: view.recentEvents
  });
  const ui = advanceBroadcastUiState({
    uiState: broadcastUiState,
    broadcastState,
    view,
    nowMs: view.clock?.elapsedMs ?? 0
  });
  const payoffMap = buildCommanderStylePayoffMap(view);
  const seatModels = buildCommanderSeatModels(
    {
      ...view,
      commanders: view.commanders.map((commander) => ({
        ...getCommanderIdentity(commander),
        ...commander
      }))
    },
    payoffMap
  );
  const seatCards = renderCommanderSeatCards(seatModels, ui.commanderHighlights);
  const objectiveWindowHint = buildObjectiveWindowHint(view);
  const presentation = advanceMatchPresentationState({
    state: matchPresentationState,
    view,
    allowEventPlayback: replayMode === 'live' && matchCountdownValue <= 0 && resultTransitionHandle === null
  });

  return renderPlayerHudShell({
    headlineHtml: renderBroadcastHeadline(ui.headline),
    leadSummaryHtml: renderLeadSummaryCard(ui.leadSummary),
    objectiveWindowHtml: renderObjectiveWindowHint(objectiveWindowHint),
    blueSeatsHtml: seatCards.blueHtml,
    redSeatsHtml: seatCards.redHtml,
    blueScore: String(Math.round(view.score.blue)),
    redScore: String(Math.round(view.score.red)),
    matchTime: `${formatTime(view.clock.elapsedMs)} / ${formatTime(view.clock.maxMatchMs)}`,
    phase: view.phase,
    arenaOverlayHtml: buildArenaOverlayHtml(view),
    arenaBroadcastHtml: renderBroadcastHeadline(ui.headline),
    controlStripHtml: renderMatchControlStrip(view),
    countdownHtml: renderMatchCountdown(),
    presentationHtml: renderArenaPresentationCard(presentation)
  });
}

function renderPlayerScene(sceneId, view, report) {
  if (sceneId === 'welcome') {
    return renderWelcomeScene({
      playtestLabel: runtimeConfig.playtestLabel,
      playtestDuration: runtimeConfig.playtestDuration,
      feedbackUrl: runtimeConfig.feedbackUrl
    });
  }

  if (sceneId === 'home') {
    const preview = buildMatchupPreview(currentPreset);
    return renderHomeScene({
      featuredPresetTitle: preview.title,
      featuredPresetSummary: preview.summary,
      currentPreset,
      presetCards: listMatchupPresetOptions()
    });
  }

  if (sceneId === 'prep') {
    const preview = buildMatchupPreview(currentPreset);
    const selectedDoctrine = getSelectedDoctrine();
    return renderPrepScene(
      buildPrepSceneViewModel({
        preset: {
          ...preview,
          currentPreset,
          presetOptions: listMatchupPresetOptions(),
          doctrineOptions: getDoctrineOptions(),
          selectedDoctrineId: selectedDoctrine.id,
          selectedDoctrineLabel: selectedDoctrine.label,
          selectedDoctrineSummary: selectedDoctrine.summary
        }
      })
    );
  }

  if (sceneId === 'result') {
    return renderResultScene(forcedResultViewModel ?? buildCurrentResultViewModel(report), {
      feedbackUrl: runtimeConfig.feedbackUrl
    });
  }

  return renderMatchScene(view, report);
}

function renderDeveloperPanel(view, report, artifact) {
  return renderDevPanel({
    ...buildDevPanelModel({
      view,
      report,
      artifact,
      defaultOpen: sceneState.devPanelOpen,
      replayMode,
      replayFrameIndex
    }),
    devPanelOpen: sceneState.devPanelOpen,
    eventLog: (view?.recentEvents ?? []).map((event) => ({
      ...event,
      text: formatEvent(event)
    }))
  });
}

function renderOverlay() {
  if (sceneState.activeOverlay === 'help') {
    return renderHelpOverlay();
  }

  if (sceneState.activeOverlay === 'controls') {
  return renderControlsOverlay({
    devPanelOpen: sceneState.devPanelOpen,
    audioMuted: audioCueController.isMuted(),
    sceneId: sceneState.sceneId,
    matchRunning: timerHandle !== null,
    replayMode,
    speedValue,
    allowDevPanel: runtimeConfig.allowDevPanel,
    feedbackUrl: runtimeConfig.feedbackUrl,
    playtestFocusPoints: runtimeConfig.playtestFocusPoints
  });
}

  return '';
}

function render() {
  if (!refs.appRoot) {
    return;
  }

  const { artifact, view, report } = getSceneContext();
  refs.appRoot.innerHTML = renderSceneShell({
    ...sceneState,
    overlayHtml: renderOverlay(),
    allowDevPanel: runtimeConfig.allowDevPanel,
    controlButtonLabel: runtimeConfig.isPlaytest ? '帮助与选项' : '控制面板'
  });

  const playerRoot = refs.appRoot.querySelector('#scene-player-root');
  const devRoot = refs.appRoot.querySelector('#scene-dev-panel-root');

  if (playerRoot) {
    playerRoot.innerHTML = renderPlayerScene(sceneState.sceneId, view, report);
  }

  if (runtimeConfig.allowDevPanel && devRoot) {
    devRoot.innerHTML = renderDeveloperPanel(view, report, artifact);
  }

  if (sceneState.sceneId === 'match') {
    const arenaSvg = refs.appRoot.querySelector('#arena-svg');
    if (arenaSvg) {
      arenaSvg.innerHTML = buildArenaMarkup(view);
    }
  }
}

function consumeLiveAudioEvents() {
  const events = runtime.state.replay.events ?? [];
  if (processedAudioEventCount >= events.length) {
    return;
  }

  const nextEvents = events.slice(processedAudioEventCount);
  nextEvents.forEach((event, index) => {
    audioCueController.handleEvent(event, runtime.state.clock.elapsedMs + index * 100);
  });
  processedAudioEventCount = events.length;
}

function stopLoop() {
  if (timerHandle !== null) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
}

function stopCountdown() {
  if (countdownHandle !== null) {
    window.clearInterval(countdownHandle);
    countdownHandle = null;
  }
}

function findEventFrameIndex(predicate) {
  const artifact = getReplayArtifact();
  const reversedEvents = [...artifact.events].reverse();
  const matchedEvent = reversedEvents.find(predicate);

  if (!matchedEvent) {
    return Math.max(0, artifact.frames.length - 1);
  }

  const frameIndex = artifact.frames.findIndex((frame) => frame.tick >= matchedEvent.tick);
  if (frameIndex === -1) {
    return Math.max(0, artifact.frames.length - 1);
  }

  return Math.max(0, frameIndex - 2);
}

function findKeyMomentFrameIndex(report) {
  const winner = report?.winnerTone === 'red' ? 'red' : 'blue';
  const swingObjectiveLabel = report?.swingObjectiveLabel;

  if (swingObjectiveLabel === 'Prime Relay') {
    return findEventFrameIndex(
      (event) =>
        event.type === 'objective_captured' &&
        event.payload?.owner === winner &&
        (event.payload?.objectiveId === 'prime-relay' || event.payload?.objectiveId === 'primeRelay')
    );
  }

  if (swingObjectiveLabel === '上路信标') {
    return findEventFrameIndex(
      (event) =>
        event.type === 'objective_captured' &&
        event.payload?.owner === winner &&
        event.payload?.objectiveId === 'top-beacon'
    );
  }

  if (swingObjectiveLabel === '下路信标') {
    return findEventFrameIndex(
      (event) =>
        event.type === 'objective_captured' &&
        event.payload?.owner === winner &&
        event.payload?.objectiveId === 'bot-beacon'
    );
  }

  return findEventFrameIndex((event) => event.type === 'match_ended');
}

function setScene(nextSceneId) {
  if (sceneState.sceneId === nextSceneId) {
    return;
  }

  sceneState = transitionScene(sceneState, nextSceneId);
  if (nextSceneId !== 'result') {
    forcedResultViewModel = null;
  }
}

function queueResultTransition(resultViewModel) {
  if (resultTransitionHandle !== null) {
    return;
  }

  pinMatchPresentation(
    matchPresentationState,
    createMatchEndPresentation(resultViewModel),
    runtime.state.clock.elapsedMs,
    2600
  );
  render();
  resultTransitionHandle = window.setTimeout(() => {
    resultTransitionHandle = null;
    resetMatchPresentationState(matchPresentationState);
    setScene('result');
    render();
  }, 2200);
}

async function tickOnce() {
  if (runtime.state.summary) {
    stopLoop();
    if (sceneState.sceneId === 'match') {
      forcedResultViewModel = buildCurrentResultViewModel();
      queueResultTransition(forcedResultViewModel);
      return;
    }
    render();
    return;
  }

  setReplayMode('live');
  await stepMatch(runtime.state);
  consumeLiveAudioEvents();

  if (runtime.state.summary) {
    stopLoop();
    if (sceneState.sceneId === 'match') {
      forcedResultViewModel = buildCurrentResultViewModel();
      queueResultTransition(forcedResultViewModel);
      return;
    }
  }

  render();
}

function startLoop() {
  stopLoop();
  setReplayMode('live');
  const speed = Number(speedValue);
  const intervalMs = Math.max(35, Math.round(runtime.state.rules.tickMs / speed));
  timerHandle = window.setInterval(() => {
    void tickOnce();
  }, intervalMs);
}

function resetRuntime(preset = currentPreset) {
  stopLoop();
  stopCountdown();
  stopResultTransition();
  setReplayMode('live');
  replayFrameIndex = 0;
  processedAudioEventCount = 0;
  matchCountdownValue = 0;
  previousArenaPositions.clear();
  resetMatchPresentationState(matchPresentationState);
  currentPreset = preset;
  runtime = createRuntime(preset, getPresetDoctrineSelection(preset, currentDoctrineId));
  resetBroadcastUiState(broadcastUiState);
}

function startMatchFlow() {
  resetRuntime(currentPreset);
  forcedResultViewModel = null;
  setScene('match');
  matchCountdownValue = 3;
  render();
  countdownHandle = window.setInterval(() => {
    matchCountdownValue -= 1;
    if (matchCountdownValue <= 0) {
      stopCountdown();
      matchCountdownValue = 0;
      pinMatchPresentation(
        matchPresentationState,
        createMatchIntroPresentation(),
        runtime.state.clock.elapsedMs,
        1200
      );
      render();
      startLoop();
      return;
    }
    render();
  }, 1000);
}

document.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) {
    const action = actionTarget.getAttribute('data-action');

    if (action === 'toggle-dev-panel') {
      if (!runtimeConfig.allowDevPanel) {
        return;
      }
      sceneState = setDevPanelOpen(sceneState, !sceneState.devPanelOpen);
      render();
      refs.appRoot.querySelector('#scene-dev-panel-root')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      return;
    }

    if (action === 'open-controls') {
      sceneState = setActiveOverlay(sceneState, 'controls');
      render();
      return;
    }

    if (action === 'go-home') {
      setScene('home');
      render();
      return;
    }

    if (action === 'go-prep') {
      setScene('prep');
      render();
      return;
    }

    if (action === 'select-preset') {
      const presetValue = actionTarget.getAttribute('data-preset-value');
      if (presetValue) {
        currentPreset = presetValue;
        currentDoctrineId = getPresetDoctrineSelection(presetValue).blue;
        render();
      }
      return;
    }

    if (action === 'select-doctrine') {
      const doctrineValue = actionTarget.getAttribute('data-doctrine-value');
      if (doctrineValue) {
        currentDoctrineId = doctrineValue;
        render();
      }
      return;
    }

    if (action === 'back-home') {
      resetRuntime(currentPreset);
      setScene('home');
      render();
      return;
    }

    if (action === 'start-match') {
      startMatchFlow();
      return;
    }

    if (action === 'play-again') {
      resetRuntime(currentPreset);
      setScene('prep');
      render();
      return;
    }

    if (action === 'review-key-moment') {
      const report = forcedResultViewModel ?? buildCurrentResultViewModel();
      stopLoop();
      stopCountdown();
      stopResultTransition();
      setReplayMode('replay');
      replayFrameIndex = findKeyMomentFrameIndex(report);
      pinMatchPresentation(
        matchPresentationState,
        createReplayReviewPresentation(report),
        runtime.state.clock.elapsedMs,
        1600
      );
      setScene('match');
      render();
      return;
    }

    if (action === 'open-help') {
      sceneState = setActiveOverlay(sceneState, 'help');
      render();
      return;
    }

    if (action === 'close-overlay') {
      sceneState = closeActiveOverlay(sceneState);
      render();
      return;
    }
  }

  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  if (button.id === 'pause-toggle') {
    if (timerHandle === null) {
      startLoop();
    } else {
      stopLoop();
      render();
    }
    return;
  }

  if (button.id === 'live-button') {
    setReplayMode('live');
    render();
    return;
  }

  if (button.id === 'audio-toggle') {
    audioCueController.setMuted(!audioCueController.isMuted());
    render();
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.id === 'preset-select') {
    resetRuntime(target.value);
    render();
    return;
  }

  if (target.id === 'speed-select' || target.id === 'overlay-speed-select') {
    speedValue = target.value;
    if (timerHandle !== null) {
      startLoop();
    } else {
      render();
    }
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.id === 'replay-slider') {
    stopLoop();
    setReplayMode('replay');
    replayFrameIndex = Number(target.value);
    render();
  }
});

render();
