const cfg = { url: 'https://yvoemqckgtmedfjudkzo.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0.tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo' };
const { createClient } = supabase;
const supabaseClient = createClient(cfg.url, cfg.key);
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const state = {
  session: null,
  centres: [],
  activeCentreId: null,
  learners: [],
  groups: [],
  memberships: [],
  activity: [],
  filters: { dateRangeDays: 30, groupId: 'all', subject: 'all', search: '' },
  loadingInsight: false,
  aiInsight: null
};

const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const ws = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const trunc = (v, n = 80) => { const t = ws(v); return !t ? '—' : t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const label = (v, n = 42) => { const t = ws(v); return !t || t === 'Unknown' ? '—' : trunc(t, n); };
const topic = (v, n = 90) => { const t = ws(v); return !t || t === 'Unknown' ? 'No topic tagged' : trunc(t, n); };
const fmtDate = (v) => !v ? 'Never' : new Intl.DateTimeFormat('en-ZA', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(v));
const daysAgo = (v) => !v ? null : Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
const countBy = (items, get) => items.reduce((a, x) => { const k = ws(get(x)) || 'Unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
const topEntries = (counts, limit = 5) => Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, limit);
const activeCentre = () => state.centres.find(c => String(c.id) === String(state.activeCentreId));
const learnerById = (id) => state.learners.find(l => Number(l.id) === Number(id));
const groupById = (id) => state.groups.find(g => Number(g.id) === Number(id));
const learnerGroups = (profileId) => state.groups.filter(g => state.memberships.some(m => Number(m.profile_id) === Number(profileId) && Number(m.tutor_group_id) === Number(g.id)));
const learnerActivities = (profileId) => state.activity.filter(a => Number(a.profile_id) === Number(profileId));

function filteredLearners() {
  const search = state.filters.search.trim().toLowerCase();
  const cutoff = new Date(Date.now() - state.filters.dateRangeDays * 86400000);
  return state.learners.filter(l => {
    const acts = learnerActivities(l.id).filter(a => new Date(a.created_at) >= cutoff);
    const matchesSearch = !search || l.name.toLowerCase().includes(search);
    const matchesGroup = state.filters.groupId === 'all' || learnerGroups(l.id).some(g => String(g.id) === String(state.filters.groupId));
    const matchesSubject = state.filters.subject === 'all' || acts.some(a => (a.subject || a.work_type || 'Unknown') === state.filters.subject);
    return matchesSearch && matchesGroup && matchesSubject;
  });
}

function visibleActivity() {
  const cutoff = new Date(Date.now() - state.filters.dateRangeDays * 86400000);
  const learnerIds = new Set(filteredLearners().map(l => Number(l.id)));
  return state.activity.filter(a => learnerIds.has(Number(a.profile_id)) && new Date(a.created_at) >= cutoff);
}

function summaryForLearner(learner) {
  const acts = learnerActivities(learner.id);
  const subjects = countBy(acts, a => a.subject || a.work_type);
  const topics = countBy(acts, a => a.topic);
  return { latest: acts[0]?.created_at || null, count: acts.length, topSubject: topEntries(subjects,1)[0]?.[0] || '—', topTopic: topEntries(topics,1)[0]?.[0] || '—' };
}

function buildLocalInsight() {
  const learners = filteredLearners();
  const acts = visibleActivity();
  const subjectTop = topEntries(countBy(acts, a => a.subject || a.work_type), 3);
  const topicTop = topEntries(countBy(acts, a => a.topic), 3);
  const inactive = learners.filter(l => { const d = daysAgo(summaryForLearner(l).latest); return d !== null && d >= 14; });
  const neverActive = learners.filter(l => !summaryForLearner(l).latest);
  return {
    summary: subjectTop.length ? `Most activity is around ${subjectTop.map(([n,c]) => `${label(n,35)} (${c})`).join(', ')}. Common topics include ${topicTop.map(([n,c]) => `${label(n,45)} (${c})`).join(', ') || 'limited tagged topics'}.` : 'There is not enough recent activity to identify useful patterns yet.',
    attention: [inactive.length ? `${inactive.length} learner${inactive.length === 1 ? '' : 's'} have not been active for at least 14 days.` : '', neverActive.length ? `${neverActive.length} learner${neverActive.length === 1 ? '' : 's'} have no saved activity yet.` : ''].filter(Boolean).concat(!inactive.length && !neverActive.length ? ['No major inactivity warning for the current filtered view.'] : []),
    suggestedActions: [subjectTop[0] ? `Plan a focused support session around ${label(subjectTop[0][0],45)}.` : 'Encourage learners to complete a few activities.', topicTop[0] ? `Review learners working repeatedly on ${label(topicTop[0][0],55)}.` : 'Improve topic tagging for richer reports.', 'Use groups to organise learners by grade, subject, or language.']
  };
}

function extractGeminiText(body) { return body?.candidates?.[0]?.content?.parts?.[0]?.text || ''; }
function parseJson(text) { try { return JSON.parse(text); } catch { return null; } }
function normaliseInsight(text) { const p = typeof text === 'string' ? parseJson(text) : text; return p && typeof p === 'object' ? p : { summary: text || 'No insight returned.', attention: [], suggestedActions: [] }; }

async function generateAiInsight() {
  state.loadingInsight = true; render();
  const learners = filteredLearners(); const acts = visibleActivity();
  const dataset = { date_range_days: state.filters.dateRangeDays, learner_count: learners.length, activity_count: acts.length, subjects: countBy(acts, a => a.subject || a.work_type), topics: countBy(acts, a => a.topic), learners: learners.map(l => ({ name:l.name, groups:learnerGroups(l.id).map(g=>g.name), ...summaryForLearner(l) })) };
  const prompt = `You are helping a tutor understand learner activity. Return valid JSON only with fields: summary, attention, suggestedActions. Keep summary under 120 words. Do not invent data. Summarise long topic strings into short labels. Dataset: ${JSON.stringify(dataset)}`;
  try {
    const res = await fetch('/.netlify/functions/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ requestType:'tutorInsight', prompt, isJson:true }) });
    const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Could not generate insight.');
    state.aiInsight = normaliseInsight(extractGeminiText(body));
  } catch (e) { state.aiInsight = { summary:`AI insight could not be generated: ${e.message}`, attention:[], suggestedActions:[] }; }
  finally { state.loadingInsight = false; render(); }
}

async function loadMemberships() {
  const { data, error } = await supabaseClient.from('tutor_centre_users').select('id,tutor_centre_id,role,status,tutor_centres(id,name,description,contact_email,status)').eq('status','active');
  if (error) throw error;
  state.centres = (data || []).map(r => ({ membershipId:r.id, role:r.role, ...r.tutor_centres })).filter(c => c && c.status === 'active');
  state.activeCentreId = state.activeCentreId || state.centres[0]?.id || null;
}

async function loadDashboard() {
  if (!state.activeCentreId) return;
  const [{data:assignments,error:ae},{data:groups,error:ge}] = await Promise.all([
    supabaseClient.from('tutor_centre_profiles').select('profile_id,status,profiles(id,name,avatar_key,grade,language,school)').eq('tutor_centre_id', state.activeCentreId).eq('status','active'),
    supabaseClient.from('tutor_groups').select('id,tutor_centre_id,name,group_type,description,created_at').eq('tutor_centre_id', state.activeCentreId).order('name')
  ]);
  if (ae) throw ae; if (ge) throw ge;
  state.learners = (assignments || []).map(a => a.profiles).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));
  state.groups = groups || [];
  const ids = state.learners.map(l => l.id);
  if (!ids.length) { state.activity = []; state.memberships = []; return; }
  const [{data:activity,error:acte},{data:memberships,error:me}] = await Promise.all([
    supabaseClient.from('saved_work').select('id,profile_id,work_type,subject,topic,language,metadata,input_prompt,output_content,created_at').in('profile_id', ids).order('created_at',{ascending:false}).limit(500),
    supabaseClient.from('tutor_group_profiles').select('id,tutor_group_id,profile_id,created_at').in('profile_id', ids)
  ]);
  if (acte) throw acte; if (me) throw me;
  state.activity = activity || []; state.memberships = memberships || [];
}

async function createGroup(event) {
  event.preventDefault();
  const name = document.getElementById('new-group-name').value.trim();
  const groupType = document.getElementById('new-group-type').value;
  const description = document.getElementById('new-group-description').value.trim();
  if (!name) return alert('Please enter a group name.');
  const { error } = await supabaseClient.from('tutor_groups').insert({ tutor_centre_id: state.activeCentreId, name, group_type: groupType, description, created_by: state.session.user.id });
  if (error) return alert(`Could not create group: ${error.message}`);
  await loadDashboard(); render();
}

async function deleteGroup(groupId) {
  const group = groupById(groupId);
  if (!group || !confirm(`Delete group "${group.name}"? Learners will not be deleted.`)) return;
  const { error } = await supabaseClient.from('tutor_groups').delete().eq('id', groupId);
  if (error) return alert(`Could not delete group: ${error.message}`);
  if (String(state.filters.groupId) === String(groupId)) state.filters.groupId = 'all';
  await loadDashboard(); render();
}

async function toggleLearnerGroup(profileId, groupId, checked) {
  if (checked) {
    const { error } = await supabaseClient.from('tutor_group_profiles').insert({ tutor_group_id: groupId, profile_id: profileId });
    if (error && !String(error.message).includes('duplicate')) return alert(`Could not add learner to group: ${error.message}`);
  } else {
    const { error } = await supabaseClient.from('tutor_group_profiles').delete().eq('tutor_group_id', groupId).eq('profile_id', profileId);
    if (error) return alert(`Could not remove learner from group: ${error.message}`);
  }
  await loadDashboard(); openLearner(profileId); render();
}

function renderLoading(msg='Loading Tutor Dashboard...') { app.innerHTML = `<div class="flex min-h-screen items-center justify-center"><div class="text-center"><div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div><p class="mt-4 text-gray-600">${esc(msg)}</p></div></div>`; }
function renderNoAccess() { app.innerHTML = `<div class="max-w-2xl mx-auto mt-16 bg-white p-8 rounded-xl shadow-xl text-center border-t-4 border-amber-400"><i data-lucide="graduation-cap" class="mx-auto h-14 w-14 text-amber-500"></i><h1 class="mt-4 text-3xl font-bold text-gray-800">Tutor View is not active for this account</h1><p class="mt-3 text-gray-600">This login is not linked to an active tutor centre.</p><a href="/app.html" class="inline-flex mt-6 bg-indigo-600 text-white font-semibold py-3 px-5 rounded-lg hover:bg-indigo-700">Back to LearnerGenie</a></div>`; lucide.createIcons(); }
function renderNotSignedIn() { app.innerHTML = `<div class="max-w-2xl mx-auto mt-16 bg-white p-8 rounded-xl shadow-xl text-center border-t-4 border-indigo-500"><i data-lucide="lock" class="mx-auto h-14 w-14 text-indigo-600"></i><h1 class="mt-4 text-3xl font-bold text-gray-800">Sign in first</h1><p class="mt-3 text-gray-600">Sign in through the main app, then open Tutor View again.</p><a href="/app.html" class="inline-flex mt-6 bg-indigo-600 text-white font-semibold py-3 px-5 rounded-lg hover:bg-indigo-700">Go to login</a></div>`; lucide.createIcons(); }
function renderError(e) { app.innerHTML = `<div class="max-w-2xl mx-auto mt-16 bg-white p-8 rounded-xl shadow-xl border-t-4 border-rose-500"><div class="flex items-center gap-3"><i data-lucide="alert-triangle" class="h-8 w-8 text-rose-500"></i><h1 class="text-2xl font-bold text-gray-800">Something went wrong</h1></div><p class="mt-4 text-gray-600">${esc(e.message || e)}</p><button id="retry-btn" class="mt-6 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700">Retry</button></div>`; document.getElementById('retry-btn')?.addEventListener('click', init); lucide.createIcons(); }

function metricCard(labelText, title, value, icon) { const raw = ws(value); return `<div class="bg-white rounded-xl shadow-lg p-5 border border-gray-100 min-h-[135px]"><div class="flex items-center justify-between"><p class="text-xs font-bold uppercase tracking-wide text-gray-500">${esc(labelText)}</p><i data-lucide="${icon}" class="h-5 w-5 text-indigo-500"></i></div><div class="mt-3 text-2xl font-bold text-gray-800 leading-tight clamp-2" title="${esc(raw)}">${esc(label(raw,34))}</div><p class="mt-2 text-sm text-gray-500">${esc(title)}</p></div>`; }

function render() {
  const centre = activeCentre(); const learners = filteredLearners(); const acts = visibleActivity();
  const subjects = topEntries(countBy(state.activity, a => a.subject || a.work_type), 20);
  const activeIds = new Set(acts.map(a => Number(a.profile_id)));
  const topSubject = topEntries(countBy(acts, a => a.subject || a.work_type), 1)[0]?.[0] || '—';
  const topTopic = topEntries(countBy(acts, a => a.topic), 1)[0]?.[0] || '—';
  const insight = state.aiInsight || buildLocalInsight();
  app.innerHTML = `<div class="max-w-7xl mx-auto space-y-6">
    <header class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500"><div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Tutor Dashboard</p><h1 class="text-3xl font-bold text-gray-800">${esc(centre?.name || 'Tutor Centre')}</h1><p class="text-gray-500 mt-1">View learners, activity, groups and tutor insights.</p></div><div class="flex flex-wrap gap-3">${state.centres.length>1?`<select id="centre-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white">${state.centres.map(c=>`<option value="${c.id}" ${String(c.id)===String(state.activeCentreId)?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}<a href="/app.html" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Learner App</a></div></div></header>
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">${metricCard('Users','Assigned learners',learners.length,'users')}${metricCard('Activity',`Active in last ${state.filters.dateRangeDays} days`,activeIds.size,'pulse')}${metricCard('Saved work','Activities in view',acts.length,'archive')}${metricCard('Top subject','Most used subject/tool',topSubject,'book-open')}${metricCard('Focus','Most common topic',label(topTopic,34),'target')}</section>
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6 border-t-4 border-amber-400"><div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><h2 class="text-2xl font-bold text-gray-800">Tutor Insight</h2><p class="text-gray-500 text-sm mt-1">A summary of what your assigned learners are working on.</p></div><button id="generate-ai-insight-btn" class="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:bg-amber-300" ${state.loadingInsight?'disabled':''}>${state.loadingInsight?'Generating...':'Generate AI insight'}</button></div><p class="mt-5 text-gray-700 leading-relaxed" title="${esc(insight.summary||'')}">${esc(trunc(insight.summary||'No insight available yet.',320))}</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5"><div class="bg-amber-50 rounded-lg p-4"><h3 class="font-bold text-gray-800 mb-2">Needs attention</h3><ul class="space-y-2 text-sm text-gray-700 list-disc pl-5">${(insight.attention||insight.suggested_actions||[]).slice(0,4).map(i=>`<li title="${esc(i)}">${esc(trunc(i,95))}</li>`).join('')||'<li>No attention items yet.</li>'}</ul></div><div class="bg-indigo-50 rounded-lg p-4"><h3 class="font-bold text-gray-800 mb-2">Suggested next steps</h3><ul class="space-y-2 text-sm text-gray-700 list-disc pl-5">${(insight.suggestedActions||insight.suggested_actions||[]).slice(0,4).map(i=>`<li title="${esc(i)}">${esc(trunc(i,95))}</li>`).join('')||'<li>Generate an AI insight for suggested actions.</li>'}</ul></div></div></div><div class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500"><h2 class="text-xl font-bold text-gray-800">Top subjects/tools</h2><div class="mt-4 space-y-3">${topEntries(countBy(acts,a=>a.subject||a.work_type),6).map(([n,c])=>`<div><div class="flex justify-between gap-3 text-sm font-medium text-gray-700"><span class="truncate" title="${esc(n)}">${esc(label(n,36))}</span><span>${c}</span></div><div class="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width:${Math.min(100,c/Math.max(1,acts.length)*100)}%"></div></div></div>`).join('')||'<p class="text-gray-500 text-sm">No activity in this view yet.</p>'}</div></div></section>
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6"><div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5"><div><h2 class="text-2xl font-bold text-gray-800">Learners</h2><p class="text-gray-500 text-sm">Showing ${learners.length} learner${learners.length===1?'':'s'}.</p></div><div class="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto"><input id="search-input" value="${esc(state.filters.search)}" class="px-3 py-2 border border-gray-300 rounded-lg" placeholder="Search learner"/><select id="date-range-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white">${[7,30,90,365].map(d=>`<option value="${d}" ${Number(state.filters.dateRangeDays)===d?'selected':''}>${d} days</option>`).join('')}</select><select id="group-filter-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="all">All groups</option>${state.groups.map(g=>`<option value="${g.id}" ${String(state.filters.groupId)===String(g.id)?'selected':''}>${esc(g.name)}</option>`).join('')}</select><select id="subject-filter-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="all">All subjects</option>${subjects.map(([s])=>`<option value="${esc(s)}" ${state.filters.subject===s?'selected':''}>${esc(label(s,35))}</option>`).join('')}</select></div></div><div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-100 table-fixed"><thead class="bg-gray-50"><tr><th class="w-1/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Learner</th><th class="w-1/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Groups</th><th class="w-[130px] px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Last active</th><th class="w-[100px] px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Activities</th><th class="w-2/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Focus</th></tr></thead><tbody>${learners.map(renderLearnerRow).join('')||'<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No learners match this view.</td></tr>'}</tbody></table></div></div><div class="bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Recent activity</h2><div class="mt-4 space-y-4 max-h-[620px] overflow-y-auto pr-2">${acts.slice(0,12).map(renderActivityItem).join('')||'<p class="text-gray-500 text-sm">No recent activity in this view.</p>'}</div></div></section>
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="xl:col-span-1 bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Create group</h2><form id="create-group-form" class="mt-4 space-y-3"><input id="new-group-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Group name e.g. Grade 6 Maths"/><select id="new-group-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="custom">Custom</option><option value="grade">Grade</option><option value="subject">Subject</option><option value="language">Language</option></select><textarea id="new-group-description" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" placeholder="Optional description"></textarea><button class="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700">Create group</button></form></div><div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Manage groups</h2><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">${state.groups.map(renderGroupCard).join('')||'<p class="text-gray-500 text-sm">No groups yet. Create your first group.</p>'}</div></div></section>
  </div>`;
  bindEvents(); lucide.createIcons();
}

function renderLearnerRow(l) { const s=summaryForLearner(l); const gs=learnerGroups(l.id); return `<tr class="hover:bg-indigo-50/40 cursor-pointer" data-open-learner="${l.id}"><td class="px-4 py-4 align-top"><div class="font-semibold text-gray-800 truncate">${esc(l.name)}</div><div class="text-xs text-gray-500 truncate">${[l.grade,l.language,l.school].filter(Boolean).map(esc).join(' · ')||'No learner metadata yet'}</div></td><td class="px-4 py-4 align-top"><div class="flex flex-wrap gap-1">${gs.slice(0,3).map(g=>`<span class="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">${esc(label(g.name,18))}</span>`).join('')||'<span class="text-gray-400 text-sm">No groups</span>'}</div></td><td class="px-4 py-4 align-top whitespace-nowrap text-sm text-gray-600">${fmtDate(s.latest)}</td><td class="px-4 py-4 align-top text-sm font-semibold text-gray-700">${s.count}</td><td class="px-4 py-4 align-top text-sm"><div class="font-medium truncate">${esc(label(s.topSubject,36))}</div><div class="text-xs text-gray-400 clamp-2">${esc(topic(s.topTopic,90))}</div></td></tr>`; }
function renderActivityItem(a) { const l=learnerById(a.profile_id); return `<button class="w-full text-left border-l-4 border-indigo-200 pl-4 py-1 hover:bg-indigo-50 rounded-r-lg" data-open-activity="${a.id}"><div class="flex items-start justify-between gap-3"><div class="min-w-0 flex-1"><p class="font-semibold text-gray-800 truncate">${esc(l?.name||'Learner')}</p><p class="text-sm text-gray-600"><span class="font-medium">${esc(label(a.subject||a.work_type,26))}</span><span class="text-gray-400"> · </span><span class="clamp-2">${esc(topic(a.topic,110))}</span></p></div><span class="text-xs text-gray-400 whitespace-nowrap">${fmtDate(a.created_at)}</span></div></button>`; }
function renderGroupCard(g) { const count=state.memberships.filter(m=>Number(m.tutor_group_id)===Number(g.id)).length; return `<div class="border border-gray-100 rounded-lg p-4"><div class="flex items-start justify-between gap-3"><div><h3 class="font-bold text-gray-800">${esc(g.name)}</h3><p class="text-xs uppercase tracking-wide text-indigo-600 font-semibold">${esc(g.group_type||'custom')}</p><p class="text-sm text-gray-500 mt-1 clamp-2">${esc(g.description||'No description')}</p><p class="text-sm text-gray-700 mt-2">${count} learner${count===1?'':'s'}</p></div><div class="flex flex-col gap-2"><button class="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold" data-filter-group="${g.id}">View</button><button class="text-xs px-3 py-1 rounded bg-rose-50 text-rose-700 font-semibold" data-delete-group="${g.id}">Delete</button></div></div></div>`; }

function bindEvents() {
  document.getElementById('centre-select')?.addEventListener('change', async e=>{state.activeCentreId=e.target.value;state.aiInsight=null;await loadDashboard();render();});
  document.getElementById('generate-ai-insight-btn')?.addEventListener('click',generateAiInsight);
  document.getElementById('search-input')?.addEventListener('input',e=>{state.filters.search=e.target.value;state.aiInsight=null;render();});
  document.getElementById('date-range-select')?.addEventListener('change',e=>{state.filters.dateRangeDays=Number(e.target.value);state.aiInsight=null;render();});
  document.getElementById('group-filter-select')?.addEventListener('change',e=>{state.filters.groupId=e.target.value;state.aiInsight=null;render();});
  document.getElementById('subject-filter-select')?.addEventListener('change',e=>{state.filters.subject=e.target.value;state.aiInsight=null;render();});
  document.getElementById('create-group-form')?.addEventListener('submit',createGroup);
  document.querySelectorAll('[data-open-learner]').forEach(el=>el.addEventListener('click',()=>openLearner(el.dataset.openLearner)));
  document.querySelectorAll('[data-open-activity]').forEach(el=>el.addEventListener('click',()=>openActivity(el.dataset.openActivity)));
  document.querySelectorAll('[data-filter-group]').forEach(el=>el.addEventListener('click',()=>{state.filters.groupId=el.dataset.filterGroup;render();}));
  document.querySelectorAll('[data-delete-group]').forEach(el=>el.addEventListener('click',()=>deleteGroup(el.dataset.deleteGroup)));
}

function openLearner(profileId) { const l=learnerById(profileId); if(!l) return; const acts=learnerActivities(profileId); const s=summaryForLearner(l); const current=new Set(learnerGroups(profileId).map(g=>Number(g.id))); modalRoot.innerHTML=`<div class="fixed inset-0 z-50 modal-backdrop flex justify-end"><div class="bg-white w-full max-w-3xl min-h-screen overflow-y-auto shadow-2xl"><div class="p-6 border-b flex justify-between gap-4"><div><p class="text-sm text-indigo-600 font-bold uppercase">Learner report</p><h2 class="text-3xl font-bold text-gray-800">${esc(l.name)}</h2><p class="text-gray-500">${[l.grade,l.language,l.school].filter(Boolean).map(esc).join(' · ')||'No learner metadata yet'}</p></div><button id="close-modal" class="h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><i data-lucide="x"></i></button></div><div class="p-6 space-y-6"><section class="grid grid-cols-2 md:grid-cols-4 gap-3"><div class="p-4 bg-indigo-50 rounded-lg"><p class="text-xs font-bold uppercase text-indigo-600">Activities</p><p class="text-2xl font-bold">${s.count}</p></div><div class="p-4 bg-indigo-50 rounded-lg"><p class="text-xs font-bold uppercase text-indigo-600">Last active</p><p class="font-bold">${fmtDate(s.latest)}</p></div><div class="p-4 bg-indigo-50 rounded-lg"><p class="text-xs font-bold uppercase text-indigo-600">Top subject</p><p class="font-bold clamp-2">${esc(label(s.topSubject,40))}</p></div><div class="p-4 bg-indigo-50 rounded-lg"><p class="text-xs font-bold uppercase text-indigo-600">Focus</p><p class="font-bold clamp-2">${esc(topic(s.topTopic,45))}</p></div></section><section><h3 class="text-xl font-bold text-gray-800">Group memberships</h3><p class="text-sm text-gray-500 mb-3">Tick groups to add or remove this learner.</p><div class="grid grid-cols-1 md:grid-cols-2 gap-2">${state.groups.map(g=>`<label class="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-indigo-50"><input type="checkbox" data-toggle-group="${g.id}" ${current.has(Number(g.id))?'checked':''}/><span class="font-medium text-gray-700">${esc(g.name)}</span></label>`).join('')||'<p class="text-gray-500">No groups created yet.</p>'}</div></section><section><h3 class="text-xl font-bold text-gray-800">Recent activity</h3><div class="mt-3 space-y-3">${acts.slice(0,30).map(a=>`<button class="w-full text-left p-4 rounded-lg border border-gray-100 hover:bg-indigo-50" data-open-activity="${a.id}"><div class="flex justify-between gap-3"><div><p class="font-semibold text-gray-800">${esc(label(a.subject||a.work_type,60))}</p><p class="text-sm text-gray-500 clamp-2">${esc(topic(a.topic,130))}</p></div><span class="text-xs text-gray-400 whitespace-nowrap">${fmtDate(a.created_at)}</span></div></button>`).join('')||'<p class="text-gray-500">No activity yet.</p>'}</div></section></div></div></div>`; document.getElementById('close-modal')?.addEventListener('click',closeModal); document.querySelectorAll('[data-toggle-group]').forEach(el=>el.addEventListener('change',()=>toggleLearnerGroup(profileId,el.dataset.toggleGroup,el.checked))); document.querySelectorAll('[data-open-activity]').forEach(el=>el.addEventListener('click',()=>openActivity(el.dataset.openActivity))); lucide.createIcons(); }
function valuePreview(v) { if(v==null) return '—'; if(typeof v==='string') return esc(v); return `<pre class="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-lg overflow-auto max-h-72">${esc(JSON.stringify(v,null,2))}</pre>`; }
function openActivity(activityId) { const a=state.activity.find(x=>Number(x.id)===Number(activityId)); if(!a) return; const l=learnerById(a.profile_id); modalRoot.innerHTML=`<div class="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"><div class="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"><div class="p-6 border-b flex justify-between gap-4"><div><p class="text-sm text-indigo-600 font-bold uppercase">Activity detail</p><h2 class="text-2xl font-bold text-gray-800">${esc(label(a.subject||a.work_type,80))}</h2><p class="text-gray-500">${esc(l?.name||'Learner')} · ${fmtDate(a.created_at)}</p></div><button id="close-modal" class="h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><i data-lucide="x"></i></button></div><div class="p-6 space-y-5"><div><h3 class="font-bold text-gray-800">Topic</h3><p class="text-gray-700 whitespace-pre-wrap">${esc(ws(a.topic)||'No topic tagged')}</p></div><div><h3 class="font-bold text-gray-800">Input</h3>${valuePreview(a.input_prompt)}</div><div><h3 class="font-bold text-gray-800">Output</h3>${valuePreview(a.output_content)}</div></div></div></div>`; document.getElementById('close-modal')?.addEventListener('click',closeModal); lucide.createIcons(); }
function closeModal(){ modalRoot.innerHTML=''; }

async function init(){ try{ renderLoading(); const {data,error}=await supabaseClient.auth.getSession(); if(error) throw error; state.session=data?.session||null; if(!state.session){renderNotSignedIn();return;} await loadMemberships(); if(!state.centres.length){renderNoAccess();return;} await loadDashboard(); render(); } catch(e){ renderError(e); } }
init();
