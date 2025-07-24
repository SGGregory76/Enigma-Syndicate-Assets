 // after `uid = user.uid;`

document.getElementById('game-root').insertAdjacentHTML(

  'beforebegin',

  `<div style="text-align:center; font-size:0.9rem; color:#555; margin:8px;">

     Your UID: <strong>${uid}</strong>

   </div>`

);


// embed.js — per-UID only, no overrides
(async function(){
  const ASSETS_BASE_URL = 'https://SGGregory76.github.io/Enigma-Syndicate-Assets';

  // 1) Scoped CSS (mobile-friendly)
  const css = `
    #game-root { box-sizing:border-box; width:100%; max-width:360px; margin:16px auto;
      padding:16px; background:#fff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);
      font-family:inherit;
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
  document.head.appendChild(Object.assign(document.createElement('style'),{textContent:css}));

  // 2) Ensure container & error box
  let root = document.getElementById('game-root');
  if (!root) {
    root = document.createElement('div'); root.id = 'game-root';
    document.currentScript.insertAdjacentElement('beforebegin', root);
  }
  let errBox = document.getElementById('demo-errors');
  if (!errBox) {
    errBox = document.createElement('pre'); errBox.id = 'demo-errors';
    root.insertAdjacentElement('afterend', errBox);
  }
  errBox.textContent = 'Loading engine…';

  // 3) Load Firebase compat SDKs
  if (!window.firebase) {
    await new Promise((res,rej)=>{
      const libs = [
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
      ];
      let loaded=0;
      libs.forEach(src=>{
        const s=document.createElement('script'); s.src=src;
        s.onload = ()=>{ if(++loaded===libs.length) res(); };
        s.onerror=rej;
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

  // 5) Authenticate anonymously and get own UID
  let uid;
  await new Promise((res,rej)=>{
    auth.onAuthStateChanged(u=>{
      if (u) uid = u.uid;
      else auth.signInAnonymously().then(c=>{ uid = c.user.uid; }).catch(rej);
      res();
    });
  });
  console.log("Your UID:", uid);

  // 6) Inline metadata
  const cardMeta = {
    vito_the_intimidator: { faction:'enforcers',   displayName:'Vito the Enforcer' },
    lola_the_quick:       { faction:'undercutters', displayName:'Maria the Shade'   },
    bruno_the_tank:       { faction:'syndicate',   displayName:'Joey the Ghost'     }
  };
  const weaponMeta = {
    "tommy-gun": {
      name:"Tommy Gun", baseStats:{attack:15,defense:0}, scaling:{attackPerLevel:2,defensePerLevel:0},
      image:`${ASSETS_BASE_URL}/assets/weapons/tommy-gun.png`
    },
    "bulletproof_vest": {
      name:"Bulletproof Vest", baseStats:{attack:0,defense:12}, scaling:{attackPerLevel:0,defensePerLevel:1},
      image:`${ASSETS_BASE_URL}/assets/weapons/bulletproof_vest.png`
    }
  };

  // 7) Reference to own player node
  const playerRef = db.ref(`/players/${uid}`);

  // 8) Seed if missing, then attach real-time listener
  playerRef.once('value').then(snap=>{
    if (!snap.exists()) {
      const defaultPlayer = {
        cardId: Object.keys(cardMeta)[0],
        faction: cardMeta[Object.keys(cardMeta)[0]].faction,
        weapons:['tommy-gun','bulletproof_vest'],
        stats:{health:100,energy:50,experience:0},
        abilities:{quick_shot:{attackBonus:5,cooldown:30}},
        createdAt: new Date().toISOString()
      };
      playerRef.set(defaultPlayer);
    }
    playerRef.on('value', snapshot=>{
      const player = snapshot.val();
      if (player) render(player);
    });
  }).catch(e=>{
    errBox.textContent = 'DB seed error: '+e.message;
  });

  // 9) Render function
  function render(player) {
    try {
      const lvl = Math.floor(player.stats.experience/100)+1;
      let totalAtk=0, totalDef=0;
      player.weapons.forEach(id=>{
        const w = weaponMeta[id];
        totalAtk += w.baseStats.attack + lvl*w.scaling.attackPerLevel;
        totalDef += w.baseStats.defense + lvl*w.scaling.defensePerLevel;
      });
      root.innerHTML = '';
      // badge
      root.append(
        Object.assign(document.createElement('img'),{
          src:`${ASSETS_BASE_URL}/assets/factions/${player.faction}.png`,
          className:'faction-badge'
        })
      );
      // card art
      root.append(
        Object.assign(document.createElement('img'),{
          src:`${ASSETS_BASE_URL}/assets/cards/${player.cardId}.png`,
          className:'card-image'
        })
      );
      // stats grid
      const statsDiv = document.createElement('div');
      statsDiv.className='stats-panel';
      statsDiv.innerHTML=`
        <p>Lvl:${lvl}</p><p>HP:${player.stats.health}</p>
        <p>EN:${player.stats.energy}</p><p>XP:${player.stats.experience}</p>
        <p>ATK:${totalAtk}</p><p>DEF:${totalDef}</p>
      `;
      root.append(statsDiv);
      // weapons
      const wp = document.createElement('div');
      wp.className='weapons-panel';
      player.weapons.forEach(id=>{
        const w=weaponMeta[id];
        const img=document.createElement('img');
        img.src=w.image;
        img.title=`${w.name} — ATK:${w.baseStats.attack + lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense + lvl*w.scaling.defensePerLevel}`;
        wp.append(img);
      });
      root.append(wp);
      errBox.textContent='';
    } catch(e){
      errBox.textContent='Render error: '+e.message;
    }
  }

  // 10) Expose partial update helper
  window.updateStats = async deltaObj => {
    await playerRef.update(deltaObj);
  };

})();
</script>
