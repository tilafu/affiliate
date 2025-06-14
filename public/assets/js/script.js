(function ($) {
    'use strict';

    //===== Page Loader =====//
    $(window).on('load', function () {  // Updated to newer jQuery syntax
        // Animate loader off screen
        $("#loader-page").delay(500).fadeOut("slow");
    });    //===== Main Sidebar =====//
    // Toggle sidebar when clicking navbar button
    $(document).on('click', '.navbar-btn', function (e) {
        // Prevent default if it's a link
        if ($(this).is('a') || $(this).find('a').length) {
            e.preventDefault();
        }
        
        // Use enhanced sidebar functions if available
        if (typeof window.openSidebar === 'function' && typeof window.closeSidebar === 'function') {
            const sidebar = $('.main-sidebar');
            if (sidebar.hasClass('active')) {
                window.closeSidebar();
            } else {
                window.openSidebar();
            }
        } else {
            // Fallback to original functionality
            $('.main-sidebar').toggleClass("active"); 
            $('.bg-overlay').toggleClass("active");
            // Add body class for scroll prevention
            $('body').toggleClass('sidebar-open');
        }
    });
    
    // Close sidebar when clicking the overlay
    $(document).on('click', '.bg-overlay', function () {
        if (typeof window.closeSidebar === 'function') {
            window.closeSidebar();
        } else {
            $('.main-sidebar').removeClass("active");
            $('.bg-overlay').removeClass("active");
            $('body').removeClass('sidebar-open');
        }
    });
    
    // Close sidebar when clicking close button
    $(document).on('click', '.sidebar-close-toggler', function (e) {
        // Prevent default if it's a link
        if ($(this).is('a') || $(this).find('a').length) {
            e.preventDefault();
        }
        if (typeof window.closeSidebar === 'function') {
            window.closeSidebar();
        } else {
            $('.main-sidebar').removeClass("active");
            $('.bg-overlay').removeClass("active");
            $('body').removeClass('sidebar-open');
        }
    });

    // ESC key to close sidebar
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && $('.main-sidebar').hasClass('active')) {
            if (typeof window.closeSidebar === 'function') {
                window.closeSidebar();
            } else {
                $('.main-sidebar').removeClass("active");
                $('.bg-overlay').removeClass("active");
                $('body').removeClass('sidebar-open');
            }
        }
    });

    //===== Main Slider =====//
    var owl = $('.main-slider');
    owl.owlCarousel({
        margin: 10,
        items: 1,
        loop: true,
        autoplay: false,
        dots: true,
        center: true,
    });

    //===== Value Market Item =====//
    $('.value-market-ticker').jConveyorTicker();

    //===== Clipboard  =====//
    if ($('.clipboard-icon').length) {
        var clipboard = new ClipboardJS('.clipboard-icon');
        $('.clipboard-icon').attr('data-toggle', 'tooltip').attr('title', 'Copy to clipboard');
    }

    //===== Change Value Exchange  =====//
    $('.exchange-icon').click(function () {
        var _send = $('#select-send').val(),
            _get = $('#select-get').val();
        $('#select-get').val(_send);
        $('#select-send').val(_get);
    });

    //===== Contact Form =====//
    var submitContact = $('#submit-message'),
        message = $('#msg');

    submitContact.on('click', function (e) {
        e.preventDefault();

        var $this = $(this);

        $.ajax({
            type: "POST",
            url: 'contact.php',
            dataType: 'json',
            cache: false,
            data: $('#contact-form').serialize(),
            success: function (data) {
                if (data.info !== 'error') {
                    $this.parents('form').find('input[type=text],input[type=email],textarea,select').filter(':visible').val('');
                    message.hide().removeClass('success').removeClass('error').addClass('success').html(data.msg).fadeIn('slow').delay(3000).fadeOut('slow');
                } else {
                    message.hide().removeClass('success').removeClass('error').addClass('error').html(data.msg).fadeIn('slow').delay(3000).fadeOut('slow');
                }
            }
        });
    });
 
})(jQuery);
