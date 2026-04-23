const SCENE_GRAPH = {
  welcome: ['home'],
  home: ['prep'],
  prep: ['home', 'match'],
  match: ['result'],
  result: ['prep', 'home', 'match']
};

export function createSceneState() {
  return {
    sceneId: 'welcome',
    previousSceneId: null,
    devPanelOpen: false,
    activeOverlay: null
  };
}

export function canTransitionScene(fromSceneId, toSceneId) {
  return Boolean(SCENE_GRAPH[fromSceneId]?.includes(toSceneId));
}

export function transitionScene(state, nextSceneId) {
  if (!canTransitionScene(state.sceneId, nextSceneId)) {
    throw new Error(`Invalid scene transition: ${state.sceneId} -> ${nextSceneId}`);
  }

  return {
    ...state,
    previousSceneId: state.sceneId,
    sceneId: nextSceneId,
    activeOverlay: null
  };
}

export function setDevPanelOpen(state, devPanelOpen) {
  return {
    ...state,
    devPanelOpen: Boolean(devPanelOpen)
  };
}

export function setActiveOverlay(state, activeOverlay) {
  return {
    ...state,
    activeOverlay: activeOverlay ?? null
  };
}

export function closeActiveOverlay(state) {
  return {
    ...state,
    activeOverlay: null
  };
}
