import Phaser from 'phaser';

const MAP_KEY = 'level1';
const MAP_PATH = 'assets/tilemaps/level1.jason.tmj';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    const progressBar = this.add.graphics();

    this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px', color: '#e0d0ff',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x7c4dff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.json(MAP_KEY, MAP_PATH);
    this.load.json('kenney-dungeon-tsj', 'assets/tilemaps/kenney-dungeon.tsj');

    // Dungeon floor + wall tiles
    const iso = 'assets/tilesets/kenney_miniature_dungeon/Isometric/';
    this.load.image('chestClosed_E',  iso + 'chestClosed_E.png');
    this.load.image('dirtTiles_E',    iso + 'dirtTiles_E.png');
    this.load.image('stoneWallAged_E', iso + 'stoneWallAged_E.png');

    // Character sprites — 8 directions (0–7), idle + 10 run frames each
    const charBase = 'assets/tilesets/kenney_miniature_dungeon/Characters/Male/';
    for (let dir = 0; dir < 8; dir++) {
      this.load.image(`char_idle_${dir}`, charBase + `Male_${dir}_Idle0.png`);
      for (let f = 0; f < 10; f++) {
        this.load.image(`char_run_${dir}_${f}`, charBase + `Male_${dir}_Run${f}.png`);
      }
    }
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
