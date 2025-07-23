// game-engine.umd.js
;(function(window) {
  // ——— Your Firebase config ———
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

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.database();           // Realtime Database
  // const db = firebase.firestore();          // (if you prefer Firestore)

  let currentUserUid = null;

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

  // ——— Fetch Helpers (Realtime DB) ———
  function fetchPlayer(uid) {
    return db.ref(`/players/${uid}`).once('value')
      .then(snap => snap.val());
  }
  function fetchEncounter(id) {
    return db.ref(`/encounters/${id}`).once('value')
      .then(snap => snap.val());
  }
  function fetchFaction(id) {
    return db.ref(`/factions/${id}`).once('value')
      .then(snap => snap.val());
  }

  // ——— Render Card Container ———
  function renderCardContainer(containerId, playerData) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const badge = document.createElement('img');
    badge.src = `${window.ASSETS_BASE_URL}/assets/factions/${playerData.faction}.png`;
    badge.classList.add('faction-badge');

    const cardImg = document.createElement('img');
    cardImg.src = `${window.ASSETS_BASE_URL}/assets/cards/${playerData.cardId}.png`;
    cardImg.classList.add('card-image');

    const stats = `<p>Health: ${playerData.stats.health}</p>
                   <p>Energy: ${playerData.stats.energy}</p>
                   <p>XP: ${playerData.stats.experience}</p>`;
    const statsDiv = document.createElement('div');
    statsDiv.classList.add('stats-panel');
    statsDiv.innerHTML = stats;

    container.append(badge, cardImg, statsDiv);
  }

  // ——— Init & Expose ———
  async function initGame(containerId) {
    await initAuth();
    const player = await fetchPlayer(currentUserUid);
    renderCardContainer(containerId, player);
  }

  window.initGame = initGame;

})(window);
