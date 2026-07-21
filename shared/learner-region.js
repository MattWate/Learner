/*
 * LearnerGenie - region module (placeholder)
 *
 * This is a stub so activity pages can start reading region info from one
 * place instead of hardcoding it. Right now it just returns a fixed South
 * Africa default that matches what app.html and generate.js already assume
 * (ZAR pricing, en-ZA/af-ZA voices, UK/South African curricula in the
 * system prompt).
 *
 * This is NOT wired up to real geolocation, localised pricing, or curriculum
 * selection yet - that's future work. Nothing currently depends on this file
 * behaving dynamically.
 */
(function () {
    const DEFAULT_REGION = {
        countryCode: 'ZA',
        currency: 'ZAR',
        curriculum: 'CAPS', // South African Curriculum and Assessment Policy Statement
        locale: 'en-ZA'
    };

    function getRegion() {
        // TODO: replace with real geolocation + account-level override once
        // that work starts. For now every caller gets the same default.
        return { ...DEFAULT_REGION };
    }

    window.LearnerRegion = {
        getRegion
    };
})();
