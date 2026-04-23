function resolveAsset(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

export const sceneVisualTheme = {
  palette: {
    bg: '#08111b',
    panel: 'rgba(8, 18, 29, 0.82)',
    line: 'rgba(116, 146, 184, 0.18)',
    text: '#edf3fa',
    muted: '#8ea3ba',
    blue: '#4ce7d0',
    red: '#ff7d8f',
    amber: '#ffc85a'
  },
  assets: {
    welcomeAtmosphere: resolveAsset('../assets/visual/scene-welcome-atmosphere.png'),
    homeAtmosphere: resolveAsset('../assets/visual/scene-home-atmosphere.png'),
    prepAtmosphere: resolveAsset('../assets/visual/scene-prep-atmosphere.png'),
    resultAtmosphere: resolveAsset('../assets/visual/scene-result-atmosphere.png'),
    sceneFrame: resolveAsset('../assets/visual/scene-ui-frame.svg'),
    primaryButton: resolveAsset('../assets/visual/scene-button-primary.svg'),
    secondaryButton: resolveAsset('../assets/visual/scene-button-secondary.svg'),
    modalFrame: resolveAsset('../assets/visual/scene-modal-frame.svg'),
    packCardSurface: resolveAsset('../assets/visual/scene-pack-card-surface.svg'),
    titleBar: resolveAsset('../assets/visual/scene-title-bar.svg'),
    identityCardBlue: resolveAsset('../assets/visual/scene-identity-card-blue.svg'),
    identityCardRed: resolveAsset('../assets/visual/scene-identity-card-red.svg')
  }
};
