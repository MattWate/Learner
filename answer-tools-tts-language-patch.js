/*
 * LearnerGenie Answer Tools TTS Language Patch
 *
 * Loaded after answer-tools.js, this marks translated answer sections with
 * the correct speech language so the existing Read Aloud buttons can request
 * a better browser voice, for example af-ZA for Afrikaans translations.
 */
(function () {
    function getTools() {
        return window.LearnerGenieAnswerTools;
    }

    function normalise(value) {
        return String(value || '').toLowerCase();
    }

    function getSpeechLangForLanguageCode(languageCode) {
        const code = normalise(languageCode);

        const speechLangs = {
            af: 'af-ZA',
            zu: 'zu-ZA',
            xh: 'xh-ZA',
            st: 'st-ZA',
            fr: 'fr-FR',
            pt: 'pt-PT',
            es: 'es-ES'
        };

        return speechLangs[code] || 'en-ZA';
    }

    function markProseElements(contentElement, speechLang) {
        if (!contentElement) return;

        const proseElements = Array.from(contentElement.querySelectorAll('.prose'));
        proseElements.forEach(element => {
            element.dataset.ttsLang = speechLang || 'en-ZA';
            element.setAttribute('lang', speechLang || 'en-ZA');
        });
    }

    function getElement(value) {
        return typeof value === 'string' ? document.querySelector(value) : value;
    }

    function installPatch() {
        const tools = getTools();
        if (!tools || typeof tools.createOutputToolbar !== 'function') return false;
        if (tools.__ttsLanguagePatchInstalled) return true;

        const originalCreateOutputToolbar = tools.createOutputToolbar;

        tools.getSpeechLangForLanguageCode = getSpeechLangForLanguageCode;
        tools.markProseElementsForTts = markProseElements;

        tools.createOutputToolbar = function patchedCreateOutputToolbar(options = {}) {
            const contentElement = getElement(options.contentElement);
            const originalOnViewChanged = options.onViewChanged;

            const patchedOptions = {
                ...options,
                onViewChanged(state) {
                    const currentView = state?.currentView || 'original';
                    const selectedLanguage = state?.selectedLanguage || options.defaultLanguage || 'af';
                    const speechLang = currentView === 'translated'
                        ? getSpeechLangForLanguageCode(selectedLanguage)
                        : 'en-ZA';

                    markProseElements(contentElement, speechLang);

                    if (typeof originalOnViewChanged === 'function') {
                        originalOnViewChanged(state);
                    }
                }
            };

            const toolbar = originalCreateOutputToolbar.call(this, patchedOptions);
            markProseElements(contentElement, 'en-ZA');
            return toolbar;
        };

        tools.__ttsLanguagePatchInstalled = true;
        return true;
    }

    if (!installPatch()) {
        document.addEventListener('DOMContentLoaded', installPatch, { once: true });
    }

    /*
     * Temporary profile-form hotfix.
     *
     * app.html currently calls createProfileTemplate() when an existing user
     * adds another learner. In the affected path that call renders undefined,
     * after which app.html attempts to attach a submit listener to a missing
     * #create-profile-form element. Capture the Add Profile action before the
     * broken handler, render the expected form, and attach the existing
     * handleCreateProfile function once per rendered form.
     */
    document.addEventListener('click', async function profileFormHotfix(event) {
        const addProfileButton = event.target.closest('#show-add-profile-btn');
        if (!addProfileButton) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        try {
            if (typeof supabaseClient === 'undefined' || typeof state === 'undefined' || !state.session?.user?.id) {
                console.error('Profile hotfix: account state is not available.');
                return;
            }

            const { count, error } = await supabaseClient
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('account_id', state.session.user.id);

            if (error) {
                console.error('Error checking profile count:', error);
                return;
            }

            const profileLimit = state.accountData?.profile_limit || 1;
            if ((count || 0) >= profileLimit) {
                if (typeof showPaywallModal === 'function') {
                    showPaywallModal('profiles');
                }
                return;
            }

            const appContainer = document.getElementById('app-container');
            if (!appContainer) {
                console.error('Profile hotfix: app container was not found.');
                return;
            }

            appContainer.innerHTML = `
                <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white p-4">
                    <div class="max-w-md w-full bg-white p-8 rounded-xl shadow-2xl">
                        <div class="text-center mb-8">
                            <i data-lucide="user-plus" class="h-14 w-14 text-indigo-600 mx-auto mb-4"></i>
                            <h1 class="text-3xl font-bold text-gray-800">Add learner profile</h1>
                            <p class="mt-2 text-gray-600">Add a new learner profile to this account.</p>
                        </div>
                        <form id="create-profile-form" class="space-y-5">
                            <div>
                                <label for="profile-name" class="block text-sm font-medium text-gray-700 mb-1">Learner name</label>
                                <input id="profile-name" name="profile-name" type="text" autocomplete="name" required
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter the learner's name">
                            </div>
                            <div id="profile-error" class="hidden text-sm text-red-600"></div>
                            <button id="create-profile-btn" type="submit"
                                class="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
                                Create Profile
                            </button>
                            <button id="cancel-add-profile-btn" type="button"
                                class="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200">
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>`;

            if (window.lucide?.createIcons) window.lucide.createIcons();

            const profileForm = document.getElementById('create-profile-form');
            if (!profileForm || typeof handleCreateProfile !== 'function') {
                console.error('Profile hotfix: profile form or submit handler was not available.');
                return;
            }

            profileForm.addEventListener('submit', handleCreateProfile);
            document.getElementById('profile-name')?.focus();

            document.getElementById('cancel-add-profile-btn')?.addEventListener('click', () => {
                if (typeof checkAccountStatus === 'function') {
                    checkAccountStatus();
                } else {
                    window.location.reload();
                }
            }, { once: true });
        } catch (error) {
            console.error('Profile hotfix failed:', error);
        }
    }, true);
})();
