from cStringIO import StringIO
from linkdrop.lib import shortener
from mock import patch
from nose import tools
import json

@patch('linkdrop.lib.shortener.log')
@patch('linkdrop.lib.shortener.urllib')
def test_shorten_link_bad_response(mock_urllib, mock_log):
    longurl = 'http://example.com/long/long/really/no/i/mean/really/long/url'
    shortener_response = 'BAD RESPONSE'
    mock_urllib.urlopen.return_value = StringIO(shortener_response)
    res = shortener.shorten_link(longurl)
    tools.ok_(res is None)
    mock_urllib.urlopen.assert_called_once()
    urlopen_arg = mock_urllib.urlopen.call_args[0][0]
    tools.ok_('longUrl=%s' % longurl in urlopen_arg)
    mock_log.error.assert_called_once_with(
        "unexpected bitly response: %r", shortener_response)

@patch('linkdrop.lib.shortener.urllib')
def test_shorten_link(mock_urllib):
    longurl = 'http://example.com/long/long/really/no/i/mean/really/long/url'
    shorturl = 'http://sh.ort/url'
    shortener_response = json.dumps({'data': {'url': shorturl}})
    mock_urllib.urlopen.return_value = StringIO(shortener_response)
    res = shortener.shorten_link(longurl)
    tools.eq_(shorturl, res)
    mock_urllib.urlopen.assert_called_once()
    urlopen_arg = mock_urllib.urlopen.call_args[0][0]
    tools.ok_('longUrl=%s' % longurl in urlopen_arg)

