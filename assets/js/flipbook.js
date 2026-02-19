jQuery(document).ready(function ($) {
    'use strict';

    // Configuración global
    const CONFIG = {
        resizeDebounce: 150,
        loadingTimeout: 10000,
        librariesCheckAttempts: 50,
        breakpoints: {
            mobile: 480,
            tablet: 768,
            desktop: 1024
        }
    };

    // Inicializar todos los flipbooks — pequeño delay para que el DOM esté pintado
    $('.fbw-flipbook-wrapper').each(function () {
        var $w = $(this);
        setTimeout(function() { initFlipbook($w); }, 50);
    });

    // 
    // INICIALIZACIÓN
    // 
    function initFlipbook($wrapper) {
        var pdfUrl = $wrapper.data('pdf-url');
        var baseWidth = parseInt($wrapper.data('width')) || 450;
        var baseHeight = parseInt($wrapper.data('height')) || 600;

        if (!pdfUrl) {
            showError($wrapper, 'URL del PDF no válida');
            return;
        }

        waitForLibraries(
            function () {
                loadPdfFromUrl($wrapper, pdfUrl, baseWidth, baseHeight);
            },
            function () {
                showError($wrapper, typeof pdfjsLib === 'undefined'
                    ? 'Error: PDF.js no cargó.'
                    : 'Error: StPageFlip no cargó.');
            }
        );
    }

    function waitForLibraries(onReady, onTimeout) {
        var attempts = 0;
        var maxAttempts = CONFIG.librariesCheckAttempts;

        var interval = setInterval(function () {
            if (typeof pdfjsLib !== 'undefined' &&
                typeof St !== 'undefined' &&
                typeof St.PageFlip !== 'undefined') {
                clearInterval(interval);
                onReady();
            } else if (++attempts >= maxAttempts) {
                clearInterval(interval);
                onTimeout();
            }
        }, 100);

        setTimeout(function() {
            clearInterval(interval);
        }, CONFIG.loadingTimeout);
    }

    // 
    // DIMENSIONES RESPONSIVAS
    // 
    function getResponsiveDimensions($wrapper, baseW, baseH) {
        var windowWidth  = window.innerWidth;
        var windowHeight = window.innerHeight;

        var $container   = $wrapper.closest('.fbw-flipbook-container');
        var containerWidth = $container[0] ? $container[0].getBoundingClientRect().width : 0;
        if (!containerWidth) containerWidth = $container.width() || 0;
        if (!containerWidth) containerWidth = windowWidth;

        var isMobile = windowWidth <= CONFIG.breakpoints.mobile;
        var isTablet = windowWidth > CONFIG.breakpoints.mobile && windowWidth <= CONFIG.breakpoints.tablet;
        var isSingle = windowWidth <= CONFIG.breakpoints.tablet;

        var aspectRatio = baseH / baseW;
        var pageWidth, pageHeight;

        if (isSingle) {
            var sidePad = isMobile ? 12 : 20;
            pageWidth   = Math.floor(Math.min(containerWidth, windowWidth) - sidePad * 2);
            pageWidth   = Math.max(pageWidth, 200);
            pageHeight  = Math.round(pageWidth * aspectRatio);

            var maxH = Math.round(windowHeight * 0.75);
            if (pageHeight > maxH) {
                pageHeight = maxH;
                pageWidth  = Math.round(pageHeight / aspectRatio);
            }
        } else {
            var availW = Math.min(containerWidth - 120, baseW * 2);
            pageWidth  = Math.floor(Math.min(availW / 2, baseW));
            pageHeight = Math.round(pageWidth * aspectRatio);

            var maxHd = Math.round(windowHeight * 0.80);
            if (pageHeight > maxHd) {
                pageHeight = maxHd;
                pageWidth  = Math.round(pageHeight / aspectRatio);
            }
        }

        var bookWidth  = isSingle ? pageWidth : pageWidth * 2;
        var bookHeight = pageHeight;

        return {
            isSingle:       isSingle,
            isMobile:       isMobile,
            isTablet:       isTablet,
            pageWidth:      pageWidth,
            pageHeight:     pageHeight,
            bookWidth:      bookWidth,
            bookHeight:     bookHeight,
            containerWidth: containerWidth,
            windowHeight:   windowHeight
        };
    }

    // 
    // CARGA DE PDF
    // 
    function loadPdfFromUrl($wrapper, pdfUrl, baseWidth, baseHeight) {
        var dimensions = getResponsiveDimensions($wrapper, baseWidth, baseHeight);

        var loadingTask = pdfjsLib.getDocument({
            url: pdfUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            isEvalSupported: false,
            useSystemFonts: true,
            disableAutoFetch: true,
            disableStream: false,
            httpHeaders: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/pdf'
            }
        });

        loadingTask.promise.then(function (pdf) {
            var total = pdf.numPages;
            $wrapper.closest('.fbw-flipbook-container').find('.total-pages').text(total);

            renderInitialPages(pdf, total, dimensions.pageWidth, dimensions.pageHeight)
                .then(function (images) {
                    createFlipbook($wrapper, images, dimensions, total, pdf);
                })
                .catch(function (e) {
                    console.error('Error rendering pages:', e);
                    showError($wrapper, 'Error al procesar páginas.');
                });
        }).catch(function (e) {
            console.error('PDF loading error:', e);
            showError($wrapper, handlePdfError(e));
        });
    }

    function handlePdfError(error) {
        if (error.name === 'MissingPDFException')    return 'El PDF no existe en esa URL.';
        if (error.name === 'InvalidPDFException')    return 'El archivo no es un PDF válido.';
        if (error.name === 'UnknownErrorException')  return 'No se pudo leer el PDF (protegido o problema CORS).';
        if (error.name === 'PasswordException')      return 'El PDF está protegido con contraseña.';
        if (error.message && error.message.includes('404')) return 'PDF no encontrado (Error 404).';
        return 'Error al cargar el PDF: ' + (error.message || 'error desconocido');
    }

    // 
    // RENDER DE PÁGINAS
    // 
    function renderInitialPages(pdf, total, w, h) {
        return new Promise(function (resolve) {
            var images = Array(total).fill(null);
            var first  = Math.min(3, total);
            var promises = [];

            for (var i = 1; i <= first; i++) {
                (function (pageNum) {
                    promises.push(
                        renderPage(pdf, pageNum, w, h, 0.82)
                            .then(function (data) { images[pageNum - 1] = data; })
                    );
                })(i);
            }

            Promise.all(promises).then(function () { resolve(images); });
        });
    }

    function renderPage(pdf, num, targetWidth, targetHeight, quality) {
        quality = quality || 0.85;

        return pdf.getPage(num).then(function (page) {
            var viewport = page.getViewport({ scale: 1 });
            var scale    = Math.min(targetWidth / viewport.width, targetHeight / viewport.height);
            var scaledViewport = page.getViewport({ scale: scale });

            var canvas  = document.createElement('canvas');
            canvas.width  = scaledViewport.width;
            canvas.height = scaledViewport.height;

            var context = canvas.getContext('2d', { alpha: false, antialias: true });

            return page.render({
                canvasContext: context,
                viewport:      scaledViewport,
                intent:        'display',
                annotationMode: 0
            }).promise.then(function () {
                return canvas.toDataURL('image/jpeg', quality);
            });
        });
    }

    // 
    // CREACIÓN DEL FLIPBOOK
    // 
    function createFlipbook($wrapper, pageImages, dimensions, total, pdf) {
        var containerId = $wrapper.attr('id') + '_spf_' + Date.now();

        $wrapper.empty();

        // ── book-row ──────────────────────────────────────────
        var $bookRow = $('<div>', { class: 'fbw-book-row' });

        var $zoomWrap = $('<div>', { class: 'fbw-zoom-wrap' }).css({
            width: dimensions.bookWidth + 'px', height: dimensions.bookHeight + 'px',
            position: 'relative', flexShrink: '0'
        });

        var $shiftWrap = $('<div>', { class: 'fbw-shift-wrap' }).css({
            width: dimensions.bookWidth + 'px', height: dimensions.bookHeight + 'px',
            position: 'relative'
        });

        var $flipContainer = $('<div>', { id: containerId, class: 'fbw-spf-container' }).css({
            width: dimensions.bookWidth + 'px', height: dimensions.bookHeight + 'px',
            position: 'relative'
        });

        $shiftWrap.append($flipContainer);
        $zoomWrap.append($shiftWrap);

        // Botones laterales (solo desktop)
        var $prevSide = $('<button>', { class: 'fbw-prev fbw-btn-side', title: 'Página anterior' })
            .html(SVG_ICONS.prev);
        var $nextSide = $('<button>', { class: 'fbw-next fbw-btn-side', title: 'Página siguiente' })
            .html(SVG_ICONS.next);

        $bookRow.append($prevSide, $zoomWrap, $nextSide);

        // ── Toolbar inferior ──────────────────────────────────
        var $toolbar = buildToolbar(total);
        $wrapper.append($bookRow, $toolbar);

        // ── Páginas ───────────────────────────────────────────
        pageImages.forEach(function (imgData, index) {
            var $page = $('<div>', {
                class: 'fbw-page-container',
                'data-page': index + 1,
                'data-loaded': imgData ? 'true' : 'false'
            });

            if (imgData) {
                $page.append($('<img>', { src: imgData, alt: 'Página ' + (index + 1), loading: 'lazy' }));
                renderAnnotationLayer(pdf, index + 1, dimensions.pageWidth, dimensions.pageHeight, $page);
            } else {
                $page.append($('<div>', { class: 'fbw-page-placeholder' }));
            }

            $flipContainer.append($page);
        });

        // ── StPageFlip ────────────────────────────────────────
        var pageFlip;
        try {
            pageFlip = new St.PageFlip(document.getElementById(containerId), {
                width:               dimensions.pageWidth,
                height:              dimensions.pageHeight,
                size:                'fixed',
                minWidth:            dimensions.pageWidth,
                maxWidth:            dimensions.pageWidth,
                minHeight:           dimensions.pageHeight,
                maxHeight:           dimensions.pageHeight,
                drawShadow:          !dimensions.isMobile,
                flippingTime:        dimensions.isMobile ? 350 : 600,
                usePortrait:         dimensions.isSingle,
                startPage:           0,
                autoSize:            false,
                maxShadowOpacity:    0.4,
                showCover:           true,
                mobileScrollSupport: false,
                disableFlipByClick:  true,
                clickEventForward:   false,
                useMouseEvents:      !dimensions.isSingle,
                swipeDistance:       9999,
                showPageCorners:     false,
                showNavigation:      false
            });

            pageFlip.loadFromHTML(document.querySelectorAll('#' + containerId + ' .fbw-page-container'));
            pageFlip.on('init', function() {
                document.querySelectorAll('.stf__btn, .stf__control, [class*="stf__arrow"]')
                    .forEach(function(el) { el.remove(); });

                if (!dimensions.isSingle) {
                    setupCornerHint(containerId, pageFlip, dimensions);
                }
            });
        } catch (e) {
            console.error('Error creating flipbook:', e);
            showError($wrapper, 'Error al crear el flipbook.');
            return;
        }

        // Guardar referencias
        $wrapper.data('pageFlip',   pageFlip);
        $wrapper.data('dimensions', dimensions);
        $wrapper.data('pdf',        pdf);
        $wrapper.data('zoomWrap',   $zoomWrap);
        $wrapper.data('shiftWrap',  $shiftWrap);

        // Setup de todas las features
        var $zoomBtn = $toolbar.find('.fbw-zoom-btn');
        setupFlipbookFeatures($wrapper, pageFlip, dimensions, total, pdf, $zoomWrap, $shiftWrap, $flipContainer, $zoomBtn);
        setupToolbarControls($wrapper, $toolbar, pageFlip, total, dimensions);
        setupThumbnails($wrapper, $toolbar, pageFlip, pdf, total, dimensions);

        // Loading out
        $wrapper.find('.fbw-loading').fadeOut(300, function() { $(this).remove(); });
        $wrapper.removeClass('loading');

        // Mostrar libro
        setTimeout(function () {
            $flipContainer.addClass('ready');
            $wrapper.closest('.fbw-flipbook-container').find('.fbw-page-info-wrapper').addClass('ready');
            updateToolbar($toolbar, 1, total);
            setCoverShift($shiftWrap, dimensions, true, false);
        }, 300);

        // ── Eventos StPageFlip ────────────────────────────────
        pageFlip.on('changeState', function (e) {
            if (e.data === 'flipping') resetZoom($zoomWrap);
            // Resincronizar toolbar tras cualquier cambio de estado
            var currentIdx = pageFlip.getCurrentPageIndex();
            if (typeof currentIdx === 'number') {
                updateToolbar($toolbar, currentIdx + 1, total);
            }
        });

        pageFlip.on('flip', function (e) {
            var pageIndex   = e.data;
            var displayPage = pageIndex + 1;
            setCoverShift($shiftWrap, dimensions, pageIndex === 0, true);
            updateToolbar($toolbar, displayPage, total);
            lazyLoadPages(pageFlip, pageIndex, pdf, dimensions.pageWidth, dimensions.pageHeight, total, $flipContainer);
        });
    }

    // 
    // TOOLBAR — construcción del DOM
    // 
    var SVG_ICONS = {
        first:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="19 20 9 12 19 4"/><line x1="5" y1="4" x2="5" y2="20"/></svg>',
        prev:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
        next:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        last:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 20 15 12 5 4"/><line x1="19" y1="4" x2="19" y2="20"/></svg>',
        zoomIn:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        zoomOut:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        fullscreen: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
        thumbs:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
    };

    function buildToolbar(total) {
        var $toolbar = $('<div>', { class: 'fbw-toolbar' });

        // ── Botones mobile prev/next ───────────────────────────
        // CLAVE: usan clases propias (fbw-nav-prev / fbw-nav-next) en lugar de
        // fbw-prev / fbw-next, para que updateToolbar() NUNCA los deshabilite.
        var $prevBot = $('<button>', { class: 'fbw-btn-bottom fbw-toolbar-nav fbw-nav-prev', title: 'Anterior' })
            .html(SVG_ICONS.prev);
        var $nextBot = $('<button>', { class: 'fbw-btn-bottom fbw-toolbar-nav fbw-nav-next', title: 'Siguiente' })
            .html(SVG_ICONS.next);

        // ── Grupo navegación desktop ──────────────────────────
        var $navGroup = $('<div>', { class: 'fbw-toolbar-group fbw-nav-group' });

        var $firstBtn = $('<button>', { class: 'fbw-first-btn fbw-tbr-btn', title: 'Primera página' })
            .html(SVG_ICONS.first);
        var $prevBtn  = $('<button>', { class: 'fbw-prev fbw-tbr-btn', title: 'Página anterior' })
            .html(SVG_ICONS.prev);

        var $pageInput = $('<input>', {
            type: 'number', class: 'fbw-page-input',
            min: 1, max: total, val: 1,
            'aria-label': 'Página actual'
        });
        var $pageSep   = $('<span>', { class: 'fbw-page-sep', text: '/' });
        var $pageTotal = $('<span>', { class: 'fbw-page-total', text: total });
        var $pageDisplay = $('<div>', { class: 'fbw-page-display' })
            .append($pageInput, $pageSep, $pageTotal);

        var $nextBtn = $('<button>', { class: 'fbw-next fbw-tbr-btn', title: 'Página siguiente' })
            .html(SVG_ICONS.next);
        var $lastBtn = $('<button>', { class: 'fbw-last-btn fbw-tbr-btn', title: 'Última página' })
            .html(SVG_ICONS.last);

        $navGroup.append($firstBtn, $prevBtn, $pageDisplay, $nextBtn, $lastBtn);

        var $divider = $('<div>', { class: 'fbw-toolbar-divider' });

        var $actGroup = $('<div>', { class: 'fbw-toolbar-group fbw-act-group' });

        var $zoomBtn  = $('<button>', { class: 'fbw-zoom-btn fbw-tbr-btn', title: 'Ampliar' })
            .html(SVG_ICONS.zoomIn);
        var $fullBtn  = $('<button>', { class: 'fbw-full-btn fbw-tbr-btn', title: 'Pantalla completa' })
            .html(SVG_ICONS.fullscreen);
        var $thumbBtn = $('<button>', { class: 'fbw-thumb-btn fbw-tbr-btn', title: 'Miniaturas' })
            .html(SVG_ICONS.thumbs);

        $actGroup.append($thumbBtn, $zoomBtn, $fullBtn);

        $toolbar.append($prevBot, $navGroup, $divider, $actGroup, $nextBot);

        return $toolbar;
    }

    // 
    // TOOLBAR — controles e interacción
    // 
    function setupToolbarControls($wrapper, $toolbar, pageFlip, total, dimensions) {
        var $pageInput = $toolbar.find('.fbw-page-input');

        $toolbar.find('.fbw-first-btn').on('click', function() {
            if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
            pageFlip.flip(0);
            $(this).blur();
        });

        $toolbar.find('.fbw-last-btn').on('click', function() {
            if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
            pageFlip.flip(total - 1);
            $(this).blur();
        });

        var navigating = false;

        $pageInput.on('keydown', function(e) {
            if (e.key !== 'Enter') return;
            navigating = true;
            goToPage($wrapper, pageFlip, parseInt($(this).val()), total);
            $(this).blur();
            setTimeout(function() { navigating = false; }, 300);
        });

        $pageInput.on('blur', function() {
            if (navigating) return;
            var p = parseInt($(this).val());
            if (!isNaN(p)) {
                goToPage($wrapper, pageFlip, p, total);
            } else {
                $(this).val(pageFlip.getCurrentPageIndex() + 1);
            }
        });

        $pageInput.on('wheel', function(e) { e.preventDefault(); });

        $toolbar.find('.fbw-full-btn').on('click', function() {
            var el = $wrapper.closest('.fbw-flipbook-container')[0];
            if (!document.fullscreenElement) {
                el.requestFullscreen && el.requestFullscreen();
            } else {
                document.exitFullscreen && document.exitFullscreen();
            }
            $(this).blur();
        });

        document.addEventListener('fullscreenchange', function() {
            var $container = $wrapper.closest('.fbw-flipbook-container');
            if (document.fullscreenElement) {
                $container.css({
                    'display': 'flex', 'flex-direction': 'column',
                    'align-items': 'center', 'justify-content': 'center',
                    'height': '100vh', 'width': '100vw',
                    'padding': '0', 'margin': '0',
                    'background': '#1a1a1a', 'box-sizing': 'border-box'
                });
                $toolbar.find('.fbw-full-btn').html(
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                    '<polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/>' +
                    '<polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></svg>'
                ).attr('title', 'Salir de pantalla completa');
            } else {
                $container.css({
                    'display': '', 'flex-direction': '', 'align-items': 'flex-start',
                    'justify-content': 'center', 'height': '', 'width': '',
                    'padding': '', 'margin': '', 'background': '', 'box-sizing': ''
                });
                $toolbar.find('.fbw-full-btn').html(SVG_ICONS.fullscreen)
                    .attr('title', 'Pantalla completa');
            }
        });

        applyToolbarLayout($toolbar, dimensions);
    }

    function applyToolbarLayout($toolbar, dimensions) {
        if (dimensions.isSingle) {
            $toolbar.find('.fbw-toolbar-nav').css('display', 'flex');
            $toolbar.find('.fbw-first-btn, .fbw-last-btn').hide();
            $toolbar.find('.fbw-toolbar-divider').hide();
        } else {
            $toolbar.find('.fbw-toolbar-nav').hide();
            $toolbar.find('.fbw-first-btn, .fbw-last-btn').css('display', 'flex');
            $toolbar.find('.fbw-toolbar-divider').css('display', 'block');
        }
    }

    function goToPage($wrapper, pageFlip, page, total) {
        if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }

        var dimensions = $wrapper.data('dimensions');
        var p   = Math.max(1, Math.min(total, page || 1));
        var idx = p - 1;

        if (dimensions && !dimensions.isSingle && idx > 0) {
            if (idx % 2 === 0) idx = idx - 1;
        }

        pageFlip.flip(idx);
    }

    function updateToolbar($toolbar, currentPage, total) {
        $toolbar.find('.fbw-page-input').val(currentPage);
        $toolbar.find('.fbw-page-total').text(total);

        // Solo deshabilita botones desktop (.fbw-prev / .fbw-next).
        // Los botones mobile (.fbw-nav-prev / .fbw-nav-next) NO tienen esas clases
        // y nunca quedan bloqueados por este disabled.
        var atFirst = currentPage <= 1;
        var atLast  = currentPage >= total;
        $toolbar.find('.fbw-prev, .fbw-first-btn').prop('disabled', atFirst);
        $toolbar.find('.fbw-next, .fbw-last-btn').prop('disabled', atLast);
    }

    // 
    // CORNER HINT
    // 
    function setupCornerHint(containerId, pageFlip, dimensions) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var CORNER_ZONE = 80;
        var hintActive  = false;
        var hintCorner  = null;

        if (typeof pageFlip.flipCorner !== 'function') return;

        container.addEventListener('mousemove', function(e) {
            if (zoomState.scale > 1) {
                if (hintActive) {
                    try { pageFlip.closeCorner(); } catch(err) {}
                    hintActive = false; hintCorner = null;
                }
                return;
            }

            var rect = container.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var w = rect.width;
            var h = rect.height;

            var nearBottom = y > h - CORNER_ZONE;
            var nearLeft   = x < CORNER_ZONE;
            var nearRight  = x > w - CORNER_ZONE;

            var corner = null;
            if (nearBottom && nearLeft)  corner = 'bl';
            if (nearBottom && nearRight) corner = 'br';

            if (corner && corner !== hintCorner) {
                try {
                    if (corner === 'bl') pageFlip.flipCorner('bottom', 'left');
                    if (corner === 'br') pageFlip.flipCorner('bottom', 'right');
                    hintActive = true;
                    hintCorner = corner;
                } catch(err) {}
            } else if (!corner && hintActive) {
                try { pageFlip.closeCorner(); } catch(err) {}
                hintActive = false;
                hintCorner = null;
            }
        });

        container.addEventListener('mouseleave', function() {
            if (hintActive) {
                try { pageFlip.closeCorner(); } catch(err) {}
                hintActive = false;
                hintCorner = null;
            }
        });
    }

    // 
    // THUMBNAILS
    // 
    function setupThumbnails($wrapper, $toolbar, pageFlip, pdf, total, dimensions) {
        var THUMB_W    = 90;
        var THUMB_H    = Math.round(THUMB_W * (dimensions.pageHeight / dimensions.pageWidth));
        var thumbCache = {};

        var $overlay = $('<div>', { class: 'fbw-thumb-overlay' });
        var $panel   = $('<div>', { class: 'fbw-thumb-panel' });
        var $header  = $('<div>', { class: 'fbw-thumb-header' })
            .append(
                $('<span>', { class: 'fbw-thumb-title', text: 'Páginas' }),
                $('<button>', { class: 'fbw-thumb-close', html: '&times;', title: 'Cerrar' })
            );
        var $grid = $('<div>', { class: 'fbw-thumb-grid' });
        $panel.append($header, $grid);

        $('body').append($overlay, $panel);

        for (var i = 1; i <= total; i++) {
            (function(pageNum) {
                var $item = $('<div>', { class: 'fbw-thumb-item', 'data-page': pageNum });
                var $img  = $('<div>', { class: 'fbw-thumb-img' });
                var $lbl  = $('<span>', { class: 'fbw-thumb-label', text: pageNum });
                $item.append($img, $lbl);
                $item.on('click', function() {
                    goToPage($wrapper, pageFlip, pageNum, total);
                    closeThumbPanel();
                });
                $grid.append($item);
            })(i);
        }

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                var $item   = $(entry.target);
                var pageNum = parseInt($item.data('page'));
                var $img    = $item.find('.fbw-thumb-img');
                if ($img.hasClass('loaded') || $img.hasClass('loading')) return;
                $img.addClass('loading');

                if (thumbCache[pageNum]) {
                    applyThumb($img, thumbCache[pageNum]);
                    observer.unobserve(entry.target);
                    return;
                }

                renderPage(pdf, pageNum, THUMB_W, THUMB_H, 0.5)
                    .then(function(dataUrl) {
                        thumbCache[pageNum] = dataUrl;
                        applyThumb($img, dataUrl);
                        observer.unobserve(entry.target);
                    })
                    .catch(function() { $img.removeClass('loading').addClass('error'); });
            });
        }, { root: $grid[0], rootMargin: '200px 0px', threshold: 0 });

        $grid.find('.fbw-thumb-item').each(function() { observer.observe(this); });

        function applyThumb($img, dataUrl) {
            $img.removeClass('loading').addClass('loaded')
                .css('background-image', 'url(' + dataUrl + ')');
        }

        function highlightActive(pageNum) {
            $grid.find('.fbw-thumb-item').removeClass('active');
            $grid.find('[data-page="' + pageNum + '"]').addClass('active');
        }

        function scrollToPage(pageNum) {
            var $active = $grid.find('[data-page="' + pageNum + '"]');
            if ($active.length) {
                $grid[0].scrollTop = $active[0].offsetTop
                    - ($grid[0].clientHeight / 2)
                    + ($active[0].offsetHeight / 2);
            }
        }

        pageFlip.on('flip', function(e) {
            var pg = e.data + 1;
            highlightActive(pg);
            if ($panel.hasClass('open')) scrollToPage(pg);
        });

        function openThumbPanel() {
            $panel.addClass('open');
            $overlay.addClass('visible');
            $toolbar.find('.fbw-thumb-btn').addClass('active');
            var currentPage = parseInt($toolbar.find('.fbw-page-input').val()) || 1;
            highlightActive(currentPage);
            setTimeout(function() { scrollToPage(currentPage); }, 60);
        }

        function closeThumbPanel() {
            $panel.removeClass('open');
            $overlay.removeClass('visible');
            $toolbar.find('.fbw-thumb-btn').removeClass('active');
        }

        $toolbar.find('.fbw-thumb-btn').on('click', function() {
            $panel.hasClass('open') ? closeThumbPanel() : openThumbPanel();
        });
        $panel.find('.fbw-thumb-close').on('click', function() { closeThumbPanel(); });
        $overlay.on('click', function() { closeThumbPanel(); });
    }

    function setupFlipbookFeatures($wrapper, pageFlip, dimensions, total, pdf, $zoomWrap, $shiftWrap, $container, $zoomBtn) {
        setupControls($wrapper, pageFlip, total, dimensions);
        setupResizeHandler($wrapper, pageFlip, dimensions, total, pdf, $shiftWrap, $container, $zoomWrap);
        setupZoom($wrapper, pageFlip, $zoomWrap, $container, dimensions, $zoomBtn);
        setupLazyLoading($wrapper, pageFlip, pdf, dimensions, total, $container);
    }

    // 
    // CONTROLES (laterales + teclado + swipe + mobile toolbar)
    // 
    function setupControls($wrapper, pageFlip, total, dimensions) {
        // Botones laterales desktop
        if (dimensions.isSingle) {
            $wrapper.find('.fbw-btn-side').hide();
        } else {
            $wrapper.find('.fbw-btn-side').css('display', 'flex');
        }

        // Botones desktop: .fbw-prev / .fbw-next (side + tbr-btn del navGroup)
        $wrapper.find('.fbw-prev').off('click.flipbook').on('click.flipbook', function() {
            if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
            pageFlip.flipPrev();
            $(this).blur();
        });

        $wrapper.find('.fbw-next').off('click.flipbook').on('click.flipbook', function() {
            if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
            pageFlip.flipNext();
            $(this).blur();
        });

        // ── Botones mobile .fbw-nav-prev / .fbw-nav-next ──────
        // Nunca disabled. Usamos touchstart para respuesta inmediata en iOS.
        var $navPrev = $wrapper.find('.fbw-nav-prev');
        var $navNext = $wrapper.find('.fbw-nav-next');

        $navPrev.off('touchstart.flipmobile click.flipmobile')
            .on('touchstart.flipmobile', function(e) {
                e.preventDefault(); // evita el click fantasma de 300ms en iOS
                if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
                pageFlip.flipPrev();
                $(this).blur();
            })
            .on('click.flipmobile', function() {
                // fallback para emuladores o navegadores sin touch
                if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
                pageFlip.flipPrev();
                $(this).blur();
            });

        $navNext.off('touchstart.flipmobile click.flipmobile')
            .on('touchstart.flipmobile', function(e) {
                e.preventDefault();
                if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
                pageFlip.flipNext();
                $(this).blur();
            })
            .on('click.flipmobile', function() {
                if (zoomState.scale > 1) { resetZoom($wrapper.data('zoomWrap')); return; }
                pageFlip.flipNext();
                $(this).blur();
            });

        // Teclado (solo desktop)
        if (!dimensions.isSingle) {
            $(document).off('keydown.flipbook').on('keydown.flipbook', function (e) {
                if (!$wrapper.is(':visible')) return;
                if ($(document.activeElement).hasClass('fbw-page-input')) return;
                if (e.key === 'ArrowLeft')  { pageFlip.flipPrev(); e.preventDefault(); }
                if (e.key === 'ArrowRight') { pageFlip.flipNext(); e.preventDefault(); }
            });
        }

        // Swipe táctil
        if (dimensions.isSingle) {
            setupSwipe($wrapper, pageFlip);
        }
    }

    function setupSwipe($wrapper, pageFlip) {
        var touchStartX = 0, touchStartY = 0;
        var minSwipeDistance = 50;

        $wrapper.on('touchstart.swipe', function(e) {
            touchStartX = e.originalEvent.touches[0].clientX;
            touchStartY = e.originalEvent.touches[0].clientY;
        });

        $wrapper.on('touchend.swipe', function(e) {
            if (zoomState.scale > 1) return;
            var touchEndX  = e.originalEvent.changedTouches[0].clientX;
            var touchEndY  = e.originalEvent.changedTouches[0].clientY;
            var distanceX  = touchEndX - touchStartX;
            var distanceY  = Math.abs(touchEndY - touchStartY);

            if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY) {
                distanceX > 0 ? pageFlip.flipPrev() : pageFlip.flipNext();
            }
        });
    }

    // 
    // RESIZE HANDLER
    // 
    function setupResizeHandler($wrapper, pageFlip, currentDimensions, total, pdf, $shiftWrap, $container, $zoomWrap) {
        var resizeTimer;
        var baseWidth  = parseInt($wrapper.data('width'))  || 450;
        var baseHeight = parseInt($wrapper.data('height')) || 600;

        $(window).on('resize.flipbook', function () {
            clearTimeout(resizeTimer);

            resizeTimer = setTimeout(function () {
                var newDimensions = getResponsiveDimensions($wrapper, baseWidth, baseHeight);

                if (newDimensions.bookWidth  === currentDimensions.bookWidth &&
                    newDimensions.bookHeight === currentDimensions.bookHeight &&
                    newDimensions.isSingle   === currentDimensions.isSingle) return;

                $wrapper.data('dimensions', newDimensions);

                var newBookCss = { width: newDimensions.bookWidth + 'px', height: newDimensions.bookHeight + 'px' };
                $zoomWrap.css(newBookCss);
                $shiftWrap.css(newBookCss);
                $container.css(newBookCss);

                try {
                    pageFlip.update({
                        width:       newDimensions.pageWidth,
                        height:      newDimensions.pageHeight,
                        usePortrait: newDimensions.isSingle
                    });

                    if (newDimensions.isSingle) {
                        $wrapper.find('.fbw-btn-side').hide();
                    } else {
                        $wrapper.find('.fbw-btn-side').css('display', 'flex');
                    }

                    var $toolbar = $wrapper.find('.fbw-toolbar');
                    applyToolbarLayout($toolbar, newDimensions);

                    var currentPage = pageFlip.getCurrentPageIndex() + 1;
                    pageFlip.flip(currentPage - 1);

                    

                    setCoverShift($shiftWrap, newDimensions, currentPage === 0, false);
                    resetZoom($zoomWrap);

                    currentDimensions = newDimensions;
                } catch (e) {
                    console.warn('Error updating flipbook on resize:', e);
                }
            }, CONFIG.resizeDebounce);
        });
    }

    // 
    // ZOOM
    // 
    var zoomState = { scale: 1, tx: 0, ty: 0, maxScale: 3, minScale: 1 };

    function setupZoom($wrapper, pageFlip, $zoomWrap, $container, dimensions, $zoomBtn) {
        var zoomWrapEl = $zoomWrap[0];

        $zoomBtn.on('click', function() {
            var isZoomed = toggleZoom($zoomWrap, $zoomWrap.width() / 2, $zoomWrap.height() / 2);
            updateZoomBtn($zoomBtn, isZoomed);
            toggleZoomInteraction($zoomWrap, isZoomed);
        });

        if (!dimensions.isSingle) {
            $zoomWrap.on('dblclick', function(e) {
                var offset = $zoomWrap.offset();
                var isZoomed = toggleZoom($zoomWrap, e.pageX - offset.left, e.pageY - offset.top);
                updateZoomBtn($zoomBtn, isZoomed);
                toggleZoomInteraction($zoomWrap, isZoomed);
                e.preventDefault(); e.stopPropagation();
            });

            zoomWrapEl.addEventListener('wheel', function(e) {
                e.preventDefault();
                var rect = zoomWrapEl.getBoundingClientRect();
                if (e.deltaY < 0 && zoomState.scale === 1) {
                    var isZoomed = toggleZoom($zoomWrap, e.clientX - rect.left, e.clientY - rect.top);
                    updateZoomBtn($zoomBtn, isZoomed);
                    toggleZoomInteraction($zoomWrap, isZoomed);
                } else if (e.deltaY > 0 && zoomState.scale > 1) {
                    resetZoom($zoomWrap);
                    updateZoomBtn($zoomBtn, false);
                }
            }, { passive: false });
        }

        setupDragPan($zoomWrap, $zoomBtn);

        if (dimensions.isSingle) {
            setupPinchZoom($zoomWrap, $zoomBtn);
        }
    }

    function toggleZoomInteraction($zoomWrap, isZoomed) {
        isZoomed ? $zoomWrap.addClass('zoomed') : $zoomWrap.removeClass('zoomed');
    }

    function setupPinchZoom($zoomWrap, $zoomBtn) {
        var zoomWrapEl = $zoomWrap[0];
        var pinchState = { active: false, startDist: 0, startScale: 1, startMidX: 0, startMidY: 0 };
        var lastTap = 0;

        zoomWrapEl.addEventListener('touchend', function(e) {
            if (e.changedTouches.length !== 1) return;
            var now   = Date.now();
            var touch = e.changedTouches[0];
            if (now - lastTap < 300) {
                var rect     = zoomWrapEl.getBoundingClientRect();
                var isZoomed = toggleZoom($zoomWrap, touch.clientX - rect.left, touch.clientY - rect.top);
                updateZoomBtn($zoomBtn, isZoomed);
                toggleZoomInteraction($zoomWrap, isZoomed);
                e.preventDefault();
            }
            lastTap = now;
        }, { passive: false });

        zoomWrapEl.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 2) return;
            var t1 = e.touches[0], t2 = e.touches[1];
            var rect = zoomWrapEl.getBoundingClientRect();
            pinchState.active     = true;
            pinchState.startDist  = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            pinchState.startScale = zoomState.scale;
            pinchState.startMidX  = ((t1.clientX + t2.clientX) / 2) - rect.left;
            pinchState.startMidY  = ((t1.clientY + t2.clientY) / 2) - rect.top;
        }, { passive: true });

        zoomWrapEl.addEventListener('touchmove', function(e) {
            if (!pinchState.active || e.touches.length !== 2) return;
            var t1 = e.touches[0], t2 = e.touches[1];
            var dist     = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            var newScale = Math.min(3, Math.max(1, pinchState.startScale * (dist / pinchState.startDist)));

            if (newScale <= 1.05) {
                resetZoom($zoomWrap); updateZoomBtn($zoomBtn, false);
            } else {
                var tx = -(pinchState.startMidX - $zoomWrap.width()  / 2) / newScale;
                var ty = -(pinchState.startMidY - $zoomWrap.height() / 2) / newScale;
                var cl = clampPan($zoomWrap, tx, ty, newScale);
                applyZoom($zoomWrap, newScale, cl.tx, cl.ty);
                toggleZoomInteraction($zoomWrap, true);
                updateZoomBtn($zoomBtn, true);
            }
            e.preventDefault();
        }, { passive: false });

        zoomWrapEl.addEventListener('touchend', function(e) {
            if (e.touches.length < 2) pinchState.active = false;
        }, { passive: true });
    }

    function setupDragPan($zoomWrap, $zoomBtn) {
        var zoomWrapEl = $zoomWrap[0];
        var dragState  = { active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 };

        $zoomWrap.on('mousedown', function(e) {
            if (zoomState.scale <= 1) return;
            dragState = { active: true, startX: e.pageX, startY: e.pageY, startTx: zoomState.tx, startTy: zoomState.ty };
            $zoomWrap.css('cursor', 'grabbing');
            e.preventDefault();
        });

        $(document).on('mousemove', function(e) {
            if (!dragState.active) return;
            var dx = (e.pageX - dragState.startX) / zoomState.scale;
            var dy = (e.pageY - dragState.startY) / zoomState.scale;
            var cl = clampPan($zoomWrap, dragState.startTx + dx, dragState.startTy + dy);
            applyZoom($zoomWrap, zoomState.scale, cl.tx, cl.ty);
        });

        $(document).on('mouseup', function() {
            if (!dragState.active) return;
            dragState.active = false;
            $zoomWrap.css('cursor', zoomState.scale > 1 ? 'grab' : 'default');
        });

        zoomWrapEl.addEventListener('touchstart', function(e) {
            if (zoomState.scale <= 1 || e.touches.length !== 1) return;
            var t = e.touches[0];
            dragState = { active: true, startX: t.pageX, startY: t.pageY, startTx: zoomState.tx, startTy: zoomState.ty };
        }, { passive: true });

        zoomWrapEl.addEventListener('touchmove', function(e) {
            if (!dragState.active || zoomState.scale <= 1 || e.touches.length !== 1) return;
            var t  = e.touches[0];
            var dx = (t.pageX - dragState.startX) / zoomState.scale;
            var dy = (t.pageY - dragState.startY) / zoomState.scale;
            var cl = clampPan($zoomWrap, dragState.startTx + dx, dragState.startTy + dy);
            applyZoom($zoomWrap, zoomState.scale, cl.tx, cl.ty);
            e.preventDefault();
        }, { passive: false });

        $zoomWrap.on('touchend', function() { dragState.active = false; });
    }

    function toggleZoom($zoomWrap, centerX, centerY) {
        if (zoomState.scale > 1) {
            resetZoom($zoomWrap); return false;
        } else {
            var newScale   = 2.2;
            var wrapWidth  = $zoomWrap.width();
            var wrapHeight = $zoomWrap.height();
            var tx = -(centerX - wrapWidth  / 2) / newScale;
            var ty = -(centerY - wrapHeight / 2) / newScale;
            var cl = clampPan($zoomWrap, tx, ty, newScale);
            $zoomWrap.css('transition', 'transform 0.3s ease');
            setTimeout(function() { applyZoom($zoomWrap, newScale, cl.tx, cl.ty); }, 10);
            return true;
        }
    }

    function resetZoom($zoomWrap) {
        zoomState.scale = 1; zoomState.tx = 0; zoomState.ty = 0;
        $zoomWrap.removeClass('zoomed').css({
            transform: 'scale(1) translate(0,0)',
            transition: 'transform 0.3s ease',
            cursor: 'default'
        });
    }

    function applyZoom($zoomWrap, scale, tx, ty) {
        zoomState.scale = scale; zoomState.tx = tx; zoomState.ty = ty;
        $zoomWrap.css({
            transform:       'scale(' + scale + ') translate(' + tx + 'px,' + ty + 'px)',
            transformOrigin: 'center center',
            transition:      'none',
            cursor:          scale > 1 ? 'grab' : 'default'
        });
    }

    function clampPan($zoomWrap, tx, ty, scale) {
        scale = scale || zoomState.scale;
        var maxX = ($zoomWrap.width()  * (scale - 1)) / (2 * scale);
        var maxY = ($zoomWrap.height() * (scale - 1)) / (2 * scale);
        return {
            tx: Math.max(-maxX, Math.min(maxX, tx)),
            ty: Math.max(-maxY, Math.min(maxY, ty))
        };
    }

    function updateZoomBtn($btn, isZoomed) {
        $btn.html(isZoomed ? SVG_ICONS.zoomOut : SVG_ICONS.zoomIn)
            .attr('title', isZoomed ? 'Alejar' : 'Ampliar');
    }

    function updateZoomIcon($btn, isZoomed) { updateZoomBtn($btn, isZoomed); }

    // 
    // UTILIDADES
    // 
    function setCoverShift($shiftWrap, dimensions, isCover, animate) {
        if (dimensions.isSingle) return;
        var shift = isCover ? -Math.round(dimensions.pageWidth / 2) : 0;
        $shiftWrap.css({
            transition: animate ? 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' : 'none',
            transform:  'translateX(' + shift + 'px)'
        });
    }

    function lazyLoadPages(pageFlip, currentIndex, pdf, width, height, total, $container) {
        for (var i = currentIndex - 2; i <= currentIndex + 4; i++) {
            if (i < 0 || i >= total) continue;
            (function(pageIndex) {
                var $page = $container.find('[data-page="' + (pageIndex + 1) + '"]');
                if (!$page.length || $page.attr('data-loaded') !== 'false') return;
                $page.attr('data-loaded', 'loading');
                renderPage(pdf, pageIndex + 1, width, height, 0.88)
                    .then(function(imgData) {
                        $page.find('.fbw-page-placeholder').remove();
                        $page.append($('<img>', { src: imgData, alt: 'Página ' + (pageIndex + 1), loading: 'lazy' }));
                        $page.attr('data-loaded', 'true');
                        renderAnnotationLayer(pdf, pageIndex + 1, width, height, $page);
                    })
                    .catch(function() { $page.attr('data-loaded', 'error'); });
            })(i);
        }
    }

    function renderAnnotationLayer(pdf, pageNum, width, height, $pageEl) {
        pdf.getPage(pageNum).then(function(page) {
            return page.getAnnotations().then(function(annotations) {
                var links = annotations.filter(function(a) {
                    return a.subtype === 'Link' && (a.url || a.dest || a.action);
                });
                if (!links.length) return;

                var viewport = page.getViewport({ scale: 1 });
                var scale    = Math.min(width / viewport.width, height / viewport.height);
                var scaledVp = page.getViewport({ scale: scale });

                var $layer = $('<div>', { class: 'fbw-annotation-layer' }).css({
                    position: 'absolute', top: 0, left: 0,
                    width: scaledVp.width + 'px', height: scaledVp.height + 'px',
                    pointerEvents: 'none', zIndex: 10
                });

                links.forEach(function(ann) {
                    var r  = ann.rect;
                    var x1 = r[0] * scale;
                    var y1 = scaledVp.height - r[3] * scale;
                    var x2 = r[2] * scale;
                    var y2 = scaledVp.height - r[1] * scale;

                    var url = ann.url || (ann.action && ann.action.url) || ann.unsafeUrl || '';
                    if (!url) return;

                    $layer.append($('<a>', {
                        href: url, target: '_blank', rel: 'noopener noreferrer', title: url
                    }).css({
                        position: 'absolute',
                        left: x1 + 'px', top: y1 + 'px',
                        width: (x2 - x1) + 'px', height: (y2 - y1) + 'px',
                        pointerEvents: 'auto', cursor: 'pointer',
                        display: 'block', zIndex: 10
                    }));
                });

                $pageEl.find('.fbw-annotation-layer').remove();
                $pageEl.append($layer);
            });
        }).catch(function() {});
    }

    function setupLazyLoading($wrapper, pageFlip, pdf, dimensions, total, $container) {
        $wrapper.data('lazyLoad', function(currentIndex) {
            lazyLoadPages(pageFlip, currentIndex, pdf, dimensions.pageWidth, dimensions.pageHeight, total, $container);
        });
    }

    // 
    // ERRORES
    // 
    function showError($wrapper, msg) {
        console.error('Flipbook Error:', msg);
        $wrapper.removeClass('loading');
        $wrapper.find('.fbw-loading').html(
            '<div style="text-align:center;padding:40px 20px">' +
            '<p style="color:#dc3545;font-size:16px;margin-bottom:16px">❌ ' + msg + '</p>' +
            '<p style="color:#6c757d;font-size:14px;margin-bottom:20px">Revisa la consola para más detalles</p>' +
            '<button onclick="location.reload()" style="padding:10px 24px;background:#4A90E2;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Reintentar</button>' +
            '</div>'
        );
    }

});