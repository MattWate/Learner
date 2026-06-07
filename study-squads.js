const SUPABASE_URL = 'https://yvoemqckgtmedfjudkzo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0.tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');

const state = {
  session: null,
  account: null,
  engagementStats: null,
  groups: [],
  activeGroupId: null,
  activeSquadTab: 'details',
  leaderboardMode: 'week',
  leaderboard: [],
  feed: [],
  loading: true,
  loadingGroup: false,
  error: null
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isPremiumUser() {
  const activeTier = state.account?.active_tier || 'free';
  const subscriptionStatus = state.account?.subscription_status || 'free';

  return activeTier !== 'free' || ['active', 'paid', 'trialing'].includes(subscriptionStatus);
}

function activeGroup() {
  return state.groups.find(group => group.id === state.activeGroupId) || null;
}

function formatDateTime(value) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function copyText(text, label = 'Copied') {
  if (!text) return;

  navigator.clipboard.writeText(text)
    .then(() => showToast(label))
    .catch(() => window.prompt('Copy this:', text));
}

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl z-50 text-sm font-semibold';
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function init() {
  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !sessionData?.session) {
      window.location.href = '/login.html';
      return;
    }

    state.session = sessionData.session;

    await loadAccount();
    await loadEngagementStats();

    if (isPremiumUser()) {
      await loadGroups();
    }

    state.loading = false;
    render();

    if (isPremiumUser()) {
      await autoJoinFromUrl();
    }
  } catch (error) {
    console.error(error);
    state.loading = false;
    state.error = error.message || 'Something went wrong.';
    render();
  }
}

async function loadAccount() {
  const userId = state.session.user.id;

  const { data, error } = await supabaseClient
    .from('accounts')
    .select('id, parent_email, active_tier, subscription_status, profile_limit')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Could not load account: ${error.message}`);
  }

  state.account = data;
}

async function loadEngagementStats() {
  const { data, error } = await supabaseClient.rpc('get_my_engagement_stats');

  if (error) {
    console.warn('Could not load engagement stats:', error);
    state.engagementStats = null;
    return;
  }

  state.engagementStats = Array.isArray(data) ? data[0] : data;
}

async function loadGroups() {
  const { data, error } = await supabaseClient.rpc('get_my_study_groups');

  if (error) {
    throw new Error(`Could not load Study Squads: ${error.message}`);
  }

  state.groups = data || [];

  if (!state.activeGroupId && state.groups.length > 0) {
    state.activeGroupId = state.groups[0].id;
  }

  if (state.activeGroupId) {
    await loadActiveGroupDetails(false);
  }
}

async function loadActiveGroupDetails(shouldRender = true) {
  if (!state.activeGroupId) {
    state.leaderboard = [];
    state.feed = [];
    return;
  }

  state.loadingGroup = true;
  if (shouldRender) render();

  try {
    const [leaderboardResult, feedResult] = await Promise.all([
      supabaseClient.rpc('get_study_group_leaderboard', {
        p_group_id: state.activeGroupId
      }),
      supabaseClient.rpc('get_group_activity_feed', {
        p_group_id: state.activeGroupId,
        p_limit: 30
      })
    ]);

    if (leaderboardResult.error) {
      throw new Error(`Could not load leaderboard: ${leaderboardResult.error.message}`);
    }

    if (feedResult.error) {
      throw new Error(`Could not load feed: ${feedResult.error.message}`);
    }

    state.leaderboard = leaderboardResult.data || [];
    state.feed = feedResult.data || [];
  } finally {
    state.loadingGroup = false;
    if (shouldRender) render();
  }
}

async function createSquad(event) {
  event.preventDefault();

  const input = document.getElementById('create-squad-name');
  const button = document.getElementById('create-squad-btn');
  const groupName = input?.value.trim();

  if (!groupName) {
    showToast('Please enter a squad name');
    return;
  }

  button.disabled = true;
  button.textContent = 'Creating...';

  try {
    const { data, error } = await supabaseClient.rpc('create_study_group', {
      p_group_name: groupName
    });

    if (error) throw error;

    const created = Array.isArray(data) ? data[0] : data;

    input.value = '';
    state.activeGroupId = created?.id || null;
    state.activeSquadTab = 'details';

    await loadGroups();
    await loadEngagementStats();

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

  if (!code) {
    showToast('Please enter a squad code');
    return;
  }

  button.disabled = true;
  button.textContent = 'Joining...';

  try {
    const { data, error } = await supabaseClient.rpc('join_study_group_by_code', {
      p_invite_code: code
    });

    if (error) throw error;

    const joined = Array.isArray(data) ? data[0] : data;

    input.value = '';
    state.activeGroupId = joined?.id || null;
    state.activeSquadTab = 'details';

    await loadGroups();
    await loadEngagementStats();

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

function selectGroup(groupId) {
  if (!groupId || groupId === state.activeGroupId) return;

  state.activeGroupId = groupId;
  state.activeSquadTab = 'details';

  loadActiveGroupDetails(true).catch(error => {
    console.error(error);
    state.error = error.message;
    state.loadingGroup = false;
    render();
  });
}

function setSquadTab(tab) {
  state.activeSquadTab = tab;
  render();
}

function setLeaderboardMode(mode) {
  state.leaderboardMode = mode;
  render();
}

function getSortedLeaderboard() {
  const rows = [...state.leaderboard];

  const primaryKey = state.leaderboardMode === 'all' ? 'total_xp' : 'weekly_xp';

  return rows
    .sort((a, b) => {
      const primaryDiff = (b[primaryKey] || 0) - (a[primaryKey] || 0);
      if (primaryDiff !== 0) return primaryDiff;

      const streakDiff = (b.current_streak || 0) - (a.current_streak || 0);
      if (streakDiff !== 0) return streakDiff;

      return String(a.display_name || '').localeCompare(String(b.display_name || ''));
    })
    .map((row, index) => ({
      ...row,
      display_rank: index + 1
    }));
}

function render() {
  if (state.loading) {
    app.innerHTML = loadingTemplate();
    return;
  }

  if (state.error) {
    app.innerHTML = errorTemplate(state.error);
    lucide.createIcons();
    return;
  }

  if (!isPremiumUser()) {
    app.innerHTML = freePaywallTemplate();
    lucide.createIcons();
    bindCommonEvents();
    return;
  }

  app.innerHTML = premiumDashboardTemplate();
  lucide.createIcons();
  bindCommonEvents();
  bindPremiumEvents();
  renderQrIfNeeded();
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
        <p class="mt-3 text-gray-600">${esc(message)}</p>
        <div class="mt-6 flex justify-center gap-3">
          <a href="/app.html" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Back to Learner App</a>
          <button onclick="window.location.reload()" class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Retry</button>
        </div>
      </div>
    </div>
  `;
}

function pageHeaderTemplate() {
  return `
    <header class="max-w-7xl mx-auto px-4 md:px-8 pt-6">
      <div class="card p-5 md:p-6 border-t-4 border-indigo-500">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
              Build better study habits with private squads, weekly XP, streaks and shared learning activity.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <a href="/app.html" class="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50">
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

function freePaywallTemplate() {
  const stats = state.engagementStats || {};
  const weeklyXp = stats.weekly_xp || 0;
  const totalXp = stats.total_xp || 0;
  const streak = stats.current_streak || 0;
  const activeDays = stats.total_active_days || 0;

  return `
    ${pageHeaderTemplate()}

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
                You are already building learning momentum. Upgrade to unlock private squads,
                weekly XP leaderboards, study streaks and a shared activity feed with friends,
                classmates or family.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            ${featureCard('trophy', 'Weekly XP Leaderboards', 'Compete on consistency, not academic marks.')}
            ${featureCard('flame', 'Study Streaks', 'Build daily learning habits and milestone rewards.')}
            ${featureCard('qr-code', 'Private Squad Codes', 'Invite friends or family with a simple code.')}
            ${featureCard('activity', 'Squad Feed', 'See what your squad is working on and try shared tests.')}
          </div>

          <div class="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="/app.html" class="px-5 py-3 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-center">
              Upgrade to unlock
            </a>
            <a href="/app.html" class="px-5 py-3 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 text-center">
              Back to learning
            </a>
          </div>
        </div>

        <aside class="card p-6 border-t-4 border-indigo-500">
          <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">Your hidden momentum</p>
          <h3 class="mt-1 text-2xl font-bold text-gray-800">You are already earning XP</h3>
          <p class="mt-3 text-sm text-gray-600">
            Your engagement is being tracked in the background, so when you upgrade your progress comes with you.
          </p>

          <div class="mt-6 space-y-3">
            ${statRow('Weekly XP', weeklyXp, 'sparkles')}
            ${statRow('Total XP', totalXp, 'star')}
            ${statRow('Current streak', `${streak} days`, 'flame')}
            ${statRow('Active days', activeDays, 'calendar-check')}
          </div>
        </aside>
      </section>
    </main>
  `;
}

function premiumDashboardTemplate() {
  const group = activeGroup();

  return `
    ${pageHeaderTemplate()}

    <main class="max-w-7xl mx-auto px-4 md:px-8 py-8">
      ${statsStripTemplate()}

      ${state.groups.length ? `
        <section class="card p-4 md:p-5 mt-6">
          <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <i data-lucide="users-round" class="h-5 w-5 text-indigo-600"></i>
                <h2 class="text-xl font-bold text-gray-800">My Squads</h2>
              </div>
              <p class="text-sm text-gray-500 mt-1">Switch between your Study Squads or invite someone new.</p>
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
          ${group ? activeSquadTabbedTemplate(group) : emptyGroupTemplate()}
        </section>
      ` : `
        <section class="mt-6">
          ${emptyGroupTemplate()}
        </section>
      `}
    </main>
  `;
}

function statsStripTemplate() {
  const stats = state.engagementStats || {};

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
  if (!state.groups.length) return '';

  return `
    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
      ${state.groups.map(group => {
        const active = group.id === state.activeGroupId;
        return `
          <button
            data-group-id="${esc(group.id)}"
            class="group-select-btn shrink-0 px-4 py-3 rounded-xl border transition text-left ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50'}">
            <div class="font-bold whitespace-nowrap">${esc(group.group_name)}</div>
            <div class="text-xs ${active ? 'text-indigo-100' : 'text-gray-500'}">
              ${group.member_count || 0} members · ${esc(group.my_role || 'member')}
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
        <button
          id="create-squad-btn"
          class="py-2 px-5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-300">
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
        <button
          id="join-squad-btn"
          class="py-2 px-5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:bg-amber-300">
          Join Squad
        </button>
      </form>
    </div>
  `;
}

function activeSquadTabbedTemplate(group) {
  return `
    <section class="card border-t-4 border-indigo-500 overflow-hidden">
      <div class="p-5 md:p-6 border-b border-gray-100">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">Active Squad</p>
            <h2 class="mt-1 text-3xl font-bold text-gray-800">${esc(group.group_name)}</h2>
            <p class="mt-2 text-gray-500">${group.member_count || 0} members · Weekly XP resets every Monday UTC</p>
          </div>

          <div class="flex flex-wrap gap-2">
            ${squadTabButton('details', 'Squad Details', 'info')}
            ${squadTabButton('leaderboard', 'Leaderboard', 'trophy')}
            ${squadTabButton('activity', 'Squad Activity', 'activity')}
          </div>
        </div>
      </div>

      <div class="p-5 md:p-6">
        ${state.activeSquadTab === 'leaderboard'
          ? leaderboardTabTemplate()
          : state.activeSquadTab === 'activity'
            ? activityTabTemplate()
            : squadDetailsTabTemplate(group)}
      </div>
    </section>
  `;
}

function squadTabButton(tab, label, icon) {
  const active = state.activeSquadTab === tab;

  return `
    <button
      data-squad-tab="${esc(tab)}"
      class="squad-tab-btn px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 ${active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50'}">
      <i data-lucide="${icon}" class="h-4 w-4"></i>
      ${esc(label)}
    </button>
  `;
}

function squadDetailsTabTemplate(group) {
  return `
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-indigo-50">
            <p class="text-xs font-bold uppercase text-indigo-600">Squad code</p>
            <p class="mt-1 text-2xl font-bold tracking-wider text-gray-800">${esc(group.invite_code)}</p>
          </div>

          <div class="p-4 rounded-xl bg-amber-50">
            <p class="text-xs font-bold uppercase text-amber-600">Members</p>
            <p class="mt-1 text-2xl font-bold text-gray-800">${group.member_count || 0}</p>
          </div>

          <div class="p-4 rounded-xl bg-emerald-50">
            <p class="text-xs font-bold uppercase text-emerald-600">Focus</p>
            <p class="mt-1 text-2xl font-bold text-gray-800">Consistency</p>
          </div>
        </div>

        <div class="p-5 rounded-xl bg-gray-50">
          <h3 class="text-xl font-bold text-gray-800">Invite people to this Squad</h3>
          <p class="mt-2 text-sm text-gray-600">
            Share the squad code or invite link with friends, classmates or family. Only premium users can join Study Squads.
          </p>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <input
              id="invite-link"
              readonly
              class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
              value="${esc(`${window.location.origin}/study-squads.html?code=${encodeURIComponent(group.invite_code)}`)}"
            />
            <div class="flex flex-wrap gap-2">
              <button
                id="copy-code-btn"
                data-code="${esc(group.invite_code)}"
                class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                Copy Code
              </button>
              <button
                id="copy-link-btn"
                data-link="${esc(`${window.location.origin}/study-squads.html?code=${encodeURIComponent(group.invite_code)}`)}"
                class="px-4 py-2 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-800">
                Copy Link
              </button>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-center">
            <div class="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-center min-h-[160px]">
              <div id="qr-code" class="flex items-center justify-center min-h-[128px]"></div>
            </div>
            <div>
              <p class="font-bold text-gray-800">Scannable invite QR</p>
              <p class="mt-1 text-sm text-gray-600">
                This QR opens the Study Squads page with the invite code included. If the QR library fails to load,
                learners can still use the squad code above.
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
  const stats = state.engagementStats || {};

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

function leaderboardTabTemplate() {
  return `
    <div>
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-2xl font-bold text-gray-800">Leaderboard</h3>
          <p class="text-sm text-gray-500 mt-1">Ranked by study engagement and consistency, not academic scores.</p>
        </div>

        <div class="flex bg-gray-100 p-1 rounded-xl w-fit">
          <button
            data-leaderboard-mode="week"
            class="leaderboard-mode-btn px-4 py-2 rounded-lg font-bold text-sm transition ${state.leaderboardMode === 'week' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 hover:bg-white'}">
            This Week
          </button>
          <button
            data-leaderboard-mode="all"
            class="leaderboard-mode-btn px-4 py-2 rounded-lg font-bold text-sm transition ${state.leaderboardMode === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 hover:bg-white'}">
            All Time
          </button>
        </div>
      </div>

      <div class="mt-6">
        ${leaderboardTemplate()}
      </div>
    </div>
  `;
}

function leaderboardTemplate() {
  if (state.loadingGroup) {
    return panelLoadingTemplate('Loading leaderboard...');
  }

  const rows = getSortedLeaderboard();

  if (!rows.length) {
    return `
      <div class="p-8 rounded-xl bg-gray-50 text-center">
        <i data-lucide="trophy" class="h-12 w-12 text-amber-500 mx-auto"></i>
        <h4 class="mt-3 text-xl font-bold text-gray-800">No leaderboard data yet</h4>
        <p class="mt-2 text-gray-500">Generate learning work to start earning XP.</p>
      </div>
    `;
  }

  return `
    <div class="space-y-3">
      ${rows.map(row => leaderboardRow(row)).join('')}
    </div>
  `;
}

function leaderboardRow(row) {
  const xpValue = state.leaderboardMode === 'all' ? row.total_xp || 0 : row.weekly_xp || 0;
  const xpLabel = state.leaderboardMode === 'all' ? 'all time' : 'this week';

  return `
    <div class="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
      <div class="h-11 w-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
        ${row.display_rank || '-'}
      </div>

      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-800 truncate">${esc(row.display_name || 'Learner')}</div>
        <div class="text-xs text-gray-500">
          🔥 ${row.current_streak || 0} day streak · ${row.total_active_days || 0} active days · ${row.three_day_streaks_earned || 0} three-day milestones
        </div>
      </div>

      <div class="text-right">
        <div class="font-bold text-indigo-600">${xpValue} XP</div>
        <div class="text-xs text-gray-500">${xpLabel}</div>
      </div>
    </div>
  `;
}

function activityTabTemplate() {
  return `
    <div>
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 class="text-2xl font-bold text-gray-800">Squad Activity</h3>
          <p class="text-sm text-gray-500 mt-1">Recent study actions shared by your squad members.</p>
        </div>
        <i data-lucide="activity" class="h-8 w-8 text-indigo-500"></i>
      </div>

      <div class="mt-6">
        ${feedTemplate()}
      </div>
    </div>
  `;
}

function feedTemplate() {
  if (state.loadingGroup) {
    return panelLoadingTemplate('Loading squad feed...');
  }

  if (!state.feed.length) {
    return `
      <div class="p-8 rounded-xl bg-gray-50 text-center">
        <i data-lucide="activity" class="h-12 w-12 text-indigo-500 mx-auto"></i>
        <h4 class="mt-3 text-xl font-bold text-gray-800">No shared activity yet</h4>
        <p class="mt-2 text-gray-500">Generate learning work to get the feed moving.</p>
      </div>
    `;
  }

  return `
    <div class="space-y-4">
      ${state.feed.map(item => feedItemTemplate(item)).join('')}
    </div>
  `;
}

function feedItemTemplate(item) {
  const canTryTest = item.event_type === 'test_generated';
  const topic = item.activity_payload?.input_prompt?.prompt || item.event_summary || '';

  return `
    <div class="feed-line pl-10 relative">
      <div class="absolute left-0 top-0 h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center z-10">
        <i data-lucide="${feedIcon(item.event_type)}" class="h-4 w-4 text-indigo-600"></i>
      </div>

      <div class="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <p class="font-bold text-gray-800">${esc(item.event_title)}</p>
            <p class="text-sm text-gray-600 mt-1 clamp-2">${esc(item.event_summary || 'Learning activity')}</p>
          </div>
          <span class="text-xs text-gray-400 shrink-0">${esc(formatDateTime(item.created_at))}</span>
        </div>

        ${canTryTest ? `
          <button
            class="copy-test-topic-btn mt-3 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
            data-topic="${esc(topic)}">
            Copy test topic
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function feedIcon(type) {
  switch (type) {
    case 'test_generated': return 'clipboard-check';
    case 'test_completed': return 'check-circle';
    case 'math_help': return 'calculator';
    case 'homework_help': return 'life-buoy';
    case 'explanation_generated': return 'baby';
    default: return 'sparkles';
  }
}

function emptyGroupTemplate() {
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
            <button
              id="create-squad-btn"
              class="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-300">
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
            <button
              id="join-squad-btn"
              class="w-full py-2 px-4 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:bg-amber-300">
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
          <p class="text-sm text-gray-500">${esc(subtext)}</p>
          <p class="mt-1 text-2xl font-bold text-gray-800">${esc(value)}</p>
          <p class="mt-1 text-sm font-semibold text-gray-600">${esc(label)}</p>
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
      <h3 class="mt-3 font-bold text-gray-800">${esc(title)}</h3>
      <p class="mt-1 text-sm text-gray-600">${esc(text)}</p>
    </div>
  `;
}

function statRow(label, value, icon) {
  return `
    <div class="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50">
      <div class="flex items-center gap-3">
        <i data-lucide="${icon}" class="h-5 w-5 text-indigo-600"></i>
        <span class="text-sm font-semibold text-gray-700">${esc(label)}</span>
      </div>
      <span class="font-bold text-gray-900">${esc(value)}</span>
    </div>
  `;
}

function panelLoadingTemplate(text) {
  return `
    <div class="p-8 rounded-xl bg-gray-50 flex items-center justify-center min-h-[300px]">
      <div class="text-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="mt-3 text-gray-500 font-medium">${esc(text)}</p>
      </div>
    </div>
  `;
}

function bindCommonEvents() {
  const logoutBtn = document.getElementById('logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '/login.html';
    });
  }
}

function bindPremiumEvents() {
  const createForm = document.getElementById('create-squad-form');
  if (createForm) {
    createForm.addEventListener('submit', createSquad);
  }

  const joinForm = document.getElementById('join-squad-form');
  if (joinForm) {
    joinForm.addEventListener('submit', joinSquad);
  }

  const toggleCreate = document.getElementById('toggle-create-squad');
  const createPanel = document.getElementById('create-squad-panel');

  if (toggleCreate && createPanel) {
    toggleCreate.addEventListener('click', () => {
      createPanel.classList.toggle('hidden');
      document.getElementById('join-squad-panel')?.classList.add('hidden');
    });
  }

  const toggleJoin = document.getElementById('toggle-join-squad');
  const joinPanel = document.getElementById('join-squad-panel');

  if (toggleJoin && joinPanel) {
    toggleJoin.addEventListener('click', () => {
      joinPanel.classList.toggle('hidden');
      document.getElementById('create-squad-panel')?.classList.add('hidden');
    });
  }

  document.querySelectorAll('.group-select-btn').forEach(button => {
    button.addEventListener('click', () => selectGroup(button.dataset.groupId));
  });

  document.querySelectorAll('.squad-tab-btn').forEach(button => {
    button.addEventListener('click', () => setSquadTab(button.dataset.squadTab));
  });

  document.querySelectorAll('.leaderboard-mode-btn').forEach(button => {
    button.addEventListener('click', () => setLeaderboardMode(button.dataset.leaderboardMode));
  });

  const copyCodeBtn = document.getElementById('copy-code-btn');

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      copyText(copyCodeBtn.dataset.code, 'Squad code copied');
    });
  }

  const copyLinkBtn = document.getElementById('copy-link-btn');

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      copyText(copyLinkBtn.dataset.link, 'Invite link copied');
    });
  }

  document.querySelectorAll('.copy-test-topic-btn').forEach(button => {
    button.addEventListener('click', () => {
      copyText(button.dataset.topic || '', 'Test topic copied');
    });
  });
}

function renderQrIfNeeded() {
  const group = activeGroup();
  const qrEl = document.getElementById('qr-code');

  if (!group || !qrEl) return;

  const joinUrl = `${window.location.origin}/study-squads.html?code=${encodeURIComponent(group.invite_code)}`;
  qrEl.innerHTML = '';

  if (!window.QRCode || typeof window.QRCode.toCanvas !== 'function') {
    qrEl.innerHTML = `
      <div class="text-center text-xs text-gray-500">
        <p class="font-semibold">QR unavailable</p>
        <p class="mt-1">${esc(group.invite_code)}</p>
      </div>
    `;
    return;
  }

  window.QRCode.toCanvas(joinUrl, {
    width: 128,
    margin: 1
  }, (error, canvas) => {
    if (error) {
      console.warn('QR generation failed:', error);
      qrEl.innerHTML = `
        <div class="text-center text-xs text-gray-500">
          <p class="font-semibold">QR unavailable</p>
          <p class="mt-1">${esc(group.invite_code)}</p>
        </div>
      `;
      return;
    }

    qrEl.appendChild(canvas);
  });
}

async function autoJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (!code || !isPremiumUser()) return;

  try {
    const { data, error } = await supabaseClient.rpc('join_study_group_by_code', {
      p_invite_code: code.toUpperCase()
    });

    if (error) throw error;

    const joined = Array.isArray(data) ? data[0] : data;
    state.activeGroupId = joined?.id || state.activeGroupId;
    state.activeSquadTab = 'details';

    window.history.replaceState({}, document.title, '/study-squads.html');

    await loadGroups();

    showToast('Joined squad');
    render();
  } catch (error) {
    console.warn('Auto-join failed:', error);
    showToast('Could not join from code');
  }
}

init();
