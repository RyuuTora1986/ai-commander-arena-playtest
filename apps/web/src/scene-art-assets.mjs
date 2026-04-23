function resolveAsset(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

const commanderPortraitMap = {
  'lie-mai': resolveAsset('../assets/visual/portraits/portrait-lie-mai.png'),
  mistveil: resolveAsset('../assets/visual/portraits/portrait-mistveil.png'),
  shouheng: resolveAsset('../assets/visual/portraits/portrait-shouheng.png'),
  baileng: resolveAsset('../assets/visual/portraits/portrait-baileng.png'),
  chizhang: resolveAsset('../assets/visual/portraits/portrait-chizhang.png'),
  'gui-ling': resolveAsset('../assets/visual/portraits/portrait-gui-ling.png')
};

const unitSpriteMap = {
  blue: {
    guardian: resolveAsset('../assets/visual/units/unit-frontline-blue.png'),
    striker: resolveAsset('../assets/visual/units/unit-damage-blue.png'),
    support: resolveAsset('../assets/visual/units/unit-support-blue.png'),
    artillery: resolveAsset('../assets/visual/units/unit-aoe-blue.png'),
    assassin: resolveAsset('../assets/visual/units/unit-flanker-blue.png')
  },
  red: {
    guardian: resolveAsset('../assets/visual/units/unit-frontline-red.png'),
    striker: resolveAsset('../assets/visual/units/unit-damage-red.png'),
    support: resolveAsset('../assets/visual/units/unit-support-red.png'),
    artillery: resolveAsset('../assets/visual/units/unit-aoe-red.png'),
    assassin: resolveAsset('../assets/visual/units/unit-flanker-red.png')
  }
};

const objectiveSpriteMap = {
  blueCore: resolveAsset('../assets/visual/objectives/objective-core-blue.png'),
  redCore: resolveAsset('../assets/visual/objectives/objective-core-red.png'),
  primeRelay: resolveAsset('../assets/visual/objectives/objective-prime-relay.png'),
  beacon: resolveAsset('../assets/visual/objectives/objective-beacon-neutral.png')
};

export function getCommanderPortraitAsset(commanderId) {
  return commanderPortraitMap[commanderId] ?? null;
}

export function getUnitSpriteAsset(roleId, teamId) {
  const side = teamId === 'red' ? 'red' : 'blue';
  return unitSpriteMap[side]?.[roleId] ?? null;
}

export function getObjectiveSpriteAsset(kind) {
  return objectiveSpriteMap[kind] ?? null;
}
