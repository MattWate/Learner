state.activeTab = state.activeTab || 'overview';

function tabButton(id, text, icon) {
  const active = state.activeTab === id;
  return `<button data-tab="${id}" class="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition ${active ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-indigo-50'}"><i data-lucide="${icon}" class="h-4 w-4"></i>${text}</button>`;
}

function renderFilterControls(subjects) {
  return `<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
    <input id="search-input" value="${esc(state.filters.search)}" class="px-3 py-2 border border-gray-300 rounded-lg" placeholder="Search learner" />
    <select id="date-range-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white">${[7,30,90,365].map(d => `<option value="${d}" ${Number(state.filters.dateRangeDays)===d?'selected':''}>Last ${d} days</option>`).join('')}</select>
    <select id="group-filter-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="all">All groups</option>${state.groups.map(g => `<option value="${g.id}" ${String(state.filters.groupId)===String(g.id)?'selected':''}>${esc(g.name)}</option>`).join('')}</select>
    <select id="subject-filter-select" class="px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="all">All subjects</option>${subjects.map(([s]) => `<option value="${esc(s)}" ${state.filters.subject===s?'selected':''}>${esc(label(s,35))}</option>`).join('')}</select>
  </div>`;
}

function renderOverviewTab(acts, insight) {
  return `<section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
    <div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6 border-t-4 border-amber-400">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div><h2 class="text-2xl font-bold text-gray-800">Tutor Insight</h2><p class="text-gray-500 text-sm mt-1">A quick read on what is happening across your learners.</p></div>
        <button id="generate-ai-insight-btn" class="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:bg-amber-300" ${state.loadingInsight?'disabled':''}>${state.loadingInsight?'Generating...':'Generate AI insight'}</button>
      </div>
      <p class="mt-5 text-gray-700 leading-relaxed" title="${esc(insight.summary||'')}">${esc(trunc(insight.summary||'No insight available yet.',320))}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div class="bg-amber-50 rounded-lg p-4"><h3 class="font-bold text-gray-800 mb-2">Needs attention</h3><ul class="space-y-2 text-sm text-gray-700 list-disc pl-5">${(insight.attention||insight.suggested_actions||[]).slice(0,4).map(i=>`<li title="${esc(i)}">${esc(trunc(i,95))}</li>`).join('')||'<li>No attention items yet.</li>'}</ul></div>
        <div class="bg-indigo-50 rounded-lg p-4"><h3 class="font-bold text-gray-800 mb-2">Suggested next steps</h3><ul class="space-y-2 text-sm text-gray-700 list-disc pl-5">${(insight.suggestedActions||insight.suggested_actions||[]).slice(0,4).map(i=>`<li title="${esc(i)}">${esc(trunc(i,95))}</li>`).join('')||'<li>Generate an AI insight for suggested actions.</li>'}</ul></div>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500"><h2 class="text-xl font-bold text-gray-800">Top subjects/tools</h2><div class="mt-4 space-y-3">${topEntries(countBy(acts,a=>a.subject||a.work_type),6).map(([n,c])=>`<div><div class="flex justify-between gap-3 text-sm font-medium text-gray-700"><span class="truncate" title="${esc(n)}">${esc(label(n,36))}</span><span>${c}</span></div><div class="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width:${Math.min(100,c/Math.max(1,acts.length)*100)}%"></div></div></div>`).join('')||'<p class="text-gray-500 text-sm">No activity in this view yet.</p>'}</div></div>
    <div class="xl:col-span-3 bg-white rounded-xl shadow-lg p-6"><div class="flex items-center justify-between"><h2 class="text-2xl font-bold text-gray-800">Recent activity</h2><button data-tab="activity" class="text-indigo-600 font-semibold hover:text-indigo-800">View all</button></div><div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">${acts.slice(0,6).map(renderActivityItem).join('')||'<p class="text-gray-500 text-sm">No recent activity in this view.</p>'}</div></div>
  </section>`;
}

function renderLearnersTab(learners, subjects) {
  return `<section class="bg-white rounded-xl shadow-lg p-6"><div class="flex flex-col gap-4 mb-5"><div><h2 class="text-2xl font-bold text-gray-800">Learners</h2><p class="text-gray-500 text-sm">Search, filter, and click a learner for a full drill-down.</p></div>${renderFilterControls(subjects)}</div><div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-100 table-fixed"><thead class="bg-gray-50"><tr><th class="w-1/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Learner</th><th class="w-1/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Groups</th><th class="w-[130px] px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Last active</th><th class="w-[100px] px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Activities</th><th class="w-2/5 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Focus</th></tr></thead><tbody>${learners.map(renderLearnerRow).join('')||'<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No learners match this view.</td></tr>'}</tbody></table></div></section>`;
}

function renderGroupsTab() {
  return `<section class="grid grid-cols-1 xl:grid-cols-3 gap-6"><div class="xl:col-span-1 bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Create group</h2><p class="text-sm text-gray-500 mt-1">Create groups by grade, subject, language, or any custom category.</p><form id="create-group-form" class="mt-4 space-y-3"><input id="new-group-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Group name e.g. Grade 6 Maths"/><select id="new-group-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"><option value="custom">Custom</option><option value="grade">Grade</option><option value="subject">Subject</option><option value="language">Language</option></select><textarea id="new-group-description" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" placeholder="Optional description"></textarea><button class="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700">Create group</button></form></div><div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Manage groups</h2><p class="text-sm text-gray-500 mt-1">View, filter, or delete groups. Add learners to groups from the learner drill-down.</p><div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">${state.groups.map(renderGroupCard).join('')||'<p class="text-gray-500 text-sm">No groups yet. Create your first group.</p>'}</div></div></section>`;
}

function renderActivityTab(acts, subjects) {
  return `<section class="bg-white rounded-xl shadow-lg p-6"><div class="flex flex-col gap-4 mb-5"><div><h2 class="text-2xl font-bold text-gray-800">Activity</h2><p class="text-gray-500 text-sm">Browse learner activity and open any item for readable detail.</p></div>${renderFilterControls(subjects)}</div><div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${acts.map(renderActivityItem).join('')||'<p class="text-gray-500 text-sm">No activity in this view.</p>'}</div></section>`;
}

function renderThemesTab(acts, insight) {
  const topicRows = topEntries(countBy(acts,a=>a.topic),10);
  const subjectRows = topEntries(countBy(acts,a=>a.subject||a.work_type),10);
  return `<section class="grid grid-cols-1 xl:grid-cols-2 gap-6"><div class="bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Subject overview</h2><div class="mt-4 space-y-3">${subjectRows.map(([n,c])=>`<div><div class="flex justify-between text-sm font-semibold text-gray-700"><span title="${esc(n)}">${esc(label(n,60))}</span><span>${c}</span></div><div class="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width:${Math.min(100,c/Math.max(1,acts.length)*100)}%"></div></div></div>`).join('')||'<p class="text-gray-500">No subject data yet.</p>'}</div></div><div class="bg-white rounded-xl shadow-lg p-6"><h2 class="text-2xl font-bold text-gray-800">Theme overview</h2><p class="text-sm text-gray-500 mt-1">Common tagged topics and recurring work areas.</p><div class="mt-4 space-y-3">${topicRows.map(([n,c])=>`<div class="p-3 rounded-lg bg-gray-50"><div class="flex justify-between gap-3"><p class="font-semibold text-gray-800 clamp-2" title="${esc(n)}">${esc(label(n,90))}</p><span class="text-sm font-bold text-indigo-600">${c}</span></div></div>`).join('')||'<p class="text-gray-500">No topic data yet.</p>'}</div></div><div class="xl:col-span-2 bg-white rounded-xl shadow-lg p-6 border-t-4 border-amber-400"><h2 class="text-2xl font-bold text-gray-800">AI theme summary</h2><p class="mt-3 text-gray-700">${esc(trunc(insight.summary||'Generate an AI insight from the Overview tab to build this summary.',400))}</p></div></section>`;
}

function renderTabbedDashboard() {
  const centre = activeCentre(); const learners = filteredLearners(); const acts = visibleActivity();
  const subjects = topEntries(countBy(state.activity, a => a.subject || a.work_type), 20);
  const activeIds = new Set(acts.map(a => Number(a.profile_id)));
  const topSubject = topEntries(countBy(acts, a => a.subject || a.work_type), 1)[0]?.[0] || '—';
  const topTopic = topEntries(countBy(acts, a => a.topic), 1)[0]?.[0] || '—';
  const insight = state.aiInsight || buildLocalInsight();
  const tabContent = state.activeTab === 'learners' ? renderLearnersTab(learners, subjects) : state.activeTab === 'groups' ? renderGroupsTab() : state.activeTab === 'activity' ? renderActivityTab(acts, subjects) : state.activeTab === 'themes' ? renderThemesTab(acts, insight) : renderOverviewTab(acts, insight);
  app.innerHTML = `<div class="max-w-7xl mx-auto space-y-6"><header class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500"><div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Tutor Dashboard</p><h1 class="text-3xl font-bold text-gray-800">${esc(centre?.name || 'Tutor Centre')}</h1><p class="text-gray-500 mt-1">View learners, groups, activity, and themes.</p></div><a href="/app.html" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 w-fit">Learner App</a></div></header><section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">${metricCard('Users','Assigned learners',learners.length,'users')}${metricCard('Activity',`Active in last ${state.filters.dateRangeDays} days`,activeIds.size,'pulse')}${metricCard('Saved work','Activities in view',acts.length,'archive')}${metricCard('Top subject','Most used subject/tool',topSubject,'book-open')}${metricCard('Focus','Most common topic',label(topTopic,34),'target')}</section><nav class="flex flex-wrap gap-2 p-2 bg-indigo-50 rounded-xl">${tabButton('overview','Overview','layout-dashboard')}${tabButton('learners','Learners','users')}${tabButton('groups','Groups','folder-tree')}${tabButton('activity','Activity','history')}${tabButton('themes','Theme Overview','sparkles')}</nav>${tabContent}</div>`;
  bindTabbedEvents(); lucide.createIcons();
}

function bindTabbedEvents() {
  document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{state.activeTab=el.dataset.tab;render();}));
  bindEvents();
}

render = renderTabbedDashboard;
render();
