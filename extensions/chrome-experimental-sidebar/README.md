Google Chrome Experimental Sidebar Extension
===============================

This is a quick experiement using Google Chrome and the sidebar sharing design.

Note that this extension does not actually share.  The buttons in the loaded page do nothing no matter how much you click.

To run this you might want to look over the [Google Chrome Extension docs](http://code.google.com/chrome/extensions/)


Step 1 - Run Google Chrome with Experimental Extensions
------------------------------

Shutdown Google Chrome and run with the [Experimental Extension APIs](http://code.google.com/chrome/extensions/experimental.html) running.

On the Mac here's how you could do this from inside the Terminal:
	/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-experimental-extension-apis

Step 2 - Load Extension 
------------------------------

Now click on the Tool button to the far right of the Chrome URL bar.  Choose *Tools > Extensions*.  

In the Extensions tabs expand the *Developer mode*.

Now click *Load unpacked extension* and navigate the file dialog to this folder.

Step 3 - Open Sidebar
------------------------------

A new icon should appear in the toolbar beside the Tool button.  

Clicking the share icon should toggle open experimental sidebar.
