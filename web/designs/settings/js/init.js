$(document).ready(function($) {
    
    // create ellipsis for gecko
    $(function() {
        $(".overflow").textOverflow(null,true);
    });
    
    // tabs
    $("#settings").hide();
    
    $("ul#tabs li").click(function() {
        $(this).addClass("selected");
        $(this).siblings().removeClass("selected");
    });

    $("ul#tabs li.manage").click(function() {
        if ($("#manage").is(":hidden")) {
            $("#manage").fadeIn(200);
            $("#manage").siblings().fadeOut(0);
        }
        else {
            $("#manage").noop();
        }
    });
    
    $("ul#tabs li.settings").click(function() {
        if ($("#settings").is(":hidden")) {
            $("#settings").fadeIn(200);
            $("#settings").siblings().fadeOut(0);
        }
        else {
            $("#settings").noop();
        }
    });

    // done!
});  
