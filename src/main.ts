import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { supabase } from './config/supabaseClient';

// Clean up any auth token fragments from the URL (e.g. from email confirmation links)
if (window.location.hash.includes('access_token')) {
  window.history.replaceState(null, '', window.location.pathname);
}

// AuthScene is the first scene in the list — it checks for an existing
// session and either drops you into the game or shows the login form.
// On sign-out from UIScene, we restart back to AuthScene.

// Listen for auth state changes globally (handles token refresh, sign-out, etc.)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    // Reload the page on sign-out — cleanest way to reset all game state
    window.location.reload();
  }
});

const game = new Phaser.Game(gameConfig);

// Prevent sticky keys: when the window loses focus, synthetically release
// all movement keys so Phaser doesn't see them as held.
const MOVEMENT_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
window.addEventListener('blur', () => {
  MOVEMENT_KEYS.forEach(k => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  });
});

export default game;
