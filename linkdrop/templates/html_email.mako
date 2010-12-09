<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
    "http://www.w3.org/TR/html4/loose.dtd">
<html lang="en">
<head>
    <title>${c.subject}</title>
</head>
<body style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:460px;line-height:21px;display:block;">
    <div class="message" style="font-size:14px;">
        ${context.write(c.safeHTML(c.message))}
    </div>
    <div class="share" style="margin:21px 0 42px 0;">
        <div class="link">
% if c.shorturl:
            <a target="_blank" style="color:#00A0FF;font-size:16px;" href="${c.shorturl}">${c.title}</a>
% elif c.longurl:
            <a target="_blank" style="color:#00A0FF;font-size:16px;" href="${c.longurl}">${c.title}</a>
% endif
        </div>
% if c.description:
        <div class="description" style="font-size:12px;color:#666;margin:7px 0;font-style:italic;padding:0 0 0 15px;border-left:1px solid #666;">
            ${context.write(c.safeHTML(c.description))}
        </div>
% endif
    </div>
    <div class="footer" style="font-size:12px;color:#444;">
        shared via <a target="_blank" style="color:#006AAA;font-weight:bold;text-decoration:none;" title="Share links with the people that matter to you" href="http://f1.mozillamessaging.com/">Mozilla F1</a> for Firefox  &mdash; <span style="color:#666;">"share links with the people that matter to you"</span>
    </div>
</body>
</html>
