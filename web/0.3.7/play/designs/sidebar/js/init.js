$(document).ready(function($) {

    // set panel min-height to full browser height   
    $(window).bind("load resize", function(){
        var h = $(window).height();
        $("#wrapper, #panel1, #panel2").css({ "min-height" : (h) });
    });
    
    // create ellipsis for gecko
    $(function() {
        $(".overflow").textOverflow(null,true);
    });
    
    // simple accordian menu
    $(".accountToggle").click(function() {
        $(".accountPanel:visible").slideUp(200);
            if ($(this).next().is(":hidden")) {
                $(this).next().slideDown(200); 
        }    
    });
    
    $(".accountPanel").hide();
    $(".open").trigger("click");
    
    $(".accountToggle").click(function() {  
        $(this).parent().toggleClass("selected");
        $(this).parent().siblings().removeClass("selected");
    });
    
    // hide and display facebook form
    $(".group, .list").hide();
    
    $("select.facebookDropdown").change(function () {
        if ($(".group, .list").is(":hidden")) {
            $(".group, .list").css({ "display" : "block" });
        }
        else {
            $(".group, .list").css({ "display" : "none" });
        }
    });
    
    // account manager simple tabs
    $("ul#tabs li").click(function() {
        $(this).addClass("selected");
        $(this).siblings().removeClass("selected");
    });
    
    $("ul#tabs li.manage").click(function() {
        if ($("section#manageAccounts").is(":hidden")) {
            $("section#manageAccounts").fadeIn(200);
            $("section#manageAccounts").siblings().fadeOut(0);
        }
        else {
            $("section#manageAccounts").noop();
        }
    });
    
    $("ul#tabs li.add").click(function() {
        if ($("section#addAccounts").is(":hidden")) {
            $("section#addAccounts").fadeIn(200);
            $("section#addAccounts").siblings().fadeOut(0);
        }
        else {
            $("section#addAccounts").noop();
        }
    });
    
    $("ul#tabs li.settings").click(function() {
        if ($("section#accountSettings").is(":hidden")) {
            $("section#accountSettings").fadeIn(200);
            $("section#accountSettings").siblings().fadeOut(0);
        }
        else {
            $("section#manageAccounts").noop();
        }
    });
    
    $("section#addAccounts, section#accountSettings").hide();
    
    // 3d flip with fade fallback
    $(function() {
        if (jQuery.browser.webkit) {
            $("a.configureToggle").bind("click", function() {
                $("#panel1").toggleClass("front_flip");
                $("#panel2").toggleClass("back_flip");
            });
        }
        else {
            $("a.configureToggle").bind("click", function() {
                if ($("#panel1").is(":visible")) {
                    $("#panel1").fadeOut(100);
                    $("#panel2").fadeIn(100);
                }
                else {
                    $("#panel1").fadeIn(100);
                    $("#panel2").fadeOut(100);
                }
            });
        }
    });

    // done!
});  
