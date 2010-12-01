$(document).ready(function($) {
    
    // resize wrapper
    $(window).bind("load resize", function(){
        var h = $(window).height();
        $("#wrapper").css({ "min-height" : (h) });
    });
    
    // flash new stuff yellow
    $(function() {
        $("ul.add").animate( { backgroundColor: '#ffff99' }, 200)
            .delay(1000).animate( { backgroundColor: '#fafafa' }, 3000);
    });
    
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
