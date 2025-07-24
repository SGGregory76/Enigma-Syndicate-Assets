// embed.js — complete Enigma Syndicate player card + dynamic save logic
(async function(){
  // 0) Base URL for your GitHub‐hosted assets
  const ASSETS_BASE_URL = 'https://SGGregory76.github.io/Enigma-Syndicate-Assets';

  // 1) Inject scoped CSS
  const css = `
    #enigma-game-root {
      box-sizing: border-box;
      width: 100%;
      max-width: 500px;
      margin: 1.5em auto;
      background: var(--bg-body,#fff);
      border: 1px solid var(--border-color,#ddd);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      font-family: inherit;
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

  // 2) Ensure container & error box
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
    // 3) Read page‐specific overrides
    const forcedUid    = root.dataset.uid;     // if present, use this UID
    const forcedCardId = root.dataset.cardid;  // if present, force this card

    // 4) Load Firebase compat SDKs if needed
    if (!window.firebase) {
      await new Promise((res, rej) => {
        const urls = [
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
          'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
        ];
        let loaded = 0;
        urls.forEach(src => {
          const s = document.createElement('script');
          s.src = src;
          s.onload  = () => { if (++loaded === urls.length) res(); };
          s.onerror = rej;
          document.head.appendChild(s);
        });
      });
    }

    // 5) Initialize Firebase
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

    // 6) XP → Level helper
    const xpToLevel = xp => Math.floor(xp/100) + 1;

    // 7) Authenticate anonymously, then apply forcedUid
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(user => {
        if (user) uid = user.uid;
        else auth.signInAnonymously()
                 .then(c => { uid = c.user.uid; })
                 .catch(rej);
        res();
      });
    });
    if (forcedUid) uid = forcedUid;

    // 8) Inline card metadata
    const cardMeta = {
      vito_the_intimidator: { faction:'enforcers',   displayName:'Vito the Intimidator' },
      lola_the_quick:       { faction:'undercutters', displayName:'Lola the Quick'   },
      bruno_the_tank:       { faction:'syndicate',   displayName:'Bruno the Tank'   }
    };

    // 9) Fetch or seed player record
    let player = await db.ref(`/players/${uid}`).once('value').then(s=>s.val());
    if (!player) {
      const cardId = (forcedCardId && cardMeta[forcedCardId])
                     ? forcedCardId
                     : Object.keys(cardMeta)[Math.floor(Math.random()*Object.keys(cardMeta).length)];
      player = {
        cardId,
        faction: cardMeta[cardId].faction,
        weapons: ['tommy-gun','bulletproof_vest'],
        stats:   { health:100, energy:50, experience:0 },
        abilities:{ quick_shot:{ attackBonus:5, cooldown:30 } },
        lastUpdated: new Date().toISOString()
      };
      await db.ref(`/players/${uid}`).set(player);
    }
    // Override in-memory card if forcedCardId
    if (forcedCardId && cardMeta[forcedCardId]) {
      player.cardId  = forcedCardId;
      player.faction = cardMeta[forcedCardId].faction;
    }

    // 10) Inline weapon metadata
    const weaponMeta = {
      "tommy-gun": {
        id: "tommy-gun", name: "Tommy Gun",
        baseStats: { attack:15, defense:0 }, scaling:{attackPerLevel:2, defensePerLevel:0},
        image:`${ASSETS_BASE_URL}/assets/weapons/tommy-gun.png`
      },
      "bulletproof_vest": {
        id:"bulletproof_vest", name:"Bulletproof Vest",
        baseStats:{attack:0, defense:12}, scaling:{attackPerLevel:0, defensePerLevel:1},
        image:`${ASSETS_BASE_URL}/assets/weapons/bulletproof_vest.png`
      }
    };
    const wdefs = player.weapons.map(id => {
      const w = weaponMeta[id];
      if (!w) throw new Error(`Unknown weapon ID "${id}"`);
      return w;
    });

    // 11) Load faction bonuses (fallback)
    let fac;
    try {
      fac = await db.ref(`/factions/${player.faction}`).once('value').then(s=>s.val());
      if (!fac || !fac.bonuses) throw 0;
    } catch {
      fac = { bonuses:{ attack:0, defense:0 } };
    }

    // 12) Compute totals
    const lvl = xpToLevel(player.stats.experience);
    let totalAtk=0, totalDef=0;
    wdefs.forEach(w=>{
      totalAtk += w.baseStats.attack + lvl*w.scaling.attackPerLevel;
      totalDef += w.baseStats.defense + lvl*w.scaling.defensePerLevel;
    });
    totalAtk += fac.bonuses.attack;
    totalDef += fac.bonuses.defense;

    // 13) Render the card
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
         <p>Total ATK: ${totalAtk}</p>
         <p>Total DEF: ${totalDef}</p>`}),
      Object.assign(document.createElement('div'),{className:'weapons-panel'})
    );
    wdefs.forEach(w=>{
      const img = document.createElement('img');
      img.src = w.image;
      img.title= `${w.name} — ATK:${w.baseStats.attack+lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense+lvl*w.scaling.defensePerLevel}`;
      root.querySelector('.weapons-panel').append(img);
    });
    err.textContent = '';

    //
    // === Dynamic save helpers ===
    //

    // Overwrite the stats object
    window.saveStats = async function(newStats) {
      await db.ref(`/players/${uid}/stats`).set(newStats);
    };

    // Atomically increment experience
    window.incrementExperience = async function(amount) {
      await db.ref(`/players/${uid}/stats/experience`)
              .transaction(xp => (xp||0) + amount);
    };
  }
  catch (e) {
    err.textContent = 'Error: ' + e.message;
  }
})();
