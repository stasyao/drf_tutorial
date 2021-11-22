require([], function () {
    function scrollIntoActiveChapter() {
        var activeChapter = (document.getElementsByClassName('chapter active') || [])[0];
        if (!activeChapter) return;
        try {
            activeChapter.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest',
            });
        } catch (_) {}
    };

    window.addEventListener('load', scrollIntoActiveChapter);
});
