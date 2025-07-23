// embed.js — self-contained Enigma Syndicate card loader
(async function(){
  // 1) Inject scoped CSS
  const css = `
    #enigma-game-root { width:100%; max-width:400px; margin:20px auto; background:#fff; padding:16px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
    #enigma-game-root .faction-badge { width:40px; display:block; margin:0 auto 8px; }
    #enigma-game-root .card-image      { width:100%; display:block; border-radius:4px; }
    #enigma-game-root .stats-panel     { font-family:monospace; text-align:center; margin:10px 0; }
    #enigma-game-root .weapons-panel img { width:30px; margin:0 5px; vertical-align:middle; }
    #enigma-error { color:red; text-align:center; white-space:pre-wrap; margin-top:10px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // 2) Create error box if missing
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
    // 3) Load Firebase compat if needed
    if (!window.firebase) {
      await new Promise((res, rej) => {
        const s1 = document.createElement('script');
        s1.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js';
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js';
        const s3 = document.createElement('script');
        s3.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js';
        let loaded = 0;
        function check() { if (++loaded === 3) res(); }
        s1.onload = s2.onload = s3.onload = check;
        s1.onerror = s2.onerror = s3.onerror = rej;
        document.head.append(s1,s2,s3);
      });
    }

    // 4) Init Firebase
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

    // 5) XP → level helper
    const xpToLevel = xp => Math.floor(xp/100) + 1;

    // 6) Authenticate
    let uid;
    await new Promise((res, rej) => {
      auth.onAuthStateChanged(u => {
        if (u) uid = u.uid, res();
        else auth.signInAnonymously().then(c=>{uid=c.user.uid;res();}).catch(rej);
      });
    });

    // 7) Card metadata
    const cardMeta = {
      vito_the_intimidator:{ faction:'enforcers',   displayName:'Vito the Intimidator' },
      lola_the_quick:      { faction:'undercutters', displayName:'Lola the Quick'   },
      bruno_the_tank:      { faction:'syndicate',   displayName:'Bruno the Tank'   }
    };

    // 8) Fetch or seed player
    let player = await db.ref(`/players/${uid}`).once('value').then(s=>s.val());
    if (!player) {
      const cards = Object.keys(cardMeta);
      const cardId = cards[Math.floor(Math.random()*cards.length)];
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

    // 9) JSON fetch helper
    async function fetchJSON(path) {
      const r = await fetch(path);
      if (!r.ok) throw new Error(`Fetch ${path} failed (${r.status})`);
      return r.json();
    }

    // 10) Load weapons
    const wdefs = await Promise.all(
      player.weapons.map(id => fetchJSON(
        `${window.ASSETS_BASE_URL}/assets/json/weapons/${id}.json`
      ))
    );

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

    // 13) Render
    root.innerHTML = '';
    root.append(
      Object.assign(document.createElement('img'),{
        src:`${window.ASSETS_BASE_URL}/assets/factions/${player.faction}.png`,
        className:'faction-badge'
      }),
      Object.assign(document.createElement('img'),{
        src:`${window.ASSETS_BASE_URL}/assets/cards/${player.cardId}.png`,
        className:'card-image'
      }),
      Object.assign(document.createElement('div'),{
        className:'stats-panel',
        innerHTML:
          `<p>${cardMeta[player.cardId].displayName}</p>
           <p>Level: ${lvl}</p>
           <p>Health: ${player.stats.health}</p>
           <p>Energy: ${player.stats.energy}</p>
           <p>XP: ${player.stats.experience}</p>
           <p>Total ATK: ${totalAtk}</p>
           <p>Total DEF: ${totalDef}</p>`
      }),
      Object.assign(document.createElement('div'),{
        className:'weapons-panel'
      })
    );
    const wp = root.querySelector('.weapons-panel');
    wdefs.forEach(w=>{
      const img = document.createElement('img');
      img.src = `${window.ASSETS_BASE_URL}/assets/weapons/${w.id}.png`;
      img.title = `${w.name} — ATK:${w.baseStats.attack+lvl*w.scaling.attackPerLevel} DEF:${w.baseStats.defense+lvl*w.scaling.defensePerLevel}`;
      wp.append(img);
    });

    err.textContent = '';
  }
  catch(e) {
    err.textContent = 'Error: '+e.message;
  }
})();
