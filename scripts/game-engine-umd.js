// game-engine.umd.js
;(function(window) {
  // ——— Configuration ———
  const ASSETS_BASE_URL = window.ASSETS_BASE_URL;
  const JSON_BASE_URL   = `${ASSETS_BASE_URL}/assets/json`;

  // ——— Firebase Init ———
  const firebaseConfig = {
    apiKey: "AIzaSyCiFF0giW60YhEF9MPF8RMMETXkNW9vv2Y",
    authDomain: "sandbox-mafia.firebaseapp.com",
    databaseURL: "https://sandbox-mafia-default-rtdb.firebaseio.com",
    projectId: "sandbox-mafia",
    storageBucket: "sandbox-mafia.firebasestorage.app",
    messagingSenderId: "966783573980",
    appId: "1:966783573980:web:a07a7b66d7d9a057dab919",
    measurementId: "G-YYY9ZJ0P73"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.database();

  let currentUserUid = null;

  // ——— Utility: XP to Level ———
  function xpToLevel(xp) {
    return Math.floor(xp / 100) + 1;
  }

  // ——— Auth ———
  function initAuth() {
    return new Promise((resolve, reject) => {
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUserUid = user.uid;
          resolve(user);
        } else {
          auth.signInAnonymously()
            .then(cred => {
              currentUserUid = cred.user.uid;
              resolve(cred.user);
            })
            .catch(reject);
        }
      });
    });
  }

  // ——— Fetch from Realtime DB ———
  function fetchPlayer(uid) {
    return db.ref(`/players/${uid}`).once('value').then(s => s.val());
  }
  function fetchEncounter(id) {
    return db.ref(`/encounters/${id}`).once('value').then(s => s.val());
  }
  function fetchFaction(id) {
    return db.ref(`/factions/${id}`).once('value').then(s => s.val());
  }

  // ——— Fetch Weapon JSON ———
  async function fetchWeapon(id) {
    const resp = await fetch(`${JSON_BASE_URL}/weapons/${id}.json`);
    if (!resp.ok) throw new Error(`Weapon JSON load failed: ${resp.status}`);
    return resp.json();
  }

  // ——— Render Card Container ———
  async function renderCardContainer(containerId, playerData) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    // Compute level
    const level = xpToLevel(playerData.stats.experience);

    // Fetch weapons definitions
    const weaponDefs = await Promise.all(
      playerData.weapons.map(id => fetchWeapon(id))
    );

    // Sum scaled stats
    let totalAttack = 0, totalDefense = 0;
    weaponDefs.forEach(w => {
      const atk = w.baseStats.attack + level * w.scaling.attackPerLevel;
      const def = w.baseStats.defense + level * w.scaling.defensePerLevel;
      totalAttack += atk;
      totalDefense += def;
    });

    // Faction bonus
    const faction = await fetchFaction(playerData.faction);
    totalAttack  += faction.bonuses?.attack || 0;
    totalDefense += faction.bonuses?.defense || 0;

    // Faction badge
    const badge = document.createElement('img');
    badge.src = `${ASSETS_BASE_URL}/assets/factions/${playerData.faction}.png`;
    badge.alt = playerData.faction;
    badge.classList.add('faction-badge');

    // Card image
    const cardImg = document.createElement('img');
    cardImg.src = `${ASSETS_BASE_URL}/assets/cards/${playerData.cardId}.png`;
    cardImg.alt = playerData.cardId;
    cardImg.classList.add('card-image');

    // Stats panel
    const statsDiv = document.createElement('div');
    statsDiv.classList.add('stats-panel');
    statsDiv.innerHTML = `
      <p>Level: ${level}</p>
      <p>Health: ${playerData.stats.health}</p>
      <p>Energy: ${playerData.stats.energy}</p>
      <p>XP: ${playerData.stats.experience}</p>
      <p>Total ATK: ${totalAttack}</p>
      <p>Total DEF: ${totalDefense}</p>
    `;

    // Weapons panel
    const weaponsDiv = document.createElement('div');
    weaponsDiv.classList.add('weapons-panel');
    weaponDefs.forEach(w => {
      const img = document.createElement('img');
      img.src = `${ASSETS_BASE_URL}/assets/weapons/${w.id}.png`;
      img.title = `${w.name} — ATK: ${w.baseStats.attack + level*w.scaling.attackPerLevel}, DEF: ${w.baseStats.defense + level*w.scaling.defensePerLevel}`;
      weaponsDiv.append(img);
    });

    container.append(badge, cardImg, statsDiv, weaponsDiv);
  }

  // ——— Init Game ———
  async function initGame(containerId) {
    await initAuth();
    const playerData = await fetchPlayer(currentUserUid);
    await renderCardContainer(containerId, playerData);
  }

  // Export
  window.initGame = initGame;

})(window);

