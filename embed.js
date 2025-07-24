// embed.js — fixed fetch URLs, persistent per-UID
(async function(){
  // 0) Where your JSON & images live
  const ASSETS_BASE_URL = 'https://SGGregory76.github.io/Enigma-Syndicate-Assets';

  // 1) Scoped CSS
  const css = `
    #enigma-game-root { box-sizing:border-box; width:100%; max-width:500px; margin:1.5em auto;
      background:var(--bg-body,#fff); border:1px solid var(--border-color,#ddd);
      border-radius:6px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); font-family:inherit;
    }
    #enigma-game-root .faction-badge { width:40px; display:block; margin:.5em auto; }
    #enigma-game-root .card-image      { width:100%; display:block; }
    #enigma-game-root .stats-panel     { padding:.75em 1em; text-align:center; color:var(--text-color,#333); }
    #enigma-game-root .stats-panel p   { margin:.25em 0; line-height:1.2; }
    #enigma-game-root .weapons-panel   { padding:.5em 1em 1em; text-align:center; }
    #enigma-game-root .weapons-panel img { width:30px; margin:0 4px; vertical-align:middle; }
    #enigma-error { text-align:center; color:red; margin-top:.5em; font-family:inherit; }
  `;
  document.head.appendChild(Object.assign(document.createElement('style'),{textContent:css}));

  // 2) Container + error box
  let root = document.getElementById('enigma-game-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'enigma-game-root';
    document.currentScript.insertAdjacentElement('beforebegin', root);
  }
  let err = document.getElementById('enigma-error');
  if (!err) {
    err = document.createElement('pre');
    err.id = 'enigma-error';
    root.insertAdjacentElement('afterend', err);
  }
  err.textContent = 'Loading game…';

  try {
    // 3) Overrides
    const forcedUid    = root.dataset.uid;
    const forcedCardId = root.dataset.cardid;

    // 4) Load Firebase compat
    if (!window.firebase) {
      await new Promise((res, rej) => {
        const urls = [
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
        ];
        let c=0;
        urls.forEach(src=>{
          const s=document.createElement('script');
          s.src=src; s.onload=()=>{ if(++c===urls.length)res(); };
          s.onerror=rej; document.head.appendChild(s);
        });
      });
    }

    // 5) Init Firebase
    firebase.initializeApp({
      apiKey: "AIzaSyCiFF0giW60YhEF9MPF8RMMETXkNW9vv2Y",
      authDomain: "sandbox-mafia.firebaseapp.com",
      databaseURL: "https://sandbox-mafia-default-rtdb.firebaseio.com",
      projectId: "sandbox-mafia",
      storageBucket: "sandbox-mafia.firebasestorage.app",
      messagingSenderId: "966783573980",
      appId: "1:966783573980:web:a07a7b66d7d9a057dab919"
    });
    const auth = firebase.auth(), db = firebase.database();

    // 6) XP→level
    const xpToLevel = xp => Math.floor(xp/100)+1;

    // 7) Auth
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(u => {
        if(u) uid=u.uid;
        else auth.signInAnonymously().then(c=>uid=c.user.uid).catch(rej);
        res();
      });
    });
    if (forcedUid) uid = forcedUid;

    // 8) Card metadata
    const cardMeta = {
      vito_the_intimidator: { faction:'enforcers',   displayName:'Vito the Intimidator' },
      lola_the_quick:       { faction:'undercutters', displayName:'Lola the Quick'   },
      bruno_the_tank:       { faction:'syndicate',   displayName:'Bruno the Tank'   }
    };

    // 9) Fetch existing record
    let player = await db.ref(`/players/${uid}`).once('value').then(s=>s.val());

    // 10) Seed on first visit
    if (!player) {
      const cardId = (forcedCardId && cardMeta[forcedCardId])
                     ? forcedCardId
                     : Object.keys(cardMeta)[Math.floor(Math.random()*Object.keys(cardMeta).length)];
      player = {
        cardId,
        faction: cardMeta[cardId].faction,
        weapons: ['tommy-gun','bulletproof_vest'],
        stats: { health:100, energy:50, experience:0 },
        abilities: { quick_shot:{ attackBonus:5, cooldown:30 } },
        lastUpdated: new Date().toISOString()
      };
      await db.ref(`/players/${uid}`).set(player);
    }

    // 11) Override in-memory if forcedCardId
    if (forcedCardId && cardMeta[forcedCardId]) {
      player.cardId = forcedCardId;
      player.faction = cardMeta[forcedCardId].faction;
    }

    // 12) fetchJSON helper
    async function fetchJSON(path){
      const r = await fetch(path);
      if(!r.ok) throw new Error(`Fetch ${path} failed (${r.status})`);
      return r.json();
    }

    // 13) Load weapon defs
    const wdefs = await Promise.all(
      player.weapons.map(id =>
        fetchJSON(`${ASSETS_BASE_URL}/assets/json/weapons/${id}.json`)
      )
    );

    // 14) Load faction bonuses
    let fac;
    try {
      fac = await db.ref(`/factions/${player.faction}`).once('value').then(s=>s.val());
      if(!fac||!fac.bonuses) throw 0;
    } catch {
      fac = { bonuses:{ attack:0, defense:0 } };
    }

    // 15) Compute totals
    const lvl = xpToLevel(player.stats.experience);
    let atk=0, def=0;
    wdefs.forEach(w=>{
      atk += w.baseStats.attack + lvl*w.scaling.attackPerLevel;
      def += w.baseStats.defense + lvl*w.scaling.defensePerLevel;
    });
    atk += fac.bonuses.attack; def += fac.bonuses.defense;

    // 16) Render
    root.innerHTML = '';
    root.append(
      Object.assign(document.createElement('img'),{src:`${ASSETS_BASE_URL}/assets/factions/${player.faction}.png`,className:'faction-badge'}),
      Object.assign(document.createElement('img'),{src:`${ASSETS_BASE_URL}/assets/cards/${player.cardId}.png`,className:'card-image'}),
      Object.assign(document.createElement('div'),{className:'stats-panel',innerHTML:
        `<p>${cardMeta[player.cardId].displayName}</p>
         <p>Level: ${lvl}</p>
         <p>Health: ${player.stats.health}</p>
         <p>Energy: ${player.stats.energy}</p>
         <p>XP: ${player.stats.experience}</p>
         <p>Total ATK: ${atk}</p>
         <p>Total DEF: ${def}</p>`}),
      Object.assign(document.createElement('div'),{className:'weapons-panel'})
    );
    const wp = root.querySelector('.weapons-panel');
    wdefs.forEach(w=>{
      const img = document.createElement('img');
      img.src = `${ASSETS_BASE_URL}/assets/weapons/${w.id}.png`;
      img.title = `${w.name} — ATK:${w.baseStats.attack+lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense+lvl*w.scaling.defensePerLevel}`;
      wp.append(img);
    });

    err.textContent = '';
  }
  catch(e){
    document.getElementById('enigma-error').textContent = 'Error: '+e.message;
  }
})();

