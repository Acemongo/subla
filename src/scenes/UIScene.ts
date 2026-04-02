import Phaser from 'phaser';
import { supabase } from '../config/supabaseClient';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Depth indicator — bottom left
    this.add.text(16, height - 40, '📍 Depth: Surface', {
      fontSize: '14px',
      color: '#a0c0ff',
      backgroundColor: '#00000077',
      padding: { x: 6, y: 3 },
    });

    // Gear slots — top right
    this.add
      .text(width - 16, 16, '🎒 Gear', {
        fontSize: '14px',
        color: '#ffe0a0',
        backgroundColor: '#00000077',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0);

    // Save & Quit button — bottom right
    const quitBtn = this.add
      .text(width - 16, height - 40, '💾 Save & Quit', {
        fontSize: '13px',
        color: '#a08080',
        backgroundColor: '#00000077',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    quitBtn.on('pointerover', () => quitBtn.setColor('#ffcc88'));
    quitBtn.on('pointerout',  () => quitBtn.setColor('#a08080'));
    quitBtn.on('pointerdown', async () => {
      quitBtn.setText('💾 Saving...').setColor('#ffcc88').disableInteractive();

      // Tell GameScene to persist state, then sign out
      const gameScene = this.scene.get('GameScene') as import('./GameScene').GameScene;
      if (gameScene?.persistPlayerState) {
        await gameScene.persistPlayerState();
      }

      await supabase.auth.signOut();
      // main.ts listener handles the reload
    });
  }
}
