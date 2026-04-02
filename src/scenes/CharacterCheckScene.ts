import Phaser from 'phaser';
import { getCurrentUserId, loadCharacter } from '../player/PlayerState';

/**
 * CharacterCheckScene
 *
 * Runs silently after assets are loaded (BootScene).
 * Checks whether the authenticated user has a character sheet saved.
 *
 *   Has character  → GameScene
 *   No character   → CharacterCreateScene
 *   Not authed     → AuthScene (failsafe; shouldn't normally reach here)
 */
export class CharacterCheckScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterCheckScene' });
  }

  async create(): Promise<void> {
    const { width, height } = this.cameras.main;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0520);
    this.add
      .text(width / 2, height / 2, 'Descending...', {
        fontSize: '18px',
        color: '#7060aa',
      })
      .setOrigin(0.5);

    const userId = await getCurrentUserId();

    if (!userId) {
      // Not authenticated — kick back to auth
      this.scene.start('AuthScene');
      return;
    }

    const character = await loadCharacter(userId);

    if (character) {
      // Existing character — go straight to game
      this.scene.start('GameScene', { character });
    } else {
      // No character yet — go to creation
      this.scene.start('CharacterCreateScene', { userId });
    }
  }
}
