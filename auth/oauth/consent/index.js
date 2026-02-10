(() => {
  document.getElementById('year').innerText = new Date().getFullYear();

  // ✅ metti qui i valori del progetto "Kekkotech ID"
  const SUPABASE_URL = "https://rwytpxksxvkieqagxrrf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_py-WvHks4Oe4gNFSpd8WxA_yq-_ISS7";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const qs = new URLSearchParams(window.location.search);
  const authorizationId = qs.get('authorization_id');

  const errEl = document.getElementById('err');
  const okEl  = document.getElementById('ok');
  const clientNameEl = document.getElementById('clientName');
  const scopesEl = document.getElementById('scopes');

  function showErr(t) { errEl.innerText = t || ""; okEl.innerText = ""; }
  function showOk(t) { okEl.innerText = t || ""; errEl.innerText = ""; }

  function setButtonsDisabled(v) {
    document.getElementById('approveBtn').disabled = v;
    document.getElementById('denyBtn').disabled = v;
    document.getElementById('logoutBtn').disabled = v;
  }

  function scopeLabel(s) {
    const map = {
      "openid": "Identità (OpenID Connect)",
      "email": "Email",
      "profile": "Profilo base",
      "phone": "Numero di telefono"
    };
    return map[s] || s;
  }

  async function ensureLoggedInOrGoToLogin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return true;

    const next = encodeURIComponent(`/auth/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
    window.location.href = `/auth?next=${next}`;
    return false;
  }

  async function loadDetails() {
    if (!authorizationId) {
      showErr("Parametro mancante: authorization_id");
      setButtonsDisabled(true);
      return;
    }

    const logged = await ensureLoggedInOrGoToLogin();
    if (!logged) return;

    setButtonsDisabled(true);
    showOk("Caricamento richiesta...");

    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) {
      showErr(error.message || "Errore nel recupero dettagli.");
      setButtonsDisabled(false);
      return;
    }

    // Se già approvato in passato -> redirect immediato
    if (data && data.redirect_to) {
      window.location.href = data.redirect_to;
      return;
    }

    const cname = data?.client_name || data?.client?.name || "Applicazione";
    clientNameEl.innerText = cname;

    const scopes = data?.scopes || data?.requested_scopes || [];
    scopesEl.innerHTML = "";
    (scopes.length ? scopes : ["openid"]).forEach(s => {
      const li = document.createElement("li");
      li.innerText = scopeLabel(s);
      scopesEl.appendChild(li);
    });

    showOk("");
    setButtonsDisabled(false);
  }

  document.getElementById('approveBtn').onclick = async () => {
    setButtonsDisabled(true);
    showOk("Approvo...");
    const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);
    if (error) { showErr(error.message || "Errore approvazione."); setButtonsDisabled(false); return; }
    if (data?.redirect_to) window.location.href = data.redirect_to;
    else showErr("Redirect mancante dopo approvazione.");
  };

  document.getElementById('denyBtn').onclick = async () => {
    setButtonsDisabled(true);
    showOk("Nego...");
    const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) { showErr(error.message || "Errore negazione."); setButtonsDisabled(false); return; }
    if (data?.redirect_to) window.location.href = data.redirect_to;
    else showErr("Redirect mancante dopo negazione.");
  };

  document.getElementById('logoutBtn').onclick = async () => {
    setButtonsDisabled(true);
    await supabase.auth.signOut();
    const next = encodeURIComponent(`/auth/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
    window.location.href = `/auth?next=${next}`;
  };

  loadDetails();
})();
