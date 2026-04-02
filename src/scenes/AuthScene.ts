import Phaser from 'phaser';
import { supabase } from '../config/supabaseClient';

/**
 * AuthScene — login / signup screen.
 * Uses Supabase email+password auth.
 * On success, starts BootScene (which leads to GameScene).
 */
export class AuthScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private emailInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private formDiv!: HTMLDivElement;

  constructor() {
    super({ key: 'AuthScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0520);

    // Title
    this.add
      .text(width / 2, height / 2 - 180, '🕳️ Subterranean Los Angeles', {
        fontSize: '28px',
        color: '#c0a0ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 140, 'Sign in to descend', {
        fontSize: '15px',
        color: '#7060aa',
      })
      .setOrigin(0.5);

    // Status message (errors, loading)
    this.statusText = this.add
      .text(width / 2, height / 2 + 100, '', {
        fontSize: '14px',
        color: '#ff6060',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5);

    // HTML form overlay
    this.formDiv = document.createElement('div');
    this.formDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) translateY(-30px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 100;
    `;

    const inputStyle = `
      background: #1e1040;
      border: 1px solid #5030a0;
      color: #e0d0ff;
      padding: 10px 14px;
      font-size: 15px;
      border-radius: 6px;
      outline: none;
      width: 280px;
    `;

    this.emailInput = document.createElement('input');
    this.emailInput.type = 'email';
    this.emailInput.placeholder = 'Email';
    this.emailInput.style.cssText = inputStyle;

    this.passwordInput = document.createElement('input');
    this.passwordInput.type = 'password';
    this.passwordInput.placeholder = 'Password';
    this.passwordInput.style.cssText = inputStyle;
    this.passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    const btnStyle = `
      padding: 10px;
      font-size: 15px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      width: 100%;
    `;

    const loginBtn = document.createElement('button');
    loginBtn.textContent = 'Sign In';
    loginBtn.style.cssText = btnStyle + 'background: #6030e0; color: white;';
    loginBtn.addEventListener('click', () => this.handleLogin());

    const signupBtn = document.createElement('button');
    signupBtn.textContent = 'Create Account';
    signupBtn.style.cssText = btnStyle + 'background: #2a1060; color: #b090ff;';
    signupBtn.addEventListener('click', () => this.handleSignup());

    this.formDiv.appendChild(this.emailInput);
    this.formDiv.appendChild(this.passwordInput);
    this.formDiv.appendChild(loginBtn);
    this.formDiv.appendChild(signupBtn);
    document.body.appendChild(this.formDiv);

    // Check for existing session
    this.checkExistingSession();
  }

  private async checkExistingSession(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.setStatus('Welcome back! Loading...', '#60e060');
      this.time.delayedCall(800, () => this.launchGame());
    }
  }

  private setStatus(msg: string, color = '#ff6060'): void {
    this.statusText.setText(msg).setColor(color);
  }

  private async handleLogin(): Promise<void> {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;
    if (!email || !password) {
      this.setStatus('Please enter email and password.');
      return;
    }
    this.setStatus('Signing in...', '#a090ff');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      this.setStatus(error.message);
    } else {
      this.setStatus('Signed in! Descending...', '#60e060');
      this.time.delayedCall(600, () => this.launchGame());
    }
  }

  private async handleSignup(): Promise<void> {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;
    if (!email || !password) {
      this.setStatus('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      this.setStatus('Password must be at least 6 characters.');
      return;
    }
    this.setStatus('Creating account...', '#a090ff');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      this.setStatus(error.message);
    } else {
      this.setStatus('Account created! Check email to confirm, then sign in.', '#60e060');
    }
  }

  private launchGame(): void {
    this.cleanup();
    // Refocus canvas so Phaser receives keyup events after HTML form steals focus
    setTimeout(() => {
      const canvas = this.game.canvas;
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      this.scene.start('BootScene');
    }, 50);
  }

  private cleanup(): void {
    if (this.formDiv && this.formDiv.parentNode) {
      this.formDiv.parentNode.removeChild(this.formDiv);
    }
  }

  shutdown(): void {
    this.cleanup();
  }
}
