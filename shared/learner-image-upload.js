/*
 * LearnerGenie - shared image upload module
 *
 * Extracted from app.html's handleImageChange/handleRemoveImage, which
 * previously wrote into the global `state.uploadedImageBase64`. Here each
 * page gets its own isolated instance instead of a shared global.
 *
 * Markup expected on the page (same ids app.html already uses):
 *   <input id="image-upload" type="file" accept="image/*">
 *   <div id="image-preview-wrapper" class="hidden">
 *     <img id="image-preview">
 *     <button id="remove-image-btn">...</button>
 *   </div>
 */
(function () {
    /**
     * Wires up the upload/preview/remove elements on the current page.
     * Returns { getImageBase64(), clear() }.
     */
    function attach({
        inputId = 'image-upload',
        previewWrapperId = 'image-preview-wrapper',
        previewImgId = 'image-preview',
        removeButtonId = 'remove-image-btn'
    } = {}) {
        let imageBase64 = null;

        const input = document.getElementById(inputId);
        const previewWrapper = document.getElementById(previewWrapperId);
        const previewImg = document.getElementById(previewImgId);
        const removeBtn = document.getElementById(removeButtonId);

        function handleChange(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                imageBase64 = event.target.result.split(',')[1];
                if (previewImg) previewImg.src = event.target.result;
                if (previewWrapper) previewWrapper.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }

        function clear() {
            imageBase64 = null;
            if (previewWrapper) previewWrapper.classList.add('hidden');
            if (input) input.value = null;
        }

        if (input) input.addEventListener('change', handleChange);
        if (removeBtn) removeBtn.addEventListener('click', clear);

        return {
            getImageBase64: () => imageBase64,
            clear
        };
    }

    window.LearnerImageUpload = { attach };
})();
