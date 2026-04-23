export function renderSceneShell(sceneState) {
  const {
    sceneId,
    devPanelOpen,
    activeOverlay,
    overlayHtml = '',
    allowDevPanel = true,
    controlButtonLabel = '控制面板'
  } = sceneState;

  return `
    <div class="scene-shell" data-scene="${sceneId}">
      <button
        type="button"
        class="scene-dev-toggle"
        data-action="open-controls"
        aria-expanded="${activeOverlay === 'controls' ? 'true' : 'false'}"
      >${controlButtonLabel}</button>
      <div id="scene-overlay-root" class="scene-overlay-root${activeOverlay ? ' is-visible' : ''}">
        ${overlayHtml}
      </div>
      <section id="scene-player-root" class="scene-player-root"></section>
      ${allowDevPanel ? `
        <aside
          id="scene-dev-panel-root"
          class="scene-dev-panel-root${devPanelOpen ? ' is-open' : ''}"
        ></aside>
      ` : ''}
    </div>
  `;
}
