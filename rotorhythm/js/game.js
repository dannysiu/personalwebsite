import { DISTRICTS, MODES, POWERUPS } from './config.js';
import { RhythmClock } from './rhythm.js';

const EVENTS = {
  HUD: 'rr:hud', JUDGE: 'rr:judge', DISTRICT: 'rr:district', POWER: 'rr:power', END: 'rr:end', PAUSE: 'rr:pause'
};

export class RotorhythmGame {
  constructor(container, beatmap, settings, audio, callbacks = {}, startDistrict = -1) {
    this.container = container; this.beatmap = beatmap; this.settings = settings; this.audio = audio; this.callbacks = callbacks; this.startDistrict = startDistrict; this.game = null; this.scene = null; this.mode = 'campaign';
  }
  boot(mode = 'campaign') {
    this.destroy(); this.mode = mode; const owner = this;
    class FlightScene extends Phaser.Scene {
      constructor() { super('flight'); this.owner = owner; }
      create() { this.owner.scene = this; this.build(); }
      build() {
        this.balance = { ...MODES[this.owner.mode] }; this.map = this.owner.beatmap; this.settings = this.owner.settings;
        const difficulty = { easy: .82, normal: 1, hard: 1.18, expert: 1.38 }[this.settings.difficulty] || 1;
        this.scrollSpeed = this.balance.speed * difficulty; this.clock = new RhythmClock(this.map, this.settings); this.clock.start();
        this.stats = { score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, pulses: 0, distance: 0, lives: this.balance.lives, energy: 0, ghost: [] };
        this.lastBeat = -1; this.lastSpawnBeat = -1; this.lastSection = -1; this.invulnerableUntil = 0; this.currentPower = null; this.comboLock = false; this.ended = false; this.pausedRun = false; this.rising = false; this.boss = null; this.projectiles = []; this.entities = [];
        this.cameras.main.setBackgroundColor('#090b1b'); this.buildBackground(); this.buildTextures();
        this.player = this.physics.add.sprite(this.scale.width * .22, this.scale.height * .48, 'craft'); this.player.setDepth(12).setCircle(15, 9, 8).setCollideWorldBounds(true); this.player.body.setGravityY(760); this.player.setMaxVelocity(0, 390);
        this.trail = this.add.particles(0, 0, 'spark', { speedX: { min: -100, max: -45 }, speedY: { min: -12, max: 12 }, lifespan: 500, scale: { start: .75, end: 0 }, frequency: 55, tint: [0x31f3e3, 0xff3dac] }).setDepth(11); this.trail.startFollow(this.player, -25, 0);
        this.gates = this.physics.add.group(); this.hazards = this.physics.add.group(); this.pickups = this.physics.add.group(); this.pulsables = this.physics.add.group();
        this.physics.add.overlap(this.player, this.gates, (_, g) => this.passGate(g)); this.physics.add.overlap(this.player, this.hazards, (_, h) => this.hitHazard(h)); this.physics.add.overlap(this.player, this.pickups, (_, p) => this.collectPickup(p));
        this.input.keyboard.on('keydown-SPACE', () => this.rising = true); this.input.keyboard.on('keyup-SPACE', () => this.rising = false);
        this.input.keyboard.on('keydown-W', () => this.rising = true); this.input.keyboard.on('keyup-W', () => this.rising = false);
        this.input.keyboard.on('keydown-UP', () => this.rising = true); this.input.keyboard.on('keyup-UP', () => this.rising = false);
        this.input.keyboard.on('keydown-ENTER', () => this.pulse('keyboard')); this.input.keyboard.on('keydown-E', () => this.usePower()); this.input.keyboard.on('keydown-ESC', () => this.owner.callbacks.pause?.());
        this.input.on('pointerdown', p => { if (this.settings.controlMode === 'keyboard' && p.x < this.scale.width * .7) this.rising = true; }); this.input.on('pointerup', () => { if (this.settings.controlMode === 'keyboard') this.rising = false; });
        this.scale.on('resize', this.onResize, this); this.changeDistrict(this.owner.startDistrict >= 0 ? this.owner.startDistrict : 0); this.emitHud();
        if (this.owner.mode === 'boss') this.time.delayedCall(1800, () => this.spawnBoss());
      }
      buildTextures() {
        const make = (key, w, h, draw) => { if (this.textures.exists(key)) return; const g = this.make.graphics({ x: 0, y: 0, add: false }); draw(g); g.generateTexture(key, w, h); g.destroy(); };
        make('craft', 68, 44, g => { g.fillStyle(0x081327).fillTriangle(5,22,46,4,59,22).fillTriangle(5,22,46,40,59,22); g.lineStyle(3,0x31f3e3).strokeTriangle(5,22,46,4,59,22).lineBetween(14,22,60,22); g.fillStyle(0xff3dac).fillCircle(46,22,5); g.lineStyle(2,0xdafcff).lineBetween(33,5,33,0).lineBetween(16,0,50,0); });
        make('spark', 8, 8, g => g.fillStyle(0xffffff).fillCircle(4,4,4));
        make('note', 26, 34, g => { g.fillStyle(0xffd166).fillCircle(8,25,7).fillRect(13,4,4,22).fillTriangle(17,4,25,9,17,12); });
        make('hazard', 52, 52, g => { g.fillStyle(0x30102b).fillCircle(26,26,23); g.lineStyle(3,0xff3dac).strokeCircle(26,26,20); for(let i=0;i<8;i++){const a=i*Math.PI/4;g.lineBetween(26+Math.cos(a)*18,26+Math.sin(a)*18,26+Math.cos(a)*25,26+Math.sin(a)*25)} g.fillStyle(0xffe3f6).fillCircle(26,26,4); });
        make('projectile', 24, 12, g => { g.fillStyle(0xffb000).fillRoundedRect(0,2,22,8,4); g.fillStyle(0xffffff).fillCircle(19,6,3); });
      }
      buildBackground() {
        this.bg = this.add.graphics().setDepth(-20); this.stars = this.add.group();
        for (let i=0;i<50;i++) { const s=this.add.circle(Math.random()*this.scale.width,Math.random()*this.scale.height*.7,Math.random()*1.6+.4,0xffffff,Math.random()*.55+.15).setDepth(-18); s.parallax=Math.random()*.12+.04; this.stars.add(s); }
        this.skyline = this.add.graphics().setDepth(-15); this.drawDistrict();
        this.grid = this.add.grid(this.scale.width/2,this.scale.height*.84,this.scale.width*1.4,this.scale.height*.42,48,28,0x090b22,1,0x813cff,.16).setDepth(-14).setRotation(-.025);
      }
      drawDistrict() {
        if (!this.bg) return; const d=DISTRICTS[this.districtIndex||0]; this.bg.clear().fillGradientStyle(d.sky[0],d.sky[0],d.sky[1],d.sky[1],1).fillRect(0,0,this.scale.width,this.scale.height);
        this.skyline.clear(); const base=this.scale.height*.82; for(let x=-20;x<this.scale.width+50;x+=44){const h=55+((x*7+this.districtIndex*31)%145);this.skyline.fillStyle(0x080b20,.92).fillRect(x,base-h,38,h);this.skyline.fillStyle(d.accent,.3);for(let y=base-h+10;y<base-8;y+=15)for(let wx=x+7;wx<x+34;wx+=13)if((wx+y)%3>1)this.skyline.fillRect(wx,y,4,4)}
        if(d.style==='storm') this.skyline.lineStyle(3,0xd9dcff,.3).beginPath().moveTo(this.scale.width*.75,0).lineTo(this.scale.width*.68,this.scale.height*.3).lineTo(this.scale.width*.72,this.scale.height*.28).lineTo(this.scale.width*.64,this.scale.height*.57).strokePath();
        if(d.style==='garden') for(let i=0;i<8;i++)this.skyline.fillStyle(0xb8f2df,.12).fillCircle((i*173)%this.scale.width,100+(i%3)*75,60+i*3);
      }
      update(time, delta) {
        if (this.ended || this.pausedRun) return; const dt=Math.min(delta,32)/1000; const elapsed=this.clock.seconds();
        this.stats.distance += this.scrollSpeed*dt*.08; this.stats.ghost.push([Math.round(elapsed*10)/10,Math.round(this.player.y)]);
        if(this.rising) this.player.setVelocityY(Math.max(this.player.body.velocity.y-1050*dt,-330));
        this.player.rotation=Phaser.Math.Clamp(this.player.body.velocity.y/900,-.32,.4); this.trail.emitting=!this.settings.reducedMotion;
        const beat=this.clock.beat(), phase=this.clock.phase(); if(beat!==this.lastBeat){this.lastBeat=beat;this.onBeat(beat)}
        for(const e of [...this.gates.getChildren(),...this.hazards.getChildren(),...this.pickups.getChildren()]){if(!e.active)continue;e.x-=this.scrollSpeed*dt*(e.speedFactor||1);if(e.rotateSpeed)e.rotation+=e.rotateSpeed*dt;if(e.x<-120)e.destroy()}
        this.stars.children.iterate(s=>{s.x-=this.scrollSpeed*s.parallax*dt;if(s.x<0)s.x=this.scale.width}); this.grid.tilePositionX += this.scrollSpeed*.18*dt;
        if(this.boss?.active){this.boss.x=Phaser.Math.Linear(this.boss.x,this.scale.width*.8,.03);this.boss.rotation=Math.sin(time*.002)*.08}
        const section=this.owner.startDistrict>=0?this.owner.startDistrict:Math.min(DISTRICTS.length-1,Math.floor(beat/32));if(section!==this.lastSection){this.lastSection=section;this.changeDistrict(section)}
        const duration=this.balance.duration===Infinity?Number.MAX_VALUE:this.balance.duration;if(elapsed>=duration)this.finish(true);
        document.getElementById('beat-marker').style.left=`${phase*100}%`; this.emitHud();
      }
      onBeat(beat) {
        if(this.settings.beatIndicators){this.cameras.main.flash(55,49,243,227,false,undefined,this.settings.photoSafe?.08:.025)}
        const d=DISTRICTS[this.districtIndex]; this.skyline.setAlpha(.72+Math.min(this.stats.combo,30)/100);
        if(beat>3 && beat%4===0 && beat!==this.lastSpawnBeat){this.lastSpawnBeat=beat;this.spawnPattern(beat)}
        if(beat%16===8)this.spawnPickup(beat%32===8?'power':'note');
        if((this.owner.mode==='boss'||beat===176)&&!this.boss)this.spawnBoss();
        if(this.boss&&beat%4===2)this.bossAttack();
      }
      spawnPattern(beat) {
        const h=this.scale.height, gap=this.owner.mode==='relaxed'?260:Phaser.Math.Clamp(235-this.stats.distance/140,155,235), center=Phaser.Math.Between(Math.round(h*.26),Math.round(h*.74));
        const gate=this.add.container(this.scale.width+80,center).setDepth(5); const col=DISTRICTS[this.districtIndex].accent;
        const top=this.add.rectangle(0,-(gap/2+h/2),46,h,col,.16).setStrokeStyle(2,col,.8), bottom=this.add.rectangle(0,gap/2+h/2,46,h,col,.16).setStrokeStyle(2,col,.8);
        const line=this.add.rectangle(0,0,5,gap,col,.18); gate.add([top,bottom,line]); this.physics.add.existing(gate); gate.body.setSize(40,gap).setOffset(-20,-gap/2); gate.isGate=true; gate.speedFactor=1; this.gates.add(gate);
        if(beat%8===4){const hazard=this.physics.add.sprite(this.scale.width+210,Phaser.Math.Between(90,h-90),'hazard').setDepth(8);hazard.setCircle(22,4,4);hazard.speedFactor=1.08;hazard.rotateSpeed=2.2;this.hazards.add(hazard);this.pulsables.add(hazard)}
      }
      spawnPickup(kind='note') {
        const y=Phaser.Math.Between(90,this.scale.height-90); if(kind==='note'){for(let i=0;i<4;i++){const n=this.physics.add.sprite(this.scale.width+70+i*36,y+Math.sin(i)*35,'note').setScale(.72).setDepth(9);n.kind='note';n.speedFactor=1;this.pickups.add(n)}} else {const p=this.add.circle(this.scale.width+80,y,18,0xff3dac,.2).setStrokeStyle(2,0xff3dac).setDepth(9);this.physics.add.existing(p);p.kind='power';p.power=POWERUPS[Math.floor(this.clock.beat()/16)%POWERUPS.length];p.body.setCircle(18);p.speedFactor=1;this.pickups.add(p)}
      }
      passGate(gate) {
        if(gate.passed)return;gate.passed=true;const judgment=this.clock.judge(performance.now(),this.settings.controlMode==='mobile'?'touch':'keyboard',this.balance.window+(this.currentPower==='Perfect Pitch'?.06:0));
        if(judgment.value){this.stats.combo++;this.stats.hits++;this.stats.energy=Math.min(100,this.stats.energy+10+judgment.value*8);this.stats.score+=Math.round(1000*judgment.value*this.multiplier());this.stats.bestCombo=Math.max(this.stats.bestCombo,this.stats.combo);this.owner.audio.effect(judgment.grade==='PERFECT'?'perfect':'pulse')}else{this.missBeat()}
        this.owner.callbacks.judge?.(judgment.grade,judgment.value); gate.list?.forEach(o=>o.setAlpha?.(.35));
      }
      missBeat(){this.stats.misses++;if(this.comboLock){this.comboLock=false;this.owner.callbacks.judge?.('COMBO LOCK',.5)}else this.stats.combo=Math.max(0,this.stats.combo-3);this.stats.score=Math.max(0,this.stats.score-150)}
      collectPickup(p){if(!p.active)return;if(p.kind==='note'){this.stats.score+=250*this.multiplier();this.stats.energy=Math.min(100,this.stats.energy+6)}else{this.currentPower=p.power;this.owner.callbacks.power?.(p.power)}this.owner.audio.effect('pickup');p.destroy()}
      hitHazard(h){if(!h.active||performance.now()<this.invulnerableUntil)return;if(this.currentPower==='Bass Shield'){this.currentPower=null;this.owner.callbacks.power?.(null);this.invulnerableUntil=performance.now()+1000;h.destroy();this.owner.callbacks.judge?.('SHIELDED',.7);return}this.invulnerableUntil=performance.now()+1500;this.stats.lives--;this.stats.combo=0;this.owner.audio.effect('hit');this.player.setTint(0xff426e);this.time.delayedCall(400,()=>this.player.clearTint());if(this.settings.screenShake&&!this.settings.reducedMotion)this.cameras.main.shake(180,0.006*this.settings.screenShake);h.destroy();if(this.stats.lives<=0&&this.balance.damage)this.finish(false)}
      pulse(input='keyboard') {
        if(this.ended||this.pausedRun||this.stats.energy<12)return;const j=this.clock.judge(performance.now(),input,this.balance.window+(this.currentPower==='Perfect Pitch'?.06:0));this.stats.pulses++;const cost=j.value?12:20;this.stats.energy=Math.max(0,this.stats.energy-cost);const radius=j.value?190:75;
        const ring=this.add.circle(this.player.x,this.player.y,10,0x31f3e3,.08).setStrokeStyle(3,j.value?0x31f3e3:0xff3dac).setDepth(20);this.tweens.add({targets:ring,radius,alpha:0,duration:j.value?360:210,onComplete:()=>ring.destroy()});
        let affected=0;for(const h of this.hazards.getChildren()){if(h.active&&Phaser.Math.Distance.Between(this.player.x,this.player.y,h.x,h.y)<radius){h.destroy();affected++}}
        for(const p of this.pickups.getChildren()){if(p.active&&p.kind==='note'&&Phaser.Math.Distance.Between(this.player.x,this.player.y,p.x,p.y)<radius){this.collectPickup(p);affected++}}
        if(j.value){this.stats.combo++;this.stats.hits++;this.stats.score+=(400+affected*300)*this.multiplier()}else this.missBeat();this.owner.audio.effect(j.grade==='PERFECT'?'perfect':'pulse');this.owner.callbacks.judge?.(j.grade,j.value);
      }
      usePower(){if(!this.currentPower)return;const p=this.currentPower;if(p==='Bass Shield')return;if(p==='Tempo Slowdown'){this.scrollSpeed*=.7;this.time.delayedCall(6000,()=>this.scrollSpeed=this.balance.speed)}else if(p==='Perfect Pitch'){this.time.delayedCall(7000,()=>{if(this.currentPower==='Perfect Pitch'){this.currentPower=null;this.owner.callbacks.power?.(null)}});return}else if(p==='Echo Wave'){this.stats.energy=Math.max(this.stats.energy,12);this.pulse(this.settings.controlMode==='mobile'?'touch':'keyboard')}else if(p==='Solo Mode'){this.stats.score+=3000*this.multiplier();this.stats.energy=100}else if(p==='Combo Lock'){this.comboLock=true}else if(p==='Remix Token'){this.owner.audio.remix=(this.owner.audio.remix+1)%4;this.owner.callbacks.judge?.('REMIXED',1)}this.currentPower=null;this.owner.callbacks.power?.(null)}
      spawnBoss(){if(this.boss)return;const c=this.add.container(this.scale.width+180,this.scale.height*.45).setDepth(9);const ring=this.add.circle(0,0,64,0x170d32,.95).setStrokeStyle(5,0xff3dac),inner=this.add.circle(0,0,37,0x31f3e3,.18).setStrokeStyle(3,0x31f3e3),bars=[];for(let i=0;i<8;i++){const b=this.add.rectangle(0,-76,8,28,0xffd166).setRotation(i*Math.PI/4);bars.push(b)}c.add([ring,inner,...bars]);c.active=true;c.hp=8;this.boss=c;this.owner.callbacks.judge?.('THE RESONATOR',1)}
      bossAttack(){if(!this.boss?.active)return;for(let i=-1;i<=1;i++){const p=this.physics.add.sprite(this.boss.x-55,this.boss.y+i*60,'projectile').setDepth(8);p.speedFactor=1.6;p.body.setVelocityX(-120);this.hazards.add(p);this.pulsables.add(p)}}
      multiplier(){return 1+Math.min(4,Math.floor(this.stats.combo/8))}
      changeDistrict(i){this.districtIndex=i%DISTRICTS.length;this.drawDistrict();this.owner.callbacks.district?.(DISTRICTS[this.districtIndex],this.districtIndex);}
      emitHud(){const layers=Math.min(4,1+Math.floor(this.stats.combo/8));this.owner.audio.setLayers(layers);this.owner.callbacks.hud?.({...this.stats,multiplier:this.multiplier(),layers,time:this.clock.seconds()})}
      setRising(v){this.rising=v}
      pauseRun(){if(this.pausedRun)return;this.pausedRun=true;this.physics.pause();this.clock.pause();}
      resumeRun(){if(!this.pausedRun)return;this.pausedRun=false;this.physics.resume();this.clock.resume();}
      finish(success){if(this.ended)return;this.ended=true;this.owner.audio.stop();const attempts=this.stats.hits+this.stats.misses;const accuracy=attempts?this.stats.hits/attempts:0;this.owner.callbacks.end?.({...this.stats,accuracy,success,mode:this.owner.mode})}
      onResize(size){this.cameras.resize(size.width,size.height);this.drawDistrict();if(this.grid){this.grid.setPosition(size.width/2,size.height*.84);this.grid.setSize(size.width*1.4,size.height*.42)}}
    }
    this.game = new Phaser.Game({ type: Phaser.AUTO, parent: this.container, transparent: true, pixelArt: true, scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, physics: { default: 'arcade', arcade: { debug: false } }, scene: FlightScene, render: { antialias: false, roundPixels: true }, audio: { noAudio: true } });
  }
  setRising(v) { this.scene?.setRising(v); }
  pulse(kind) { this.scene?.pulse(kind); }
  usePower() { this.scene?.usePower(); }
  pause() { this.scene?.pauseRun(); }
  resume() { this.scene?.resumeRun(); }
  finish() { this.scene?.finish(false); }
  destroy() { if(this.game){this.game.destroy(true);this.game=null;this.scene=null;} }
}

export { EVENTS };
