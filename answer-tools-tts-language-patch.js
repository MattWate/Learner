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
})();
