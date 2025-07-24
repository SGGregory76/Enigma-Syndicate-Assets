// embed.js — self-contained Enigma card embed (no undefined uid)
(async function(){
  // 0) Asset base
  const ASSETS = 'https://SGGregory76.github.io/Enigma-Syndicate-Assets';

  // 1) Inject mobile-friendly CSS
  const css = `
    #game-root { box-sizing:border-box; width:100%; max-width:360px;
      margin:16px auto; padding:16px; background:#fff; border-radius:8px;
      box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:inherit;
    }
    .faction-badge { width:32px; display:block; margin:0 auto 12px; }
    .card-image    { width:100%; border-radius:4px; margin-bottom:12px; }
    .stats-panel { display:grid; grid-template-columns:1fr 1fr; gap:4px 12px;
      font-size:.95rem; margin-bottom:12px; color:#333;
    }
    .stats-panel p { margin:0; line-height:1.3; }
    .weapons-panel { text-align:center; }
    .weapons-panel img { width:28px; margin:0 6px 6px; vertical-align:middle; }
    #demo-errors { font-size:.85rem; color:#c00; background:#fee; padding:8px;
      border-radius:4px; margin-top:12px; white-space:pre-wrap;
    }
  `;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // 2) Ensure containers
  let root = document.getElementById('game-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'game-root';
    document.currentScript.insertAdjacentElement('beforebegin', root);
  }
  let err = document.getElementById('demo-errors');
  if (!err) {
    err = document.createElement('pre');
    err.id = 'demo-errors';
    root.insertAdjacentElement('afterend', err);
  }
  err.textContent = 'Loading engine…';

  // 3) Load Firebase compat SDKs if missing
  if (!window.firebase) {
    await new Promise((res, rej) => {
      const libs = [
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
      ];
      let loaded = 0;
      libs.forEach(src => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => { if (++loaded === libs.length) res(); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
    });
  }

  // 4) Initialize Firebase
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

  // 5) Authenticate & capture uid
  let uid = null;
  await new Promise((res, rej) => {
    auth.onAuthStateChanged(user => {
      if (user) uid = user.uid;
      else auth.signInAnonymously()
               .then(c => { uid = c.user.uid; })
               .catch(rej);
      res();
    });
  });

  // 6) Inline metadata
  const cardMeta = {
    vito_the_intimidator: { faction:'enforcers',   displayName:'Vito the Enforcer' },
    lola_the_quick:       { faction:'undercutters', displayName:'Maria the Shade'   },
    bruno_the_tank:       { faction:'syndicate',   displayName:'Joey the Ghost'     }
  };
  const weaponMeta = {
    "tommy-gun": {
      name:"Tommy Gun", baseStats:{attack:15,defense:0},
      scaling:{attackPerLevel:2,defensePerLevel:0},
      image:`${ASSETS}/assets/weapons/tommy-gun.png`
    },
    "bulletproof_vest": {
      name:"Bulletproof Vest", baseStats:{attack:0,defense:12},
      scaling:{attackPerLevel:0,defensePerLevel:1},
      image:`${ASSETS}/assets/weapons/bulletproof_vest.png`
    }
  };

  // 7) Reference & seed player node
  const playerRef = db.ref(`/players/${uid}`);
  playerRef.once('value').then(snap => {
    if (!snap.exists()) {
      playerRef.set({
        cardId: Object.keys(cardMeta)[0],
        faction: cardMeta[Object.keys(cardMeta)[0]].faction,
        weapons:['tommy-gun','bulletproof_vest'],
        stats:{health:100,energy:50,experience:0},
        abilities:{quick_shot:{attackBonus:5,cooldown:30}},
        createdAt: new Date().toISOString()
      });
    }
    playerRef.on('value', s => render(s.val()));
  }).catch(e => {
    err.textContent = 'DB error: ' + e.message;
  });

  // 8) Render helper
  function render(player) {
    if (!player) return;
    const lvl = Math.floor(player.stats.experience/100) + 1;
    let totalAtk = 0, totalDef = 0;
    player.weapons.forEach(id => {
      const w = weaponMeta[id];
      totalAtk += w.baseStats.attack + lvl*w.scaling.attackPerLevel;
      totalDef += w.baseStats.defense + lvl*w.scaling.defensePerLevel;
    });

    root.innerHTML = '';
    // faction badge
    root.append(Object.assign(document.createElement('img'), {
      src: `${ASSETS}/assets/factions/${player.faction}.png`,
      className: 'faction-badge'
    }));
    // card image
    root.append(Object.assign(document.createElement('img'), {
      src: `${ASSETS}/assets/cards/${player.cardId}.png`,
      className: 'card-image'
    }));
    // stats panel
    const statsDiv = document.createElement('div');
    statsDiv.className = 'stats-panel';
    statsDiv.innerHTML = `
      <p>Lvl: ${lvl}</p><p>HP: ${player.stats.health}</p>
      <p>EN: ${player.stats.energy}</p><p>XP: ${player.stats.experience}</p>
      <p>ATK: ${totalAtk}</p><p>DEF: ${totalDef}</p>
    `;
    root.append(statsDiv);
    // weapons panel
    const wp = document.createElement('div');
    wp.className = 'weapons-panel';
    player.weapons.forEach(id => {
      const w = weaponMeta[id];
      const img = document.createElement('img');
      img.src = w.image;
      img.title = `${w.name} — ATK:${w.baseStats.attack + lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense + lvl*w.scaling.defensePerLevel}`;
      wp.append(img);
    });
    root.append(wp);
    err.textContent = '';
  }
})();

