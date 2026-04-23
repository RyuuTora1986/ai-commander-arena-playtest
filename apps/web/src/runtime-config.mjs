import {
  PLAYTEST_DURATION,
  PLAYTEST_FEEDBACK_URL,
  PLAYTEST_FOCUS_POINTS,
  PLAYTEST_LABEL
} from './playtest-config.mjs';

function readMetaMode(documentRef = globalThis.document) {
  return documentRef?.querySelector('meta[name="ai-commander-runtime-mode"]')?.getAttribute('content') ?? null;
}

export function readRuntimeConfig({
  search = globalThis.window?.location?.search ?? '',
  documentRef = globalThis.document
} = {}) {
  const params = new URLSearchParams(search);
  const requestedMode = params.get('mode') ?? readMetaMode(documentRef) ?? 'internal';
  const isPlaytest = requestedMode === 'playtest';

  return {
    mode: isPlaytest ? 'playtest' : 'internal',
    isPlaytest,
    allowDevPanel: !isPlaytest,
    feedbackUrl: isPlaytest ? PLAYTEST_FEEDBACK_URL : null,
    playtestLabel: isPlaytest ? PLAYTEST_LABEL : null,
    playtestDuration: isPlaytest ? PLAYTEST_DURATION : null,
    playtestFocusPoints: isPlaytest ? [...PLAYTEST_FOCUS_POINTS] : []
  };
}
