import {
  commanderTemplates,
  matchupPresetCatalog
} from '../../../packages/content-data/src/index.mjs';
import { getCommanderPortraitAsset } from './scene-art-assets.mjs';

const playerFacingPresetCopy = {
  default: {
    title: '先手压制',
    summary: '蓝方想先开局，红方更擅长守住阵地再反打。',
    watchFocus: '看第一波交火后，哪边能先把中线站稳。'
  },
  mirror: {
    title: '埋伏与运营',
    summary: '一边想靠绕后和埋伏找机会，一边想慢慢控点拿优势。',
    watchFocus: '看谁先把小机会滚成稳定的场面。'
  },
  'all-rule': {
    title: '搏命冲阵',
    summary: '一边敢赌大团翻盘，一边更会稳稳控图，不轻易给机会。',
    watchFocus: '看落后一方会不会突然提速，把局面一波打乱。'
  }
};

function cloneIdentity(commander) {
  return {
    id: commander.id,
    name: commander.name,
    persona: commander.persona,
    styleLabel: commander.styleLabel,
    styleHook: commander.styleHook,
    strengthText: commander.strengthText,
    riskText: commander.riskText,
    portraitAsset: getCommanderPortraitAsset(commander.id)
  };
}

export function getCommanderIdentity(commander) {
  if (!commander) {
    return null;
  }

  const template = commanderTemplates.find(
    (candidate) => candidate.id === commander.id || candidate.name === commander.name
  );

  return cloneIdentity({
    ...template,
    ...commander
  });
}

export function listMatchupPresetOptions() {
  return ['default', 'mirror', 'all-rule'].map((key) => ({
    value: matchupPresetCatalog[key].value,
    label: playerFacingPresetCopy[key].title,
    title: playerFacingPresetCopy[key].title,
    summary: playerFacingPresetCopy[key].summary,
    watchFocus: playerFacingPresetCopy[key].watchFocus
  }));
}

export function buildMatchupPreview(preset) {
  const catalogEntry = matchupPresetCatalog[preset] ?? matchupPresetCatalog.default;
  const playerFacingCopy = playerFacingPresetCopy[preset] ?? playerFacingPresetCopy.default;
  const blueCommanders = commanderTemplates.slice(0, 3).map(cloneIdentity);
  const redCommanders = commanderTemplates.slice(3, 6).map(cloneIdentity);

  return {
    ...catalogEntry,
    ...playerFacingCopy,
    ruleLine: '3v3 AI 对抗 / Prime Relay / 06:00',
    blueCommanders,
    redCommanders
  };
}
