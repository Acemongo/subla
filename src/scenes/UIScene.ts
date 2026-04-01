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

    // Sign out button — bottom right
    const signOutBtn = this.add
      .text(width - 16, height - 40, '🚪 Sign Out', {
        fontSize: '13px',
        color: '#a08080',
        backgroundColor: '#00000077',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    signOutBtn.on('pointerover', () => signOutBtn.setColor('#ff9090'));
    signOutBtn.on('pointerout', () => signOutBtn.setColor('#a08080'));
    signOutBtn.on('pointerdown', async () => {
      await supabase.auth.signOut();
      // main.ts listener handles the reload
    });
  }
}
