(function ($, undefined) {
    'use strict';

    var OFFSET = 5;

    function Rating(element, options) {
        this.$input = $(element);
        this.$rating = $('<span></span>').css({
            cursor: 'default'
        }).insertBefore(this.$input);
        // Merge data and parameter options.
        // Those provided as parameter prevail over the data ones.
        this.options = (function (opts) {
            // Sanitize start, stop, step, and fractions.
            // All of them start, stop, and step must be integers.
            opts.start = parseInt(opts.start, 10);
            opts.start = isNaN(opts.start) ? undefined : opts.start;
            // In case we don't have a valid stop rate try to get a reasonable
            // one based on the existence of a valid start rate.
            opts.stop = parseInt(opts.stop, 10);
            opts.stop = isNaN(opts.stop) ?
                opts.start + OFFSET || undefined : opts.stop;
            // 0 step is ignored.
            opts.step = parseInt(opts.step, 10) || undefined;
            // Symbol fractions and scale (number of significant digits).
            // 0 is ignored and negative numbers are turned to positive.
            opts.fractions = Math.abs(parseInt(opts.fractions, 10)) || undefined;
            opts.scale = Math.abs(parseInt(opts.scale, 10)) || undefined;

            // Extend/Override the default options with those provided either as
            // data attributes or function parameters.
            opts = $.extend({}, $.fn.rating.defaults, opts);
            // Inherit default filled if none is defined for the selected symbol.
            opts.filledSelected = opts.filledSelected || opts.filled;
            return opts;
        }($.extend({}, this.$input.data(), options)));

        this._init();
    };

    Rating.prototype = {
        _init: function () {
            var rating = this,
                $input = this.$input,
                $rating = this.$rating;

            var ifEnabled = function (f) {
                return function (e) {
                    // According to the W3C attribute readonly is not allowed on input
                    // elements with type hidden.
                    // Keep readonly prop for legacy but its use should be deprecated.
                    if (!$input.prop('disabled') && !$input.prop('readonly') &&
                        $input.data('readonly') === undefined) {
                        f.call(this, e);
                    }
                }
            };

            // Build the rating control.
            for (var i = 1; i <= this._rateToIndex(this.options.stop); i++) {
                // Create the rating symbol container.
                var $symbol = $('<div class="rating-symbol"></div>').css({
                    display: 'inline-block',
                    position: 'relative'
                });
                // Add background symbol to the symbol container.
                $('<div class="rating-symbol-background ' + this.options.empty + '"></div>')
                    .appendTo($symbol);
                // Add foreground symbol to the symbol container.
                // The filled icon is wrapped with a div to allow fractional selection.
                $('<div class="rating-symbol-foreground"></div>')
                    .append('<span></span>')
                    .css({
                        display: 'inline-block',
                        position: 'absolute',
                        overflow: 'hidden',
                        left: 0,
                        // Overspecify right and left to 0 and let the container direction
                        // decide which one is going to take precedence according to the
                        // ltr/rtl direction.
                        // (https://developer.mozilla.org/en-US/docs/Web/CSS/right)
                        // When both the right CSS property and the left CSS property are
                        // defined, the position of the element is overspecified. In that
                        // case, the left value has precedence when the container is
                        // left-to-right (that is that the right computed value is set to
                        // -left), and the right value has precedence when the container is
                        // right-to-left (that is that the left computed value is set to
                        // -right).
                        right: 0,
                        width: 0
                    }).appendTo($symbol);
                $rating.append($symbol);
                this.options.extendSymbol.call($symbol, this._indexToRate(i));
            }
            // Initialize the rating control with the associated input value rate.
            this._updateRate($input.val());

            // Keep rating control and its associated input in sync.
            $input
                .on('change', function () {
                    rating._updateRate($(this).val());
                });

            var fractionalIndex = function (e) {
                var $symbol = $(e.currentTarget);
                // Calculate the distance from the mouse pointer to the origin of the
                // symbol. We need to be careful with the CSS direction. If we are
                // right-to-left then the symbol starts at the right. So we have to add
                // the symbol width to the left offset to get the CSS rigth position.
                var x = Math.abs((e.pageX || e.originalEvent.touches[0].pageX) -
                    (($symbol.css('direction') === 'rtl' && $symbol.width()) +
                        $symbol.offset().left));

                // NOTE: When the mouse pointer is close to the left side of the symbol
                // a negative x is returned. Probably some precision error in the
                // calculation.
                // x should never be less than 0 because this would mean that we are in
                // the previous symbol.
                x = x > 0 ? x : rating.options.scale * 0.1;
                return $symbol.index() + x / $symbol.width();
            };
            // Keep the current highlighted index (fractional or not).
            var index;
            $rating
                .on('mousedown touchstart', '.rating-symbol', ifEnabled(function (e) {
                    // Set input 'trigger' the change event.
                    $input.val(rating._indexToRate(fractionalIndex(e))).change();
                }))
                .on('mousemove touchmove', '.rating-symbol', ifEnabled(function (e) {
                    var current = rating._roundToFraction(fractionalIndex(e));
                    if (current !== index) {
                        // Trigger pseudo rate leave event if the mouse pointer is not
                        // leaving from another symbol (mouseleave).
                        if (index !== undefined) $(this).trigger('rating.rateleave');
                        // Update index and trigger rate enter event.
                        index = current;
                        $(this).trigger('rating.rateenter', [rating._indexToRate(index)]);
                    }
                    // Fill the symbols as fractions chunks.
                    rating._fillUntil(current);
                }))
                .on('mouseleave touchend', '.rating-symbol', ifEnabled(function () {
                    // When a symbol is left, reset index and trigger rate leave event.
                    index = undefined;
                    $(this).trigger('rating.rateleave');
                    // Restore on hover out.
                    rating._fillUntil(rating._rateToIndex(parseFloat($input.val())));
                }));

        },
        // Fill rating symbols until index.
        _fillUntil: function (index) {
            var $rating = this.$rating;
            // Get the index of the last whole symbol.
            var i = Math.floor(index);
            // Hide completely hidden symbols background.
            $rating.find('.rating-symbol-background')
                .css('visibility', 'visible')
                .slice(0, i).css('visibility', 'hidden');
            var $rates = $rating.find('.rating-symbol-foreground');
            // Reset foreground
            $rates.width(0);
            // Fill all the foreground symbols up to the selected one.
            $rates.slice(0, i).width('auto')
                .find('span').attr('class', this.options.filled);
            // Amend selected symbol.
            $rates.eq(index % 1 ? i : i - 1)
                .find('span').attr('class', this.options.filledSelected);
            // Partially fill the fractional one.
            $rates.eq(i).width(index % 1 * 100 + '%');
        },
        // Calculate the rate of an index according the the start and step.
        _indexToRate: function (index) {
            return this.options.start + Math.floor(index) * this.options.step +
                this.options.step * this._roundToFraction(index % 1);
        },
        // Calculate the corresponding index for a rate.
        _rateToIndex: function (rate) {
            return (rate - this.options.start) / this.options.step;
        },
        // Round index to the configured opts.fractions.
        _roundToFraction: function (index) {
            // Get the closest top fraction.
            var fraction = Math.ceil(index % 1 * this.options.fractions) / this.options.fractions;
            // Truncate decimal trying to avoid float precission issues.
            var p = Math.pow(10, this.options.scale);
            return Math.floor(index) + Math.floor(fraction * p) / p;
        },
        // Check the rate is in the proper range [start..stop].
        _contains: function (rate) {
            var start = this.options.step > 0 ? this.options.start : this.options.stop;
            var stop = this.options.step > 0 ? this.options.stop : this.options.start;
            return start <= rate && rate <= stop;
        },
        // Update empty and filled rating symbols according to a rate.
        _updateRate: function (rate) {
            var value = parseFloat(rate);
            if (this._contains(value)) {
                this._fillUntil(this._rateToIndex(value));
                this.$input.val(value);
            } else if (rate === '') {
                this._fillUntil(0);
                this.$input.val('');
            }
        },
        rate: function (value) {
            if (value === undefined) {
                return this.$input.val();
            }
            this._updateRate(value);
        }
    };

    $.fn.rating = function (options) {
        var args = Array.prototype.slice.call(arguments, 1),
            result;
        this.each(function () {
            var $input = $(this);
            var rating = $input.data('rating');
            if (!rating) {
                $input.data('rating', (rating = new Rating(this, options)));
            }
            // Underscore are used for private methods.
            if (typeof options === 'string' && options[0] !== '_') {
                result = rating[options].apply(rating, args);
            }
        });
        return result !== undefined ? result : this;
    };

    // Plugin defaults.
    $.fn.rating.defaults = {
        filled: 'glyphicon glyphicon-star',
        filledSelected: undefined,
        empty: 'glyphicon glyphicon-star-empty',
        start: 0,
        stop: OFFSET,
        step: 1,
        fractions: 1,
        scale: 3,
        extendSymbol: function (rate) { },
    };

    $(function () {
        $('input.rating').rating();
    });
}(jQuery));
(function ($) {
    jQuery(document).ready(function ($) {
        "use strict";
        new WOW().init();
        $('[data-toggle="tooltip"]').tooltip()
        var allIcons = $("#faqAccordion .panel-heading i.fa");
        $('#faqAccordion .panel-heading').on('click', function () {
            allIcons.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            $(this).find('i.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
        var allIconsOne = $("#accordionOne .panel-heading i.fa");
        $('#accordionOne .panel-heading').on('click', function () {
            allIconsOne.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            $(this).find('i.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
        var allIconsTwo = $("#accordionTwo .panel-heading i.fa");
        $('#accordionTwo .panel-heading').on('click', function () {
            allIconsTwo.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            $(this).find('i.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
        var allIconsThree = $("#togglesOne .panel-heading i.fa");
        $('#togglesOne .panel-heading').on('click', function () {
            allIconsThree.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            $(this).find('i.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
        var allIconsFour = $("#togglesTwo .panel-heading i.fa");
        $('#togglesTwo .panel-heading').on('click', function () {
            allIconsFour.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            $(this).find('i.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
        });
        if ($('.navbar').width() > 1007) {
            $('.nav .dropdown').on('mouseover', function () {
                $(this).addClass('open');
            }), $('.nav .dropdown').on('mouseleave', function () {
                $(this).removeClass('open');
            });
        }
        $('.nav-category .dropdown-submenu ').on("hover", function () {
            $(this).addClass('open');
        }, function () {
            $(this).removeClass('open');
        });

    });
    jQuery(document).on("load", function ($) {
        jQuery('.body-wrapper').each(function () {
            var header_area = $('.header');
            var main_area = header_area.children('.navbar');
            var logo = main_area.find('.navbar-header');
            var navigation = main_area.find('.navbar-collapse');
            var original = { nav_top: navigation.css('margin-top') };
            $(window).scroll(function () {
                if (main_area.hasClass('bb-fixed-header') && ($(this).scrollTop() == 0 || $(this).width() < 750)) {
                    main_area.removeClass('bb-fixed-header').appendTo(header_area);
                    navigation.animate({ 'margin-top': original.nav_top }, {
                        duration: 100,
                        queue: false,
                        complete: function () {
                            header_area.css('height', 'auto');
                        }
                    });
                } else if (!main_area.hasClass('bb-fixed-header') && $(this).width() > 750 && $(this).scrollTop() > header_area.offset().top + header_area.height() - parseInt($('html').css('margin-top'))) {
                    header_area.css('height', header_area.height());
                    main_area.css({ 'opacity': '0' }).addClass('bb-fixed-header');
                    main_area.appendTo($('body')).animate({ 'opacity': 1 });
                    navigation.css({ 'margin-top': '0px' });
                }
            });
        });
        $(window).trigger('resize');
        $(window).trigger('scroll');
    });
    jQuery(document).ready(function ($) {
        $('.searchBox a').on("click", function () {
            $(".searchBox .dropdown-menu").toggleClass('display-block');
            $(".searchBox a i").toggleClass('fa-close').toggleClass("fa-search");
        });
    });
    jQuery(document).ready(function ($) {
        if (jQuery('.bannerV1 .fullscreenbanner').length) {
            jQuery('.bannerV1 .fullscreenbanner').revolution({
                delay: 5000,
                startwidth: 1170,
                startheight: 500,
                fullWidth: "on",
                fullScreen: "off",
                hideCaptionAtLimit: "",
                dottedOverlay: "twoxtwo",
                navigationStyle: "preview4",
                fullScreenOffsetContainer: "",
                hideTimerBar: "on"
            });
        }
        if (jQuery('.bannerV4 .fullscreenbanner').length) {
            jQuery('.bannerV4 .fullscreenbanner').revolution({
                delay: 5000,
                startwidth: 835,
                startheight: 470,
                fullWidth: "off",
                fullScreen: "off",
                hideCaptionAtLimit: "",
                dottedOverlay: "twoxtwo",
                navigationStyle: "preview4",
                fullScreenOffsetContainer: "",
                hideTimerBar: "on",
                onHoverStop: "on",
            });
        }


    });
    jQuery(document).ready(function ($) {
        "use strict";
        if ($('.owl-carousel').length) {
            var owl = $('.owl-carousel.featuredProductsSlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 2000,
                autoplayHoverPause: true,
                nav: true,
                moveSlides: 4,
                dots: false,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: { 320: { items: 2 }, 768: { items: 3 }, 992: { items: 6 } }
            });
            var owl = $('.owl-carousel.partnersLogoSlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true,
                nav: true,
                dots: false,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: { 320: { slideBy: 1, items: 1 }, 768: { slideBy: 3, items: 3 }, 992: { slideBy: 5, items: 5 } }
            });
            var owl = $('.owl-carousel.featuredCollectionSlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true,
                nav: true,
                dots: false,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: { 320: { slideBy: 1, items: 1 }, 768: { slideBy: 2, items: 2 }, 992: { slideBy: 2, items: 2 } }
            });
            var owl = $('.owl-carousel.dealSlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 2000,
                autoplayHoverPause: true,
                nav: true,
                moveSlides: 5,
                dots: false,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: { 320: { slideBy: 1, items: 2 }, 768: { slideBy: 3, items: 3 }, 992: { slideBy: 5, items: 5 } }
            });
            var owl = $('.owl-carousel.testimonialSlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 4000,
                autoplayHoverPause: true,
                smartSpeed: 1000,
                nav: true,
                moveSlides: 1,
                dots: false,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: { 320: { items: 1 }, 768: { items: 1 }, 992: { items: 1 } }
            });
            var owl = $('.owl-carousel.categorySlider');
            owl.owlCarousel({
                loop: true,
                margin: 28,
                autoplay: true,
                autoplayTimeout: 2000,
                autoplayHoverPause: true,
                nav: true,
                moveSlides: 1,
                dots: false,
                smartSpeed: 1000,
                responsive: { 320: { items: 1 }, 768: { items: 1 }, 992: { items: 1 } }
            });
            var owl = $('.owl-carousel.bannerV3');
            owl.owlCarousel({
                loop: true,
                autoplay: true,
                autoplayTimeout: 4000,
                autoplayHoverPause: true,
                nav: true,
                moveSlides: 1,
                dots: false,
                margin: 15,
                items: 1,
                rtl: !!(jQuery(document).find('body').hasClass('rtl')),
                responsive: {
                    320: { items: 1, stagePadding: 20 },
                    768: { items: 1, stagePadding: 100, margin: 50 },
                    992: { items: 1, stagePadding: 250, margin: 50 }
                }
            });

        }
    });
    jQuery(document).ready(function ($) {
        $('.select-drop').selectbox();
    });
    jQuery(document).ready(function ($) {
        $('.side-nav li a').on('click', function () {
            $(this).find('i').toggleClass('fa fa-minus fa fa-plus');
        });
    });
    jQuery(document).ready(function ($) {
        var minimum = 20;
        var maximum = 300;
        $("#price-range").slider({
            range: true,
            min: minimum,
            max: maximum,
            values: [minimum, maximum],
            slide: function (event, ui) {
                $("#price-amount-1").val("$" + ui.values[0]);
                $("#price-amount-2").val("$" + ui.values[1]);
            }
        });
        $("#price-amount-1").val("$" + $("#price-range").slider("values", 0));
        $("#price-amount-2").val("$" + $("#price-range").slider("values", 1));
    });
    jQuery(document).ready(function ($) {
        (function ($) {
            $('.carousel').carousel({
                interval: false
            });

        })(jQuery);
    });
    jQuery(document).ready(function ($) {
        $(".quick-view .btn-block").on('click', function () {
            $(".quick-view").modal("hide");
        });
    });
    jQuery(document).ready(function ($) {
        "use strict";
        if ($('#simple_timer').length) {
            $('#simple_timer').syotimer({ year: 2019, month: 5, day: 9, hour: 20, minute: 30, });
            $('.bannerV3 #slider_timer').syotimer({ year: 2018, month: 1, day: 9, hour: 20, minute: 30, });
        }
    });
    /* ---------------------------------------------
     TAB EFFECT
     --------------------------------------------- */
    function inner_tab_fade_effect() {
        // Effect click
        $(document).on('click', '.tabCommon ul li a', function () {

            var tab_id = $(this).attr('href');
            var tab_animated = $(this).data('animate');

            tab_animated = (tab_animated == undefined || tab_animated == "") ? '' : tab_animated;
            if (tab_animated == "") {
                return false;
            }

            // Find tab is active
            $(tab_id).find('.slidetoup').each(function (i) {
                var t = $(this);
                var style = $(this).attr("style");
                style = (style == undefined) ? '' : style;
                var delay = i * 400;

                // Set style
                t.attr("style", style +
                    ";-webkit-animation-delay:" + delay + "ms;" + "-moz-animation-delay:" + delay + "ms;" + "-o-animation-delay:" + delay + "ms;" + "animation-delay:" + delay + "ms;"
                ).addClass(tab_animated + ' animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                    t.removeClass(tab_animated + ' animated');
                    t.attr("style", style);
                });
            })
        })
    }
    jQuery(document).ready(function ($) {
        // Call functions
        inner_tab_fade_effect();
        $('.listsystem').on('click', function (e) {
            e.preventDefault();
            if ($(this).hasClass('active'))
                return false;

            $(this).parent().find('button.active').removeClass('active');
            $(this).addClass('active');
            var productGridSingle = $('body').find('.productGridSingle');
            productGridSingle.removeClass('productGridSingle').addClass('productListSingle');
            productGridSingle.find('.item').each(function (index) {
                $(this).removeClass('col-sm-3 col-xs-6').addClass('col-xs-12');
                $(this).find('.productBox').addClass('row');
                $(this).find('.productBox').addClass('jackInTheBox animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                    $(this).removeClass('jackInTheBox animated');
                });

                $(this).find('.col-Image').addClass('col-lg-3 col-md-3 col-sm-3 col-xs-6');
                $(this).find('.col-Caption').addClass('col-lg-9 col-md-9 col-sm-9 col-xs-6');
            });

        });
        $('.gridsystem').on('click', function (e) {
            e.preventDefault();
            if ($(this).hasClass('active'))
                return false;

            $(this).parent().find('button.active').removeClass('active');
            $(this).addClass('active');
            var productListSingle = $('body').find('.productListSingle');
            productListSingle.removeClass('productListSingle').addClass('productGridSingle');
            productListSingle.find('.item').each(function (index) {
                $(this).addClass('col-sm-3 col-xs-6').removeClass('col-xs-12');
                $(this).find('.productBox').removeClass('row');
                $(this).find('.productBox').addClass('jackInTheBox animated').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
                    $(this).removeClass('jackInTheBox animated');
                });


                $(this).find('.col-Image').removeClass('col-lg-3 col-md-3 col-sm-3 col-xs-6');
                $(this).find('.col-Caption').removeClass('col-lg-9 col-md-9 col-sm-9 col-xs-6');
            });
        });
        $('.qtyplus').on('click', function (e) {
            e.preventDefault();
            var currentVal = parseInt($('input[name="quantity"]').val());
            if (!isNaN(currentVal)) {
                $('input[name="quantity"]').val(currentVal + 1);
            } else {
                $('input[name="quantity"]').val(1);
            }

        });

        $(".qtyminus").on('click', function (e) {

            e.preventDefault();
            var currentVal = parseInt($('input[name="quantity"]').val());
            if (!isNaN(currentVal) && currentVal > 0) {
                $('input[name="quantity"]').val(currentVal - 1);
            } else {
                $('input[name="quantity"]').val(1);
            }

        });

        $(".stocktick").on({
            mouseenter: function () {
                var stock_id = $(this).attr('data-stock-id'),
                    purchase_id = $(this).attr('data-purchase');
                if (purchase_id == 1)
                    return;
                if (stock_id == 1) {
                    $(this).attr('src', site_url + '/img/stock_selected.jpg').attr('data-stock-id', 0);
                } else {
                    $(this).attr('src', site_url + '/img/stock_in.jpg').attr('data-stock-id', 1);
                }
            },
            mouseleave: function () {
                var stock_id = $(this).attr('data-stock-id'),
                    purchase_id = $(this).attr('data-purchase');
                if (purchase_id == 1)
                    return;
                if (stock_id == 1) {
                    $(this).attr('src', site_url + '/img/stock_selected.jpg').attr('data-stock-id', 0);
                } else {
                    $(this).attr('src', site_url + '/img/stock_in.jpg').attr('data-stock-id', 1);
                }
            },
            click: function () {
                var purchase_id = $(this).attr('data-purchase');
                if (purchase_id == 0) {
                    $(this).attr('data-purchase', 1).attr('src', site_url + '/img/stock_selected.jpg');
                } else {
                    $(this).attr('data-purchase', 0).attr('src', site_url + '/img/stock_in.jpg');

                }
            }
        });
        var isMobile = false; //initiate as false
        // device detection
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
            || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0, 4))) isMobile = true;

        if ($('.product-featured-image').length) {
            if (isMobile || $(window).width() < 700)
                $.fancybox.destroy();

            if (!isMobile || $(window).width() > 700) {
                $(".product-featured-image").elevateZoom({
                    cursor: "pointer",
                    lensSize: 800,
                    imageCrossfade: !1,
                    scrollZoom: !1,
                    zoomWindowWidth: 400,
                    zoomWindowHeight: 800,
                    onImageSwapComplete: function () {
                        $(".zoomWrapper div").hide()
                    },
                    loadingIcon: './loading.gif'
                });
            }
        }
        $("input[name='color']").on("click", function () {
            var color_select = $(this).val();
            $(".carousel-inner .item").each(function () {
                $(this).removeClass('active');
                if ($(this).attr('data-color') == color_select) {
                    $(this).addClass('active');
                }
            });
        });
        $(".color-kids").on("click", function () {
            var color_select = $(this).attr('data-color-select');
            $(".carousel-inner .item").each(function () {
                $(this).removeClass('active');
                if ($(this).attr('data-color') == color_select) {
                    $(this).addClass('active');
                }
            });
        });
        if ($('#phone').length) {
            jQuery("#phone").intlTelInput({
                onlyCountries: ["sa", "eg", "om", "sy", "sd", "ps", "kw", "iq", "bh", "ae"],
                initialCountry: "auto",
                geoIpLookup: function (callback) {
                    $.get('https://ipinfo.io', function () {
                    }, "jsonp").always(function (resp) {
                        var countryCode = (resp && resp.country) ? resp.country : "";
                        callback(countryCode);
                    });
                },
                utilsScript: "./plugins/intltelinput/js/utils.js" // just for formatting/placeholders etc
            });
            $("#phone").on("countrychange change", function (e, countryData) {
                e.preventDefault();
                var country_Data = $("#phone").intlTelInput("getSelectedCountryData");
                $("#isocountry").val(country_Data.iso2);
                $("#hiddenphone").val($("#phone").intlTelInput("getNumber"));
                $("#codecountry").val(country_Data.dialCode);

            });
        }
        $('.rating-tooltip').rating({
            extendSymbol: function () {
                var title;
                $(this).tooltip({
                    container: 'body',
                    placement: 'bottom',
                    trigger: 'manual',
                    title: function () {
                        return title;
                    }
                });
                $(this).on('rating.rateenter', function (e, rate) {
                    title = rate;
                    $(this).tooltip('show');
                })
                    .on('rating.rateleave', function () {
                        $(this).tooltip('hide');
                    });
            }
        });

    })
})(jQuery);