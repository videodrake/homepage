(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    ready(function () {
        var burger = document.getElementById('orv2Burger');
        var nav = document.getElementById('orv2Nav');

        function closeMenu() {
            if (!burger || !nav) return;
            burger.setAttribute('aria-expanded', 'false');
            burger.setAttribute('aria-label', '메뉴 열기');
            nav.classList.remove('is-open');
            document.body.classList.remove('orv2-menu-open');
        }

        if (burger && nav) {
            burger.addEventListener('click', function () {
                var open = burger.getAttribute('aria-expanded') !== 'true';
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
                burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
                nav.classList.toggle('is-open', open);
                document.body.classList.toggle('orv2-menu-open', open);
            });

            nav.addEventListener('click', function (event) {
                if (event.target.closest('a')) closeMenu();
            });

            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeMenu();
            });

            window.addEventListener('resize', function () {
                if (window.innerWidth > 900) closeMenu();
            });
        }

        if (document.body.classList.contains('onroad-detail')) {
            var info = document.querySelector('.onroad-product-detail-page .infoArea');
            var action = document.querySelector('.onroad-product-detail-page .productAction');
            if (info && action) {
                var bar = document.createElement('div');
                bar.className = 'orv2-mobile-buy';
                bar.setAttribute('aria-label', '모바일 구매 메뉴');
                bar.innerHTML = '<button type="button">구매 옵션 보기</button><a href="/order/basket.html">장바구니</a>';
                bar.querySelector('button').addEventListener('click', function () {
                    info.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.setTimeout(function () {
                        var firstControl = info.querySelector('select, input, .btnSubmit');
                        if (firstControl && typeof firstControl.focus === 'function') firstControl.focus({ preventScroll: true });
                    }, 450);
                });
                document.body.appendChild(bar);
            }
        }

        var liveProduct = document.querySelector('.orv2-product-live');
        if (liveProduct && !liveProduct.querySelector('img')) {
            var card = liveProduct.closest('.orv2-hero__product');
            if (card) card.classList.add('is-image-pending');
        }

        document.documentElement.classList.add('orv2-ready');
    });
})();
