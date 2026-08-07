import { FALLBACK_BEATMAP } from './config.js';
import { loadSave, writeSave, recordRun } from './storage.js';
import { MusicEngine } from './audio.js';
import { RotorhythmGame } from './game.js?v=3';
import { observeGooglePlayer, signInGooglePlayer, signOutGooglePlayer, googleAuthMessage } from './auth.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const save = loadSave(); let selectedMode = 'campaign', game = null, audio = new MusicEngine(save.settings), beatmap = FALLBACK_BEATMAP, muted = false, toastTimer, googlePlayer = null;

async function loadData() {
  try { const r = await fetch('data/beatmaps/neon-airwaves.json'); if (r.ok) beatmap = await r.json(); } catch { /* file:// fallback */ }
  Promise.allSettled([fetch('data/assets.json'), fetch('data/music.json'), fetch('data/balance.json')]);
}

function showScreen(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); document.body.classList.toggle('game-active', id === 'game-screen'); }
function toast(message, duration = 1400) { const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),duration); }
function formatScore(n) { return Math.round(n).toLocaleString('en-US').padStart(7,'0'); }
function updateProfile() { $('#best-score').textContent=formatScore(save.bestScore);$('#best-accuracy').textContent=save.bestAccuracy?`${Math.round(save.bestAccuracy*100)}%`:'—';$('#wing-count').textContent=`${save.aircraft.length} / 6`; }
function applyAccessibility() { document.body.classList.toggle('reduced-motion',save.settings.reducedMotion);document.body.classList.toggle('safe-flash',save.settings.reducedFlashing||save.settings.photoSafe);document.body.classList.toggle('high-contrast',save.settings.highContrast); }

const settingsSchema = {
  controls: [
    ['select','controlMode','Control mode','Choose how you fly',[['keyboard','Keyboard & mouse'],['touchpad','Laptop touchpad'],['mobile','Mobile multitouch']]],
    ['select','difficulty','Flight difficulty','Obstacle speed and damage',[['easy','Easy'],['normal','Normal'],['hard','Hard'],['expert','Expert']]],
    ['toggle','vibration','Haptic feedback','Vibrate on hits and perfect beats']
  ],
  audio: [
    ['range','musicVolume','Music volume','Generated instrument layers',0,1,.01],['range','effectsVolume','Effects volume','Pulse, pickup, and damage sounds',0,1,.01],['toggle','metronome','Optional metronome','Audible tick on every beat']
  ],
  accessibility: [
    ['toggle','beatIndicators','Visual beat track','Shape and motion based timing cue'],['range','visualIntensity','Visual intensity','Background detail and particles',.2,1,.05],['toggle','reducedMotion','Reduced motion','Reduce particles and interface movement'],['toggle','reducedFlashing','Reduced flashing','Disable bright beat flashes'],['toggle','photoSafe','Photosensitivity-safe mode','Minimize flashes and high-frequency patterns'],['toggle','highContrast','High-contrast interface','Increase UI separation'],['range','screenShake','Screen shake','Camera impact intensity',0,1,.05],['range','timingWindow','Timing window','Scale perfect and good windows',.7,1.6,.05]
  ],
  calibration: [
    ['number','audioLatency','Audio latency','Offset in milliseconds',-250,250,1],['number','displayLatency','Display latency','Offset in milliseconds',-250,250,1],['number','keyboardLatency','Keyboard input latency','Offset in milliseconds',-250,250,1],['number','touchLatency','Touch input latency','Offset in milliseconds',-250,250,1]
  ]
};

function renderSettings(tab='controls') {
  const root=$('#settings-content');root.innerHTML='';
  for(const item of settingsSchema[tab]){const [type,key,title,desc,...opts]=item;const row=document.createElement('div');row.className='setting-row';row.innerHTML=`<label for="setting-${key}"><b>${title}</b><small>${desc}</small></label>`;let control;
    if(type==='select'){control=document.createElement('select');for(const [v,l] of opts[0])control.add(new Option(l,v));control.value=save.settings[key];}
    else if(type==='toggle'){control=document.createElement('label');control.className='toggle';control.innerHTML=`<input id="setting-${key}" type="checkbox" ${save.settings[key]?'checked':''}><i></i>`;control=control.querySelector('input').parentElement;}
    else {control=document.createElement('input');control.type=type;control.min=opts[0];control.max=opts[1];control.step=opts[2];control.value=save.settings[key];}
    if(type!=='toggle')control.id=`setting-${key}`;control.dataset.key=key;control.dataset.type=type;row.append(control);root.append(row);
  }
  if(tab==='calibration'){const box=document.createElement('div');box.className='calibrate-box';box.innerHTML='<b>Tap calibration</b><p>Start the pulse, then tap in time eight times. Your median input offset will be applied.</p><button type="button" class="secondary-button" id="calibrate-button">Start calibration</button>';root.append(box);$('#calibrate-button').onclick=startCalibration;}
  root.oninput=e=>{let control=e.target.closest('[data-key]');if(!control)return;const key=control.dataset.key,type=control.dataset.type;const actual=type==='toggle'?control.querySelector?.('input')||control:control;save.settings[key]=type==='toggle'?actual.checked:type==='range'||type==='number'?Number(actual.value):actual.value;writeSave(save);applyAccessibility();audio.setVolumes();updateTouchControls();};
}

async function startCalibration() {
  await audio.unlock(); const btn=$('#calibrate-button'),times=[];let next=performance.now()+600,count=0;btn.textContent='Tap on each pulse';
  const pulse=()=>{if(count>=8){const avg=times.length?Math.round(times.sort((a,b)=>a-b)[Math.floor(times.length/2)]):0;const key=save.settings.controlMode==='mobile'?'touchLatency':'keyboardLatency';save.settings[key]=Math.max(-250,Math.min(250,avg));writeSave(save);renderSettings('calibration');toast(`Calibration saved: ${save.settings[key]} ms`);return;}next=performance.now()+500;audio.effect('perfect');count++;setTimeout(pulse,500)};btn.onclick=()=>{times.push(performance.now()-next);btn.textContent=`Tap recorded ${times.length}/8`};pulse();
}

function updateTouchControls() { const touch=save.settings.controlMode!=='keyboard'||matchMedia('(pointer: coarse)').matches;$('#touch-controls').classList.toggle('enabled',touch); }

function renderGooglePlayer(player) {
  googlePlayer=player;const signedIn=Boolean(player);$('#account-button').classList.toggle('signed-in',signedIn);$('#account-avatar').textContent=signedIn?player.displayName.slice(0,1).toUpperCase():'G';$('#account-label').textContent=signedIn?player.displayName.split(' ')[0].toUpperCase():'SIGN IN';$('#account-button').setAttribute('aria-label',signedIn?`Google account for ${player.displayName}`:'Sign in with Google');$('#signed-out-actions').hidden=signedIn;$('#signed-in-actions').hidden=!signedIn;
  if(signedIn){$('#pilot-avatar').textContent=player.displayName.slice(0,1).toUpperCase();$('#pilot-name').textContent=player.displayName;$('#pilot-email').textContent=player.email;$('#account-title').textContent='Signal authenticated.';$('#account-description').textContent='Your Google account identifies this pilot profile.';}else{$('#account-title').textContent='Fly under your own signal.';$('#account-description').textContent='Sign in with your Google account to identify your pilot profile. Rotorhythm remains fully playable as a guest.';}
}

async function initGoogleAuth(){try{await observeGooglePlayer(renderGooglePlayer)}catch(error){$('#auth-error').textContent=googleAuthMessage(error)}}

async function startGame(mode=selectedMode) {
  if(!window.Phaser){toast('Phaser could not load. Check your connection.',3000);return;}
  await audio.unlock();audio.start(beatmap.bpm);showScreen('game-screen');updateTouchControls();
  game=new RotorhythmGame('game-container',beatmap,save.settings,audio,{
    hud:s=>{$('#hud-score').textContent=Math.round(s.score).toString().padStart(6,'0');$('#hud-combo').textContent=s.combo;$('#hud-multiplier').textContent=`×${s.multiplier}`;$('#energy-fill').style.width=`${s.energy}%`;$$('#layer-stack span').forEach((el,i)=>el.classList.toggle('on',i<s.layers));},
    judge:(label,value)=>{toast(label,value?650:900);$('#beat-label').textContent=label;if(navigator.vibrate&&save.settings.vibration&&value===1)navigator.vibrate(22);setTimeout(()=>$('#beat-label').textContent='BEAT',700);},
    district:(d,i)=>{$('#district-name').textContent=d.name.toUpperCase();$('.district-tag small').textContent=`DISTRICT ${String(i+1).padStart(2,'0')}`;},
    power:p=>{$('#power-slot b').textContent=(p||'EMPTY').toUpperCase();$('#power-slot b').style.color=p?'var(--pink)':'';}, end:showResults
  },Number($('#district-select').value));game.boot(mode);
  if(!sessionStorage.getItem('rr-tutorial-seen')&&mode!=='practice'){sessionStorage.setItem('rr-tutorial-seen','1');setTimeout(()=>toast('HOLD SPACE OR THE LEFT SIDE TO RISE',2800),600);setTimeout(()=>toast('PASS GATES ON THE BEAT',2500),3500);setTimeout(()=>toast('ENTER / RIGHT BUTTON FIRES A BEAT PULSE',2800),6500);}
}

function showResults(stats) { const newBest=recordRun(save,stats);showScreen('results-screen');const pct=Math.round(stats.accuracy*100),grade=pct>=95?'S':pct>=88?'A':pct>=76?'B':pct>=62?'C':'D';$('#result-title').textContent=stats.success?'SIGNAL HELD':'SIGNAL LOST';$('#result-grade').textContent=grade;$('#result-score').textContent=formatScore(stats.score);$('#new-best').style.visibility=newBest?'visible':'hidden';$('#result-accuracy').textContent=`${pct}%`;$('#result-combo').textContent=stats.bestCombo;$('#result-misses').textContent=stats.misses;$('#result-distance').textContent=`${Math.round(stats.distance)} m`;updateProfile(); }
function pause(){if(!game?.scene||game.scene.ended)return;game.pause();audio.stop();$('#pause-dialog').showModal();}
function resume(){game.resume();audio.start(beatmap.bpm);$('#pause-dialog').close();}
function quit(){audio.stop();game?.destroy();game=null;$('#pause-dialog').close();showScreen('menu-screen');}

$('#play-button').onclick=()=>startGame();$('#practice-button').onclick=()=>startGame('practice');$('#retry-button').onclick=()=>startGame(game?.mode||selectedMode);$('#results-menu-button').onclick=quit;$('#home-button').onclick=()=>{if(game?.scene&&!game.scene.ended)pause();else{game?.destroy();game=null;showScreen('menu-screen')}};
$('#settings-button').onclick=()=>{$('#settings-dialog').showModal();renderSettings('controls')};$$('.settings-tabs button').forEach(b=>b.onclick=()=>{$$('.settings-tabs button').forEach(x=>x.classList.toggle('active',x===b));renderSettings(b.dataset.tab)});
$('#fullscreen-button').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();$('#mute-button').onclick=async()=>{await audio.unlock();muted=audio.toggleMute();$('#mute-button').textContent=muted?'×':'♫';};
$('#account-button').onclick=()=>{$('#auth-error').textContent='';$('#account-dialog').showModal()};$('#account-close').onclick=()=>$('#account-dialog').close();$('#guest-button').onclick=()=>$('#account-dialog').close();$('#google-signin-button').onclick=async()=>{const button=$('#google-signin-button');button.disabled=true;button.textContent='Connecting to Google…';$('#auth-error').textContent='';try{await signInGooglePlayer();$('#account-dialog').close();toast('GOOGLE PROFILE CONNECTED')}catch(error){$('#auth-error').textContent=googleAuthMessage(error)}finally{button.disabled=false;button.innerHTML='<span>G</span> Continue with Google'}};$('#google-signout-button').onclick=async()=>{try{await signOutGooglePlayer();toast('SIGNED OUT')}catch(error){$('#auth-error').textContent=googleAuthMessage(error)}};
$$('.mode-card').forEach(c=>c.onclick=()=>{$$('.mode-card').forEach(x=>x.classList.toggle('selected',x===c));selectedMode=c.dataset.mode;toast(c.querySelector('b').textContent.toUpperCase())});
$('#pause-button').onclick=pause;$('#resume-button').onclick=resume;$('#restart-button').onclick=()=>{$('#pause-dialog').close();audio.stop();startGame(game.mode)};$('#quit-button').onclick=quit;

const flight=$('#flight-zone');for(const evt of ['pointerdown','touchstart'])flight.addEventListener(evt,e=>{e.preventDefault();game?.setRising(true)},{passive:false});for(const evt of ['pointerup','pointercancel','pointerleave','touchend'])flight.addEventListener(evt,e=>{e.preventDefault();game?.setRising(false)},{passive:false});
$('#pulse-button').addEventListener('pointerdown',e=>{e.preventDefault();game?.pulse('touch')});$('#power-button').addEventListener('pointerdown',e=>{e.preventDefault();game?.usePower()});
window.addEventListener('blur',()=>{if(game?.scene&&!game.scene.ended&&!game.scene.pausedRun)pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.scene&&!game.scene.ended&&!game.scene.pausedRun)pause()});

loadData();updateProfile();applyAccessibility();updateTouchControls();renderSettings();initGoogleAuth();
