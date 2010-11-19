<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
    "http://www.w3.org/TR/html4/loose.dtd">
<html lang="en">
<head>
    <title>${c.subject}</title>
</head>
<body style="margin: 1em;max-width:600pt;">
    <div class="message" style="color:#222;">
        ${context.write(c.message)}
    </div>
    <div class="share" style="margin:1em 0;max-width:480pt;">
        <div class="link" style="">
% if c.shorturl:
        <a style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;" href="${c.shorturl}">${c.title}</a></div>
% elif c.longurl:
        <a style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;" href="${c.longurl}">${c.title}</a>
% endif
        </div>
        <div class="description" style="font-family:Arial,Helvetica,sans-serif;font-size:x-small;color:#666;">${c.description}</div>
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:xx-small;color:#999;position:absolute;bottom:0;margin:1em 0;">${c.from_name} is awesome and used <a style="color:#666;" href="http://f1.mozillamessaging.com/">Mozilla F1</a> to share this.</div>
</body>
</html>
