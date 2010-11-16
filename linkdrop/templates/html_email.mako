<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
    "http://www.w3.org/TR/html4/loose.dtd">
<html lang="en">
<head>
    <title>${c.subject}</title>
    <style>
    .message {
        margin: 5px;
        padding: 5px;
        font-family: cursive;
        border: 1px solid;
        background-color: yellow;
    }
    .footer {
        font-family: fantasy;
        border: 1px solid orange;
        margin: 5px;
        padding: 5px;
        background-color: skyblue;
    }
    .logo {
        background-image: url(http://f1.mozillamessaging.com/favicon.ico);
        background-repeat: no-repeat;
        padding: 10px;
        float: left;
    }
    .footer-text {
        padding-left: 30px;
    }
    </style>
</head>
<body>
    <div class="message">
        ${context.write(c.message)}
% if c.shorturl and c.longurl:
        <br /> <a class="link" href="${c.shorturl}">${c.longurl}</a>
% elif c.longurl:
        <br /> <a class="link" href="${c.longurl}">${c.longurl}</a>
% elif c.shorturl:
        <br /> <a class="link" href="${c.shorturl}">${c.shorturl}</a>
% endif
    </div>
    <div class="footer">
        <div class="logo"></div>
        <div class="footer-text">
        This shared link has been brought to you by <a href="http://f1.mozillamessaging.com/">Mozilla F1</a>.
        </div>
    </div>
</body>
</html>