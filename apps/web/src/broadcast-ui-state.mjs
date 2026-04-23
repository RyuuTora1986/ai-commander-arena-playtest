export function createBroadcastUiState({ stickyMs = 4_000 } = {}) {
  return {
    stickyMs,
    activeHeadline: null,
    activeHeadlineKey: null,
    headlineExpiresAtMs: 0,
    commanderHighlightExpiresAt: new Map(),
    previousView: null
  };
}

export function resetBroadcastUiState(uiState) {
  uiState.activeHeadline = null;
  uiState.activeHeadlineKey = null;
  uiState.headlineExpiresAtMs = 0;
  uiState.commanderHighlightExpiresAt.clear();
  uiState.previousView = null;
}

export function getBroadcastUiPreviousView(uiState) {
  return uiState.previousView;
}

export function advanceBroadcastUiState({
  uiState,
  broadcastState,
  view,
  nowMs
}) {
  if (
    broadcastState?.headline?.key &&
    broadcastState.headline.key !== uiState.activeHeadlineKey
  ) {
    uiState.activeHeadline = broadcastState.headline;
    uiState.activeHeadlineKey = broadcastState.headline.key;
    uiState.headlineExpiresAtMs = nowMs + uiState.stickyMs;
  }

  const headline =
    uiState.activeHeadline && nowMs <= uiState.headlineExpiresAtMs
      ? uiState.activeHeadline
      : null;

  for (const [commanderId, isFresh] of broadcastState?.commanderHighlights?.entries?.() ?? []) {
    if (isFresh) {
      uiState.commanderHighlightExpiresAt.set(commanderId, nowMs + uiState.stickyMs);
    }
  }

  const activeCommanderHighlights = new Map();
  for (const commander of view?.commanders ?? []) {
    const expiresAtMs = uiState.commanderHighlightExpiresAt.get(commander.id) ?? 0;
    if (expiresAtMs > nowMs) {
      activeCommanderHighlights.set(commander.id, true);
      continue;
    }
    uiState.commanderHighlightExpiresAt.delete(commander.id);
    activeCommanderHighlights.set(commander.id, false);
  }

  uiState.previousView = view ?? null;

  return {
    headline,
    leadSummary: broadcastState?.leadSummary ?? null,
    commanderHighlights: activeCommanderHighlights
  };
}

