<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
    "http://www.w3.org/TR/html4/loose.dtd">
<html lang="en">
<head>
    <title>${c.subject}</title>
</head>
<body style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin:20px;max-width:460px;line-height:110%;">
    <div class="message" style="font-size:14px;">
        ${context.write(c.message)}
    </div>
    <div class="share" style="margin:20px 0;">
        <div class="link">
% if c.shorturl:
            <a style="color:#00A0FF;font-size:14px;" href="${c.shorturl}">${c.title}</a>
% elif c.longurl:
            <a style="color:#00A0FF;font-size:14px;" href="${c.longurl}">${c.title}</a>
% endif
        </div>
% if c.description
        <div class="description" style="font-size:12px;color:#666;margin:10px 0;font-style:italic;padding:0 0 0 15px;border-left:1px solid #666;">
            ${c.description}
        </div>
% endif
    </div>
    <div class="footer" style="font-size:12px;color:#666;position:absolute;bottom:0;margin:20px 0;">
        sent via <a style="color:#00A0FF;" href="http://f1.mozillamessaging.com/">Mozilla F1</a>
    </div>
</body>
</html>
