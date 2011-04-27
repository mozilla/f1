from cStringIO import StringIO
from linkdrop.lib import shortener
from mock import patch
from nose import tools
import json
import urlparse

config = {'bitly.userid': 'BITLY_USERID',
          'bitly.key': 'BITLY_KEY',
          }


@patch('linkdrop.lib.shortener.log')
@patch('linkdrop.lib.shortener.urllib')
def test_shorten_link_bad_response(mock_urllib, mock_log):
    longurl = 'http://example.com/long/long/really/no/i/mean/really/long/url'
    shortener_response = 'BAD RESPONSE'
    mock_urllib.urlopen.return_value = StringIO(shortener_response)
    res = shortener.shorten_link(config, longurl)
    tools.ok_(res is None)
    mock_urllib.urlopen.assert_called_once()
    urlopen_arg = mock_urllib.urlopen.call_args[0][0]
    tools.ok_('longUrl=%s' % longurl in urlopen_arg)
    mock_log.error.assert_called_once_with(
        "unexpected bitly response: %r", shortener_response)


@patch('linkdrop.lib.shortener.urllib')
def test_shorten_link(mock_urllib):
    longurl = 'http://example.com/long/long/really/no/i/mean/really/long/url'
    shorturl = 'http://sh.ort/url/%s/%s'

    def mock_shortener(url):
        query = urlparse.urlparse(url).query
        qdict = urlparse.parse_qs(query)
        bitly_userid = qdict.get('login')[0]
        bitly_key = qdict.get('apiKey')[0]
        result = shorturl % (bitly_userid, bitly_key)
        shortener_response = json.dumps({'data': {'url': result}})
        return StringIO(shortener_response)
    mock_urllib.urlopen.side_effect = mock_shortener
    res = shortener.shorten_link(config, longurl)
    tools.eq_(shorturl % (config['bitly.userid'], config['bitly.key']), res)
    mock_urllib.urlopen.assert_called_once()
    urlopen_arg = mock_urllib.urlopen.call_args[0][0]
    tools.ok_('longUrl=%s' % longurl in urlopen_arg)
