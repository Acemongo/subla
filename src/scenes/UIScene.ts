import Phaser from 'phaser';
import { supabase } from '../config/supabaseClient';

export class UIScene extends Phaser.Scene {
  private hpBar!:   Phaser.GameObjects.Graphics;
  private wildBar!: Phaser.GameObjects.Graphics;
  private hpText!:   Phaser.GameObjects.Text;
  private wildText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // ---- Title (top-center) ----
    this.add.text(width / 2, 10, '🗺 Subterranean Los Angeles', {
      fontSize: '18px', color: '#c0a0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0);

    this.add.text(width / 2, 40, 'v0.1.3', {
      fontSize: '11px', color: '#e0d0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0);

    // ---- HP bar (top-left) ----
    const barX = 16, barY = 16, barW = 160, barH = 14;

    this.add.text(barX, barY, 'HP', { fontSize: '11px', color: '#ff8080' });
    this.add.rectangle(barX + 20, barY + 7, barW, barH, 0x1a0a0a).setOrigin(0, 0.5);
    this.hpBar = this.add.graphics();
    this.hpText = this.add.text(barX + 20 + barW + 6, barY, '', { fontSize: '11px', color: '#ff8080' });

    // ---- WILD bar ----
    const wildY = barY + 20;
    this.add.text(barX, wildY, 'WI', { fontSize: '11px', color: '#80c0ff' });
    this.add.rectangle(barX + 20, wildY + 7, barW, barH, 0x0a0a1a).setOrigin(0, 0.5);
    this.wildBar = this.add.graphics();
    this.wildText = this.add.text(barX + 20 + barW + 6, wildY, '', { fontSize: '11px', color: '#80c0ff' });

    // ---- Inventory button (top-right) ----
    const invBtn = this.add
      .text(width - 16, 16, '🎒 [I]nventory', {
        fontSize: '13px', color: '#ffe0a0',
        backgroundColor: '#00000077', padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    invBtn.on('pointerover', () => invBtn.setColor('#ffffff'));
    invBtn.on('pointerout',  () => invBtn.setColor('#ffe0a0'));
    invBtn.on('pointerup', () => {
      const game = this.scene.get('GameScene') as any;
      game?.inventoryUI?.toggle();
    });

    // ---- Depth indicator (bottom-left) ----
    this.add.text(16, height - 40, '📍 Depth: Surface', {
      fontSize: '14px', color: '#a0c0ff',
      backgroundColor: '#00000077', padding: { x: 6, y: 3 },
    });

    // ---- Save button ----
    const saveBtn = this.add
      .text(width - 16, height - 40, '💾 Save', {
        fontSize: '13px', color: '#a0c0a0',
        backgroundColor: '#00000077', padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    saveBtn.on('pointerover', () => saveBtn.setColor('#80ff80'));
    saveBtn.on('pointerout',  () => saveBtn.setColor('#a0c0a0'));
    saveBtn.on('pointerup', async () => {
      saveBtn.setText('💾 Saving...').setColor('#ffcc88').disableInteractive();
      const gameScene = this.scene.get('GameScene') as any;
      if (gameScene?.persistPlayerState) await gameScene.persistPlayerState();
      saveBtn.setText('💾 Saved!').setColor('#60e060');
      this.time.delayedCall(1500, () => {
        saveBtn.setText('💾 Save').setColor('#a0c0a0').setInteractive({ useHandCursor: true });
      });
    });

    // ---- Sign Out button ----
    const signOutBtn = this.add
      .text(width - 16, height - 64, '🚪 Sign Out', {
        fontSize: '13px', color: '#a08080',
        backgroundColor: '#00000077', padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    signOutBtn.on('pointerover', () => signOutBtn.setColor('#ff9090'));
    signOutBtn.on('pointerout',  () => signOutBtn.setColor('#a08080'));
    signOutBtn.on('pointerup', async () => {
      signOutBtn.setText('🚪 Saving...').setColor('#ffcc88').disableInteractive();
      const gameScene = this.scene.get('GameScene') as any;
      if (gameScene?.persistPlayerState) await gameScene.persistPlayerState();
      await supabase.auth.signOut();
    });

    // Initial render
    this.time.delayedCall(200, () => this.refreshHud());
  }

  /** Called by GameScene whenever HP/WILD change */
  refreshHud(): void {
    const game = this.scene.get('GameScene') as any;
    if (!game) return;

    const hp      = game.currentHp   ?? 0;
    const maxHp   = game.maxHp       ?? 1;
    const wild    = game.currentWild ?? 0;
    const maxWild = game.maxWild     ?? 1;

    const barX = 36, barW = 160, barH = 14;

    this.hpBar.clear();
    this.hpBar.fillStyle(0xcc2020);
    this.hpBar.fillRect(barX, 16, Math.round(barW * (hp / maxHp)), barH);
    this.hpBar.setDepth(10);
    this.hpText.setText(`${hp}/${maxHp}`).setDepth(10);

    this.wildBar.clear();
    this.wildBar.fillStyle(0x2060cc);
    this.wildBar.fillRect(barX, 36, Math.round(barW * (wild / maxWild)), barH);
    this.wildBar.setDepth(10);
    this.wildText.setText(`${wild}/${maxWild}`).setDepth(10);
  }
}
