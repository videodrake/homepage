(function () {
    'use strict';

    function setMeta(name, content, property) {
        if (!content) return;
        var selector = property ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
        var node = document.querySelector(selector);
        if (!node) {
            node = document.createElement('meta');
            node.setAttribute(property ? 'property' : 'name', name);
            document.head.appendChild(node);
        }
        node.setAttribute('content', content);
    }

    function setCanonical(url) {
        if (!url) return;
        var node = document.querySelector('link[rel="canonical"]');
        if (!node) {
            node = document.createElement('link');
            node.rel = 'canonical';
            document.head.appendChild(node);
        }
        node.href = url;
    }

    function applySeo(root) {
        if (!root) return;
        var title = root.getAttribute('data-seo-title');
        var description = root.getAttribute('data-seo-description');
        var canonical = root.getAttribute('data-seo-canonical');
        if (title) document.title = title;
        setMeta('description', description, false);
        setMeta('og:title', title, true);
        setMeta('og:description', description, true);
        setMeta('og:type', root.classList.contains('jv4-post') ? 'article' : 'website', true);
        setCanonical(canonical);
    }

    function initIndex(root) {
        var search = root.querySelector('[data-journal-search]');
        var filters = Array.prototype.slice.call(root.querySelectorAll('[data-journal-filter]'));
        var cards = Array.prototype.slice.call(root.querySelectorAll('[data-journal-card]'));
        var count = root.querySelector('[data-journal-count]');
        var empty = root.querySelector('[data-journal-empty]');
        var active = '전체';

        try {
            var requested = new URL(window.location.href).searchParams.get('topic');
            if (requested && filters.some(function (button) { return button.getAttribute('data-journal-filter') === requested; })) active = requested;
        } catch (ignore) {}

        function normalize(value) {
            return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        }

        function updateUrl() {
            try {
                var url = new URL(window.location.href);
                if (active === '전체') url.searchParams.delete('topic');
                else url.searchParams.set('topic', active);
                window.history.replaceState({}, '', url.pathname + url.search + url.hash);
            } catch (ignore) {}
        }

        function apply() {
            var query = normalize(search && search.value);
            var visible = 0;
            cards.forEach(function (card) {
                var category = card.getAttribute('data-category') || '';
                var haystack = normalize(card.textContent + ' ' + (card.getAttribute('data-keywords') || ''));
                var matchesTopic = active === '전체' || category === active;
                var matchesQuery = !query || haystack.indexOf(query) !== -1;
                var show = matchesTopic && matchesQuery;
                card.hidden = !show;
                if (show) visible += 1;
            });
            filters.forEach(function (button) {
                var selected = button.getAttribute('data-journal-filter') === active;
                button.classList.toggle('is-active', selected);
                button.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
            if (count) count.textContent = visible + '개의 질문';
            if (empty) empty.classList.toggle('is-visible', visible === 0);
        }

        filters.forEach(function (button) {
            button.addEventListener('click', function () {
                active = button.getAttribute('data-journal-filter') || '전체';
                updateUrl();
                apply();
                var library = root.querySelector('#journalLibrary');
                if (button.hasAttribute('data-journal-path') && library) library.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
        if (search) search.addEventListener('input', apply);
        apply();
    }

    function initPost(root) {
        var article = root.querySelector('[data-journal-article]');
        var toc = root.querySelector('[data-journal-toc]');
        var progress = root.querySelector('[data-reading-progress]');
        var share = root.querySelector('[data-journal-share]');
        var headings = article ? Array.prototype.slice.call(article.querySelectorAll('h2')) : [];

        if (toc && headings.length) {
            headings.forEach(function (heading, index) {
                if (!heading.id) heading.id = 'section-' + (index + 1);
                var link = document.createElement('a');
                link.href = '#' + heading.id;
                link.textContent = heading.textContent;
                toc.appendChild(link);
            });
        } else if (toc) {
            toc.parentElement.hidden = true;
        }

        function updateProgress() {
            if (!progress) return;
            var doc = document.documentElement;
            var max = Math.max(1, doc.scrollHeight - window.innerHeight);
            progress.style.width = Math.min(100, Math.max(0, window.scrollY / max * 100)) + '%';
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();

        if (share) {
            share.addEventListener('click', function () {
                var payload = { title: document.title, text: root.getAttribute('data-seo-description') || '', url: window.location.href };
                if (navigator.share) {
                    navigator.share(payload).catch(function () {});
                    return;
                }
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href).then(function () {
                        var original = share.textContent;
                        share.textContent = '링크 복사됨';
                        window.setTimeout(function () { share.textContent = original; }, 1600);
                    });
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var index = document.querySelector('.jv4-index');
        var post = document.querySelector('.jv4-post');
        applySeo(index || post);
        if (index) initIndex(index);
        if (post) initPost(post);
    });
})();
