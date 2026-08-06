/* Shared LearnerGenie authenticated app shell. */
(function () {
    const NAV_ITEMS = [
        { group: 'LEARN', label: 'Home', icon: 'house', path: '/app.html', key: 'home' },
        { group: 'LEARN', label: 'Homework Helper', icon: 'life-buoy', path: '/activities/homework-help.html', key: 'homework' },
        { group: 'LEARN', label: 'Explain It Simply', icon: 'lightbulb', path: '/activities/explain-simply.html', key: 'explain' },
        { group: 'LEARN', label: 'Revision Notes', icon: 'book-open-check', path: '/activities/learning-hub.html', key: 'revision' },
        { group: 'LEARN', label: 'Practice Test', icon: 'clipboard-check', path: '/activities/test-builder.html', key: 'test' },
        { group: 'LEARN', label: 'Mathematics', icon: 'calculator', path: '/activities/math-hub.html', key: 'math' },
        { group: 'PROGRESS', label: 'Activity History', icon: 'history', path: '/activities/activity-history.html', key: 'history' },
        { group: 'PROGRESS', label: 'Study Squads', icon: 'users-round', path: '/study-squads.html', key: 'squads' }
    ];

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function profileLink(path) {
        if (!window.LearnerAuth?.withProfileId) return path;
        const hashIndex = path.indexOf('#');
        if (hashIndex === -1) return window.LearnerAuth.withProfileId(path);
        const base = path.slice(0, hashIndex);
        return `${window.LearnerAuth.withProfileId(base)}${path.slice(hashIndex)}`;
    }

    function navHtml(activeKey) {
        let group = '';
        return NAV_ITEMS.map(item => {
            const heading = item.group !== group ? `<div class="lg-nav-label">${item.group}</div>` : '';
            group = item.group;
            const active = item.key === activeKey;
            return `${heading}<a class="lg-nav-link${active ? ' is-active' : ''}" href="${profileLink(item.path)}"><i data-lucide="${item.icon}" width="18"></i><span>${item.label}</span>${active ? '<span class="lg-active-dot"></span>' : ''}</a>`;
        }).join('');
    }

    function accountLabel(account) {
        const tier = account?.active_tier || 'free';
        return tier === 'free' ? 'Free plan' : `${tier} plan`;
    }

    function render(options) {
        const root = options.root;
        const profile = options.profile || {};
        const account = options.account || {};
        const profileName = profile.name || 'Learner';
        const gradeText = profile.grade ? `Grade ${escapeHtml(profile.grade)} learner` : 'Learner profile';
        const initial = profileName.trim().charAt(0).toUpperCase() || 'L';
        const title = options.mobileTitle || options.title || 'LearnerGenie';

        root.innerHTML = `<div class="lg-mobile-overlay" data-lg-close-menu></div><div class="lg-app">
            <aside class="lg-sidebar" aria-label="Main navigation">
                <a class="lg-brand" href="${profileLink('/app.html')}"><img src="/logo.svg" alt="LearnerGenie"><div><strong class="lg-brand-font">LearnerGenie</strong><span>Learning workspace</span></div></a>
                <div class="lg-learner-card"><div class="lg-avatar">${escapeHtml(initial)}</div><div class="lg-learner-meta"><strong>${escapeHtml(profileName)}</strong><span>${gradeText}</span></div><a class="lg-profile-link" href="/app.html" title="Switch learner" aria-label="Switch learner"><i data-lucide="chevrons-up-down" width="17"></i></a></div>
                <nav class="lg-nav">${navHtml(options.activeKey)}</nav>
                <div class="lg-sidebar-bottom"><div class="lg-plan-card"><strong>${escapeHtml(accountLabel(account))}</strong><span>Learner profile active</span></div><nav class="lg-nav"><a class="lg-nav-link" href="${profileLink('/app.html#settings')}"><i data-lucide="settings" width="18"></i><span>Settings</span></a><button class="lg-nav-link" id="lg-sign-out" type="button" style="width:100%;border:0;background:transparent;text-align:left;cursor:pointer;"><i data-lucide="log-out" width="18"></i><span>Sign out</span></button></nav></div>
            </aside>
            <main class="lg-main"><header class="lg-mobile-header"><div class="lg-mobile-brand"><img src="/logo.svg" alt=""><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(profileName)}'s workspace</span></div></div><button class="lg-menu-button" type="button" data-lg-open-menu aria-label="Open navigation"><i data-lucide="menu"></i></button></header>${options.content}</main>
        </div>`;

        root.querySelector('[data-lg-open-menu]')?.addEventListener('click', () => document.body.classList.add('lg-menu-open'));
        root.querySelectorAll('[data-lg-close-menu]').forEach(el => el.addEventListener('click', () => document.body.classList.remove('lg-menu-open')));
        root.querySelectorAll('.lg-nav-link').forEach(link => link.addEventListener('click', () => document.body.classList.remove('lg-menu-open')));
        root.querySelector('#lg-sign-out')?.addEventListener('click', () => window.LearnerAuth.signOut());
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    window.LearnerShell = { render, profileLink };
})();