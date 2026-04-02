import Phaser from 'phaser';
import { AuthScene } from '../scenes/AuthScene';
import { BootScene } from '../scenes/BootScene';
import { CharacterCheckScene } from '../scenes/CharacterCheckScene';
import { CharacterCreateScene } from '../scenes/CharacterCreateScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a0a2e',
  scene: [AuthScene, BootScene, CharacterCheckScene, CharacterCreateScene, GameScene, UIScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
