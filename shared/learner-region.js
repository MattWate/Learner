/* LearnerGenie - profile-driven educational context. */
(function () {
    const REGIONS = {
        US: {
            countryCode: 'US', countryName: 'United States', currency: 'USD', locale: 'en-US', mathsConvention: 'PEMDAS',
            englishStyle: 'American English',
            terminology: 'Use US school terminology: parentheses, exponents, slope, math, period, and grade-level language.',
            units: 'Use US customary units when a US school context naturally calls for them, while remaining comfortable with metric units and preserving units supplied by the learner.',
            curriculumGuidance: 'Use mainstream US grade-level expectations. For mathematics and English language arts/literacy, align broadly with Common Core where applicable. For science, social studies, and other subjects, use mainstream US grade-level conventions unless a specific state or curriculum standard is supplied.'
        },
        ZA: {
            countryCode: 'ZA', countryName: 'South Africa', currency: 'ZAR', locale: 'en-ZA', mathsConvention: 'BODMAS',
            englishStyle: 'South African/British English',
            terminology: 'Use South African school terminology and British English conventions: brackets, indices, gradient, maths, full stop, and grade-level language.',
            units: 'Use metric units and South African contextual examples where appropriate, while preserving units supplied by the learner.',
            curriculumGuidance: 'Use South African grade-level expectations and the learner’s selected curriculum, including CAPS or IEB where specified.'
        }
    };

    let activeProfile = null;
    let activeAccount = null;

    function normaliseCountry(profile, account) {
        const value = String(profile?.country_code || account?.country_code || account?.billing_region || 'ZA').toUpperCase();
        return value === 'US' ? 'US' : 'ZA';
    }

    function normaliseCurriculum(value, countryCode) {
        const raw = String(value || '').trim();
        if (!raw) return countryCode === 'US' ? 'US grade-level standards' : 'South African grade-level curriculum';
        const labels = {
            US_COMMON_CORE: 'Common Core', US_STATE: 'US state standards', US_HOMESCHOOL: 'US homeschool curriculum',
            CAPS: 'CAPS', IEB: 'IEB', CAMBRIDGE: 'Cambridge', OTHER: 'Other / specified curriculum'
        };
        return labels[raw] || raw.replace(/_/g, ' ');
    }

    function getContext(profile = activeProfile, account = activeAccount) {
        const countryCode = normaliseCountry(profile, account);
        const base = REGIONS[countryCode];
        const mathsConvention = String(profile?.maths_convention || base.mathsConvention).toUpperCase() === 'PEMDAS' ? 'PEMDAS' : 'BODMAS';
        const language = profile?.preferred_language || profile?.language || 'English';
        const locale = language === 'English' ? base.locale : language === 'Afrikaans' ? 'af-ZA' : language === 'Spanish' ? 'es-US' : base.locale;
        return {
            ...base,
            countryCode,
            grade: String(profile?.grade || '').trim(),
            curriculum: normaliseCurriculum(profile?.curriculum_code, countryCode),
            educationSystem: String(profile?.education_system || (countryCode === 'US' ? 'United States school system' : 'South African school system')),
            mathsConvention,
            language,
            locale
        };
    }

    function buildPromptContext(profile = activeProfile, account = activeAccount) {
        const c = getContext(profile, account);
        const gradeLine = c.grade ? `Grade: Grade ${c.grade}` : 'Grade: Use the learner age/level evident from the request';
        const languageInstruction = c.language === 'English'
            ? `Write learner-facing text in ${c.englishStyle}.`
            : `The learner's preferred language is ${c.language}. Use that language when the activity asks for it; otherwise preserve the requested output language.`;
        return `\n\nAUTHORITATIVE LEARNER CONTEXT\nCountry: ${c.countryName}\n${gradeLine}\nEducation system: ${c.educationSystem}\nCurriculum context: ${c.curriculum}\nMaths convention: ${c.mathsConvention}\nPreferred language: ${c.language}\nLocale: ${c.locale}\n\nRegional rules:\n- ${languageInstruction}\n- ${c.terminology}\n- ${c.units}\n- ${c.curriculumGuidance}\n- In arithmetic order-of-operations explanations, call the convention ${c.mathsConvention}.\n- Keep examples, currency, school vocabulary, spelling and cultural references natural for ${c.countryName}, unless the learner's question or uploaded material clearly uses another context.\n- Preserve facts, notation, names, quotations, source material and units supplied by the learner; localisation must not distort source content.\n- These learner-context rules override any generic regional defaults or conflicting UK/South African/US terminology elsewhere in the request.`;
    }

    function setProfile(profile, account) {
        activeProfile = profile || null;
        activeAccount = account || null;
        const context = getContext();
        document.documentElement.lang = context.locale;
        document.documentElement.dataset.learnerCountry = context.countryCode;
        document.documentElement.dataset.learnerLocale = context.locale;
        document.documentElement.dataset.mathsConvention = context.mathsConvention;
        window.dispatchEvent(new CustomEvent('learner-region-changed', { detail: context }));
        return context;
    }

    function getRegion() { return getContext(); }
    function getLocale() { return getContext().locale; }
    function getMathsConvention() { return getContext().mathsConvention; }

    window.LearnerRegion = { setProfile, getRegion, getContext, getLocale, getMathsConvention, buildPromptContext };
})();