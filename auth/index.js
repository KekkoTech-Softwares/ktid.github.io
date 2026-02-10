(() => {
  const params = new URLSearchParams(window.location.search);

  // ✅ metti qui i valori del progetto "Kekkotech ID"
  const DEFAULT_SUPABASE_URL = "https://rwytpxksxvkieqagxrrf.supabase.co";
  const DEFAULT_SUPABASE_KEY = "sb_publishable_py-WvHks4Oe4gNFSpd8WxA_yq-_ISS7";

  // compatibilità: se arrivano da query, usali (così non rompi i vecchi servizi)
  const SUPABASE_URL = params.get('s_url') || DEFAULT_SUPABASE_URL;
  const SUPABASE_KEY = params.get('s_key') || DEFAULT_SUPABASE_KEY;

  // modalità OAuth Server: se c'è next=... significa "dopo login torna lì"
  const NEXT = params.get('next');

  // il tuo vecchio caso (app/electron)
  const REDIRECT_URI = "kts-vscoreboard://auth/callback";
  const SERVICE = params.get('service');

  const msg = document.getElementById('msg');
  document.getElementById('year').innerText = new Date().getFullYear();

  const dbgBox = document.getElementById('dbgBox');
  const dbgEl = document.getElementById('dbg');

  function dbg(t) {
    if (params.get('dbg') !== '1') return;
    dbgBox.style.display = 'block';
    dbgEl.innerText = String(t || '');
  }

  if (!window.supabase) {
    dbg("supabase-js non caricato.");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
    dbg("Config Supabase mancante/placeholder.");
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // --- UI helpers ---
  function showMsg(text, ok = false) {
    msg.innerText = text || '';
    msg.style.color = ok ? "#2ecc71" : "#ff6b6b";
  }

  function setLoading(active, text) {
    document.querySelectorAll('button').forEach(b => (b.disabled = active));
    msg.innerText = active ? (text || '') : '';
    msg.style.color = "#f1c40f";
  }

  function safeNextUrl() {
    if (!NEXT) return null;
    try {
      const decoded = decodeURIComponent(NEXT);

      // relativo
      if (decoded.startsWith("/")) return decoded;

      // assoluto sullo stesso host (no open-redirect)
      const u = new URL(decoded);
      if (u.host === window.location.host) return u.pathname + u.search + u.hash;

      return null;
    } catch {
      return null;
    }
  }

  function switchTab(mode) {
    const c = document.getElementById('tabs_c');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');

    if (mode === 'register') {
      c.classList.add('right-active');
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      loginForm.classList.remove('active');
      regForm.classList.add('active');
    } else {
      c.classList.remove('right-active');
      tabRegister.classList.remove('active');
      tabLogin.classList.add('active');
      regForm.classList.remove('active');
      loginForm.classList.add('active');
    }
    msg.innerText = '';
  }

  // --- Actions ---
  async function doLogin() {
    const email = document.getElementById('l_email').value.trim();
    const password = document.getElementById('l_pass').value.trim();
    if (!email || !password) return showMsg("Inserisci credenziali.");

    setLoading(true, "Accesso...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const nx = safeNextUrl();
      if (nx) {
        window.location.href = nx;
        return;
      }

      if (data?.session?.access_token && data?.session?.refresh_token) {
        window.location.href = `${REDIRECT_URI}#access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}`;
        return;
      }

      setLoading(false);
      showMsg("Accesso completato.", true);
    } catch (e) {
      setLoading(false);
      showMsg(e?.message || "Errore accesso.");
    }
  }

  async function doRegister() {
    const name = document.getElementById('r_name').value.trim();
    const surname = document.getElementById('r_surname').value.trim();
    const email = document.getElementById('r_email').value.trim();
    const pass = document.getElementById('r_pass').value.trim();
    if (!name || !surname || !email || !pass) return showMsg("Dati mancanti.");

    setLoading(true, "Registrazione...");
    try {
      const nx = safeNextUrl();
      const callback = `${window.location.origin}/auth/oauth/callback.html${nx ? `?next=${encodeURIComponent(nx)}` : ""}`;

      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { first_name: name, last_name: surname },
          emailRedirectTo: callback
        }
      });

      if (error) throw error;

      setLoading(false);
      showMsg("Controlla la tua email per confermare l'account!", true);
    } catch (e) {
      setLoading(false);
      showMsg(e?.message || "Errore registrazione.");
    }
  }

  async function doMagicLink() {
    const email = document.getElementById('l_email').value.trim();
    if (!email) return showMsg("Inserisci email.");

    setLoading(true, "Invio link...");
    try {
      const nx = safeNextUrl();
      const callback = nx
        ? `${window.location.origin}/auth/oauth/callback.html?next=${encodeURIComponent(nx)}`
        : `${window.location.origin}/auth/oauth/callback.html`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback,
          shouldCreateUser: true
        }
      });

      if (error) throw error;

      setLoading(false);
      showMsg("Magic link inviato! Controlla la tua email.", true);
    } catch (e) {
      setLoading(false);
      showMsg(e?.message || "Errore invio magic link.");
    }
  }

  async function doReset() {
    const email = document.getElementById('l_email').value.trim();
    if (!email) return showMsg("Inserisci email.");

    setLoading(true, "Invio email...");
    try {
      const nx = safeNextUrl();
      const redirectTo = nx
        ? `${window.location.origin}/auth/oauth/callback.html?next=${encodeURIComponent(nx)}`
        : `${window.location.origin}/auth/oauth/callback.html`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setLoading(false);
      showMsg("Email di recupero inviata!", true);
    } catch (e) {
      setLoading(false);
      showMsg(e?.message || "Errore recupero password.");
    }
  }

  async function doGoogle() {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
      return showMsg("Errore configurazione.");
    }

    const nx = safeNextUrl();
    const redirectTo = nx
      ? `${window.location.origin}/auth/oauth/callback.html?next=${encodeURIComponent(nx)}`
      : `${window.location.origin}/auth/oauth/callback.html`;

    setLoading(true, "Reindirizzamento...");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) {
      setLoading(false);
      showMsg(error.message || "Errore Google.");
      return;
    }
    dbg("OAuth redirect: " + (data?.url || ""));
  }

  function skipLogin() {
    if (SERVICE === "vscoreboard") {
      window.location.href = "kts-vscoreboard://skip";
    } else {
      showMsg("Accesso ospite non disponibile dal browser.");
    }
  }

  function openPrivacy() {
    window.open('https://downloads.kekkotech.com/ktsvolleyscoreboard/privacy', '_blank');
  }

  // --- Bind events ---
  document.getElementById('tabLogin').addEventListener('click', () => switchTab('login'));
  document.getElementById('tabRegister').addEventListener('click', () => switchTab('register'));

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('registerBtn').addEventListener('click', doRegister);
  document.getElementById('magicBtn').addEventListener('click', doMagicLink);
  document.getElementById('resetBtn').addEventListener('click', doReset);
  document.getElementById('googleBtn').addEventListener('click', doGoogle);

  document.getElementById('guestBtn').addEventListener('click', skipLogin);
  document.getElementById('privacyBtn').addEventListener('click', openPrivacy);
})();
