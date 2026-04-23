import { renderDevPanel as renderPlayerHudDevPanel } from './player-hud-markup.mjs';

export function renderDevPanel(viewModel) {
  return renderPlayerHudDevPanel({
    ...viewModel,
    defaultOpen: viewModel?.devPanelOpen ?? false
  });
}
