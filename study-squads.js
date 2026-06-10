const SUPABASE_URL = 'https://yvoemqckgtmedfjudkzo.supabase.co';

const SUPABASE_ANON_KEY = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0',
  'tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo'
].join('.');

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');

const state = {
  session: null,
  account: null,
  profiles: [],
  selectedProfileId: null,
  stats: null,
  squads: [],
  activeSquadId: null,
  leaderboard: [],
  feed: [],
  tab: 'details',
  leaderboardMode: 'week',
  loading: true,
  error: null
};

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const toNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function createIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function isPremiumUser() {
  const activeTier = state.account?.active_tier || 'free';
  const subscriptionStatus = state.account?.subscription_status || 'free';

  return (
    activeTier !== 'free' ||
    ['active', 'paid', 'trialing'].includes(subscriptionStatus)
  );
}

function selectedProfile() {
  return state.profiles.find(profile => Number(profile.id) === Number(state.selectedProfileId)) || null;
}

function activeSquad() {
  return state.squads.find(squad => squad.id === state.activeSquadId) || null;
}

function formatDate(value) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function inviteLinkFor(squad) {
  const profileParam = state.selectedProfileId
    ? `&profile_id=${encodeURIComponent(state.selectedProfileId)}`
    : '';

  return `${window.location.origin}/study-squads.html?code=${encodeURIComponent(squad.invite_code)}${profileParam}`;
}

function showToast(message) {
  document.getElementById('toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl z-50 text-sm font-semibold';
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function copyText(text, label = 'Copied') {
  if (!text) return;

  navigator.clipboard.writeText(text)
    .then(() => showToast(label))
    .catch(() => window.prompt('Copy this:', text));
}

async function init() {
  state.loading = true;
  state.error = null;
  render();

  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      window.location.href = '/login.html';
      return;
    }

    state.session = sessionData.session;

    await loadAccount();
    await loadProfiles();

    chooseInitialProfile();

    if (state.selectedProfileId) {
      await loadStats();

      if (isPremiumUser()) {
        await loadSquads();
      }
    }

    state.loading = false;
    render();

    if (state.selectedProfileId && isPremiumUser()) {
      await autoJoinFromUrl();
    }
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.error = error.message || 'Something went wrong while loading Study Squads.';
    render();
  }
}

async function loadAccount() {
  const { data, error } = await supabaseClient
    .from('accounts')
    .select('id,parent_email,active_tier,subscription_status,profile_limit')
    .eq('id', state.session.user.id)
    .single();

  if (error) {
    throw new Error(`Could not load account: ${error.message}`);
  }

  state.account = data;
}

async function loadProfiles() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id,name,grade,language,school,avatar_key')
    .eq('account_id', state.session.user.id)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`Could not load learner profiles: ${error.message}`);
  }

  state.profiles = data || [];
}

function chooseInitialProfile() {
  const params = new URLSearchParams(window.location.search);
  const profileIdFromUrl = toNumber(params.get('profile_id'));
  const profileIdFromStorage = toNumber(localStorage.getItem('studySquadsProfileId'));

  const validProfileIds = new Set(state.profiles.map(profile => Number(profile.id)));

  if (profileIdFromUrl && validProfileIds.has(profileIdFromUrl)) {
    state.selectedProfileId = profileIdFromUrl;
    localStorage.setItem('studySquadsProfileId', String(profileIdFromUrl));
    return;
  }

  if (profileIdFromStorage && validProfileIds.has(profileIdFromStorage)) {
    state.selectedProfileId = profileIdFromStorage;
    return;
  }

  state.selectedProfileId = state.profiles[0]?.id ? Number(state.profiles[0].id) : null;
}

async function changeProfile(profileId) {
  const nextProfileId = toNumber(profileId);

  if (!nextProfileId || nextProfileId === Number(state.selectedProfileId)) return;

  state.selectedProfileId = nextProfileId;
  localStorage.setItem('studySquadsProfileId', String(nextProfileId));

  state.stats = null;
  state.squads = [];
  state.activeSquadId = null;
  state.leaderboard = [];
  state.feed = [];
  state.tab = 'details';
  state.error = null;
  state.loading = true;

  render();

  try {
    await loadStats();

    if (isPremiumUser()) {
      await loadSquads();
    }

    const params = new URLSearchParams(window.location.search);
    params.set('profile_id', String(nextProfileId));
    window.history.replaceState({}, document.title, `/study-squads.html?${params.toString()}`);

    state.loading = false;
    render();

    if (isPremiumUser()) {
      await autoJoinFromUrl();
    }
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.error = error.message || 'Could not switch learner profile.';
    render();
  }
}

async function loadStats() {
  if (!state.selectedProfileId) return;

  const { data, error } = await supabaseClient.rpc('get_study_squad_profile_stats', {
    p_profile_id: Number(state.selectedProfileId)
  });

  if (error) {
    console.warn('Could not load Study Squad stats:', error);
    state.stats = null;
    return;
  }

  state.stats = Array.isArray(data) ? data[0] : data;
}

async function loadSquads() {
  if (!state.selectedProfileId) return;

  const { data, error } = await supabaseClient.rpc('get_my_study_squads', {
    p_profile_id: Number(state.selectedProfileId)
  });

  if (error) {
    throw new Error(`Could not load Study Squads: ${error.message}`);
  }

  state.squads = data || [];

  if (!state.activeSquadId && state.squads.length > 0) {
    state.activeSquadId = state.squads[0].id;
  }

  if (state.activeSquadId) {
    await loadActiveSquadDetails();
  }
}

async function loadActiveSquadDetails() {
  if (!state.activeSquadId) {
    state.leaderboard = [];
    state.feed = [];
    return;
  }

  const [leaderboardResult, feedResult] = await Promise.all([
    supabaseClient.rpc('get_study_squad_leaderboard', {
      p_squad_id: state.activeSquadId
    }),
    supabaseClient.rpc('get_study_squad_activity_feed', {
      p_squad_id: state.activeSquadId,
      p_limit: 30
    })
  ]);

  if (leaderboardResult.error) {
    throw new Error(`Could not load leaderboard: ${leaderboardResult.error.message}`);
  }

  if (feedResult.error) {
    throw new Error(`Could not load activity feed: ${feedResult.error.message}`);
  }

  state.leaderboard = leaderboardResult.data || [];
  state.feed = feedResult.data || [];
}

async function createSquad(event) {
  event.preventDefault();

  const input = document.getElementById('create-squad-name');
  const button = document.getElementById('create-squad-btn');
  const squadName = input?.value.trim();

  if (!state.selectedProfileId) {
    showToast('Choose a learner profile first');
    return;
  }

  if (!squadName) {
    showToast('Enter a squad name');
    return;
  }

  button.disabled = true;
  button.textContent = 'Creating...';

  try {
    const { data, error } = await supabaseClient.rpc('create_study_squad', {
      p_profile_id: Number(state.selectedProfileId),
      p_squad_name: squadName
    });

    if (error) throw error;

    const createdSquad = Array.isArray(data) ? data[0] : data;

    input.value = '';
    state.activeSquadId = createdSquad?.id || null;
    state.tab = 'details';

    await loadSquads();
    await loadStats();

    showToast('Squad created');
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || 'Could not create squad.');
  } finally {
    button.disabled = false;
    button.textContent = 'Create Squad';
  }
}

async function joinSquad(event) {
  event.preventDefault();

  const input = document.getElementById('join-squad-code');
  const button = document.getElementById('join-squad-btn');
  const code = input?.value.trim().toUpperCase();

  if (!state.selectedProfileId) {
    showToast('Choose a learner profile first');
    return;
  }

  if (!code) {
    showToast('Enter a squad code');
    return;
  }

  button.disabled = true;
  button.textContent = 'Joining...';

  try {
    const { data, error } = await supabaseClient.rpc('join_study_squad_by_code', {
      p_profile_id: Number(state.selectedProfileId),
      p_invite_code: code
    });

    if (error) throw error;

    const joinedSquad = Array.isArray(data) ? data[0] : data;

    input.value = '';
    state.activeSquadId = joinedSquad?.id || null;
    state.tab = 'details';

    await loadSquads();
    await loadStats();

    showToast('Joined squad');
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || 'Could not join squad.');
  } finally {
    button.disabled = false;
    button.textContent = 'Join Squad';
  }
}

async function selectSquad(squadId) {
  if (!squadId || squadId === state.activeSquadId) return;

  state.activeSquadId = squadId;
  state.tab = 'details';
  state.loading = true;
  render();

  try {
    await loadActiveSquadDetails();
    state.loading = false;
    render();
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.error = error.message || 'Could not load squad.';
    render();
  }
}

async function autoJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (!code || !state.selectedProfileId || !isPremiumUser()) return;

  try {
    const { data, error } = await supabaseClient.rpc('join_study_squad_by_code', {
      p_profile_id: Number(state.selectedProfileId),
      p_invite_code: code.toUpperCase()
    });

    if (error) throw error;

    const joinedSquad = Array.isArray(data) ? data[0] : data;
    state.activeSquadId = joinedSquad?.id || state.activeSquadId;
    state.tab = 'details';

    window.history.replaceState(
      {},
      document.title,
      `/study-squads.html?profile_id=${encodeURIComponent(state.selectedProfileId)}`
    );

    await loadSquads();
    await loadStats();

    showToast('Joined squad');
    render();
  } catch (error) {
    console.warn('Could not auto-join squad:', error);
    showToast('Could not join from invite link');
  }
}

function render() {
  if (state.loading) {
    app.innerHTML = loadingTemplate();
    createIcons();
    return;
  }

  if (state.error) {
    app.innerHTML = errorTemplate(state.error);
    bindCommonEvents();
    createIcons();
    return;
  }

  if (!state.profiles.length) {
    app.innerHTML = `${headerTemplate()}${noProfilesTemplate()}`;
    bindCommonEvents();
    createIcons();
    return;
  }

  if (!isPremiumUser()) {
    app.innerHTML = `${headerTemplate()}${paywallTemplate()}`;
    bindCommonEvents();
    bindProfileEvents();
    createIcons();
    return;
  }

  app.innerHTML = `${headerTemplate()}${dashboardTemplate()}`;

  bindCommonEvents();
  bindProfileEvents();
  bindDashboardEvents();
  renderQrCode();
  createIcons();
}

function loadingTemplate() {
  return `
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="mt-4 text-gray-600 font-medium">Loading Study Squads...</p>
      </div>
    </div>
  `;
}

function errorTemplate(message) {
  return `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="card max-w-md w-full p-8 text-center border-t-4 border-red-500">
        <i data-lucide="alert-triangle" class="h-14 w-14 text-red-500 mx-auto"></i>
        <h1 class="mt-4 text-2xl font-bold text-gray-800">Something went wrong</h1>
        <p class="mt-3 text-gray-600">${escapeHtml(message)}</p>
        <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/app.html" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">
            Back to Learner App
          </a>
          <button onclick="window.location.reload()" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            Retry
          </button>
        </div>
      </div>
    </div>
  `;
}

function headerTemplate() {
  const profile = selectedProfile();

  return `
    <header class="max-w-7xl mx-auto px-4 md:px-8 pt-6">
      <div class="card p-5 md:p-6 border-t-4 border-indigo-500">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <div class="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <i data-lucide="users-round" class="h-6 w-6 text-indigo-600"></i>
              </div>
              <div>
                <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">LearnerGenie</p>
                <h1 class="text-3xl font-bold text-gray-800">Study Squads</h1>
              </div>
            </div>
            <p class="mt-3 text-gray-600 max-w-2xl">
              Private squads, weekly XP, streaks and shared learning activity.
            </p>
            ${profile ? `
              <p class="mt-3 text-sm text-gray-500">
                Viewing squads as <span class="font-bold text-gray-800">${escapeHtml(profile.name)}</span>.
                Each learner profile has its own squads, XP and streaks.
              </p>
            ` : ''}
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2">
            ${profileSelectorTemplate()}
            <a href="/app.html" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 text-center">
              Learner App
            </a>
            <button id="logout-btn" class="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800">
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function profileSelectorTemplate() {
  if (!state.profiles.length) return '';

  return `
    <label class="sr-only" for="profile-select">Learner profile</label>
    <select id="profile-select" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 font-semibold">
      ${state.profiles.map(profile => `
        <option value="${escapeHtml(profile.id)}" ${Number(profile.id) === Number(state.selectedProfileId) ? 'selected' : ''}>
          ${escapeHtml(profile.name || 'Learner')}${profile.grade ? ` · ${escapeHtml(profile.grade)}` : ''}
        </option>
      `).join('')}
    </select>
  `;
}

function noProfilesTemplate() {
  return `
    <main class="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <div class="card p-8 text-center border-t-4 border-amber-400">
        <i data-lucide="user-plus" class="h-14 w-14 text-amber-500 mx-auto"></i>
        <h2 class="mt-4 text-2xl font-bold text-gray-800">Create a learner profile first</h2>
        <p class="mt-3 text-gray-600">
          Study Squads are linked to learner profiles, not just the parent account.
        </p>
        <a href="/app.html" class="inline-block mt-6 px-5 py-3 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">
          Back to Learner App
        </a>
      </div>
    </main>
  `;
}

function paywallTemplate() {
  const stats = state.stats || {};
  const profile = selectedProfile();

  return `
    <main class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 card p-8 border-t-4 border-amber-400">
          <div class="flex items-start gap-4">
            <div class="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <i data-lucide="lock-keyhole" class="h-7 w-7 text-amber-600"></i>
            </div>
            <div>
              <p class="text-sm font-bold uppercase tracking-wide text-amber-600">Premium feature</p>
              <h2 class="mt-1 text-3xl font-bold text-gray-800">Unlock Study Squads</h2>
              <p class="mt-4 text-gray-600 leading-relaxed">
                Upgrade to unlock private squads, weekly XP leaderboards, study streaks and a shared activity feed.
                XP is based on engagement and consistency, not academic marks.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            ${featureCard('trophy', 'Weekly XP Leaderboards', 'Compete on consistency, not test scores.')}
            ${featureCard('flame', 'Study Streaks', 'Build daily learning habits.')}
            ${featureCard('qr-code', 'Private Squad Codes', 'Invite friends or family with a code.')}
            ${featureCard('activity', 'Squad Feed', 'See what your squad is working on.')}
          </div>

          <div class="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="/app.html" class="px-5 py-3 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-center">
              Back to learning
            </a>
          </div>
        </div>

        <aside class="card p-6 border-t-4 border-indigo-500">
          <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">Hidden momentum</p>
          <h3 class="mt-1 text-2xl font-bold text-gray-800">
            ${escapeHtml(profile?.name || 'This learner')} is already earning XP
          </h3>
          <p class="mt-3 text-sm text-gray-600">
            Engagement can build in the background, so progress is ready when the account upgrades.
          </p>

          <div class="mt-6 space-y-3">
            ${statRow('Weekly XP', stats.weekly_xp || 0, 'sparkles')}
            ${statRow('Total XP', stats.total_xp || 0, 'star')}
            ${statRow('Current streak', `${stats.current_streak || 0} days`, 'flame')}
            ${statRow('Active days', stats.total_active_days || 0, 'calendar-check')}
          </div>
        </aside>
      </section>
    </main>
  `;
}

function dashboardTemplate() {
  const squad = activeSquad();

  return `
    <main class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      ${statsStripTemplate()}

      ${state.squads.length ? `
        <section class="card p-4 md:p-5 mt-6">
          <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <i data-lucide="users-round" class="h-5 w-5 text-indigo-600"></i>
                <h2 class="text-xl font-bold text-gray-800">
                  ${escapeHtml(selectedProfile()?.name || 'Learner')}'s Squads
                </h2>
              </div>
              <p class="text-sm text-gray-500 mt-1">Switch between squads or invite someone new.</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button id="toggle-create-squad" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                + Create Squad
              </button>
              <button id="toggle-join-squad" class="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600">
                Join with Code
              </button>
            </div>
          </div>

          ${squadListTemplate()}
          ${squadActionPanelsTemplate()}
        </section>

        <section class="mt-6">
          ${squad ? activeSquadTemplate(squad) : emptySquadTemplate()}
        </section>
      ` : `
        <section class="mt-6">
          ${emptySquadTemplate()}
        </section>
      `}
    </main>
  `;
}

function statsStripTemplate() {
  const stats = state.stats || {};

  return `
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      ${metricCard('Weekly XP', stats.weekly_xp || 0, 'sparkles', 'This week')}
      ${metricCard('Current streak', `${stats.current_streak || 0} days`, 'flame', 'Keep it alive')}
      ${metricCard('Total XP', stats.total_xp || 0, 'star', 'All-time effort')}
      ${metricCard('Active days', stats.total_active_days || 0, 'calendar-check', 'Days studied')}
    </section>
  `;
}

function squadListTemplate() {
  return `
    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
      ${state.squads.map(squad => {
        const isActive = squad.id === state.activeSquadId;

        return `
          <button
            data-squad-id="${escapeHtml(squad.id)}"
            class="squad-select-btn shrink-0 px-4 py-3 rounded-xl border transition text-left ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50'}"
          >
            <div class="font-bold whitespace-nowrap">${escapeHtml(squad.squad_name)}</div>
            <div class="text-xs ${isActive ? 'text-indigo-100' : 'text-gray-500'}">
              ${squad.member_count || 0} members · ${escapeHtml(squad.my_role || 'member')}
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function squadActionPanelsTemplate() {
  return `
    <div id="create-squad-panel" class="hidden mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
      <form id="create-squad-form" class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label for="create-squad-name" class="block text-sm font-bold text-gray-700 mb-1">Squad name</label>
          <input
            id="create-squad-name"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g. Grade 7 Maths Squad"
          />
        </div>
        <button id="create-squad-btn" class="py-2 px-5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-300">
          Create Squad
        </button>
      </form>
    </div>

    <div id="join-squad-panel" class="hidden mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
      <form id="join-squad-form" class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label for="join-squad-code" class="block text-sm font-bold text-gray-700 mb-1">Squad code</label>
          <input
            id="join-squad-code"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 uppercase focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="LG-8F3K2Q"
          />
        </div>
        <button id="join-squad-btn" class="py-2 px-5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:bg-amber-300">
          Join Squad
        </button>
      </form>
    </div>
  `;
}

function activeSquadTemplate(squad) {
  return `
    <section class="card border-t-4 border-indigo-500 overflow-hidden">
      <div class="p-5 md:p-6 border-b border-gray-100">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">Active Squad</p>
            <h2 class="mt-1 text-3xl font-bold text-gray-800">${escapeHtml(squad.squad_name)}</h2>
            <p class="mt-2 text-gray-500">
              ${squad.member_count || 0} members · Weekly XP resets every Monday UTC
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            ${tabButton('details', 'Squad Details', 'info')}
            ${tabButton('leaderboard', 'Leaderboard', 'trophy')}
            ${tabButton('activity', 'Squad Activity', 'activity')}
          </div>
        </div>
      </div>

      <div class="p-5 md:p-6">
        ${state.tab === 'leaderboard' ? leaderboardTemplate() : ''}
        ${state.tab === 'activity' ? activityTemplate() : ''}
        ${state.tab === 'details' ? squadDetailsTemplate(squad) : ''}
      </div>
    </section>
  `;
}

function tabButton(tab, label, icon) {
  const active = state.tab === tab;

  return `
    <button
      data-squad-tab="${escapeHtml(tab)}"
      class="squad-tab-btn px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50'}"
    >
      <i data-lucide="${icon}" class="h-4 w-4"></i>
      ${escapeHtml(label)}
    </button>
  `;
}

function squadDetailsTemplate(squad) {
  const inviteLink = inviteLinkFor(squad);

  return `
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-indigo-50">
            <p class="text-xs font-bold uppercase text-indigo-600">Squad code</p>
            <p class="mt-1 text-2xl font-bold tracking-wider text-gray-800">${escapeHtml(squad.invite_code)}</p>
          </div>
          <div class="p-4 rounded-xl bg-amber-50">
            <p class="text-xs font-bold uppercase text-amber-600">Members</p>
            <p class="mt-1 text-2xl font-bold text-gray-800">${squad.member_count || 0}</p>
          </div>
          <div class="p-4 rounded-xl bg-emerald-50">
            <p class="text-xs font-bold uppercase text-emerald-600">Focus</p>
            <p class="mt-1 text-2xl font-bold text-gray-800">Consistency</p>
          </div>
        </div>

        <div class="p-5 rounded-xl bg-gray-50">
          <h3 class="text-xl font-bold text-gray-800">Invite people to this Squad</h3>
          <p class="mt-2 text-sm text-gray-600">
            Share the squad code or invite link. Each learner profile joins separately.
          </p>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <input
              id="invite-link"
              readonly
              class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
              value="${escapeHtml(inviteLink)}"
            />

            <div class="flex flex-wrap gap-2">
              <button
                id="copy-code-btn"
                data-code="${escapeHtml(squad.invite_code)}"
                class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
              >
                Copy Code
              </button>
              <button
                id="copy-link-btn"
                data-link="${escapeHtml(inviteLink)}"
                class="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-800"
              >
                Copy Link
              </button>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-center">
            <div class="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-center min-h-[170px]">
              <div id="qr-code" class="flex items-center justify-center min-h-[140px] w-full"></div>
            </div>

            <div>
              <p class="font-bold text-gray-800">Scan to join this Squad</p>
              <p class="mt-1 text-sm text-gray-600">Share this QR code with another premium LearnerGenie user.</p>
              <p class="mt-3 text-sm text-gray-500">
                They can also join manually using the Squad Code:
                <span class="font-bold text-gray-800">${escapeHtml(squad.invite_code)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      ${milestonePanelTemplate()}
    </div>
  `;
}

function milestonePanelTemplate() {
  const stats = state.stats || {};

  return `
    <div class="card p-6 border-t-4 border-amber-400 shadow-none border border-gray-100">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-bold uppercase tracking-wide text-amber-600">Streak Milestones</p>
          <h3 class="mt-1 text-2xl font-bold text-gray-800">Consistency wins</h3>
        </div>
        <i data-lucide="flame" class="h-8 w-8 text-amber-500"></i>
      </div>

      <p class="mt-3 text-sm text-gray-600">
        Milestones are earned through regular study habits, not test scores.
      </p>

      <div class="mt-5 space-y-3">
        ${statRow('3-day milestones', stats.three_day_streaks_earned || 0, 'badge-check')}
        ${statRow('7-day milestones', stats.seven_day_streaks_earned || 0, 'award')}
        ${statRow('10-day milestones', stats.ten_day_streaks_earned || 0, 'trophy')}
        ${statRow('Longest streak', `${stats.longest_streak || 0} days`, 'flame')}
      </div>
    </div>
  `;
}

function leaderboardTemplate() {
  const sortKey = state.leaderboardMode === 'all' ? 'total_xp' : 'weekly_xp';

  const rows = [...state.leaderboard]
    .sort((a, b) => {
      const xpDiff = (b[sortKey] || 0) - (a[sortKey] || 0);
      if (xpDiff !== 0) return xpDiff;

      const streakDiff = (b.current_streak || 0) - (a.current_streak || 0);
      if (streakDiff !== 0) return streakDiff;

      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    })
    .map((row, index) => ({
      ...row,
      displayRank: index + 1
    }));

  return `
    <div>
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-2xl font-bold text-gray-800">Leaderboard</h3>
          <p class="text-sm text-gray-500 mt-1">
            Ranked by engagement and consistency, not academic marks.
          </p>
        </div>

        <div class="flex bg-gray-100 p-1 rounded-xl w-fit">
          <button
            data-leaderboard-mode="week"
            class="leaderboard-mode-btn px-4 py-2 rounded-lg font-bold text-sm transition ${state.leaderboardMode === 'week' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 hover:bg-white'}"
          >
            This Week
          </button>
          <button
            data-leaderboard-mode="all"
            class="leaderboard-mode-btn px-4 py-2 rounded-lg font-bold text-sm transition ${state.leaderboardMode === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 hover:bg-white'}"
          >
            All Time
          </button>
        </div>
      </div>

      <div class="mt-6 space-y-3">
        ${rows.length ? rows.map(row => leaderboardRowTemplate(row, sortKey)).join('') : emptyPanel('trophy', 'No leaderboard data yet', 'Generate learning work to start earning XP.')}
      </div>
    </div>
  `;
}

function leaderboardRowTemplate(row, sortKey) {
  const xp = row[sortKey] || 0;
  const xpLabel = sortKey === 'total_xp' ? 'all time' : 'this week';

  return `
    <div class="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
      <div class="h-11 w-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
        ${row.displayRank}
      </div>

      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800 truncate">${escapeHtml(row.display_name || 'Learner')}</div>
        <div class="text-xs text-gray-500">
          🔥 ${row.current_streak || 0} day streak · ${row.total_active_days || 0} active days
        </div>
      </div>

      <div class="text-right">
        <div class="font-bold text-indigo-600">${xp} XP</div>
        <div class="text-xs text-gray-500">${xpLabel}</div>
      </div>
    </div>
  `;
}

function activityTemplate() {
  return `
    <div>
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-2xl font-bold text-gray-800">Squad Activity</h3>
          <p class="text-sm text-gray-500 mt-1">
            Recent study actions shared by squad members.
          </p>
        </div>
        <i data-lucide="activity" class="h-8 w-8 text-indigo-500"></i>
      </div>

      <div class="mt-6 space-y-4">
        ${state.feed.length ? state.feed.map(feedItemTemplate).join('') : emptyPanel('activity', 'No shared activity yet', 'Generate learning work to get the feed moving.')}
      </div>
    </div>
  `;
}

function feedItemTemplate(item) {
  const topic = item.activity_payload?.topic || item.event_summary || '';

  return `
    <div class="feed-line pl-10 relative">
      <div class="absolute left-0 top-0 h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center z-10">
        <i data-lucide="${feedIcon(item.event_type)}" class="h-4 w-4 text-indigo-600"></i>
      </div>

      <div class="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <p class="font-bold text-gray-800">${escapeHtml(item.event_title)}</p>
            <p class="text-sm text-gray-600 mt-1 clamp-2">${escapeHtml(item.event_summary || 'Learning activity')}</p>
          </div>
          <span class="text-xs text-gray-400 shrink-0">${escapeHtml(formatDate(item.created_at))}</span>
        </div>

        ${item.event_type === 'test_generated' ? `
          <button
            class="copy-test-topic-btn mt-3 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
            data-topic="${escapeHtml(topic)}"
          >
            Copy test topic
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function feedIcon(type) {
  switch (type) {
    case 'test_generated':
      return 'clipboard-check';
    case 'test_completed':
      return 'check-circle';
    case 'math_help':
      return 'calculator';
    case 'homework_help':
      return 'life-buoy';
    case 'explanation_generated':
      return 'baby';
    default:
      return 'sparkles';
  }
}

function emptySquadTemplate() {
  return `
    <div class="card p-8 md:p-10 border-t-4 border-indigo-500">
      <div class="text-center max-w-2xl mx-auto">
        <i data-lucide="users-round" class="h-16 w-16 text-indigo-500 mx-auto"></i>
        <h2 class="mt-4 text-3xl font-bold text-gray-800">Create your first Study Squad</h2>
        <p class="mt-3 text-gray-600">
          Study Squads help learners build consistency together. Create a private squad or join one with a code.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
        <div class="p-5 rounded-xl bg-indigo-50 border border-indigo-100">
          <h3 class="text-xl font-bold text-gray-800">Create a Squad</h3>
          <p class="text-sm text-gray-500 mt-1">Start a private group for friends, classmates or family.</p>

          <form id="create-squad-form" class="mt-4 space-y-3">
            <input
              id="create-squad-name"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Grade 7 Maths Squad"
            />
            <button id="create-squad-btn" class="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-300">
              Create Squad
            </button>
          </form>
        </div>

        <div class="p-5 rounded-xl bg-amber-50 border border-amber-100">
          <h3 class="text-xl font-bold text-gray-800">Join a Squad</h3>
          <p class="text-sm text-gray-500 mt-1">Enter a squad code shared with you.</p>

          <form id="join-squad-form" class="mt-4 space-y-3">
            <input
              id="join-squad-code"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 uppercase focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="LG-8F3K2Q"
            />
            <button id="join-squad-btn" class="w-full py-2 px-4 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:bg-amber-300">
              Join Squad
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function metricCard(label, value, icon, subtext) {
  return `
    <div class="card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm text-gray-500">${escapeHtml(subtext)}</p>
          <p class="mt-1 text-2xl font-bold text-gray-800">${escapeHtml(value)}</p>
          <p class="mt-1 text-sm font-semibold text-gray-600">${escapeHtml(label)}</p>
        </div>
        <div class="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <i data-lucide="${icon}" class="h-6 w-6 text-indigo-600"></i>
        </div>
      </div>
    </div>
  `;
}

function featureCard(icon, title, text) {
  return `
    <div class="p-4 rounded-xl bg-gray-50">
      <div class="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
        <i data-lucide="${icon}" class="h-5 w-5 text-indigo-600"></i>
      </div>
      <h3 class="mt-3 font-bold text-gray-800">${escapeHtml(title)}</h3>
      <p class="mt-1 text-sm text-gray-600">${escapeHtml(text)}</p>
    </div>
  `;
}

function statRow(label, value, icon) {
  return `
    <div class="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50">
      <div class="flex items-center gap-3">
        <i data-lucide="${icon}" class="h-5 w-5 text-indigo-600"></i>
        <span class="text-sm font-semibold text-gray-700">${escapeHtml(label)}</span>
      </div>
      <span class="font-bold text-gray-900">${escapeHtml(value)}</span>
    </div>
  `;
}

function emptyPanel(icon, title, text) {
  return `
    <div class="p-8 rounded-xl bg-gray-50 text-center">
      <i data-lucide="${icon}" class="h-12 w-12 text-indigo-500 mx-auto"></i>
      <h4 class="mt-3 text-xl font-bold text-gray-800">${escapeHtml(title)}</h4>
      <p class="mt-2 text-gray-500">${escapeHtml(text)}</p>
    </div>
  `;
}

function bindCommonEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/login.html';
  });
}

function bindProfileEvents() {
  document.getElementById('profile-select')?.addEventListener('change', event => {
    changeProfile(event.target.value);
  });
}

function bindDashboardEvents() {
  document.getElementById('create-squad-form')?.addEventListener('submit', createSquad);
  document.getElementById('join-squad-form')?.addEventListener('submit', joinSquad);

  document.getElementById('toggle-create-squad')?.addEventListener('click', () => {
    document.getElementById('create-squad-panel')?.classList.toggle('hidden');
    document.getElementById('join-squad-panel')?.classList.add('hidden');
  });

  document.getElementById('toggle-join-squad')?.addEventListener('click', () => {
    document.getElementById('join-squad-panel')?.classList.toggle('hidden');
    document.getElementById('create-squad-panel')?.classList.add('hidden');
  });

  document.querySelectorAll('.squad-select-btn').forEach(button => {
    button.addEventListener('click', () => selectSquad(button.dataset.squadId));
  });

  document.querySelectorAll('.squad-tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.tab = button.dataset.squadTab;
      render();
    });
  });

  document.querySelectorAll('.leaderboard-mode-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.leaderboardMode = button.dataset.leaderboardMode;
      render();
    });
  });

  document.getElementById('copy-code-btn')?.addEventListener('click', event => {
    copyText(event.currentTarget.dataset.code, 'Squad code copied');
  });

  document.getElementById('copy-link-btn')?.addEventListener('click', event => {
    copyText(event.currentTarget.dataset.link, 'Invite link copied');
  });

  document.querySelectorAll('.copy-test-topic-btn').forEach(button => {
    button.addEventListener('click', () => {
      copyText(button.dataset.topic || '', 'Test topic copied');
    });
  });
}

function renderQrCode() {
  const squad = activeSquad();
  const qrContainer = document.getElementById('qr-code');

  if (!squad || !qrContainer) return;

  const joinUrl = inviteLinkFor(squad);
  const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=${encodeURIComponent(joinUrl)}`;

  qrContainer.innerHTML = `
    <img
      src="${escapeHtml(qrSource)}"
      alt="QR code to join ${escapeHtml(squad.squad_name)}"
      class="w-[140px] h-[140px] rounded-lg"
      loading="lazy"
      onerror="this.outerHTML='<div class=&quot;text-center text-xs text-gray-500&quot;><p class=&quot;font-semibold&quot;>QR code could not load</p><p class=&quot;mt-1&quot;>Use the Squad Code instead</p></div>'"
    />
  `;
}

init();
